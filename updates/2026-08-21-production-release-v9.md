# Production Release — AI Content Intelligence v9

- Datetime: 2026-08-21 18:28 Europe/Kyiv
- Type: Improvement
- Title: Release Shopify Radar UA v9 to Cloudflare production
- Summary: Deployed the security hardening and AI Content Intelligence v9 epics, provisioned Telegram webhook verification, re-registered the existing bot webhook, preserved production bindings, disabled preview URLs, and corrected the cron schedule from every five hours to hourly so the 06:00 UTC digest executes.
- Affected module/route/tool: `worker.js`, `wrangler.jsonc`, `/health`, `/telegram-webhook`, `/configure-telegram-webhook`, Cloudflare Workers, Telegram Bot API
- Issue reference: `Deployment: Release AI Content Intelligence v9 to production`
- Production version: `fc3b96f6-3469-4922-89be-a017e8bf3893`
- Verification: local syntax check; 12 passing tests; Wrangler dry-run; live `/health` reports v9.0; unauthenticated webhook returns HTTP 401; Telegram `setWebhook` succeeded.
