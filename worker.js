import {
  isAdminAuthorized,
  isTelegramWebhookAuthorized,
  methodNotAllowed,
  safeErrorMessage,
} from "./src/http-security.js";

const CONTENT_SOURCES = [
  { id: "shopify", name: "Shopify Developer Changelog", feedUrl: "https://shopify.dev/changelog/feed.xml", format: "rss", tags: ["shopify"] },
  { id: "vue-blog", name: "Vue Official Blog", feedUrl: "https://blog.vuejs.org/feed.rss", format: "rss", tags: ["vue", "javascript", "ui"] },
  { id: "vue", name: "Vue Releases", feedUrl: "https://github.com/vuejs/core/releases.atom", format: "atom", tags: ["vue", "javascript", "ui"] },
  { id: "nuxt-blog", name: "Nuxt Official Blog", feedUrl: "https://nuxt.com/blog/rss.xml", format: "rss", tags: ["nuxt", "vue", "ssr"] },
  { id: "nuxt", name: "Nuxt Releases", feedUrl: "https://github.com/nuxt/nuxt/releases.atom", format: "atom", tags: ["nuxt", "vue", "ssr"] },
  { id: "nuxt-ui", name: "Nuxt UI Releases", feedUrl: "https://github.com/nuxt/ui/releases.atom", format: "atom", tags: ["nuxt", "vue", "ui", "tailwind"] },
  { id: "nitro", name: "Nitro Releases", feedUrl: "https://github.com/nitrojs/nitro/releases.atom", format: "atom", tags: ["nuxt", "nitro", "ssr", "javascript"] },
  { id: "pinia", name: "Pinia Releases", feedUrl: "https://github.com/vuejs/pinia/releases.atom", format: "atom", tags: ["pinia", "vue", "state-management"] },
  { id: "vite", name: "Vite Releases", feedUrl: "https://github.com/vitejs/vite/releases.atom", format: "atom", tags: ["vite", "javascript", "build-tools"] },
  { id: "vite-blog", name: "Vite Official Blog", feedUrl: "https://vite.dev/blog.rss", format: "rss", tags: ["vite", "javascript", "build-tools"] },
  { id: "vitest", name: "Vitest Releases", feedUrl: "https://github.com/vitest-dev/vitest/releases.atom", format: "atom", tags: ["vitest", "vite", "javascript", "testing"] },
  { id: "playwright", name: "Playwright Releases", feedUrl: "https://github.com/microsoft/playwright/releases.atom", format: "atom", tags: ["playwright", "javascript", "testing", "browser"] },
  { id: "tailwind", name: "Tailwind CSS Releases", feedUrl: "https://github.com/tailwindlabs/tailwindcss/releases.atom", format: "atom", tags: ["tailwind", "css", "ui"] },
  { id: "tailwind-blog", name: "Tailwind CSS Blog", feedUrl: "https://tailwindcss.com/feeds/feed.xml", format: "rss", tags: ["tailwind", "css", "ui"] },
  { id: "typescript", name: "TypeScript Releases", feedUrl: "https://github.com/microsoft/TypeScript/releases.atom", format: "atom", tags: ["typescript", "javascript"] },
  { id: "sass", name: "Sass Releases", feedUrl: "https://github.com/sass/dart-sass/releases.atom", format: "atom", tags: ["sass", "scss", "css"] },
  { id: "node", name: "Node.js Releases", feedUrl: "https://github.com/nodejs/node/releases.atom", format: "atom", tags: ["node", "javascript", "runtime"] },
  { id: "mdn", name: "MDN Blog", feedUrl: "https://developer.mozilla.org/en-US/blog/rss.xml", format: "rss", tags: ["javascript", "css", "web-platform", "a11y"] },
  { id: "webdev", name: "web.dev Blog", feedUrl: "https://web.dev/static/blog/feed.xml", format: "rss", tags: ["javascript", "css", "web-platform", "performance", "a11y"] },
  { id: "cloudflare", name: "Cloudflare Developer Changelog", feedUrl: "https://developers.cloudflare.com/changelog/rss/index.xml", format: "rss", tags: ["cloudflare", "workers", "edge"] },
  { id: "cloudflare-blog", name: "Cloudflare Blog", feedUrl: "https://blog.cloudflare.com/rss/", format: "rss", tags: ["cloudflare", "workers", "edge", "security", "web-platform"] },
];
const APPROVED_ARTICLE_HOSTS = new Set([
  "shopify.dev",
  "github.com",
  "nuxt.com",
  "vuejs.org",
  "blog.vuejs.org",
  "pinia.vuejs.org",
  "vite.dev",
  "tailwindcss.com",
  "typescriptlang.org",
  "devblogs.microsoft.com",
  "sass-lang.com",
  "nodejs.org",
  "developer.mozilla.org",
  "developers.cloudflare.com",
  "blog.cloudflare.com",
  "web.dev",
  "vitest.dev",
]);

const SERVICE_NAME = "Frontend Intelligence Radar UA";
const SERVICE_VERSION = "v14.0";

const MAX_ITEMS_PER_RUN = 3;
const MIN_PUBLISH_QUALITY = 70;
const MANUAL_REFRESH_LIMIT = 3;
const INITIAL_BOOTSTRAP_LIMIT = 12;
const LATEST_DISPLAY_LIMIT = 7;
const FULL_DISPLAY_LIMIT = 7;
const LOOKBACK_DAYS = 90;
const FRESH_NEWS_WINDOW_DAYS = 7;
const AI_REENRICH_INTERVAL_HOURS = 0.5;
const SEEN_TTL_DAYS = 100;
const SEEN_TTL_SECONDS = 60 * 60 * 24 * SEEN_TTL_DAYS;

const LATEST_ITEMS_KEY = "latest:items";
const DIGEST_ITEMS_KEY = "digest:items";
const SUBSCRIBERS_KEY = "telegram:subscribers";
const BOOTSTRAP_CHECKED_KEY = "latest:bootstrap:checked";
const RUN_LAST_KEY = "run:last";
const TELEGRAM_PROFILE_VERSION_KEY = "telegram:profile:version";
const TELEGRAM_PROFILE_VERSION = "v14";

const LATEST_ITEMS_LIMIT = 50;
const DIGEST_ITEMS_LIMIT = 60;
const SUBSCRIBERS_LIMIT = 500;

const MIN_IMMEDIATE_RELEVANCE = 7;
const DAILY_DIGEST_UTC_HOUR = 6;
const CACHE_STALE_DAYS = 14;
const BOOTSTRAP_CHECK_TTL_SECONDS = 60 * 60 * 6;
const TELEGRAM_UPDATE_TTL_SECONDS = 60 * 60;
const REFRESH_LOCK_KEY = "telegram:refresh:lock";
const REFRESH_LOCK_TTL_SECONDS = 60 * 5;
const MAX_WEBHOOK_BODY_BYTES = 256 * 1024;
const SUBSCRIBER_KEY_PREFIX = "telegram:subscriber:";
const LATEST_ITEM_KEY_PREFIX = "latest:item:";
const DIGEST_ITEM_KEY_PREFIX = "digest:item:";
const TELEGRAM_UPDATE_KEY_PREFIX = "telegram:update:";
const FEEDBACK_KEY_PREFIX = "feedback:";
const TELEGRAM_DELIVERY_CONCURRENCY = 5;
const TELEGRAM_DELIVERY_BATCH_DELAY_MS = 250;
const ARTICLE_CONTEXT_MAX_CHARS = 14000;
const ARTICLE_FETCH_TIMEOUT_MS = 10000;
const FEED_FETCH_TIMEOUT_MS = 12000;
const MAX_FEED_BYTES = 1_500_000;
const MAX_ITEMS_PER_SOURCE = 12;
const MAX_INDEXED_ITEMS_PER_SOURCE = 4;
const AI_MAX_RETRIES = 3;
const AI_RETRY_BASE_DELAY_MS = 750;
const AI_RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const inFlightTelegramUpdates = new Map();

const PRIORITY_RANK = {
  P0: 0,
  P1: 1,
  P2: 2,
};

const DEFAULT_PREFERENCES = {
  minPriority: "P1",
  topics: [],
  digestOnly: false,
};
const TECH_COMMAND_FILTERS = {
  "/vue": { title: "💚 VUE / PINIA", emptyTitle: "💚 Свіжих Vue або Pinia новин немає", tags: ["vue", "pinia"] },
  "/nuxt": { title: "🟢 NUXT / SSR", emptyTitle: "🟢 Свіжих Nuxt новин немає", tags: ["nuxt", "ssr", "nitro"] },
  "/js": { title: "⚡ JAVASCRIPT / TYPESCRIPT / NODE", emptyTitle: "⚡ Свіжих JS/TS/Node новин немає", tags: ["javascript", "typescript", "node", "vite"] },
  "/css": { title: "🎨 CSS / SCSS / TAILWIND / UI", emptyTitle: "🎨 Свіжих CSS/UI новин немає", tags: ["css", "scss", "sass", "tailwind", "ui", "a11y"] },
  "/cloudflare": { title: "☁️ CLOUDFLARE / WORKERS", emptyTitle: "☁️ Свіжих Cloudflare новин немає", tags: ["cloudflare", "workers", "edge"] },
  "/shopify": { title: "🛍 SHOPIFY", emptyTitle: "🛍 Свіжих Shopify новин немає", tags: ["shopify", "liquid", "admin-api", "storefront-api"] },
};

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleScheduledRun(env));
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      if (request.method !== "GET") return methodNotAllowed(["GET"]);
      return Response.json({
        ok: true,
        service: `${SERVICE_NAME} ${SERVICE_VERSION}`,
        time: new Date().toISOString(),
      });
    }

    if (url.pathname === "/configure-telegram-webhook") {
      if (request.method !== "POST") return methodNotAllowed(["POST"]);
      if (!(await isTelegramWebhookAuthorized(request, env))) {
        return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
      }

      try {
        const webhook = await configureTelegramWebhook(request, env);
        return Response.json({ ok: true, webhook });
      } catch (error) {
        console.error("Telegram webhook configuration failed:", safeErrorMessage(error));
        return Response.json(
          { ok: false, error: "Telegram webhook configuration failed" },
          { status: 502 }
        );
      }
    }

    if (url.pathname === "/index-sources") {
      if (request.method !== "POST") return methodNotAllowed(["POST"]);
      if (!(await isTelegramWebhookAuthorized(request, env))) {
        return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
      }

      try {
        const { fetched, indexed, sources } = await indexContentSources(env);
        return Response.json({ ok: true, fetched, indexed, sources });
      } catch (error) {
        console.error("Content source indexing failed:", safeErrorMessage(error));
        return Response.json({ ok: false, error: "Content source indexing failed" }, { status: 502 });
      }
    }

    if (url.pathname === "/reprocess-content") {
      if (request.method !== "POST") return methodNotAllowed(["POST"]);
      if (!(await isTelegramWebhookAuthorized(request, env))) {
        return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
      }

      try {
        const limit = clampNumber(Number(url.searchParams.get("limit") || 3), 1, 5);
        const result = await run(env, { silent: true, limit });
        return Response.json({
          ok: true,
          checked: result.checked,
          fresh: result.fresh,
          processed: result.processed,
          publishable: result.savedOnlyItems.filter((item) => !item.usedFallback && item.qualityScore >= MIN_PUBLISH_QUALITY).length,
          fallback: result.savedOnlyItems.filter((item) => item.usedFallback).length,
          failed: result.failed,
        });
      } catch (error) {
        console.error("Content reprocessing failed:", safeErrorMessage(error));
        return Response.json({ ok: false, error: "Content reprocessing failed" }, { status: 502 });
      }
    }

    if (url.pathname === "/telegram-webhook-info") {
      if (request.method !== "GET") return methodNotAllowed(["GET"]);
      if (!(await isTelegramWebhookAuthorized(request, env))) {
        return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
      }

      try {
        return Response.json({ ok: true, webhook: await getTelegramWebhookInfo(env) });
      } catch (error) {
        console.error("Telegram webhook inspection failed:", safeErrorMessage(error));
        return Response.json(
          { ok: false, error: "Telegram webhook inspection failed" },
          { status: 502 }
        );
      }
    }

    if (url.pathname === "/telegram-webhook") {
      if (request.method !== "POST") {
        return methodNotAllowed(["POST"]);
      }

      if (!(await isTelegramWebhookAuthorized(request, env))) {
        return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
      }

      const contentType = request.headers.get("content-type") || "";
      if (!contentType.toLowerCase().startsWith("application/json")) {
        return Response.json({ ok: false, error: "Unsupported Media Type" }, { status: 415 });
      }

      try {
        const contentLength = Number(request.headers.get("content-length") || 0);
        if (contentLength > MAX_WEBHOOK_BODY_BYTES) {
          return Response.json({ ok: false, error: "Payload Too Large" }, { status: 413 });
        }

        const rawBody = await request.text();
        if (new TextEncoder().encode(rawBody).byteLength > MAX_WEBHOOK_BODY_BYTES) {
          return Response.json({ ok: false, error: "Payload Too Large" }, { status: 413 });
        }

        const update = JSON.parse(rawBody);

        ctx.waitUntil(handleTelegramWebhookOnce(update, env));

        return Response.json({ ok: true });
      } catch (error) {
        console.error("Telegram webhook rejected:", safeErrorMessage(error));
        return Response.json(
          { ok: false, error: "Invalid webhook payload" },
          { status: 400 }
        );
      }
    }

    if (url.pathname === "/test-ai") {
      if (request.method !== "POST") return methodNotAllowed(["POST"]);
      if (!(await isAdminAuthorized(request, env))) {
        return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
      }

      try {
        const testItem = {
          source: "Shopify Developer Changelog",
          title: "Automatic CSS subsetting for {% stylesheet %} tags",
          url: "https://shopify.dev/changelog",
          summary:
            "Shopify is introducing CSS content subsetting for stylesheet tags to improve storefront performance.",
          publishedAt: new Date().toISOString(),
          tags: ["themes", "liquid", "sections", "performance"],
        };

        const rawAiSummary = await summarizeWithAi(testItem, env);
        const structuredSummary = parseAiStructured(rawAiSummary, testItem);
        const useful = isStructuredSummaryUseful(structuredSummary);
        const enrichedItem = buildEnrichedItem(testItem, structuredSummary, {
          rawAiSummary,
          usedFallback: !useful,
          fallbackReason: useful ? null : "AI returned incomplete or generic structured response",
        });

        return Response.json({
          ok: true,
          aiWorking: true,
          useful,
          qualityScore: enrichedItem.qualityScore,
          rawAiSummary,
          structuredSummary: enrichedItem,
        });
      } catch (error) {
        return Response.json(
          {
            ok: false,
            aiWorking: false,
            error: safeErrorMessage(error),
          },
          { status: 500 }
        );
      }
    }

    if (url.pathname === "/debug-env") {
      if (request.method !== "GET") return methodNotAllowed(["GET"]);
      if (!(await isAdminAuthorized(request, env))) {
        return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
      }

      const subscribers = await getSubscribers(env);
      const latest = await getLatestItems(env);
      const digest = await getDigestItems(env);
      const lastRun = await getLastRun(env);
      const stats = buildStats(latest, digest, subscribers, lastRun);

      return Response.json({
        ok: true,
        service: `${SERVICE_NAME} ${SERVICE_VERSION}`,
        hasKv: Boolean(env.SHOPIFY_RADAR_KV),
        hasTelegramToken: Boolean(env.TELEGRAM_BOT_TOKEN),
        hasLegacyTelegramChatId: Boolean(env.TELEGRAM_CHAT_ID),
        hasAdminTelegramChatId: Boolean(env.ADMIN_TELEGRAM_CHAT_ID),
        subscribersCount: subscribers.length,
        latestCount: latest.length,
        digestCount: digest.length,
        latestNeedsBootstrap: latestNeedsBootstrap(latest, { includeStaleCheck: true }),
        latestStructuredCount: latest.filter(hasStructuredFields).length,
        latestAverageQuality: stats.latestAverageQuality,
        fallbackCount: stats.latestFallbackCount,
        lastRun,
        latestTop: latest.slice(0, 3).map((item) => ({
          title: item.title,
          uaTitle: item.uaTitle,
          publishedAt: item.publishedAt,
          priority: item.priority,
          relevance: item.relevance,
          area: item.area,
          devTags: item.devTags,
          impactTags: item.impactTags,
          qualityScore: item.qualityScore,
          hasStructuredFields: hasStructuredFields(item),
          usedFallback: Boolean(item.usedFallback),
        })),
        hasAiApiKey: Boolean(env.AI_API_KEY),
        hasAiBaseUrl: Boolean(env.AI_BASE_URL),
        aiBaseUrl: env.AI_BASE_URL || null,
        hasAiModel: Boolean(env.AI_MODEL),
        aiModel: env.AI_MODEL || null,
        hasAdminSecret: Boolean(env.ADMIN_SECRET),
      });
    }

    if (url.pathname === "/subscribers") {
      if (request.method !== "GET") return methodNotAllowed(["GET"]);
      if (!(await isAdminAuthorized(request, env))) {
        return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
      }

      const subscribers = await getSubscribers(env);

      return Response.json({
        ok: true,
        count: subscribers.length,
        subscribers,
      });
    }

    if (url.pathname === "/run") {
      if (request.method !== "POST") return methodNotAllowed(["POST"]);
      const silent = url.searchParams.get("silent") === "1";
      const ignoreSeen = url.searchParams.get("ignoreSeen") === "1";
      const debug = url.searchParams.get("debug") === "1";
      const limit = Number(url.searchParams.get("limit") || MAX_ITEMS_PER_RUN);

      if (!(await isAdminAuthorized(request, env))) {
        return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
      }

      try {
        const result = await run(env, { silent, limit, ignoreSeen, debug });
        return Response.json({ ok: true, ...result });
      } catch (error) {
        return Response.json(
          {
            ok: false,
            error: safeErrorMessage(error),
          },
          { status: 500 }
        );
      }
    }

    if (url.pathname === "/bootstrap") {
      if (request.method !== "POST") return methodNotAllowed(["POST"]);
      if (!(await isAdminAuthorized(request, env))) {
        return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
      }

      try {
        const result = await bootstrapLatestNews(env);
        return Response.json({
          ok: true,
          latestCount: result.latest.length,
          processed: result.runResult.processed,
          usedIgnoreSeen: true,
          broadcast: false,
          latest: result.latest.slice(0, INITIAL_BOOTSTRAP_LIMIT),
        });
      } catch (error) {
        return Response.json(
          {
            ok: false,
            error: safeErrorMessage(error),
          },
          { status: 500 }
        );
      }
    }

    if (url.pathname === "/send-digest") {
      if (request.method !== "POST") return methodNotAllowed(["POST"]);
      if (!(await isAdminAuthorized(request, env))) {
        return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
      }

      const result = await sendDailyDigest(env, { force: true });
      return Response.json({ ok: true, ...result });
    }

    if (url.pathname === "/audit") {
      if (request.method !== "GET") return methodNotAllowed(["GET"]);
      if (!(await isAdminAuthorized(request, env))) {
        return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
      }

      await ensureInitialNews(env);
      const latest = await getLatestItems(env);

      return Response.json({
        ok: true,
        audit: buildAuditData(latest.slice(0, 20)),
      });
    }

    return Response.json({
      ok: true,
      service: `${SERVICE_NAME} ${SERVICE_VERSION}`,
      routes: [
        "/health",
        "/configure-telegram-webhook",
        "/telegram-webhook-info",
        "/telegram-webhook",
        "/debug-env",
        "/test-ai",
        "/subscribers",
        "/run",
        "/run?silent=1&limit=10",
        "/run?silent=1&limit=10&ignoreSeen=1",
        "/run?silent=1&limit=10&ignoreSeen=1&debug=1",
        "/bootstrap",
        "/send-digest",
        "/audit",
      ],
      adminAuth: "Authorization: Bearer <ADMIN_SECRET>",
    });
  },
};

async function configureTelegramWebhook(request, env) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_WEBHOOK_SECRET) {
    throw new Error("Telegram webhook environment is incomplete");
  }

  const webhookUrl = new URL("/telegram-webhook", request.url).toString();
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: env.TELEGRAM_WEBHOOK_SECRET,
      allowed_updates: ["message", "edited_message", "callback_query"],
      drop_pending_updates: false,
    }),
  });
  const result = await response.json();

  if (!response.ok || !result.ok) {
    throw new Error(`Telegram setWebhook failed with status ${response.status}`);
  }

  await configureTelegramProfile(env);

  return {
    registered: true,
    host: new URL(webhookUrl).host,
    profileUpdated: true,
  };
}

async function configureTelegramProfile(env) {
  const commands = [
    ["start", "Запустити Frontend Intelligence Radar"],
    ["latest", "Найсвіжіші frontend-новини"],
    ["full", "Повні технічні розбори"],
    ["vue", "Vue і Pinia"],
    ["nuxt", "Nuxt, SSR і Nitro"],
    ["js", "JavaScript, TypeScript, Node і Vite"],
    ["css", "CSS, SCSS, Tailwind, UI та a11y"],
    ["shopify", "Shopify, Liquid, checkout та API"],
    ["cloudflare", "Cloudflare Workers та edge"],
    ["digest", "Персональне ранкове зведення"],
    ["settings", "Налаштувати теми й пріоритет"],
    ["help", "Усі команди"],
  ].map(([command, description]) => ({ command, description }));
  const operations = [
    ["setMyName", { name: SERVICE_NAME }],
    [
      "setMyShortDescription",
      { short_description: "AI читає frontend release notes і пояснює зміни українською." },
    ],
    [
      "setMyDescription",
      {
        description:
          "Читаю офіційні frontend release notes і пояснюю українською: що змінилося, де це корисно, чи стосується твого стеку та що робити далі.",
      },
    ],
    ["setMyCommands", { commands }],
  ];

  for (const [method, body] of operations) {
    const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      throw new Error(`Telegram ${method} failed with status ${response.status}`);
    }
  }

  if (env.ASSETS) {
    const avatarResponse = await env.ASSETS.fetch(
      new Request("https://radar-assets.local/frontend-intelligence-radar-avatar-v12.jpg")
    );
    if (avatarResponse.ok) {
      const form = new FormData();
      form.set("photo", JSON.stringify({ type: "static", photo: "attach://avatar" }));
      form.set("avatar", new File([await avatarResponse.arrayBuffer()], "radar-v12.jpg", { type: "image/jpeg" }));
      const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/setMyProfilePhoto`, {
        method: "POST",
        body: form,
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(`Telegram setMyProfilePhoto failed with status ${response.status}`);
    }
  }
}

async function getTelegramWebhookInfo(env) {
  if (!env.TELEGRAM_BOT_TOKEN) throw new Error("Telegram bot token is missing");

  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getWebhookInfo`);
  const payload = await response.json();

  if (!response.ok || !payload.ok) {
    throw new Error(`Telegram getWebhookInfo failed with status ${response.status}`);
  }

  const info = payload.result || {};
  return {
    urlHost: info.url ? new URL(info.url).host : "",
    pendingUpdateCount: Number(info.pending_update_count || 0),
    lastErrorDate: info.last_error_date
      ? new Date(info.last_error_date * 1000).toISOString()
      : null,
    lastErrorMessage: String(info.last_error_message || ""),
    maxConnections: Number(info.max_connections || 0),
    allowedUpdates: Array.isArray(info.allowed_updates) ? info.allowed_updates : [],
  };
}

