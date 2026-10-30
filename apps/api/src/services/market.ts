import {
  mapDetail,
  mapExchange,
  mapGlobal,
  mapMarket,
  mapRates,
  mapTrending,
  sliceRange,
  toLine,
  toOhlc,
  toSummary,
  type ApiResponse,
  type ChartData,
  type ChartRange,
  type Coin,
  type CoinDetail,
  type CoinSummary,
  type CoinsPage,
  type Exchange,
  type GlobalStats,
  type Highlights,
  type Meta,
  type RawDetail,
  type RawExchange,
  type RawGlobal,
  type RawMarket,
  type RawRates,
  type RawSearch,
  type RawTrending,
  type Rates,
} from "@triyuai/shared";
import type { Cache } from "../cache";
import type { Db } from "../db";
import { AppError, NotFoundError, UpstreamError } from "../lib/errors";
import type { Logger } from "../lib/logger";
import { usageKey, type CoinGeckoClient } from "./coingecko";

/** Cache TTLs in seconds (PRD §11). */
export const TTL = {
  markets: 300,
  global: 600,
  trending: 900,
  rates: 3_600,
  exchanges: 600,
  coin: 600,
  search: 3_600,
  /** After a failure, a snapshot is re-served for a minute before CoinGecko is retried. */
  fallback: 60,
  chart: { "24h": 300, "7d": 900, "1m": 1_800, "3m": 3_600, "1y": 21_600, max: 21_600 },
} as const satisfies Record<string, unknown>;

const chartDays: Record<ChartRange, string> = {
  "24h": "1",
  "7d": "7",
  "1m": "30",
  "3m": "90",
  "1y": "365",
  max: "max",
};

/** Last good copy of each key, used when CoinGecko is rate-limited or down. */
export interface SnapshotStore {
  get(key: string): Promise<{ payload: unknown; fetchedAt: Date } | null>;
  put(key: string, payload: unknown, fetchedAt: Date): Promise<void>;
}

export const prismaSnapshots = (db: Db): SnapshotStore => ({
  get: (key) => db.marketSnapshot.findUnique({ where: { key } }),
  put: async (key, payload, fetchedAt) => {
    const data = { payload: payload as object, fetchedAt };
    await db.marketSnapshot.upsert({ where: { key }, create: { key, ...data }, update: data });
  },
});

type Entry<T> = { data: T; fetchedAt: string; source: "coingecko" | "snapshot" };

const respond = <T>(e: Entry<T>): ApiResponse<T> => ({
  data: e.data,
  meta: { fetchedAt: e.fetchedAt, source: e.source, stale: e.source === "snapshot" },
});

/** Market-only detail for when CoinGecko's coin endpoint is unavailable. */
const partialDetail = (c: Coin): CoinDetail => ({
  ...c,
  description: `${c.name} (${c.symbol}) is ranked #${c.rank} by market capitalization. Project details are temporarily unavailable.`,
  categories: [],
  genesisDate: null,
  links: {
    homepage: null,
    whitepaper: null,
    explorers: [],
    twitter: null,
    reddit: null,
    github: null,
  },
  hasFullDetail: false,
});

/** The older and staler of two metas, for responses built from several sources. */
const mergeMeta = (a: Meta, b: Meta): Meta => ({
  fetchedAt: a.fetchedAt < b.fetchedAt ? a.fetchedAt : b.fetchedAt,
  source: a.stale ? a.source : b.source,
  stale: a.stale || b.stale,
});

export type MarketService = ReturnType<typeof createMarketService>;

