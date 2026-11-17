# Article context boundary

- Datetime: 2026-11-17
- Type: Refactor
- Title: Extract official article context fetching
- Summary: Moved approved-host validation, bounded redirects, HTML response handling, timeout and readable text extraction into `src/ingest/article-context.js`.
- Module/route: `src/ingest/article-context.js`, AI enrichment input
- Issue reference: `Architecture: Extract remaining Worker domains`
- Validation: `pnpm run check`; `pnpm test` (78/78); `git diff --check`
- Production: Not deployed.