async function handleScheduledRun(env) {
  try {
    await ensureTelegramProfileVersion(env);
  } catch (error) {
    console.error("Telegram profile sync failed:", safeErrorMessage(error));
  }
  await run(env);

  const now = new Date();

  if (now.getUTCHours() === DAILY_DIGEST_UTC_HOUR) {
    await sendDailyDigest(env);
  }
}

async function ensureTelegramProfileVersion(env) {
  if (await env.SHOPIFY_RADAR_KV.get(TELEGRAM_PROFILE_VERSION_KEY) === TELEGRAM_PROFILE_VERSION) return;
  await configureTelegramProfile(env);
  await env.SHOPIFY_RADAR_KV.put(TELEGRAM_PROFILE_VERSION_KEY, TELEGRAM_PROFILE_VERSION);
}

async function run(env, options = {}) {
  validateEnv(env);

  const silent = Boolean(options.silent);
  const ignoreSeen = Boolean(options.ignoreSeen);
  const debug = Boolean(options.debug);
  const limit = clampNumber(options.limit || MAX_ITEMS_PER_RUN, 1, 30);
  const { items: recentItems, fetched } = await indexContentSources(env);

  const freshItems = [];

  for (const item of recentItems) {
    if (ignoreSeen) {
      freshItems.push(item);
      continue;
    }

    const id = await createItemId(item);
    const seen = await env.SHOPIFY_RADAR_KV.get(`seen:${id}`);
    const storedRaw = await env.SHOPIFY_RADAR_KV.get(`${LATEST_ITEM_KEY_PREFIX}${id}`);
    let storedItem = null;

    try {
      storedItem = storedRaw ? JSON.parse(storedRaw) : null;
    } catch {
      storedItem = null;
    }

    if (!seen || shouldReenrichItem(storedItem)) {
      const storedAt = new Date(storedItem?.savedAt || 0).getTime();
      const isPendingBacklog = Boolean(
        storedItem?.pendingEnrichment &&
        Number.isFinite(storedAt) &&
        Date.now() - storedAt > 5 * 60 * 1000
      );
      freshItems.push({ ...item, suppressBroadcast: isPendingBacklog });
    }
  }

  const limitedItems = freshItems.slice(0, limit);

  const sentItems = [];
  const savedOnlyItems = [];
  const failedItems = [];

  for (const item of limitedItems) {
    const id = await createItemId(item);

    try {
      const sourceItem = await enrichItemWithArticleContext(item);
      let structuredSummary;
      let usedFallback = false;
      let fallbackReason = "";
      let rawAiSummary = "";

      try {
        const factAnalysis = JSON.stringify({
          verifiedFacts: extractEvidenceFacts(sourceItem),
          evidencePriority: inferPriority(sourceItem),
          source: sourceItem.source,
        });
        rawAiSummary = await summarizeWithAi(sourceItem, env, factAnalysis);
        structuredSummary = parseAiStructured(rawAiSummary, sourceItem);

        if (!isStructuredSummaryUseful(structuredSummary)) {
          usedFallback = true;
          fallbackReason = "AI returned incomplete or generic structured response";
          structuredSummary = createFallbackStructuredSummary(sourceItem, fallbackReason);
        }
      } catch (error) {
        usedFallback = true;
        fallbackReason = String(error?.message || error);
        structuredSummary = createFallbackStructuredSummary(sourceItem, fallbackReason);

        console.error("AI summary failed, using structured fallback:", {
          title: item.title,
          url: item.url,
          error: fallbackReason,
        });
      }

      const enrichedItem = buildEnrichedItem(sourceItem, structuredSummary, {
        itemId: id,
        rawAiSummary,
        usedFallback,
        fallbackReason,
      });
      const shouldSendNow =
        !silent &&
        !ignoreSeen &&
        !sourceItem.suppressBroadcast &&
        isPublishableItem(enrichedItem) &&
        shouldSendImmediate(enrichedItem);

      await saveLatestItem(enrichedItem, env);
      await saveDigestItem(enrichedItem, env);

      const resultItem = buildRunResultItem(enrichedItem, {
        silent,
        ignoreSeen,
        usedFallback,
        fallbackReason,
        rawAiSummary: debug ? rawAiSummary : "",
      });

      if (shouldSendNow) {
        const message = formatTelegramMessage(enrichedItem);
        const sendResult = await sendTelegramMessage(message, env, {
          item: enrichedItem,
          replyMarkup: buildItemInlineKeyboard(enrichedItem),
        });

        sentItems.push({
          ...resultItem,
          subscribers: sendResult?.subscribers || 0,
          deliveredSubscribers: sendResult?.deliveredSubscribers || 0,
          skippedSubscribers: sendResult?.skippedSubscribers || 0,
          failedSubscribers: sendResult?.failed?.length || 0,
        });
      } else {
        savedOnlyItems.push(resultItem);
      }

      await env.SHOPIFY_RADAR_KV.put(
        `seen:${id}`,
        JSON.stringify({
          title: item.title,
          uaTitle: enrichedItem.uaTitle,
          url: item.url,
          source: item.source,
          publishedAt: item.publishedAt || null,
          priority: enrichedItem.priority,
          relevance: enrichedItem.relevance,
          qualityScore: enrichedItem.qualityScore,
          sentImmediately: shouldSendNow,
          silent,
          ignoreSeen,
          usedFallback,
          fallbackReason: fallbackReason || null,
          seenAt: new Date().toISOString(),
        }),
        { expirationTtl: SEEN_TTL_SECONDS }
      );
    } catch (error) {
      failedItems.push({
        title: item.title,
        url: item.url,
        error: String(error?.message || error),
      });

      console.error("Failed to process item:", {
        title: item.title,
        url: item.url,
        error: String(error?.message || error),
      });
    }
  }

  const runResult = {
    checked: fetched,
    recent: recentItems.length,
    fresh: freshItems.length,
    processed: limitedItems.length,
    sent: sentItems.length,
    savedOnly: savedOnlyItems.length,
    failed: failedItems.length,
    silent,
    ignoreSeen,
    debug,
    limit,
    sentItems,
    savedOnlyItems,
    failedItems,
  };

  await saveLastRun(env, runResult);

  return runResult;
}

async function indexContentSources(env) {
  validateEnv(env);
  const allItems = await fetchContentFeeds();
  const recentItems = rankFeedItems(
    filterFreshFeedItems(filterItemsByLookback(allItems, LOOKBACK_DAYS)).filter(isHighSignalFeedItem)
  );
  const indexedItems = balanceItemsBySource(recentItems, MAX_INDEXED_ITEMS_PER_SOURCE).slice(0, LATEST_ITEMS_LIMIT);
  await indexFreshFeedItems(indexedItems, env);
  return {
    items: recentItems,
    fetched: allItems.length,
    indexed: indexedItems.length,
    sources: new Set(indexedItems.map((item) => item.sourceId)).size,
  };
}

function balanceItemsBySource(items, perSourceLimit = MAX_INDEXED_ITEMS_PER_SOURCE) {
  const buckets = new Map();
  for (const item of items || []) {
    const sourceId = item.sourceId || item.source || "unknown";
    const bucket = buckets.get(sourceId) || [];
    if (bucket.length < perSourceLimit) bucket.push(item);
    buckets.set(sourceId, bucket);
  }
  return rankFeedItems([...buckets.values()].flat());
}

function buildRunResultItem(item, meta = {}) {
  const result = {
    title: item.title,
    uaTitle: item.uaTitle,
    url: item.url,
    priority: item.priority,
    relevance: item.relevance,
    area: item.area,
    qualityScore: item.qualityScore,
    impactTags: item.impactTags || [],
    usedFallback: Boolean(meta.usedFallback),
    fallbackReason: meta.fallbackReason || null,
    silent: Boolean(meta.silent),
    ignoreSeen: Boolean(meta.ignoreSeen),
  };

  if (meta.rawAiSummary) {
    result.rawAiPreview = meta.rawAiSummary.slice(0, 1200);
  }

  return result;
}

async function saveLastRun(env, runResult) {
  const fallbackCount = [...(runResult.sentItems || []), ...(runResult.savedOnlyItems || [])].filter(
    (item) => item.usedFallback
  ).length;

  await env.SHOPIFY_RADAR_KV.put(
    RUN_LAST_KEY,
    JSON.stringify({
      time: new Date().toISOString(),
      checked: runResult.checked,
      recent: runResult.recent,
      fresh: runResult.fresh,
      processed: runResult.processed,
      sent: runResult.sent,
      savedOnly: runResult.savedOnly,
      failed: runResult.failed,
      fallbackCount,
      silent: runResult.silent,
      ignoreSeen: runResult.ignoreSeen,
    })
  );
}

