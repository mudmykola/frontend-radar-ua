import test from "node:test";
import assert from "node:assert/strict";
import { createAiClient } from "../src/enrichment/ai-client.js";
import { filterFreshFeedItems, filterItemsWithinHours, isHighSignalFeedItem } from "../src/ingest/feed-utils.js";
import { createNewsRepository } from "../src/storage/news-repository.js";

class MemoryKv {
  constructor(entries = {}) {
    this.entries = new Map(Object.entries(entries));
    this.putOptions = [];
  }

  async get(key) { return this.entries.get(key) ?? null; }
  async put(key, value, options) {
    this.entries.set(key, value);
    this.putOptions.push({ key, options });
  }
  async list({ prefix = "" } = {}) {
    return {
      keys: [...this.entries.keys()]
        .filter((name) => name.startsWith(prefix))
        .map((name) => ({ name })),
      list_complete: true,
    };
  }
}

function repositoryOptions() {
  return {
    latestPrefix: "latest:item:",
    digestPrefix: "digest:item:",
    latestLimit: 10,
    digestLimit: 10,
    ttlSeconds: 3600,
    createItemId: async (item) => item.id,
    serialize: (item) => item,
    filterFresh: (items) => items.filter((item) => item.fresh !== false),
    filterWithinHours: (items, hours) => items.filter((item) => item.hours <= hours),
    isPublishable: (item) => item.publishable !== false,
    sortByDate: (items) => [...items].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)),
  };
}

test("news repository saves records with TTL and reads latest records", async () => {
  const kv = new MemoryKv();
  const repository = createNewsRepository({ SHOPIFY_RADAR_KV: kv }, repositoryOptions());
  const item = { id: "one", url: "https://example.test/one", publishedAt: "2026-11-17", hours: 2 };

  await repository.saveLatestItem(item);
  const latest = await repository.getLatestItems();

  assert.deepEqual(latest, [item]);
  assert.equal(kv.putOptions[0].key, "latest:item:one");
  assert.equal(kv.putOptions[0].options.expirationTtl, 3600);
});

test("news repository deduplicates URLs and keeps newest record", async () => {
  const kv = new MemoryKv({
    "latest:item:old": JSON.stringify({ id: "old", url: "same", publishedAt: "2026-11-15", hours: 48 }),
    "latest:item:new": JSON.stringify({ id: "new", url: "same", publishedAt: "2026-11-17", hours: 2 }),
  });
  const repository = createNewsRepository({ SHOPIFY_RADAR_KV: kv }, repositoryOptions());

  const latest = await repository.getLatestItems();
  assert.deepEqual(latest.map((item) => item.id), ["new"]);
});

test("news repository applies publishability and requested freshness window", async () => {
  const kv = new MemoryKv({
    "latest:item:fresh": JSON.stringify({ id: "fresh", url: "fresh", publishedAt: "2026-11-17", hours: 12 }),
    "latest:item:old": JSON.stringify({ id: "old", url: "old", publishedAt: "2026-11-10", hours: 72 }),
    "latest:item:fallback": JSON.stringify({ id: "fallback", url: "fallback", publishedAt: "2026-11-17", hours: 1, publishable: false }),
  });
  const repository = createNewsRepository({ SHOPIFY_RADAR_KV: kv }, repositoryOptions());

  assert.deepEqual((await repository.getLatestItems(48)).map((item) => item.id), ["fresh"]);
});

test("news repository ignores malformed KV records and keeps digest separate", async () => {
  const kv = new MemoryKv({
    "latest:item:bad": "not-json",
    "digest:item:digest": JSON.stringify({ id: "digest", url: "digest", publishedAt: "2026-11-17", hours: 1 }),
  });
  const repository = createNewsRepository({ SHOPIFY_RADAR_KV: kv }, repositoryOptions());

  assert.deepEqual(await repository.getLatestItems(), []);
  assert.deepEqual((await repository.getDigestItems()).map((item) => item.id), ["digest"]);
});

function createAiTestClient(env = {}) {
  return createAiClient({
    AI_BASE_URL: "https://ai.test/v1beta/openai/",
    AI_MODEL: "primary",
    AI_FALLBACK_MODELS: "secondary",
    AI_API_KEY: "secret",
    ...env,
  }, {
    normalizeBaseUrl: (value) => String(value || "").replace(/\/$/, ""),
    normalizeList: (values) => [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))],
    clampNumber: (value, min, max) => Math.min(max, Math.max(min, Number(value))),
    delay: async () => {},
    safeErrorMessage: (error) => String(error?.message || error),
    retryableStatuses: new Set([429, 500, 502, 503, 504]),
    maxRetries: 1,
    retryBaseDelayMs: 1,
  });
}

