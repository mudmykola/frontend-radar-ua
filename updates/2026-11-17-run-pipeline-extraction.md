# Run pipeline extraction

- Datetime: 2026-11-17
- Type: Refactor / Test
- Title: Extracted ingestion and enrichment run pipeline from worker.js
- Summary: Moved source indexing, seen-item filtering, AI enrichment, persistence, immediate delivery and run-result storage into `src/runtime/run-pipeline.js`. Added a boundary regression test.
- Module/route: `src/runtime/run-pipeline.js`, `worker.js`, `test/module-boundaries.test.js`
- Issue reference: Architecture epic #7/#8 follow-up
