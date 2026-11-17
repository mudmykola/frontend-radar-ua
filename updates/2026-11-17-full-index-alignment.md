# Full article index alignment

- Datetime: 2026-11-17
- Type: Fix
- Title: Keep `/full N` and article buttons aligned with the visible list
- Summary: Article callbacks now carry the visible position and list total, so the opened full card no longer displays a different ordinal after personalization or topic filtering. The stable article ID remains the source of truth for selection.
- Module/route: Telegram list callbacks and full-card rendering
- Issue reference: `Telegram: Simplify bot navigation v15`
- Validation: `pnpm run check`; `pnpm test` (36/36)
- Production: Not deployed in this task; run `pnpm run ship` after explicit confirmation.
