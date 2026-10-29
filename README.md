# TRIYUAI

**Real-time crypto dashboard with an AI market assistant.** Portfolio project. The full spec is in [`PRDProject1.md`](./PRDProject1.md).

> Status: **Phase 3: backend.** The Express API (`apps/api`) serves live CoinGecko data through a cache, accounts with a synced watchlist, and the Ask TRIYU chatbot on Groq/Gemini. The public demo still runs in prototype mode (MSW mock API + CoinGecko snapshot) until the API is deployed in Phase 4.

## Features

| Feature                                                                                                                             | Where                                     |
| ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Global stats bar (auto-refresh 60 s)                                                                                                | every page                                |
| Top-250 market table: sort, filter, sparklines, `?page=1..3`, sticky header/coin column                                             | `/`                                       |
| Live prices for the top 20 (Binance WebSocket, flash on change, backoff + polling fallback)                                         | `/`, coin pages, watchlist                |
| Highlights: trending, gainers, losers, highest volume                                                                               | `/`, `/highlights`                        |
| ⌘K / Ctrl+K command palette (debounced search, trending, recent searches)                                                           | every page                                |
| Coin detail: header, 24h range, line/candlestick chart (24H–MAX), stats, converter, about, OG image                                 | `/coins/[id]`                             |
| **Ask TRIYU** chatbot: streaming, tool chips, markdown tables, Stop/Copy/Regenerate, refuses buy/sell advice, 10 guest messages/day | floating panel + `/ask`                   |
| Converter synced to the URL                                                                                                         | `/converter?from=bitcoin&to=idr&amount=1` |
| Watchlist: on the device for guests, synced to the account when signed in (local list merged on first login, optimistic updates)    | `/watchlist`                              |
| Accounts: register, login, one-click demo account, httpOnly cookie sessions                                                         | `/login`, `/register`                     |
| Dark/light/system theme, USD/IDR/EUR                                                                                                | navbar                                    |
| 404, error boundaries, disclaimer, case study                                                                                       | `/about`, `/disclaimer`                   |

## Getting started

Requirements: Node 22+ and pnpm 10+. No database, Redis or API keys are needed to run it locally.

**Prototype mode** (frontend only, mock API):

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local
pnpm --filter @triyuai/web dev     # http://localhost:3000
```

**Full stack** (Express API + frontend):

```bash
cp apps/api/.env.example apps/api/.env      # every service is optional, see below
pnpm --filter @triyuai/api dev              # http://localhost:4000, Swagger UI at /docs

# apps/web/.env.local
NEXT_PUBLIC_API_MOCKING=disabled
API_ORIGIN=http://localhost:4000
```

Without credentials, the API falls back to local stand-ins:

| Service                   | With credentials              | Without (local development)                              |
| ------------------------- | ----------------------------- | -------------------------------------------------------- |
| Postgres                  | Neon (`DATABASE_URL`)         | Embedded PGlite in `apps/api/.pglite`, migrated on start |
| Cache, rate limit, quotas | Upstash Redis                 | In-memory (single process)                               |
| Market data               | CoinGecko Demo key            | Keyless public API (low, shared rate limit)              |
| Ask TRIYU                 | Groq, then Gemini as fallback | `/ai/chat` returns 503                                   |

Other scripts:

```bash
pnpm build          # production build (all workspaces)
pnpm typecheck
pnpm lint
pnpm format
pnpm fixtures       # refresh the CoinGecko snapshot (takes ~10–20 min on the keyless API)
```

## Project structure

```
apps/api/                 Express 5 API (Vercel Function in Phase 4)
  src/services/           CoinGecko client, cached market service, auth, watchlist
  src/ai/chat.ts          Ask TRIYU: AI SDK tools + Groq → Gemini fallback, SSE events
  src/routes/             /api/v1 routers; OpenAPI document + Swagger UI at /docs
  prisma/                 schema + SQL migrations (User, RefreshToken, WatchlistItem, MarketSnapshot)
  test/                   Supertest contract/integration tests on PGlite + optional real Postgres
apps/web/                 Next.js 15 (App Router), React 19, Tailwind CSS v4
  src/app/                routes (SSR/ISR/SSG per PRD §8)
  src/components/         UI by domain: market, coin, chat, search, layout, converter, ui
  src/hooks/              TanStack Query hooks, live prices, currency formatting
  src/stores/             Zustand: preferences, watchlist, chat, live prices, recent searches
  src/lib/api/            browser client (→ MSW), server adapter, query keys
  src/mocks/              MSW handlers, fixture-backed data layer, mock chat engine, fixtures/
