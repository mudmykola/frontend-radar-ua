import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker.js";

class MemoryKv {
  constructor(entries = {}) { this.entries = new Map(Object.entries(entries)); }
  async get(key) { return this.entries.get(key) ?? null; }
  async put(key, value) { this.entries.set(key, value); }
  async delete(key) { this.entries.delete(key); }
  async list({ prefix = "" } = {}) {
    return {
      keys: [...this.entries.keys()].filter((name) => name.startsWith(prefix)).map((name) => ({ name })),
      list_complete: true,
    };
  }
}

function createContext() {
  const promises = [];
  return { promises, waitUntil(promise) { promises.push(promise); } };
}

function createEnv(entries = {}) {
  return {
    ADMIN_SECRET: "admin-secret",
    TELEGRAM_WEBHOOK_SECRET: "telegram-secret",
    TELEGRAM_BOT_TOKEN: "bot-token",
    SHOPIFY_RADAR_KV: new MemoryKv(entries),
  };
}

function publishableItem({ id, title, publishedAt, devTags = ["nuxt"] }) {
  return {
    itemId: id,
    title,
    uaTitle: title,
    url: `https://example.test/${id}`,
    source: "Nuxt official",
    sourceId: "nuxt",
    summary: "Офіційний опис зміни.",
    publishedAt,
    tags: devTags,
    devTags,
    impactTags: ["frontend"],
    priority: "P1",
    relevance: 8,
    area: "Nuxt",
    clientTask: "Перевірити проєкт.",
    benefit: 8,
    risk: 4,
    effort: 3,
    confidence: 9,
    recommendation: "Перевірити зараз.",
    hiddenInsight: "Є практичний вплив.",
    notFor: "Не стосується legacy без Nuxt.",
    clientOpportunity: "Оновити залежності.",
    urgency: "цього тижня",
    audience: "Nuxt-проєкти",
    verifiedFacts: ["Факт один.", "Факт два."],
    aiConclusion: "Зміна потребує перевірки.",
    assumptions: [],
    before: "Було старе.",
    after: "Стало нове.",
    expectedResult: "Проєкт працює.",
    timeEstimate: "30 хв",
    todayAction: "Перевірити конфігурацію.",
    contextSource: "rss",
    qualityScore: 90,
    essence: "Офіційна зміна Nuxt.",
    importance: "Може вплинути на frontend.",
    applicationItems: ["Оновити залежність."],
    checklistItems: ["Запустити тести."],
    devIdea: "Додати перевірку в CI.",
    usedFallback: false,
    pendingEnrichment: false,
  };
}

async function postUpdate(env, update, context) {
  return worker.fetch(new Request("https://example.test/telegram-webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Telegram-Bot-Api-Secret-Token": "telegram-secret",
    },
    body: JSON.stringify(update),
  }), env, context);
}

