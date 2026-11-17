import test from "node:test";
import assert from "node:assert/strict";
import { createAiClient } from "../src/enrichment/ai-client.js";
import { filterFreshFeedItems, filterItemsWithinHours, filterItemsByLookback, isHighSignalFeedItem } from "../src/ingest/feed-utils.js";
import { createNewsRepository } from "../src/storage/news-repository.js";
import { __test } from "../worker.js";
import { createTelegramClient } from "../src/telegram/client.js";
import { createScheduledHandler } from "../src/runtime/scheduled.js";
import { createFetchRouter } from "../src/runtime/fetch-router.js";
import { HTTP_ROUTES, createHttpRouteTable } from "../src/http/routes.js";
import { createSubscriberRepository } from "../src/storage/subscriber-repository.js";
import { createTelegramDelivery } from "../src/telegram/delivery.js";
import { createTelegramWebhookProcessor } from "../src/telegram/webhook.js";
import { createTelegramUpdateHandler } from "../src/telegram/update-handler.js";
import { createAiEditor } from "../src/enrichment/editor.js";
import { createQualityGate } from "../src/enrichment/quality-gate.js";
import { createArticleContext } from "../src/ingest/article-context.js";
import { createTelegramFormatters } from "../src/telegram/formatters.js";
import { createRunPipeline } from "../src/runtime/run-pipeline.js";
import { createTelegramHandlers } from "../src/telegram/handlers.js";
import { normalizeTelegramCommand, parseCommandArgs, parseOptionalIndex } from "../src/telegram/parsing.js";
import { buildFallbackApplicationItems, buildFallbackChecklistItems } from "../src/enrichment/fallback-content.js";
import { createEvidenceRules } from "../src/enrichment/evidence.js";
import { createItemBuilder } from "../src/enrichment/item-builder.js";
import { buildRemoveKeyboard, buildListInlineKeyboard, buildItemInlineKeyboard, buildSettingsInlineKeyboard } from "../src/telegram/keyboards.js";

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

test("AI client callText uses configured model and rejects an empty fallback chain", async () => {
  const client = createAiTestClient({ AI_MODEL: "" });
  await assert.rejects(client.callText({ system: "s", prompt: "p" }), /Missing AI_MODEL/);
});

test("AI client reports exhausted transient retries", async () => {
  const client = createAiTestClient();
  await assert.rejects(client.requestCompletion({ system: "", prompt: "" }, {
    maxRetries: 0,
    fetchImpl: async () => new Response("", { status: 503 }),
  }), /після 1 спроб/);
});

test("AI editor separates facts extraction and editorial summary execution", async () => {
  const calls = [];
  const editor = createAiEditor({}, {
    callText: async (request) => { calls.push(["facts", request]); return "facts"; },
    requestCompletionWithFallback: async (request) => { calls.push(["summary", request]); return "summary"; },
  });
  assert.equal(await editor.extractFacts({ system: "facts", prompt: "source" }), "facts");
  assert.equal(await editor.summarize({ system: "editor", prompt: "facts", model: "primary" }), "summary");
  assert.equal(calls[0][0], "facts");
  assert.equal(calls[1][0], "summary");
});

