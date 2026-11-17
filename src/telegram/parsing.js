const BUTTON_COMMANDS = {
  "🆕 останні": "/latest", "🆕 свіже": "/latest", "🎯 для мене": "/latest",
  "🧰 практика": "/practice", "🗂 теми": "/topics", "📖 повні розбори": "/full",
  "🔥 важливе": "/important", "✅ дії сьогодні": "/practice", "🧠 зведення": "/digest",
  "🗂 research теми": "/topics",
  "🚨 критичні": "/p0", "🎨 themes": "/themes", "🎨 теми": "/themes",
  "⚡ performance": "/performance", "⚡ швидкість": "/performance", "💚 vue": "/vue",
  "🟢 nuxt": "/nuxt", "⚡ js/ts": "/js", "🎨 css/ui": "/css", "☁️ cloudflare": "/cloudflare",
  "🛍 shopify": "/shopify", "🧠 digest": "/digest",
  "✅ audit": "/audit", "✅ аудит": "/audit", "⚙️ settings": "/settings",
  "⚙️ налаштування": "/settings", "ℹ️ допомога": "/help", "📊 stats": "/stats",
};

export function normalizeTelegramCommand(text) {
  const value = String(text || "").trim();
  const mapped = BUTTON_COMMANDS[value.toLowerCase()];
  if (mapped) return mapped;
  return (value.split(/\s+/)[0] || "").split("@")[0].toLowerCase();
}

export function parseCommandArgs(text) {
  return String(text || "").trim().split(/\s+/).slice(1).filter(Boolean);
}

export function parseOptionalIndex(value) {
  const index = Number(value);
  if (!Number.isFinite(index)) return null;
  return Math.max(1, Math.floor(index));
}
