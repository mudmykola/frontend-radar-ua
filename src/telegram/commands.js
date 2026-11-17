export function buildTelegramCommandMenu() {
  return [
    ["start", "Запустити Radar"],
    ["latest", "Свіжі перевірені новини"],
    ["practice", "Новини з конкретною дією"],
    ["topics", "Обрати технологічну екосистему"],
    ["full", "Відкрити повний розбір"],
    ["digest", "Коротке персональне зведення"],
    ["settings", "Налаштувати теми й пріоритет"],
    ["help", "Як користуватися Radar"],
    ["stop", "Вимкнути автоматичні новини"],
  ].map(([command, description]) => ({ command, description }));
}
