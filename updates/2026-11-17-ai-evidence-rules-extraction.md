# AI evidence rules extraction

- Datetime: 2026-11-17
- Type: Refactor / Test
- Title: Extracted evidence and tag-safety rules
- Summary: Moved evidence sentence extraction, contamination filtering, source-aware dev tags, impact tags and not-for guidance into `src/enrichment/evidence.js`.
- Module/route: `src/enrichment/evidence.js`, `worker.js`, `test/module-boundaries.test.js`
- Issue reference: Architecture epic #7/#8 follow-up
