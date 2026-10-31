# 0004. Ask TRIYU answers only from tools, Groq first and Gemini as fallback

Status: accepted · 2026-10-30

## Context

A market assistant that invents prices is worse than none. Free LLM tiers are rate-limited and occasionally down.

## Decision

The model gets numbers only through eight tools backed by the cached market service (overview, coin details, movers, search, compare, sentiment, sectors, news). It is instructed to refuse buy/sell advice and to state the data time. The Vercel AI SDK streams the reply over SSE; if Groq fails before the first token, Gemini takes over. Daily quotas (10 guest, 30 signed-in) live in Redis.

## Consequences

- Answers cite real, current data, and tool calls are shown as chips.
- Both providers are free tiers, so heavy use hits the quota message rather than a bill.
- A failure mid-stream is not retried on the other provider (the user can regenerate).
