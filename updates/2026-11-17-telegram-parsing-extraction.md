# Telegram parsing extraction

- Datetime: 2026-11-17
- Type: Refactor / Test
- Title: Extracted Telegram command and button parsing
- Summary: Moved command normalization, button mapping, argument parsing and card-index validation to `src/telegram/parsing.js` with direct regression coverage.
- Module/route: `src/telegram/parsing.js`, `worker.js`, `test/module-boundaries.test.js`
- Issue reference: Architecture epic #7/#8 follow-up