test("telegram topic flow hides records older than 48 hours", async () => {
  const now = Date.now();
  const fresh = publishableItem({ id: "fresh", title: "Свіжа Nuxt зміна", publishedAt: new Date(now - 2 * 3600_000).toISOString() });
  const old = publishableItem({ id: "old", title: "Стара Nuxt зміна", publishedAt: new Date(now - 72 * 3600_000).toISOString() });
  const env = createEnv({
    "latest:item:fresh": JSON.stringify(fresh),
    "latest:item:old": JSON.stringify(old),
    "run:last": JSON.stringify({ time: new Date().toISOString() }),
  });
  const context = createContext();
  const sent = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes("sendMessage")) sent.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ ok: true, result: {} }), { status: 200 });
  };

  try {
    const response = await postUpdate(env, {
      update_id: 701,
      callback_query: { id: "cb-1", data: "topic:vue", message: { chat: { id: 7 }, message_id: 1 } },
    }, context);
    await Promise.all(context.promises);
    assert.equal(response.status, 200);
    assert.equal(sent.length, 1);
    assert.match(sent[0].text, /Свіжа Nuxt зміна/);
    assert.doesNotMatch(sent[0].text, /Стара Nuxt зміна/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("latest route returns an explicit empty state when only stale records exist", async () => {
  const old = publishableItem({ id: "old-only", title: "Стара новина", publishedAt: new Date(Date.now() - 72 * 3600_000).toISOString() });
  const env = createEnv({
    "latest:item:old-only": JSON.stringify(old),
    "run:last": JSON.stringify({ time: new Date().toISOString() }),
  });
  const context = createContext();
  const sent = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes("sendMessage")) sent.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ ok: true, result: {} }), { status: 200 });
  };

  try {
    await postUpdate(env, { update_id: 702, message: { chat: { id: 7 }, text: "/latest" } }, context);
    await Promise.all(context.promises);
    assert.equal(sent.length, 1);
    assert.match(sent[0].text, /Свіжих новин за останні 48 годин немає/);
    assert.doesNotMatch(sent[0].text, /Стара новина/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("telegram update marker is not written when delivery fails", async () => {
  const env = createEnv();
  const context = createContext();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("Telegram unavailable"); };

  try {
    await postUpdate(env, { update_id: 703, message: { chat: { id: 7 }, text: "/help" } }, context);
    await assert.rejects(Promise.all(context.promises), /Telegram unavailable/);
    assert.equal(await env.SHOPIFY_RADAR_KV.get("telegram:update:703"), null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("health route returns service metadata and rejects unsupported methods", async () => {
  const env = createEnv();
  const get = await worker.fetch(new Request("https://example.test/health"), env, createContext());
  const body = await get.json();
  assert.equal(get.status, 200);
  assert.equal(body.ok, true);
  assert.match(body.service, /Frontend Intelligence Radar UA/);

  const post = await worker.fetch(new Request("https://example.test/health", { method: "POST" }), env, createContext());
  assert.equal(post.status, 405);
  assert.equal(post.headers.get("allow"), "GET");
});

test("protected admin route rejects wrong method and wrong bearer token", async () => {
  const env = createEnv();
  const wrongMethod = await worker.fetch(new Request("https://example.test/subscribers", { method: "POST" }), env, createContext());
  assert.equal(wrongMethod.status, 405);

  const wrongAuth = await worker.fetch(new Request("https://example.test/subscribers", {
    headers: { Authorization: "Bearer wrong" },
  }), env, createContext());
  assert.equal(wrongAuth.status, 401);
});

test("webhook info route returns normalized Telegram diagnostics", async () => {
  const env = createEnv();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    ok: true,
    result: {
      url: "https://example.test/telegram-webhook",
      pending_update_count: 2,
      last_error_date: 1_700_000_000,
      last_error_message: "timeout",
      max_connections: 40,
      allowed_updates: ["message"],
    },
  }), { status: 200 });

  try {
    const response = await worker.fetch(new Request("https://example.test/telegram-webhook-info", {
      headers: { "X-Telegram-Bot-Api-Secret-Token": "telegram-secret" },
    }), env, createContext());
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.webhook.urlHost, "example.test");
    assert.equal(body.webhook.pendingUpdateCount, 2);
    assert.deepEqual(body.webhook.allowedUpdates, ["message"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("webhook rejects invalid JSON and oversized payloads", async () => {
  const env = createEnv();
  const invalid = await worker.fetch(new Request("https://example.test/telegram-webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Telegram-Bot-Api-Secret-Token": "telegram-secret",
    },
    body: "{bad",
  }), env, createContext());
  assert.equal(invalid.status, 400);

  const oversized = await worker.fetch(new Request("https://example.test/telegram-webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Telegram-Bot-Api-Secret-Token": "telegram-secret",
      "Content-Length": String(300_000),
    },
    body: "{}",
  }), env, createContext());
  assert.equal(oversized.status, 413);
});

test("configure webhook route registers Telegram webhook and command profile", async () => {
  const env = createEnv();
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return new Response(JSON.stringify({ ok: true, result: {} }), { status: 200 });
  };

  try {
    const response = await worker.fetch(new Request("https://example.test/configure-telegram-webhook", {
      method: "POST",
      headers: { "X-Telegram-Bot-Api-Secret-Token": "telegram-secret" },
    }), env, createContext());
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.webhook.registered, true);
    assert.ok(calls.some((url) => url.endsWith("/setWebhook")));
    assert.ok(calls.some((url) => url.endsWith("/deleteMyCommands")));
    assert.ok(calls.some((url) => url.endsWith("/setMyCommands")));
    assert.equal(calls.filter((url) => url.endsWith("/deleteMyCommands")).length, 4);
    assert.equal(calls.filter((url) => url.endsWith("/setMyCommands")).length, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
