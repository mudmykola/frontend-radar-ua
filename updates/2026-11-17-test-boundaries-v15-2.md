# Worker test boundary coverage

- Datetime: 2026-11-17
- Type: Improvement
- Title: Cover Worker runtime boundaries with integration tests
- Summary: Added KV repository, Gemini client, ingestion, Telegram webhook/topic, auth, payload-limit, health and Telegram configuration tests. Serialized the test runner to keep fetch-mocking deterministic and added a coverage command.
- Module/route: `test/`, `src/storage`, `src/enrichment`, Telegram webhook and admin routes
- Issue reference: `Testing: Cover Worker runtime boundaries v15.2`
- Validation: `pnpm run check`; `pnpm test` (61/61); `pnpm run test:coverage`; `pnpm exec wrangler deploy --dry-run`
- Production: Not deployed.
