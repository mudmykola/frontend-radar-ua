# Frontend Intelligence Radar UA Backlog

## In Progress

## Done

### Testing: Cover Worker runtime boundaries v15.2

- Priority: High
- Labels: `core`, `backend`, `api`, `Bug`, `Improvement`, `DX`
- Assignee: tovarinfobud
- Status: Done
- Scope:
  - add direct KV repository tests for TTL, dedupe, freshness, malformed records and digest separation;
  - add Gemini request, retry, fallback, configuration and empty-response tests;
  - add Telegram topic/latest integration tests with stale-record exclusion;
  - add webhook failure, idempotency, payload-limit, auth, health and configuration route tests;
  - add serialized test and coverage commands.
- Completion: 59 tests pass. `pnpm run test:coverage` reports 51.07% total line coverage, 98.78% repository coverage and 95.05% AI-client coverage. The epic also caught and fixed an untested `sortBy` repository runtime bug.

### Architecture: Split Worker into bounded modules v15.1

- Priority: Medium
- Labels: `core`, `backend`, `Refactor`, `Improvement`, `DX`
- Assignee: tovarinfobud
- Status: Done
- Scope:
  - extract source configuration and ingest utility boundaries;
  - extract AI client and fallback/retry boundary;
  - extract KV news repository boundary;
  - extract Telegram keyboards and command profile;
  - document Queue/D1 adapter boundary without inventing Cloudflare resource IDs;
  - preserve behavior with regression tests.
- Completion: `worker.js` reduced from 4,797 to 4,476 lines; new modules live under `src/config`, `src/ingest`, `src/enrichment`, `src/storage` and `src/telegram`. `pnpm run check` and 40 tests pass. Queue/D1 resources remain intentionally unprovisioned.

### Telegram: Simplify bot navigation v15

- Priority: High
- Labels: `backend`, `api`, `UI`, `Improvement`, `Content`
- Assignee: tovarinfobud
- Status: Done
- Scope:
  - replace the crowded persistent keyboard with six clear actions;
  - add a second-level inline topics menu;
  - add a practical-only feed shortcut;
  - keep legacy slash commands working for compatibility;
  - update README, tests and Dev Log.
- Completion: Compact v15 keyboard, inline topic menu, user-facing Telegram command menu, `/practice`, concise help and welcome copy are implemented. Legacy `/card`, `/p0`, `/audit` and admin commands remain compatible but are hidden from the menu. `/latest`, thematic feeds and `/full N` stay strictly date-first, use a 48-hour freshness window and trigger guarded on-demand sync when cron is stale; personalization is limited to digest. Full callbacks preserve the visible list position and total, while contextual keyboards no longer duplicate `Full`, `Latest` and `Audit`. Local implementation is validated by 40 tests; production deployment is pending this freshness-window change.

## Backlog

### Security: Rotate exposed Gemini API credential

- Priority: Urgent
- Labels: `backend`, `Bug`, `Deployment`
- Assignee: tovarinfobud
- Status: Backlog
- Scope:
  - revoke the Gemini API credential disclosed in conversation;
  - create a replacement credential without posting it in chat;
  - replace the `AI_API_KEY` Cloudflare secret and verify inference.

### Content: Diversify official frontend sources v14

- Priority: High
- Labels: `core`, `backend`, `Content`, `Improvement`, `Deployment`
- Assignee: tovarinfobud
- Status: Done
- Scope:
  - add official Vue, Nuxt, Vite, Tailwind, Cloudflare, web.dev, Nitro, Nuxt UI, Vitest and Playwright sources;
  - balance indexed items by ecosystem;
  - suppress routine patch releases and prerelease noise;
  - update README, tests and Dev Log.
- Completion: 34/34 tests pass, Wrangler dry-run passes, and production v14.0 is deployed as version `2f3b343d-b0cd-4e8c-9329-79388da2c50e`. Health confirms `Frontend Intelligence Radar UA v14.0`.

### Telegram: Open the exact article selected from any feed

- Priority: High
- Labels: `backend`, `api`, `UI`, `Bug`, `Deployment`
- Assignee: tovarinfobud
- Status: Done
- Scope:
  - replace position-based Full callbacks with stable news identifiers;
  - resolve selected articles independently of personalization and topic filtering;
  - retain `/full N` support for manually entered commands;
  - add regression coverage and deploy the fix.