async function getLastRun(env) {
  try {
    const raw = await env.SHOPIFY_RADAR_KV.get(RUN_LAST_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function validateEnv(env) {
  const required = ["SHOPIFY_RADAR_KV", "TELEGRAM_BOT_TOKEN"];
  const missing = required.filter((key) => !env[key]);

  if (missing.length) {
    throw new Error(`Missing env variables/bindings: ${missing.join(", ")}`);
  }
}

async function handleTelegramWebhookOnce(update, env) {
  const updateId = update?.update_id;
  const updateKey =
    updateId !== undefined && updateId !== null
      ? `${TELEGRAM_UPDATE_KEY_PREFIX}${updateId}`
      : "";

  if (updateKey) {
    const alreadyProcessed = await env.SHOPIFY_RADAR_KV.get(updateKey);

    if (alreadyProcessed) {
      return;
    }

    if (inFlightTelegramUpdates.has(updateKey)) {
      return inFlightTelegramUpdates.get(updateKey);
    }
  }

  const processing = (async () => {
    await handleTelegramWebhook(update, env);

    if (updateKey) {
      await env.SHOPIFY_RADAR_KV.put(updateKey, "1", {
        expirationTtl: TELEGRAM_UPDATE_TTL_SECONDS,
      });
    }
  })();

  if (updateKey) inFlightTelegramUpdates.set(updateKey, processing);

  try {
    await processing;
  } finally {
    if (updateKey) inFlightTelegramUpdates.delete(updateKey);
  }
}

async function handleTelegramWebhook(update, env) {
  if (update?.callback_query) {
    await handleTelegramCallback(update.callback_query, env);
    return;
  }

  const message = update?.message || update?.edited_message;

  if (!message) return;

  const chatId = message?.chat?.id;
  const text = String(message?.text || "").trim();
  const command = normalizeTelegramCommand(text);
  const args = parseCommandArgs(text);

  if (!chatId) return;

  if (command === "/start") {
    const subscriber = await saveSubscriber(chatId, message, env);
    await sendWelcome(chatId, env, subscriber);
    return;
  }

  if (command === "/stop") {
    await removeSubscriber(chatId, env);
    await sendTelegramRaw(chatId, formatStopMessage(), env, {
      replyMarkup: buildRemoveKeyboard(),
    });
    return;
  }

  if (command === "/latest") {
    await saveSubscriber(chatId, message, env);
    await sendLatest(chatId, env);
    return;
  }

  if (command === "/full") {
    await saveSubscriber(chatId, message, env);
    await sendFullLatest(chatId, env, { singleIndex: parseOptionalIndex(args[0]) });
    return;
  }

  if (command === "/card") {
    await saveSubscriber(chatId, message, env);
    await sendSingleCard(chatId, env, parseOptionalIndex(args[0]) || 1);
    return;
  }

  if (command === "/p0") {
    await saveSubscriber(chatId, message, env);
    await sendFilteredLatest(chatId, env, {
      title: "🚨 КРИТИЧНІ ЗМІНИ",
      emptyTitle: "🚨 Критичних змін поки немає",
      predicate: (item) => item.priority === "P0",
    });
    return;
  }

  if (command === "/themes") {
    await saveSubscriber(chatId, message, env);
    await sendFilteredLatest(chatId, env, {
      title: "🎨 ТЕМИ, LIQUID І СЕКЦІЇ",
      emptyTitle: "🎨 Новин по темах поки немає",
      predicate: (item) => matchesDevTags(item, ["themes", "liquid", "sections", "online-store"]),
    });
    return;
  }

  if (command === "/performance") {
    await saveSubscriber(chatId, message, env);
    await sendFilteredLatest(chatId, env, {
      title: "⚡ ШВИДКІСТЬ, SEO ТА ОПТИМІЗАЦІЯ",
      emptyTitle: "⚡ Новин по швидкості та SEO поки немає",
      predicate: (item) => matchesDevTags(item, ["performance", "seo", "css", "assets", "speed"]),
    });
    return;
  }

  if (TECH_COMMAND_FILTERS[command]) {
    const filter = TECH_COMMAND_FILTERS[command];
    await saveSubscriber(chatId, message, env);
    await sendFilteredLatest(chatId, env, {
      title: filter.title,
      emptyTitle: filter.emptyTitle,
      predicate: (item) => matchesDevTags(item, filter.tags),
    });
    return;
  }

  if (command === "/digest") {
    await saveSubscriber(chatId, message, env);
    await sendDigestToChat(chatId, env);
    return;
  }

  if (command === "/audit") {
    await saveSubscriber(chatId, message, env);
    await sendAuditChecklist(chatId, env);
    return;
  }

  if (command === "/settings") {
    const subscriber = await saveSubscriber(chatId, message, env);
    await sendSettings(chatId, env, subscriber);
    return;
  }

  if (command === "/stats") {
    await saveSubscriber(chatId, message, env);
    await sendStats(chatId, env);
    return;
  }

  if (command === "/refresh") {
    await saveSubscriber(chatId, message, env);
    await sendRefresh(chatId, env);
    return;
  }

  if (command === "/test_ai" || command === "/testai" || command === "/test-ai") {
    await saveSubscriber(chatId, message, env);
    await sendAiTest(chatId, env);
    return;
  }

  if (command === "/help") {
    await saveSubscriber(chatId, message, env);
    await sendHelp(chatId, env);
    return;
  }

  await sendUnknownCommand(chatId, env);
}

async function handleTelegramCallback(callbackQuery, env) {
  const chatId = callbackQuery?.message?.chat?.id;
  const messageId = callbackQuery?.message?.message_id;
  const data = String(callbackQuery?.data || "");

  if (!chatId) return;

  try {
    if (data.startsWith("article:")) {
      const itemReference = data.slice("article:".length);
      await answerCallbackQuery(callbackQuery.id, env, "Відкриваю обрану статтю...");
      await sendSingleCardByReference(chatId, env, itemReference);
      return;
    }

    if (data.startsWith("card:")) {
      const index = Number(data.split(":")[1]);
      await answerCallbackQuery(callbackQuery.id, env, "Відкриваю розбір...");
      await sendSingleCard(chatId, env, Number.isFinite(index) ? index + 1 : 1);
      return;
    }

    if (data === "latest") {
      await answerCallbackQuery(callbackQuery.id, env, "Останні новини");
      await sendLatest(chatId, env);
      return;
    }

    if (data === "full") {
      await answerCallbackQuery(callbackQuery.id, env, "Повні розбори");
      await sendFullLatest(chatId, env);
      return;
    }

    if (data === "audit") {
      await answerCallbackQuery(callbackQuery.id, env, "Готую audit checklist");
      await sendAuditChecklist(chatId, env);
      return;
    }

    if (data.startsWith("mode:")) {
      const [, mode, itemReference] = data.split(":");
      const latest = await getLatestItems(env);
      const item = latest.find((candidate) =>
        String(candidate.itemId || "").startsWith(String(itemReference || ""))
      );

      if (!item) {
        await answerCallbackQuery(callbackQuery.id, env, "Новина вже змінилася у стрічці");
        return;
      }

      await answerCallbackQuery(callbackQuery.id, env, "Готую потрібний формат");
      await sendItemReadingMode(chatId, item, mode, env);
      return;
    }

    if (data.startsWith("feedback:")) {
      const [, reactionCode, itemReference] = data.split(":");
      const reaction = { u: "useful", i: "interesting", n: "not-relevant", x: "not-understood" }[reactionCode];
      const latest = await getLatestItems(env);
      const item = latest.find((candidate) =>
        String(candidate.itemId || "").startsWith(String(itemReference || ""))
      );

      if (!reaction || !item) {
        await answerCallbackQuery(callbackQuery.id, env, "Новина вже змінилася у стрічці");
        return;
      }

      await saveContentFeedback(chatId, item, reaction, env);
      if (reaction === "not-understood") {
        await answerCallbackQuery(callbackQuery.id, env, "Поясню простіше");
        await sendItemReadingMode(chatId, item, "e", env);
        return;
      }
      const responseText =
        reaction === "useful"
          ? "Врахую: більше практично корисних матеріалів"
          : reaction === "interesting"
            ? "Врахую: більше таких цікавих тем"
            : "Врахую: менше подібних новин";
      await answerCallbackQuery(callbackQuery.id, env, responseText);
      return;
    }

    if (data.startsWith("settings:")) {
      const subscriber = await updateSubscriberSettingsFromCallback(chatId, data, env);
      await answerCallbackQuery(callbackQuery.id, env, "Налаштування оновлено");
      await sendSettings(chatId, env, subscriber, { replaceMessageId: messageId });
      return;
    }

    await answerCallbackQuery(callbackQuery.id, env, "Команду не розпізнано");
  } catch (error) {
    console.error("Telegram callback failed:", {
      chatId,
      data,
      error: String(error?.message || error),
    });

    await answerCallbackQuery(callbackQuery.id, env, "Помилка виконання");
  }
}

function normalizeTelegramCommand(text) {
  const value = String(text || "").trim();
  const mapped = mapButtonTextToCommand(value);

  if (mapped) return mapped;

  const first = value.split(/\s+/)[0] || "";
  const withoutBotName = first.split("@")[0];

  return withoutBotName.toLowerCase();
}

function mapButtonTextToCommand(text) {
  const value = String(text || "").trim().toLowerCase();

  const dictionary = {
    Vue: "Vue",
    Nuxt: "Nuxt",
    Pinia: "Pinia",
    Vite: "Vite",
    JavaScript: "JavaScript",
    TypeScript: "TypeScript",
    CSS: "CSS / SCSS",
    Tailwind: "Tailwind CSS",
    UI: "UI / Accessibility",
    "Node.js": "Node.js",
    Cloudflare: "Cloudflare",
    Shopify: "Shopify",
    "🆕 останні": "/latest",
    "📖 повні розбори": "/full",
    "🚨 критичні": "/p0",
    "🎨 themes": "/themes",
    "🎨 теми": "/themes",
    "⚡ performance": "/performance",
    "⚡ швидкість": "/performance",
    "💚 vue": "/vue",
    "🟢 nuxt": "/nuxt",
    "⚡ js/ts": "/js",
    "🎨 css/ui": "/css",
    "☁️ cloudflare": "/cloudflare",
    "🛍 shopify": "/shopify",
    "🧠 digest": "/digest",
    "🧠 зведення": "/digest",
    "✅ audit": "/audit",
    "✅ аудит": "/audit",
    "⚙️ settings": "/settings",
    "⚙️ налаштування": "/settings",
    "📊 stats": "/stats",
  };

  return dictionary[value] || "";
}

function parseCommandArgs(text) {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .slice(1)
    .filter(Boolean);
}

function parseOptionalIndex(value) {
  const index = Number(value);
  if (!Number.isFinite(index)) return null;
  return Math.max(1, Math.floor(index));
}

async function ensureInitialNews(env) {
  return sortItemsByDateDesc(await getLatestItems(env));
}

async function bootstrapLatestNews(env) {
  const runResult = await run(env, {
    silent: true,
    ignoreSeen: true,
    limit: INITIAL_BOOTSTRAP_LIMIT,
  });

  const latest = sortItemsByDateDesc(await getLatestItems(env));

  return { runResult, latest };
}

function latestNeedsBootstrap(items, options = {}) {
  const latest = sortItemsByDateDesc(items || []);

  if (latest.length < INITIAL_BOOTSTRAP_LIMIT) return true;

  const firstTen = latest.slice(0, INITIAL_BOOTSTRAP_LIMIT);

  if (firstTen.some((item) => !hasStructuredFields(item))) return true;

  if (options.includeStaleCheck && latestLooksStale(firstTen)) return true;

  return false;
}

function latestLooksStale(items) {
  const latest = sortItemsByDateDesc(items || []);
  const newest = latest[0]?.publishedAt;

  if (!newest) return true;

  const newestTime = new Date(newest).getTime();

  if (Number.isNaN(newestTime)) return true;

  return Date.now() - newestTime > CACHE_STALE_DAYS * 24 * 60 * 60 * 1000;
}

function hasStructuredFields(item) {
  if (
    !item ||
    !item.url ||
    !item.uaTitle ||
    !item.priority ||
    !Number.isFinite(Number(item.relevance)) ||
    !item.area ||
    !Array.isArray(item.devTags) ||
    !item.essence ||
    !item.importance ||
    !Array.isArray(item.applicationItems) ||
    !item.applicationItems.length ||
    !Array.isArray(item.checklistItems) ||
    !item.checklistItems.length ||
    !item.devIdea
  ) {
    return false;
  }

  return !isLowQualityStoredItem(item);
}

function isLowQualityStoredItem(item) {
  const title = String(item?.uaTitle || "");
  const essence = String(item?.essence || "");
  const importance = String(item?.importance || "");
  const devIdea = String(item?.devIdea || "");

  const combined = [title, essence, importance, devIdea].join("\n");

  if (looksMostlyEnglish(title) && !hasCyrillic(title)) return true;
  if (looksMostlyEnglish(essence) && essence.length > 120) return true;
  if (essence.length > 650) return true;
  if (isGenericFallbackText(combined)) return true;

  return false;
}

function isGenericFallbackText(text) {
  return [
    /Короткий опис відсутній/i,
    /Відкрий джерело для деталей/i,
    /Це нова Shopify-зміна, яку варто перевірити/i,
    /Навіть без AI-розбору цю зміну варто оцінити/i,
    /AI не повернув відповідь/i,
    /No summary/i,
  ].some((pattern) => pattern.test(String(text || "")));
}

function looksMostlyEnglish(text) {
  const value = String(text || "").trim();

  if (!value) return false;

  const latinMatches = value.match(/[a-zA-Z]/g) || [];
  const cyrillicMatches = value.match(/[а-яіїєґА-ЯІЇЄҐ]/g) || [];

  return latinMatches.length > 30 && latinMatches.length > cyrillicMatches.length * 2;
}

function hasCyrillic(text) {
  return /[а-яіїєґА-ЯІЇЄҐ]/.test(String(text || ""));
}

async function saveSubscriber(chatId, message, env) {
  const subscribers = await getSubscribers(env);
  const id = String(chatId);

  const user = message?.from || {};
  const chat = message?.chat || {};

  const existing = subscribers.find((item) => String(item.chatId) === id);

  const subscriber = {
    chatId: id,
    type: chat.type || existing?.type || "private",
    username: user.username || chat.username || existing?.username || null,
    firstName: user.first_name || chat.first_name || existing?.firstName || null,
    lastName: user.last_name || chat.last_name || existing?.lastName || null,
    joinedAt: existing?.joinedAt || new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    active: true,
    preferences: normalizePreferences(existing?.preferences),
  };

  await env.SHOPIFY_RADAR_KV.put(
    `${SUBSCRIBER_KEY_PREFIX}${encodeURIComponent(id)}`,
    JSON.stringify(subscriber)
  );

  return subscriber;
}

async function removeSubscriber(chatId, env) {
  const id = String(chatId);
  await env.SHOPIFY_RADAR_KV.put(
    `${SUBSCRIBER_KEY_PREFIX}${encodeURIComponent(id)}`,
    JSON.stringify({ chatId: id, active: false, lastSeenAt: new Date().toISOString() })
  );
  return getSubscribers(env);
}

async function getSubscribers(env) {
  const [individualSubscribers, legacySubscribers] = await Promise.all([
    readJsonObjectsByPrefix(env, SUBSCRIBER_KEY_PREFIX, SUBSCRIBERS_LIMIT),
    readJsonArray(env, SUBSCRIBERS_KEY),
  ]);
  const subscribersById = new Map();

  for (const subscriber of [...legacySubscribers, ...individualSubscribers]) {
    if (subscriber?.chatId) subscribersById.set(String(subscriber.chatId), subscriber);
  }

  return [...subscribersById.values()]
    .filter((item) => item?.chatId && item.active !== false)
    .map((subscriber) => ({
      ...subscriber,
      preferences: normalizePreferences(subscriber.preferences),
    }))
    .sort((a, b) => String(b.lastSeenAt || "").localeCompare(String(a.lastSeenAt || "")))
    .slice(0, SUBSCRIBERS_LIMIT);
}

async function updateSubscriber(chatId, updater, env) {
  const subscribers = await getSubscribers(env);
  const id = String(chatId);
  const existing = subscribers.find((subscriber) => String(subscriber.chatId) === id) || {
    chatId: id,
    type: "private",
    joinedAt: new Date().toISOString(),
    active: true,
    preferences: normalizePreferences(),
  };

  const updatedSubscriber = updater({
    ...existing,
    preferences: normalizePreferences(existing.preferences),
    lastSeenAt: new Date().toISOString(),
  });

  await env.SHOPIFY_RADAR_KV.put(
    `${SUBSCRIBER_KEY_PREFIX}${encodeURIComponent(id)}`,
    JSON.stringify(updatedSubscriber)
  );

  return updatedSubscriber;
}

async function saveContentFeedback(chatId, item, reaction, env) {
  const itemId = String(item.itemId || (await createItemId(item)));
  const record = {
    itemId,
    reaction,
    area: item.area || "Shopify Dev",
    tags: normalizeTags([...(item.devTags || []), ...(item.impactTags || [])]).slice(0, 12),
    createdAt: new Date().toISOString(),
  };

  await env.SHOPIFY_RADAR_KV.put(
    `${FEEDBACK_KEY_PREFIX}${encodeURIComponent(String(chatId))}:${itemId}`,
    JSON.stringify(record),
    { expirationTtl: SEEN_TTL_SECONDS }
  );
}

async function personalizeItems(chatId, items, env) {
  const feedback = await readJsonObjectsByPrefix(
    env,
    `${FEEDBACK_KEY_PREFIX}${encodeURIComponent(String(chatId))}:`,
    200
  );
  const weights = new Map();

  for (const record of feedback) {
    const delta = record.reaction === "interesting"
      ? 2
      : record.reaction === "useful"
        ? 1.5
        : record.reaction === "not-understood"
          ? 0.25
          : -2.5;
    const signals = normalizeTags([record.area || "", ...(record.tags || [])]);
    for (const signal of signals) weights.set(signal, (weights.get(signal) || 0) + delta);
  }

  return [...items].sort((left, right) => {
    const score = (item) => {
      const normalized = normalizeStoredStructuredItem(item);
      const signals = normalizeTags([normalized.area || "", ...(normalized.devTags || []), ...(normalized.impactTags || [])]);
      const preferenceBoost = signals.reduce((sum, signal) => sum + (weights.get(signal) || 0), 0);
      return (
        Number(normalized.relevance || 0) * 1.5 +
        normalizeScore(normalized.benefit, 5) +
        normalizeScore(normalized.risk, 4) * 0.5 +
        preferenceBoost
      );
    };

    const scoreDifference = score(right) - score(left);
    if (scoreDifference) return scoreDifference;
    return new Date(right.publishedAt || 0).getTime() - new Date(left.publishedAt || 0).getTime();
  });
}

function normalizePreferences(preferences = {}) {
  const minPriority = ["P0", "P1", "P2"].includes(preferences?.minPriority)
    ? preferences.minPriority
    : DEFAULT_PREFERENCES.minPriority;

  return {
    minPriority,
    topics: normalizeTags(preferences?.topics || []),
    digestOnly: Boolean(preferences?.digestOnly),
  };
}

async function updateSubscriberSettingsFromCallback(chatId, data, env) {
  return updateSubscriber(
    chatId,
    (subscriber) => {
      const preferences = normalizePreferences(subscriber.preferences);
      const parts = data.split(":");
      const action = parts[1];
      const value = parts[2];

      if (action === "min" && ["P0", "P1", "P2"].includes(value)) {
        preferences.minPriority = value;
      }

      if (action === "digest") {
        preferences.digestOnly = !preferences.digestOnly;
      }

      if (action === "topic" && value === "clear") {
        preferences.topics = [];
      }

      if (action === "topic" && value && value !== "clear") {
        const normalizedTopic = normalizeTags([value])[0];
        const exists = preferences.topics.includes(normalizedTopic);
        preferences.topics = exists
          ? preferences.topics.filter((topic) => topic !== normalizedTopic)
          : [...preferences.topics, normalizedTopic];
      }

      return {
        ...subscriber,
        preferences,
      };
    },
    env
  );
}

function getSubscriberDisplayName(subscriber) {
  const firstName = String(subscriber?.firstName || "").trim();
  const username = String(subscriber?.username || "").trim();

  if (firstName) return firstName;
  if (username) return `@${username}`;

  return "";
}

function isTelegramAdmin(chatId, env) {
  const configured = String(env.ADMIN_TELEGRAM_CHAT_ID || env.TELEGRAM_CHAT_ID || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  return configured.includes(String(chatId));
}

async function sendWelcome(chatId, env, subscriber = null) {
  const latest = await ensureInitialNews(env);
  const latestBlock = latest.length
    ? formatCompactItems(latest.slice(0, 3))
    : "🧊 Поки немає доступних новин. Спробуй /latest трохи пізніше.";

  const displayName = getSubscriberDisplayName(subscriber);
  const greeting = displayName
    ? `👋 <b>Вітаю, ${escapeHtml(displayName)}!</b>`
    : "👋 <b>ВІТАЮ У FRONTEND INTELLIGENCE RADAR UA</b>";

  const text = [
    greeting,
    "",
    "Я відстежую офіційні Shopify, Vue, Nuxt, Pinia, Vite, JavaScript/TypeScript, CSS/SCSS, Tailwind, Node.js, MDN і Cloudflare оновлення та перекладаю їх у практичні задачі:",
    "• що змінилося",
    "• наскільки це критично",
    "• де може зачепити тему, Liquid, API, checkout, SEO або автоматизації",
    "• що перевірити в клієнтському магазині",
    "",
    "━━━━━━━━━━━━━━━",
    "",
    "🚨 <b>КРИТИЧНО</b> — може ламати код, інтеграції або бізнес-логіку",
    "⚡ <b>ВАЖЛИВО</b> — варто додати в беклог, аудит або dev-план",
    "🧊 <b>ДО ВІДОМА</b> — корисно знати, але не треба бігти з пожежником",
    "",
    "━━━━━━━━━━━━━━━",
    "",
    "📌 <b>Команди:</b>",
    "• /latest — 7 найсвіжіших перевірених сигналів",
    "• /full — практичний розбір першої новини",
    "• /full 3 — практичний розбір третьої новини",
    "• /p0 — тільки критичні зміни",
    "• /themes — теми, Liquid, секції",
    "• /performance — швидкість, SEO, оптимізація",
    "• /vue — Vue і Pinia",
    "• /nuxt — Nuxt, SSR і Nitro",
    "• /js — JavaScript, TypeScript, Node і Vite",
    "• /css — CSS, SCSS, Tailwind, UI та a11y",
    "• /cloudflare — Workers та edge",
    "• /shopify — Shopify, Liquid та API",
    "• /digest — коротке зведення",
    "• /audit — audit checklist",
    "• /settings — персональні налаштування",
    "• /help — всі команди",
    "",
    "━━━━━━━━━━━━━━━",
    "",
    "🆕 <b>3 ОСТАННІ НОВИНИ</b>",
    "",
    latestBlock,
    "",
    "━━━━━━━━━━━━━━━",
    "",
    "💡 Використовуй кнопки нижче або напиши <b>/full</b> для повних frontend-розборів.",
  ].join("\n");

  await sendTelegramRaw(chatId, text, env, {
    replyMarkup: buildMainReplyKeyboard(),
  });
}

function formatStopMessage() {
  return [
    "🧊 <b>Підписку вимкнено</b>",
    "",
    "Ти більше не отримуватимеш автоматичні frontend-новини.",
    "",
    "Щоб знову підписатися, напиши /start.",
  ].join("\n");
}

async function sendLatest(chatId, env) {
  const latest = await personalizeItems(chatId, await ensureInitialNews(env), env);

  if (!latest.length) {
    await sendTelegramRaw(
      chatId,
      [
        "🧊 <b>Поки що немає збережених новин.</b>",
        "",
        "За останні 7 днів немає перевірених матеріалів, які пройшли контроль якості.",
        "Спробуй /refresh або повернися трохи пізніше.",
      ].join("\n"),
      env,
      { replyMarkup: buildMainReplyKeyboard() }
    );
    return;
  }

  await sendItemsList(chatId, env, "🆕 СВІЖІ FRONTEND-СИГНАЛИ", latest.slice(0, LATEST_DISPLAY_LIMIT));
}

async function sendFilteredLatest(chatId, env, options) {
  const latest = await ensureInitialNews(env);
  const filtered = latest.filter(options.predicate).slice(0, LATEST_DISPLAY_LIMIT);

  if (!filtered.length) {
    await sendTelegramRaw(
      chatId,
      [
        `<b>${escapeHtml(options.emptyTitle || "Новин по цьому фільтру поки немає")}</b>`,
        "",
        "Наразі в збережених новинах немає відповідних змін.",
        "",
        "Можеш переглянути загальну стрічку: /latest",
      ].join("\n"),
      env,
      { replyMarkup: buildMainReplyKeyboard() }
    );
    return;
  }

  await sendItemsList(chatId, env, options.title, filtered);
}

async function sendItemsList(chatId, env, title, items) {
  const list = formatCompactItems(items);

  await sendTelegramRaw(
    chatId,
    [
      `<b>${escapeHtml(title)}</b>`,
      "",
      list,
      "",
      "━━━━━━━━━━━━━━━",
      "",
      "📖 /full 1 — практичний розбір першої новини",
      "Натисни кнопку під потрібною новиною, щоб відкрити її окремо.",
    ].join("\n"),
    env,
    {
      replyMarkup: buildListInlineKeyboard(items),
    }
  );
}

function formatCompactItems(items) {
  if (!items.length) {
    return "🧊 Немає новин для показу.";
  }

  return items
    .map((rawItem, index) => {
      const item = normalizeStoredStructuredItem(rawItem);
      const priority = item.priority || "P2";
      const badge = getPriorityBadge(priority);
      const label = getPriorityLabel(priority);
      const area = translateArea(item.area || "Shopify Dev");
      const date = item.publishedAt ? `🗓 ${escapeHtml(item.publishedAt.slice(0, 10))}` : "";
      const audience = cleanStructuredText(item.audience || inferAudience(area));

      return [
        `${index + 1}. ${badge} <b>${escapeHtml(getItemTitle(item))}</b>`,
        `${date} · <code>${escapeHtml(area)}</code> · ${escapeHtml(label)}`,
        `Факт: ${escapeHtml(item.essence || item.aiConclusion)}`,
        `Кому: ${escapeHtml(audience)}`,
        `Дія: ${escapeHtml(item.todayAction || item.clientTask)}`,
        `👉 /full ${index + 1}`,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

async function sendFullLatest(chatId, env, options = {}) {
  const latest = await personalizeItems(chatId, await ensureInitialNews(env), env);
  const items = latest.slice(0, FULL_DISPLAY_LIMIT);

  if (!items.length) {
    await sendTelegramRaw(
      chatId,
      [
        "🧊 <b>Поки немає новин для повного перегляду.</b>",
        "",
        "Спробуй /latest трохи пізніше.",
      ].join("\n"),
      env,
      { replyMarkup: buildMainReplyKeyboard() }
    );
    return;
  }

  await sendSingleCard(chatId, env, options.singleIndex || 1);
}

async function sendSingleCard(chatId, env, index = 1) {
  const latest = await personalizeItems(chatId, await ensureInitialNews(env), env);
  const items = latest.slice(0, FULL_DISPLAY_LIMIT);
  const safeIndex = Math.max(1, Math.min(Number(index) || 1, items.length || 1));
  const item = items[safeIndex - 1];

  if (!item) {
    await sendTelegramRaw(chatId, "🧊 Немає такого розбору. Спробуй /latest.", env, {
      replyMarkup: buildMainReplyKeyboard(),
    });
    return;
  }

  await sendTelegramRaw(chatId, formatStoredFullItem(item, { index: safeIndex, total: items.length }), env, {
    replyMarkup: buildItemInlineKeyboard(item, safeIndex - 1),
  });
}

async function sendSingleCardByReference(chatId, env, itemReference) {
  const latest = await getLatestItems(env);
  const reference = String(itemReference || "").trim();
  const item = latest.find((candidate) =>
    String(candidate.itemId || "").startsWith(reference)
  );

  if (!item) {
    await sendTelegramRaw(chatId, "🧊 Ця новина вже вийшла зі свіжої стрічки. Відкрий /latest ще раз.", env, {
      replyMarkup: buildMainReplyKeyboard(),
    });
    return;
  }

  const ordered = sortItemsByDateDesc(latest);
  const index = ordered.findIndex((candidate) => candidate.itemId === item.itemId);
  await sendTelegramRaw(
    chatId,
    formatStoredFullItem(item, { index: index + 1, total: ordered.length }),
    env,
    { replyMarkup: buildItemInlineKeyboard(item, Math.max(0, index)) }
  );
}

async function sendItemReadingMode(chatId, item, mode, env) {
  const normalized = normalizeStoredStructuredItem(item);
  const title = escapeHtml(getItemTitle(normalized));
  let heading = "⚡ <b>ЗА 20 СЕКУНД</b>";
  let body = [
    `🎯 <b>Вердикт:</b> ${escapeHtml(normalized.recommendation)}`,
    `👤 <b>Кого зачіпає:</b> ${escapeHtml(normalized.audience)}`,
    `💥 <b>Що змінилося:</b> ${escapeHtml(normalized.after)}`,
    `✅ <b>Дія:</b> ${escapeHtml(normalized.todayAction)}`,
    `⏱ <b>Час:</b> ${escapeHtml(normalized.timeEstimate)}`,
  ];

  if (mode === "c") {
    heading = "✅ <b>ПРАКТИЧНИЙ ЧЕКЛИСТ</b>";
    body = [
      formatChecklistLines(normalized.checklistItems),
      "",
      `🎯 <b>Очікуваний результат:</b> ${escapeHtml(normalized.expectedResult)}`,
      `⏱ <b>Оцінка:</b> ${escapeHtml(normalized.timeEstimate)}`,
    ];
  } else if (mode === "p") {
    heading = "💼 <b>ДЛЯ КЛІЄНТА</b>";
    body = [
      `📌 <b>Корисна задача:</b> ${escapeHtml(normalized.clientOpportunity)}`,
      `👤 <b>Для кого:</b> ${escapeHtml(normalized.audience)}`,
      `✅ <b>Результат:</b> ${escapeHtml(normalized.expectedResult)}`,
      `⏱ <b>Оцінка:</b> ${escapeHtml(normalized.timeEstimate)}`,
    ];
  } else if (mode === "e") {
    heading = "🧠 <b>ПОЯСНЮЮ ПРОСТО</b>";
    body = [
      escapeHtml(normalized.essence || normalized.aiConclusion),
      "",
      !/не підтверджено|не описує/i.test(normalized.before) ? `🔄 <b>Було:</b> ${escapeHtml(normalized.before)}` : "",
      `✨ <b>Тепер:</b> ${escapeHtml(normalized.after)}`,
      `💡 <b>Приклад:</b> ${escapeHtml(normalized.devIdea)}`,
    ].filter(Boolean);
  } else if (mode === "r") {
    heading = "🎯 <b>ЧИ СТОСУЄТЬСЯ ЦЕ ТЕБЕ?</b>";
    body = [
      `✅ <b>Так, якщо:</b> ${escapeHtml(normalized.audience)}`,
      `🧊 <b>Ні, якщо:</b> ${escapeHtml(normalized.notFor)}`,
      `🔍 <b>Перевір за 5 хвилин:</b> ${escapeHtml(normalized.todayAction)}`,
    ];
  } else if (mode === "k") {
    heading = "💻 <b>ПРАКТИЧНИЙ ПРИКЛАД</b>";
    let example;
    try {
      example = await generateFocusedReadingMode(normalized, env, "code");
    } catch (error) {
      console.warn("Code example unavailable:", safeErrorMessage(error));
      example = `${normalized.devIdea}\n\nПеревір: ${normalizeList(normalized.checklistItems).slice(0, 2).join("; ")}`;
    }
    body = [escapeHtml(example)];
  }

  await sendTelegramRaw(
    chatId,
    [heading, "", `🔥 <b>${title}</b>`, "", ...body].join("\n"),
    env,
    { replyMarkup: buildItemInlineKeyboard(normalized) }
  );
}

async function generateFocusedReadingMode(item, env, mode) {
  const instruction = mode === "code"
    ? "Дай один мінімальний практичний приклад коду або конфігурації. Якщо код не доречний, дай конкретний сценарій без вигаданого API. Поясни 2-3 реченнями українською. Без markdown fences."
    : "Поясни зміну дуже просто українською у 3 коротких реченнях і наведи одну аналогію.";
  return callAiText(env, {
    temperature: 0.1,
    maxTokens: 500,
    system: "Ти точний frontend-викладач. Використовуй лише надані факти й не вигадуй API.",
    prompt: `${instruction}\n\nЗаголовок: ${item.title}\nТехнологія: ${item.area}\nФакти: ${normalizeList(item.verifiedFacts).join(" | ")}\nПояснення: ${item.essence}`,
  });
}

async function sendHelp(chatId, env) {
  const text = [
    "⚙️ <b>FRONTEND INTELLIGENCE RADAR UA — КОМАНДИ</b>",
    "",
    "/start — почати та підписатися",
    "/latest — 7 найсвіжіших перевірених сигналів",
    "/full — один практичний розбір без води",
    "/full 3 — конкретний розбір зі списку",
    "/card 3 — те саме, коротка команда для картки",
    "/p0 — критичні зміни",
    "/themes — теми, Liquid, секції",
    "/performance — швидкість, SEO, оптимізація",
    "/vue — Vue і Pinia",
    "/nuxt — Nuxt, SSR та Nitro",
    "/js — JavaScript, TypeScript, Node.js і Vite",
    "/css — CSS, SCSS, Tailwind, UI та accessibility",
    "/cloudflare — Cloudflare Workers та edge",
    "/shopify — Shopify, Liquid, checkout та API",
    "/digest — зведення по категоріях",
    "/audit — audit checklist для frontend і Shopify-проєктів",
    "/settings — персональні налаштування підписок",
    "/stats — технічна статистика, тільки для адміна",
    "/refresh — обробити наступну свіжу новину, тільки для адміна",
    "/test-ai — перевірити AI, тільки для адміна",
    "/stop — відписатися від новин",
    "/help — допомога",
    "",
    "━━━━━━━━━━━━━━━",
    "",
    "📡 Бот автоматично надсилає підписникам зміни згідно з їхніми settings.",
    "🧊 Менш важливі зміни не спамлять чат, але потрапляють у зведення.",
  ].join("\n");

  await sendTelegramRaw(chatId, text, env, {
    replyMarkup: buildMainReplyKeyboard(),
  });
}

async function sendUnknownCommand(chatId, env) {
  await sendTelegramRaw(
    chatId,
    [
      "🤖 <b>Не впізнав команду.</b>",
      "",
      "Ось що я вмію:",
      "",
      "/latest — 7 найсвіжіших перевірених сигналів",
      "/full — один практичний розбір без води",
      "/full 3 — один розбір",
      "/p0 — критичні зміни",
      "/themes — теми, Liquid, секції",
      "/performance — швидкість, SEO, оптимізація",
      "/digest — коротке зведення",
      "/audit — audit checklist",
      "/settings — персональні налаштування",
      "/help — допомога",
    ].join("\n"),
    env,
    { replyMarkup: buildMainReplyKeyboard() }
  );
}

async function sendSettings(chatId, env, subscriber, options = {}) {
  const normalizedSubscriber = subscriber || (await getSubscribers(env)).find((item) => String(item.chatId) === String(chatId));
  const preferences = normalizePreferences(normalizedSubscriber?.preferences);
  const topics = preferences.topics.length ? preferences.topics.join(" • ") : "усі теми";

  const text = [
    "⚙️ <b>НАЛАШТУВАННЯ FRONTEND RADAR</b>",
    "",
    `🔔 Мінімальний рівень: <b>${escapeHtml(preferences.minPriority)}</b>`,
    `🎯 Теми: <b>${escapeHtml(topics)}</b>`,
    `🧠 Тільки зведення: <b>${preferences.digestOnly ? "так" : "ні"}</b>`,
    "",
    "Натисни кнопку нижче, щоб змінити режим.",
  ].join("\n");

  const replyMarkup = buildSettingsInlineKeyboard(preferences);

  if (options.replaceMessageId) {
    await editTelegramMessage(chatId, options.replaceMessageId, text, env, { replyMarkup });
    return;
  }

  await sendTelegramRaw(chatId, text, env, { replyMarkup });
}

async function sendStats(chatId, env) {
  if (!isTelegramAdmin(chatId, env)) {
    await sendTelegramRaw(chatId, "🔒 <b>Stats доступний тільки адміну.</b>", env);
    return;
  }

  const subscribers = await getSubscribers(env);
  const latest = await getLatestItems(env);
  const digest = await getDigestItems(env);
  const lastRun = await getLastRun(env);
  const stats = buildStats(latest, digest, subscribers, lastRun);

  await sendTelegramRaw(chatId, formatStatsMessage(stats), env, {
    replyMarkup: buildAdminInlineKeyboard(),
  });
}

async function sendRefresh(chatId, env) {
  if (!isTelegramAdmin(chatId, env)) {
    await sendTelegramRaw(chatId, "🔒 <b>Refresh доступний тільки адміну.</b>", env);
    return;
  }

  const existingLock = await env.SHOPIFY_RADAR_KV.get(REFRESH_LOCK_KEY);

  if (existingLock) {
    await sendTelegramRaw(
      chatId,
      [
        "⏳ <b>Оновлення вже виконується</b>",
        "",
        "Я вже обробляю наступну frontend-новину у тихому режимі.",
        "Другий refresh не запускаю, щоб не дублювати повідомлення і не витрачати AI-запити.",
        "",
        "Спробуй /latest або /stats через хвилину.",
      ].join("\n"),
      env,
      { replyMarkup: buildAdminInlineKeyboard() }
    );
    return;
  }

  await env.SHOPIFY_RADAR_KV.put(
    REFRESH_LOCK_KEY,
    JSON.stringify({
      chatId: String(chatId),
      startedAt: new Date().toISOString(),
    }),
    { expirationTtl: REFRESH_LOCK_TTL_SECONDS }
  );

  try {
    await sendTelegramRaw(
      chatId,
      [
        "🔄 <b>Обробляю наступну frontend-новину...</b>",
        "",
        "Працюю в тихому режимі: без broadcast для підписників.",
      ].join("\n"),
      env,
      { replyMarkup: buildAdminInlineKeyboard() }
    );

    const result = await run(env, {
      silent: true,
      ignoreSeen: false,
      limit: MANUAL_REFRESH_LIMIT,
      debug: false,
    });

    const latest = await getLatestItems(env);
    const topItems = latest.slice(0, INITIAL_BOOTSTRAP_LIMIT);
    const fallbackCount = topItems.filter((item) => item.usedFallback).length;
    const structuredCount = topItems.filter(hasStructuredFields).length;
    const avgQuality = topItems.length
      ? Math.round(
          topItems.reduce((sum, item) => sum + Number(item.qualityScore || 0), 0) / topItems.length
        )
      : 0;

    await sendTelegramRaw(
      chatId,
      [
        "✅ <b>ОНОВЛЕННЯ ГОТОВЕ</b>",
        "",
        `📡 Checked: <b>${result.checked}</b>`,
        `🆕 Recent: <b>${result.recent}</b>`,
        `✅ Processed: <b>${result.processed}</b>`,
        `🧱 Structured top-10: <b>${structuredCount}/${topItems.length}</b>`,
        `🤖 Fallback top-10: <b>${fallbackCount}</b>`,
        `🧪 AI quality avg: <b>${avgQuality}/100</b>`,
        `❌ Failed: <b>${result.failed}</b>`,
        "",
        "Перевір: /latest або /full",
      ].join("\n"),
      env,
      { replyMarkup: buildAdminInlineKeyboard() }
    );
  } catch (error) {
    await sendTelegramRaw(
      chatId,
      [
        "❌ <b>Refresh впав</b>",
        "",
        `<code>${escapeHtml(String(error?.message || error))}</code>`,
      ].join("\n"),
      env,
      { replyMarkup: buildAdminInlineKeyboard() }
    );
  } finally {
    await env.SHOPIFY_RADAR_KV.delete(REFRESH_LOCK_KEY);
  }
}

async function sendAiTest(chatId, env) {
  if (!isTelegramAdmin(chatId, env)) {
    await sendTelegramRaw(chatId, "🔒 <b>AI test доступний тільки адміну.</b>", env);
    return;
  }

  try {
    const testItem = {
      source: "Shopify Developer Changelog",
      title: "Automatic CSS subsetting for {% stylesheet %} tags",
      url: "https://shopify.dev/changelog",
      summary:
        "Shopify is introducing CSS content subsetting for stylesheet tags to improve storefront performance.",
      publishedAt: new Date().toISOString(),
      tags: ["themes", "liquid", "sections", "performance"],
    };

    const rawAiSummary = await summarizeWithAi(testItem, env);
    const structuredSummary = parseAiStructured(rawAiSummary, testItem);
    const useful = isStructuredSummaryUseful(structuredSummary);
    const enrichedItem = buildEnrichedItem(testItem, structuredSummary, {
      rawAiSummary,
      usedFallback: !useful,
      fallbackReason: useful ? null : "AI returned incomplete or generic structured response",
    });

    await sendTelegramRaw(
      chatId,
      [
        "🤖 <b>AI TEST</b>",
        "",
        `Status: <b>${useful ? "OK" : "WEAK"}</b>`,
        `Quality: <b>${enrichedItem.qualityScore}/100</b>`,
        `Title: <b>${escapeHtml(enrichedItem.uaTitle)}</b>`,
        `Priority: <b>${escapeHtml(enrichedItem.priority)}</b>`,
        `Area: <code>${escapeHtml(enrichedItem.area)}</code>`,
        "",
        "🧠 <b>Preview:</b>",
        escapeHtml(enrichedItem.essence),
      ].join("\n"),
      env,
      { replyMarkup: buildAdminInlineKeyboard() }
    );
  } catch (error) {
    await sendTelegramRaw(
      chatId,
      [
        "🤖 <b>AI TEST FAILED</b>",
        "",
        escapeHtml(String(error?.message || error)),
      ].join("\n"),
      env,
      { replyMarkup: buildAdminInlineKeyboard() }
    );
  }
}

async function sendDailyDigest(env, options = {}) {
  validateEnv(env);

  const todayKey = new Date().toISOString().slice(0, 10);
  const sentKey = `digest:sent:${todayKey}`;

  if (!options.force) {
    const alreadySent = await env.SHOPIFY_RADAR_KV.get(sentKey);
    if (alreadySent) {
      return { sent: false, reason: "Digest already sent today" };
    }
  }

  let digestItems = await getDigestItems(env);

  if (!digestItems.length) {
    await ensureInitialNews(env);
    digestItems = await getDigestItems(env);
  }

  if (!digestItems.length) {
    return { sent: false, reason: "No digest items" };
  }

  const sendResult = await sendPersonalizedDigest(digestItems, env);

  await env.SHOPIFY_RADAR_KV.put(sentKey, "1", {
    expirationTtl: 60 * 60 * 36,
  });

  return {
    sent: true,
    count: digestItems.length,
    subscribers: sendResult?.subscribers || 0,
    deliveredSubscribers: sendResult?.deliveredSubscribers || 0,
    skippedSubscribers: sendResult?.skippedSubscribers || 0,
    failedSubscribers: sendResult?.failed?.length || 0,
  };
}

async function sendDigestToChat(chatId, env) {
  const digestItems = await getDigestItems(env);

  if (!digestItems.length) {
    await ensureInitialNews(env);
  }

  const updatedDigestItems = await personalizeItems(
    chatId,
    sortItemsByDateDesc(await getDigestItems(env)),
    env
  );

  if (!updatedDigestItems.length) {
    await sendTelegramRaw(
      chatId,
      [
        "🧊 <b>Зведення поки порожнє.</b>",
        "",
        "Поки немає свіжих frontend-новин для зведення.",
      ].join("\n"),
      env,
      { replyMarkup: buildMainReplyKeyboard() }
    );
    return;
  }

  await sendTelegramRaw(chatId, formatDigestMessage(updatedDigestItems.slice(0, 20)), env, {
    replyMarkup: buildDigestInlineKeyboard(),
  });
}

async function sendPersonalizedDigest(items, env) {
  const subscribers = await getSubscribers(env);

  if (!subscribers.length && env.TELEGRAM_CHAT_ID) {
    const personalized = await personalizeItems(env.TELEGRAM_CHAT_ID, items, env);
    await sendTelegramRaw(
      env.TELEGRAM_CHAT_ID,
      formatDigestMessage(personalized.slice(0, 20)),
      env,
      { replyMarkup: buildDigestInlineKeyboard() }
    );
    return { subscribers: 1, deliveredSubscribers: 1, skippedSubscribers: 0, failed: [] };
  }

  const failed = [];
  let deliveredSubscribers = 0;

  for (let index = 0; index < subscribers.length; index += TELEGRAM_DELIVERY_CONCURRENCY) {
    const batch = subscribers.slice(index, index + TELEGRAM_DELIVERY_CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async (subscriber) => {
        const personalized = await personalizeItems(subscriber.chatId, items, env);
        return sendTelegramRaw(
          subscriber.chatId,
          formatDigestMessage(personalized.slice(0, 20)),
          env,
          { replyMarkup: buildDigestInlineKeyboard() }
        );
      })
    );

    results.forEach((result, resultIndex) => {
      if (result.status === "fulfilled") deliveredSubscribers += 1;
      else failed.push({ chatId: batch[resultIndex].chatId, error: safeErrorMessage(result.reason) });
    });

    if (index + TELEGRAM_DELIVERY_CONCURRENCY < subscribers.length) {
      await delay(TELEGRAM_DELIVERY_BATCH_DELAY_MS);
    }
  }

  return {
    subscribers: subscribers.length,
    deliveredSubscribers,
    skippedSubscribers: 0,
    failed,
  };
}

function formatDigestMessage(items) {
  const normalized = items.map(normalizeStoredStructuredItem);
  const p0 = normalized.filter((item) => item.priority === "P0");
  const p1 = normalized.filter((item) => item.priority === "P1");
  const p2 = normalized.filter((item) => item.priority === "P2");

  const groups = [
    { title: "🚨 CRITICAL", items: p0.slice(0, 4) },
    { title: "💚 VUE / NUXT / PINIA", items: normalized.filter((item) => matchesDevTags(item, ["vue", "nuxt", "pinia", "ssr"])).slice(0, 4) },
    { title: "⚡ JS / TS / VITE / NODE", items: normalized.filter((item) => matchesDevTags(item, ["javascript", "typescript", "vite", "node"])).slice(0, 4) },
    { title: "🎨 CSS / TAILWIND / UI", items: normalized.filter((item) => matchesDevTags(item, ["css", "scss", "sass", "tailwind", "ui", "a11y"])).slice(0, 4) },
    { title: "🛍 SHOPIFY", items: normalized.filter((item) => matchesDevTags(item, ["shopify", "liquid", "admin-api", "checkout"])).slice(0, 4) },
    { title: "☁️ CLOUDFLARE", items: normalized.filter((item) => matchesDevTags(item, ["cloudflare", "workers", "edge"])).slice(0, 4) },
    { title: "🧊 FYI", items: p2.slice(0, 4) },
  ];

  const groupBlocks = groups
    .filter((group) => group.items.length)
    .map((group) => [
      `<b>${escapeHtml(group.title)}</b>`,
      ...group.items.map((item, index) => {
        const badge = getPriorityBadge(item.priority);
        const title = getItemTitle(item);
        const score = Number.isFinite(Number(item.relevance)) ? ` ${item.relevance}/10` : "";
        return `${index + 1}. ${badge} ${escapeHtml(title)}${score ? ` · 🔎${escapeHtml(score)}` : ""}`;
      }),
    ].join("\n"));

  const topQuality = normalized
    .slice(0, 20)
    .sort((a, b) => Number(b.qualityScore || 0) - Number(a.qualityScore || 0))
    .slice(0, 3);
  const actionable = normalized.filter((item) => item.priority !== "P2");
  const topItem = actionable[0] || normalized[0];
  const estimatedMinutes = actionable
    .slice(0, 5)
    .reduce((total, item) => total + Math.max(10, normalizeScore(item.effort, 5) * 8), 0);

  return [
    "☕ <b>FRONTEND INTELLIGENCE RADAR — РАНКОВЕ ЗВЕДЕННЯ</b>",
    "",
    `Сьогодні: 🚨 <b>${p0.length}</b> термінових · ⚡ <b>${p1.length}</b> у роботу · 🧊 <b>${p2.length}</b> лише знати`,
    `⏱ Орієнтовно на перші перевірки: <b>${estimatedMinutes || 10} хв</b>`,
    "",
    "🔥 <b>ГОЛОВНЕ</b>",
    escapeHtml(getItemTitle(topItem)),
    escapeHtml(topItem?.aiConclusion || topItem?.essence || "Немає головної новини."),
    "",
    "✅ <b>ОДНА ДІЯ НА СЬОГОДНІ</b>",
    escapeHtml(topItem?.todayAction || topItem?.clientTask || "Переглянути найважливішу новину."),
    "",
    "━━━━━━━━━━━━━━━",
    "",
    groupBlocks.join("\n\n"),
    "",
    "━━━━━━━━━━━━━━━",
    "",
    "✅ /audit — перетворити ці зміни у frontend audit checklist",
    "📖 /full — відкрити повні розбори",
    `🧪 Найкраща якість AI: <b>${topQuality[0]?.qualityScore || 0}/100</b>`,
  ]
    .filter(Boolean)
    .join("\n");
}

async function sendAuditChecklist(chatId, env) {
  await ensureInitialNews(env);
  const latest = await getLatestItems(env);
  const audit = buildAuditData(latest.slice(0, 20));

  await sendTelegramRaw(chatId, formatAuditMessage(audit), env, {
    replyMarkup: buildAuditInlineKeyboard(),
  });
}

function buildAuditData(items) {
  const normalized = items.map(normalizeStoredStructuredItem);
  const groups = {
    "Vue / Nuxt / Pinia": [],
    "JS / TS / Vite / Node": [],
    "CSS / Tailwind / UI": [],
    "Cloudflare / Edge": [],
    "Theme / Liquid": [],
    "Admin API": [],
    Checkout: [],
    "Performance / SEO": [],
    "Apps / Automation": [],
  };

  for (const item of normalized) {
    const title = getItemTitle(item);
    const clientTask = item.clientTask || buildClientTask(item);
    const line = `${title}: ${clientTask}`;

    if (matchesDevTags(item, ["vue", "nuxt", "pinia", "ssr"])) groups["Vue / Nuxt / Pinia"].push(line);
    if (matchesDevTags(item, ["javascript", "typescript", "vite", "node"])) groups["JS / TS / Vite / Node"].push(line);
    if (matchesDevTags(item, ["css", "scss", "sass", "tailwind", "ui", "a11y"])) groups["CSS / Tailwind / UI"].push(line);
    if (matchesDevTags(item, ["cloudflare", "workers", "edge"])) groups["Cloudflare / Edge"].push(line);
    if (matchesDevTags(item, ["themes", "liquid", "sections"])) groups["Theme / Liquid"].push(line);
    if (matchesDevTags(item, ["admin-api", "storefront-api", "graphql", "api", "metafields"])) groups["Admin API"].push(line);
    if (matchesDevTags(item, ["checkout", "functions", "markets"])) groups.Checkout.push(line);
    if (matchesDevTags(item, ["performance", "seo", "speed", "assets"])) groups["Performance / SEO"].push(line);
    if (matchesDevTags(item, ["app-dev", "automation", "webhooks", "pos"])) groups["Apps / Automation"].push(line);
  }

  return Object.entries(groups).map(([title, values]) => ({
    title,
    items: values.filter(Boolean).slice(0, 6),
  }));
}

function formatAuditMessage(groups) {
  const blocks = groups
    .filter((group) => group.items.length)
    .map((group) => [
      `<b>${escapeHtml(group.title)}</b>`,
      ...group.items.map((item) => `☐ ${escapeHtml(item)}`),
    ].join("\n"));

  return [
    "✅ <b>FRONTEND AUDIT CHECKLIST</b>",
    "",
    "Автоматично зібрано з останніх офіційних frontend і Shopify змін.",
    "",
    "━━━━━━━━━━━━━━━",
    "",
    blocks.length ? blocks.join("\n\n") : "🧊 Поки немає пунктів для аудиту.",
    "",
    "━━━━━━━━━━━━━━━",
    "",
    "💡 Використовуй це як стартовий checklist для клієнтського технічного аудиту.",
  ].join("\n");
}

async function fetchContentFeeds() {
  const results = await Promise.allSettled(CONTENT_SOURCES.map(fetchContentSource));
  const items = [];

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      items.push(...result.value);
      return;
    }

    console.warn("Content source unavailable:", {
      source: CONTENT_SOURCES[index].id,
      error: safeErrorMessage(result.reason),
    });
  });

  if (!items.length) throw new Error("All frontend content sources failed");

  const deduplicated = new Map();
  for (const item of items) {
    const key = normalizeReleaseIdentity(item);
    const current = deduplicated.get(key);
    if (!current || new Date(item.publishedAt || 0) > new Date(current.publishedAt || 0)) {
      deduplicated.set(key, item);
    }
  }

  return rankFeedItems([...deduplicated.values()]);
}

async function fetchContentSource(source) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FEED_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(source.feedUrl, {
      headers: {
        "User-Agent": `${SERVICE_NAME.replace(/\s+/g, "")}/${SERVICE_VERSION}`,
        Accept: "application/atom+xml, application/rss+xml, application/xml, text/xml",
      },
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`${source.name} failed: ${response.status}`);
    const xml = await readResponseTextLimited(response, MAX_FEED_BYTES);
    const parsed = source.format === "atom" ? parseAtomFeed(xml, source) : parseRssFeed(xml, source);
    return parsed.slice(0, MAX_ITEMS_PER_SOURCE);
  } finally {
    clearTimeout(timeout);
  }
}

function parseRssFeed(xml, source) {
  const rawItems = String(xml || "").match(/<item\b[\s\S]*?<\/item>/gi) || [];
  return rawItems
    .map((raw) => {
      const title = cleanText(extractTag(raw, "title"));
      const itemUrl = cleanText(extractTag(raw, "link"));
      const description = cleanHtml(extractTag(raw, "description") || extractTag(raw, "content:encoded"));
      const pubDateRaw = cleanText(extractTag(raw, "pubDate") || extractTag(raw, "dc:date"));
      const categories = extractAllTags(raw, "category").map(cleanText).filter(Boolean);
      return buildSourceItem(source, { title, itemUrl, description, pubDateRaw, categories });
    })
    .filter(Boolean)
    .sort(sortByPublishedDesc);
}

function parseAtomFeed(xml, source) {
  const entries = String(xml || "").match(/<entry\b[\s\S]*?<\/entry>/gi) || [];
  return entries
    .map((raw) => {
      const title = cleanText(extractTag(raw, "title"));
      const itemUrl = extractAtomLink(raw);
      const description = cleanHtml(extractTag(raw, "content") || extractTag(raw, "summary"));
      const pubDateRaw = cleanText(extractTag(raw, "published") || extractTag(raw, "updated"));
      const categories = [...raw.matchAll(/<category\b[^>]*term=["']([^"']+)["'][^>]*\/?\s*>/gi)]
        .map((match) => cleanText(match[1]))
        .filter(Boolean);
      return buildSourceItem(source, { title, itemUrl, description, pubDateRaw, categories });
    })
    .filter(Boolean)
    .sort(sortByPublishedDesc);
}

function buildSourceItem(source, { title, itemUrl, description, pubDateRaw, categories }) {
  if (!title || !itemUrl) return null;
  return {
    source: source.name,
    sourceId: source.id,
    title,
    url: itemUrl,
    summary: description,
    publishedAt: pubDateRaw ? safeIsoDate(pubDateRaw) : "",
    tags: normalizeTags([...(source.tags || []), ...(categories || [])]),
  };
}

function extractAtomLink(raw) {
  const alternate = String(raw || "").match(/<link\b[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["'][^>]*>/i);
  const anyLink = String(raw || "").match(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/i);
  return cleanText((alternate || anyLink || [])[1] || "");
}

function normalizeReleaseIdentity(item) {
  return cleanText(item.title)
    .toLowerCase()
    .replace(/\b(release|released|version|changelog|announcement)\b/gi, "")
    .replace(/[^a-z0-9а-яіїєґ]+/gi, "-")
    .slice(0, 240);
}

function isHighSignalFeedItem(item) {
  const text = buildSearchText(item);
  const important = /security advisory|security release|vulnerab|\bcve-?\d*|breaking change|deprecat|migration required|critical/i.test(text);
  const prerelease = /\b(alpha|beta|rc|nightly|canary|snapshot|next)\b/i.test(item.title || "");
  const routineNodePatch = item.sourceId === "node" && /(?:node\.js\s+)?v?\d+\.\d+\.\d+\b/i.test(item.title || "") && !/major|minor|security|vulnerab|breaking|deprecat/i.test(text);
  const routineToolPatch = ["vite", "sass", "playwright", "nitro", "nuxt-ui", "vitest"].includes(item.sourceId) && /^v?\d+\.\d+\.\d+\b/i.test(item.title || "") && !/security|vulnerab|breaking|deprecat|migration/i.test(text);
  const irrelevantCloudflare = item.sourceId === "cloudflare" && /cloudflare one client|\bcasb\b|zero trust|saved login profiles|warp client/i.test(text);
  const genericReleaseStub = /^(?:v|dart sass |sass-api-)?\d+\.\d+\.\d+(?:[-+].*)?$/i.test(item.title || "") &&
    /refer to .*changelog|committer metadata|creating a tag/i.test(cleanHtml(item.summary || ""));

  if (prerelease && !important) return false;
  if (routineNodePatch && !important) return false;
  if (routineToolPatch && !important) return false;
  if (irrelevantCloudflare && !important) return false;
  if (genericReleaseStub && !important) return false;
  return Boolean(item.title && item.url && item.publishedAt);
}

function rankFeedItems(items) {
  return [...items].sort((left, right) => {
    const priority = (item) => {
      const text = buildSearchText(item);
      if (/security|vulnerab|cve|breaking|deprecat|migration required|critical/i.test(text)) return 3;
      if (/major|release|stable|typescript|vue|nuxt|shopify|tailwind|vite/i.test(text)) return 2;
      if (/patch|chore|dependencies/i.test(text)) return 0;
      return 1;
    };
    const dateDifference = sortByPublishedDesc(left, right);
    if (dateDifference) return dateDifference;
    return priority(right) - priority(left);
  });
}

function sortByPublishedDesc(left, right) {
  return new Date(right?.publishedAt || 0).getTime() - new Date(left?.publishedAt || 0).getTime();
}

async function readResponseTextLimited(response, maxBytes) {
  if (!response.body?.getReader) return (await response.text()).slice(0, maxBytes);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let output = "";
  let bytes = 0;

  while (bytes < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    const remaining = maxBytes - bytes;
    const chunk = value.byteLength > remaining ? value.slice(0, remaining) : value;
    bytes += chunk.byteLength;
    output += decoder.decode(chunk, { stream: bytes < maxBytes });
    if (value.byteLength > remaining) {
      await reader.cancel();
      break;
    }
  }

  return output;
}

async function enrichItemWithArticleContext(item) {
  try {
    const articleContext = await fetchArticleContext(item.url);
    return { ...item, articleContext, contextSource: articleContext ? "full-article" : "rss" };
  } catch (error) {
    console.warn("Full changelog context unavailable:", {
      url: item.url,
      error: safeErrorMessage(error),
    });
    return { ...item, articleContext: "", contextSource: "rss" };
  }
}

async function fetchArticleContext(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || !APPROVED_ARTICLE_HOSTS.has(url.hostname)) {
    throw new Error("Unsupported changelog source");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ARTICLE_FETCH_TIMEOUT_MS);

  try {
    let currentUrl = url;
    let response;

    for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
      response = await fetch(currentUrl, {
        headers: {
          "User-Agent": `${SERVICE_NAME.replace(/\s+/g, "")}/${SERVICE_VERSION}`,
          Accept: "text/html,application/xhtml+xml",
        },
        redirect: "manual",
        signal: controller.signal,
      });

      if (response.status < 300 || response.status >= 400) break;

      const location = response.headers.get("location");
      if (!location || redirectCount === 3) throw new Error("Invalid changelog redirect");
      const nextUrl = new URL(location, currentUrl);
      if (nextUrl.protocol !== "https:" || !APPROVED_ARTICLE_HOSTS.has(nextUrl.hostname)) {
        throw new Error("Unsafe changelog redirect");
      }
      currentUrl = nextUrl;
    }

    if (!response.ok) throw new Error(`Changelog article failed with status ${response.status}`);

    const html = await response.text();
    return extractReadableArticleText(html).slice(0, ARTICLE_CONTEXT_MAX_CHARS);
  } finally {
    clearTimeout(timeout);
  }
}

function extractReadableArticleText(html) {
  const raw = String(html || "");
  const mainMatch = raw.match(/<(?:main|article)\b[^>]*>([\s\S]*?)<\/(?:main|article)>/i);
  const content = mainMatch?.[1] || raw;

  return cleanText(
    content
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, " ")
      .replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, " ")
      .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, " ")
      .replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/You signed (?:in|out) in another tab or window\.?/gi, " ")
      .replace(/Reload to refresh your session\.?/gi, " ")
      .replace(/Dismiss alert/gi, " ")
  );
}

