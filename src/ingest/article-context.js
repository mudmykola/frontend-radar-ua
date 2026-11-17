export function createArticleContext(options) {
  const { approvedHosts, fetchImpl = fetch, timeoutMs, maxChars, readResponseTextLimited, cleanHtml, safeIsoDate } = options;

  return { enrichItemWithArticleContext, fetchArticleContext, extractReadableArticleText };

  async function enrichItemWithArticleContext(item) {
    try {
      const context = await fetchArticleContext(item?.url);
      if (!context?.text) return { ...item, articleContext: "", contextSource: "rss" };
      return { ...item, articleContext: context.text, contextSource: context.source || "article", contextFetchedAt: new Date().toISOString() };
    } catch {
      return { ...item, articleContext: "", contextSource: "rss" };
    }
  }

  async function fetchArticleContext(value) {
    const initialUrl = String(value || "").trim();
    if (!initialUrl) return null;
    let currentUrl = initialUrl;
    for (let redirect = 0; redirect < 3; redirect += 1) {
      const parsed = new URL(currentUrl);
      if (parsed.protocol !== "https:" || !approvedHosts.has(parsed.hostname)) throw new Error("Article host is not approved");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(currentUrl, { redirect: "manual", headers: { Accept: "text/html,application/xhtml+xml" }, signal: controller.signal });
        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get("location");
          if (!location) return null;
          const nextUrl = new URL(location, currentUrl);
          if (nextUrl.protocol !== "https:" || !approvedHosts.has(nextUrl.hostname)) throw new Error("Unsafe article redirect");
          currentUrl = nextUrl.toString();
          continue;
        }
        if (!response.ok) return null;
        const contentType = response.headers.get("content-type") || "";
        if (contentType && !/html|text/i.test(contentType)) return null;
        const html = await readResponseTextLimited(response, maxChars * 4);
        const text = extractReadableArticleText(html);
        return text ? { text, source: "article", publishedAt: safeIsoDate(response.headers.get("last-modified") || "") } : null;
      } finally {
        clearTimeout(timeout);
      }
    }
    return null;
  }

  function extractReadableArticleText(html) {
    const raw = String(html || "");
    const mainMatch = raw.match(/<(?:main|article)\b[^>]*>([\s\S]*?)<\/(?:main|article)>/i);
    const content = mainMatch?.[1] || raw;
    return cleanHtml(content
      .replace(/<(script|style|nav|header|footer|aside|form|noscript|svg)[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/You signed (?:in|out) in another tab or window\.?/gi, " ")
      .replace(/Reload to refresh your session\.?/gi, " ")
      .replace(/Dismiss alert/gi, " "))
      .slice(0, maxChars)
      .trim();
  }
}