test("AI client sends the expected OpenAI-compatible request", async () => {
  let request;
  const client = createAiTestClient();
  const result = await client.requestCompletion({ system: "rules", prompt: "hello" }, {
    maxRetries: 0,
    fetchImpl: async (url, init) => {
      request = { url, init };
      return new Response(JSON.stringify({ choices: [{ message: { content: "готово" } }] }), { status: 200 });
    },
  });

  assert.equal(result, "готово");
  assert.equal(request.url, "https://ai.test/v1beta/openai/chat/completions");
  assert.equal(request.init.headers.Authorization, "Bearer secret");
  assert.equal(JSON.parse(request.init.body).model, "primary");
});

test("AI client retries 429 using Retry-After and then succeeds", async () => {
  const statuses = [429, 200];
  const delays = [];
  const client = createAiTestClient();
  const result = await client.requestCompletion({ system: "", prompt: "" }, {
    maxRetries: 1,
    sleepImpl: async (ms) => delays.push(ms),
    fetchImpl: async () => new Response(
      statuses.shift() === 200 ? JSON.stringify({ choices: [{ text: "ok" }] }) : "",
      { status: statuses.length ? 429 : 200, headers: { "retry-after": "2" } },
    ),
  });

  assert.equal(result, "ok");
  assert.deepEqual(delays, [2000]);
});

test("AI client falls back only for retryable or missing-model failures", async () => {
  const attempted = [];
  const client = createAiTestClient();
  const result = await client.requestCompletionWithFallback({ system: "", prompt: "", model: "primary" }, {
    maxRetries: 0,
    fetchImpl: async (_url, init) => {
      const model = JSON.parse(init.body).model;
      attempted.push(model);
      return model === "primary"
        ? new Response("", { status: 404 })
        : new Response(JSON.stringify({ output_text: "fallback" }), { status: 200 });
    },
  });

  assert.equal(result, "fallback");
  assert.deepEqual(attempted, ["primary", "secondary"]);
});

test("AI client rejects permanent errors without trying the fallback model", async () => {
  const attempted = [];
  const client = createAiTestClient();

  await assert.rejects(
    client.requestCompletionWithFallback({ system: "", prompt: "", model: "primary" }, {
      maxRetries: 0,
      fetchImpl: async (_url, init) => {
        attempted.push(JSON.parse(init.body).model);
        return new Response("bad request", { status: 400 });
      },
    }),
    /status 400/
  );
  assert.deepEqual(attempted, ["primary"]);
});

test("AI client validates required configuration and rejects empty responses", async () => {
  const missingKey = createAiTestClient({ AI_API_KEY: "" });
  await assert.rejects(missingKey.callText({ system: "", prompt: "" }), /Missing AI_API_KEY/);

  const client = createAiTestClient();
  await assert.rejects(client.requestCompletion({ system: "", prompt: "" }, {
    maxRetries: 0,
    fetchImpl: async () => new Response(JSON.stringify({ choices: [{ message: { content: " " } }] }), { status: 200 }),
  }), /empty response/);
});

test("feed filters reject future, stale, prerelease and routine patch noise", () => {
  const now = Date.parse("2026-11-17T12:00:00.000Z");
  const items = [
    { title: "Stable feature", sourceId: "vue", url: "stable", publishedAt: "2026-11-17T10:00:00.000Z" },
    { title: "Vue 4.0.0-beta.1", sourceId: "vue", url: "beta", publishedAt: "2026-11-17T09:00:00.000Z" },
    { title: "v1.2.3", sourceId: "vite", url: "patch", publishedAt: "2026-11-17T08:00:00.000Z", summary: "routine patch" },
    { title: "Future", sourceId: "vue", url: "future", publishedAt: "2026-11-18T10:00:00.000Z" },
  ];

  const fresh = filterFreshFeedItems(items, now, 7).filter(isHighSignalFeedItem);
  assert.deepEqual(fresh.map((item) => item.title), ["Stable feature"]);
  assert.deepEqual(filterItemsWithinHours(items, 48, now).map((item) => item.title), [
    "Stable feature", "Vue 4.0.0-beta.1", "v1.2.3",
  ]);
});

test("feed high-signal filter rejects records without required publication data", () => {
  assert.equal(isHighSignalFeedItem({ title: "No URL", publishedAt: "2026-11-17" }), false);
  assert.equal(isHighSignalFeedItem({ title: "No date", url: "https://example.test/item" }), false);
});
