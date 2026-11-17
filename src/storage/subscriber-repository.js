export function createSubscriberRepository(env, options) {
  const {
    subscriberPrefix,
    subscribersKey,
    feedbackPrefix,
    subscribersLimit,
    feedbackTtlSeconds,
    readJsonObjectsByPrefix,
    readJsonArray,
    normalizePreferences,
    normalizeTags,
    normalizeStoredStructuredItem,
    normalizeScore,
    createItemId,
  } = options;

  return { saveSubscriber, removeSubscriber, getSubscribers, updateSubscriber, saveContentFeedback, personalizeItems };

  async function saveSubscriber(chatId, message) {
    const subscribers = await getSubscribers();
    const id = String(chatId);
    const user = message?.from || {};
    const chat = message?.chat || {};
    const existing = subscribers.find((item) => String(item.chatId) === id);
    const subscriber = {
      chatId: id,
      type: chat.type || existing?.type || "private",
      username: user.username || chat.username || existing?.username || null,
      firstName: user.first_name || chat.first_name || existing?.firstName || null,
      lastName: user.last_name || chat.last_name || existing?.lastName || null,
      joinedAt: existing?.joinedAt || new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      active: true,
      preferences: normalizePreferences(existing?.preferences),
    };
    await env.SHOPIFY_RADAR_KV.put(subscriberPrefix + encodeURIComponent(id), JSON.stringify(subscriber));
    return subscriber;
  }

  async function removeSubscriber(chatId) {
    const id = String(chatId);
    await env.SHOPIFY_RADAR_KV.put(subscriberPrefix + encodeURIComponent(id), JSON.stringify({ chatId: id, active: false, lastSeenAt: new Date().toISOString() }));
    return getSubscribers();
  }

  async function getSubscribers() {
    const [individual, legacy] = await Promise.all([
      readJsonObjectsByPrefix(env, subscriberPrefix, subscribersLimit),
      readJsonArray(env, subscribersKey),
    ]);
    const byId = new Map();
    for (const subscriber of [...legacy, ...individual]) {
      if (subscriber?.chatId) byId.set(String(subscriber.chatId), subscriber);
    }
    return [...byId.values()]
      .filter((item) => item?.chatId && item.active !== false)
      .map((subscriber) => ({ ...subscriber, preferences: normalizePreferences(subscriber.preferences) }))
      .sort((a, b) => String(b.lastSeenAt || "").localeCompare(String(a.lastSeenAt || "")))
      .slice(0, subscribersLimit);
  }

  async function updateSubscriber(chatId, updater) {
    const subscribers = await getSubscribers();
    const id = String(chatId);
    const existing = subscribers.find((subscriber) => String(subscriber.chatId) === id) || {
      chatId: id, type: "private", joinedAt: new Date().toISOString(), active: true, preferences: normalizePreferences(),
    };
    const updated = updater({ ...existing, preferences: normalizePreferences(existing.preferences), lastSeenAt: new Date().toISOString() });
    await env.SHOPIFY_RADAR_KV.put(subscriberPrefix + encodeURIComponent(id), JSON.stringify(updated));
    return updated;
  }

  async function saveContentFeedback(chatId, item, reaction) {
    const itemId = String(item.itemId || (await createItemId(item)));
    const record = {
      itemId, reaction, area: item.area || "Shopify Dev",
      tags: normalizeTags([...(item.devTags || []), ...(item.impactTags || [])]).slice(0, 12),
      createdAt: new Date().toISOString(),
    };
    await env.SHOPIFY_RADAR_KV.put(feedbackPrefix + encodeURIComponent(String(chatId)) + ":" + itemId, JSON.stringify(record), { expirationTtl: feedbackTtlSeconds });
  }

  async function personalizeItems(chatId, items) {
    const feedback = await readJsonObjectsByPrefix(env, feedbackPrefix + encodeURIComponent(String(chatId)) + ":", 200);
    const weights = new Map();
    for (const record of feedback) {
      const delta = record.reaction === "interesting" ? 2 : record.reaction === "useful" ? 1.5 : record.reaction === "not-understood" ? 0.25 : -2.5;
      for (const signal of normalizeTags([record.area || "", ...(record.tags || [])])) weights.set(signal, (weights.get(signal) || 0) + delta);
    }
    return [...items].sort((left, right) => score(right) - score(left));

    function score(item) {
      const normalized = normalizeStoredStructuredItem(item);
      const signals = normalizeTags([normalized.area || "", ...(normalized.devTags || []), ...(normalized.impactTags || [])]);
      const preferenceBoost = signals.reduce((sum, signal) => sum + (weights.get(signal) || 0), 0);
      return Number(normalized.relevance || 0) * 1.5 + normalizeScore(normalized.benefit, 5) + normalizeScore(normalized.risk, 4) * 0.5 + preferenceBoost;
    }
  }
}