function filterItemsByLookback(items, lookbackDays) {
  const minTime = Date.now() - lookbackDays * 24 * 60 * 60 * 1000;

  return items.filter((item) => {
    if (!item.publishedAt) return true;

    const publishedTime = new Date(item.publishedAt).getTime();

    if (Number.isNaN(publishedTime)) return true;

    return publishedTime >= minTime;
  });
}

function filterFreshFeedItems(items, now = Date.now()) {
  const sorted = sortItemsByDateDesc(items || []);
  const datedItems = sorted.filter((item) => {
    const timestamp = new Date(item?.publishedAt || "").getTime();
    return Number.isFinite(timestamp);
  });

  if (!datedItems.length) return [];

  const cutoff = now - FRESH_NEWS_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return datedItems.filter((item) => {
    const timestamp = new Date(item.publishedAt).getTime();
    return timestamp >= cutoff && timestamp <= now + 5 * 60 * 1000;
  });
}

function shouldReenrichItem(item, now = Date.now()) {
  if (!item) return false;
  if (item.pendingEnrichment) return true;

  const missingV10Fields =
    !Array.isArray(item.verifiedFacts) ||
    item.verifiedFacts.length < 2 ||
    !String(item.aiConclusion || "").trim() ||
    !String(item.todayAction || "").trim();

  if (!item.usedFallback && !missingV10Fields && Number(item.qualityScore || 0) >= 70) {
    return false;
  }

  const savedTimestamp = new Date(item.savedAt || 0).getTime();
  if (!Number.isFinite(savedTimestamp)) return true;

  return now - savedTimestamp >= AI_REENRICH_INTERVAL_HOURS * 60 * 60 * 1000;
}

