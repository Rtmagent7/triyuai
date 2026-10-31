# 0002. Same-origin API through a Next.js rewrite

Status: accepted · 2026-10-30

## Context

The web app and API are separate Vercel projects on different hosts. Cross-site cookies are blocked by default in several browsers, and CORS preflights add a round trip.

## Decision

The browser only calls `/api/v1` on the web origin; `next.config.ts` rewrites it to `API_ORIGIN`. Server components call the API directly with an internal key that skips the per-IP rate limit.

## Consequences

- Session cookies are first-party (`httpOnly`, `SameSite=Lax`), and there is no CORS for the browser.
- OAuth callbacks (Google) also go through the web origin, so their cookies stay first-party.
- One extra hop per request, and client IPs must be read from `X-Forwarded-For` (`trust proxy`).
