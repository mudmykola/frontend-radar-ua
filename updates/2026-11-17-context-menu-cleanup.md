# Telegram contextual menu cleanup

- Datetime: 2026-11-17
- Type: Improvement
- Title: Remove duplicate navigation from Telegram inline menus
- Summary: Reduced article, digest, audit and admin inline keyboards to contextual actions. Navigation now uses the persistent Ukrainian menu plus only `Свіже` and `Теми` where needed; article cards keep source, explanation, example, relevance, checklist and feedback actions without duplicate `Full`/`Audit` controls.
- Module/route: Telegram inline keyboards
- Issue reference: `Telegram: Simplify bot navigation v15`
- Validation: `pnpm run check`; `pnpm test`
- Production: Not deployed in this task; run `pnpm run ship` after explicit confirmation.
