export const TOPIC_MENU = [
  { id: "vue", label: "Vue / Nuxt", title: "💚 VUE / NUXT", emptyTitle: "💚 Свіжих Vue/Nuxt новин немає", tags: ["vue", "nuxt", "pinia", "ssr", "nitro"] },
  { id: "js", label: "JS / TS / Vite", title: "⚡ JS / TS / VITE", emptyTitle: "⚡ Свіжих JS/TS/Vite новин немає", tags: ["javascript", "typescript", "node", "vite", "vitest"] },
  { id: "css", label: "CSS / Tailwind / UI", title: "🎨 CSS / TAILWIND / UI", emptyTitle: "🎨 Свіжих CSS/UI новин немає", tags: ["css", "scss", "sass", "tailwind", "ui", "a11y"] },
  { id: "testing", label: "Testing / Browser", title: "🧪 TESTING / BROWSER", emptyTitle: "🧪 Свіжих Testing/Browser новин немає", tags: ["testing", "playwright", "vitest", "browser"] },
  { id: "ai", label: "AI / Codex / Claude", title: "🤖 AI / CODEX / CLAUDE", emptyTitle: "🤖 Свіжих AI-новин немає", tags: ["ai", "openai", "codex", "claude", "anthropic", "models", "api"] },
  { id: "toolchain", label: "Toolchain / Runtime", title: "🧰 TOOLCHAIN / RUNTIME", emptyTitle: "🧰 Свіжих Toolchain новин немає", tags: ["node", "npm", "pnpm", "bun", "homebrew", "build-tools", "runtime"] },
  { id: "git", label: "Git / DevOps", title: "🔀 GIT / DEVOPS", emptyTitle: "🔀 Свіжих Git/DevOps новин немає", tags: ["git", "github", "gitlab", "devops", "ci-cd", "open-source", "platform"] },
  { id: "shopify", label: "Shopify", title: "🛍 SHOPIFY", emptyTitle: "🛍 Свіжих Shopify новин немає", tags: ["shopify", "liquid", "admin-api", "storefront-api", "checkout"] },
  { id: "cloudflare", label: "Cloudflare / Edge", title: "☁️ CLOUDFLARE / EDGE", emptyTitle: "☁️ Свіжих Cloudflare новин немає", tags: ["cloudflare", "workers", "edge"] },
];

export function buildMainReplyKeyboard() {
  return {
    keyboard: [
      [{ text: "🆕 Свіже" }, { text: "🤖 AI" }],
      [{ text: "💻 Frontend" }, { text: "🧰 Інструменти" }],
      [{ text: "🌐 Web Platform" }, { text: "🗂 Усі теми" }],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
  };
}

export function buildTopicsInlineKeyboard() {
  return {
    inline_keyboard: [
      ...TOPIC_MENU.reduce((rows, topic, index) => {
        if (index % 2 === 0) rows.push([]);
        rows[rows.length - 1].push({ text: topic.label, callback_data: "topic:" + topic.id });
        return rows;
      }, []),
      [{ text: "🆕 Свіже", callback_data: "latest" }],
    ],
  };
}

export function buildRemoveKeyboard() {
  return { remove_keyboard: true };
}

export function buildListInlineKeyboard(items, latestDisplayLimit = 7) {
  const rows = items.slice(0, latestDisplayLimit).map((item, index) => {
    const itemReference = String(item.itemId || "").slice(0, 16);
    return [{
      text: "📖 Розбір " + (index + 1),
      callback_data: itemReference
        ? "article:" + itemReference + ":" + (index + 1) + ":" + Math.min(items.length, latestDisplayLimit)
        : "card:" + index,
    }];
  });

  return { inline_keyboard: rows };
}

export function buildItemInlineKeyboard(item) {
  const itemReference = String(item.itemId || "").slice(0, 16);
  const keyboard = [[
    { text: "🔗 Джерело", url: item.url },
    { text: "🆕 Свіже", callback_data: "latest" },
  ]];

  if (itemReference) {
    keyboard.unshift([
      { text: "🧠 Поясни простіше", callback_data: "mode:e:" + itemReference },
      { text: "💻 Приклад", callback_data: "mode:k:" + itemReference },
    ]);
    keyboard.unshift([
      { text: "🎯 Чи стосується мене?", callback_data: "mode:r:" + itemReference },
      { text: "✅ Чеклист", callback_data: "mode:c:" + itemReference },
    ]);
    keyboard.unshift([
      { text: "👍 Корисно", callback_data: "feedback:u:" + itemReference },
      { text: "🔥 Цікаво", callback_data: "feedback:i:" + itemReference },
      { text: "👎 Не моє", callback_data: "feedback:n:" + itemReference },
    ]);
    keyboard.unshift([{ text: "🤔 Не зрозумів", callback_data: "feedback:x:" + itemReference }]);
  }

  return { inline_keyboard: keyboard };
}

export function buildDigestInlineKeyboard() {
  return { inline_keyboard: [[
    { text: "🆕 Свіже", callback_data: "latest" },
    { text: "🗂 Теми", callback_data: "topics" },
  ]] };
}

export const buildAuditInlineKeyboard = buildDigestInlineKeyboard;
export const buildAdminInlineKeyboard = buildDigestInlineKeyboard;

export function buildSettingsInlineKeyboard(preferences) {
  const min = preferences.minPriority;
  const topics = preferences.topics || [];
  const topicButton = (label, value) => ({
    text: (topics.includes(value) ? "✅" : "▫️") + " " + label,
    callback_data: "settings:topic:" + value,
  });

  return {
    inline_keyboard: [
      [
        { text: (min === "P0" ? "✅" : "▫️") + " Тільки P0", callback_data: "settings:min:P0" },
        { text: (min === "P1" ? "✅" : "▫️") + " P0 + P1", callback_data: "settings:min:P1" },
      ],
      [
        { text: (min === "P2" ? "✅" : "▫️") + " Усе", callback_data: "settings:min:P2" },
        { text: (preferences.digestOnly ? "✅" : "▫️") + " Тільки digest", callback_data: "settings:digest:toggle" },
      ],
      [{ text: (preferences.quietHours ? "✅" : "▫️") + " Тихі години", callback_data: "settings:quiet:toggle" }],
      [{ text: "🇺🇦 Київ", callback_data: "settings:timezone:Europe/Kyiv" }, { text: "🇵🇱 Варшава", callback_data: "settings:timezone:Europe/Warsaw" }],
      [{ text: "🇬🇧 Лондон", callback_data: "settings:timezone:Europe/London" }, { text: "🇺🇸 New York", callback_data: "settings:timezone:America/New_York" }],
      [topicButton("Vue", "vue"), topicButton("Nuxt", "nuxt"), topicButton("Pinia", "pinia")],
      [topicButton("JS/TS", "javascript"), topicButton("CSS/UI", "css"), topicButton("Tailwind", "tailwind")],
      [topicButton("AI", "ai"), topicButton("Toolchain", "build-tools"), topicButton("Git/DevOps", "devops")],
      [topicButton("Shopify", "shopify"), topicButton("Cloudflare", "cloudflare")],
      [{ text: "🧹 Очистити теми", callback_data: "settings:topic:clear" }],
    ],
  };
}
