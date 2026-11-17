# Telegram command menu cleanup

- Datetime: 2026-11-17
- Type: Improvement
- Title: Show only user-facing Telegram commands
- Summary: Updated `setMyCommands` to expose the compact navigation set (`/start`, `/latest`, `/practice`, `/topics`, `/full`, `/digest`, `/settings`, `/help`, `/stop`). Legacy commands such as `/card`, `/p0`, `/audit`, `/stats` and `/refresh` remain handled manually but no longer clutter Telegram's command menu.
- Module/route: Telegram profile configuration and command handling
- Issue reference: `Telegram: Simplify bot navigation v15`
- Validation: `pnpm run check`; `pnpm test`
- Production: Not deployed in this task; run `pnpm run ship` after explicit confirmation. The command menu refreshes when the webhook/profile configuration runs.
