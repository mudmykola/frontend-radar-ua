import test from "node:test";
import assert from "node:assert/strict";
import worker, { __test } from "../worker.js";

class MemoryKv {
  constructor(entries = {}) {
    this.entries = new Map(Object.entries(entries));
  }

  async get(key) {
    return this.entries.get(key) ?? null;
  }

  async put(key, value) {
    this.entries.set(key, value);
  }

  async delete(key) {
    this.entries.delete(key);
  }

  async list({ prefix = "" } = {}) {
    return {
      keys: [...this.entries.keys()].filter((key) => key.startsWith(prefix)).map((name) => ({ name })),
      list_complete: true,
    };
  }
}

function createEnv(entries = {}) {
  return {
    ADMIN_SECRET: "admin-secret",
    TELEGRAM_WEBHOOK_SECRET: "telegram-secret",
    TELEGRAM_BOT_TOKEN: "bot-token",
    SHOPIFY_RADAR_KV: new MemoryKv(entries),
  };
}

function createContext() {
  const promises = [];
  return {
    promises,
    waitUntil(promise) {
      promises.push(promise);
    },
  };
}

test("health route only accepts GET", async () => {
  const response = await worker.fetch(
    new Request("https://example.test/health", { method: "POST" }),
    createEnv(),
    createContext()
  );

  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "GET");
});

test("admin query-string secret is rejected", async () => {
  const response = await worker.fetch(
    new Request("https://example.test/subscribers?secret=admin-secret"),
    createEnv(),
    createContext()
  );

  assert.equal(response.status, 401);
});

test("admin bearer token authorizes read-only route", async () => {
  const response = await worker.fetch(
    new Request("https://example.test/subscribers", {
      headers: { Authorization: "Bearer admin-secret" },
    }),
    createEnv(),
    createContext()
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.count, 0);
});

test("telegram webhook rejects missing secret header", async () => {
  const response = await worker.fetch(
    new Request("https://example.test/telegram-webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }),
    createEnv(),
    createContext()
  );

  assert.equal(response.status, 401);
});

test("telegram webhook configuration rejects missing secret header", async () => {
  const response = await worker.fetch(
    new Request("https://example.test/configure-telegram-webhook", { method: "POST" }),
    createEnv(),
    createContext()
  );

  assert.equal(response.status, 401);
});

test("telegram webhook info rejects missing secret header", async () => {
  const response = await worker.fetch(
    new Request("https://example.test/telegram-webhook-info"),
    createEnv(),
    createContext()
  );

  assert.equal(response.status, 401);
});

test("telegram webhook validates content type", async () => {
  const response = await worker.fetch(
    new Request("https://example.test/telegram-webhook", {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        "X-Telegram-Bot-Api-Secret-Token": "telegram-secret",
      },
      body: "{}",
    }),
    createEnv(),
    createContext()
  );

  assert.equal(response.status, 415);
});

test("processed marker is written only after webhook work succeeds", async () => {
  const env = createEnv();
  const context = createContext();
  const response = await worker.fetch(
    new Request("https://example.test/telegram-webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "telegram-secret",
      },
      body: JSON.stringify({ update_id: 42 }),
    }),
    env,
    context
  );

  assert.equal(response.status, 200);
  assert.equal(await env.SHOPIFY_RADAR_KV.get("telegram:update:42"), null);
  await Promise.all(context.promises);
  assert.equal(await env.SHOPIFY_RADAR_KV.get("telegram:update:42"), "1");
});

test("legacy subscribers are overridden by per-subscriber tombstones", async () => {
  const env = createEnv({
    "telegram:subscribers": JSON.stringify([{ chatId: "7", active: true }]),
    "telegram:subscriber:7": JSON.stringify({ chatId: "7", active: false }),
  });
  const response = await worker.fetch(
    new Request("https://example.test/subscribers", {
      headers: { Authorization: "Bearer admin-secret" },
    }),
    env,
    createContext()
  );
  const body = await response.json();

  assert.equal(body.count, 0);
});

test("article context removes executable and navigation markup", () => {
  const text = __test.extractReadableArticleText(`
    <nav>Skip me</nav>
    <main><h1>New API version</h1><p>Migration required by October.</p></main>
    <script>steal()</script><style>.hidden{}</style>
  `);

  assert.match(text, /New API version/);
  assert.match(text, /Migration required by October/);
  assert.doesNotMatch(text, /Skip me|steal|hidden/);
});

