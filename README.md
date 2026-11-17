# Frontend Intelligence Radar UA

Cloudflare Worker і Telegram-бот, який стежить за офіційними змінами у frontend-екосистемі та пояснює їх українською мовою.

Shopify — лише одне з джерел. Радар також охоплює Vue, Nuxt, Pinia, Vite, Vitest, Playwright, Nitro, Nuxt UI, JavaScript, TypeScript, CSS, Sass, Tailwind, Node.js, MDN, web.dev і Cloudflare Workers.

## Поточна версія v15

- показує лише офіційні матеріали за останні сім днів;
- сортує новини за реальною датою публікації;
- `/latest` і `/full N` завжди використовують порядок від найновішої публікації до старішої; персоналізація не може підняти стару новину вище свіжої;
- `Свіже` працює у вікні 48 годин і запускає захищену on-demand синхронізацію, якщо останній cron був понад 10 хвилин тому;
- якщо за 48 годин немає перевірених матеріалів, бот показує чесний empty state, а старіші записи залишаються тільки в `/digest`.
- обмежує AI-теги екосистемою джерела;
- відкидає GitHub/UI/authentication шум і неповні AI-відповіді;
- пояснює: що змінилося, кого стосується, де перевірити і що зробити;
- відкриває один точний `/full`-розбір за стабільним ID статті;
- обробляє до трьох нових матеріалів за cron-запуск;
- балансує індексацію між екосистемами, щоб Cloudflare або Shopify не витісняли всі інші теми;
- зберігає окремі записи в Cloudflare KV без legacy aggregate news arrays.
- має компактне Telegram-меню з шістьма діями: `Свіже`, `Для мене`, `Практика`, `Теми`, `Налаштування`, `Допомога`;
- відкриває теми другим рівнем inline-кнопок, щоб не змішувати всі екосистеми в одному меню;
- залишає старі slash-команди (`/vue`, `/nuxt`, `/js`, `/css`, `/shopify`, `/cloudflare`) для сумісності.
- використовує короткі контекстні кнопки в картці без дублювання `Full`, `Latest` і `Audit`;
- залишає навігацію зі зведень та audit-екранів через `Свіже` і `Теми`.

## Формат корисної новини

Кожна картка має дати конкретну відповідь: що змінилося, кого це стосується, що було раніше, що тепер, у якому файлі/API/пакеті перевірити та яку одну дію виконати. Якщо практичної дії немає, новина позначається як довідкова й не створює штучного ризику.

## Джерела

Shopify Developer Changelog, Vue і Nuxt official blogs, Vue/Nuxt/Pinia/Vite/Nitro/Nuxt UI/Vitest/Playwright releases, Vite Blog, Tailwind CSS Blog і releases, TypeScript і Sass releases, Node.js releases, MDN Blog, web.dev Blog, Cloudflare Developer Changelog і Cloudflare Blog.

## Telegram-команди

- `/latest` — сім найсвіжіших перевірених сигналів;
- `/practice` — лише новини з конкретною дією або чеклистом;
- `/topics` — другий рівень фільтрації за екосистемою;
- `/full` або `/full 3` — один практичний розбір;
- `/vue`, `/nuxt`, `/js`, `/css` — тематичні frontend-потоки;
- `/shopify`, `/cloudflare` — відповідні екосистеми;
- `/digest` — персональне зведення;
- `/settings`, `/help`, `/stop` — налаштування, довідка і відписка.

Telegram command menu показує лише ці основні користувацькі дії. Старі сумісні команди (`/card`, `/p0`, `/themes`, `/performance`, `/audit`, `/stats`, `/refresh`) не видаляються з обробника, але більше не виводяться у головному меню.

## Архітектура

- `worker.js` — cron, RSS/Atom ingestion, Gemini pipeline, KV і Telegram handlers;
- `src/http-security.js` — admin/webhook authentication;
- `scripts/register-telegram-webhook.mjs` — Telegram webhook registration;
- `test/worker.test.js` — unit і regression tests;
- `assets/` — Worker assets;
- `updates/` — Dev Log;
- `BACKLOG.md` — локальний backlog;
- `wrangler.jsonc` — Cloudflare configuration.

Production Worker історично має ім’я `shopify-radar-ua`. Це не перейменовується, щоб не ламати URL, webhook і KV; публічна назва продукту — `Frontend Intelligence Radar UA`.

## Frontend Intelligence v11

- Reads 11 official sources: Shopify, Vue, Nuxt, Pinia, Vite, Tailwind CSS, TypeScript, Sass, Node.js, MDN, and Cloudflare.
- Normalizes RSS and Atom into one dated feed and deduplicates cross-posted releases.
- Keeps the newest seven-day signal window and suppresses stale, prerelease, and routine patch noise.
- Adds technology views in Telegram: `/vue`, `/nuxt`, `/js`, `/css`, `/shopify`, and `/cloudflare`.
- Generates Ukrainian AI analysis with impact, affected projects, actions, checks, effort, and client opportunities.
- Preserves the existing Worker URL and Cloudflare resources while changing the user-facing product and bot name.

### Evidence-based Telegram quality v11.1

