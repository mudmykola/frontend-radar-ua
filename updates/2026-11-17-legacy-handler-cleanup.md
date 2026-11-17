# Legacy handler cleanup

- Datetime: 2026-11-17
- Type: Refactor
- Title: Removed duplicate Telegram handler implementations
- Summary: Deleted inactive legacy message/callback handlers from `worker.js`; webhook dispatch now has one active implementation through `src/telegram/handlers.js`.
- Module/route: `worker.js`, `src/telegram/handlers.js`
- Issue reference: Architecture epic #7/#8 follow-up
