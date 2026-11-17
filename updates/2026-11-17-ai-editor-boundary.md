# AI editor boundary

- Datetime: 2026-11-17
- Type: Refactor
- Title: Separate AI transport from enrichment execution
- Summary: Added an AI editor boundary for fact extraction and editorial summary execution. Gemini transport/retry remains in `ai-client.js`, while Worker enrichment calls the editor boundary.
- Module/route: `src/enrichment/editor.js`, AI enrichment pipeline
- Issue reference: `Architecture: Extract remaining Worker domains`
- Validation: `pnpm run check`; `pnpm test` (79/79); `git diff --check`
- Production: Not deployed.
