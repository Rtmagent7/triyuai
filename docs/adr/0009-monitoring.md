# 0009. Sentry for errors, GitHub Actions for uptime

Status: accepted · 2026-10-31

## Context

A live portfolio project needs to know when it breaks, without paid tools or slowing the site down.

## Decision

Sentry (free) is off until a DSN is set. The API reports only unexpected 500s and process crashes, flushing before the response because serverless instances can freeze. The browser loads the SDK after the page is idle and also reports errors caught by React error boundaries. No cookies, headers, bodies or user info are sent, and there is no tracing. A scheduled workflow checks the site and API every 15 minutes and opens an issue when a check fails twice.

## Consequences

- First-load JS is unchanged, and 4xx noise never reaches Sentry.
- No performance tracing or session replay; source maps are not uploaded, so browser stack traces are minified.
