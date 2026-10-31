# 0003. Caching to fit CoinGecko's free tier, with snapshots as fallback

Status: accepted · 2026-10-30

## Context

The CoinGecko Demo plan allows 10,000 calls a month and throttles bursts. A dashboard that calls it per visitor would exhaust that in a day.

## Decision

Every upstream response is cached in Upstash Redis with a per-endpoint TTL (5 min to 6 h); concurrent misses share one request. A usage counter triples all TTLs above 80% of the monthly budget. The last good response per key is saved in Postgres and served with `stale: true` when CoinGecko fails. Prices are fetched in USD only; IDR/EUR use hourly rates. Live prices come from Binance WebSocket, not CoinGecko.

## Consequences

- Usage stays inside the free tier regardless of traffic.
- Data can be minutes old; the UI says "Data delayed" when it serves a snapshot.
- Coin pages render on demand (ISR), and list links don't prefetch them.
