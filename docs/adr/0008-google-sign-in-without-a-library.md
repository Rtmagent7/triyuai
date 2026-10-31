# 0008. Sign in with Google without an auth library

Status: accepted · 2026-10-31

## Context

Google login (P1) had to fit the existing cookie sessions rather than replace them with a framework's session model.

## Decision

Authorization code flow with PKCE (S256). State, verifier and return path sit in a 10-minute `httpOnly` cookie scoped to the Google sign-in routes. The ID token is verified with `jose` against Google's published keys (audience, issuer, `email_verified`). Accounts are linked by email; the demo account can never be. The feature is off until the client ID and secret are set.

## Consequences

- About 150 lines, fully tested with a fake Google and locally signed tokens.
- Only Google is supported; another provider means another small client.
