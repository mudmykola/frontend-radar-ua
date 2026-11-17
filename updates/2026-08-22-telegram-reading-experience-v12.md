# Telegram Reading Experience v12

- Datetime: 2026-08-22 12:15 Europe/Kyiv
- Type: Feature
- Title: Launch evidence-based multi-level Telegram reading
- Summary: Rebuilt AI delivery around plain Ukrainian explanations, evidence-bounded risk, full-source context, four interactive reading actions, feedback personalization, bounded Gemini model fallback, strict publication quality, and a refreshed Telegram identity with a generated radar avatar.
- Affected module/route/tool: `worker.js`, Telegram callbacks and article cards, Gemini inference, official article extraction, KV quality diagnostics, Cloudflare Assets, Telegram bot profile, `assets/frontend-intelligence-radar-avatar-v12.jpg`.
- Issue reference: `Content: Implement Telegram Reading Experience v12`
- Production: Worker version `9451090b-b608-4e62-9844-5806977b496e`; 28 tests pass; profile sync `v12`; first live enriched item quality 100/100, fallback false, priority P1, risk 4.
