# Structured parser extraction

- Datetime: 2026-11-17
- Type: Refactor / Test
- Title: Moved full structured AI parser out of worker.js
- Summary: Extracted structured field parsing, section parsing, normalization, usefulness validation and fallback generation into `src/enrichment/structured-parser.js` with injected domain rules.
- Module/route: `src/enrichment/structured-parser.js`, `worker.js`, `test/worker.test.js`
- Issue reference: Architecture epic #7/#8 follow-up