- Completion: Full buttons now use a stable 16-character item reference and resolve the selected KV record directly. Production version `0ad30df5-3b0b-4d8e-9816-de0eb22dd6db` is deployed and 32 tests pass.

### Content: Rebuild Fresh Intelligence Pipeline v13

- Priority: High
- Labels: `core`, `backend`, `api`, `Content`, `UI`, `Bug`, `Improvement`, `Refactor`, `Deployment`
- Assignee: tovarinfobud
- Status: Done
- Scope:
  - show only genuinely recent official updates and rank newest information first;
  - prevent AI from assigning unrelated technology and risk tags;
  - remove navigation, authentication, and repository UI noise from article evidence;
  - require source-grounded facts and concrete file/API/config actions;
  - replace score-heavy and repetitive Telegram copy with useful plain-language cards;
  - make `/full` open one focused analysis instead of sending ten long messages;
  - process a practical batch per cron run without exposing pending or fallback content;
  - stop reading legacy news arrays and remove stale production KV aggregates;
  - add regression tests, production verification, and deployment notes.

- Completion: Production v13.0 is running at version `483498cc-a114-4370-8d54-f502873fca93`; 31 tests pass; health reports v13.0; the first scheduled run checked 113 source records, retained 22 fresh high-signal items, processed successfully without fallback, and the obsolete `latest:items` and `digest:items` aggregates were removed.

### Content: Implement Telegram Reading Experience v12

- Priority: High
- Labels: `core`, `backend`, `api`, `Content`, `Bug`, `Improvement`, `Deployment`
- Assignee: tovarinfobud
- Status: Done
- Scope:
  - hide pending AI records from Telegram delivery;
  - replace generic fallbacks with source-aware factual summaries;
  - prevent unsupported priority, risk, urgency, and impact claims;
  - enforce a minimum 70/100 publication threshold;
  - explain changes in plain Ukrainian with before/now and real-world examples;
  - add simple explanation, code example, project relevance, checklist, and not-understood actions;
  - use a bounded stable Gemini fallback chain;
  - retain full-source context, topic preferences, feedback personalization, ranking, and observability;
  - publish a new Telegram avatar, description, and command profile.

- Completion: Production v12.0 is running at version `9451090b-b608-4e62-9844-5806977b496e`; 28 tests pass, Telegram profile marker is `v12`, and the first live card completed without fallback at quality 100/100 with evidence-bounded P1/risk 4 analysis.

### Core: Build Frontend Intelligence Radar v11

- Priority: High
- Labels: `core`, `backend`, `api`, `Content`, `UI`, `Feature`, `Improvement`, `Deployment`
- Assignee: tovarinfobud
- Status: Done
- Scope:
  - rename Shopify Radar UA to Frontend Intelligence Radar UA;
  - ingest official Shopify, Vue, Nuxt, Pinia, Vite, Tailwind CSS, TypeScript, Sass, Node.js, MDN, and Cloudflare updates;
  - normalize RSS and Atom sources into one dated content pipeline;
  - deduplicate cross-posted releases and enforce freshest-only delivery;
  - fetch safe full-article context from approved official hosts;
  - generate cross-stack AI analysis with versions, breaking/security impact, affected files, actions, tests, and client opportunities;
  - extend Telegram settings and navigation by technology;
  - generate personalized immediate alerts and morning digests without low-value patch noise;
  - add regression tests, operational documentation, and deploy production v11.

- Completion: Production is running v11.0 at version `7a9e8220-eeb9-4a36-a151-15601413a3e6`; 22 tests pass, Telegram profile and webhook are synchronized, and the initial source sync fetched 114 records and indexed 21 fresh high-signal items from 6 currently active sources.

### Content: Enforce freshest-only Shopify news delivery

- Priority: High
- Labels: `core`, `backend`, `Content`, `Improvement`, `Bug`
- Assignee: tovarinfobud
- Status: Done
- Scope:
  - compared production KV dates with the official Shopify changelog feed;
  - restricted Telegram output to items published within seven days of the newest Shopify entry;
  - suppressed the feed when its newest source entry is older than fourteen days;
  - retained older records in KV as an internal archive without displaying them;
  - enabled bounded re-enrichment of recent fallback records;
  - added regression tests and deployed production v10.1.

