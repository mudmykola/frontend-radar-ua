export function buildTelegramCommandMenu() {
  return [
    ["start", "Запустити Radar"],
    ["latest", "Свіжі перевірені новини"],
    ["important", "P0/P1 зміни, які варто перевірити"],
    ["practice", "Дії на сьогодні"],
    ["topics", "AI, frontend, toolchain, Git та інші теми"],
    ["full", "Відкрити повний розбір"],
    ["digest", "Коротке персональне зведення"],
    ["settings", "Налаштувати теми й пріоритет"],
    ["help", "Як користуватися Radar"],
    ["stop", "Вимкнути автоматичні новини"],
  ].map(([command, description]) => ({ command, description }));
}
