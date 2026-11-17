# Exact Full Article Navigation

- Datetime: 2026-09-17 18:35 Europe/Kyiv
- Type: Fix
- Title: Open the exact Telegram article selected by the reader
- Summary: Replaced position-based Full callbacks with stable item references so topic filtering, personalization, or feed reordering cannot open a different article. Manual `/full N` navigation remains available.
- Affected module/route/tool: `worker.js`, Telegram list keyboards, article keyboards, callback handler, `/full`.
- Issue reference: `Telegram: Open the exact article selected from any feed`
- Production: Worker version `0ad30df5-3b0b-4d8e-9816-de0eb22dd6db`; 32 tests pass.
