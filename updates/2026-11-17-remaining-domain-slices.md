# Remaining Worker domain slices

- Datetime: 2026-11-17
- Type: Refactor
- Title: Extract content fetcher and Telegram compact formatter boundaries
- Summary: Added bounded modules for multi-source feed fetching/deduplication and compact Telegram feed formatting. Existing Worker wrappers preserve current behavior while the remaining article-context and AI parser slices stay next in the epic.
- Module/route: `src/ingest/content-fetcher.js`, `src/telegram/formatters.js`
- Issue reference: `Architecture: Extract remaining Worker domains`
- Validation: `pnpm run check`; `pnpm test` (78/78); `git diff --check`
- Production: Not deployed.
