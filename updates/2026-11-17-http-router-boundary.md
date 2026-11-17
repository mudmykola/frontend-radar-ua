# HTTP runtime router boundary

- Datetime: 2026-11-17
- Type: Refactor
- Title: Extract canonical HTTP route dispatch
- Summary: Added a canonical route registry and injected path/method router for the Worker. Existing handlers remain behind the router to preserve response and auth behavior while the implementation moves into route modules incrementally.
- Module/route: `src/http/routes.js`, `src/runtime/fetch-router.js`, Worker fetch entrypoint
- Issue reference: `GH #8 — Architecture: Extract HTTP and runtime boundaries from worker.js`
- Validation: `pnpm run check`; `pnpm test` (66/66); `pnpm exec wrangler deploy --dry-run`
- Production: Not deployed.
