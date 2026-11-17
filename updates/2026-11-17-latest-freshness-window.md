# Latest freshness window

- Datetime: 2026-11-17
- Type: Fix
- Title: Make `Свіже` truly fresh and sync on demand
- Summary: `/latest` and `/full N` now use a strict 48-hour publication window, never surface older items as fresh, and trigger a KV-locked source/AI sync when the last scheduled run is older than 10 minutes. Older verified items remain available to digest.
- Module/route: Telegram `/latest`, `/full`, `/card`, source sync and KV run state
- Issue reference: `Telegram: Simplify bot navigation v15`
- Validation: `pnpm run check`; `pnpm test`
- Production: Not deployed yet; run `pnpm run ship` after explicit confirmation.
