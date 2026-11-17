# Gemini Flash Production Migration

- Datetime: 2026-08-21 18:35 Europe/Kyiv
- Type: Improvement
- Title: Migrate Shopify Radar inference to Gemini Flash
- Summary: Replaced the NVIDIA inference endpoint and Mistral model with Google's OpenAI-compatible Gemini endpoint and `gemini-flash-latest`, stored the provided test credential as a Cloudflare secret, and released Worker v9.1.
- Affected module/route/tool: `worker.js`, `wrangler.jsonc`, `package.json`, Gemini API, Cloudflare Workers
- Issue reference: `AI: Migrate production inference to Gemini Flash`
- Production version: `df032271-7626-4435-ab94-61cbc09f2ef6`
- Verification: direct Gemini completion succeeded; local syntax check passed; 12 tests passed; Wrangler dry-run passed; live `/health` reports v9.1.
- Security follow-up: revoke the credential disclosed in conversation and replace `AI_API_KEY` with a newly created credential that is never pasted into chat.
