# Telegram topic freshness

- Datetime: 2026-11-17
- Type: Fix
- Title: Apply one 48-hour freshness window to every Telegram feed
- Summary: Thematic commands and inline topic feeds no longer read the broader seven-day KV cache. They now run the guarded on-demand source sync and use the same 48-hour window as `/latest`; stale `/full` callbacks are rejected as no longer fresh.
- Module/route: Telegram delivery, `/latest`, topic filters, `/full`
- Issue reference: `Telegram: Simplify bot navigation v15`
- Validation: `pnpm run check`; `pnpm test` (40/40); `wrangler deploy --dry-run`
- Production: Not deployed.
