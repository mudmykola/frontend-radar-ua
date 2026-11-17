export function createTelegramWebhookProcessor(env, options) {
  const { keyPrefix, ttlSeconds, handleUpdate } = options;
  const inFlight = options.inFlight || new Map();

  return { process };

  async function process(update) {
    const updateId = update?.update_id;
    const updateKey = updateId !== undefined && updateId !== null ? keyPrefix + updateId : "";
    if (updateKey) {
      if (await env.SHOPIFY_RADAR_KV.get(updateKey)) return;
      if (inFlight.has(updateKey)) return inFlight.get(updateKey);
    }

    const processing = (async () => {
      await handleUpdate(update, env);
      if (updateKey) await env.SHOPIFY_RADAR_KV.put(updateKey, "1", { expirationTtl: ttlSeconds });
    })();

    if (updateKey) inFlight.set(updateKey, processing);
    try {
      return await processing;
    } finally {
      if (updateKey) inFlight.delete(updateKey);
    }
  }
}
