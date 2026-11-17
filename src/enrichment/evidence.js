export function createEvidenceRules({ cleanStructuredText, cleanHtml, normalizeList, normalizeTags, buildSearchText }) {
  return { extractEvidenceFacts, buildNotFor, constrainImpactTagsToEvidence, constrainDevTagsToSource, sanitizeVerifiedFacts, isContaminatedText, hasContaminatedContent };

  function extractEvidenceFacts(item) {
    const text = cleanStructuredText(item.articleContext || cleanHtml(item.summary || ""));
    const facts = text.split(/(?<=[.!?])\s+/).map((sentence) => cleanStructuredText(sentence).slice(0, 260)).filter((sentence) => sentence.length >= 25).slice(0, 3);
    if (facts.length < 2 && item.title) facts.push(`Офіційний заголовок: ${cleanStructuredText(item.title).slice(0, 180)}`);
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
      vue: ["vue", "javascript", "typescript", "ui", "a11y", "reactivity"], nuxt: ["nuxt", "vue", "ssr", "nitro", "javascript", "typescript", "performance"], pinia: ["pinia", "vue", "state-management", "javascript", "typescript"], vite: ["vite", "javascript", "typescript", "build-tools", "performance"], tailwind: ["tailwind", "css", "ui", "a11y"], typescript: ["typescript", "javascript", "build-tools"], sass: ["sass", "scss", "css", "ui"], node: ["node", "javascript", "typescript", "runtime", "performance", "security"], mdn: ["javascript", "css", "web-platform", "ui", "a11y", "browser-api", "performance"], cloudflare: ["cloudflare", "workers", "edge", "workerd", "durable-objects", "kv", "d1", "r2", "queues", "javascript", "typescript", "performance", "security"],
    };
    const allowed = new Set([...(families[sourceId] || []), ...base]);
    const areaTag = normalizeTags([area])[0];
    if (areaTag) allowed.add(areaTag);
    return normalizeTags(tags).filter((tag) => allowed.has(tag));
  }

  function sanitizeVerifiedFacts(facts) { return normalizeList(facts).filter((fact) => !isContaminatedText(fact)); }
  function isContaminatedText(value) { return /you signed (?:in|out)|reload to refresh|dismiss alert|skip to content|github navigation|cookie preferences|content loading/i.test(String(value || "")); }
  function hasContaminatedContent(summary) { return [summary?.uaTitle, summary?.essence, summary?.importance, summary?.aiConclusion, ...(summary?.verifiedFacts || [])].some(isContaminatedText); }
}
