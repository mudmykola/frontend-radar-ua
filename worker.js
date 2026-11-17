import {
  isAdminAuthorized,
  isTelegramWebhookAuthorized,
  methodNotAllowed,
  safeErrorMessage,
} from "./src/http-security.js";

import { APPROVED_ARTICLE_HOSTS, CONTENT_SOURCES } from "./src/config/sources.js";
import {
  balanceItemsBySource,
  filterFreshFeedItems,
  filterItemsByLookback,
  filterItemsWithinHours,
  isHighSignalFeedItem,
  rankFeedItems,
  sortByPublishedDesc,
  sortItemsByDateDesc,
} from "./src/ingest/feed-utils.js";
import { buildTelegramCommandMenu } from "./src/telegram/commands.js";
import { createNewsRepository } from "./src/storage/news-repository.js";
import { createSubscriberRepository } from "./src/storage/subscriber-repository.js";
import { createContentFetcher } from "./src/ingest/content-fetcher.js";
import { createArticleContext } from "./src/ingest/article-context.js";
import { createAiEditor } from "./src/enrichment/editor.js";
import { createQualityGate } from "./src/enrichment/quality-gate.js";
import { createEvidenceRules } from "./src/enrichment/evidence.js";
import { createItemBuilder } from "./src/enrichment/item-builder.js";
import { createStructuredParser } from "./src/enrichment/structured-parser.js";
import { buildFallbackApplicationItems as buildFallbackApplicationItemsModule, buildFallbackChecklistItems as buildFallbackChecklistItemsModule } from "./src/enrichment/fallback-content.js";
import { createAiClient } from "./src/enrichment/ai-client.js";
import {
  TOPIC_MENU,
  buildAdminInlineKeyboard,
  buildAuditInlineKeyboard,
  buildDigestInlineKeyboard,
  buildItemInlineKeyboard,
  buildListInlineKeyboard,
  buildMainReplyKeyboard,
  buildRemoveKeyboard,
  buildSettingsInlineKeyboard,
  buildTopicsInlineKeyboard,
} from "./src/telegram/keyboards.js";
import { createTelegramClient } from "./src/telegram/client.js";
import { createTelegramDelivery } from "./src/telegram/delivery.js";
import { createTelegramWebhookProcessor } from "./src/telegram/webhook.js";
import { createTelegramUpdateHandler } from "./src/telegram/update-handler.js";
import { createTelegramFormatters } from "./src/telegram/formatters.js";
import { createTelegramHandlers } from "./src/telegram/handlers.js";
import { normalizeTelegramCommand, parseCommandArgs, parseOptionalIndex } from "./src/telegram/parsing.js";
import { createScheduledHandler } from "./src/runtime/scheduled.js";
import { createFetchRouter } from "./src/runtime/fetch-router.js";
import { HTTP_ROUTES, createHttpRouteTable } from "./src/http/routes.js";
import { createHttpHandlers } from "./src/http/handlers.js";
import { createRunPipeline } from "./src/runtime/run-pipeline.js";

const SERVICE_NAME = "Frontend Intelligence Radar UA";
const SERVICE_VERSION = "v15.0";

const MAX_ITEMS_PER_RUN = 3;
const MIN_PUBLISH_QUALITY = 70;
const MANUAL_REFRESH_LIMIT = 3;
const INITIAL_BOOTSTRAP_LIMIT = 12;
const LATEST_DISPLAY_LIMIT = 7;
const FULL_DISPLAY_LIMIT = 7;
const LOOKBACK_DAYS = 90;
const FRESH_NEWS_WINDOW_DAYS = 7;
const TELEGRAM_LATEST_WINDOW_HOURS = 48;
const TELEGRAM_LATEST_SYNC_MAX_AGE_MINUTES = 10;
const TELEGRAM_LATEST_SYNC_LOCK_KEY = "telegram:latest:sync:lock";
const AI_REENRICH_INTERVAL_HOURS = 0.5;
const SEEN_TTL_DAYS = 100;
const SEEN_TTL_SECONDS = 60 * 60 * 24 * SEEN_TTL_DAYS;

const LATEST_ITEMS_KEY = "latest:items";
const DIGEST_ITEMS_KEY = "digest:items";
const SUBSCRIBERS_KEY = "telegram:subscribers";
const BOOTSTRAP_CHECKED_KEY = "latest:bootstrap:checked";
const RUN_LAST_KEY = "run:last";
const TELEGRAM_PROFILE_VERSION_KEY = "telegram:profile:version";
const TELEGRAM_PROFILE_VERSION = "v15";

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

