export function createTelegramDelivery(options) {
  const { getSubscribers, shouldDeliverToSubscriber, sendRaw, delay, concurrency = 5, batchDelayMs = 250, safeErrorMessage } = options;

  return { sendMessage };

  async function sendMessage(message, env, deliveryOptions = {}) {
    const subscribers = await getSubscribers(env);
    if (!subscribers.length && env.TELEGRAM_CHAT_ID) {
      await sendRaw(env.TELEGRAM_CHAT_ID, message, env, { replyMarkup: deliveryOptions.replyMarkup });
      return { subscribers: 1, deliveredSubscribers: 1, skippedSubscribers: 0, failed: [], fallback: true };
    }

    const failed = [];
    let deliveredSubscribers = 0;
    let skippedSubscribers = 0;
    const deliverable = subscribers.filter((subscriber) => {
      const deliver = !deliveryOptions.item || shouldDeliverToSubscriber(deliveryOptions.item, subscriber, deliveryOptions);
      if (!deliver) skippedSubscribers += 1;
      return deliver;
    });

    for (let index = 0; index < deliverable.length; index += concurrency) {
      const batch = deliverable.slice(index, index + concurrency);
      const results = await Promise.allSettled(batch.map((subscriber) => sendRaw(subscriber.chatId, message, env, { replyMarkup: deliveryOptions.replyMarkup })));
      results.forEach((result, resultIndex) => {
        const subscriber = batch[resultIndex];
        if (result.status === "fulfilled") deliveredSubscribers += 1;
        else failed.push({ chatId: subscriber.chatId, error: safeErrorMessage(result.reason) });
      });
      if (index + concurrency < deliverable.length) await delay(batchDelayMs);
    }

    return { subscribers: subscribers.length, deliveredSubscribers, skippedSubscribers, failed, fallback: false };
  }
}
