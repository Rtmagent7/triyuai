# 0007. PGlite for local development and tests, real Postgres in CI

Status: accepted · 2026-10-30

## Context

The PRD planned Testcontainers, which needs Docker on every machine and slows tests down.

## Decision

`DATABASE_URL=pglite:...` starts Postgres compiled to WebAssembly in-process and applies the SQL migrations. Tests use an in-memory instance each. CI additionally runs the account flow against a Postgres 17 service after `prisma migrate deploy`.

## Consequences

- No Docker, no database server, and tests start in milliseconds.
- PGlite is single-connection; behaviour that depends on concurrency is covered by the CI Postgres job.
