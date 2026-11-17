# Date-first latest feed

- Datetime: 2026-11-17
- Type: Fix
- Title: Keep `/latest` and `/full N` strictly newest-first
- Summary: Removed relevance and feedback-based reordering from the latest feed and full-article selection. Fresh news now stays ordered by official `publishedAt`; personalization remains available for digest output only.
- Module/route: Telegram `/latest`, `/full`, `/card`
- Issue reference: `Telegram: Simplify bot navigation v15`
- Validation: `pnpm run check`; `pnpm test`
- Production: Not deployed in this task; run `pnpm run ship` after explicit confirmation.
