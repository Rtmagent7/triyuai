/**
 * Fetches a one-time snapshot from the public CoinGecko API and writes it as
 * JSON fixtures for the Phase 1 mock API (MSW + server-side adapter).
 *
 *   pnpm fixtures            # top 250 markets + details/charts for the top 20
 *   DETAIL_COUNT=10 pnpm fixtures
 *
 * Uses only keyless public endpoints and backs off on HTTP 429.
 */
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const API = "https://api.coingecko.com/api/v3";
const OUT = path.resolve(import.meta.dirname, "../apps/web/src/mocks/fixtures");
const DETAIL_COUNT = Number(process.env.DETAIL_COUNT ?? 20);
const DELAY_MS = Number(process.env.DELAY_MS ?? 2500);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function get<T>(url: string, attempt = 1): Promise<T> {
  await sleep(DELAY_MS);
  let res: Response;
  try {
    res = await fetch(`${API}${url}`, { headers: { accept: "application/json" } });
  } catch (err) {
    if (attempt > 4) throw err;
    console.warn(`  network error on ${url}, retrying…`);
    await sleep(5_000 * attempt);
    return get<T>(url, attempt + 1);
  }
  if (res.status === 429 && attempt <= 6) {
    const wait = 30_000 * attempt;
    console.warn(`  429 on ${url}, waiting ${wait / 1000}s…`);
    await sleep(wait);
    return get<T>(url, attempt + 1);
  }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} on ${url}`);
  return (await res.json()) as T;
}

/** Keep fixtures small: 6 significant digits is plenty for a demo. */
const sig = (n: number | null | undefined, digits = 6): number | null =>
  n == null || !Number.isFinite(n) ? null : Number(n.toPrecision(digits));

const json = (file: string, data: unknown) =>
  writeFile(path.join(OUT, file), JSON.stringify(data), "utf8");

type RawMarket = {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number | null;
  fully_diluted_valuation: number | null;
  total_volume: number;
  high_24h: number | null;
  low_24h: number | null;
  circulating_supply: number | null;
  total_supply: number | null;
  max_supply: number | null;
  ath: number | null;
  ath_change_percentage: number | null;
  ath_date: string | null;
  atl: number | null;
  atl_change_percentage: number | null;
  atl_date: string | null;
  sparkline_in_7d?: { price: number[] };
  price_change_percentage_1h_in_currency?: number | null;
  price_change_percentage_24h_in_currency?: number | null;
  price_change_percentage_7d_in_currency?: number | null;
};

async function main() {
  await mkdir(path.join(OUT, "details"), { recursive: true });
  await mkdir(path.join(OUT, "charts"), { recursive: true });

  console.log("Fetching markets (top 250)…");
  const raw: RawMarket[] = [];
  for (const page of [1, 2]) {
    raw.push(
      ...(await get<RawMarket[]>(
        `/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=125&page=${page}` +
          `&sparkline=true&price_change_percentage=1h,24h,7d`,
      )),
    );
  }
  const markets = raw.map((c, i) => ({
    id: c.id,
    symbol: c.symbol.toUpperCase(),
    name: c.name,
    image: c.image,
    rank: c.market_cap_rank ?? i + 1,
    price: sig(c.current_price) ?? 0,
    change1h: sig(c.price_change_percentage_1h_in_currency, 4),
    change24h: sig(c.price_change_percentage_24h_in_currency, 4),
    change7d: sig(c.price_change_percentage_7d_in_currency, 4),
    marketCap: c.market_cap,
    volume24h: c.total_volume,
    high24h: sig(c.high_24h),
    low24h: sig(c.low_24h),
    circulatingSupply: c.circulating_supply,
    totalSupply: c.total_supply,
    maxSupply: c.max_supply,
    fdv: c.fully_diluted_valuation,
    ath: sig(c.ath),
    athDate: c.ath_date,
    athChangePct: sig(c.ath_change_percentage, 4),
    atl: sig(c.atl),
    atlDate: c.atl_date,
    atlChangePct: sig(c.atl_change_percentage, 4),
    // Hourly 7d series → every 2nd point (84 points) is smooth enough for sparklines.
    sparkline7d: (c.sparkline_in_7d?.price ?? [])
      .filter((_, idx) => idx % 2 === 0)
      .map((p) => sig(p, 5) ?? 0),
  }));
  await json("markets.json", markets);

  console.log("Fetching global stats…");
  const g = await get<{
    data: {
      active_cryptocurrencies: number;
      total_market_cap: Record<string, number>;
      total_volume: Record<string, number>;
      market_cap_percentage: Record<string, number>;
      market_cap_change_percentage_24h_usd: number;
      updated_at: number;
    };
  }>("/global");
  await json("global.json", {
    totalMarketCap: g.data.total_market_cap.usd,
    marketCapChange24h: sig(g.data.market_cap_change_percentage_24h_usd, 4),
    totalVolume24h: g.data.total_volume.usd,
    btcDominance: sig(g.data.market_cap_percentage.btc, 4),
    ethDominance: sig(g.data.market_cap_percentage.eth, 4),
    activeCoins: g.data.active_cryptocurrencies,
    updatedAt: new Date(g.data.updated_at * 1000).toISOString(),
  });

  console.log("Fetching trending…");
  const t = await get<{
    coins: {
      item: {
        id: string;
        name: string;
        symbol: string;
        small: string;
        market_cap_rank: number | null;
        data?: { price?: number; price_change_percentage_24h?: { usd?: number } };
      };
    }[];
  }>("/search/trending");
  await json(
    "trending.json",
    t.coins.map(({ item }) => {
      const m = markets.find((x) => x.id === item.id);
      return {
        id: item.id,
        symbol: item.symbol.toUpperCase(),
        name: item.name,
        image: m?.image ?? item.small,
        rank: item.market_cap_rank,
        price: m?.price ?? sig(item.data?.price) ?? 0,
        change24h: m?.change24h ?? sig(item.data?.price_change_percentage_24h?.usd, 4),
      };
    }),
  );

  console.log("Fetching exchange rates…");
  const r = await get<{ rates: Record<string, { value: number }> }>("/exchange_rates");
  const usd = r.rates.usd!.value;
  await json("rates.json", {
    usd: 1,
    idr: sig(r.rates.idr!.value / usd),
    eur: sig(r.rates.eur!.value / usd),
  });

  const detailed: string[] = [];
  for (const coin of markets.slice(0, DETAIL_COUNT)) {
    // Resume support: coins fetched by an earlier (interrupted) run are kept.
    if (
      !process.env.REFRESH &&
      existsSync(path.join(OUT, `details/${coin.id}.json`)) &&
      existsSync(path.join(OUT, `charts/${coin.id}.json`))
    ) {
      detailed.push(coin.id);
      continue;
    }
    console.log(`Fetching detail + charts for ${coin.id}…`);
    try {
      const d = await get<{
        description: { en: string };
        categories: (string | null)[];
        genesis_date: string | null;
        links: {
          homepage: string[];
          whitepaper?: string;
          blockchain_site: string[];
          twitter_screen_name?: string;
          subreddit_url?: string;
          repos_url?: { github?: string[] };
        };
      }>(
        `/coins/${coin.id}?localization=false&tickers=false&market_data=false` +
          `&community_data=false&developer_data=false&sparkline=false`,
      );
      await json(`details/${coin.id}.json`, {
        description: d.description.en.trim(),
        categories: d.categories.filter((c): c is string => !!c).slice(0, 8),
        genesisDate: d.genesis_date,
        links: {
          homepage: d.links.homepage.find(Boolean) ?? null,
          whitepaper: d.links.whitepaper || null,
          explorers: d.links.blockchain_site.filter(Boolean).slice(0, 3),
          twitter: d.links.twitter_screen_name
            ? `https://x.com/${d.links.twitter_screen_name}`
            : null,
          reddit:
            d.links.subreddit_url && d.links.subreddit_url !== "https://www.reddit.com"
              ? d.links.subreddit_url
              : null,
          github: d.links.repos_url?.github?.find(Boolean) ?? null,
        },
      });

      // 1 day ≈ 5-min points, 90 days ≈ hourly, 365 days ≈ daily (keyless API caps history at 365 days). 7D/1M/3M/1Y are sliced from these.
      const charts: Record<string, [number, number][]> = {};
      for (const days of ["1", "90", "365"]) {
        const c = await get<{ prices: [number, number][] }>(
          `/coins/${coin.id}/market_chart?vs_currency=usd&days=${days}`,
        );
        charts[days] = c.prices.map(([ms, p]) => [Math.round(ms / 1000), sig(p) ?? 0]);
      }
      await json(`charts/${coin.id}.json`, charts);
      detailed.push(coin.id);
    } catch (err) {
      console.warn(`  skipped ${coin.id}: ${(err as Error).message}`);
    }
  }

  await json("meta.json", { fetchedAt: new Date().toISOString(), detailed });
  await writeLoaders(detailed);
  console.log(`Done → ${OUT} (${detailed.length} coins with detail fixtures)`);
}

/**
 * Per-coin fixtures are lazy-loaded with explicit imports (one chunk per coin)
 * so the browser only downloads the coin that is being viewed.
 */
export async function writeLoaders(ids: string[]) {
  const entry = (dir: string) =>
    ids.map((id) => `  ${JSON.stringify(id)}: () => import("./${dir}/${id}.json"),`).join("\n");
  const src = `// Generated by scripts/fetch-fixtures.ts — do not edit.
export const detailLoaders: Record<string, () => Promise<{ default: unknown }>> = {
${entry("details")}
};

export const chartLoaders: Record<string, () => Promise<{ default: unknown }>> = {
${entry("charts")}
};
`;
  await writeFile(path.join(OUT, "loaders.ts"), src, "utf8");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