packages/shared/          Zod schemas = the API contract; CoinGecko mappers and chart helpers
scripts/fetch-fixtures.ts snapshot generator (CoinGecko public API, same mappers as the API)
```

## Engineering decisions

- **Contract first, MSW second.** `packages/shared` defines every `/api/v1` request and response with Zod. MSW, the Express API and the Swagger docs all use the same schemas, and the API tests check every response against them. Switching the frontend to the real API only needs `NEXT_PUBLIC_API_MOCKING=disabled` and `API_ORIGIN`.
- **Same-origin API.** The browser calls `/api/v1` on the web origin and Next.js rewrites it to the API. Auth cookies stay first-party (`SameSite=Lax`, `httpOnly`), and no CORS preflight is needed. A readable `triyu_session` hint cookie (no secret) lets guests skip `/auth/me` entirely, so they never trigger a 401.
- **Stay inside 10,000 CoinGecko calls a month.** Every response is cached in Redis with a per-endpoint TTL (5 min to 6 h), and concurrent misses share one upstream call. Above 80% of the monthly budget all TTLs triple. Prices are fetched in USD only, and IDR/EUR are converted with hourly rates. Coin pages render on demand (ISR) instead of 100 at build time, and list links do not prefetch coin pages.
- **Degrade, don't fail.** The last good response for each key is saved in Postgres. When CoinGecko rate-limits, the API serves that snapshot with `stale: true` and the UI shows a "Data delayed" badge. A coin page without a snapshot falls back to its row from the top-250 list.
- **Sessions.** argon2id password hashes. A 15-minute JWT access cookie plus a 7-day opaque refresh token, stored hashed and rotated on every use. Reusing an old refresh token revokes all of the user's sessions. Login is throttled per IP and email, and unknown emails take the same time as wrong passwords.
- **AI that cannot make up prices.** Ask TRIYU only gets numbers through five tools (`getMarketOverview`, `getCoinDetails`, `getTopMovers`, `searchCoin`, `compareCoins`) backed by the cached market service. Groq is tried first; if it fails before any output is streamed, Gemini takes over. Quotas are 10 messages a day per hashed IP for guests and 30 for signed-in users, enforced in Redis.
- **MSW starts lazily.** The service worker only starts on the first client-side API call, so server-rendered HTML is never blocked by it.
- **Real snapshot, honest gaps.** Top-250 market data, global stats, trending and FX rates come from a real CoinGecko snapshot, and the top 20 coins also have full details and one year of price history. Charts for other coins are simulated from their real 7-day sparkline and labelled as such in the UI. The keyless API caps history at 365 days, so MAX shows one year.
- **Binance host.** Live prices use `data-stream.binance.vision`, Binance's market-data-only endpoint, with `stream.binance.com` as the fallback. `binance.com` is blocked by many Indonesian ISPs; the `binance.vision` host is not.
- **Ticks are batched.** WebSocket messages are flushed into a Zustand store at most every 500 ms. Only the affected `PriceCell`s re-render and flash, and `tabular-nums` keeps digits from shifting.
- **Logos load from the CDN, not through `next/image` optimisation.** The `small` CoinGecko variants are tiny already, and proxying 250+ images would use up the Vercel Hobby image quota.
- **The chart is lazy-loaded.** Lightweight Charts loads after first paint, which keeps the coin page at about 181 kB of first-load JS (budget: 200 kB).

## Testing

| Layer             | Tooling                                      | What it covers                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit & component  | Vitest, React Testing Library, MSW (Node)    | Formatters, sanitizer, Binance client (fake WebSocket), mock data layer, chat engine, Zustand stores (incl. SSE streaming, stop, regenerate, quota), hooks, and every UI component. Coverage gate is ≥ 80% (currently ~98%).                                                                                                                                                                                                                             |
| End-to-end        | Playwright                                   | The five flows from the PRD's 60-second demo script, plus pagination, converter URL state and 404. The Binance socket is replaced with `routeWebSocket` so live-price flashes are deterministic.                                                                                                                                                                                                                                                         |
| Accessibility     | axe-core in Playwright                       | 8 pages × dark/light against WCAG 2.2 AA (fails on serious/critical), the chat dialog's keyboard flow, and mobile overflow on every page.                                                                                                                                                                                                                                                                                                                |
| API               | Vitest, Supertest, PGlite, Postgres 17 in CI | Every endpoint checked against the shared Zod contract. Also covers caching and request de-duplication, snapshot fallback, the quota guard, the auth flow (cookies, refresh rotation and reuse detection, throttling, demo reset), watchlist sync, rate limits, and the AI stream with a mock model (tools, context, Groq→Gemini fallback, quotas). In CI the account flow also runs against real Postgres after `prisma migrate deploy`. Coverage ~96%. |
| Performance & SEO | Lighthouse CI (mobile)                       | Home and coin page. Accessibility, Best Practices and SEO must reach ≥ 0.95 and CLS < 0.1; Performance ≥ 0.9 is a warning because shared runners are noisy.                                                                                                                                                                                                                                                                                              |

```bash
pnpm test                         # web + API (unit, component, contract, integration)
pnpm --filter @triyuai/web test:coverage
pnpm build && pnpm test:e2e       # E2E against the production build
# locally, reuse installed Chrome instead of downloading Chromium:
E2E_CHANNEL=chrome pnpm test:e2e
```

CI (`.github/workflows/ci.yml`) runs four parallel jobs on every PR and on every push to `main`: quality, API tests against a Postgres service, E2E + accessibility, and Lighthouse. Dependabot opens weekly update PRs.

**Bugs the tests caught:**

- Light-mode text contrast was below WCAG AA, so the light tokens are darker than the PRD draft.
- The ⌘K "Clear" button sat inside an `aria-hidden` heading.
- Converter selects announced the coin logo's alt text as part of their name.
- `/highlights` and `/converter` overflowed horizontally on phones.
- The mobile menu stayed open after navigating.
- Compact currency formatting differed between Node 22 and browsers, which caused a hydration error.
- Coin descriptions lost links whose `href` contained `'`.
- (Phase 3) List links prefetched every visible coin page, so each homepage visit triggered dozens of CoinGecko calls and hit the rate limit.
- (Phase 3) Starring a coin before `/auth/me` returned saved it to the device instead of the account.
- (Phase 3) One malformed logo URL in CoinGecko data made their CDN hang, which stalled `networkidle` in E2E runs. Logos are now stubbed in E2E.

## Known limitations

- The public demo still runs in prototype mode. The API is deployed in Phase 4, together with Neon, Upstash and the AI keys.
- In prototype mode, Ask TRIYU is a rule-based mock, and accounts are simulated in `localStorage`.
- Backend tests use PGlite (Postgres compiled to WASM) locally, plus a real Postgres service in CI, instead of Testcontainers.

## Attribution

Data provided by [CoinGecko](https://www.coingecko.com/). Live prices from the Binance public WebSocket. Not financial advice.
