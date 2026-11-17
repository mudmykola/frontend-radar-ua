export function createHttpHandlers(deps) {
  const {
    serviceName,
    serviceVersion,
    maxWebhookBodyBytes,
    minPublishQuality,
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
  } = deps;

  return {
    "/health": health,
    "/configure-telegram-webhook": configureWebhook,
    "/index-sources": indexSources,
    "/reprocess-content": reprocessContent,
    "/telegram-webhook-info": telegramWebhookInfo,
    "/telegram-webhook": telegramWebhook,
    "/test-ai": testAi,
    "/debug-env": debugEnv,
    "/subscribers": subscribers,
    "/run": runRoute,
    "/bootstrap": bootstrap,
    "/send-digest": sendDigest,
    "/audit": audit,
  };

  async function health() {
    return Response.json({ ok: true, service: `${serviceName} ${serviceVersion}`, time: new Date().toISOString() });
  }

  async function configureWebhook(request, env) {
    if (!(await isTelegramWebhookAuthorized(request, env))) return unauthorized();
    try {
      return Response.json({ ok: true, webhook: await configureTelegramWebhook(request, env) });
    } catch (error) {
      console.error("Telegram webhook configuration failed:", safeErrorMessage(error));
      return Response.json({ ok: false, error: "Telegram webhook configuration failed" }, { status: 502 });
    }
  }

  async function indexSources(_request, env) {
    if (!(await isTelegramWebhookAuthorized(_request, env))) return unauthorized();
    try {
      const { fetched, indexed, sources } = await indexContentSources(env);
      return Response.json({ ok: true, fetched, indexed, sources });
    } catch (error) {
      console.error("Content source indexing failed:", safeErrorMessage(error));
      return Response.json({ ok: false, error: "Content source indexing failed" }, { status: 502 });
    }
  }

  async function reprocessContent(_request, env, _ctx, url) {
    if (!(await isTelegramWebhookAuthorized(_request, env))) return unauthorized();
    try {
      const limit = Math.min(5, Math.max(1, Number(url.searchParams.get("limit") || 3)));
      const result = await run(env, { silent: true, limit });
      return Response.json({
        ok: true,
        checked: result.checked,
        fresh: result.fresh,
        processed: result.processed,
        publishable: result.savedOnlyItems.filter((item) => !item.usedFallback && item.qualityScore >= minPublishQuality).length,
        fallback: result.savedOnlyItems.filter((item) => item.usedFallback).length,
        failed: result.failed,
      });
    } catch (error) {
      console.error("Content reprocessing failed:", safeErrorMessage(error));
      return Response.json({ ok: false, error: "Content reprocessing failed" }, { status: 502 });
    }
  }

  async function telegramWebhookInfo(_request, env) {
    if (!(await isTelegramWebhookAuthorized(_request, env))) return unauthorized();
    try {
      return Response.json({ ok: true, webhook: await getTelegramWebhookInfo(env) });
    } catch (error) {
      console.error("Telegram webhook inspection failed:", safeErrorMessage(error));
      return Response.json({ ok: false, error: "Telegram webhook inspection failed" }, { status: 502 });
    }
  }

  async function telegramWebhook(request, env, ctx) {
    if (!(await isTelegramWebhookAuthorized(request, env))) return unauthorized();
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.toLowerCase().startsWith("application/json")) {
      return Response.json({ ok: false, error: "Unsupported Media Type" }, { status: 415 });
    }
    try {
      const contentLength = Number(request.headers.get("content-length") || 0);
      if (contentLength > maxWebhookBodyBytes) return Response.json({ ok: false, error: "Payload Too Large" }, { status: 413 });
      const rawBody = await request.text();
      if (new TextEncoder().encode(rawBody).byteLength > maxWebhookBodyBytes) {
        return Response.json({ ok: false, error: "Payload Too Large" }, { status: 413 });
      }
      const update = JSON.parse(rawBody);
      ctx.waitUntil(Promise.resolve().then(() => handleTelegramWebhookOnce(update, env)));
      return Response.json({ ok: true });
    } catch (error) {
      console.error("Telegram webhook rejected:", safeErrorMessage(error));
      return Response.json({ ok: false, error: "Invalid webhook payload" }, { status: 400 });
    }
  }

  async function testAi(_request, env) {
    if (!(await isAdminAuthorized(_request, env))) return unauthorized();
    try {
      const item = {
        source: "Shopify Developer Changelog",
        title: "Automatic CSS subsetting for {% stylesheet %} tags",
        url: "https://shopify.dev/changelog",
        summary: "Shopify is introducing CSS content subsetting for stylesheet tags to improve storefront performance.",
        publishedAt: new Date().toISOString(),
        tags: ["themes", "liquid", "sections", "performance"],
      };
      const rawAiSummary = await summarizeWithAi(item, env);
      const structuredSummary = parseAiStructured(rawAiSummary, item);
      const useful = isStructuredSummaryUseful(structuredSummary);
      const enrichedItem = buildEnrichedItem(item, structuredSummary, {
        rawAiSummary,
        usedFallback: !useful,
        fallbackReason: useful ? null : "AI returned incomplete or generic structured response",
      });
      return Response.json({ ok: true, aiWorking: true, useful, qualityScore: enrichedItem.qualityScore, rawAiSummary, structuredSummary: enrichedItem });
    } catch (error) {
      return Response.json({ ok: false, aiWorking: false, error: safeErrorMessage(error) }, { status: 500 });
    }
  }

  async function debugEnv(_request, env) {
    if (!(await isAdminAuthorized(_request, env))) return unauthorized();
    const subscribersList = await getSubscribers(env);
    const latest = await getLatestItems(env);
    const digest = await getDigestItems(env);
    const lastRun = await getLastRun(env);
    const stats = buildStats(latest, digest, subscribersList, lastRun);
    return Response.json({
      ok: true, service: `${serviceName} ${serviceVersion}`, hasKv: Boolean(env.SHOPIFY_RADAR_KV),
      hasTelegramToken: Boolean(env.TELEGRAM_BOT_TOKEN), hasLegacyTelegramChatId: Boolean(env.TELEGRAM_CHAT_ID),
      hasAdminTelegramChatId: Boolean(env.ADMIN_TELEGRAM_CHAT_ID), subscribersCount: subscribersList.length,
      latestCount: latest.length, digestCount: digest.length,
      latestNeedsBootstrap: latestNeedsBootstrap(latest, { includeStaleCheck: true }),
      latestStructuredCount: latest.filter(hasStructuredFields).length, latestAverageQuality: stats.latestAverageQuality,
      fallbackCount: stats.latestFallbackCount, lastRun,
      latestTop: latest.slice(0, 3).map((item) => ({ title: item.title, uaTitle: item.uaTitle, publishedAt: item.publishedAt, priority: item.priority, relevance: item.relevance, area: item.area, devTags: item.devTags, impactTags: item.impactTags, qualityScore: item.qualityScore, hasStructuredFields: hasStructuredFields(item), usedFallback: Boolean(item.usedFallback) })),
      hasAiApiKey: Boolean(env.AI_API_KEY), hasAiBaseUrl: Boolean(env.AI_BASE_URL), aiBaseUrl: env.AI_BASE_URL || null,
      hasAiModel: Boolean(env.AI_MODEL), aiModel: env.AI_MODEL || null, hasAdminSecret: Boolean(env.ADMIN_SECRET),
    });
  }

  async function subscribers(_request, env) {
    if (!(await isAdminAuthorized(_request, env))) return unauthorized();
    const list = await getSubscribers(env);
    return Response.json({ ok: true, count: list.length, subscribers: list });
  }

  async function runRoute(request, env, _ctx, url) {
    if (!(await isAdminAuthorized(request, env))) return unauthorized();
    try {
      const result = await run(env, { silent: url.searchParams.get("silent") === "1", limit: Number(url.searchParams.get("limit") || 3), ignoreSeen: url.searchParams.get("ignoreSeen") === "1", debug: url.searchParams.get("debug") === "1" });
      return Response.json({ ok: true, ...result });
    } catch (error) {
      return Response.json({ ok: false, error: safeErrorMessage(error) }, { status: 500 });
    }
  }

  async function bootstrap(_request, env) {
    if (!(await isAdminAuthorized(_request, env))) return unauthorized();
    try {
      const result = await bootstrapLatestNews(env);
      return Response.json({ ok: true, latestCount: result.latest.length, processed: result.runResult.processed, usedIgnoreSeen: true, broadcast: false, latest: result.latest.slice(0, 12) });
    } catch (error) {
      return Response.json({ ok: false, error: safeErrorMessage(error) }, { status: 500 });
    }
  }

  async function sendDigest(_request, env) {
    if (!(await isAdminAuthorized(_request, env))) return unauthorized();
    return Response.json({ ok: true, ...(await sendDailyDigest(env, { force: true })) });
  }

  async function audit(_request, env) {
    if (!(await isAdminAuthorized(_request, env))) return unauthorized();
    await ensureInitialNews(env);
    const latest = await getLatestItems(env);
    return Response.json({ ok: true, audit: buildAuditData(latest.slice(0, 20)) });
  }

  function unauthorized() {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
}
