# Resilient ship health verification

- Datetime: 2026-11-17
- Type: Improvement
- Title: Make one-command deployment resilient to local DNS failures
- Summary: Replaced the final curl call in `pnpm run ship` with a retrying Node health verifier. Best-effort mode keeps a successful Cloudflare deploy successful when the local network cannot resolve the Worker; strict verification remains available separately.
- Module/route: `package.json`, `scripts/check-production-health.mjs`, production `/health`
- Issue reference: `Deployment: Make ship health verification resilient v15.4`
- Validation: `pnpm run check`; `pnpm test` (66/66); best-effort verifier tested with simulated DNS failure; `git diff --check`
- Production: Not deployed by this change.
