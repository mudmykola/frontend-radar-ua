# Diversified Official Sources v14

- Datetime: 2026-11-17 Europe/Kyiv
- Type: Improvement
- Title: Expand and balance official frontend intelligence sources
- Summary: Added official Vue and Nuxt blogs, Vite Blog, Tailwind CSS Blog, Cloudflare Blog, web.dev Blog, Nitro, Nuxt UI, Vitest and Playwright releases. Added source balancing with a four-item per-ecosystem cap and removed routine patch releases from release-only sources.
- Affected module/route/tool: `worker.js` source registry, feed indexing, freshness/high-signal filters, README, regression tests.
- Issue reference: `Content: Diversify official frontend sources v14`
- Validation: `pnpm run check`, `pnpm test` — 34/34 passed; Wrangler dry-run passed.
- Production: Worker version `2f3b343d-b0cd-4e8c-9329-79388da2c50e`; health reports `Frontend Intelligence Radar UA v14.0`.
