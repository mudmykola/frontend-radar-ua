function searchText(item) {
  return [
    item?.title || "", item?.uaTitle || "", item?.summary || "", item?.area || "",
    ...(Array.isArray(item?.tags) ? item.tags : []),
    ...(Array.isArray(item?.devTags) ? item.devTags : []),
    ...(Array.isArray(item?.impactTags) ? item.impactTags : []),
  ].join(" ").toLowerCase();
}

function stripHtml(value) {
  return String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function sortByPublishedDesc(left, right) {
  return new Date(right?.publishedAt || 0).getTime() - new Date(left?.publishedAt || 0).getTime();
}

export function sortItemsByDateDesc(items) {
  return [...(items || [])].sort(sortByPublishedDesc);
}

export function filterItemsByLookback(items, lookbackDays, now = Date.now()) {
  const cutoff = now - lookbackDays * 24 * 60 * 60 * 1000;
  return (items || []).filter((item) => {
    const timestamp = new Date(item?.publishedAt || "").getTime();
    return !Number.isFinite(timestamp) || timestamp >= cutoff;
  });
}

export function filterFreshFeedItems(items, now = Date.now(), windowDays = 7) {
  const cutoff = now - windowDays * 24 * 60 * 60 * 1000;
  return sortItemsByDateDesc(items).filter((item) => {
    const timestamp = new Date(item?.publishedAt || "").getTime();
    return Number.isFinite(timestamp) && timestamp >= cutoff && timestamp <= now + 5 * 60 * 1000;
  });
}

export function filterItemsWithinHours(items, hours, now = Date.now()) {
  const cutoff = now - Number(hours) * 60 * 60 * 1000;
  return sortItemsByDateDesc(items).filter((item) => {
    const timestamp = new Date(item?.publishedAt || "").getTime();
    return Number.isFinite(timestamp) && timestamp >= cutoff && timestamp <= now + 5 * 60 * 1000;
  });
}

export function isHighSignalFeedItem(item) {
  const text = searchText(item);
  const important = /security advisory|security release|vulnerab|\bcve-?\d*|breaking change|deprecat|migration required|critical/i.test(text);
  const prerelease = /\b(alpha|beta|rc|nightly|canary|snapshot|next)\b/i.test(item.title || "");
  const routineNodePatch = item.sourceId === "node" && /(?:node\.js\s+)?v?\d+\.\d+\.\d+\b/i.test(item.title || "") && !/major|minor|security|vulnerab|breaking|deprecat/i.test(text);
  const routineToolPatch = ["vite", "sass", "playwright", "nitro", "nuxt-ui", "vitest"].includes(item.sourceId) && /^v?\d+\.\d+\.\d+\b/i.test(item.title || "") && !/security|vulnerab|breaking|deprecat|migration/i.test(text);
  const irrelevantCloudflare = item.sourceId === "cloudflare" && /cloudflare one client|\bcasb\b|zero trust|saved login profiles|warp client/i.test(text);
  const genericReleaseStub = /^(?:v|dart sass |sass-api-)?\d+\.\d+\.\d+(?:[-+].*)?$/i.test(item.title || "") && /refer to .*changelog|committer metadata|creating a tag/i.test(stripHtml(item.summary || ""));

  if (prerelease && !important) return false;
  if (routineNodePatch && !important) return false;
  if (routineToolPatch && !important) return false;
  if (irrelevantCloudflare && !important) return false;
  if (genericReleaseStub && !important) return false;
  return Boolean(item.title && item.url && item.publishedAt);
}

export function rankFeedItems(items) {
  return [...(items || [])].sort((left, right) => {
    const leftText = searchText(left);
    const rightText = searchText(right);
    const priority = (text) => /security|vulnerab|cve|breaking|deprecat|migration required|critical/i.test(text)
      ? 3
      : /major|release|stable|typescript|vue|nuxt|shopify|tailwind|vite/i.test(text)
        ? 2
        : /patch|chore|dependencies/i.test(text) ? 0 : 1;
    const dateDifference = sortByPublishedDesc(left, right);
    return dateDifference || priority(rightText) - priority(leftText);
  });
}

export function balanceItemsBySource(items, perSourceLimit = 4) {
  const buckets = new Map();
  for (const item of items || []) {
    const sourceId = item.sourceId || item.source || "unknown";
    const bucket = buckets.get(sourceId) || [];
    if (bucket.length < perSourceLimit) bucket.push(item);
    buckets.set(sourceId, bucket);
  }
  return rankFeedItems([...buckets.values()].flat());
}
