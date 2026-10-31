# 0006. The Express API as one bundled Vercel Function

Status: accepted · 2026-10-30

## Context

The API should run on the free Vercel plan next to the web app, without a separate server, but stay a normal Express app locally and in tests.

## Decision

esbuild bundles `src/vercel.ts` and the workspace packages into `dist/server.mjs`, which `api/index.mjs` re-exports. Native or optional packages (argon2, PGlite, pino, Sentry) stay external. Production builds run `prisma migrate deploy`; the project deploys only from `main`.

## Consequences

- One cold start covers every route, and local development is plain `node`.
- In-memory state isn't shared between instances, so cache, rate limits and quotas must live in Redis.
