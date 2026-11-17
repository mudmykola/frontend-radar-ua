# Frontend Intelligence Radar v11

- Datetime: 2026-08-22 10:36 Europe/Kyiv
- Type: Feature
- Title: Launch Frontend Intelligence Radar UA
- Summary: Renamed the product and Telegram bot, expanded ingestion from Shopify to 11 official frontend sources, normalized RSS and Atom, added freshness, cross-source deduplication and noise filtering, generalized Gemini analysis, and introduced technology-specific Telegram navigation and preferences.
- Affected module/route/tool: `worker.js`, `/telegram-webhook`, `/configure-telegram-webhook`, `/index-sources`, Telegram commands and menus, official source ingestion, Gemini enrichment, KV latest/digest indexes, README, tests.
- Issue reference: `Core: Build Frontend Intelligence Radar v11`
- Production: Cloudflare Worker version `7a9e8220-eeb9-4a36-a151-15601413a3e6`; initial sync fetched 114 records and indexed 21 fresh high-signal items from 6 active sources.
