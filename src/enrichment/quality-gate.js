export function createQualityGate(options) {
  const { minPublishQuality = 70, minImmediateRelevance = 7, normalizeScore, hasContaminatedContent } = options;
  return { shouldSendImmediate, isPublishableItem };

  function shouldSendImmediate(item) {
    if (item.priority === "P0") return true;
    const relevance = Number(item.relevance || 0);
    const benefit = normalizeScore(item.benefit, 5);
    const risk = normalizeScore(item.risk, 4);
    const confidence = normalizeScore(item.confidence, 5);
    if (item.priority === "P1") return confidence >= 6 && ((relevance >= minImmediateRelevance && benefit >= 6) || risk >= 7);
    return relevance >= 9 && benefit >= 8 && confidence >= 7;
  }

  function isPublishableItem(item) {
    return Boolean(item && !item.pendingEnrichment && !item.usedFallback && Number(item.qualityScore || 0) >= minPublishQuality && Array.isArray(item.verifiedFacts) && item.verifiedFacts.length >= 2 && !hasContaminatedContent(item));
  }
}
