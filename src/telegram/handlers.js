export function createTelegramHandlers(options) {
  const {
    normalizeCommand, parseArgs, parseIndex, topicMenu = [], techFilters = {},
    saveSubscriber, removeSubscriber, sendWelcome, sendLatest, sendFilteredLatest,
    sendTopics, sendFullLatest, sendSingleCard, sendSingleCardByReference,
    sendTelegramRaw, formatStopMessage, removeKeyboard, sendAuditChecklist,
    sendSettings, sendStats, sendRefresh, sendAiTest, sendHelp, sendUnknownCommand, sendDigestToChat,
    answerCallbackQuery, getLatestItems, sendItemReadingMode, saveContentFeedback,
    updateSubscriberSettings, matchesDevTags, errorLogger = console.error,
  } = options;

  return { handleMessage, handleCallback };

  async function handleMessage(update, env) {
    if (update?.callback_query) return handleCallback(update.callback_query, env);
    const message = update?.message || update?.edited_message;
    if (!message) return;
    const chatId = message?.chat?.id;
    if (!chatId) return;
    const text = String(message?.text || "").trim();
    const command = normalizeCommand(text);
    const args = parseArgs(text);
    if (command === "/start") return sendWelcome(chatId, env, await saveSubscriber(chatId, message, env));
    if (command === "/stop") { await removeSubscriber(chatId, env); return sendTelegramRaw(chatId, formatStopMessage(), env, { replyMarkup: removeKeyboard() }); }
    if (command === "/latest") { await saveSubscriber(chatId, message, env); return sendLatest(chatId, env); }
    if (command === "/practice") return filtered(chatId, message, env, "🧰 ПРАКТИЧНІ ЗМІНИ", "🧰 Практичних змін поки немає", (item) => Boolean((item.todayAction || item.clientTask) && ((item.applicationItems || []).length || (item.checklistItems || []).length)));
    if (command === "/topics") { await saveSubscriber(chatId, message, env); return sendTopics(chatId, env); }
    if (command === "/full") { await saveSubscriber(chatId, message, env); return sendFullLatest(chatId, env, { singleIndex: parseIndex(args[0]) }); }
    if (command === "/card") { await saveSubscriber(chatId, message, env); return sendSingleCard(chatId, env, parseIndex(args[0]) || 1); }
    if (command === "/p0") return filtered(chatId, message, env, "🚨 КРИТИЧНІ ЗМІНИ", "🚨 Критичних змін поки немає", (item) => item.priority === "P0");
    if (command === "/themes") return filtered(chatId, message, env, "🎨 ТЕМИ, LIQUID І СЕКЦІЇ", "🎨 Новин по темах поки немає", (item) => matchesDevTags(item, ["themes", "liquid", "sections", "online-store"]));
    if (command === "/performance") return filtered(chatId, message, env, "⚡ ШВИДКІСТЬ, SEO ТА ОПТИМІЗАЦІЯ", "⚡ Новин по швидкості та SEO поки немає", (item) => matchesDevTags(item, ["performance", "seo", "css", "assets", "speed"]));
    if (techFilters[command]) { const filter = techFilters[command]; return filtered(chatId, message, env, filter.title, filter.emptyTitle, (item) => matchesDevTags(item, filter.tags)); }
    const simple = { "/digest": () => sendDigestToChat(chatId, env), "/audit": () => sendAuditChecklist(chatId, env), "/stats": () => sendStats(chatId, env), "/refresh": () => sendRefresh(chatId, env), "/help": () => sendHelp(chatId, env), "/test_ai": () => sendAiTest(chatId, env), "/testai": () => sendAiTest(chatId, env), "/test-ai": () => sendAiTest(chatId, env) };
    if (command === "/settings") { const subscriber = await saveSubscriber(chatId, message, env); return sendSettings(chatId, env, subscriber); }
    if (simple[command]) { await saveSubscriber(chatId, message, env); return simple[command](); }
    return sendUnknownCommand(chatId, env);
    async function filtered(id, msg, runtime, title, emptyTitle, predicate) { await saveSubscriber(id, msg, runtime); return sendFilteredLatest(id, runtime, { title, emptyTitle, predicate }); }
  }

  async function handleCallback(callbackQuery, env) {
    const chatId = callbackQuery?.message?.chat?.id;
    const messageId = callbackQuery?.message?.message_id;
    const data = String(callbackQuery?.data || "");
    if (!chatId) return;
    try {
      if (data.startsWith("article:")) { const [, ref, index, total] = data.split(":"); await answerCallbackQuery(callbackQuery.id, env, "Відкриваю обрану статтю..."); return sendSingleCardByReference(chatId, env, ref, { index: parseIndex(index), total: parseIndex(total) }); }
      if (data.startsWith("card:")) { const index = Number(data.split(":")[1]); await answerCallbackQuery(callbackQuery.id, env, "Відкриваю розбір..."); return sendSingleCard(chatId, env, Number.isFinite(index) ? index + 1 : 1); }
      if (data === "latest") { await answerCallbackQuery(callbackQuery.id, env, "Останні новини"); return sendLatest(chatId, env); }
      if (data === "topics") { await answerCallbackQuery(callbackQuery.id, env, "Обирай тему"); return sendTopics(chatId, env); }
      if (data.startsWith("topic:")) { const topicConfig = topicMenu.find((item) => item.id === data.slice(6)); if (!topicConfig) return answerCallbackQuery(callbackQuery.id, env, "Тему не знайдено"); await answerCallbackQuery(callbackQuery.id, env, `Тема: ${topicConfig.label}`); return sendFilteredLatest(chatId, env, { title: topicConfig.title, emptyTitle: topicConfig.emptyTitle, predicate: (item) => matchesDevTags(item, topicConfig.tags) }); }
      if (data === "full") { await answerCallbackQuery(callbackQuery.id, env, "Повні розбори"); return sendFullLatest(chatId, env); }
      if (data === "audit") { await answerCallbackQuery(callbackQuery.id, env, "Готую audit checklist"); return sendAuditChecklist(chatId, env); }
      if (data.startsWith("mode:")) { const [, mode, ref] = data.split(":"); const item = (await getLatestItems(env)).find((candidate) => String(candidate.itemId || "").startsWith(ref || "")); if (!item) return answerCallbackQuery(callbackQuery.id, env, "Новина вже змінилася у стрічці"); await answerCallbackQuery(callbackQuery.id, env, "Готую потрібний формат"); return sendItemReadingMode(chatId, item, mode, env); }
      if (data.startsWith("feedback:")) { const [, code, ref] = data.split(":"); const reaction = { u: "useful", i: "interesting", n: "not-relevant", x: "not-understood" }[code]; const item = (await getLatestItems(env)).find((candidate) => String(candidate.itemId || "").startsWith(ref || "")); if (!reaction || !item) return answerCallbackQuery(callbackQuery.id, env, "Новина вже змінилася у стрічці"); await saveContentFeedback(chatId, item, reaction, env); if (reaction === "not-understood") { await answerCallbackQuery(callbackQuery.id, env, "Поясню простіше"); return sendItemReadingMode(chatId, item, "e", env); } return answerCallbackQuery(callbackQuery.id, env, reaction === "useful" ? "Врахую: більше практично корисних матеріалів" : reaction === "interesting" ? "Врахую: більше таких цікавих тем" : "Врахую: менше подібних новин"); }
      if (data.startsWith("settings:")) { const subscriber = await updateSubscriberSettings(chatId, data, env); await answerCallbackQuery(callbackQuery.id, env, "Налаштування оновлено"); return sendSettings(chatId, env, subscriber, { replaceMessageId: messageId }); }
      return answerCallbackQuery(callbackQuery.id, env, "Команду не розпізнано");
    } catch (error) { errorLogger("Telegram callback failed:", { chatId, data, error: String(error?.message || error) }); return answerCallbackQuery(callbackQuery.id, env, "Помилка виконання"); }
  }
}
