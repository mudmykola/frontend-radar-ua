# Telegram Intelligence v10

- Datetime: 2026-08-21 19:04 Europe/Kyiv
- Type: Feature
- Title: Implement decision-oriented Telegram Intelligence v10
- Summary: Rebuilt Telegram output as a personal Shopify tech-lead briefing: immediate verdict, urgency, audience, verified facts, clearly separated AI conclusions and assumptions, before/after context, concrete actions, expected results, time estimates, client opportunities, three reading modes, and a decision-oriented morning digest. Added bounded Gemini retries and reduced each refresh run to one unseen item to prevent Cloudflare `waitUntil` cancellation.
- Affected module/route/tool: `worker.js`, Telegram webhook callbacks, compact cards, full cards, digest, Gemini prompt/parser, quality gate, scheduled/manual refresh
- Issue reference: `Content: Implement Telegram Intelligence v10`
- Production version: `2f52cef0-f924-4fcb-9db3-3ded53e794ac`
- Verification: syntax check passed; 17 tests passed; Wrangler dry-run passed; production `/health` reports v10.0; active version contains all required secrets and bindings; unauthenticated webhook returns HTTP 401.
