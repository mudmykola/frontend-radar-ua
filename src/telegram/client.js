export function createTelegramClient(env, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const safeErrorMessage = options.safeErrorMessage || ((error) => String(error?.message || error));

  return {
    sendMessage,
    editMessageText,
    answerCallbackQuery,
  };

  async function sendMessage(chatId, text, messageOptions = {}) {
    const body = {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: messageOptions.disableWebPagePreview ?? true,
    };
    if (messageOptions.replyMarkup) body.reply_markup = messageOptions.replyMarkup;

    const response = await fetchImpl(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Telegram failed: ${response.status} ${errorText}`);
    }
  }

  async function editMessageText(chatId, messageId, text, messageOptions = {}) {
    const body = {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    };
    if (messageOptions.replyMarkup) body.reply_markup = messageOptions.replyMarkup;

    const response = await fetchImpl(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Telegram edit failed: ${response.status} ${errorText}`);
    }
  }

  async function answerCallbackQuery(callbackQueryId, text = "OK") {
    if (!callbackQueryId) return;
    await fetchImpl(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text, show_alert: false }),
    });
  }
}
