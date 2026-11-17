export function createTelegramFormatters(options) {
  const { normalizeStoredStructuredItem, getPriorityBadge, getPriorityLabel, translateArea, escapeHtml, cleanStructuredText, inferAudience } = options;
  return { formatCompactItems };

  function formatCompactItems(items) {
    if (!items.length) return "🧊 Немає новин для показу.";
    return items.map((rawItem, index) => {
      const item = normalizeStoredStructuredItem(rawItem);
      const priority = item.priority || "P2";
      const date = item.publishedAt ? `🗓 ${escapeHtml(item.publishedAt.slice(0, 10))}` : "";
      const area = translateArea(item.area || "Shopify Dev");
      const audience = cleanStructuredText(item.audience || inferAudience(area));
      return [
        `${index + 1}. ${getPriorityBadge(priority)} <b>${escapeHtml(item.uaTitle || item.title || "Без назви")}</b>`,
        `${date} · <code>${escapeHtml(area)}</code> · ${escapeHtml(getPriorityLabel(priority))}`,
        `Що змінилося: ${escapeHtml(item.essence || item.aiConclusion || "")}`,
        `Кому: ${escapeHtml(audience)}`,
        `Що зробити: ${escapeHtml(item.todayAction || item.clientTask || "")}`,
        `👉 Натисни «Розбір ${index + 1}» під повідомленням`,
      ].filter(Boolean).join("\n");
    }).join("\n\n");
  }
}