test("AI structured parser captures decision scores and reader guidance", () => {
  const summary = __test.parseAiStructured(
    `
UA_TITLE: Нове обов’язкове оновлення Admin API
PRIORITY: P0
RELEVANCE: 9
AREA: Admin API
DEV_TAGS: admin-api, migration
IMPACT_TAGS: breaking, client-work
CLIENT_TASK: Перевірити версію API у клієнтських інтеграціях
BENEFIT: 9
RISK: 10
EFFORT: 4
CONFIDENCE: 9
RECOMMENDATION: зробити зараз
HIDDEN_INSIGHT: Старі background jobs також використовують цю API-версію.
NOT_FOR: Магазини без кастомних Admin API інтеграцій.
CLIENT_OPPORTUNITY: Провести аудит API-версій і deprecated полів.
URGENCY: сьогодні
AUDIENCE: Shopify apps з Admin API інтеграціями.
VERIFIED_FACTS: Shopify змінює поведінку Admin API. | Потрібна перевірка API-версії.
AI_CONCLUSION: Найвищий ризик мають старі background jobs і приватні інтеграції.
ASSUMPTIONS: Частина клієнтських jobs може використовувати стару версію.
BEFORE: Інтеграція використовувала стару API-версію.
AFTER: Потрібна сумісність із новою поведінкою API.
EXPECTED_RESULT: Усі запити та jobs проходять regression-тести.
TIME_ESTIMATE: 30–90 хв на перевірку.
TODAY_ACTION: Знайти API clients і перевірити їхні версії.

🧠 Суть:
Shopify змінює обов’язкову поведінку Admin API.
🎯 Чому важливо:
Стара інтеграція може перестати працювати після дедлайну.
🛠 Як застосувати:
• знайти всі API clients
• перевірити версії
✅ Що перевірити:
• deprecated поля
• background jobs
💡 Ідея для розробника:
Автоматизувати перевірку версій у CI.
`,
    { title: "Admin API update", url: "https://shopify.dev/changelog/test", tags: [] }
  );

  assert.equal(summary.benefit, 9);
  assert.equal(summary.risk, 7);
  assert.equal(summary.effort, 4);
  assert.equal(summary.recommendation, "запланувати");
  assert.match(summary.clientOpportunity, /аудит API-версій/);
  assert.equal(summary.verifiedFacts.length, 2);
  assert.match(summary.aiConclusion, /background jobs/);
  assert.match(summary.todayAction, /API clients/);
});

test("immediate delivery suppresses low-confidence low-value content", () => {
  assert.equal(
    __test.shouldSendImmediate({ priority: "P1", relevance: 8, benefit: 8, risk: 5, confidence: 3 }),
    false
  );
  assert.equal(
    __test.shouldSendImmediate({ priority: "P1", relevance: 8, benefit: 8, risk: 5, confidence: 8 }),
    true
  );
});

test("reader feedback changes personalized content order", async () => {
  const env = createEnv({
    "feedback:7:old": JSON.stringify({
      reaction: "interesting",
      area: "Themes",
      tags: ["liquid", "sections"],
    }),
  });
  const items = [
    {
      title: "API",
      url: "https://shopify.dev/changelog/api",
      area: "Admin API",
      priority: "P1",
      relevance: 8,
      benefit: 8,
      risk: 5,
      confidence: 8,
      devTags: ["admin-api"],
    },
    {
      title: "Theme",
      url: "https://shopify.dev/changelog/theme",
      area: "Themes",
      priority: "P1",
      relevance: 7,
      benefit: 7,
      risk: 4,
      confidence: 8,
      devTags: ["liquid", "sections"],
    },
  ];

  const personalized = await __test.personalizeItems("7", items, env);
  assert.equal(personalized[0].title, "Theme");
});

test("Gemini completion retries a transient 503 and succeeds", async () => {
  const statuses = [503, 200];
  const delays = [];
  const content = await __test.requestAiCompletion(
    {
      AI_BASE_URL: "https://generativelanguage.googleapis.com/v1beta/openai",
      AI_MODEL: "gemini-flash-latest",
      AI_API_KEY: "test-key",
    },
    { system: "system", prompt: "prompt" },
    {
      maxRetries: 2,
      sleepImpl: async (delay) => delays.push(delay),
      fetchImpl: async () => {
        const status = statuses.shift();
        return new Response(
          status === 200 ? JSON.stringify({ choices: [{ message: { content: "готово" } }] }) : "",
          { status, headers: { "Content-Type": "application/json" } }
        );
      },
    }
  );

  assert.equal(content, "готово");
  assert.deepEqual(delays, [750]);
});

