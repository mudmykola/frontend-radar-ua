# Freshest-only News Delivery v10.1

- Datetime: 2026-08-22 10:23 Europe/Kyiv
- Type: Improvement
- Title: Restrict Telegram delivery to the freshest Shopify changelog window
- Summary: Compared the official Shopify changelog with production KV, confirmed that sorting was correct but older July/August records remained visible, then added a seven-day relative freshness window and a fourteen-day absolute source-staleness guard. Older data remains archived in KV. Recent fallback records can be re-enriched by Gemini no more frequently than every six hours.
- Affected module/route/tool: `worker.js`, `/latest`, `/full`, `/digest`, scheduled refresh, manual `/refresh`, Cloudflare KV
- Issue reference: `Content: Enforce freshest-only Shopify news delivery`
- Production version: `ea7a6bd2-003b-4fa4-941b-9a3443d4b1a3`
- Verification: official feed newest item dated 2026-08-19; production KV matched that newest item; 20 tests passed; Wrangler dry-run passed; live `/health` reports v10.1; unauthenticated webhook returns HTTP 401.
