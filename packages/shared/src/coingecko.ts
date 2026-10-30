/**
 * Raw CoinGecko response shapes and their mapping to the TRIYUAI API contract.
 * Used by the fixture script (Phase 1) and the Express API (Phase 3) so both
 * produce identical data.
 */
import type {
  Coin,
  CoinDetail,
  CoinLinks,
  CoinSummary,
  GlobalStats,
  Rates,
} from "./schemas";

/** Optional rounding (the fixture script trims digits to keep JSON small). */
export type Round = (n: number | null | undefined, digits?: number) => number | null;
const exact: Round = (n) => (n == null || !Number.isFinite(n) ? null : n);

export type RawMarket = {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number | null;
  market_cap: number | null;
  market_cap_rank: number | null;
  fully_diluted_valuation: number | null;
  total_volume: number | null;
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
  sparkline_in_7d?: { price: number[] } | null;
  price_change_percentage_1h_in_currency?: number | null;
  price_change_percentage_24h_in_currency?: number | null;
  price_change_percentage_7d_in_currency?: number | null;
};

/** `/coins/markets?sparkline=true&price_change_percentage=1h,24h,7d` row → Coin. */
export function mapMarket(c: RawMarket, fallbackRank: number | null = null, round = exact): Coin {
  return {
    id: c.id,
    symbol: c.symbol.toUpperCase(),
    name: c.name,
    image: c.image,
    rank: c.market_cap_rank ?? fallbackRank,
    price: round(c.current_price) ?? 0,
    change1h: round(c.price_change_percentage_1h_in_currency, 4),
    change24h: round(c.price_change_percentage_24h_in_currency, 4),
    change7d: round(c.price_change_percentage_7d_in_currency, 4),
    marketCap: c.market_cap ?? 0,
    volume24h: c.total_volume ?? 0,
    high24h: round(c.high_24h),
    low24h: round(c.low_24h),
    circulatingSupply: c.circulating_supply,
    totalSupply: c.total_supply,
    maxSupply: c.max_supply,
    fdv: c.fully_diluted_valuation,
    ath: round(c.ath),
    athDate: c.ath_date,
    athChangePct: round(c.ath_change_percentage, 4),
    atl: round(c.atl),
    atlDate: c.atl_date,
    atlChangePct: round(c.atl_change_percentage, 4),
    // Hourly 7d series → every 2nd point (84 points) is smooth enough for sparklines.
    sparkline7d: (c.sparkline_in_7d?.price ?? [])
      .filter((_, idx) => idx % 2 === 0)
      .map((p) => round(p, 5) ?? 0),
  };
}

export const toSummary = (c: Coin): CoinSummary => ({
  id: c.id,
  symbol: c.symbol,
  name: c.name,
  image: c.image,
  rank: c.rank,
  price: c.price,
  change24h: c.change24h,
});

export type RawGlobal = {
  data: {
    active_cryptocurrencies: number;
    total_market_cap: Record<string, number>;
    total_volume: Record<string, number>;
    market_cap_percentage: Record<string, number>;
    market_cap_change_percentage_24h_usd: number;
    updated_at: number;
  };
};

export function mapGlobal(g: RawGlobal, round = exact): GlobalStats {
  return {
    totalMarketCap: g.data.total_market_cap.usd ?? 0,
    marketCapChange24h: round(g.data.market_cap_change_percentage_24h_usd, 4) ?? 0,
    totalVolume24h: g.data.total_volume.usd ?? 0,
    btcDominance: round(g.data.market_cap_percentage.btc, 4) ?? 0,
    ethDominance: round(g.data.market_cap_percentage.eth, 4) ?? 0,
    usdtDominance: round(g.data.market_cap_percentage.usdt, 4) ?? 0,
    activeCoins: g.data.active_cryptocurrencies,
    updatedAt: new Date(g.data.updated_at * 1000).toISOString(),
  };
}

export type RawTrending = {
  coins: {
    item: {
      id: string;
      name: string;
      symbol: string;
      small: string;
      large?: string;
      market_cap_rank: number | null;
      data?: { price?: number; price_change_percentage_24h?: { usd?: number } };
    };
  }[];
};

/** Prefers market rows (consistent image + price) when the trending coin is in the top list. */
export function mapTrending(t: RawTrending, markets: Coin[], round = exact): CoinSummary[] {
  const byId = new Map(markets.map((m) => [m.id, m]));
  return t.coins.map(({ item }) => {
    const m = byId.get(item.id);
    return {
      id: item.id,
      symbol: item.symbol.toUpperCase(),
      name: item.name,
      image: m?.image ?? item.large ?? item.small,
      rank: item.market_cap_rank,
      price: m?.price ?? round(item.data?.price) ?? 0,
      change24h: m?.change24h ?? round(item.data?.price_change_percentage_24h?.usd, 4),
    };
  });
}

