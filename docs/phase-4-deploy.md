# Phase 4: deploying the real API

The site runs in prototype mode today (`NEXT_PUBLIC_API_MOCKING=enabled`): prices, global
stats and sectors come from a CoinGecko snapshot, and Ask TRIYU is a scripted demo. Phase 4
deploys `apps/api` as a second Vercel project and points the web app at it.

Everything below except the accounts is already in the repo: the API bundles itself
(`pnpm --filter @triyuai/api build` → `apps/api/api/index.mjs`) and `apps/api/vercel.json`
serves it as one Vercel Function.

## 1. Accounts (free tiers)

| Service                                                  | What it is for                                                            | Env var(s) on the API                                |
| -------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------- |
| [Neon](https://neon.tech)                                | Postgres: users, watchlists, saved snapshots                              | `DATABASE_URL`                                       |
| [Upstash](https://upstash.com) Redis                     | Shared cache and rate limits across function instances                    | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |
| [CoinGecko](https://www.coingecko.com/en/api) Demo key   | Higher, dedicated rate limit (keyless works, but is shared and throttled) | `COINGECKO_API_KEY`                                  |
| [Groq](https://console.groq.com)                         | Ask TRIYU's main model                                                    | `GROQ_API_KEY`                                       |
| [Google AI Studio](https://aistudio.google.com) (Gemini) | Fallback model when Groq fails                                            | `GOOGLE_GENERATIVE_AI_API_KEY`                       |

Neon and Upstash can also be added from the Vercel Marketplace, which fills in their
env vars on the API project automatically.

## 2. The API project on Vercel

- New project from the same GitHub repo, **Root Directory** `apps/api` (build and install
  commands come from `apps/api/vercel.json`).
- Env vars: the ones above, plus
  - `NODE_ENV=production`
  - `JWT_SECRET`: 32+ random characters
  - `INTERNAL_API_KEY`: 16+ random characters (shared with the web project)
  - `IP_HASH_SALT`: random
  - `WEB_ORIGIN=https://triyuai.vercel.app`
- Once, after `DATABASE_URL` is set: `pnpm --filter @triyuai/api db:migrate`.
- Check `https://<api-project>.vercel.app/api/v1/health` and `/docs`.

## 3. Switch the web project

On the existing `triyuai` project:

- `NEXT_PUBLIC_API_MOCKING=disabled`
- `API_ORIGIN=https://<api-project>.vercel.app`
- `INTERNAL_API_KEY`: the same value as on the API

Redeploy. The browser keeps calling same-origin `/api/v1`; Next proxies it to the API, so
auth cookies stay first-party.

## 4. After switching

- Guest chat quotas are per IP: confirm `x-forwarded-for` reaches the API through the
  Next rewrite (log `req.ip` once, or send two guest messages from different networks).
- Fear & Greed, the liquidation heatmap and funding rates are already live in the browser
  and don't depend on the API.
