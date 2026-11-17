# Telegram handlers extraction

- Datetime: 2026-11-17
- Type: Refactor / Test
- Title: Added injected Telegram command and callback handler boundary
- Summary: Active webhook dispatch now delegates command and callback routing to `src/telegram/handlers.js`; added isolated boundary coverage while preserving existing response functions and behavior.
- Module/route: `src/telegram/handlers.js`, `worker.js`, `test/module-boundaries.test.js`
- Issue reference: Architecture epic #7/#8 follow-up