async function extractFactsWithAi(item, env) {
  const prompt = `
You are a strict frontend engineering release fact extractor.

Extract only facts supported by the supplied official source. Do not write recommendations and do not infer undocumented behavior.
Return compact JSON with these keys:
{
  "what_changed": ["..."],
  "affected_surfaces": ["..."],
  "deadlines": ["..."],
  "api_versions": ["..."],
  "breaking_or_deprecated": false,
  "required_actions": ["..."],
  "code_or_config_mentions": ["..."],
  "unknowns": ["..."],
  "source_confidence": 1
}

Title: ${item.title}
RSS summary: ${item.summary || "none"}
Categories: ${(item.tags || []).join(", ") || "none"}
Published: ${item.publishedAt || "unknown"}
Full official article context:
${item.articleContext || "Full article unavailable; use RSS facts only."}
`.trim();

  return callAiText(env, {
    temperature: 0,
    maxTokens: 900,
    system:
      "Extract verifiable facts from official frontend engineering sources. Return JSON only. Never invent deadlines, versions, risks, or required actions.",
    prompt,
  });
}

async function summarizeWithAi(item, env, factAnalysis = "") {
  const baseUrl = normalizeBaseUrl(env.AI_BASE_URL);
  const model = String(env.AI_MODEL || "").trim();

  if (!baseUrl) throw new Error("Missing AI_BASE_URL");
  if (!model) throw new Error("Missing AI_MODEL");
  if (!env.AI_API_KEY) throw new Error("Missing AI_API_KEY");

  const prompt = `
Ти senior Frontend / Vue / Nuxt / Shopify / JavaScript / CSS технічний консультант.

Проаналізуй офіційне оновлення frontend-екосистеми для практичної роботи розробника.

Контекст аудиторії:
- Shopify themes
- Liquid
- sections / snippets / theme architecture
- Storefront performance
- SEO/CRO
- Vue/Nuxt
- Shopify Plus
- Admin GraphQL API
- Checkout / Functions / Markets / Metafields
- Cloudflare Workers
- Shopify automation
- клієнтські Shopify проєкти
- технічні аудити магазинів
- Vue, Nuxt, Pinia, Vite
- JavaScript, TypeScript, Node.js
- CSS, SCSS, Sass, Tailwind CSS
- UI, accessibility, browser APIs
- Cloudflare Workers і edge runtime

Відповідай українською.
Стиль: коротко, практично, Telegram-friendly.
Мета: після читання розробник має точно знати новий факт, чи стосується він його проєкту і яку одну перевірку виконати.
Не використовуй "updates", якщо можна написати "оновлення" або "зміни".
Не використовуй "digest", якщо можна написати "зведення".
Не використовуй "performance", якщо можна написати "швидкість" або "оптимізація".

Поверни відповідь СТРОГО в такому форматі, без вступу, без висновку і без додаткових блоків:

UA_TITLE: короткий український заголовок новини до 90 символів. Переклади англійський title природно, але не вигадуй нового змісту.
PRIORITY: P0 або P1 або P2
RELEVANCE: число від 1 до 10
AREA: коротка категорія англійською, наприклад Vue, Nuxt, Pinia, Vite, JavaScript, TypeScript, CSS, Sass, Tailwind, UI, Accessibility, Node.js, Cloudflare, Shopify
DEV_TAGS: comma-separated tags англійською, наприклад vue, nuxt, pinia, vite, javascript, typescript, css, scss, tailwind, ui, a11y, node, cloudflare, shopify, liquid, performance, security, breaking
IMPACT_TAGS: comma-separated tags англійською, наприклад breaking, migration, audit, client-work, theme-risk, api-version, checkout-risk, performance-opportunity, low-friction-install
CLIENT_TASK: одна коротка практична задача для клієнтського frontend/Shopify-аудиту або беклогу
BENEFIT: число від 1 до 10 — практична користь для frontend, Vue/Nuxt або Shopify-роботи
RISK: число від 1 до 10 — ризик для production, якщо зміну проігнорувати
EFFORT: число від 1 до 10 — складність перевірки або впровадження
CONFIDENCE: число від 1 до 10 — наскільки висновки підтверджені джерелом
RECOMMENDATION: зробити зараз / запланувати / лише знати
HIDDEN_INSIGHT: один неочевидний, але підтверджений або чітко позначений як припущення висновок
NOT_FOR: кому або яким проєктам ця новина, найімовірніше, неважлива
CLIENT_OPPORTUNITY: конкретна корисна задача або пропозиція для клієнта без штучного продажу
URGENCY: сьогодні / цього тижня / у беклог / лише знати
AUDIENCE: кого конкретно зачіпає зміна
VERIFIED_FACTS: 2-4 підтверджені джерелом факти, розділені символом |
AI_CONCLUSION: доступне пояснення простими словами: що саме дає ця зміна розробнику або користувачу; без жаргону й без повторення VERIFIED_FACTS
ASSUMPTIONS: припущення для перевірки, розділені символом |; якщо припущень немає — немає
BEFORE: як працювало раніше, одним конкретним реченням; якщо джерело цього не підтверджує — не підтверджено
AFTER: як працює після зміни, одним конкретним реченням
EXPECTED_RESULT: конкретний очікуваний результат після перевірки або впровадження
TIME_ESTIMATE: реалістичний діапазон часу або «потребує оцінки»
TODAY_ACTION: одна найкорисніша дія на сьогодні

🧠 Суть:
2 короткі речення простою українською: що це за фіча або зміна та що вона реально означає. Поясни так, ніби читач знає frontend, але ще не читав release notes.

🎯 Чому важливо:
1 коротке речення з акцентом на ризик або користь для Shopify розробника.

🛠 Як застосувати:
• конкретно для Vue/Nuxt/Shopify/JS/TS/CSS/Tailwind/Node/Cloudflare
• конкретно для build, SSR, hydration, state, UI, a11y, performance, API або deployment
• конкретно для клієнтських задач або технічного аудиту

✅ Що перевірити:
• що перевірити в коді, темі, API або налаштуваннях магазину
• що може зламатися або застаріти
• де це може дати користь

💡 Ідея для розробника:
Один конкретний приклад використання: у якому проєкті або сценарії це стане в пригоді. Не пиши абстрактну пораду «перевірити».

Правила:
- Без markdown таблиць.
- Без довгих абзаців.
- Без вигаданих фактів.
- VERIFIED_FACTS мають спиратися лише на офіційний текст.
- Усі припущення винось тільки в ASSUMPTIONS.
- Рекомендація має називати об’єкт перевірки, конкретну дію та очікуваний результат.
- TODAY_ACTION обов’язково називає конкретний файл, пакет, API, команду або налаштування. Якщо джерело їх не називає — напиши «дія не потрібна; зберегти як довідку».
- APPLICATION і CHECKLIST не можуть містити загальні фрази без назви конкретного API, поля, опції, файла або команди з джерела.
- DEV_TAGS мають належати технології джерела. Cloudflare-новина не може отримати Shopify/theme/POS теги; Vue/Nuxt-реліз не може отримати Shopify теги; Shopify-новина не може отримати Cloudflare теги без прямої згадки.
- Не вигадуй ризик. Для нової необов’язкової можливості RISK має бути 1-3, RECOMMENDATION «лише знати».
- Якщо заголовок чи стаття не містять практичної інформації для аудиторії — RELEVANCE 1-4, PRIORITY P2, TODAY_ACTION «дія не потрібна; зберегти як довідку».
- Не використовуй загальні фрази «перевірити інтеграції» або «ознайомитися з документацією» без конкретизації.
- Пояснюй причинно-наслідково: було обмеження або проблема → з’явилася можливість → практичний результат.
- Не повторюй один зміст у Суть, AI_CONCLUSION і Чому важливо: кожен блок має додавати нову інформацію.
- Якщо це нова фіча без обов’язкової дії, поясни корисний сценарій замість штучного ризику.
- Не пиши “додати до DevKit”.
- Не пиши “Frontend Intelligence Radar може...”.
- Не додавай зверху "📖 9/10" або будь-який score, окрім RELEVANCE.
- Якщо update не релевантний для frontend/Vue/Nuxt/Shopify роботи — PRIORITY: P2 і RELEVANCE нижче 6.
- PRIORITY P0 дозволено лише коли джерело прямо містить security advisory/CVE, breaking change, deprecation/removal, Action Required або mandatory migration. Слово required у звичайному описі не є підставою для P0.
- Не додавай breaking, migration, security чи deprecation в IMPACT_TAGS без прямої фрази-підтвердження у джерелі.
- Якщо корисно для клієнтських аудитів або майбутніх задач — PRIORITY: P1.
- Якщо update про POS/Partner Dashboard/Payments і не має явної користі для theme/front-end/API роботи — RELEVANCE 3-5.

Update:
Source: ${item.source}
Title: ${item.title}
URL: ${item.url}
Tags: ${(item.tags || []).join(", ") || "none"}
Summary: ${item.summary || "No summary"}
Published at: ${item.publishedAt || "unknown"}
Context source: ${item.contextSource || "rss"}

Verified fact extraction:
${factAnalysis || "No separate fact analysis available."}

Full official article context:
${item.articleContext || "Full article unavailable. Do not invent missing details."}
`.trim();

  return requestAiCompletionWithFallback(env, {
    model,
    temperature: 0.2,
    maxTokens: 1800,
    system:
            "You are a precise senior frontend engineering news analyst with Vue, Nuxt, Shopify, JavaScript, TypeScript, CSS, Tailwind, Node.js, and Cloudflare expertise. Output Ukrainian only. Return only the requested structured format. Focus on practical production usage.",
    prompt,
  });
}

async function callAiText(env, options) {
  const baseUrl = normalizeBaseUrl(env.AI_BASE_URL);
  const model = String(env.AI_MODEL || "").trim();

  if (!baseUrl) throw new Error("Missing AI_BASE_URL");
  if (!model) throw new Error("Missing AI_MODEL");
  if (!env.AI_API_KEY) throw new Error("Missing AI_API_KEY");

  return requestAiCompletionWithFallback(env, { ...options, model });
}

async function requestAiCompletionWithFallback(env, options, dependencies = {}) {
  const models = normalizeList([
    options.model || env.AI_MODEL,
    ...String(env.AI_FALLBACK_MODELS || "").split(","),
  ]).filter(Boolean);
  let lastError;

  for (const model of models) {
    try {
      return await requestAiCompletion(env, { ...options, model }, {
        ...dependencies,
        maxRetries: dependencies.maxRetries ?? 1,
      });
    } catch (error) {
      lastError = error;
      if (!/status (404|429|500|502|503|504)|тимчасово недоступний/i.test(String(error?.message || error))) throw error;
      console.warn("AI model fallback:", { model, error: safeErrorMessage(error) });
    }
  }

  throw lastError || new Error("No AI model is available");
}

async function requestAiCompletion(env, options, dependencies = {}) {
  const baseUrl = normalizeBaseUrl(env.AI_BASE_URL);
  const fetchImpl = dependencies.fetchImpl || fetch;
  const sleepImpl = dependencies.sleepImpl || delay;
  const model = String(options.model || env.AI_MODEL || "").trim();
  const maxRetries = clampNumber(dependencies.maxRetries ?? AI_MAX_RETRIES, 0, 5);

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const response = await fetchImpl(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.AI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: options.temperature ?? 0.1,
        max_tokens: options.maxTokens ?? 900,
        messages: [
          { role: "system", content: options.system },
          { role: "user", content: options.prompt },
        ],
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const content =
        data?.choices?.[0]?.message?.content ||
        data?.choices?.[0]?.text ||
        data?.output_text ||
        data?.response ||
        "";

      if (!String(content).trim()) throw new Error("AI returned empty response");
      return String(content).trim();
    }

    const retryable = AI_RETRYABLE_STATUSES.has(response.status);
    const retryAfterSeconds = Number(response.headers.get("retry-after") || 0);
    await response.body?.cancel();

    if (!retryable || attempt === maxRetries) {
      if (retryable) {
        throw new Error(`Gemini тимчасово недоступний після ${attempt + 1} спроб (status ${response.status})`);
      }
      throw new Error(`AI request failed with status ${response.status}`);
    }

    const exponentialDelay = AI_RETRY_BASE_DELAY_MS * 2 ** attempt;
    const retryAfterDelay = Number.isFinite(retryAfterSeconds) ? retryAfterSeconds * 1000 : 0;
    await sleepImpl(Math.min(Math.max(exponentialDelay, retryAfterDelay), 10000));
  }

  throw new Error("Gemini тимчасово недоступний");
}

function parseAiStructured(text, item) {
  const raw = String(text || "").trim();

  const uaTitle = cleanStructuredText(extractMetaField(raw, "UA_TITLE"));
  const priority = normalizePriority(extractMetaField(raw, "PRIORITY"));
  const relevance = normalizeRelevance(extractMetaField(raw, "RELEVANCE"));
  const area = cleanStructuredText(extractMetaField(raw, "AREA")).slice(0, 60) || inferArea(item);
  const devTags = parseDevTags(extractMetaField(raw, "DEV_TAGS"));
  const impactTags = parseDevTags(extractMetaField(raw, "IMPACT_TAGS"));
  const clientTask = cleanStructuredText(extractMetaField(raw, "CLIENT_TASK"));
  const benefit = normalizeScore(extractMetaField(raw, "BENEFIT"), 5);
  const risk = normalizeScore(extractMetaField(raw, "RISK"), priority === "P0" ? 9 : 4);
  const effort = normalizeScore(extractMetaField(raw, "EFFORT"), 5);
  const confidence = normalizeScore(extractMetaField(raw, "CONFIDENCE"), 5);
  const recommendation = cleanStructuredText(extractMetaField(raw, "RECOMMENDATION"));
  const hiddenInsight = cleanStructuredText(extractMetaField(raw, "HIDDEN_INSIGHT"));
  const notFor = cleanStructuredText(extractMetaField(raw, "NOT_FOR"));
  const clientOpportunity = cleanStructuredText(extractMetaField(raw, "CLIENT_OPPORTUNITY"));
  const urgency = cleanStructuredText(extractMetaField(raw, "URGENCY"));
  const audience = cleanStructuredText(extractMetaField(raw, "AUDIENCE"));
  const verifiedFacts = parseInlineList(extractMetaField(raw, "VERIFIED_FACTS"));
  const aiConclusion = cleanStructuredText(extractMetaField(raw, "AI_CONCLUSION"));
  const assumptions = parseInlineList(extractMetaField(raw, "ASSUMPTIONS"))
    .filter((value) => !/^немає$/i.test(value));
  const before = cleanStructuredText(extractMetaField(raw, "BEFORE"));
  const after = cleanStructuredText(extractMetaField(raw, "AFTER"));
  const expectedResult = cleanStructuredText(extractMetaField(raw, "EXPECTED_RESULT"));
  const timeEstimate = cleanStructuredText(extractMetaField(raw, "TIME_ESTIMATE"));
  const todayAction = cleanStructuredText(extractMetaField(raw, "TODAY_ACTION"));

  const essence = extractSection(
    raw,
    ["🧠 Суть:", "🧠 Суть", "Суть:", "🧠"],
    [
      "🎯 Чому важливо:",
      "🎯 Чому важливо",
      "Чому важливо:",
      "🎯",
      "🛠 Як застосувати:",
      "🛠 Як застосувати",
      "Як застосувати:",
      "🛠",
      "✅ Що перевірити:",
      "✅ Що перевірити",
      "Що перевірити:",
      "✅",
      "💡 Ідея для розробника:",
      "💡 Ідея:",
      "💡",
    ]
  );

  const importance = extractSection(
    raw,
    ["🎯 Чому важливо:", "🎯 Чому важливо", "Чому важливо:", "🎯"],
    [
      "🛠 Як застосувати:",
      "🛠 Як застосувати",
      "Як застосувати:",
      "🛠",
      "✅ Що перевірити:",
      "✅ Що перевірити",
      "Що перевірити:",
      "✅",
      "💡 Ідея для розробника:",
      "💡 Ідея:",
      "💡",
    ]
  );

  const applicationText = extractSection(
    raw,
    ["🛠 Як застосувати:", "🛠 Як застосувати", "Як застосувати:", "🛠"],
    [
      "✅ Що перевірити:",
      "✅ Що перевірити",
      "Що перевірити:",
      "✅",
      "💡 Ідея для розробника:",
      "💡 Ідея:",
      "💡",
    ]
  );

  const checklistText = extractSection(
    raw,
    ["✅ Що перевірити:", "✅ Що перевірити", "Що перевірити:", "✅"],
    [
      "💡 Ідея для розробника:",
      "💡 Ідея:",
      "💡 Ідея",
      "Ідея для розробника:",
      "Ідея:",
      "💡",
    ]
  );

  const devIdea = extractSection(
    raw,
    [
      "💡 Ідея для розробника:",
      "💡 Ідея для розробника",
      "Ідея для розробника:",
      "💡 Ідея:",
      "💡 Ідея",
      "Ідея:",
      "💡",
    ],
    []
  );

  return normalizeStructuredSummary(
    {
      uaTitle,
      priority,
      relevance,
      area,
      devTags,
      impactTags,
      clientTask,
      benefit,
      risk,
      effort,
      confidence,
      recommendation,
      hiddenInsight,
      notFor,
      clientOpportunity,
      urgency,
      audience,
      verifiedFacts,
      aiConclusion,
      assumptions,
      before,
      after,
      expectedResult,
      timeEstimate,
      todayAction,
      essence,
      importance,
      applicationItems: parseBulletItems(applicationText),
      checklistItems: parseBulletItems(checklistText),
      devIdea,
    },
    item
  );
}

