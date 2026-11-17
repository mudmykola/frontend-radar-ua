export function createStructuredParser(options) {
  const {
    cleanStructuredText, cleanText, normalizePriority, normalizeRelevance, normalizeScore,
    inferArea, inferPriority, inferRelevance, inferDevTags, inferImpactTags, inferRecommendation,
    inferUrgency, inferAudience, sanitizeVerifiedFacts, constrainDevTagsToSource, constrainImpactTagsToEvidence, normalizeList, normalizeTags,
    buildClientTask, buildExpectedResult, calculateQualityScore, hasContaminatedContent,
    looksMostlyEnglish, hasCyrillic, minPublishQuality, priorityRank, extractEvidenceFacts,
    buildNotFor, buildFallbackApplicationItems, buildFallbackChecklistItems, createFallbackUaTitle,
    escapeRegExp,
  } = options;

  return { parse, normalize, isUseful, fallback };

function parse(text, item) {
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

  return normalize(
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

function normalize(summary, item) {
  const fallbackTitle = createFallbackUaTitle(item);
  const evidencePriority = inferPriority(item);
  const requestedPriority = normalizePriority(summary.priority);
  const priority = priorityRank[requestedPriority] < priorityRank[evidencePriority]
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

function isUseful(summary) {
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
  if (Number(summary.qualityScore || 0) < minPublishQuality) return false;

  return true;
}

function fallback(item, reason = "") {
  const priority = inferPriority(item);
  const area = inferArea(item);
  const relevance = inferRelevance(item, priority);
  const title = createFallbackUaTitle(item);
  const tags = inferDevTags(item, area);
  const impactTags = inferImpactTags(item, priority, area);
  const verifiedFacts = extractEvidenceFacts(item);
  const sourceName = cleanStructuredText(item.source || "Офіційне джерело");
  const firstFact = verifiedFacts[0] || cleanStructuredText(item.summary || item.title);

  return normalize(
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

}