export type RawRates = { rates: Record<string, { value: number }> };

/** CoinGecko rates are BTC-based; the contract is USD-based. */
export function mapRates(r: RawRates, round = exact): Rates {
  const usd = r.rates.usd!.value;
  return {
    usd: 1,
    idr: round(r.rates.idr!.value / usd) ?? 0,
    eur: round(r.rates.eur!.value / usd) ?? 0,
  };
}

export type RawDetail = {
  id: string;
  symbol: string;
  name: string;
  image?: { large?: string; small?: string; thumb?: string };
  market_cap_rank?: number | null;
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
  market_data?: {
    current_price: Record<string, number>;
    market_cap: Record<string, number>;
    market_cap_rank: number | null;
    fully_diluted_valuation: Record<string, number>;
    total_volume: Record<string, number>;
    high_24h: Record<string, number>;
    low_24h: Record<string, number>;
    price_change_percentage_1h_in_currency?: Record<string, number>;
    price_change_percentage_24h_in_currency?: Record<string, number>;
    price_change_percentage_7d_in_currency?: Record<string, number>;
    circulating_supply: number | null;
    total_supply: number | null;
    max_supply: number | null;
    ath: Record<string, number>;
    ath_change_percentage: Record<string, number>;
    ath_date: Record<string, string>;
    atl: Record<string, number>;
    atl_change_percentage: Record<string, number>;
    atl_date: Record<string, string>;
    sparkline_7d?: { price: number[] };
  };
};

export type DetailExtras = Pick<CoinDetail, "description" | "categories" | "genesisDate" | "links">;

export function mapDetailExtras(d: RawDetail): DetailExtras {
  const links: CoinLinks = {
    homepage: d.links.homepage.find(Boolean) ?? null,
    whitepaper: d.links.whitepaper || null,
    explorers: d.links.blockchain_site.filter(Boolean).slice(0, 3),
    twitter: d.links.twitter_screen_name ? `https://x.com/${d.links.twitter_screen_name}` : null,
    reddit:
      d.links.subreddit_url && d.links.subreddit_url !== "https://www.reddit.com"
        ? d.links.subreddit_url
        : null,
    github: d.links.repos_url?.github?.find(Boolean) ?? null,
  };
  return {
    description: d.description.en.trim(),
    categories: d.categories.filter((c): c is string => !!c).slice(0, 8),
    genesisDate: d.genesis_date,
    links,
  };
}

/** `/coins/{id}?market_data=true&sparkline=true` → full CoinDetail. */
export function mapDetail(d: RawDetail): CoinDetail {
  const m = d.market_data;
  const usd = (r: Record<string, number> | undefined) => exact(r?.usd);
  const market: RawMarket = {
    id: d.id,
    symbol: d.symbol,
    name: d.name,
    image: d.image?.large ?? d.image?.small ?? "",
    current_price: usd(m?.current_price),
    market_cap: usd(m?.market_cap),
    market_cap_rank: m?.market_cap_rank ?? d.market_cap_rank ?? null,
    fully_diluted_valuation: usd(m?.fully_diluted_valuation),
    total_volume: usd(m?.total_volume),
    high_24h: usd(m?.high_24h),
    low_24h: usd(m?.low_24h),
    circulating_supply: m?.circulating_supply ?? null,
    total_supply: m?.total_supply ?? null,
    max_supply: m?.max_supply ?? null,
    ath: usd(m?.ath),
    ath_change_percentage: usd(m?.ath_change_percentage),
    ath_date: m?.ath_date?.usd ?? null,
    atl: usd(m?.atl),
    atl_change_percentage: usd(m?.atl_change_percentage),
    atl_date: m?.atl_date?.usd ?? null,
    sparkline_in_7d: m?.sparkline_7d ?? null,
    price_change_percentage_1h_in_currency: usd(m?.price_change_percentage_1h_in_currency),
    price_change_percentage_24h_in_currency: usd(m?.price_change_percentage_24h_in_currency),
    price_change_percentage_7d_in_currency: usd(m?.price_change_percentage_7d_in_currency),
  };
  return { ...mapMarket(market), ...mapDetailExtras(d), hasFullDetail: true };
}

export type RawSearch = {
  coins: { id: string; name: string; symbol: string; market_cap_rank: number | null }[];
};
