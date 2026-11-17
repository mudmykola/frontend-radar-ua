# Worker modular architecture

- Datetime: 2026-11-17
- Type: Refactor
- Title: Split Worker responsibilities into bounded modules
- Summary: Extracted source configuration, ingest freshness/ranking utilities, AI client retries/fallback, KV news repository, Telegram keyboards and command profile from the monolithic Worker. The entrypoint keeps HTTP/cron orchestration and public behavior unchanged.
- Module/route: Worker runtime and `src/` architecture
- Issue reference: `Architecture: Split Worker into bounded modules v15.1`
- Validation: `pnpm run check`; `pnpm test` (40/40)
- Production: Not deployed; deploy after review with `pnpm run ship`. Queue/D1 bindings were not created because no production resource IDs were provided.
