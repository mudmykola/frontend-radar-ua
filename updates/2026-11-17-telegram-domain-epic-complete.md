# Telegram domain architecture epic

- Datetime: 2026-11-17
- Type: Refactor
- Title: Extract Telegram domain, state and delivery boundaries
- Summary: Moved subscriber/preferences/feedback persistence, delivery policy, webhook idempotency and update dispatch into independently testable modules. Worker wrappers preserve current Telegram behavior and stable callback compatibility.
- Module/route: `src/storage/subscriber-repository.js`, `src/telegram/delivery.js`, `src/telegram/webhook.js`, `src/telegram/update-handler.js`, Telegram Worker flows
- Issue reference: `GH #7 — Architecture: Extract Telegram domain, subscriber storage and delivery flows`
- Validation: `pnpm run check`; `pnpm test` (78/78); `pnpm exec wrangler deploy --dry-run`; `git diff --check`
- Production: Not deployed.
