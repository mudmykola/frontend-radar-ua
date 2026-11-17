# Content fetcher boundary

- Datetime: 2026-11-17
- Type: Refactor
- Title: Extract feed source fetch orchestration
- Summary: Moved multi-source fetch orchestration, timeout handling, response limits, source failure isolation and release deduplication into `src/ingest/content-fetcher.js`. RSS/Atom parsers remain behavior-compatible through injected dependencies.
- Module/route: `src/ingest/content-fetcher.js`, scheduled source indexing
- Issue reference: `Architecture: Extract remaining Worker domains`
- Validation: `pnpm run check`; `pnpm test` (78/78); `git diff --check`
- Production: Not deployed.