const httpHandlers = createHttpHandlers({
  serviceName: SERVICE_NAME,
  serviceVersion: SERVICE_VERSION,
  maxWebhookBodyBytes: MAX_WEBHOOK_BODY_BYTES,
  minPublishQuality: MIN_PUBLISH_QUALITY,
  methodNotAllowed,
  isAdminAuthorized,
  isTelegramWebhookAuthorized,
  configureTelegramWebhook,
  indexContentSources,
  run,
  getTelegramWebhookInfo,
  handleTelegramWebhookOnce,
  summarizeWithAi,
  parseAiStructured,
  isStructuredSummaryUseful,
  buildEnrichedItem,
  getSubscribers,
  getLatestItems,
  getDigestItems,
  getLastRun,
  buildStats,
  latestNeedsBootstrap,
  hasStructuredFields,
  sendDailyDigest,
  bootstrapLatestNews,
  ensureInitialNews,
  buildAuditData,
  safeErrorMessage,
});

const HTTP_ROUTE_SUMMARY = HTTP_ROUTES.map(({ path }) => path).concat([
  "/run?silent=1&limit=10",
  "/run?silent=1&limit=10&ignoreSeen=1",
  "/run?silent=1&limit=10&ignoreSeen=1&debug=1",
]);

const httpRouter = createFetchRouter({
  routes: createHttpRouteTable(httpHandlers),
  fallback: handleUnknownRoute,
  methodNotAllowed,
});

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(createScheduledHandler({
      ensureProfile: () => ensureTelegramProfileVersion(env),
      run: () => run(env),
      sendDigest: () => sendDailyDigest(env),
      dailyDigestHour: DAILY_DIGEST_UTC_HOUR,
    })());
  },

  async fetch(request, env, ctx) {
    return httpRouter(request, env, ctx);
  },
};

async function handleLegacyFetch() {
  return handleUnknownRoute();
}

function handleUnknownRoute() {
  return Response.json({
    ok: true,
    service: `${SERVICE_NAME} ${SERVICE_VERSION}`,
    routes: HTTP_ROUTE_SUMMARY,
    adminAuth: "Authorization: Bearer <ADMIN_SECRET>",
  });
}

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
  const commands = buildTelegramCommandMenu();
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
  return createScheduledHandler({
    ensureProfile: () => ensureTelegramProfileVersion(env),
    run: () => run(env),
    sendDigest: () => sendDailyDigest(env),
    dailyDigestHour: DAILY_DIGEST_UTC_HOUR,
  })();
}

async function ensureTelegramProfileVersion(env) {
  if (await env.SHOPIFY_RADAR_KV.get(TELEGRAM_PROFILE_VERSION_KEY) === TELEGRAM_PROFILE_VERSION) return;
  await configureTelegramProfile(env);
  await env.SHOPIFY_RADAR_KV.put(TELEGRAM_PROFILE_VERSION_KEY, TELEGRAM_PROFILE_VERSION);
}

function run(env, options = {}) {
  return getRunPipeline().run(env, options);
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
  return createTelegramWebhookProcessor(env, {
    keyPrefix: TELEGRAM_UPDATE_KEY_PREFIX,
    ttlSeconds: TELEGRAM_UPDATE_TTL_SECONDS,
    inFlight: inFlightTelegramUpdates,
    handleUpdate: handleTelegramWebhook,
  }).process(update);
}



const handleTelegramUpdate = createTelegramUpdateHandler({
  handleCallback: handleTelegramCallback,
  handleMessage: handleTelegramMessage,
});

async function handleTelegramWebhook(update, env) {
  return handleTelegramUpdate(update, env);
}

async function handleTelegramMessage(update, env) {
  return getTelegramHandlers().handleMessage(update, env);
}

async function handleTelegramCallback(callbackQuery, env) {
  return getTelegramHandlers().handleCallback(callbackQuery, env);
}

async function ensureInitialNews(env, options = {}) {
  return sortItemsByDateDesc(await getLatestItems(env, options));
}