test("quality gate keeps immediate delivery and publishability rules centralized", () => {
  const gate = createQualityGate({ minPublishQuality: 70, minImmediateRelevance: 7, normalizeScore: (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback, hasContaminatedContent: (item) => Boolean(item.contaminated) });
  assert.equal(gate.shouldSendImmediate({ priority: "P0" }), true);
  assert.equal(gate.shouldSendImmediate({ priority: "P1", relevance: 7, benefit: 6, confidence: 6 }), true);
  assert.equal(gate.shouldSendImmediate({ priority: "P2", relevance: 9, benefit: 8, confidence: 7 }), true);
  assert.equal(gate.shouldSendImmediate({ priority: "P2", relevance: 2, benefit: 2, confidence: 2 }), false);
  assert.equal(gate.isPublishableItem({ qualityScore: 90, verifiedFacts: ["a", "b"] }), true);
  assert.equal(gate.isPublishableItem({ qualityScore: 90, verifiedFacts: ["a"], contaminated: true }), false);
});

test("article context keeps RSS fallback and rejects unsafe redirects", async () => {
  const context = createArticleContext({
    approvedHosts: new Set(["docs.example.test"]),
    timeoutMs: 50,
    maxChars: 500,
    fetchImpl: async (url) => {
      if (url.endsWith("/redirect")) return new Response(null, { status: 302, headers: { location: "https://evil.example.test/article" } });
      throw new Error("upstream unavailable");
    },
    readResponseTextLimited: async (response) => response.text(),
    cleanHtml: (value) => String(value).replace(/\s+/g, " ").trim(),
    safeIsoDate: () => "",
  });

  assert.deepEqual(await context.enrichItemWithArticleContext({ title: "RSS", url: "https://docs.example.test/article" }), {
    title: "RSS", url: "https://docs.example.test/article", articleContext: "", contextSource: "rss",
  });
  await assert.rejects(context.fetchArticleContext("https://docs.example.test/redirect"), /Unsafe article redirect/);
  await assert.rejects(context.fetchArticleContext("http://docs.example.test/article"), /Article host is not approved/);
});

test("Telegram formatter keeps compact cards actionable and escaped", () => {
  const formatter = createTelegramFormatters({
    normalizeStoredStructuredItem: (item) => item,
    getPriorityBadge: () => "🟡",
    getPriorityLabel: () => "важливо",
    translateArea: (value) => value,
    escapeHtml: (value) => String(value).replace(/</g, "&lt;").replace(/>/g, "&gt;"),
    cleanStructuredText: (value) => value,
    inferAudience: () => "розробникам",
  });
  const output = formatter.formatCompactItems([{ title: "<Feature>", area: "Nuxt", essence: "Зміна", todayAction: "Перевірити" }]);
  assert.match(output, /&lt;Feature&gt;/);
  assert.match(output, /Факт: Зміна/);
  assert.match(output, /👉 \/full 1/);
});

test("run pipeline exposes a stable result boundary", () => {
  const pipeline = createRunPipeline({
    maxItemsPerRun: 3,
    latestItemKeyPrefix: "latest:item:",
    runLastKey: "run:last",
    seenTtlSeconds: 60,
    latestItemsLimit: 7,
    lookbackDays: 90,
    maxIndexedItemsPerSource: 2,
  });
  assert.deepEqual(pipeline.buildRunResultItem({ title: "Change", url: "https://example.test", impactTags: ["performance"] }, { rawAiSummary: "details" }), {
    title: "Change", uaTitle: undefined, url: "https://example.test", priority: undefined, relevance: undefined,
    area: undefined, qualityScore: undefined, impactTags: ["performance"], usedFallback: false,
    fallbackReason: null, silent: false, ignoreSeen: false, rawAiPreview: "details",
  });
});

test("Telegram handlers keep update and callback boundaries isolated", async () => {
  const calls = [];
  const handlers = createTelegramHandlers({
    normalizeCommand: () => "/unknown",
    parseArgs: () => [],
    sendUnknownCommand: async (chatId) => calls.push(["unknown", chatId]),
    answerCallbackQuery: async (_id, _env, text) => calls.push(["callback", text]),
  });
  await handlers.handleMessage({ message: { chat: { id: 7 }, text: "hello" } }, {});
  await handlers.handleCallback({ id: "cb", message: { chat: { id: 7 } }, data: "other" }, {});
  assert.deepEqual(calls, [["unknown", 7], ["callback", "Команду не розпізнано"]]);
});

test("Telegram parsing normalizes buttons, bot suffixes and indexes", () => {
  assert.equal(normalizeTelegramCommand("🆕 останні"), "/latest");
  assert.equal(normalizeTelegramCommand("/latest@frontend_radar_bot"), "/latest");
  assert.deepEqual(parseCommandArgs("/full 3"), ["3"]);
  assert.equal(parseOptionalIndex("2.9"), 2);
  assert.equal(parseOptionalIndex("bad"), null);
});

test("fallback content stays source-area specific", () => {
  assert.match(buildFallbackApplicationItems({}, "Nuxt")[0], /Nuxt/);
  assert.match(buildFallbackChecklistItems({}, "Cloudflare")[1], /compatibility/);
  assert.equal(buildFallbackChecklistItems({}, "Other").length, 3);
});

test("evidence rules keep tags source-aware and remove article UI noise", () => {
  const rules = createEvidenceRules({
    cleanStructuredText: (value) => String(value || "").trim(),
    cleanHtml: (value) => String(value || "").replace(/<[^>]+>/g, " "),
    normalizeList: (values) => [...new Set((values || []).map(String).filter(Boolean))],
    normalizeTags: (values) => [...new Set((values || []).map((value) => String(value).toLowerCase()).filter(Boolean))],
    buildSearchText: (item) => [item.title, item.summary, item.articleContext].filter(Boolean).join(" "),
  });
  assert.deepEqual(rules.extractEvidenceFacts({ summary: "First confirmed change affects the production API behavior. Second confirmed effect changes the rendering pipeline." }), ["First confirmed change affects the production API behavior.", "Second confirmed effect changes the rendering pipeline."]);
  assert.deepEqual(rules.constrainImpactTagsToEvidence(["security", "performance-opportunity"], { sourceId: "vue", summary: "Improves performance" }), ["performance-opportunity"]);
  assert.equal(rules.isContaminatedText("Reload to refresh your session."), true);
  assert.equal(rules.buildNotFor("Nuxt"), "Проєкти без Nuxt, SSR або Nitro.");
});

test("item builder merges normalized AI fields with source metadata", () => {
  const builder = createItemBuilder({ normalizeStructuredSummary: (summary) => ({ ...summary, uaTitle: "Нова картка", qualityScore: 88 }), now: () => "2026-11-17T00:00:00.000Z" });
  const item = builder.buildEnrichedItem({ title: "Source", url: "https://example.test" }, { essence: "Change" }, { itemId: "id", usedFallback: true, fallbackReason: "test" });
  assert.equal(item.itemId, "id");
  assert.equal(item.uaTitle, "Нова картка");
  assert.equal(item.usedFallback, true);
  assert.equal(item.savedAt, "2026-11-17T00:00:00.000Z");
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

test("feed lookback keeps undated records for later validation", () => {
  const now = Date.parse("2026-11-17T12:00:00.000Z");
  const kept = filterItemsByLookback([
    { title: "Undated" },
    { title: "Recent", publishedAt: "2026-11-16T12:00:00.000Z" },
    { title: "Old", publishedAt: "2026-11-01T12:00:00.000Z" },
  ], 7, now);
  assert.deepEqual(kept.map((item) => item.title), ["Undated", "Recent"]);
});

test("feed filter rejects routine Cloudflare, prerelease and generic release noise", () => {
  const base = { url: "https://example.test/item", publishedAt: "2026-11-17T10:00:00Z" };
  assert.equal(isHighSignalFeedItem({ ...base, title: "Cloudflare One Client update", sourceId: "cloudflare" }), false);
  assert.equal(isHighSignalFeedItem({ ...base, title: "v1.2.3", sourceId: "node", summary: "Refer to the changelog" }), false);
  assert.equal(isHighSignalFeedItem({ ...base, title: "Nuxt nightly", sourceId: "nuxt" }), false);
  assert.equal(isHighSignalFeedItem({ ...base, title: "Node security release v1.2.3", sourceId: "node" }), true);
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

test("subscriber repository preserves preferences and tombstones inactive subscribers", async () => {
  const kv = new MemoryKv({
    "telegram:subscribers": JSON.stringify([{ chatId: "legacy", active: true }]),
    "telegram:subscriber:legacy": JSON.stringify({ chatId: "legacy", active: false }),
  });
  const repository = createSubscriberRepository({ SHOPIFY_RADAR_KV: kv }, {
    subscriberPrefix: "telegram:subscriber:", subscribersKey: "telegram:subscribers", feedbackPrefix: "feedback:",
    subscribersLimit: 50, feedbackTtlSeconds: 3600,
    readJsonObjectsByPrefix: async (env, prefix) => {
      const page = await env.SHOPIFY_RADAR_KV.list({ prefix });
      return Promise.all(page.keys.map(async ({ name }) => JSON.parse(await env.SHOPIFY_RADAR_KV.get(name))));
    },
    readJsonArray: async (env, key) => JSON.parse((await env.SHOPIFY_RADAR_KV.get(key)) || "[]"),
    normalizePreferences: (value = {}) => ({ minPriority: ["P0", "P1", "P2"].includes(value.minPriority) ? value.minPriority : "P1", topics: value.topics || [], digestOnly: Boolean(value.digestOnly) }),
    normalizeTags: (tags) => [...new Set(tags.flatMap((tag) => String(tag || "").split(/[,\s]+/).filter(Boolean)))],
    normalizeStoredStructuredItem: (item) => item,
    normalizeScore: (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback,
    createItemId: async (item) => item.itemId || "generated",
  });

  assert.deepEqual(await repository.getSubscribers(), []);
  const saved = await repository.saveSubscriber("7", { chat: { type: "private" }, from: { username: "reader" } });
  assert.equal(saved.chatId, "7");
  assert.equal((await repository.getSubscribers())[0].username, "reader");
  await repository.removeSubscriber("7");
  assert.deepEqual(await repository.getSubscribers(), []);
});

test("subscriber repository records feedback and applies preference weights", async () => {
  const kv = new MemoryKv();
  const repository = createSubscriberRepository({ SHOPIFY_RADAR_KV: kv }, {
    subscriberPrefix: "telegram:subscriber:", subscribersKey: "telegram:subscribers", feedbackPrefix: "feedback:",
    subscribersLimit: 50, feedbackTtlSeconds: 3600,
    readJsonObjectsByPrefix: async (env, prefix) => {
      const page = await env.SHOPIFY_RADAR_KV.list({ prefix });
      return Promise.all(page.keys.map(async ({ name }) => JSON.parse(await env.SHOPIFY_RADAR_KV.get(name))));
    },
    readJsonArray: async () => [],
    normalizePreferences: (value = {}) => ({ minPriority: value.minPriority || "P1", topics: value.topics || [], digestOnly: Boolean(value.digestOnly) }),
    normalizeTags: (tags) => [...new Set(tags.flatMap((tag) => String(tag || "").split(/[,\s]+/).filter(Boolean)))],
    normalizeStoredStructuredItem: (item) => item,
    normalizeScore: (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback,
    createItemId: async (item) => item.itemId || "generated",
  });

  const item = { itemId: "a", area: "Nuxt", devTags: ["nuxt"], impactTags: [], relevance: 8, benefit: 8, risk: 4 };
  await repository.saveContentFeedback("7", item, "interesting");
  const ranked = await repository.personalizeItems("7", [item, { ...item, itemId: "b", area: "Shopify", devTags: ["shopify"] }]);
  assert.equal(ranked[0].itemId, "a");
  assert.equal((await kv.get("feedback:7:a")) !== null, true);
});

test("subscriber repository updates a new subscriber and generates feedback IDs", async () => {
  const kv = new MemoryKv();
  const repository = createSubscriberRepository({ SHOPIFY_RADAR_KV: kv }, {
    subscriberPrefix: "telegram:subscriber:", subscribersKey: "telegram:subscribers", feedbackPrefix: "feedback:",
    subscribersLimit: 50, feedbackTtlSeconds: 3600,
    readJsonObjectsByPrefix: async () => [], readJsonArray: async () => [],
    normalizePreferences: (value = {}) => ({ minPriority: value.minPriority || "P1", topics: value.topics || [], digestOnly: Boolean(value.digestOnly) }),
    normalizeTags: (tags) => [...new Set(tags.flatMap((tag) => String(tag || "").split(/[,\s]+/).filter(Boolean)))],
    normalizeStoredStructuredItem: (item) => item,
    normalizeScore: (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback,
    createItemId: async () => "generated-id",
  });
  const updated = await repository.updateSubscriber("new", (subscriber) => ({ ...subscriber, preferences: { minPriority: "P0" } }));
  assert.equal(updated.chatId, "new");
  await repository.saveContentFeedback("new", { area: "Nuxt", devTags: [], impactTags: [] }, "useful");
  assert.ok(await kv.get("feedback:new:generated-id"));
});

test("Telegram delivery isolates subscriber failures and reports skipped recipients", async () => {
  const sent = [];
  const delivery = createTelegramDelivery({
    getSubscribers: async () => [{ chatId: "ok" }, { chatId: "skip" }, { chatId: "fail" }],
    shouldDeliverToSubscriber: (_item, subscriber) => subscriber.chatId !== "skip",
    sendRaw: async (chatId) => {
      if (chatId === "fail") throw new Error("network down");
      sent.push(chatId);
    },
    delay: async () => {},
    concurrency: 2,
    batchDelayMs: 0,
    safeErrorMessage: (error) => String(error.message),
  });

  const result = await delivery.sendMessage("news", {}, { item: { title: "change" } });
  assert.deepEqual(sent, ["ok"]);
  assert.equal(result.subscribers, 3);
  assert.equal(result.deliveredSubscribers, 1);
  assert.equal(result.skippedSubscribers, 1);
  assert.deepEqual(result.failed, [{ chatId: "fail", error: "network down" }]);
});

test("Telegram delivery uses configured fallback chat when there are no subscribers", async () => {
  const sent = [];
  const delivery = createTelegramDelivery({
    getSubscribers: async () => [],
    shouldDeliverToSubscriber: () => true,
    sendRaw: async (chatId) => sent.push(chatId),
    delay: async () => {},
    safeErrorMessage: String,
  });
  const result = await delivery.sendMessage("news", { TELEGRAM_CHAT_ID: "admin" });
  assert.equal(result.fallback, true);
  assert.deepEqual(sent, ["admin"]);
});

test("Telegram webhook processor deduplicates updates and marks only successful work", async () => {
  const kv = new MemoryKv();
  const processed = [];
  const processor = createTelegramWebhookProcessor({ SHOPIFY_RADAR_KV: kv }, {
    keyPrefix: "telegram:update:",
    ttlSeconds: 60,
    handleUpdate: async (update) => {
      processed.push(update.update_id);
      if (update.update_id === 2) throw new Error("failed");
    },
  });

  await processor.process({ update_id: 1 });
  await processor.process({ update_id: 1 });
  await assert.rejects(processor.process({ update_id: 2 }), /failed/);
  assert.deepEqual(processed, [1, 2]);
  assert.equal(await kv.get("telegram:update:1"), "1");
  assert.equal(await kv.get("telegram:update:2"), null);
});

test("Telegram update handler routes callback queries and messages to separate boundaries", async () => {
  const calls = [];
  const handle = createTelegramUpdateHandler({
    handleCallback: async (value) => calls.push(["callback", value]),
    handleMessage: async (value) => calls.push(["message", value]),
  });
  await handle({ callback_query: { id: "cb" } }, {});
  await handle({ message: { text: "/latest" } }, {});
  assert.deepEqual(calls, [["callback", { id: "cb" }], ["message", { message: { text: "/latest" } }]]);
});

test("Telegram keyboards cover empty references, removal and preference states", () => {
  assert.deepEqual(buildRemoveKeyboard(), { remove_keyboard: true });
  assert.equal(buildListInlineKeyboard([{ title: "legacy" }])[0]?.inline_keyboard?.length, undefined);
  const list = buildListInlineKeyboard([{ title: "legacy" }, { itemId: "abc" }]);
  assert.match(list.inline_keyboard[0][0].callback_data, /^card:0$/);
  assert.match(list.inline_keyboard[1][0].callback_data, /^article:abc/);
  assert.equal(buildItemInlineKeyboard({ url: "https://example.test" }).inline_keyboard.length, 1);
  const settings = buildSettingsInlineKeyboard({ minPriority: "P2", topics: ["vue"], digestOnly: true });
  assert.match(settings.inline_keyboard[0][0].text, /▫️/);
  assert.match(settings.inline_keyboard[1][0].text, /✅ Усе/);
  assert.match(settings.inline_keyboard[1][1].text, /✅ Тільки digest/);
});