function normalizeStructuredSummary(summary, item) {
  const fallbackTitle = createFallbackUaTitle(item);
  const evidencePriority = inferPriority(item);
  const requestedPriority = normalizePriority(summary.priority);
  const priority = PRIORITY_RANK[requestedPriority] < PRIORITY_RANK[evidencePriority]
    ? evidencePriority
    : requestedPriority;
  const area = cleanStructuredText(summary.area || inferArea(item)).slice(0, 60) || "Shopify Dev";
  const relevance = normalizeRelevance(summary.relevance || inferRelevance(item, priority));
  const inferredTags = inferDevTags(item, area);
  const inferredImpactTags = inferImpactTags(item, priority, area);

  const normalized = {
    uaTitle: cleanStructuredText(summary.uaTitle || fallbackTitle).slice(0, 120) || fallbackTitle,
    priority,
    relevance,
    area,
    devTags: constrainDevTagsToSource(
      normalizeTags([...(summary.devTags || []), ...inferredTags]),
      item,
      area
    ).slice(0, 8),
    impactTags: constrainImpactTagsToEvidence(
      normalizeTags([...(summary.impactTags || []), ...inferredImpactTags]),
      item
    ).slice(0, 8),
    clientTask: cleanStructuredText(summary.clientTask || buildClientTask({ ...item, priority, area })).slice(0, 500),
    benefit: normalizeScore(summary.benefit, Math.max(3, relevance - 1)),
    risk: Math.min(
      normalizeScore(summary.risk, priority === "P0" ? 9 : priority === "P1" ? 6 : 3),
      priority === "P0" ? 10 : priority === "P1" ? 7 : 4
    ),
    effort: normalizeScore(summary.effort, 5),
    confidence: normalizeScore(summary.confidence, item.articleContext ? 8 : 5),
    recommendation: inferRecommendation(priority, relevance),
    hiddenInsight: cleanStructuredText(summary.hiddenInsight || "Перевір повний контекст джерела перед рішенням про впровадження.").slice(0, 500),
    notFor: cleanStructuredText(summary.notFor || "Проєкти, яких не стосується зазначена Shopify-поверхня.").slice(0, 400),
    clientOpportunity: cleanStructuredText(summary.clientOpportunity || summary.clientTask || buildClientTask({ ...item, priority, area })).slice(0, 500),
    urgency: inferUrgency(priority, relevance),
    audience: cleanStructuredText(summary.audience || inferAudience(area)).slice(0, 400),
    verifiedFacts: sanitizeVerifiedFacts(summary.verifiedFacts || [item.summary]).slice(0, 4),
    aiConclusion: cleanStructuredText(summary.aiConclusion || summary.importance || summary.essence).slice(0, 500),
    assumptions: normalizeList(summary.assumptions || []).slice(0, 3),
    before: cleanStructuredText(summary.before || "Не підтверджено в джерелі.").slice(0, 400),
    after: cleanStructuredText(summary.after || summary.essence).slice(0, 400),
    expectedResult: cleanStructuredText(summary.expectedResult || buildExpectedResult(area)).slice(0, 400),
    timeEstimate: cleanStructuredText(summary.timeEstimate || "Потребує оцінки після перевірки проєкту.").slice(0, 160),
    todayAction: cleanStructuredText(summary.todayAction || summary.clientTask || buildClientTask({ ...item, priority, area })).slice(0, 400),
    essence: cleanStructuredText(summary.essence).slice(0, 500),
    importance: cleanStructuredText(summary.importance).slice(0, 500),
    applicationItems: normalizeList(summary.applicationItems).slice(0, 5),
    checklistItems: normalizeList(summary.checklistItems).slice(0, 5),
    devIdea: cleanStructuredText(summary.devIdea).slice(0, 500),
  };

  normalized.qualityScore = calculateQualityScore(normalized, { usedFallback: Boolean(summary.usedFallback) });

  return normalized;
}

function isStructuredSummaryUseful(summary) {
  if (!summary) return false;

  const values = [summary.uaTitle, summary.essence, summary.importance, summary.devIdea, summary.clientTask]
    .map((value) => String(value || "").trim())
    .join("\n");

  if (summary.uaTitle.length < 8) return false;
  if (summary.essence.length < 15) return false;
  if (summary.importance.length < 15) return false;
  if (!Array.isArray(summary.applicationItems) || !summary.applicationItems.length) return false;
  if (!Array.isArray(summary.checklistItems) || !summary.checklistItems.length) return false;
  if (summary.devIdea.length < 10) return false;
  if (!Array.isArray(summary.verifiedFacts) || summary.verifiedFacts.length < 2) return false;
  if (String(summary.audience || "").length < 15) return false;
  if (String(summary.aiConclusion || "").length < 20) return false;
  if (String(summary.expectedResult || "").length < 15) return false;
  if (String(summary.todayAction || "").length < 15) return false;
  if (hasContaminatedContent(summary)) return false;

  const genericPatterns = [
    /Короткий опис відсутній/i,
    /Відкрий джерело для деталей/i,
    /Це нова Shopify-зміна, яку варто перевірити/i,
    /Навіть без AI-розбору цю зміну варто оцінити/i,
    /AI не повернув відповідь/i,
    /No summary/i,
    /перевірити інтеграції$/i,
    /ознайомитися з документацією$/i,
  ];

  if (genericPatterns.some((pattern) => pattern.test(values))) return false;
  if (looksMostlyEnglish(summary.uaTitle) && !hasCyrillic(summary.uaTitle)) return false;
  if (looksMostlyEnglish(summary.essence) && summary.essence.length > 120) return false;
  if (summary.essence.length > 650) return false;
  if (Number(summary.qualityScore || 0) < MIN_PUBLISH_QUALITY) return false;

  return true;
}

function createFallbackStructuredSummary(item, reason = "") {
  const priority = inferPriority(item);
  const area = inferArea(item);
  const relevance = inferRelevance(item, priority);
  const title = createFallbackUaTitle(item);
  const tags = inferDevTags(item, area);
  const impactTags = inferImpactTags(item, priority, area);
  const verifiedFacts = extractEvidenceFacts(item);
  const sourceName = cleanStructuredText(item.source || "Офіційне джерело");
  const firstFact = verifiedFacts[0] || cleanStructuredText(item.summary || item.title);

  return normalizeStructuredSummary(
    {
      uaTitle: title,
      priority,
      relevance,
      area,
      devTags: tags,
      impactTags,
      clientTask: buildClientTask({ ...item, priority, area }),
      benefit: Math.max(3, relevance - 1),
      risk: priority === "P0" ? 9 : priority === "P1" ? 6 : 3,
      effort: 5,
      confidence: item.articleContext ? 7 : 4,
      recommendation: inferRecommendation(priority, relevance),
      hiddenInsight: "Додаткові наслідки не підтверджені джерелом і потребують перевірки в конкретному проєкті.",
      notFor: buildNotFor(area),
      clientOpportunity: buildClientTask({ ...item, priority, area }),
      verifiedFacts,
      aiConclusion: `Без AI-інтерпретації: ${firstFact}`,
      assumptions: [],
      before: "Джерело не описує попередню поведінку.",
      after: firstFact,
      expectedResult: buildExpectedResult(area),
      timeEstimate: "Потребує оцінки після перевірки застосовності.",
      todayAction: buildClientTask({ ...item, priority, area }),
      essence: `${sourceName}: ${firstFact}`,
      importance: "Рівень впливу не встановлено без завершеного аналізу; не вважати production-ризиком автоматично.",
      applicationItems: buildFallbackApplicationItems(item, area),
      checklistItems: buildFallbackChecklistItems(item, area),
      devIdea: `Перевір застосовність зміни до ${area} перед створенням задачі.`,
      usedFallback: true,
    },
    item
  );
}

function extractEvidenceFacts(item) {
  const text = cleanStructuredText(item.articleContext || cleanHtml(item.summary || ""));
  const facts = text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => cleanStructuredText(sentence).slice(0, 260))
    .filter((sentence) => sentence.length >= 25)
    .slice(0, 3);

  if (facts.length < 2 && item.title) {
    facts.push(`Офіційний заголовок: ${cleanStructuredText(item.title).slice(0, 180)}`);
  }

  return normalizeList(facts).slice(0, 3);
}

function buildNotFor(area) {
  const value = String(area || "").toLowerCase();
  if (/vue|pinia/.test(value)) return "Проєкти без Vue або Pinia.";
  if (/nuxt/.test(value)) return "Проєкти без Nuxt, SSR або Nitro.";
  if (/vite|typescript|javascript|node/.test(value)) return "Проєкти, що не використовують відповідний runtime або toolchain.";
  if (/css|tailwind|ui/.test(value)) return "Проєкти без відповідного CSS/UI stack.";
  if (/cloudflare/.test(value)) return "Команди, що не використовують згадану Cloudflare-функцію.";
  if (/shopify|theme|liquid|api|checkout/.test(value)) return "Проєкти без відповідної Shopify-поверхні або інтеграції.";
  return "Проєкти, що не використовують описану технологію або можливість.";
}

function constrainImpactTagsToEvidence(tags, item) {
  const text = buildSearchText(item);
  const allowed = new Set(tags || []);

  if (!/security advisory|security release|vulnerab|\bcve-?\d*/i.test(text)) allowed.delete("security");
  if (!/breaking change/i.test(text)) allowed.delete("breaking");
  if (!/migration required|mandatory migration/i.test(text)) allowed.delete("migration");
  if (!/deprecat|removal notice|sunset|no longer supported/i.test(text)) allowed.delete("deprecation");
  if (item.sourceId !== "shopify" || !/theme|liquid|section|online store/i.test(text)) allowed.delete("theme-risk");
  if (item.sourceId !== "shopify" || !/\bpos\b|point of sale/i.test(text)) allowed.delete("pos-risk");
  if (item.sourceId !== "shopify" || !/checkout|payment|shipping|cart transform/i.test(text)) allowed.delete("checkout-risk");
  if (!/performance|speed|latency|lcp|cls|core web vitals|bundle|asset/i.test(text)) allowed.delete("performance-opportunity");

  return [...allowed];
}

function constrainDevTagsToSource(tags, item, area) {
  const sourceId = String(item?.sourceId || "").toLowerCase();
  const base = new Set(normalizeTags(item?.tags || []));
  const families = {
    shopify: ["shopify", "shopify-dev", "liquid", "themes", "sections", "admin-api", "storefront-api", "graphql", "checkout", "functions", "markets", "metafields", "webhooks", "app-dev", "pos", "hydrogen", "ui", "javascript", "typescript"],
    vue: ["vue", "javascript", "typescript", "ui", "a11y", "reactivity"],
    nuxt: ["nuxt", "vue", "ssr", "nitro", "javascript", "typescript", "performance"],
    pinia: ["pinia", "vue", "state-management", "javascript", "typescript"],
    vite: ["vite", "javascript", "typescript", "build-tools", "performance"],
    tailwind: ["tailwind", "css", "ui", "a11y"],
    typescript: ["typescript", "javascript", "build-tools"],
    sass: ["sass", "scss", "css", "ui"],
    node: ["node", "javascript", "typescript", "runtime", "performance", "security"],
    mdn: ["javascript", "css", "web-platform", "ui", "a11y", "browser-api", "performance"],
    cloudflare: ["cloudflare", "workers", "edge", "workerd", "durable-objects", "kv", "d1", "r2", "queues", "javascript", "typescript", "performance", "security"],
  };
  const allowed = new Set([...(families[sourceId] || []), ...base]);
  const areaTag = normalizeTags([area])[0];
  if (areaTag) allowed.add(areaTag);
  return normalizeTags(tags).filter((tag) => allowed.has(tag));
}

function sanitizeVerifiedFacts(facts) {
  return normalizeList(facts).filter((fact) => !isContaminatedText(fact));
}

function isContaminatedText(value) {
  return /you signed (?:in|out)|reload to refresh|dismiss alert|skip to content|github navigation|cookie preferences|content loading/i.test(String(value || ""));
}

function hasContaminatedContent(summary) {
  return [
    summary?.uaTitle,
    summary?.essence,
    summary?.importance,
    summary?.aiConclusion,
    ...(summary?.verifiedFacts || []),
  ].some(isContaminatedText);
}

function buildFallbackApplicationItems(item, area) {
  const normalizedArea = String(area || "").toLowerCase();

  if (/vue|pinia/.test(normalizedArea)) {
    return ["Звірити заторкнуті Vue API та компоненти.", "Запустити unit/component tests для reactivity і stores.", "Перевірити migration notes перед оновленням залежності."];
  }

  if (/nuxt/.test(normalizedArea)) {
    return ["Звірити Nuxt/Nitro версію і migration notes.", "Перевірити SSR, hydration та data fetching у production build.", "Запустити smoke tests server routes і ключових сторінок."];
  }

  if (/vite|typescript|javascript|node/.test(normalizedArea)) {
    return ["Звірити версії runtime і build toolchain.", "Запустити typecheck, build та automated tests.", "Перевірити release notes на несумісні зміни конфігурації."];
  }

  if (/css|tailwind|ui/.test(normalizedArea)) {
    return ["Звірити CSS/Tailwind pipeline і browser support.", "Запустити visual regression ключових компонентів.", "Перевірити responsive states та accessibility."];
  }

  if (/cloudflare/.test(normalizedArea)) {
    return ["Звірити, чи використовується змінена Cloudflare-функція.", "Перевірити Worker bindings, compatibility date і local runtime.", "Запустити staging deploy та перевірити edge logs."];
  }

  if (/admin api|storefront api|api/.test(normalizedArea)) {
    return [
      "Перевірити GraphQL/Admin API запити, мутації, scopes і версію API в інтеграціях.",
      "Оцінити, чи є вплив на автоматизації, webhooks, bulk operations або бекенд-скрипти.",
      "Додати пункт у dev-аудит клієнтського магазину перед оновленням API-версії.",
    ];
  }

  if (/themes|теми|liquid/.test(normalizedArea)) {
    return [
      "Перевірити theme code: Liquid, sections, snippets, app blocks і кастомні scripts.",
      "Оцінити, чи можна використати зміну для покращення UX, CRO або підтримки теми.",
      "Додати перевірку в чеклист перед релізом theme update.",
    ];
  }

  if (/checkout/.test(normalizedArea)) {
    return [
      "Перевірити checkout customization, Functions, payment/shipping логіку і Shopify Plus сценарії.",
      "Оцінити ризик для клієнтських checkout flow, Markets або payment integrations.",
      "Додати тестовий сценарій у QA перед релізом змін.",
    ];
  }

  if (/performance|швидкість|seo/.test(normalizedArea)) {
    return [
      "Перевірити вплив на швидкість, SEO, assets, app scripts або Core Web Vitals.",
      "Додати зміну в технічний аудит сторінок PDP, collection і homepage.",
      "Оцінити, чи можна використати це як покращення для клієнтського беклогу.",
    ];
  }

  return [
    "Визначити, які модулі або проєкти використовують змінену можливість.",
    "Звірити точні умови й обмеження в офіційному джерелі.",
    "Додати задачу лише після підтвердження практичного впливу.",
  ];
}

function buildFallbackChecklistItems(item, area) {
  const normalizedArea = String(area || "").toLowerCase();

  if (/vue|pinia/.test(normalizedArea)) return ["Vue/Pinia version", "Заторкнуті components, composables і stores", "Unit та component regression"];
  if (/nuxt/.test(normalizedArea)) return ["Nuxt/Nitro version", "SSR, hydration і data fetching", "Production build та server routes"];
  if (/vite|typescript|javascript|node/.test(normalizedArea)) return ["Runtime і dependency versions", "Typecheck, build і tests", "Config та plugin compatibility"];
  if (/css|tailwind|ui/.test(normalizedArea)) return ["CSS/Tailwind build", "Responsive visual regression", "Accessibility і browser support"];
  if (/cloudflare/.test(normalizedArea)) return ["Worker/runtime applicability", "Bindings і compatibility date", "Staging deploy та edge logs"];

  if (/admin api|storefront api|api/.test(normalizedArea)) {
    return [
      "API version і deprecated поля",
      "GraphQL mutations/queries та scopes",
      "Webhooks, integrations, scripts і automation jobs",
    ];
  }

  if (/themes|теми|liquid/.test(normalizedArea)) {
    return [
      "Liquid templates, sections і snippets",
      "Theme app extensions або app blocks",
      "JS/CSS, UX states і regression на ключових сторінках",
    ];
  }

  if (/checkout/.test(normalizedArea)) {
    return [
      "Checkout flow і Shopify Plus customizations",
      "Functions, payment/shipping rules і Markets",
      "QA сценарії для test order та edge cases",
    ];
  }

  return [
    "Точні факти офіційного джерела",
    "Версії та модулі, яких стосується зміна",
    "Підтверджені breaking, deprecation або migration notes",
  ];
}

function buildEnrichedItem(item, structuredSummary, meta = {}) {
  const normalized = normalizeStructuredSummary(
    {
      ...structuredSummary,
      usedFallback: meta.usedFallback,
    },
    item
  );

  return {
    ...item,
    itemId: meta.itemId || item.itemId || "",
    uaTitle: normalized.uaTitle,
    priority: normalized.priority,
    relevance: normalized.relevance,
    area: normalized.area,
    devTags: normalized.devTags,
    impactTags: normalized.impactTags,
    clientTask: normalized.clientTask,
    benefit: normalized.benefit,
    risk: normalized.risk,
    effort: normalized.effort,
    confidence: normalized.confidence,
    recommendation: normalized.recommendation,
    hiddenInsight: normalized.hiddenInsight,
    notFor: normalized.notFor,
    clientOpportunity: normalized.clientOpportunity,
    urgency: normalized.urgency,
    audience: normalized.audience,
    verifiedFacts: normalized.verifiedFacts,
    aiConclusion: normalized.aiConclusion,
    assumptions: normalized.assumptions,
    before: normalized.before,
    after: normalized.after,
    expectedResult: normalized.expectedResult,
    timeEstimate: normalized.timeEstimate,
    todayAction: normalized.todayAction,
    qualityScore: normalized.qualityScore,
    essence: normalized.essence,
    importance: normalized.importance,
    applicationItems: normalized.applicationItems,
    checklistItems: normalized.checklistItems,
    devIdea: normalized.devIdea,
    usedFallback: Boolean(meta.usedFallback),
    fallbackReason: meta.fallbackReason || null,
    rawAiSummary: meta.rawAiSummary || null,
    savedAt: new Date().toISOString(),
  };
}

function shouldSendImmediate(item) {
  if (item.priority === "P0") return true;
  const relevance = Number(item.relevance || 0);
  const benefit = normalizeScore(item.benefit, 5);
  const risk = normalizeScore(item.risk, 4);
  const confidence = normalizeScore(item.confidence, 5);

  if (item.priority === "P1") {
    return confidence >= 6 && ((relevance >= MIN_IMMEDIATE_RELEVANCE && benefit >= 6) || risk >= 7);
  }

  return relevance >= 9 && benefit >= 8 && confidence >= 7;
}

function shouldDeliverToSubscriber(item, subscriber, options = {}) {
  if (options.digest) return true;

  const preferences = normalizePreferences(subscriber?.preferences);

  if (preferences.digestOnly) return false;

  const itemPriorityRank = PRIORITY_RANK[item.priority || "P2"] ?? 2;
  const minPriorityRank = PRIORITY_RANK[preferences.minPriority || "P1"] ?? 1;

  if (itemPriorityRank > minPriorityRank) return false;

  if (!preferences.topics.length) return true;

  const haystack = [
    item.area || "",
    item.uaTitle || "",
    item.title || "",
    ...(item.devTags || []),
    ...(item.impactTags || []),
  ]
    .join(" ")
    .toLowerCase();

  return preferences.topics.some((topic) => haystack.includes(topic.toLowerCase()));
}

async function saveLatestItem(item, env) {
  const id = await createItemId(item);
  await env.SHOPIFY_RADAR_KV.put(
    `${LATEST_ITEM_KEY_PREFIX}${id}`,
    JSON.stringify(serializeStoredItem(item)),
    { expirationTtl: SEEN_TTL_SECONDS }
  );
}

