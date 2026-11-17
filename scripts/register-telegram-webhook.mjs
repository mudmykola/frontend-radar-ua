const botToken = process.env.TELEGRAM_BOT_TOKEN;
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
const workerUrl = process.env.WORKER_URL;

if (!botToken || !webhookSecret || !workerUrl) {
  throw new Error("Set TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, and WORKER_URL");
}

const webhookUrl = new URL("/telegram-webhook", workerUrl).toString();
const response = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    url: webhookUrl,
    secret_token: webhookSecret,
    allowed_updates: ["message", "edited_message", "callback_query"],
    drop_pending_updates: false,
  }),
});
const result = await response.json();

if (!response.ok || !result.ok) {
  throw new Error(`Telegram webhook registration failed (${response.status})`);
}

console.log(`Telegram webhook registered for ${new URL(workerUrl).host}`);
