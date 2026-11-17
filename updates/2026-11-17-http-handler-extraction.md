# HTTP handler extraction

- Datetime: 2026-11-17
- Type: Refactor
- Title: Move Worker HTTP handlers behind the runtime router
- Summary: Added injected handlers for health, webhook, indexing, AI test, diagnostics, admin run/bootstrap/digest/audit and subscriber routes. The canonical router now dispatches all known endpoints to `src/http/handlers.js`; the previous implementation remains only as a temporary compatibility fallback until dead code cleanup.
- Module/route: `src/http/handlers.js`, `src/http/routes.js`, `src/runtime/fetch-router.js`
- Issue reference: `GH #8 — Architecture: Extract HTTP and runtime boundaries from worker.js`
- Validation: `pnpm run check`; `pnpm test` (66/66); `pnpm exec wrangler deploy --dry-run`
- Production: Not deployed.
