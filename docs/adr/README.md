# Architecture decision records

Short records of the decisions that shaped TRIYUAI: the context, what was decided, and what it costs. The full spec is in [`PRDProject1.md`](../../PRDProject1.md).

| #    | Decision                                                                                                     | Date       |
| ---- | ------------------------------------------------------------------------------------------------------------ | ---------- |
| 0001 | [Contract first, frontend on MSW](./0001-contract-first-with-msw.md)                                         | 2026-10-29 |
| 0002 | [Same-origin API through a Next.js rewrite](./0002-same-origin-api-proxy.md)                                 | 2026-10-30 |
| 0003 | [Caching to fit CoinGecko's free tier, with snapshots as fallback](./0003-coingecko-budget-and-snapshots.md) | 2026-10-30 |
| 0004 | [Ask TRIYU answers only from tools, Groq first and Gemini as fallback](./0004-grounded-ai-with-fallback.md)  | 2026-10-30 |
| 0005 | [Short JWT access cookie plus rotating refresh tokens](./0005-sessions.md)                                   | 2026-10-30 |
| 0006 | [The Express API as one bundled Vercel Function](./0006-api-as-one-vercel-function.md)                       | 2026-10-30 |
| 0007 | [PGlite for local development and tests, real Postgres in CI](./0007-pglite-for-tests.md)                    | 2026-10-30 |
| 0008 | [Sign in with Google without an auth library](./0008-google-sign-in-without-a-library.md)                    | 2026-10-31 |
| 0009 | [Sentry for errors, GitHub Actions for uptime](./0009-monitoring.md)                                         | 2026-10-31 |