async function ensureLatestFeedSync(env) {
  const lastRun = await getLastRun(env);
  const lastRunTime = new Date(lastRun?.time || 0).getTime();
  const maxAgeMs = TELEGRAM_LATEST_SYNC_MAX_AGE_MINUTES * 60 * 1000;

  if (Number.isFinite(lastRunTime) && Date.now() - lastRunTime < maxAgeMs) {
    return { ran: false, lastRun };
  }

  if (await env.SHOPIFY_RADAR_KV.get(TELEGRAM_LATEST_SYNC_LOCK_KEY)) {
    return { ran: false, lastRun, locked: true };
  }

  await env.SHOPIFY_RADAR_KV.put(TELEGRAM_LATEST_SYNC_LOCK_KEY, "1", { expirationTtl: 60 });

  try {
    const result = await run(env, { silent: true, limit: MAX_ITEMS_PER_RUN });
    return { ran: true, lastRun: result };
  } finally {
    await env.SHOPIFY_RADAR_KV.delete(TELEGRAM_LATEST_SYNC_LOCK_KEY);
  }
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
  return getSubscriberRepository(env).saveSubscriber(chatId, message);
}

async function removeSubscriber(chatId, env) {
  return getSubscriberRepository(env).removeSubscriber(chatId);
}

async function getSubscribers(env) {
  return getSubscriberRepository(env).getSubscribers();
}

async function updateSubscriber(chatId, updater, env) {
  return getSubscriberRepository(env).updateSubscriber(chatId, updater);
}

async function saveContentFeedback(chatId, item, reaction, env) {
  return getSubscriberRepository(env).saveContentFeedback(chatId, item, reaction);
}

async function personalizeItems(chatId, items, env) {
  return getSubscriberRepository(env).personalizeItems(chatId, items);
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
    "📌 <b>Швидка навігація:</b>",
    "• 🆕 Свіже — останні перевірені сигнали",
    "• 🎯 Для мене — стрічка за твоїми налаштуваннями",
    "• 🧰 Практика — зміни з конкретною дією або чеклистом",
    "• 🗂 Теми — Vue/Nuxt, JS/TS, CSS/UI, Testing, Shopify, Cloudflare",
    "• 📖 Повний розбір — /full або /full 3",
    "• 🧠 Digest — коротке зведення",
    "",
    "━━━━━━━━━━━━━━━",
    "",
    "🆕 <b>3 ОСТАННІ НОВИНИ</b>",
    "",
    latestBlock,
    "",
    "━━━━━━━━━━━━━━━",
    "",
    "💡 Використовуй кнопки нижче — старі slash-команди теж залишаються сумісними.",
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
  const sync = await ensureLatestFeedSync(env);
  const latest = await ensureInitialNews(env, { windowHours: TELEGRAM_LATEST_WINDOW_HOURS });

  if (!latest.length) {
    await sendTelegramRaw(
      chatId,
      [
        "🧊 <b>Свіжих новин за останні 48 годин немає.</b>",
        "",
        sync.ran
          ? "Я щойно перевірив офіційні джерела, але нових матеріалів не знайшов."
          : "Офіційні джерела вже перевірялися нещодавно; нових матеріалів поки немає.",
        "Старіші матеріали залишилися в /digest, але тут їх не показую як свіжі.",
      ].join("\n"),
      env,
      { replyMarkup: buildMainReplyKeyboard() }
    );
    return;
  }

  await sendItemsList(chatId, env, "🆕 СВІЖІ FRONTEND-СИГНАЛИ", latest.slice(0, LATEST_DISPLAY_LIMIT));
}

