# 0005. Short JWT access cookie plus rotating refresh tokens

Status: accepted · 2026-10-30

## Context

Accounts need to stay signed in for days without long-lived bearer tokens, on serverless functions without sticky state.

## Decision

argon2id password hashes. A 15-minute JWT access cookie and a 7-day opaque refresh token, stored hashed and rotated on every use; reusing an old one revokes all of the user's sessions. A non-secret `triyu_session` hint cookie lets guests skip `/auth/me`. Login is throttled per IP and email.

## Consequences

- Stolen refresh tokens are detected on reuse.
- Access tokens can't be revoked before they expire (15 minutes at most).
