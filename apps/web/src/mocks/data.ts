/**
 * Mock data layer for Phase 1. Builds API-contract responses from the CoinGecko
 * snapshot in ./fixtures. Used by the MSW handlers (browser) and by the
 * server-side adapter in lib/api/server.ts, so both always agree.
 */
import type {
  ApiResponse,
  ChartData,
  ChartRange,
  Coin,
  CoinDetail,
  CoinLinks,
  CoinSummary,
  CoinsPage,
  GlobalStats,
  Highlights,
  LinePoint,
  Rates,
} from "@triyuai/shared";
import { sliceRange, toLine, toOhlc } from "@triyuai/shared/chart";
import { toSummary } from "@triyuai/shared/coingecko";
import { NotFoundError } from "@/lib/api/errors";
import { hashString, seededRandom } from "@/lib/utils";
import marketsJson from "./fixtures/markets.json";
import globalJson from "./fixtures/global.json";
import trendingJson from "./fixtures/trending.json";
import ratesJson from "./fixtures/rates.json";
import metaJson from "./fixtures/meta.json";
import { chartLoaders, detailLoaders } from "./fixtures/loaders";

export const markets = marketsJson as Coin[];
const globalStats = globalJson as GlobalStats;
const trending = trendingJson as CoinSummary[];
const rates = ratesJson as Rates;
export const snapshotAt: string = metaJson.fetchedAt;

const byId = new Map(markets.map((c) => [c.id, c]));

export { NotFoundError };

const meta = (): ApiResponse<unknown>["meta"] => ({
  fetchedAt: snapshotAt,
  source: "mock",
  stale: false,
});
const ok = <T>(data: T): ApiResponse<T> => ({ data, meta: meta() });

export { toOhlc, toSummary };

export const findCoin = (id: string) => byId.get(id);

export function getGlobal() {
  return ok(globalStats);
}

export function getRates() {
  return ok(rates);
}

export function getCoins(page = 1, perPage = 100): ApiResponse<CoinsPage> {
  const start = (page - 1) * perPage;
  return ok({ coins: markets.slice(start, start + perPage), page, perPage, total: markets.length });
}

export function getCoinsByIds(ids: string[]) {
  return ok(ids.map((id) => byId.get(id)).filter((c): c is Coin => !!c));
}

export function getHighlights(): ApiResponse<Highlights> {
  const liquid = markets.filter((c) => c.volume24h > 1_000_000 && c.change24h != null);
  const by24h = [...liquid].sort((a, b) => (b.change24h ?? 0) - (a.change24h ?? 0));
  return ok({
    // Only coins with a page in the top-250 snapshot, so every link resolves.
    trending: trending.filter((c) => byId.has(c.id)).slice(0, 10),
    gainers: by24h.slice(0, 10).map(toSummary),
    losers: by24h.slice(-10).reverse().map(toSummary),
    highestVolume: [...markets]
      .sort((a, b) => b.volume24h - a.volume24h)
      .slice(0, 10)
      .map((c) => ({ ...toSummary(c), volume24h: c.volume24h })),
  });
}

export function searchCoins(q: string, limit = 8): ApiResponse<CoinSummary[]> {
  const query = q.trim().toLowerCase();
  if (!query) return ok([]);
  const scored = markets
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
    .sort((a, b) => b.score - a.score || (a.c.rank ?? 999) - (b.c.rank ?? 999));
  return ok(scored.slice(0, limit).map((x) => toSummary(x.c)));
}

type DetailFixture = {
  description: string;
  categories: string[];
  genesisDate: string | null;
  links: CoinLinks;
};

export async function getCoinDetail(id: string): Promise<ApiResponse<CoinDetail>> {
  const coin = byId.get(id);
  if (!coin) throw new NotFoundError(id);
  const loader = detailLoaders[id];
  if (loader) {
    const d = (await loader()).default as DetailFixture;
    return ok({ ...coin, ...d, hasFullDetail: true });
  }
  return ok({
    ...coin,
    description: `${coin.name} (${coin.symbol}) is ranked #${coin.rank} by market capitalization. Full project details are not part of the prototype snapshot yet; they will come from the live API in Phase 3.`,
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
}

/* ---------------- Charts ---------------- */

const DAY = 86_400;
/** The keyless CoinGecko API caps history at 365 days, so MAX shows the full snapshot (1 year). */
type ChartFixture = Record<"1" | "90" | "365", [number, number][]>;

/** For coins without chart fixtures: a deterministic walk anchored on the real 7d sparkline. */
function simulatedSeries(coin: Coin): LinePoint[] {
  const rand = seededRandom(hashString(coin.id));
  const end = Math.floor(new Date(snapshotAt).getTime() / 1000);
  const spark = coin.sparkline7d.length ? coin.sparkline7d : [coin.price];
  const step = (7 * DAY) / Math.max(1, spark.length - 1);
  const sparkStart = end - 7 * DAY;
  const sparkLine = spark.map((value, i) => ({ time: Math.round(sparkStart + i * step), value }));

  // Daily volatility estimated from the sparkline, clamped to a sensible band.
  const rets = spark
    .slice(1)
    .map((v, i) => Math.log(v / spark[i]!))
    .filter(Number.isFinite);
  const sd =
    Math.sqrt(rets.reduce((s, r) => s + r * r, 0) / Math.max(1, rets.length)) * Math.sqrt(12);
  const vol = Math.min(0.08, Math.max(0.01, sd || 0.03));

  const days = 1460;
  const daily: LinePoint[] = [];
  let v = spark[0]!;
  for (let d = 1; d <= days; d++) {
    // Walk backwards in time from the first sparkline value.
    v = v / Math.exp((rand() - 0.5) * 2 * vol + vol * 0.02);
    daily.push({ time: sparkStart - d * DAY, value: Number(v.toPrecision(6)) });
  }
  daily.reverse();

  // Densify the last 24h (2h spacing → 15 min) so the 24H view is not blocky.
  const lastDay = sparkLine.filter((p) => p.time >= end - DAY);
  const dense: LinePoint[] = [];
  for (let i = 0; i < lastDay.length - 1; i++) {
    const a = lastDay[i]!;
    const b = lastDay[i + 1]!;
    for (let k = 0; k < 8; k++) {
      const t = k / 8;
      const noise = (rand() - 0.5) * vol * 0.15 * a.value;
      dense.push({
        time: Math.round(a.time + (b.time - a.time) * t),
        value: a.value + (b.value - a.value) * t + (k ? noise : 0),
      });
    }
  }
  const before = sparkLine.filter((p) => p.time < end - DAY);
  return [...daily, ...before, ...dense, { time: end, value: coin.price }];
}

export async function getChart(id: string, range: ChartRange): Promise<ApiResponse<ChartData>> {
  const coin = byId.get(id);
  if (!coin) throw new NotFoundError(id);
  const loader = chartLoaders[id];
  let line: LinePoint[];
  let simulated = false;
  if (loader) {
    const c = (await loader()).default as ChartFixture;
    const src =
      range === "24h"
        ? c["1"]
        : range === "7d" || range === "1m" || range === "3m"
          ? c["90"]
          : c["365"];
    line = sliceRange(toLine(src), range);
  } else {
    simulated = true;
    line = sliceRange(simulatedSeries(coin), range);
  }
  return ok({ range, line, ohlc: toOhlc(line), simulated });
}