async function sendFilteredLatest(chatId, env, options) {
  await ensureLatestFeedSync(env);
  const latest = await ensureInitialNews(env, { windowHours: TELEGRAM_LATEST_WINDOW_HOURS });
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

function getTelegramFormatters() {
  return createTelegramFormatters({
    normalizeStoredStructuredItem,
    getPriorityBadge,
    getPriorityLabel,
    translateArea,
    escapeHtml,
    cleanStructuredText,
    inferAudience,
  });
}

function formatCompactItems(items) {
  return getTelegramFormatters().formatCompactItems(items);
}



async function sendFullLatest(chatId, env, options = {}) {
  await ensureLatestFeedSync(env);
  const latest = await ensureInitialNews(env, { windowHours: TELEGRAM_LATEST_WINDOW_HOURS });
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
  await ensureLatestFeedSync(env);
  const latest = await ensureInitialNews(env, { windowHours: TELEGRAM_LATEST_WINDOW_HOURS });
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

async function sendSingleCardByReference(chatId, env, itemReference, displayMeta = {}) {
  const latest = await getLatestItems(env, { windowHours: TELEGRAM_LATEST_WINDOW_HOURS });
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
  const metaIndex = displayMeta.index || index + 1;
  const metaTotal = displayMeta.total || ordered.length;
  await sendTelegramRaw(
    chatId,
    formatStoredFullItem(item, { index: metaIndex, total: metaTotal }),
    env,
    { replyMarkup: buildItemInlineKeyboard(item, Math.max(0, metaIndex - 1)) }
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
    "ℹ️ <b>ЯК КОРИСТУВАТИСЯ RADAR</b>",
    "",
    "/start — почати та підписатися",
    "/latest — 7 найсвіжіших перевірених сигналів",
    "/practice — тільки новини з конкретною дією або чеклистом",
    "/topics — фільтр за екосистемою",
    "/full або /full 3 — один точний розбір обраної новини",
    "/digest — коротке зведення по категоріях",
    "/settings — персональні налаштування підписок",
    "/stop — відписатися від новин",
    "",
    "━━━━━━━━━━━━━━━",
    "",
    "📡 Бот показує найсвіжіші офіційні зміни й пояснює, кого вони стосуються.",
    "🧊 Старі й малокорисні patch-оновлення відсіюються.",
    "🔧 Старі тематичні slash-команди залишені для сумісності.",
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
      "/practice — практичні зміни",
      "/topics — теми",
      "/digest — коротке зведення",
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

function getContentFetcher() {
  return createContentFetcher({
    sources: CONTENT_SOURCES,
    timeoutMs: FEED_FETCH_TIMEOUT_MS,
    maxFeedBytes: MAX_FEED_BYTES,
    maxItemsPerSource: MAX_ITEMS_PER_SOURCE,
    readResponseTextLimited,
    parseRssFeed,
    parseAtomFeed,
    normalizeReleaseIdentity,
    rankFeedItems,
    safeErrorMessage,
  });
}

async function fetchContentFeeds() {
  return getContentFetcher().fetchContentFeeds();
}

async function fetchContentSource(source) {
  return getContentFetcher().fetchContentSource(source);
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

function getArticleContext() {
  return createArticleContext({
    approvedHosts: APPROVED_ARTICLE_HOSTS,
    timeoutMs: ARTICLE_FETCH_TIMEOUT_MS,
    maxChars: ARTICLE_CONTEXT_MAX_CHARS,
    readResponseTextLimited,
    cleanHtml,
    safeIsoDate,
  });
}

async function enrichItemWithArticleContext(item) {
  return getArticleContext().enrichItemWithArticleContext(item);
}

async function fetchArticleContext(value) {
  return getArticleContext().fetchArticleContext(value);
}

function extractReadableArticleText(html) {
  return getArticleContext().extractReadableArticleText(html);
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

  return getAiEditor(env).extractFacts({
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

  return getAiEditor(env).summarize({
    model,
    temperature: 0.2,
    maxTokens: 1800,
    system:
            "You are a precise senior frontend engineering news analyst with Vue, Nuxt, Shopify, JavaScript, TypeScript, CSS, Tailwind, Node.js, and Cloudflare expertise. Output Ukrainian only. Return only the requested structured format. Focus on practical production usage.",
    prompt,
  });
}




function shouldSendImmediate(item) {
  return getQualityGate().shouldSendImmediate(item);
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

function getNewsRepository(env) {
  return createNewsRepository(env, {
    latestPrefix: LATEST_ITEM_KEY_PREFIX,
    digestPrefix: DIGEST_ITEM_KEY_PREFIX,
    latestLimit: LATEST_ITEMS_LIMIT,
    digestLimit: DIGEST_ITEMS_LIMIT,
    ttlSeconds: SEEN_TTL_SECONDS,
    createItemId,
    serialize: serializeStoredItem,
    filterFresh: filterFreshFeedItems,
    filterWithinHours: filterItemsWithinHours,
    isPublishable: isPublishableItem,
    sortByDate: sortItemsByDateDesc,
  });
}

function getSubscriberRepository(env) {
  return createSubscriberRepository(env, {
    subscriberPrefix: SUBSCRIBER_KEY_PREFIX,
    subscribersKey: SUBSCRIBERS_KEY,
    feedbackPrefix: FEEDBACK_KEY_PREFIX,
    subscribersLimit: SUBSCRIBERS_LIMIT,
    feedbackTtlSeconds: SEEN_TTL_SECONDS,
    readJsonObjectsByPrefix,
    readJsonArray,
    normalizePreferences,
    normalizeTags,
    normalizeStoredStructuredItem,
    normalizeScore,
    createItemId,
  });
}

async function saveLatestItem(item, env) {
  return getNewsRepository(env).saveLatestItem(item);
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
  return getNewsRepository(env).saveDigestItem(item);
}

async function getLatestItems(env, options = {}) {
  return getNewsRepository(env).getLatestItems(options.windowHours);
}

async function getDigestItems(env) {
  return getNewsRepository(env).getDigestItems();
}

function isPublishableItem(item) {
  return getQualityGate().isPublishableItem(item);
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
  return createTelegramDelivery({
    getSubscribers,
    shouldDeliverToSubscriber,
    sendRaw: sendTelegramRaw,
    delay,
    concurrency: TELEGRAM_DELIVERY_CONCURRENCY,
    batchDelayMs: TELEGRAM_DELIVERY_BATCH_DELAY_MS,
    safeErrorMessage,
  }).sendMessage(message, env, options);
}



async function sendTelegramRaw(chatId, text, env, options = {}) {
  return getTelegramClient(env).sendMessage(chatId, text, options);
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function getTelegramClient(env) {
  return createTelegramClient(env, { safeErrorMessage });
}

async function editTelegramMessage(chatId, messageId, text, env, options = {}) {
  return getTelegramClient(env).editMessageText(chatId, messageId, text, options);
}

async function answerCallbackQuery(callbackQueryId, env, text = "OK") {
  return getTelegramClient(env).answerCallbackQuery(callbackQueryId, text);
}



async function sendTopics(chatId, env) {
  await sendTelegramRaw(chatId, "🗂 <b>ОБЕРИ ТЕМУ</b>\n\nПокажу тільки свіжі перевірені новини з обраної екосистеми.", env, {
    replyMarkup: buildTopicsInlineKeyboard(),
  });
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
  buildMainReplyKeyboard,
  buildTelegramCommandMenu,
  buildTopicsInlineKeyboard,
  buildListInlineKeyboard,
  buildItemInlineKeyboard,
  buildDigestInlineKeyboard,
  buildAuditInlineKeyboard,
  buildAdminInlineKeyboard,
  sortItemsByDateDesc,
  filterItemsWithinHours,
  fetchContentSource,
  fetchContentFeeds,
  validateEnv,
  latestNeedsBootstrap,
  latestLooksStale,
};

function getAiClient(env) {
  return createAiClient(env, {
    normalizeBaseUrl,
    normalizeList,
    clampNumber,
    delay,
    safeErrorMessage,
    retryableStatuses: AI_RETRYABLE_STATUSES,
    maxRetries: AI_MAX_RETRIES,
    retryBaseDelayMs: AI_RETRY_BASE_DELAY_MS,
  });
}

function getRunPipeline() {
  return createRunPipeline({
    maxItemsPerRun: MAX_ITEMS_PER_RUN,
    latestItemKeyPrefix: LATEST_ITEM_KEY_PREFIX,
    runLastKey: RUN_LAST_KEY,
    seenTtlSeconds: SEEN_TTL_SECONDS,
    latestItemsLimit: LATEST_ITEMS_LIMIT,
    lookbackDays: LOOKBACK_DAYS,
    maxIndexedItemsPerSource: MAX_INDEXED_ITEMS_PER_SOURCE,
    validateEnv,
    clampNumber,
    createItemId,
    shouldReenrichItem,
    enrichItemWithArticleContext,
    extractEvidenceFacts,
    inferPriority,
    summarizeWithAi,
    parseAiStructured,
    isStructuredSummaryUseful,
    createFallbackStructuredSummary,
    buildEnrichedItem,
    isPublishableItem,
    shouldSendImmediate,
    saveLatestItem,
    saveDigestItem,
    formatTelegramMessage,
    sendTelegramMessage,
    buildItemInlineKeyboard,
    safeErrorMessage,
    rankFeedItems,
    filterFreshFeedItems,
    filterItemsByLookback,
    isHighSignalFeedItem,
    fetchContentFeeds,
    balanceItemsBySource,
    indexFreshFeedItems,
  });
}

function getTelegramHandlers() {
  return createTelegramHandlers({
    normalizeCommand: normalizeTelegramCommand,
    parseArgs: parseCommandArgs,
    parseIndex: parseOptionalIndex,
    topicMenu: TOPIC_MENU,
    techFilters: TECH_COMMAND_FILTERS,
    saveSubscriber,
    removeSubscriber,
    sendWelcome,
    sendLatest,
    sendFilteredLatest,
    sendTopics,
    sendFullLatest,
    sendSingleCard,
    sendSingleCardByReference,
    sendTelegramRaw,
    formatStopMessage,
    removeKeyboard: buildRemoveKeyboard,
    sendAuditChecklist,
    sendSettings,
    sendStats,
    sendRefresh,
    sendAiTest,
    sendHelp,
    sendUnknownCommand,
    sendDigestToChat,
    answerCallbackQuery,
    getLatestItems,
    sendItemReadingMode,
    saveContentFeedback,
    updateSubscriberSettings: updateSubscriberSettingsFromCallback,
    matchesDevTags,
  });
}

function indexContentSources(env) {
  return getRunPipeline().indexContentSources(env);
}

function getAiEditor(env) {
  const client = getAiClient(env);
  return createAiEditor(env, {
    callText: (request) => client.callText(request),
    requestCompletionWithFallback: (request) => client.requestCompletionWithFallback(request),
  });
}

function getQualityGate() {
  return createQualityGate({
    minPublishQuality: MIN_PUBLISH_QUALITY,
    minImmediateRelevance: MIN_IMMEDIATE_RELEVANCE,
    normalizeScore,
    hasContaminatedContent,
  });
}

function getEvidenceRules() {
  return createEvidenceRules({ cleanStructuredText, cleanHtml, normalizeList, normalizeTags, buildSearchText });
}

function buildEnrichedItem(item, structuredSummary, meta = {}) {
  return createItemBuilder({ normalizeStructuredSummary, now: () => new Date().toISOString() }).buildEnrichedItem(item, structuredSummary, meta);
}

function extractEvidenceFacts(item) { return getEvidenceRules().extractEvidenceFacts(item); }
function buildNotFor(area) { return getEvidenceRules().buildNotFor(area); }
function constrainImpactTagsToEvidence(tags, item) { return getEvidenceRules().constrainImpactTagsToEvidence(tags, item); }
function constrainDevTagsToSource(tags, item, area) { return getEvidenceRules().constrainDevTagsToSource(tags, item, area); }
function sanitizeVerifiedFacts(facts) { return getEvidenceRules().sanitizeVerifiedFacts(facts); }
function isContaminatedText(value) { return getEvidenceRules().isContaminatedText(value); }
function hasContaminatedContent(summary) { return getEvidenceRules().hasContaminatedContent(summary); }

function getStructuredParser() {
  return createStructuredParser({
    cleanStructuredText,
    cleanText,
    normalizePriority,
    normalizeRelevance,
    normalizeScore,
    inferArea,
    inferPriority,
    inferRelevance,
    inferDevTags,
    inferImpactTags,
    inferRecommendation,
    inferUrgency,
    inferAudience,
    sanitizeVerifiedFacts,
    constrainDevTagsToSource,
    constrainImpactTagsToEvidence,
    normalizeList,
    normalizeTags,
    buildClientTask,
    buildExpectedResult,
    calculateQualityScore,
    hasContaminatedContent,
    looksMostlyEnglish,
    hasCyrillic,
    minPublishQuality: MIN_PUBLISH_QUALITY,
    priorityRank: PRIORITY_RANK,
    extractEvidenceFacts,
    buildNotFor,
    buildFallbackApplicationItems: buildFallbackApplicationItemsModule,
    buildFallbackChecklistItems: buildFallbackChecklistItemsModule,
    createFallbackUaTitle,
    escapeRegExp,
  });
}

function parseAiStructured(text, item) {
  return getStructuredParser().parse(text, item);
}

function normalizeStructuredSummary(summary, item) {
  return getStructuredParser().normalize(summary, item);
}

function isStructuredSummaryUseful(summary) {
  return getStructuredParser().isUseful(summary);
}

function createFallbackStructuredSummary(item, reason = "") {
  return getStructuredParser().fallback(item, reason);
}

async function callAiText(env, options) {
  return getAiClient(env).callText(options);
}

async function requestAiCompletionWithFallback(env, options, dependencies = {}) {
  return getAiClient(env).requestCompletionWithFallback(options, dependencies);
}

async function requestAiCompletion(env, options, dependencies = {}) {
  return getAiClient(env).requestCompletion(options, dependencies);
}