- Completion: Production is running v10.1 at version `ea7a6bd2-003b-4fa4-941b-9a3443d4b1a3`. The official newest entry is dated 2026-08-19, so the current visible set contains only the 2026-08-19 and 2026-08-18 entries; older KV records are hidden.

### Content: Implement Telegram Intelligence v10

- Priority: High
- Labels: `core`, `backend`, `api`, `Content`, `UI`, `Feature`, `Improvement`
- Assignee: tovarinfobud
- Status: Done
- Scope:
  - redesigned compact and full Telegram cards around an immediate decision;
  - separated verified Shopify facts, AI conclusions, and assumptions;
  - added audience impact, before/after, concrete actions, expected results, and time estimates;
  - added 20-second, checklist, and client-opportunity reading modes;
  - distinguished urgency from personal relevance;
  - produced a decision-oriented personalized morning digest;
  - strengthened quality gates against generic AI output;
  - stabilized Gemini retries and limited each refresh/scheduled run to one AI item to stay inside Worker lifetime;
  - deployed and verified production v10.

- Completion: Production is running v10.0 at version `2f52cef0-f924-4fcb-9db3-3ded53e794ac`; 17 tests pass, health reports v10.0, all secrets and bindings are present, and unauthenticated webhook requests return HTTP 401.

### AI: Migrate production inference to Gemini Flash

- Priority: High
- Labels: `api`, `backend`, `Improvement`, `Deployment`
- Assignee: tovarinfobud
- Status: Done
- Scope:
  - switched the OpenAI-compatible inference endpoint from NVIDIA to Gemini;
  - configured `gemini-flash-latest` for fact extraction and editorial generation;
  - stored the temporary test credential only as a Cloudflare secret;
  - verified direct model access, local tests, dry-run, production deployment, and live health.

- Completion: Production is running v9.1 at version `df032271-7626-4435-ab94-61cbc09f2ef6` with the Gemini endpoint and model bindings. Credential rotation remains an Urgent security follow-up because the temporary key was disclosed in conversation.

### Deployment: Release AI Content Intelligence v9 to production

- Priority: High
- Labels: `Deployment`, `Improvement`, `backend`
- Assignee: tovarinfobud
- Status: Done
- Scope:
  - preserved existing production bindings, variables, and disabled preview URLs;
  - provisioned the Telegram webhook verification secret without exposing it;
  - deployed Worker v9 to `shopify-radar-ua`;
  - updated the existing Telegram webhook registration;
  - fixed the cron schedule so the 06:00 UTC daily digest can run;
  - verified the live health, webhook authentication, and deployment version.

- Completion: Production is running v9.0 at version `fc3b96f6-3469-4922-89be-a017e8bf3893`; Telegram webhook registration succeeded and unauthenticated webhook requests return HTTP 401.

### Core: Implement AI Content Intelligence v9

- Priority: High
- Labels: `core`, `backend`, `api`, `Content`, `Improvement`, `Feature`
- Assignee: tovarinfobud
- Status: Done
- Scope:
  - fetch and sanitize full Shopify changelog article context;
  - run a fact-extraction pass before editorial generation;
  - generate compact and full Ukrainian Telegram formats;
  - add benefit, risk, effort, confidence, hidden-insight, and client-opportunity fields;
  - rank content for the reader and suppress low-value immediate broadcasts;
  - collect useful/interesting/not-relevant feedback and use it for personalization;
  - add regression tests and operational documentation.

### Core: Harden and stabilize the Worker runtime

- Priority: High
- Labels: `core`, `backend`, `api`, `Bug`, `Improvement`, `Refactor`
- Assignee: tovarinfobud
- Status: Done
- Scope:
  - authenticate Telegram webhook deliveries;
  - replace admin secrets in URLs with an Authorization header;
  - validate HTTP methods, content types, and request size;
  - avoid exposing internal stack traces and upstream bodies;
  - make Telegram update handling retry-safe;
  - remove shared-array KV write races;
  - add local Wrangler configuration and automated tests;
  - document the local/deployment workflow.

- Completion: Added authenticated webhooks, header-based admin auth, safe validation/errors, retry-safe update markers, per-record KV storage, bounded Telegram delivery, a security module, local tooling, tests, and documentation.
