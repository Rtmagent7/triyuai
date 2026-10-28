# TRIYUAI

**Real-time crypto dashboard with an AI market assistant.** Portfolio project. The full spec is in [`PRDProject1.md`](./PRDProject1.md).

> Status: **Phase 1 — frontend prototype** (`v0.1` candidate). Every P0 frontend feature runs on a mock API (MSW) backed by a real CoinGecko snapshot, with live prices streamed from Binance. Backend, auth and the real LLM come in Phase 3.

## Features (Phase 1)

| Feature | Where |
| --- | --- |
| Global stats bar (auto-refresh 60 s) | every page |
| Top-250 market table: sort, filter, sparklines, `?page=1..3`, sticky header/coin column | `/` |
| Live prices for the top 20 (Binance WebSocket, flash on change, backoff + polling fallback) | `/`, coin pages, watchlist |
| Highlights: trending, gainers, losers, highest volume | `/`, `/highlights` |
| ⌘K / Ctrl+K command palette (debounced search, trending, recent searches) | every page |
| Coin detail: header, 24h range, line/candlestick chart (24H–MAX), stats, converter, about, OG image | `/coins/[id]` |
| **Ask TRIYU** chatbot: streaming, tool chips, markdown tables, Stop/Copy/Regenerate, refuses buy/sell advice, 10 guest messages/day | floating panel + `/ask` |
| Converter synced to the URL | `/converter?from=bitcoin&to=idr&amount=1` |
| Local watchlist | `/watchlist` |
| Dark/light/system theme, USD/IDR/EUR | navbar |
| 404, error boundaries, disclaimer, case study | `/about`, `/disclaimer` |

## Getting started

Requirements: Node 22+ and pnpm 10+.

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local
pnpm dev            # http://localhost:3000
```

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
apps/web/                 Next.js 15 (App Router), React 19, Tailwind CSS v4
  src/app/                routes (SSR/ISR/SSG per PRD §8)
  src/components/         UI by domain: market, coin, chat, search, layout, converter, ui
  src/hooks/              TanStack Query hooks, live prices, currency formatting
  src/stores/             Zustand: preferences, watchlist, chat, live prices, recent searches
  src/lib/api/            browser client (→ MSW), server adapter, query keys
  src/mocks/              MSW handlers, fixture-backed data layer, mock chat engine, fixtures/
packages/shared/          Zod schemas = the API contract shared with the future backend
scripts/fetch-fixtures.ts snapshot generator (CoinGecko public API)
```

## Engineering decisions

- **Contract first, MSW second.** `packages/shared` defines every `/api/v1` response with Zod. The browser calls the real URLs, and MSW answers them in Phase 1, so switching to the Express API means setting `NEXT_PUBLIC_API_MOCKING=disabled` and `NEXT_PUBLIC_API_URL`. Server components read the same fixture-backed functions through `lib/api/server.ts`.
- **MSW starts lazily.** The service worker only starts on the first client-side API call, so server-rendered HTML is never blocked by it.
- **Real snapshot, honest gaps.** Top-250 market data, global stats, trending and FX rates come from a real CoinGecko snapshot, and the top 20 coins also have full details and one year of price history. Charts for other coins are simulated from their real 7-day sparkline and labelled as such in the UI. The keyless API caps history at 365 days, so MAX shows one year.
- **Binance host.** Live prices use `data-stream.binance.vision`, Binance's market-data-only endpoint, with `stream.binance.com` as the fallback. `binance.com` is blocked by many Indonesian ISPs; the `binance.vision` host is not.
- **Ticks are batched.** WebSocket messages are flushed into a Zustand store at most every 500 ms. Only the affected `PriceCell`s re-render and flash, and `tabular-nums` keeps digits from shifting.
- **Logos load from the CDN, not through `next/image` optimisation.** The `small` CoinGecko variants are tiny already, and proxying 250+ images would use up the Vercel Hobby image quota.
- **The chart is lazy-loaded.** Lightweight Charts loads after first paint, which keeps the coin page at about 181 kB of first-load JS (budget: 200 kB).

## Known limitations (Phase 1)

- No login or account sync yet. The watchlist and chat quota live in `localStorage`.
- Ask TRIYU is a rule-based mock that mimics tool calling over the snapshot and live prices. It is replaced by Groq/Gemini with real tool calls in Phase 3.
- The snapshot is static apart from the 20 live-streamed coins.

## Attribution

Data provided by [CoinGecko](https://www.coingecko.com/). Live prices from the Binance public WebSocket. Not financial advice.