async function indexFreshFeedItems(items, env) {
  for (let index = 0; index < items.length; index += 10) {
    const batch = items.slice(index, index + 10);
    await Promise.all(
      batch.map(async (item) => {
        const id = await createItemId(item);
        const key = `${LATEST_ITEM_KEY_PREFIX}${id}`;
        if (await env.SHOPIFY_RADAR_KV.get(key)) return;

        const fallbackReason = "Pending AI enrichment";
        const structured = createFallbackStructuredSummary(item, fallbackReason);
        const indexedItem = {
          ...buildEnrichedItem(item, structured, {
            itemId: id,
            usedFallback: true,
            fallbackReason,
          }),
          pendingEnrichment: true,
        };
        await Promise.all([saveLatestItem(indexedItem, env), saveDigestItem(indexedItem, env)]);
      })
    );
  }
}

async function saveDigestItem(item, env) {
  const id = await createItemId(item);
  await env.SHOPIFY_RADAR_KV.put(
    `${DIGEST_ITEM_KEY_PREFIX}${id}`,
    JSON.stringify(serializeStoredItem(item)),
    { expirationTtl: SEEN_TTL_SECONDS }
  );
}

async function getLatestItems(env) {
  return filterFreshFeedItems(
    await readStoredItems(env, LATEST_ITEM_KEY_PREFIX, LATEST_ITEMS_KEY, LATEST_ITEMS_LIMIT)
  ).filter(isPublishableItem);
}

async function getDigestItems(env) {
  return filterFreshFeedItems(
    await readStoredItems(env, DIGEST_ITEM_KEY_PREFIX, DIGEST_ITEMS_KEY, DIGEST_ITEMS_LIMIT)
  ).filter(isPublishableItem);
}

function isPublishableItem(item) {
  return Boolean(
    item &&
    !item.pendingEnrichment &&
    !item.usedFallback &&
    Number(item.qualityScore || 0) >= MIN_PUBLISH_QUALITY &&
    Array.isArray(item.verifiedFacts) &&
    item.verifiedFacts.length >= 2 &&
    !hasContaminatedContent(item)
  );
}

async function readStoredItems(env, prefix, _legacyKey, limit) {
  const individualItems = await readJsonObjectsByPrefix(env, prefix, limit * 2);
  const itemsByUrl = new Map();

  for (const item of individualItems) {
    if (item?.url) itemsByUrl.set(item.url, item);
  }

  return sortItemsByDateDesc([...itemsByUrl.values()]).slice(0, limit);
}

async function readJsonObjectsByPrefix(env, prefix, limit) {
  const items = [];
  let cursor;

  do {
    const page = await env.SHOPIFY_RADAR_KV.list({ prefix, cursor, limit: 1000 });
    const values = await Promise.all(
      page.keys.slice(0, Math.max(0, limit - items.length)).map(async ({ name }) => {
        try {
          const raw = await env.SHOPIFY_RADAR_KV.get(name);
          return raw ? JSON.parse(raw) : null;
        } catch {
          return null;
        }
      })
    );

    items.push(...values.filter(Boolean));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor && items.length < limit);

  return items.slice(0, limit);
}

