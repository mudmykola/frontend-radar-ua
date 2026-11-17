# AI fallback content extraction

- Datetime: 2026-11-17
- Type: Refactor / Test
- Title: Extracted source-aware AI fallback actions and checklists
- Summary: Moved fallback application guidance and verification checklists into `src/enrichment/fallback-content.js`; structured fallback generation now consumes the module boundary.
- Module/route: `src/enrichment/fallback-content.js`, `worker.js`, `test/module-boundaries.test.js`
- Issue reference: Architecture epic #7/#8 follow-up
