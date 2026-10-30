import type { LanguageModel } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import pino from "pino";
import type { RawDetail, RawGlobal, RawMarket, RawRates, RawTrending } from "@triyuai/shared";
import { createApp, type Deps } from "../src/app";
import { createChatService } from "../src/ai/chat";
import { MemoryCache } from "../src/cache";
import { createDb, type Db } from "../src/db";
import { loadEnv } from "../src/env";
import { AppError, NotFoundError, UpstreamError } from "../src/lib/errors";
import { createAuthService } from "../src/services/auth";
import type { CoinGeckoClient } from "../src/services/coingecko";
import { createMarketService, prismaSnapshots } from "../src/services/market";
import { createWatchlistService } from "../src/services/watchlist";
import { createChatHistoryService } from "../src/services/chats";
import { createPortfolioService } from "../src/services/portfolio";
import { createNewsService } from "../src/services/news";

export const silentLogger = pino({ level: "silent" });

export function rawMarket(id: string, i: number, over: Partial<RawMarket> = {}): RawMarket {
  const price = 1000 / (i + 1);
  return {
    id,
    symbol: id.slice(0, 3),
    name: id[0]!.toUpperCase() + id.slice(1),
    image: `https://img.test/${id}.png`,
    current_price: price,
    market_cap: 1e12 / (i + 1),
    market_cap_rank: i + 1,
    fully_diluted_valuation: null,
    total_volume: 5e9 / (i + 1),
    high_24h: price * 1.05,
    low_24h: price * 0.95,
    circulating_supply: 1e6,
    total_supply: 2e6,
    max_supply: null,
    ath: price * 2,
    ath_change_percentage: -50,
    ath_date: "2025-01-01T00:00:00.000Z",
    atl: price / 10,
    atl_change_percentage: 900,
    atl_date: "2020-01-01T00:00:00.000Z",
    sparkline_in_7d: { price: [price * 0.9, price * 0.95, price] },
    price_change_percentage_1h_in_currency: 0.1,
    price_change_percentage_24h_in_currency: i % 2 ? -(i + 1) : i + 1,
    price_change_percentage_7d_in_currency: 3,
    ...over,
  };
}

export const MARKETS: RawMarket[] = [
  "bitcoin",
  "ethereum",
  "solana",
  "chainlink",
  "dogecoin",
  "cardano",
  "polkadot",
  "litecoin",
  "uniswap",
  "stellar",
  "monero",
  "tron",
].map((id, i) => rawMarket(id, i));

const raw = {
  global: {
    data: {
      active_cryptocurrencies: 15000,
      total_market_cap: { usd: 2.5e12 },
      total_volume: { usd: 9e10 },
      market_cap_percentage: { btc: 58.1, eth: 11.2 },
      market_cap_change_percentage_24h_usd: 1.25,
      updated_at: 1_790_000_000,
    },
  } satisfies RawGlobal,
  trending: {
    coins: [
      { item: { id: "solana", name: "Solana", symbol: "sol", small: "s.png", market_cap_rank: 3 } },
      {
        item: {
          id: "brett",
          name: "Brett",
          symbol: "brett",
          small: "b.png",
          market_cap_rank: 400,
          data: { price: 0.05, price_change_percentage_24h: { usd: 12 } },
        },
      },
    ],
  } satisfies RawTrending,
  rates: {
    rates: {
      btc: { value: 1 },
      usd: { value: 100_000 },
      idr: { value: 1.6e9 },
      eur: { value: 92_000 },
    },
  } satisfies RawRates,
};

export function rawDetail(id: string): RawDetail {
  const m = MARKETS.find((c) => c.id === id) ?? rawMarket(id, 300);
  const usd = (n: number | null) => ({ usd: n ?? 0 });
  return {
    id,
    symbol: m.symbol,
    name: m.name,
    image: { large: m.image },
    description: { en: `<p>${m.name} is a <a href="https://example.com">coin</a>.</p>` },
    categories: ["Layer 1", null],
    genesis_date: "2009-01-03",
    links: {
      homepage: ["https://example.com", ""],
      whitepaper: "",
      blockchain_site: ["https://explorer.test", ""],
      twitter_screen_name: id,
      subreddit_url: "https://www.reddit.com",
      repos_url: { github: [`https://github.com/${id}`] },
    },
    market_data: {
      current_price: usd(m.current_price),
      market_cap: usd(m.market_cap),
      market_cap_rank: m.market_cap_rank,
      fully_diluted_valuation: usd(m.fully_diluted_valuation),
      total_volume: usd(m.total_volume),
      high_24h: usd(m.high_24h),
      low_24h: usd(m.low_24h),
      price_change_percentage_24h_in_currency: usd(m.price_change_percentage_24h_in_currency ?? 0),
      circulating_supply: m.circulating_supply,
      total_supply: m.total_supply,
      max_supply: m.max_supply,
      ath: usd(m.ath),
      ath_change_percentage: usd(m.ath_change_percentage),
      ath_date: { usd: m.ath_date! },
      atl: usd(m.atl),
      atl_change_percentage: usd(m.atl_change_percentage),
      atl_date: { usd: m.atl_date! },
      sparkline_7d: { price: [1, 2, 3, 4] },
    },
  };
}

