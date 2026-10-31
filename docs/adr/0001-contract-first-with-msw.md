# 0001. Contract first, frontend on MSW

Status: accepted · 2026-10-29

## Context

The frontend had to be live (v0.1) before any backend existed, and switching to the real API later must not mean rewriting data code.

## Decision

Every `/api/v1` request and response is a Zod schema in `packages/shared`. Phase 1 serves that contract from MSW (browser) and a fixture adapter (server components), using a real CoinGecko snapshot. The Express API validates against the same schemas, and the Swagger document is generated from them.

## Consequences

- Switching to the real API is two env vars (`NEXT_PUBLIC_API_MOCKING=disabled`, `API_ORIGIN`).
- Previews and E2E still run on MSW, so they need no backend and are deterministic.
- Two implementations of the contract (mock and real) must be kept in step; the API tests check every response against the schemas to catch drift.
