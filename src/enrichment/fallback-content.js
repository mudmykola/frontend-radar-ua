export function buildFallbackApplicationItems(_item, area) {
  const value = String(area || "").toLowerCase();
  if (/vue|pinia/.test(value)) return ["Звірити заторкнуті Vue API та компоненти.", "Запустити unit/component tests для reactivity і stores.", "Перевірити migration notes перед оновленням залежності."];
  if (/nuxt/.test(value)) return ["Звірити Nuxt/Nitro версію і migration notes.", "Перевірити SSR, hydration та data fetching у production build.", "Запустити smoke tests server routes і ключових сторінок."];
  if (/vite|typescript|javascript|node/.test(value)) return ["Звірити версії runtime і build toolchain.", "Запустити typecheck, build та automated tests.", "Перевірити release notes на несумісні зміни конфігурації."];
  if (/css|tailwind|ui/.test(value)) return ["Звірити CSS/Tailwind pipeline і browser support.", "Запустити visual regression ключових компонентів.", "Перевірити responsive states та accessibility."];
  if (/cloudflare/.test(value)) return ["Звірити, чи використовується змінена Cloudflare-функція.", "Перевірити Worker bindings, compatibility date і local runtime.", "Запустити staging deploy та перевірити edge logs."];
  if (/admin api|storefront api|api/.test(value)) return ["Перевірити GraphQL/Admin API запити, мутації, scopes і версію API в інтеграціях.", "Оцінити, чи є вплив на автоматизації, webhooks, bulk operations або бекенд-скрипти.", "Додати пункт у dev-аудит клієнтського магазину перед оновленням API-версії."];
  if (/themes|теми|liquid/.test(value)) return ["Перевірити theme code: Liquid, sections, snippets, app blocks і кастомні scripts.", "Оцінити, чи можна використати зміну для покращення UX, CRO або підтримки теми.", "Додати перевірку в чеклист перед релізом theme update."];
  if (/checkout/.test(value)) return ["Перевірити checkout customization, Functions, payment/shipping логіку і Shopify Plus сценарії.", "Оцінити ризик для клієнтських checkout flow, Markets або payment integrations.", "Додати тестовий сценарій у QA перед релізом змін."];
  if (/performance|швидкість|seo/.test(value)) return ["Перевірити вплив на швидкість, SEO, assets, app scripts або Core Web Vitals.", "Додати зміну в технічний аудит сторінок PDP, collection і homepage.", "Оцінити, чи можна використати це як покращення для клієнтського беклогу."];
  return ["Визначити, які модулі або проєкти використовують змінену можливість.", "Звірити точні умови й обмеження в офіційному джерелі.", "Додати задачу лише після підтвердження практичного впливу."];
}

export function buildFallbackChecklistItems(_item, area) {
  const value = String(area || "").toLowerCase();
  if (/vue|pinia/.test(value)) return ["Vue/Pinia version", "Заторкнуті components, composables і stores", "Unit та component regression"];
  if (/nuxt/.test(value)) return ["Nuxt/Nitro version", "SSR, hydration і data fetching", "Production build та server routes"];
  if (/vite|typescript|javascript|node/.test(value)) return ["Runtime і dependency versions", "Typecheck, build і tests", "Config та plugin compatibility"];
  if (/css|tailwind|ui/.test(value)) return ["CSS/Tailwind build", "Responsive visual regression", "Accessibility і browser support"];
  if (/cloudflare/.test(value)) return ["Worker/runtime applicability", "Bindings і compatibility date", "Staging deploy та edge logs"];
  if (/admin api|storefront api|api/.test(value)) return ["API version і deprecated поля", "GraphQL mutations/queries та scopes", "Webhooks, integrations, scripts і automation jobs"];
  if (/themes|теми|liquid/.test(value)) return ["Liquid templates, sections і snippets", "Theme app extensions або app blocks", "JS/CSS, UX states і regression на ключових сторінках"];
  if (/checkout/.test(value)) return ["Checkout flow і Shopify Plus customizations", "Functions, payment/shipping rules і Markets", "QA сценарії для test order та edge cases"];
  return ["Точні факти офіційного джерела", "Версії та модулі, яких стосується зміна", "Підтверджені breaking, deprecation або migration notes"];
}