/** In-process stand-in for CoinGecko. `fail` makes every call throw (e.g. a 429). */
export function fakeCoinGecko() {
  const calls: string[] = [];
  const state = { fail: null as AppError | null };
  const client: CoinGeckoClient = {
    async get<T>(path: string, params: Record<string, string | number | boolean> = {}) {
      calls.push(
        path + (params.ids ? `?ids=${params.ids}` : params.query ? `?query=${params.query}` : ""),
      );
      if (state.fail) throw state.fail;
      const out = (): unknown => {
        if (path === "/coins/markets") {
          if (params.ids) {
            const ids = String(params.ids).split(",");
            return ids.filter((id) => id.startsWith("extra-")).map((id) => rawMarket(id, 299));
          }
          return MARKETS;
        }
        if (path === "/global") return raw.global;
        if (path === "/search/trending") return raw.trending;
        if (path === "/exchange_rates") return raw.rates;
        if (path === "/exchanges")
          return [
            {
              id: "kraken",
              name: "Kraken",
              image: "https://img/kraken.png",
              url: "https://www.kraken.com/",
              country: "United States",
              year_established: 2011,
              trust_score: 10,
              trust_score_rank: 1,
              trade_volume_24h_btc: 2,
            },
            {
              id: "tiny",
              name: "Tiny",
              image: "https://img/tiny.png",
              url: "https://tiny.example/",
              country: "",
              year_established: null,
              trust_score: null,
              trust_score_rank: 2,
              trade_volume_24h_btc: null,
            },
          ];
        if (path === "/search") {
          return {
            coins: [
              { id: "extra-sol-fork", name: "Sol Fork", symbol: "solf", market_cap_rank: 900 },
            ],
          };
        }
        const chart = path.match(/^\/coins\/([^/]+)\/market_chart$/);
        if (chart) {
          const now = 1_790_000_000_000;
          const n = Number(params.days === "max" ? 2000 : params.days) * 24;
          return {
            prices: Array.from({ length: n + 1 }, (_, k) => [now - (n - k) * 3_600_000, 100 + k]),
          };
        }
        const coin = path.match(/^\/coins\/([^/]+)$/);
        if (coin) {
          const id = decodeURIComponent(coin[1]!);
          if (id === "missing-coin") throw new NotFoundError("Coin not found");
          return rawDetail(id);
        }
        throw new UpstreamError(500, `unexpected path ${path}`);
      };
      return out() as T;
    },
  };
  return { client, calls, state };
}

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 5, text: 5, reasoning: 0 },
};

/** A scripted model step: optional tool calls, then text. */
export type Step = { tools?: { name: string; input: object }[]; text?: string };

export function mockModel(steps: Step[] | (() => never)): LanguageModel {
  if (typeof steps === "function") {
    return new MockLanguageModelV4({ doStream: async () => steps() });
  }
  return new MockLanguageModelV4({
    doStream: steps.map((step, s) => {
      const parts: unknown[] = [{ type: "stream-start", warnings: [] }];
      step.tools?.forEach((t, k) =>
        parts.push({
          type: "tool-call",
          toolCallId: `call_${s}_${k}`,
          toolName: t.name,
          input: JSON.stringify(t.input),
        }),
      );
      if (step.text) {
        parts.push({ type: "text-start", id: `t${s}` });
        for (const word of step.text.split(/(?<= )/))
          parts.push({ type: "text-delta", id: `t${s}`, delta: word });
        parts.push({ type: "text-end", id: `t${s}` });
      }
      parts.push({
        type: "finish",
        usage,
        finishReason: { unified: step.tools?.length ? "tool-calls" : "stop", raw: undefined },
      });
      return {
        stream: new ReadableStream({
          start(c) {
            parts.forEach((p) => c.enqueue(p as never));
            c.close();
          },
        }),
      };
    }),
  });
}

export type TestContext = Awaited<ReturnType<typeof createTestContext>>;

/** A full app on an in-memory Postgres (PGlite), memory cache and fake CoinGecko. */
export async function createTestContext(
  opts: {
    models?: { name: string; model: LanguageModel }[];
    db?: Db;
    internalKey?: string;
    /** Answers the news feeds (RSS); real fetch otherwise. */
    fetch?: typeof fetch;
  } = {},
) {
  const env = loadEnv({
    NODE_ENV: "test",
    DATABASE_URL: "pglite:memory",
    JWT_SECRET: "test-secret-0123456789abcdef0123456789",
    INTERNAL_API_KEY: opts.internalKey,
  });
  const db = opts.db ?? (await createDb("pglite:memory"));
  const cache = new MemoryCache();
  const cg = fakeCoinGecko();
  const market = createMarketService({
    cache,
    coingecko: cg.client,
    snapshots: prismaSnapshots(db),
    logger: silentLogger,
    monthlyBudget: 10_000,
    hasApiKey: false,
  });
  const news = createNewsService({ cache, market, logger: silentLogger, fetch: opts.fetch });
  const deps: Deps = {
    env,
    logger: silentLogger,
    cache,
    market,
    auth: createAuthService({ db, cache, jwtSecret: env.JWT_SECRET }),
    watchlist: createWatchlistService(db),
    history: createChatHistoryService(db),
    portfolio: createPortfolioService(db),
    news,
    chat: createChatService({ market, news, models: opts.models ?? [], logger: silentLogger }),
  };
  return { app: createApp(deps), deps, db, cache, cg };
}

/** Parses an SSE body into its JSON events. */
export const sseEvents = (text: string) =>
  text
    .split("\n\n")
    .filter((b) => b.startsWith("data: "))
    .map((b) => JSON.parse(b.slice(6)) as { type: string; [k: string]: unknown });
