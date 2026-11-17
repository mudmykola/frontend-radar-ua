# 2026-08-21 — Fix — Stabilize Shopify Radar Worker security and storage

- Summary: Imported the deployed Worker and completed a consolidated security/correctness epic. Added Telegram webhook authentication, Bearer admin authentication, request validation, safe errors, retry-safe update processing, per-record KV storage, bounded Telegram delivery, local Wrangler tooling, and regression tests.
- Affected module: `shopify-radar-ua` Worker runtime, Telegram webhook, admin API, KV storage, local tooling.
- Issue reference: `Core: Harden and stabilize the Worker runtime`.
- Verification: `pnpm check`, 7 Node tests, and Wrangler `deploy --dry-run` passed.
- Deployment: Not performed. Production requires `TELEGRAM_WEBHOOK_SECRET` to be set and the Telegram webhook to be re-registered with the same secret before deploying this version.
