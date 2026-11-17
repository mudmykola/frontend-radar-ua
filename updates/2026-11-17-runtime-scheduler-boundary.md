# Runtime scheduler boundary

- Datetime: 2026-11-17
- Type: Refactor
- Title: Extract Cloudflare scheduled orchestration
- Summary: Moved profile synchronization, scheduled indexing and UTC daily digest branching into an injected runtime scheduler. The Worker scheduled entrypoint preserves the existing waitUntil behavior and delegates execution to the new boundary.
- Module/route: `src/runtime/scheduled.js`, Worker `scheduled`
- Issue reference: `GH #8 — Architecture: Extract HTTP and runtime boundaries from worker.js`
- Validation: `pnpm run check`; `pnpm test` (65/65); `git diff --check`
- Production: Not deployed.
