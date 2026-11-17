export function createItemBuilder({ normalizeStructuredSummary, now = () => new Date().toISOString() }) {
  return { buildEnrichedItem };

  function buildEnrichedItem(item, structuredSummary, meta = {}) {
    const normalized = normalizeStructuredSummary({ ...structuredSummary, usedFallback: meta.usedFallback }, item);
    return {
      ...item,
      itemId: meta.itemId || item.itemId || "",
      uaTitle: normalized.uaTitle, priority: normalized.priority, relevance: normalized.relevance, area: normalized.area,
      devTags: normalized.devTags, impactTags: normalized.impactTags, clientTask: normalized.clientTask,
      benefit: normalized.benefit, risk: normalized.risk, effort: normalized.effort, confidence: normalized.confidence,
      recommendation: normalized.recommendation, hiddenInsight: normalized.hiddenInsight, notFor: normalized.notFor,
      clientOpportunity: normalized.clientOpportunity, urgency: normalized.urgency, audience: normalized.audience,
      verifiedFacts: normalized.verifiedFacts, aiConclusion: normalized.aiConclusion, assumptions: normalized.assumptions,
      before: normalized.before, after: normalized.after, expectedResult: normalized.expectedResult,
      timeEstimate: normalized.timeEstimate, todayAction: normalized.todayAction, qualityScore: normalized.qualityScore,
      essence: normalized.essence, importance: normalized.importance, applicationItems: normalized.applicationItems,
      checklistItems: normalized.checklistItems, devIdea: normalized.devIdea, usedFallback: Boolean(meta.usedFallback),
      fallbackReason: meta.fallbackReason || null, rawAiSummary: meta.rawAiSummary || null, savedAt: now(),
    };
  }
}
