import test from "node:test";
import assert from "node:assert/strict";
import { createAiClient } from "../src/enrichment/ai-client.js";
import { filterFreshFeedItems, filterItemsWithinHours, isHighSignalFeedItem } from "../src/ingest/feed-utils.js";
import { createNewsRepository } from "../src/storage/news-repository.js";
import { __test } from "../worker.js";
import { createTelegramClient } from "../src/telegram/client.js";
import { createScheduledHandler } from "../src/runtime/scheduled.js";
import { createFetchRouter } from "../src/runtime/fetch-router.js";
import { HTTP_ROUTES, createHttpRouteTable } from "../src/http/routes.js";

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

test("RSS source fetch normalizes valid items and rejects upstream errors", async () => {
  const source = {
    id: "test-source",
    name: "Test Source",
    feedUrl: "https://example.test/feed.xml",
    format: "rss",
    tags: ["frontend"],
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(
    "<rss><channel><item><title>Release</title><link>https://example.test/release</link><description>Details</description><pubDate>Tue, 17 Nov 2026 10:00:00 GMT</pubDate><category>vue</category></item></channel></rss>",
    { status: 200 },
  );

  try {
    const items = await __test.fetchContentSource(source);
    assert.equal(items[0].sourceId, "test-source");
    assert.equal(items[0].title, "Release");
    assert.equal(items[0].publishedAt, "2026-11-17T10:00:00.000Z");
  } finally {
    globalThis.fetch = originalFetch;
  }

  globalThis.fetch = async () => new Response("down", { status: 503 });
  try {
    await assert.rejects(__test.fetchContentSource(source), /Test Source failed: 503/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Atom source fetch selects alternate links and published dates", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(
    "<feed><entry><title>Nuxt update</title><link rel=\"alternate\" href=\"https://example.test/nuxt\"/><summary>Details</summary><published>2026-11-17T09:00:00Z</published><category term=\"nuxt\"/></entry></feed>",
    { status: 200 },
  );
  try {
    const items = await __test.fetchContentSource({ id: "atom", name: "Atom", feedUrl: "https://example.test/atom", format: "atom", tags: [] });
    assert.deepEqual(items[0], {
      source: "Atom",
      sourceId: "atom",
      title: "Nuxt update",
      url: "https://example.test/nuxt",
      summary: "Details",
      publishedAt: "2026-11-17T09:00:00.000Z",
      tags: ["nuxt"],
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Telegram client sends, edits and acknowledges messages", async () => {
  const calls = [];
  const client = createTelegramClient({ TELEGRAM_BOT_TOKEN: "token" }, {
    fetchImpl: async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body) });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    },
  });

  await client.sendMessage("7", "hello", { replyMarkup: { inline_keyboard: [] } });
  await client.editMessageText("7", 10, "updated");
  await client.answerCallbackQuery("cb", "done");
  await client.answerCallbackQuery("");

  assert.equal(calls.length, 3);
  assert.match(calls[0].url, /sendMessage$/);
  assert.equal(calls[0].body.reply_markup.inline_keyboard.length, 0);
  assert.match(calls[1].url, /editMessageText$/);
  assert.match(calls[2].url, /answerCallbackQuery$/);
});

test("Telegram client exposes upstream send and edit failures", async () => {
  const client = createTelegramClient({ TELEGRAM_BOT_TOKEN: "token" }, {
    fetchImpl: async () => new Response("no", { status: 502 }),
  });

  await assert.rejects(client.sendMessage("7", "hello"), /Telegram failed: 502 no/);
  await assert.rejects(client.editMessageText("7", 10, "updated"), /Telegram edit failed: 502 no/);
});

test("scheduled handler continues after profile sync failure and sends digest at configured UTC hour", async () => {
  const calls = [];
  const scheduled = createScheduledHandler({
    ensureProfile: async () => { throw new Error("profile unavailable"); },
    run: async () => calls.push("run"),
    sendDigest: async () => calls.push("digest"),
    dailyDigestHour: 6,
    now: () => new Date("2026-11-17T06:15:00.000Z"),
  });

  await scheduled();
  assert.deepEqual(calls, ["run", "digest"]);
});

test("scheduled handler skips digest outside the configured hour", async () => {
  const calls = [];
  await createScheduledHandler({
    ensureProfile: async () => calls.push("profile"),
    run: async () => calls.push("run"),
    sendDigest: async () => calls.push("digest"),
    dailyDigestHour: 6,
    now: () => new Date("2026-11-17T07:15:00.000Z"),
  })();
  assert.deepEqual(calls, ["profile", "run"]);
});

test("HTTP router dispatches by path and method and rejects unsupported methods", async () => {
  const calls = [];
  const router = createFetchRouter({
    routes: createHttpRouteTable({
      "/health": async (_request, _env, _ctx, url) => {
        calls.push(url.pathname);
        return new Response("ok");
      },
    }),
    fallback: async () => new Response("fallback", { status: 404 }),
    methodNotAllowed: (methods) => new Response("method", { status: 405, headers: { Allow: methods.join(", ") } }),
  });

  const ok = await router(new Request("https://example.test/health"), {}, {});
  const wrong = await router(new Request("https://example.test/health", { method: "POST" }), {}, {});
  const missing = await router(new Request("https://example.test/missing"), {}, {});
  assert.equal(ok.status, 200);
  assert.equal(wrong.status, 405);
  assert.equal(wrong.headers.get("allow"), "GET");
  assert.equal(missing.status, 404);
  assert.deepEqual(calls, ["/health"]);
  assert.equal(HTTP_ROUTES.length, 13);
});
