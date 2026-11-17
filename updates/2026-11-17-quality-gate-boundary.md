# Quality gate boundary

- Datetime: 2026-11-17
- Type: Refactor
- Title: Extract AI publishability and immediate delivery rules
- Summary: Moved publishability and immediate Telegram delivery decisions into `src/enrichment/quality-gate.js`, preserving existing P0/P1/P2 thresholds and contaminated-content rejection.
- Module/route: `src/enrichment/quality-gate.js`, enrichment and Telegram delivery
- Issue reference: `Architecture: Extract remaining Worker domains`
- Validation: `pnpm run check`; `pnpm test` (80/80); `git diff --check`
- Production: Not deployed.
