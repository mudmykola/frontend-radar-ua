# Item builder extraction

- Datetime: 2026-11-17
- Type: Refactor / Test
- Title: Extracted normalized AI item builder
- Summary: Moved mapping from structured AI output to persisted news records into `src/enrichment/item-builder.js` and added boundary coverage.
- Module/route: `src/enrichment/item-builder.js`, `worker.js`, `test/module-boundaries.test.js`
- Issue reference: Architecture epic #7/#8 follow-up