- Pending AI records, fallbacks, and cards below 70/100 are not shown in Telegram.
- P0, security, breaking, migration, risk, and urgency claims are capped by explicit source evidence.
- Fallback diagnostics use technology-specific Vue/Nuxt/toolchain/CSS/Cloudflare/Shopify guidance instead of universal Shopify copy.
- Telegram cards label the exact official source and separate verified facts from AI conclusions.
- v11.2 uses one grounded AI pass per item and rejects prereleases, generic release stubs, and non-developer Cloudflare product noise before enrichment.
- v11.2.1 applies the publishability gate to immediate broadcasts and processes one item per 15-minute run to respect Gemini rate limits.

## Telegram Reading Experience v12

- Adds `Поясни простіше`, `Практичний приклад`, `Чи стосується мене?`, and `Не зрозумів` actions beneath every article.
- Uses a bounded stable Gemini fallback chain and keeps low-quality/fallback content out of every delivery path.
- Retains full official article context, topic preferences, feedback-based personalization, signal ranking, and production quality statistics.
- Updates the Telegram identity with a generated radar avatar and a plain-language product description.

## AI Content Intelligence v9

- Fetches the full official `shopify.dev` article with an RSS fallback.
- Uses a fact-extraction pass before the Ukrainian editorial pass.
- Scores benefit, production risk, implementation effort, and source confidence.
- Produces a compact feed plus an expanded practical analysis.
- Captures `Корисно`, `Цікаво`, and `Не моє` reactions and applies them to per-reader ranking.
- Broadcasts fewer low-confidence or low-value updates; all items remain available in the digest.
- Uses stable `gemini-3.5-flash-lite` through the Gemini OpenAI-compatible endpoint for higher-throughput structured analysis.

## Telegram Intelligence v10

- Leads with a verdict, urgency, personal relevance, audience, action, and time estimate.
- Separates verified Shopify facts from AI conclusions and explicitly marked assumptions.
- Explains `before → after → action` and the expected result.
- Adds inline `20 секунд`, `Чеклист`, and `Для клієнта` reading modes.
- Produces a decision-oriented morning digest with one recommended action.
- Rejects generic AI output that lacks facts, audience, concrete action, or expected result.
- Processes one unseen AI item per scheduled/manual refresh to stay within the Cloudflare Worker execution lifetime.
- Shows only items within seven days of Shopify's newest changelog entry and hides the feed if its newest source item is older than fourteen days.

## Local setup

1. Install dependencies with `pnpm install`.
2. Create `.dev.vars` with `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `ADMIN_SECRET`, and `AI_API_KEY`.
3. Optionally set `ADMIN_TELEGRAM_CHAT_ID` and `TELEGRAM_CHAT_ID`.
4. Run `pnpm dev`.

Для повного циклу перевірки, deploy і production health-check використовуй одну команду:

```sh
pnpm run ship
```

`ship` зупиняється на першій помилці й не виконує deploy, якщо syntax check, тести або Wrangler dry-run не пройшли.

Admin routes require `Authorization: Bearer <ADMIN_SECRET>`. The Telegram webhook requires the `X-Telegram-Bot-Api-Secret-Token` header matching `TELEGRAM_WEBHOOK_SECRET`.

After setting the production `TELEGRAM_WEBHOOK_SECRET`, register it with Telegram:

```sh
TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... WORKER_URL=https://shopify-radar-ua.tovarinfobud.workers.dev pnpm telegram:webhook
```

The production Worker can also register its existing bot without exposing the bot token by calling `POST /configure-telegram-webhook` with `X-Telegram-Bot-Api-Secret-Token`. `POST /index-sources` performs a protected initial source sync after deployment. The configured cron runs every 15 minutes; the 06:00 UTC run also sends the daily digest.

Example admin request:

```sh
curl -H "Authorization: Bearer $ADMIN_SECRET" https://shopify-radar-ua.tovarinfobud.workers.dev/debug-env
```

Never place secrets in `wrangler.jsonc`, URLs, Git history, screenshots, or logs. Production deployment requires an explicit review and approval.

## Documentation update rules

Кожна функціональна або user-facing зміна повинна оновити документацію в тому самому task cycle:

1. `README.md` — актуальний опис поведінки, команд або setup;
2. `BACKLOG.md` — scope і статус задачі;
3. `updates/` — Dev Log із datetime, type, summary, affected module і issue reference;
4. `test/` — regression coverage для нового або виправленого сценарію.

Якщо змінюється команда, endpoint, environment variable, binding, джерело новин, формат Telegram або deployment flow — README оновлюється разом із кодом.

Після завершення реалізації, успішних тестів і Wrangler dry-run production deploy виконується одразу після явного підтвердження користувача. Не залишати перевірену production-зміну в стані «готово, але не задеплоєно» без пояснення причини.

## Git commit rules

The first local checkpoint may use the simple message:

```sh
git add .
git commit -m "first commit"
```

All following commits use the format:

```text
<type>(<scope>): <short result>
```

Use one of these types:

- `feat` — new functionality;
- `fix` — bug fix;
- `refactor` — code structure without behavior change;
- `chore` — repository, tooling, or documentation maintenance;
- `perf` — performance improvement;
- Use `fix(security)` or `chore(security)` for security hardening or credential work.

Examples:

```sh
git commit -m "feat(content): add source-grounded frontend news"
git commit -m "fix(telegram): open the exact selected article"
git commit -m "chore(repo): initialize frontend radar repository"
git commit -m "fix(security): rotate exposed Gemini credential"
```

Keep the message action-oriented, concise, and focused on the final result. Do not include secrets, tokens, or temporary debugging details in commit messages.