test("Gemini completion does not retry permanent request errors", async () => {
  let attempts = 0;

  await assert.rejects(
    __test.requestAiCompletion(
      {
        AI_BASE_URL: "https://generativelanguage.googleapis.com/v1beta/openai",
        AI_MODEL: "gemini-flash-latest",
        AI_API_KEY: "test-key",
      },
      { system: "system", prompt: "prompt" },
      {
        maxRetries: 3,
        sleepImpl: async () => assert.fail("should not sleep"),
        fetchImpl: async () => {
          attempts += 1;
          return new Response("", { status: 400 });
        },
      }
    ),
    /status 400/
  );

  assert.equal(attempts, 1);
});

test("v12 falls back to the next stable Gemini model", async () => {
  const attemptedModels = [];
  const content = await __test.requestAiCompletionWithFallback(
    {
      AI_BASE_URL: "https://generativelanguage.googleapis.com/v1beta/openai",
      AI_MODEL: "gemini-primary",
      AI_FALLBACK_MODELS: "gemini-secondary,gemini-tertiary",
      AI_API_KEY: "test-key",
    },
    { system: "system", prompt: "prompt" },
    {
      maxRetries: 0,
      fetchImpl: async (_url, init) => {
        const model = JSON.parse(init.body).model;
        attemptedModels.push(model);
        return model === "gemini-primary"
          ? new Response("", { status: 404 })
          : new Response(JSON.stringify({ choices: [{ message: { content: "працює" } }] }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
      },
    }
  );
  assert.equal(content, "працює");
  assert.deepEqual(attemptedModels, ["gemini-primary", "gemini-secondary"]);
});

test("Gemini completion production retry path uses the runtime delay helper", async () => {
  const statuses = [503, 200];
  const startedAt = Date.now();
  const content = await __test.requestAiCompletion(
    {
      AI_BASE_URL: "https://generativelanguage.googleapis.com/v1beta/openai",
      AI_MODEL: "gemini-flash-latest",
      AI_API_KEY: "test-key",
    },
    { system: "system", prompt: "prompt" },
    {
      maxRetries: 1,
      fetchImpl: async () => {
        const status = statuses.shift();
        return new Response(
          status === 200 ? JSON.stringify({ choices: [{ message: { content: "готово" } }] }) : "",
          { status, headers: { "Content-Type": "application/json" } }
        );
      },
    }
  );

  assert.equal(content, "готово");
  assert.ok(Date.now() - startedAt >= 700);
});

test("full card explains the change plainly with context, example, and one action", () => {
  const message = __test.formatStoredFullItem({
    title: "Admin API change",
    uaTitle: "Зміна Admin API",
    url: "https://shopify.dev/changelog/admin-api-change",
    summary: "Official summary",
    priority: "P1",
    relevance: 8,
    area: "Admin API",
    devTags: ["shopify", "admin-api"],
    essence: "Shopify змінив поведінку API.",
    importance: "Потрібно перевірити інтеграції.",
    applicationItems: ["Знайти API clients", "Запустити regression"],
    checklistItems: ["API version", "Background jobs"],
    devIdea: "Автоматизувати перевірку версій.",
    verifiedFacts: ["Змінено поведінку API", "Опубліковано офіційний changelog"],
    aiConclusion: "Старі jobs мають найбільший ризик.",
    assumptions: ["Частина jobs може бути застарілою"],
    audience: "Shopify apps з Admin API інтеграціями.",
    before: "Стара поведінка API.",
    after: "Нова поведінка API.",
    expectedResult: "Усі jobs проходять regression.",
    todayAction: "Знайти clients і перевірити API version.",
    timeEstimate: "30–90 хв",
    qualityScore: 90,
    usedFallback: false,
  });

  assert.match(message, /Що змінилося/);
  assert.match(message, /Чому це важливо/);
  assert.match(message, /Що зробити/);
  assert.match(message, /Перевірено/);
  assert.match(message, /Було → тепер/);
  assert.match(message, /Приклад/);
  assert.doesNotMatch(message, /Що зробити зараз/);
  assert.doesNotMatch(message, /Коли можна пропустити/);
  assert.doesNotMatch(message, /AI quality|Релевантність|Впевненість/);
  assert.ok(message.length < 2400);
});

test("fresh feed keeps only the seven-day window behind the newest Shopify item", () => {
  const items = [
    { title: "Newest", publishedAt: "2026-08-19T16:00:00.000Z" },
    { title: "Within window", publishedAt: "2026-08-18T16:00:00.000Z" },
    { title: "Too old", publishedAt: "2026-08-10T20:10:00.000Z" },
  ];

  const fresh = __test.filterFreshFeedItems(items, new Date("2026-08-22T12:00:00.000Z").getTime());
  assert.deepEqual(fresh.map((item) => item.title), ["Newest", "Within window"]);
});

test("fresh feed returns empty when Shopify source itself is stale", () => {
  const fresh = __test.filterFreshFeedItems(
    [{ title: "Old", publishedAt: "2026-08-01T00:00:00.000Z" }],
    new Date("2026-08-22T12:00:00.000Z").getTime()
  );

  assert.deepEqual(fresh, []);
});

test("fallback v9 records are eligible for bounded v10 re-enrichment", () => {
  assert.equal(
    __test.shouldReenrichItem(
      { usedFallback: true, qualityScore: 30, savedAt: "2026-08-21T00:00:00.000Z" },
      new Date("2026-08-22T12:00:00.000Z").getTime()
    ),
    true
  );
  assert.equal(
    __test.shouldReenrichItem(
      {
        usedFallback: false,
        qualityScore: 90,
        savedAt: "2026-08-22T11:00:00.000Z",
        verifiedFacts: ["one", "two"],
        aiConclusion: "conclusion",
        todayAction: "action",
      },
      new Date("2026-08-22T12:00:00.000Z").getTime()
    ),
    false
  );
});

test("v11 normalizes official RSS and Atom feeds into one item shape", () => {
  const rss = __test.parseRssFeed(
    `<rss><channel><item><title>CSS release</title><link>https://example.test/css</link><description>New CSS feature</description><pubDate>Fri, 21 Aug 2026 10:00:00 GMT</pubDate><category>CSS</category></item></channel></rss>`,
    { id: "css", name: "CSS Source", tags: ["css"] }
  );
  const atom = __test.parseAtomFeed(
    `<feed><entry><title>Vue v4</title><link rel="alternate" href="https://example.test/vue"/><content>Breaking Vue release</content><updated>2026-08-22T09:00:00Z</updated><category term="Vue"/></entry></feed>`,
    { id: "vue", name: "Vue Releases", tags: ["vue"] }
  );

  assert.equal(rss[0].sourceId, "css");
  assert.equal(rss[0].publishedAt, "2026-08-21T10:00:00.000Z");
  assert.equal(atom[0].source, "Vue Releases");
  assert.match(atom[0].summary, /Breaking Vue release/);
  assert.ok(atom[0].tags.includes("vue"));
});

test("v13 ranks newer releases before older high-priority releases", () => {
  const ranked = __test.rankFeedItems([
    { title: "v1.2.3 patch", summary: "routine fixes", publishedAt: "2026-08-22T10:00:00Z" },
    { title: "Security release", summary: "Critical CVE fix", publishedAt: "2026-08-21T10:00:00Z" },
  ]);

  assert.equal(ranked[0].title, "v1.2.3 patch");
});

test("v14 balances indexed news across sources", () => {
  const balanced = __test.balanceItemsBySource([
    { sourceId: "cloudflare", title: "CF 1", publishedAt: "2026-11-17T10:00:00Z" },
    { sourceId: "cloudflare", title: "CF 2", publishedAt: "2026-11-17T09:00:00Z" },
    { sourceId: "cloudflare", title: "CF 3", publishedAt: "2026-11-17T08:00:00Z" },
    { sourceId: "shopify", title: "Shopify 1", publishedAt: "2026-11-17T07:00:00Z" },
    { sourceId: "vue-blog", title: "Vue 1", publishedAt: "2026-11-17T06:00:00Z" },
  ], 2);

  assert.deepEqual(balanced.map((item) => item.title), ["CF 1", "CF 2", "Shopify 1", "Vue 1"]);
});

test("v14 removes routine patch releases from release-only sources", () => {
  assert.equal(__test.isHighSignalFeedItem({
    sourceId: "node",
    title: "2026-11-11, Version 26.13.1 (LTS)",
    summary: "Bug fixes and dependency updates",
    url: "https://github.com/nodejs/node/releases/tag/v26.13.1",
    publishedAt: "2026-11-11T16:44:25Z",
  }), false);
  assert.equal(__test.isHighSignalFeedItem({
    sourceId: "vue-blog",
    title: "Vue 3.6: new compiler capabilities",
    summary: "A new feature announcement",
    url: "https://blog.vuejs.org/posts/example",
    publishedAt: "2026-11-11T16:44:25Z",
  }), true);
});

test("v13 removes cross-stack hallucinated tags", () => {
  const normalized = __test.normalizeStructuredSummary(
    {
      uaTitle: "Трасування RPC у Cloudflare Workers",
      priority: "P2",
      relevance: 7,
      area: "Cloudflare",
      devTags: ["cloudflare", "workers", "themes", "pos", "shopify"],
      impactTags: ["theme-risk", "pos-risk", "performance-opportunity"],
      verifiedFacts: ["Cloudflare додав RPC spans", "Трасування охоплює Durable Objects"],
      essence: "Cloudflare показує RPC виклики між Workers.",
      importance: "Це спрощує пошук затримок у розподілених запитах.",
      applicationItems: ["Увімкнути traces у wrangler.jsonc", "Перевірити trace у dashboard"],
      checklistItems: ["observability.traces.enabled", "RPC spans у dashboard"],
      devIdea: "Знайти повільний виклик Durable Object у trace.",
      clientTask: "Увімкнути observability.traces.enabled у wrangler.jsonc.",
      audience: "Розробники Cloudflare Workers із Durable Objects.",
      aiConclusion: "Повний trace показує затримки між Worker boundaries.",
      expectedResult: "RPC spans видно у Cloudflare dashboard.",
      todayAction: "Додати observability.traces.enabled у wrangler.jsonc.",
    },
    {
      sourceId: "cloudflare",
      source: "Cloudflare Developer Changelog",
      title: "Workers RPC tracing",
      summary: "Workers traces include RPC session spans across Durable Objects.",
      tags: ["cloudflare", "workers", "durable-objects"],
    }
  );

  assert.ok(normalized.devTags.includes("cloudflare"));
  assert.ok(normalized.devTags.includes("workers"));
  assert.ok(!normalized.devTags.includes("themes"));
  assert.ok(!normalized.devTags.includes("pos"));
  assert.ok(!normalized.impactTags.includes("theme-risk"));
  assert.ok(!normalized.impactTags.includes("pos-risk"));
});

test("v13 rejects article UI noise as verified evidence", () => {
  assert.equal(__test.isPublishableItem({
    pendingEnrichment: false,
    usedFallback: false,
    qualityScore: 100,
    verifiedFacts: ["Node.js adds node:bench", "You signed out in another tab or window."],
  }), false);
});

test("content quality epic does not classify ordinary required wording as P0", () => {
  const priority = __test.inferPriority({
    sourceId: "cloudflare",
    title: "Use FUSE in local Containers development",
    summary: "Miniflare grants the Docker privileges required for FUSE.",
    tags: ["cloudflare", "containers"],
  });
  assert.equal(priority, "P1");
});

test("content quality epic caps unsupported AI urgency and impact claims", () => {
  const normalized = __test.normalizeStructuredSummary(
    {
      uaTitle: "Збережені профілі входу Cloudflare",
      priority: "P0",
      relevance: 7,
      area: "Cloudflare",
      impactTags: ["breaking", "migration", "security", "audit"],
      risk: 10,
      essence: "Cloudflare дозволив зберігати профіль входу на пристрої.",
      importance: "Це скорочує повторне введення даних під час входу.",
      applicationItems: ["Перевірити новий екран входу", "Звірити політики спільних пристроїв"],
      checklistItems: ["Збереження профілю", "Видалення профілю"],
      devIdea: "Оновити внутрішню інструкцію входу для команди.",
      verifiedFacts: ["Профіль можна зберегти локально", "Підтримується до п’яти профілів"],
      aiConclusion: "Функція стосується зручності входу, а не Worker runtime.",
      audience: "Користувачі Cloudflare Dashboard.",
      expectedResult: "Команда розуміє новий сценарій входу.",
      todayAction: "Перевірити політику використання спільних пристроїв.",
    },
    {
      sourceId: "cloudflare",
      source: "Cloudflare Developer Changelog",
      title: "Saved login profiles for returning users",
      summary: "Users can save login profiles locally for faster sign-in.",
      tags: ["cloudflare"],
    }
  );
  assert.equal(normalized.priority, "P1");
  assert.ok(normalized.risk <= 7);
  assert.ok(!normalized.impactTags.includes("breaking"));
  assert.ok(!normalized.impactTags.includes("migration"));
  assert.ok(!normalized.impactTags.includes("security"));
});

test("content quality epic hides pending, fallback, and low-quality records", () => {
  const base = { qualityScore: 85, verifiedFacts: ["one", "two"], usedFallback: false, pendingEnrichment: false };
  assert.equal(__test.isPublishableItem(base), true);
  assert.equal(__test.isPublishableItem({ ...base, pendingEnrichment: true }), false);
  assert.equal(__test.isPublishableItem({ ...base, usedFallback: true }), false);
  assert.equal(__test.isPublishableItem({ ...base, qualityScore: 69 }), false);
  assert.equal(__test.shouldSendImmediate({ ...base, priority: "P0", relevance: 10 }), true);
  assert.equal(__test.isPublishableItem({ ...base, priority: "P0", relevance: 10, usedFallback: true }), false);
});

test("content quality epic creates source-aware Cloudflare fallback without Shopify claims", () => {
  const fallback = __test.createFallbackStructuredSummary({
    sourceId: "cloudflare",
    source: "Cloudflare Developer Changelog",
    title: "FUSE for local containers",
    summary: "Miniflare grants local containers FUSE privileges. This applies to wrangler dev and the Vite plugin.",
    tags: ["cloudflare", "containers"],
  });
  const output = JSON.stringify(fallback);
  assert.match(output, /Cloudflare|Worker|FUSE|Miniflare/);
  assert.doesNotMatch(output, /checkout|Liquid|Shopify-магазину/);
  assert.equal(fallback.priority, "P1");
});

test("content quality epic rejects prerelease and non-developer source noise", () => {
  assert.equal(__test.isHighSignalFeedItem({
    sourceId: "vue",
    title: "v3.6.0-rc.5",
    summary: "Release candidate",
    url: "https://github.com/vuejs/core/releases/test",
    publishedAt: "2026-08-22T00:00:00Z",
  }), false);
  assert.equal(__test.isHighSignalFeedItem({
    sourceId: "cloudflare",
    title: "CASB remediation policies",
    summary: "Microsoft 365 findings",
    url: "https://developers.cloudflare.com/changelog/test",
    publishedAt: "2026-08-22T00:00:00Z",
  }), false);
  assert.equal(__test.isHighSignalFeedItem({
    sourceId: "cloudflare",
    title: "Workers adds a new runtime API",
    summary: "Cloudflare Workers now support a new runtime API.",
    url: "https://developers.cloudflare.com/changelog/workers-test",
    publishedAt: "2026-08-22T00:00:00Z",
  }), true);
});

test("article keyboard exposes focused reading actions without duplicate navigation", () => {
  const keyboard = __test.buildItemInlineKeyboard({
    itemId: "1234567890abcdef",
    url: "https://example.test/article",
  }).inline_keyboard.flat();
  const callbacks = keyboard.map((button) => button.callback_data).filter(Boolean);
  assert.ok(callbacks.some((value) => value.startsWith("mode:e:")));
  assert.ok(callbacks.some((value) => value.startsWith("mode:k:")));
  assert.ok(callbacks.some((value) => value.startsWith("mode:r:")));
  assert.ok(callbacks.some((value) => value.startsWith("feedback:x:")));
  assert.ok(callbacks.includes("latest"));
  assert.ok(!callbacks.includes("full"));
  assert.ok(!callbacks.includes("audit"));
  assert.ok(keyboard.some((button) => button.text === "🔗 Джерело"));
  assert.ok(keyboard.every((button) => !["Source", "Latest", "Full", "Audit"].includes(button.text)));
});

test("full buttons reference the exact article instead of its changing list position", () => {
  const keyboard = __test.buildListInlineKeyboard([
    { itemId: "aaaaaaaaaaaaaaaa1111", url: "https://example.test/first" },
    { itemId: "bbbbbbbbbbbbbbbb2222", url: "https://example.test/second" },
  ]).inline_keyboard;

  assert.equal(keyboard[0][0].callback_data, "article:aaaaaaaaaaaaaaaa:1:2");
  assert.equal(keyboard[1][0].callback_data, "article:bbbbbbbbbbbbbbbb:2:2");
  assert.notEqual(keyboard[0][0].callback_data, "card:0");
});

test("full callback preserves the visible list position", () => {
  const keyboard = __test.buildListInlineKeyboard([
    { itemId: "first-item-123456", url: "https://example.test/first" },
    { itemId: "second-item-12345", url: "https://example.test/second" },
    { itemId: "third-item-1234567", url: "https://example.test/third" },
  ]).inline_keyboard;

  assert.equal(keyboard[1][0].callback_data, "article:second-item-1234:2:3");
});

test("full command resolves the visible list snapshot instead of a changed current index", async () => {
  const kv = new MemoryKv();
  await __test.saveVisibleTelegramList(42, [
    { itemId: "cloudflare-item" },
    { itemId: "github-item" },
  ], { SHOPIFY_RADAR_KV: kv });
  assert.deepEqual(await __test.getVisibleTelegramList(42, { SHOPIFY_RADAR_KV: kv }), ["cloudflare-item", "github-item"]);
});

test("v20 keeps the category-oriented Telegram menu and groups topics separately", () => {
  const mainKeyboard = __test.buildMainReplyKeyboard().keyboard.flat().map((button) => button.text);
  assert.deepEqual(mainKeyboard, [
    "🆕 Свіже",
    "🤖 AI",
    "💻 Frontend",
    "🧰 Інструменти",
    "🌐 Web Platform",
    "🗂 Усі теми",
  ]);

  const topicButtons = __test.buildTopicsInlineKeyboard().inline_keyboard.flat();
  assert.ok(topicButtons.some((button) => button.callback_data === "topic:vue"));
  assert.ok(topicButtons.some((button) => button.callback_data === "topic:shopify"));
  assert.ok(topicButtons.some((button) => button.callback_data === "latest"));
});

test("context menus use Ukrainian navigation without duplicate full or audit actions", () => {
  for (const builder of [
    __test.buildDigestInlineKeyboard,
    __test.buildAuditInlineKeyboard,
    __test.buildAdminInlineKeyboard,
  ]) {
    const buttons = builder().inline_keyboard.flat();
    const callbacks = buttons.map((button) => button.callback_data).filter(Boolean);
    assert.ok(callbacks.includes("latest"));
    assert.ok(callbacks.includes("topics"));
    assert.ok(!callbacks.includes("full"));
    assert.ok(!callbacks.includes("audit"));
    assert.ok(buttons.every((button) => !["Latest", "Full", "Audit", "Source"].includes(button.text)));
  }
});

test("Telegram command menu exposes only the user-facing navigation", () => {
  const commands = __test.buildTelegramCommandMenu();
  const names = commands.map((command) => command.command);

  assert.deepEqual(names, [
    "start",
    "latest",
    "important",
    "practice",
    "topics",
    "full",
    "digest",
    "settings",
    "help",
    "stop",
  ]);
  assert.ok(!names.includes("audit"));
  assert.ok(!names.includes("p0"));
  assert.ok(!names.includes("card"));
  assert.ok(!names.includes("stats"));
  assert.ok(!names.includes("refresh"));
  assert.ok(commands.every((command) => !/shopify/i.test(command.description)));
  assert.ok(commands.some((command) => command.command === "topics" && /AI, frontend/i.test(command.description)));
});

test("fresh feed order is date-first even when an older item has stronger relevance", () => {
  const ordered = __test.sortItemsByDateDesc([
    { title: "Older high-priority item", relevance: 10, publishedAt: "2026-11-10T10:00:00.000Z" },
    { title: "Newest release", relevance: 5, publishedAt: "2026-11-16T10:00:00.000Z" },
  ]);

  assert.equal(ordered[0].title, "Newest release");
  assert.equal(ordered[1].title, "Older high-priority item");
});

test("latest Telegram window hides items older than 48 hours", () => {
  const now = Date.parse("2026-11-17T12:00:00.000Z");
  const items = __test.filterItemsWithinHours([
    { title: "Fresh", publishedAt: "2026-11-16T12:01:00.000Z" },
    { title: "Too old", publishedAt: "2026-11-15T11:59:00.000Z" },
  ], 48, now);

  assert.deepEqual(items.map((item) => item.title), ["Fresh"]);
});
