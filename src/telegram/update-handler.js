export function createTelegramUpdateHandler({ handleCallback, handleMessage }) {
  return async function handleUpdate(update, env) {
    if (update?.callback_query) return handleCallback(update.callback_query, env);
    return handleMessage(update, env);
  };
}
