export function createRunPipeline(options) {
  const {
    maxItemsPerRun, latestItemKeyPrefix, runLastKey, seenTtlSeconds, latestItemsLimit,
    lookbackDays, maxIndexedItemsPerSource, validateEnv, clampNumber, indexSources,
    createItemId, shouldReenrichItem, enrichItemWithArticleContext, extractEvidenceFacts,
    inferPriority, summarizeWithAi, parseAiStructured, isStructuredSummaryUseful,
    createFallbackStructuredSummary, buildEnrichedItem, isPublishableItem, shouldSendImmediate,
    saveLatestItem, saveDigestItem, formatTelegramMessage, sendTelegramMessage,
    buildItemInlineKeyboard, safeErrorMessage, rankFeedItems, filterFreshFeedItems,
    filterItemsByLookback, isHighSignalFeedItem, fetchContentFeeds, balanceItemsBySource,
    indexFreshFeedItems, now = () => Date.now(), isoNow = () => new Date().toISOString(),
    logError = console.error,
  } = options;

  return { run, indexContentSources, buildRunResultItem, saveLastRun };

  async function run(env, options = {}) {
    validateEnv(env);
    const silent = Boolean(options.silent);
    const ignoreSeen = Boolean(options.ignoreSeen);
    const debug = Boolean(options.debug);
    const limit = clampNumber(options.limit || maxItemsPerRun, 1, 30);
    const { items: recentItems, fetched } = await indexContentSources(env);
    const freshItems = [];

    for (const item of recentItems) {
      if (ignoreSeen) { freshItems.push(item); continue; }
      const id = await createItemId(item);
      const seen = await env.SHOPIFY_RADAR_KV.get(`seen:${id}`);
      const storedRaw = await env.SHOPIFY_RADAR_KV.get(`${latestItemKeyPrefix}${id}`);
      let storedItem = null;
      try { storedItem = storedRaw ? JSON.parse(storedRaw) : null; } catch { storedItem = null; }
      if (!seen || shouldReenrichItem(storedItem)) {
        const storedAt = new Date(storedItem?.savedAt || 0).getTime();
        const isPendingBacklog = Boolean(storedItem?.pendingEnrichment && Number.isFinite(storedAt) && now() - storedAt > 5 * 60 * 1000);
        freshItems.push({ ...item, suppressBroadcast: isPendingBacklog });
      }
    }

    const sentItems = [], savedOnlyItems = [], failedItems = [];
    for (const item of freshItems.slice(0, limit)) {
      const id = await createItemId(item);
      try {
        const sourceItem = await enrichItemWithArticleContext(item);
        let structuredSummary, usedFallback = false, fallbackReason = "", rawAiSummary = "";
        try {
          const factAnalysis = JSON.stringify({ verifiedFacts: extractEvidenceFacts(sourceItem), evidencePriority: inferPriority(sourceItem), source: sourceItem.source });
          rawAiSummary = await summarizeWithAi(sourceItem, env, factAnalysis);
          structuredSummary = parseAiStructured(rawAiSummary, sourceItem);
          if (!isStructuredSummaryUseful(structuredSummary)) {
            usedFallback = true;
            fallbackReason = "AI returned incomplete or generic structured response";
            structuredSummary = createFallbackStructuredSummary(sourceItem, fallbackReason);
          }
        } catch (error) {
          usedFallback = true;
          fallbackReason = safeErrorMessage(error);
          structuredSummary = createFallbackStructuredSummary(sourceItem, fallbackReason);
          logError("AI summary failed, using structured fallback:", { title: item.title, url: item.url, error: fallbackReason });
        }

        const enrichedItem = buildEnrichedItem(sourceItem, structuredSummary, { itemId: id, rawAiSummary, usedFallback, fallbackReason });
        const shouldSendNow = !silent && !ignoreSeen && !sourceItem.suppressBroadcast && isPublishableItem(enrichedItem) && shouldSendImmediate(enrichedItem);
        await saveLatestItem(enrichedItem, env);
        await saveDigestItem(enrichedItem, env);
        const resultItem = buildRunResultItem(enrichedItem, { silent, ignoreSeen, usedFallback, fallbackReason, rawAiSummary: debug ? rawAiSummary : "" });
        if (shouldSendNow) {
          const sendResult = await sendTelegramMessage(formatTelegramMessage(enrichedItem), env, { item: enrichedItem, replyMarkup: buildItemInlineKeyboard(enrichedItem) });
          sentItems.push({ ...resultItem, subscribers: sendResult?.subscribers || 0, deliveredSubscribers: sendResult?.deliveredSubscribers || 0, skippedSubscribers: sendResult?.skippedSubscribers || 0, failedSubscribers: sendResult?.failed?.length || 0 });
        } else savedOnlyItems.push(resultItem);
        await env.SHOPIFY_RADAR_KV.put(`seen:${id}`, JSON.stringify({ title: item.title, uaTitle: enrichedItem.uaTitle, url: item.url, source: item.source, publishedAt: item.publishedAt || null, priority: enrichedItem.priority, relevance: enrichedItem.relevance, qualityScore: enrichedItem.qualityScore, sentImmediately: shouldSendNow, silent, ignoreSeen, usedFallback, fallbackReason: fallbackReason || null, seenAt: isoNow() }), { expirationTtl: seenTtlSeconds });
      } catch (error) {
        failedItems.push({ title: item.title, url: item.url, error: safeErrorMessage(error) });
        logError("Failed to process item:", { title: item.title, url: item.url, error: safeErrorMessage(error) });
      }
    }

    const result = { checked: fetched, recent: recentItems.length, fresh: freshItems.length, processed: Math.min(freshItems.length, limit), sent: sentItems.length, savedOnly: savedOnlyItems.length, failed: failedItems.length, silent, ignoreSeen, debug, limit, sentItems, savedOnlyItems, failedItems };
    await saveLastRun(env, result);
    return result;
  }

  async function indexContentSources(env) {
    validateEnv(env);
    const allItems = await fetchContentFeeds();
    const recentItems = rankFeedItems(filterFreshFeedItems(filterItemsByLookback(allItems, lookbackDays)).filter(isHighSignalFeedItem));
    const indexedItems = balanceItemsBySource(recentItems, maxIndexedItemsPerSource).slice(0, latestItemsLimit);
    await indexFreshFeedItems(indexedItems, env);
    return { items: recentItems, fetched: allItems.length, indexed: indexedItems.length, sources: new Set(indexedItems.map((item) => item.sourceId)).size };
  }

  function buildRunResultItem(item, meta = {}) {
    const result = { title: item.title, uaTitle: item.uaTitle, url: item.url, priority: item.priority, relevance: item.relevance, area: item.area, qualityScore: item.qualityScore, impactTags: item.impactTags || [], usedFallback: Boolean(meta.usedFallback), fallbackReason: meta.fallbackReason || null, silent: Boolean(meta.silent), ignoreSeen: Boolean(meta.ignoreSeen) };
    if (meta.rawAiSummary) result.rawAiPreview = meta.rawAiSummary.slice(0, 1200);
    return result;
  }

  async function saveLastRun(env, result) {
    const fallbackCount = [...(result.sentItems || []), ...(result.savedOnlyItems || [])].filter((item) => item.usedFallback).length;
    await env.SHOPIFY_RADAR_KV.put(runLastKey, JSON.stringify({ time: isoNow(), checked: result.checked, recent: result.recent, fresh: result.fresh, processed: result.processed, sent: result.sent, savedOnly: result.savedOnly, failed: result.failed, fallbackCount, silent: result.silent, ignoreSeen: result.ignoreSeen }));
  }
}