async function readJsonArray(env, key) {
  try {
    const raw = await env.SHOPIFY_RADAR_KV.get(key);
    const parsed = raw ? JSON.parse(raw) : [];

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function serializeStoredItem(item) {
  const normalized = normalizeStoredStructuredItem(item);

  return {
    itemId: normalized.itemId || "",
    title: normalized.title,
    uaTitle: normalized.uaTitle,
    url: normalized.url,
    source: normalized.source,
    sourceId: normalized.sourceId || "",
    summary: normalized.summary || "",
    publishedAt: normalized.publishedAt || null,
    tags: Array.isArray(normalized.tags) ? normalized.tags : [],
    priority: normalized.priority,
    relevance: Number(normalized.relevance || 0),
    area: normalized.area,
    devTags: Array.isArray(normalized.devTags) ? normalized.devTags : [],
    impactTags: Array.isArray(normalized.impactTags) ? normalized.impactTags : [],
    clientTask: normalized.clientTask || "",
    benefit: normalizeScore(normalized.benefit, 5),
    risk: normalizeScore(normalized.risk, 4),
    effort: normalizeScore(normalized.effort, 5),
    confidence: normalizeScore(normalized.confidence, 5),
    recommendation: normalized.recommendation || "",
    hiddenInsight: normalized.hiddenInsight || "",
    notFor: normalized.notFor || "",
    clientOpportunity: normalized.clientOpportunity || normalized.clientTask || "",
    urgency: normalized.urgency || "",
    audience: normalized.audience || "",
    verifiedFacts: Array.isArray(normalized.verifiedFacts) ? normalized.verifiedFacts : [],
    aiConclusion: normalized.aiConclusion || "",
    assumptions: Array.isArray(normalized.assumptions) ? normalized.assumptions : [],
    before: normalized.before || "",
    after: normalized.after || "",
    expectedResult: normalized.expectedResult || "",
    timeEstimate: normalized.timeEstimate || "",
    todayAction: normalized.todayAction || "",
    contextSource: normalized.contextSource || "rss",
    qualityScore: Number(normalized.qualityScore || 0),
    essence: normalized.essence,
    importance: normalized.importance,
    applicationItems: Array.isArray(normalized.applicationItems) ? normalized.applicationItems : [],
    checklistItems: Array.isArray(normalized.checklistItems) ? normalized.checklistItems : [],
    devIdea: normalized.devIdea,
    usedFallback: Boolean(normalized.usedFallback),
    fallbackReason: normalized.fallbackReason || null,
    pendingEnrichment: Boolean(normalized.pendingEnrichment),
    savedAt: normalized.savedAt || new Date().toISOString(),
  };
}

function normalizeStoredStructuredItem(item) {
  if (hasStructuredFields(item)) {
    const normalizedArea = cleanStructuredText(item.area || inferArea(item));
    const normalized = {
      ...item,
      priority: normalizePriority(item.priority),
      relevance: normalizeRelevance(item.relevance),
      area: normalizedArea,
      devTags: constrainDevTagsToSource(item.devTags || inferDevTags(item, normalizedArea), item, normalizedArea),
      impactTags: constrainImpactTagsToEvidence(
        normalizeTags(item.impactTags || inferImpactTags(item, item.priority, normalizedArea)),
        item
      ),
      clientTask: cleanStructuredText(item.clientTask || buildClientTask(item)),
      benefit: normalizeScore(item.benefit, Math.max(3, Number(item.relevance || 5) - 1)),
      risk: normalizeScore(item.risk, item.priority === "P0" ? 9 : 4),
      effort: normalizeScore(item.effort, 5),
      confidence: normalizeScore(item.confidence, 5),
      recommendation: cleanStructuredText(item.recommendation || inferRecommendation(item.priority, item.relevance)),
      hiddenInsight: cleanStructuredText(item.hiddenInsight || "Перевір повний контекст джерела перед впровадженням."),
      notFor: cleanStructuredText(item.notFor || "Проєкти поза зазначеною Shopify-поверхнею."),
      clientOpportunity: cleanStructuredText(item.clientOpportunity || item.clientTask || buildClientTask(item)),
      urgency: cleanStructuredText(item.urgency || inferUrgency(item.priority, item.relevance)),
      audience: cleanStructuredText(item.audience || inferAudience(item.area)),
      verifiedFacts: sanitizeVerifiedFacts(item.verifiedFacts || [item.summary]).slice(0, 4),
      aiConclusion: cleanStructuredText(item.aiConclusion || item.importance || item.essence),
      assumptions: normalizeList(item.assumptions || []).slice(0, 3),
      before: cleanStructuredText(item.before || "Не підтверджено в джерелі."),
      after: cleanStructuredText(item.after || item.essence),
      expectedResult: cleanStructuredText(item.expectedResult || buildExpectedResult(item.area)),
      timeEstimate: cleanStructuredText(item.timeEstimate || "Потребує оцінки після перевірки проєкту."),
      todayAction: cleanStructuredText(item.todayAction || item.clientTask || buildClientTask(item)),
      applicationItems: normalizeList(item.applicationItems || []),
      checklistItems: normalizeList(item.checklistItems || []),
    };

    normalized.qualityScore = Number.isFinite(Number(item.qualityScore))
      ? Number(item.qualityScore)
      : calculateQualityScore(normalized, { usedFallback: Boolean(item.usedFallback) });

    return normalized;
  }

  const fallback = createFallbackStructuredSummary(item || {}, "Stored item has no structured fields");

  return {
    ...item,
    ...fallback,
    usedFallback: item?.usedFallback ?? true,
    fallbackReason: item?.fallbackReason || "Stored item has no structured fields",
  };
}

function matchesDevTags(item, tags) {
  const normalized = normalizeStoredStructuredItem(item);
  const itemTags = [
    ...(normalized.devTags || []),
    ...(normalized.impactTags || []),
    normalized.area || "",
    normalized.title || "",
    normalized.uaTitle || "",
  ]
    .join(" ")
    .toLowerCase();

  return tags.some((tag) => itemTags.includes(tag.toLowerCase()));
}

function formatTelegramMessage(item) {
  return formatStoredFullItem(item);
}

function formatStoredFullItem(rawItem, meta = {}) {
  const item = normalizeStoredStructuredItem(rawItem);
  const priority = item.priority || "P2";
  const badge = getPriorityBadge(priority);
  const priorityLabel = getPriorityLabel(priority);
  const area = translateArea(item.area || "Shopify Dev");
  const relevance = normalizeRelevance(item.relevance || 5);
  const counter = meta.index && meta.total
    ? `📖 <b>Розбір ${meta.index}/${meta.total}</b> · ${badge} ${escapeHtml(priorityLabel)}`
    : `${badge} <b>${escapeHtml(priorityLabel)}</b>`;

  const date = item.publishedAt ? item.publishedAt.slice(0, 10) : "без дати";
  const sourceTitle = getItemTitle(item);
  const facts = normalizeList(item.verifiedFacts).slice(0, 3);
  const checks = normalizeList(item.checklistItems).slice(0, 3);
  const hasConfirmedBefore = item.before && !/не підтверджено|не описує/i.test(item.before);

  return [
    counter,
    `🧩 <code>${escapeHtml(area)}</code> · ${escapeHtml(date)}`,
    `🔥 <b>${escapeHtml(sourceTitle)}</b>`,
    "",
    "🧠 <b>Що саме змінилося</b>",
    escapeHtml(item.essence || item.aiConclusion),
    "",
    `📌 <b>Підтверджено джерелом</b> · ${escapeHtml(item.source || "офіційне джерело")}`,
    facts.map((fact) => `• ${escapeHtml(fact)}`).join("\n"),
    "",
    hasConfirmedBefore ? "🔄 <b>Було → тепер</b>" : "",
    hasConfirmedBefore ? `Було: ${escapeHtml(item.before)}` : "",
    hasConfirmedBefore ? `Тепер: ${escapeHtml(item.after)}` : "",
    "",
    "👤 <b>Кого це стосується</b>",
    escapeHtml(item.audience),
    "",
    "💡 <b>Практичний приклад</b>",
    escapeHtml(item.devIdea || item.aiConclusion),
    "",
    "👉 <b>Що зробити зараз</b>",
    escapeHtml(item.todayAction || item.clientTask),
    "",
    checks.length ? "🔍 <b>Де перевірити</b>" : "",
    checks.length ? checks.map((check) => `□ ${escapeHtml(check)}`).join("\n") : "",
    "",
    `🚫 <b>Коли можна пропустити:</b> ${escapeHtml(item.notFor)}`,
    `⏱ <b>Оцінка:</b> ${escapeHtml(item.timeEstimate)} · <b>Рішення:</b> ${escapeHtml(item.recommendation || inferRecommendation(priority, relevance))}`,
    "",
    `🔗 <a href="${escapeHtml(item.url)}"><b>Офіційне джерело</b></a>`,
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 2400);
}

function buildCardVerdict(item) {
  const priority = item.priority || "P2";
  const area = String(item.area || "").toLowerCase();

  if (priority === "P0") {
    return "Потрібна перевірка найближчим часом: зміна може впливати на production-код, інтеграції або бізнес-логіку.";
  }

  if (priority === "P1" && /pos/.test(area)) {
    return "Варто перевірити POS-сценарії, особливо якщо є кастомна логіка знижок, Cart API або автоматизації.";
  }

  if (priority === "P1" && /(themes|theme|теми|liquid)/.test(area)) {
    return "Варто додати в theme-аудит: зміна може впливати на Liquid, секції, snippets або storefront UX.";
  }

  if (priority === "P1" && /(admin api|storefront api|api|graphql)/.test(area)) {
    return "Варто перевірити API-версії, GraphQL-запити, scopes, webhooks або бекенд-автоматизації.";
  }

  if (priority === "P1" && /(performance|швидкість|seo)/.test(area)) {
    return "Варто додати в performance/SEO backlog і перевірити вплив на ключові сторінки магазину.";
  }

  if (priority === "P1") {
    return "Варто додати в dev backlog або технічний аудит, але це не виглядає як негайний production-ризик.";
  }

  return "До відома: корисно знати для майбутніх задач, але без термінової дії.";
}

function buildCardImpact(item) {
  const importance = String(item.importance || "").trim();

  if (!importance) return "";

  return importance
    .replace(/^Важливо для розробників,\s*/i, "")
    .replace(/^Це важливо,\s*/i, "")
    .trim();
}

function buildClientTask(item) {
  const area = String(item.area || inferArea(item)).toLowerCase();

  if (/vue|pinia/.test(area)) return "Перевірити компоненти, composables, stores, reactivity та regression у Vue-застосунку.";
  if (/nuxt/.test(area)) return "Перевірити Nuxt version, SSR/hydration, data fetching, Nitro і production build.";
  if (/vite|typescript|javascript|node/.test(area)) return "Перевірити toolchain, типи, build, tests і runtime-сумісність у клієнтських проєктах.";
  if (/css|tailwind|ui/.test(area)) return "Перевірити styles pipeline, design tokens, responsive UI, accessibility і visual regression.";
  if (/cloudflare/.test(area)) return "Перевірити Worker runtime, bindings, compatibility date, deployment і edge-логи.";

  if (/theme|themes|теми|liquid/.test(area)) {
    return "Перевірити theme code, sections, snippets і storefront regression у клієнтських магазинах.";
  }

  if (/admin api|storefront api|api|graphql/.test(area)) {
    return "Перевірити API version, scopes, GraphQL-запити та інтеграції в клієнтських проєктах.";
  }

  if (/checkout/.test(area)) {
    return "Перевірити checkout flow, Functions, Markets і payment/shipping сценарії на test order.";
  }

  if (/performance|швидкість|seo/.test(area)) {
    return "Додати зміну в performance/SEO аудит для PDP, collection, homepage і app scripts.";
  }

  if (/pos/.test(area)) {
    return "Перевірити POS-розширення, Cart API сценарії та логіку знижок або округлення.";
  }

  return "Додати зміну в технічний audit checklist і перевірити вплив на поточні frontend або Shopify-проєкти.";
}

function formatNumberedLines(items) {
  const list = normalizeList(items);

  if (!list.length) {
    return "1. Перевірити деталі в офіційному джерелі.";
  }

  return list.map((item, index) => `${index + 1}. ${escapeHtml(item)}`).join("\n\n");
}

function formatChecklistLines(items) {
  const list = normalizeList(items);

  if (!list.length) {
    return "☐ Перевірити деталі в офіційному джерелі.";
  }

  return list.map((item) => `☐ ${escapeHtml(item)}`).join("\n\n");
}

function getItemTitle(item) {
  return normalizeUkrainianText(item?.uaTitle || item?.title || "Без назви");
}

function createFallbackUaTitle(item) {
  const title = String(item?.title || "Нове Shopify-оновлення").trim();

  return normalizeUkrainianText(title)
    .replace(/^New\s+/i, "Нове ")
    .replace(/\bdeprecated\b/gi, "застаріло")
    .replace(/\breplaced\b/gi, "замінено")
    .replace(/\bcapability\b/gi, "можливість")
    .replace(/\brequired\b/gi, "обов'язково")
    .slice(0, 120);
}

function inferPriority(item) {
  const text = buildSearchText(item);

  if (/(security advisory|security release|vulnerab|\bcve-?\d*|breaking change|action required|mandatory (upgrade|migration|change)|deprecat|removal notice|sunset|no longer supported|migration required)/i.test(text)) {
    return "P0";
  }

  if (/(vue|nuxt|pinia|vite|typescript|javascript|node|tailwind|sass|scss|css|accessibility|browser api|cloudflare|workers|admin api|storefront api|graphql|checkout|theme|liquid|performance|seo)/i.test(text)) {
    return "P1";
  }

  return "P2";
}

function inferRelevance(item, priority = inferPriority(item)) {
  const text = buildSearchText(item);

  if (priority === "P0") return 8;
  if (priority === "P1") return 7;
  if (/(pos|partner dashboard|payments|billing)/i.test(text)) return 4;

  return 5;
}

function inferArea(item) {
  const text = buildSearchText(item);

  if (/\bnuxt\b|nitro|hydration|server route|usefetch|useasyncdata/i.test(text)) return "Nuxt";
  if (/\bpinia\b|defineStore|state management/i.test(text)) return "Pinia";
  if (/\bvue\b|composition api|reactivity|single.file component/i.test(text)) return "Vue";
  if (/\bvite\b|rolldown|hmr|build tool/i.test(text)) return "Vite";
  if (/typescript|\btsc\b|type checker/i.test(text)) return "TypeScript";
  if (/node\.js|\bnode\b|v8 engine|npm runtime/i.test(text)) return "Node.js";
  if (/tailwind/i.test(text)) return "Tailwind";
  if (/sass|scss/i.test(text)) return "CSS";
  if (/accessibility|\ba11y\b|aria|wcag|ui component/i.test(text)) return "UI";
  if (/cloudflare|workers|workerd|durable object|d1|r2|edge runtime/i.test(text)) return "Cloudflare";
  if (/javascript|ecmascript|browser api|web platform/i.test(text)) return "JavaScript";

  if (/(admin api|admin graphql|graphql|mutation|bulk operation|refund)/i.test(text)) return "Admin API";
  if (/(storefront api)/i.test(text)) return "Storefront API";
  if (/(checkout|function|cart transform|delivery customization|payment customization)/i.test(text)) return "Checkout";
  if (/(theme|liquid|section|snippet|online store|app block)/i.test(text)) return "Themes";
  if (/(performance|speed|lcp|cls|core web vitals|css|asset|javascript)/i.test(text)) return "Performance";
  if (/(seo|structured data|canonical|sitemap|robots)/i.test(text)) return "SEO";
  if (/(pos)/i.test(text)) return "POS";
  if (/(app|extension|embedded app)/i.test(text)) return "App Dev";

  return "Shopify Dev";
}

function inferDevTags(item, area = inferArea(item)) {
  const text = buildSearchText(item);
  const tags = [...(Array.isArray(item.tags) ? item.tags : [])];

  if (/\bvue\b|composition api|reactivity/i.test(text) || area === "Vue") tags.push("vue");
  if (/\bnuxt\b|nitro|hydration|ssr/i.test(text) || area === "Nuxt") tags.push("nuxt", "ssr");
  if (/\bpinia\b|defineStore/i.test(text) || area === "Pinia") tags.push("pinia", "state-management");
  if (/\bvite\b|rolldown|hmr/i.test(text) || area === "Vite") tags.push("vite", "build-tools");
  if (/typescript|\btsc\b/i.test(text) || area === "TypeScript") tags.push("typescript");
  if (/javascript|ecmascript/i.test(text) || area === "JavaScript") tags.push("javascript");
  if (/node\.js|\bnode\b/i.test(text) || area === "Node.js") tags.push("node");
  if (/tailwind/i.test(text) || area === "Tailwind") tags.push("tailwind", "css", "ui");
  if (/sass|scss/i.test(text)) tags.push("sass", "scss", "css");
  if (/accessibility|a11y|aria|wcag/i.test(text) || area === "UI") tags.push("ui", "a11y");
  if (/cloudflare|workers|workerd|durable object/i.test(text) || area === "Cloudflare") tags.push("cloudflare", "workers", "edge");

  if (/admin api|admin graphql|graphql|mutation|refund/i.test(text) || area === "Admin API") tags.push("admin-api");
  if (/storefront api/i.test(text) || area === "Storefront API") tags.push("storefront-api");
  if (/checkout/i.test(text) || area === "Checkout") tags.push("checkout");
  if (/function/i.test(text)) tags.push("functions");
  if (/theme|online store/i.test(text) || area === "Themes") tags.push("themes");
  if (/liquid/i.test(text)) tags.push("liquid");
  if (/section/i.test(text)) tags.push("sections");
  if (/performance|speed|lcp|cls|asset/i.test(text) || area === "Performance") tags.push("performance");
  if (/seo|structured data|canonical/i.test(text) || area === "SEO") tags.push("seo");
  if (/metafield|metaobject/i.test(text)) tags.push("metafields");
  if (/market/i.test(text)) tags.push("markets");
  if (/webhook/i.test(text)) tags.push("webhooks");
  if (/app/i.test(text) || area === "App Dev") tags.push("app-dev");
  if (/pos/i.test(text) || area === "POS") tags.push("pos");

  if (/shopify|liquid|storefront|admin api|checkout|hydrogen/i.test(text) || item.sourceId === "shopify") {
    tags.push("shopify-dev");
  }

  return normalizeTags(tags);
}

function inferImpactTags(item, priority = inferPriority(item), area = inferArea(item)) {
  const text = buildSearchText(item);
  const tags = [];

  if (/security advisory|security release|vulnerab|\bcve-?\d*/i.test(text)) tags.push("security");
  if (/breaking change/i.test(text)) tags.push("breaking");
  if (/migration required|mandatory migration/i.test(text)) tags.push("migration");
  if (/deprecat|removal|sunset|no longer/i.test(text)) tags.push("deprecation");
  if (/api|graphql|admin api|storefront api/i.test(text) || /api/i.test(area)) tags.push("api-version");
  if (/theme|liquid|section|css|stylesheet/i.test(text) || /theme/i.test(area)) tags.push("theme-risk");
  if (/checkout|function|payment|shipping/i.test(text) || /checkout/i.test(area)) tags.push("checkout-risk");
  if (/performance|speed|seo|lcp|cls|css|asset/i.test(text) || /performance|seo/i.test(area)) tags.push("performance-opportunity");
  if (/metaobject|metafield|scope/i.test(text)) tags.push("client-work");
  if (/scope|permission|access/i.test(text)) tags.push("low-friction-install");
  if (/pos/i.test(text) || /pos/i.test(area)) tags.push("pos-risk");

  if (priority !== "P2") tags.push("audit");

  return normalizeTags(tags);
}

function calculateQualityScore(summary, options = {}) {
  let score = 0;

  if (hasCyrillic(summary.uaTitle) && summary.uaTitle.length >= 8) score += 15;
  if (hasCyrillic(summary.essence) && summary.essence.length >= 20 && !isGenericFallbackText(summary.essence)) score += 15;
  if (hasCyrillic(summary.importance) && summary.importance.length >= 20 && !isGenericFallbackText(summary.importance)) score += 15;
  if (Array.isArray(summary.applicationItems) && summary.applicationItems.length >= 2) score += 15;
  if (Array.isArray(summary.checklistItems) && summary.checklistItems.length >= 2) score += 15;
  if (hasCyrillic(summary.devIdea) && summary.devIdea.length >= 20) score += 10;
  if (Array.isArray(summary.impactTags) && summary.impactTags.length) score += 5;
  if (summary.clientTask && summary.clientTask.length >= 20) score += 10;
  if (Array.isArray(summary.verifiedFacts) && summary.verifiedFacts.length >= 2) score += 10;
  if (summary.audience && summary.aiConclusion && summary.expectedResult) score += 10;

  if (options.usedFallback) score -= 35;
  if (looksMostlyEnglish(summary.uaTitle) || looksMostlyEnglish(summary.essence)) score -= 20;
  if (isGenericFallbackText([summary.essence, summary.importance, summary.devIdea].join("\n"))) score -= 30;

  return Math.max(0, Math.min(100, Math.round(score * 0.83)));
}

function buildSearchText(item) {
  return [
    item?.title || "",
    item?.uaTitle || "",
    item?.summary || "",
    item?.area || "",
    ...(Array.isArray(item?.tags) ? item.tags : []),
    ...(Array.isArray(item?.devTags) ? item.devTags : []),
    ...(Array.isArray(item?.impactTags) ? item.impactTags : []),
  ]
    .join(" ")
    .toLowerCase();
}

function extractMetaField(text, key) {
  const regex = new RegExp(`^\\s*${escapeRegExp(key)}\\s*:\\s*(.+)$`, "im");
  const match = String(text || "").match(regex);

  return match ? cleanStructuredText(match[1]) : "";
}

function extractSection(text, startLabels, endLabels) {
  const raw = String(text || "");
  const lower = raw.toLowerCase();
  let startIndex = -1;
  let startLength = 0;

  for (const label of startLabels) {
    const index = lower.indexOf(label.toLowerCase());

    if (index !== -1 && (startIndex === -1 || index < startIndex)) {
      startIndex = index;
      startLength = label.length;
    }
  }

  if (startIndex === -1) return "";

  const contentStart = startIndex + startLength;
  let contentEnd = raw.length;

  for (const label of endLabels) {
    const index = lower.indexOf(label.toLowerCase(), contentStart);

    if (index !== -1 && index < contentEnd) {
      contentEnd = index;
    }
  }

  return cleanStructuredText(
    raw
      .slice(contentStart, contentEnd)
      .replace(/^[:\s]+/, "")
      .replace(/^(Суть|Чому важливо|Як застосувати|Що перевірити|Ідея для розробника|Ідея)\s*:\s*/i, "")
  );
}

function parseBulletItems(text) {
  const raw = String(text || "");
  const normalized = cleanStructuredText(raw);

  if (!normalized) return [];

  const sourceForLines = raw.includes("\n") ? raw : normalized;
  const lines = sourceForLines
    .split(/\n+/)
    .map((line) => cleanStructuredText(line.replace(/^[-*•–—]\s*/, "")))
    .filter(Boolean);

  if (lines.length > 1) return normalizeList(lines);

  if (normalized.includes("•")) {
    return normalizeList(
      normalized
        .split("•")
        .map((item) => cleanStructuredText(item))
        .filter(Boolean)
    );
  }

  return normalizeList([normalized]);
}

function parseDevTags(value) {
  return normalizeTags(
    String(value || "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
  );
}

function parseInlineList(value) {
  return normalizeList(
    String(value || "")
      .split(/\s*\|\s*/)
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

function normalizeList(items) {
  const source = Array.isArray(items) ? items : [items];

  return source
    .map((item) => cleanStructuredText(item))
    .filter(Boolean)
    .filter((item, index, array) => array.findIndex((candidate) => candidate.toLowerCase() === item.toLowerCase()) === index);
}

function normalizeTags(tags) {
  const source = Array.isArray(tags) ? tags : [tags];

  return source
    .flatMap((tag) => String(tag || "").split(","))
    .map((tag) =>
      cleanText(tag)
        .toLowerCase()
        .replace(/[^a-z0-9а-яіїєґ\-\s]/gi, "")
        .replace(/\s+/g, "-")
        .trim()
    )
    .filter(Boolean)
    .filter((tag, index, array) => array.indexOf(tag) === index)
    .slice(0, 12);
}

function normalizePriority(value) {
  const match = String(value || "").match(/P[0-2]/i);

  return match ? match[0].toUpperCase() : "P2";
}

function normalizeRelevance(value) {
  const raw = String(value || "").match(/10|[1-9]/)?.[0];
  const number = Number(raw || value || 5);

  if (!Number.isFinite(number)) return 5;

  return Math.max(1, Math.min(10, Math.round(number)));
}

function normalizeScore(value, fallback = 5) {
  const match = String(value ?? "").match(/\d+(?:\.\d+)?/);
  const parsed = match ? Number(match[0]) : Number(fallback);
  return Math.round(clampNumber(Number.isFinite(parsed) ? parsed : fallback, 1, 10));
}

function inferRecommendation(priority, relevance) {
  if (priority === "P0") return "зробити зараз";
  if (priority === "P1" || relevance >= 8) return "запланувати";
  return "лише знати";
}

function inferUrgency(priority, relevance) {
  if (priority === "P0") return "сьогодні";
  if (priority === "P1" && relevance >= 8) return "цього тижня";
  if (priority === "P1") return "у беклог";
  return "лише знати";
}

function inferAudience(area) {
  const value = String(area || "").toLowerCase();
  if (/vue|pinia/.test(value)) return "Vue-команди, що працюють із Composition API, components, composables або Pinia stores.";
  if (/nuxt/.test(value)) return "Nuxt-команди з SSR, hydration, Nitro, server routes і data fetching.";
  if (/vite|typescript|javascript|node/.test(value)) return "Frontend-команди, що підтримують JavaScript/TypeScript toolchain, build і Node.js runtime.";
  if (/css|tailwind|ui/.test(value)) return "Frontend і design-system команди, що відповідають за CSS, Tailwind, UI та accessibility.";
  if (/cloudflare/.test(value)) return "Команди з Cloudflare Workers, edge runtime, KV, D1, R2 або Durable Objects.";
  if (/theme|liquid/.test(value)) return "Розробники Shopify themes, Liquid, sections і storefront UX.";
  if (/api|graphql/.test(value)) return "Розробники Shopify apps, API-інтеграцій, webhooks і автоматизацій.";
  if (/checkout/.test(value)) return "Shopify Plus команди з Checkout Extensibility, Functions і payment/shipping логікою.";
  if (/performance|seo/.test(value)) return "Команди, які відповідають за швидкість storefront, SEO та CRO.";
  return "Shopify-розробники й технічні команди магазинів, що використовують відповідну функцію.";
}

function buildExpectedResult(area) {
  const value = String(area || "").toLowerCase();
  if (/vue|pinia/.test(value)) return "Компоненти, stores і reactivity працюють без runtime та type regression.";
  if (/nuxt/.test(value)) return "SSR, hydration, data fetching і production build проходять перевірку без regression.";
  if (/vite|typescript|javascript|node/.test(value)) return "Build, typecheck, tests і production runtime сумісні з новою версією.";
  if (/css|tailwind|ui/.test(value)) return "Стилі, responsive states, accessibility і visual regression перевірені.";
  if (/cloudflare/.test(value)) return "Worker успішно збирається, деплоїться й працює з чинними bindings та compatibility date.";
  if (/theme|liquid/.test(value)) return "Ключові storefront-сценарії працюють без regression після зміни.";
  if (/api|graphql/.test(value)) return "Запити, scopes, webhooks і фонові jobs сумісні з актуальною поведінкою Shopify.";
  if (/checkout/.test(value)) return "Checkout-сценарії проходять QA без помилок у Functions, оплаті або доставці.";
  return "Вплив зміни підтверджено, а конкретна дія зафіксована в аудиті або беклозі.";
}

function getPriorityBadge(priority) {
  if (priority === "P0") return "🚨";
  if (priority === "P1") return "⚡";
  return "🧊";
}

function getPriorityLabel(priority) {
  if (priority === "P0") return "КРИТИЧНО";
  if (priority === "P1") return "ВАЖЛИВО";
  return "ДО ВІДОМА";
}

function translateArea(area) {
  const value = String(area || "").trim();

  const dictionary = {
    "Shopify Dev": "Shopify розробка",
    Themes: "Теми",
    Performance: "Швидкість",
    SEO: "SEO",
    Checkout: "Checkout",
    POS: "POS",
    "Admin API": "Admin API",
    "Admin GraphQL API": "Admin API",
    "Storefront API": "Storefront API",
    "App Dev": "Розробка застосунків",
    FYI: "До відома",
  };

  return dictionary[value] || value;
}

function cleanStructuredText(text) {
  return normalizeUkrainianText(
    cleanText(String(text || ""))
      .replace(/^📖\s*\d+\s*\/\s*10\s*$/gim, "")
      .replace(/^UA_TITLE:\s*/i, "")
      .replace(/^PRIORITY:\s*/i, "")
      .replace(/^RELEVANCE:\s*/i, "")
      .replace(/^AREA:\s*/i, "")
      .replace(/^DEV_TAGS:\s*/i, "")
      .replace(/^IMPACT_TAGS:\s*/i, "")
      .replace(/^CLIENT_TASK:\s*/i, "")
      .replace(/^[-*•–—]\s*/, "")
      .replace(/\*\*/g, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function normalizeUkrainianText(text) {
  return String(text || "")
    .replace(/\bupdates\b/gi, "оновлення")
    .replace(/\bupdate\b/gi, "оновлення")
    .replace(/\bdigest\b/gi, "зведення")
    .replace(/\bperformance\b/gi, "швидкість")
    .replace(/\bbacklog\b/gi, "беклог")
    .replace(/\baudit checklist\b/gi, "чеклист аудиту")
    .replace(/\bchangelog\b/gi, "журнал змін")
    .replace(/\bworkflow\b/gi, "робочий процес")
    .trim();
}

function sortItemsByDateDesc(items) {
  return [...(items || [])].sort((a, b) => {
    const aTime = a?.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const bTime = b?.publishedAt ? new Date(b.publishedAt).getTime() : 0;

    return bTime - aTime;
  });
}

function clampNumber(value, min, max) {
  const number = Number(value);

  if (!Number.isFinite(number)) return min;

  return Math.max(min, Math.min(max, Math.floor(number)));
}

function buildStats(latest, digest, subscribers, lastRun) {
  const normalized = latest.map(normalizeStoredStructuredItem);
  const structured = normalized.filter(hasStructuredFields);
  const p0 = normalized.filter((item) => item.priority === "P0");
  const p1 = normalized.filter((item) => item.priority === "P1");
  const p2 = normalized.filter((item) => item.priority === "P2");
  const fallback = normalized.filter((item) => item.usedFallback);
  const qualityValues = normalized.map((item) => Number(item.qualityScore || 0)).filter(Number.isFinite);
  const latestAverageQuality = qualityValues.length
    ? Math.round(qualityValues.reduce((sum, value) => sum + value, 0) / qualityValues.length)
    : 0;

  return {
    subscribersCount: subscribers.length,
    latestCount: latest.length,
    digestCount: digest.length,
    structuredCount: structured.length,
    latestNeedsBootstrap: latestNeedsBootstrap(latest, { includeStaleCheck: true }),
    latestFallbackCount: fallback.length,
    latestAverageQuality,
    p0Count: p0.length,
    p1Count: p1.length,
    p2Count: p2.length,
    lastRun,
  };
}

function formatStatsMessage(stats) {
  return [
    "📊 <b>FRONTEND INTELLIGENCE RADAR STATS</b>",
    "",
    `👥 Subscribers: <b>${stats.subscribersCount}</b>`,
    `🆕 Latest: <b>${stats.latestCount}</b>`,
    `🧠 Digest: <b>${stats.digestCount}</b>`,
    `✅ Structured: <b>${stats.structuredCount}/${stats.latestCount}</b>`,
    `🤖 Fallback: <b>${stats.latestFallbackCount}</b>`,
    `🧪 AI quality avg: <b>${stats.latestAverageQuality}/100</b>`,
    "",
    `🚨 P0: <b>${stats.p0Count}</b>`,
    `⚡ P1: <b>${stats.p1Count}</b>`,
    `🧊 P2: <b>${stats.p2Count}</b>`,
    "",
    `🔄 Needs bootstrap: <b>${stats.latestNeedsBootstrap ? "yes" : "no"}</b>`,
    `🕒 Last run: <b>${escapeHtml(stats.lastRun?.time || "none")}</b>`,
    stats.lastRun ? `📦 Last processed: <b>${stats.lastRun.processed}</b> · Failed: <b>${stats.lastRun.failed}</b>` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function sendTelegramMessage(message, env, options = {}) {
  const subscribers = await getSubscribers(env);

  if (!subscribers.length && env.TELEGRAM_CHAT_ID) {
    await sendTelegramRaw(env.TELEGRAM_CHAT_ID, message, env, {
      replyMarkup: options.replyMarkup,
    });

    return {
      subscribers: 1,
      deliveredSubscribers: 1,
      skippedSubscribers: 0,
      failed: [],
      fallback: true,
    };
  }

  const failed = [];
  let deliveredSubscribers = 0;
  let skippedSubscribers = 0;

  const deliverableSubscribers = subscribers.filter((subscriber) => {
    const deliver = !options.item || shouldDeliverToSubscriber(options.item, subscriber, options);
    if (!deliver) skippedSubscribers += 1;
    return deliver;
  });

  for (let index = 0; index < deliverableSubscribers.length; index += TELEGRAM_DELIVERY_CONCURRENCY) {
    const batch = deliverableSubscribers.slice(index, index + TELEGRAM_DELIVERY_CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((subscriber) =>
        sendTelegramRaw(subscriber.chatId, message, env, {
          replyMarkup: options.replyMarkup,
        })
      )
    );

    results.forEach((result, resultIndex) => {
      const subscriber = batch[resultIndex];
      if (result.status === "fulfilled") {
        deliveredSubscribers += 1;
        return;
      }

      failed.push({
        chatId: subscriber.chatId,
        error: safeErrorMessage(result.reason),
      });
      console.error("Failed to send Telegram message to subscriber:", {
        chatId: subscriber.chatId,
        error: safeErrorMessage(result.reason),
      });
    });

    if (index + TELEGRAM_DELIVERY_CONCURRENCY < deliverableSubscribers.length) {
      await delay(TELEGRAM_DELIVERY_BATCH_DELAY_MS);
    }
  }

  return {
    subscribers: subscribers.length,
    deliveredSubscribers,
    skippedSubscribers,
    failed,
    fallback: false,
  };
}

async function sendTelegramRaw(chatId, text, env, options = {}) {
  const body = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: options.disableWebPagePreview ?? true,
  };

  if (options.replyMarkup) {
    body.reply_markup = options.replyMarkup;
  }

  const response = await fetch(
    `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Telegram failed: ${response.status} ${errorText}`);
  }
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function editTelegramMessage(chatId, messageId, text, env, options = {}) {
  const body = {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  };

  if (options.replyMarkup) {
    body.reply_markup = options.replyMarkup;
  }

  const response = await fetch(
    `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/editMessageText`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Telegram edit failed: ${response.status} ${errorText}`);
  }
}

async function answerCallbackQuery(callbackQueryId, env, text = "OK") {
  if (!callbackQueryId) return;

  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text,
      show_alert: false,
    }),
  });
}

function buildMainReplyKeyboard() {
  return {
    keyboard: [
      [{ text: "🆕 Останні" }, { text: "📖 Повні розбори" }],
      [{ text: "💚 Vue" }, { text: "🟢 Nuxt" }],
      [{ text: "⚡ JS/TS" }, { text: "🎨 CSS/UI" }],
      [{ text: "🛍 Shopify" }, { text: "☁️ Cloudflare" }],
      [{ text: "🚨 Критичні" }, { text: "🧠 Digest" }],
      [{ text: "✅ Audit" }, { text: "⚙️ Settings" }],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
  };
}

function buildRemoveKeyboard() {
  return {
    remove_keyboard: true,
  };
}

function buildListInlineKeyboard(items) {
  const rows = items.slice(0, LATEST_DISPLAY_LIMIT).map((item, index) => {
    const itemReference = String(item.itemId || "").slice(0, 16);
    return [{
      text: `📖 Розбір ${index + 1}`,
      callback_data: itemReference ? `article:${itemReference}` : `card:${index}`,
    }];
  });

  rows.push([{ text: "✅ Audit checklist", callback_data: "audit" }]);

  return {
    inline_keyboard: rows,
  };
}

function buildItemInlineKeyboard(item, index = 0) {
  const itemReference = String(item.itemId || "").slice(0, 16);
  const keyboard = [
    [
      { text: "🔗 Source", url: item.url },
      { text: "✅ Audit", callback_data: "audit" },
    ],
    [
      { text: "🆕 Latest", callback_data: "latest" },
      { text: "📖 Full", callback_data: "full" },
    ],
  ];

  if (itemReference) {
    keyboard.unshift([
      { text: "🧠 Поясни простіше", callback_data: `mode:e:${itemReference}` },
      { text: "💻 Приклад", callback_data: `mode:k:${itemReference}` },
    ]);
    keyboard.unshift([
      { text: "🎯 Чи стосується мене?", callback_data: `mode:r:${itemReference}` },
      { text: "✅ Чеклист", callback_data: `mode:c:${itemReference}` },
    ]);
    keyboard.unshift([
      { text: "👍 Корисно", callback_data: `feedback:u:${itemReference}` },
      { text: "🔥 Цікаво", callback_data: `feedback:i:${itemReference}` },
      { text: "👎 Не моє", callback_data: `feedback:n:${itemReference}` },
    ]);
    keyboard.unshift([{ text: "🤔 Не зрозумів", callback_data: `feedback:x:${itemReference}` }]);
  }

  if (Number.isFinite(index)) {
    keyboard.unshift([{
      text: `📖 Поточний розбір ${index + 1}`,
      callback_data: itemReference ? `article:${itemReference}` : `card:${index}`,
    }]);
  }

  return {
    inline_keyboard: keyboard,
  };
}

function buildDigestInlineKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "📖 Full", callback_data: "full" }, { text: "✅ Audit", callback_data: "audit" }],
      [{ text: "🆕 Latest", callback_data: "latest" }],
    ],
  };
}

function buildAuditInlineKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "🆕 Latest", callback_data: "latest" }, { text: "📖 Full", callback_data: "full" }],
    ],
  };
}

function buildAdminInlineKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "🆕 Latest", callback_data: "latest" }, { text: "✅ Audit", callback_data: "audit" }],
    ],
  };
}

function buildSettingsInlineKeyboard(preferences) {
  const min = preferences.minPriority;
  const topics = preferences.topics || [];

  const topicButton = (label, value) => ({
    text: `${topics.includes(value) ? "✅" : "▫️"} ${label}`,
    callback_data: `settings:topic:${value}`,
  });

  return {
    inline_keyboard: [
      [
        { text: `${min === "P0" ? "✅" : "▫️"} Тільки P0`, callback_data: "settings:min:P0" },
        { text: `${min === "P1" ? "✅" : "▫️"} P0 + P1`, callback_data: "settings:min:P1" },
      ],
      [
        { text: `${min === "P2" ? "✅" : "▫️"} Усе`, callback_data: "settings:min:P2" },
        { text: `${preferences.digestOnly ? "✅" : "▫️"} Тільки digest`, callback_data: "settings:digest:toggle" },
      ],
      [topicButton("Vue", "vue"), topicButton("Nuxt", "nuxt"), topicButton("Pinia", "pinia")],
      [topicButton("JS/TS", "javascript"), topicButton("CSS/UI", "css"), topicButton("Tailwind", "tailwind")],
      [topicButton("Shopify", "shopify"), topicButton("Cloudflare", "cloudflare")],
      [{ text: "🧹 Очистити теми", callback_data: "settings:topic:clear" }],
    ],
  };
}

async function createItemId(item) {
  return sha256(`${item.source}:${item.url}:${item.title}`);
}

async function sha256(input) {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);

  return [...new Uint8Array(hash)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function extractTag(xml, tagName) {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = xml.match(regex);
  return match ? decodeCdata(match[1]) : "";
}

function extractAllTags(xml, tagName) {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "gi");
  const matches = [];
  let match;

  while ((match = regex.exec(xml)) !== null) {
    matches.push(decodeCdata(match[1]));
  }

  return matches;
}

function decodeCdata(value) {
  return String(value || "")
    .replace(/^<!\[CDATA\[/, "")
    .replace(/\]\]>$/, "");
}

function safeIsoDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function cleanText(value) {
  return String(value || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function cleanHtml(value) {
  return cleanText(String(value || "").replace(/<[^>]+>/g, " "));
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const __test = {
  extractReadableArticleText,
  normalizeStructuredSummary,
  parseAiStructured,
  shouldSendImmediate,
  formatCompactItems,
  formatStoredFullItem,
  formatDigestMessage,
  personalizeItems,
  requestAiCompletion,
  requestAiCompletionWithFallback,
  filterFreshFeedItems,
  shouldReenrichItem,
  parseRssFeed,
  parseAtomFeed,
  rankFeedItems,
  balanceItemsBySource,
  isHighSignalFeedItem,
  createFallbackStructuredSummary,
  inferPriority,
  isPublishableItem,
  buildListInlineKeyboard,
  buildItemInlineKeyboard,
};

