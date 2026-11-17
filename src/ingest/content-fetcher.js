export function createContentFetcher(options) {
  const { sources, fetchImpl = fetch, timeoutMs, maxFeedBytes, maxItemsPerSource, readResponseTextLimited, parseRssFeed, parseAtomFeed, normalizeReleaseIdentity, rankFeedItems, safeErrorMessage } = options;

  return { fetchContentFeeds, fetchContentSource };

  async function fetchContentFeeds() {
    const results = await Promise.allSettled(sources.map(fetchContentSource));
    const items = [];
    results.forEach((result, index) => {
      if (result.status === "fulfilled") items.push(...result.value);
      else console.warn("Content source unavailable:", { source: sources[index].id, error: safeErrorMessage(result.reason) });
    });
    if (!items.length) throw new Error("All frontend content sources failed");
    const deduplicated = new Map();
    for (const item of items) {
      const key = normalizeReleaseIdentity(item);
      const current = deduplicated.get(key);
      if (!current || new Date(item.publishedAt || 0) > new Date(current.publishedAt || 0)) deduplicated.set(key, item);
    }
    return rankFeedItems([...deduplicated.values()]);
  }

  async function fetchContentSource(source) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(source.feedUrl, {
        headers: { "User-Agent": "FrontendIntelligenceRadarUA/15.0", Accept: "application/atom+xml, application/rss+xml, application/xml, text/xml" },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`${source.name} failed: ${response.status}`);
      const xml = await readResponseTextLimited(response, maxFeedBytes);
      const parsed = source.format === "atom" ? parseAtomFeed(xml, source) : parseRssFeed(xml, source);
      return parsed.slice(0, maxItemsPerSource);
    } finally {
      clearTimeout(timeout);
    }
  }
}
