# Fresh Intelligence Pipeline v13

- Datetime: 2026-09-17 18:30 Europe/Kyiv
- Type: Improvement
- Title: Rebuild fresh, concrete, source-grounded Telegram intelligence
- Summary: Reordered the feed by publication time, limited visibility to the last seven days, constrained technology and impact tags to source evidence, removed article UI noise, changed Telegram cards to concrete fact/audience/action/check guidance, made `/full` open one focused analysis, increased scheduled processing to three items, and retired legacy aggregate news storage.
- Affected module/route/tool: `worker.js`, `/latest`, `/full`, technology filters, scheduled ingestion, Gemini prompt and quality gate, production KV, Telegram profile marker.
- Issue reference: `Content: Rebuild Fresh Intelligence Pipeline v13`
- Production: Worker version `483498cc-a114-4370-8d54-f502873fca93`; 31 tests pass; health reports `Frontend Intelligence Radar UA v13.0`; first scheduled run completed with zero failures and zero fallbacks.