export function createMarketService(deps: {
  cache: Cache;
  coingecko: CoinGeckoClient;
  snapshots: SnapshotStore;
  logger: Logger;
  monthlyBudget: number;
  /** The keyless API rejects `days=max`; MAX then shows one year. */
  hasApiKey: boolean;
}) {
  const { cache, coingecko, snapshots, logger } = deps;
  const inflight = new Map<string, Promise<ApiResponse<unknown>>>();

  /** Above 80% of the monthly CoinGecko budget every TTL is tripled. */
  async function ttlFor(base: number) {
    const used = (await cache.get<number>(usageKey())) ?? 0;
    return used > deps.monthlyBudget * 0.8 ? base * 3 : base;
  }

  async function cached<T>(
    key: string,
    ttl: number,
    load: () => Promise<T>,
    opts: { snapshot?: boolean } = {},
  ): Promise<ApiResponse<T>> {
    const hit = await cache.get<Entry<T>>(key);
    if (hit) return respond(hit);

    // Concurrent misses on one instance share a single upstream call.
    const pending = inflight.get(key) as Promise<ApiResponse<T>> | undefined;
    if (pending) return pending;
    const run = refresh();
    inflight.set(key, run);
    return run;

    async function refresh(): Promise<ApiResponse<T>> {
      try {
        const data = await load();
        const entry: Entry<T> = { data, fetchedAt: new Date().toISOString(), source: "coingecko" };
        await cache.set(key, entry, await ttlFor(ttl));
        if (opts.snapshot) {
          await snapshots
            .put(key, data, new Date(entry.fetchedAt))
            .catch((err) => logger.warn({ err, key }, "snapshot write failed"));
        }
        return respond(entry);
      } catch (err) {
        if (err instanceof NotFoundError) throw err;
        const snap = opts.snapshot ? await snapshots.get(key).catch(() => null) : null;
        if (!snap) throw err instanceof AppError ? err : new UpstreamError(0);
        logger.warn({ key, err }, "serving market snapshot");
        const entry: Entry<T> = {
          data: snap.payload as T,
          fetchedAt: snap.fetchedAt.toISOString(),
          source: "snapshot",
        };
        await cache.set(key, entry, TTL.fallback);
        return respond(entry);
      } finally {
        inflight.delete(key);
      }
    }
  }

  const markets = () =>
    cached(
      "cg:markets:usd",
      TTL.markets,
      async () => {
        const raw = await coingecko.get<RawMarket[]>("/coins/markets", {
          vs_currency: "usd",
          order: "market_cap_desc",
          per_page: 250,
          page: 1,
          sparkline: true,
          price_change_percentage: "1h,24h,7d",
        });
        return raw.map((c, i) => mapMarket(c, i + 1));
      },
      { snapshot: true },
    );

  async function coinsByIds(ids: string[]): Promise<ApiResponse<Coin[]>> {
    const top = await markets();
    const byId = new Map(top.data.map((c) => [c.id, c]));
    const missing = [...new Set(ids.filter((id) => !byId.has(id)))].sort();
    let meta = top.meta;
    if (missing.length) {
      const extra = await cached(`cg:markets:ids:${missing.join(",")}`, TTL.markets, async () => {
        const raw = await coingecko.get<RawMarket[]>("/coins/markets", {
          vs_currency: "usd",
          ids: missing.join(","),
          sparkline: true,
          price_change_percentage: "1h,24h,7d",
        });
        return raw.map((c) => mapMarket(c));
      }).catch(() => null);
      extra?.data.forEach((c) => byId.set(c.id, c));
      if (extra) meta = mergeMeta(meta, extra.meta);
    }
    return { data: ids.map((id) => byId.get(id)).filter((c): c is Coin => !!c), meta };
  }

  const trending = async (): Promise<ApiResponse<CoinSummary[]>> => {
    const top = await markets().catch(() => null);
    return cached(
      "cg:trending",
      TTL.trending,
      async () =>
        mapTrending(await coingecko.get<RawTrending>("/search/trending"), top?.data ?? []),
      { snapshot: true },
    );
  };

  return {
    markets,
    coinsByIds,

    async coins(page: number, perPage: number): Promise<ApiResponse<CoinsPage>> {
      const { data, meta } = await markets();
      const start = (page - 1) * perPage;
      return {
        data: { coins: data.slice(start, start + perPage), page, perPage, total: data.length },
        meta,
      };
    },

    global: (): Promise<ApiResponse<GlobalStats>> =>
      cached(
        "cg:global",
        TTL.global,
        async () => mapGlobal(await coingecko.get<RawGlobal>("/global")),
        {
          snapshot: true,
        },
      ),

    rates: (): Promise<ApiResponse<Rates>> =>
      cached(
        "cg:rates",
        TTL.rates,
        async () => mapRates(await coingecko.get<RawRates>("/exchange_rates")),
        { snapshot: true },
      ),

    trending,

    /** Top 100 exchanges by Trust Score; BTC volume valued at the cached Bitcoin price. */
    async exchanges(): Promise<ApiResponse<Exchange[]>> {
      const [raw, top] = await Promise.all([
        cached(
          "cg:exchanges",
          TTL.exchanges,
          async () => coingecko.get<RawExchange[]>("/exchanges", { per_page: 100, page: 1 }),
          { snapshot: true },
        ),
        markets(),
      ]);
      const btc = top.data.find((c) => c.id === "bitcoin")?.price ?? 0;
      return { data: raw.data.map((e) => mapExchange(e, btc)), meta: raw.meta };
    },

    async highlights(): Promise<ApiResponse<Highlights>> {
      const [top, trend] = await Promise.all([markets(), trending().catch(() => null)]);
      const liquid = top.data.filter((c) => c.volume24h > 1_000_000 && c.change24h != null);
      const by24h = [...liquid].sort((a, b) => (b.change24h ?? 0) - (a.change24h ?? 0));
      return {
        data: {
          trending: (trend?.data ?? []).slice(0, 10),
          gainers: by24h.slice(0, 10).map(toSummary),
          losers: by24h.slice(-10).reverse().map(toSummary),
          highestVolume: [...top.data]
            .sort((a, b) => b.volume24h - a.volume24h)
            .slice(0, 10)
            .map((c) => ({ ...toSummary(c), volume24h: c.volume24h })),
        },
        meta: trend ? mergeMeta(top.meta, trend.meta) : top.meta,
      };
    },

    /** Top-250 matches first (no upstream call); CoinGecko search fills the rest. */
    async search(q: string, limit = 8): Promise<ApiResponse<CoinSummary[]>> {
      const query = q.trim().toLowerCase();
      const top = await markets();
      if (!query) return { data: [], meta: top.meta };
      const local = top.data
        .map((c) => {
          const name = c.name.toLowerCase();
          const sym = c.symbol.toLowerCase();
          let score = 0;
          if (sym === query || name === query) score = 4;
          else if (sym.startsWith(query) || name.startsWith(query)) score = 3;
          else if (name.includes(query) || c.id.includes(query)) score = 2;
          return { c, score };
        })
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score || (a.c.rank ?? 999) - (b.c.rank ?? 999))
        .slice(0, limit)
        .map((x) => toSummary(x.c));
      if (local.length >= limit || query.length < 2) return { data: local, meta: top.meta };

      try {
        const found = await cached(`cg:search:${query}`, TTL.search, async () => {
          const r = await coingecko.get<RawSearch>("/search", { query });
          return r.coins.slice(0, 20).map((c) => c.id);
        });
        const seen = new Set(local.map((c) => c.id));
        const extraIds = found.data.filter((id) => !seen.has(id)).slice(0, limit - local.length);
        if (!extraIds.length) return { data: local, meta: top.meta };
        const extra = await coinsByIds(extraIds);
        return { data: [...local, ...extra.data.map(toSummary)], meta: top.meta };
      } catch {
        return { data: local, meta: top.meta };
      }
    },

    async coin(id: string): Promise<ApiResponse<CoinDetail>> {
      try {
        return await cached(
          `cg:coin:${id}`,
          TTL.coin,
          async () =>
            mapDetail(
              await coingecko.get<RawDetail>(`/coins/${encodeURIComponent(id)}`, {
                localization: false,
                tickers: false,
                market_data: true,
                community_data: false,
                developer_data: false,
                sparkline: true,
              }),
            ),
          { snapshot: true },
        );
      } catch (err) {
        // Rate-limited with no snapshot yet: a top-250 coin can still show its market data.
        if (err instanceof NotFoundError) throw err;
        const top = await markets().catch(() => null);
        const row = top?.data.find((c) => c.id === id);
        if (!top || !row) throw err;
        return { data: partialDetail(row), meta: { ...top.meta, stale: true } };
      }
    },

    chart: (id: string, range: ChartRange): Promise<ApiResponse<ChartData>> =>
      cached(`cg:chart:${id}:${range}`, TTL.chart[range], async () => {
        const days = range === "max" && !deps.hasApiKey ? "365" : chartDays[range];
        const r = await coingecko.get<{ prices: [number, number][] }>(
          `/coins/${encodeURIComponent(id)}/market_chart`,
          { vs_currency: "usd", days },
        );
        const line = sliceRange(toLine(r.prices, "ms"), range);
        return { range, line, ohlc: toOhlc(line), simulated: false };
      }),
  };
}
