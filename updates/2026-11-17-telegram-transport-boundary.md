# Telegram transport boundary

- Datetime: 2026-11-17
- Type: Refactor
- Title: Extract Telegram API transport from Worker entrypoint
- Summary: Moved sendMessage, editMessageText and answerCallbackQuery into an injected Telegram client. Existing Worker wrappers preserve the public behavior while the transport is independently testable.
- Module/route: `src/telegram/client.js`, Telegram delivery and callback flows
- Issue reference: `Architecture: Extract Telegram transport boundary v15.3`
- Validation: `pnpm run check`; `pnpm test` (63/63); `pnpm exec wrangler deploy --dry-run`
- Production: Not deployed.
