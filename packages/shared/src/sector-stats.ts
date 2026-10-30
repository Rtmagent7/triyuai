import type { Coin } from "./schemas";
import { SECTORS, sectorsOf, type Sector, type SectorId } from "./sectors";

export type SectorStats = {
  sector: Sector;
  coins: Coin[];
  marketCap: number;
  volume24h: number;
  /** Market-cap-weighted change, so a sector moves the way its money moves. */
  change24h: number | null;
  change7d: number | null;
};

const weighted = (coins: Coin[], pick: (c: Coin) => number | null) => {
  let cap = 0;
  let sum = 0;
  for (const c of coins) {
    const v = pick(c);
    if (v == null || !c.marketCap) continue;
    cap += c.marketCap;
    sum += c.marketCap * v;
  }
  return cap ? sum / cap : null;
};

export const coinsInSector = (coins: Coin[], id: SectorId) =>
  coins.filter((c) => sectorsOf(c.id).includes(id));

export function statsFor(sector: Sector, coins: Coin[]): SectorStats {
  const members = coinsInSector(coins, sector.id).sort((a, b) => b.marketCap - a.marketCap);
  return {
    sector,
    coins: members,
    marketCap: members.reduce((s, c) => s + c.marketCap, 0),
    volume24h: members.reduce((s, c) => s + c.volume24h, 0),
    change24h: weighted(members, (c) => c.change24h),
    change7d: weighted(members, (c) => c.change7d),
  };
}

/** Every sector with at least one coin in `coins`, largest market cap first. */
export const sectorStats = (coins: Coin[]): SectorStats[] =>
  SECTORS.map((s) => statsFor(s, coins))
    .filter((s) => s.coins.length > 0)
    .sort((a, b) => b.marketCap - a.marketCap);

/** Pegged or wrapped assets track something else, so they never "beat Bitcoin". */
const TRACKERS: SectorId[] = [
  "stablecoin",
  "gold",
  "wrapped",
  "liquid-staking",
  "liquid-restaking",
];
export const isTracker = (id: string) => sectorsOf(id).some((s) => TRACKERS.includes(s));

/**
 * How many of the 50 largest non-pegged altcoins beat Bitcoin over 7 days. The well-known
 * "altcoin season" index uses 90 days; this snapshot only carries 7-day changes.
 */
export function altcoinsVsBitcoin(coins: Coin[], n = 50) {
  const btc = coins.find((c) => c.id === "bitcoin");
  if (btc?.change7d == null) return null;
  const alts = coins
    .filter((c) => c.id !== "bitcoin" && !isTracker(c.id) && c.change7d != null)
    .sort((a, b) => b.marketCap - a.marketCap)
    .slice(0, n);
  if (!alts.length) return null;
  const beat = alts.filter((c) => c.change7d! > btc.change7d!).length;
  return { alts, beat, total: alts.length, btcChange7d: btc.change7d, share: beat / alts.length };
}

export type DominanceSlice = { id: string; label: string; share: number };

/** Market-cap shares: BTC, ETH, USDT, the other stablecoins, and everything else. */
export function dominance(
  g: { totalMarketCap: number; btcDominance: number; ethDominance: number; usdtDominance: number },
  coins: Coin[],
): DominanceSlice[] {
  const otherStables = g.totalMarketCap
    ? (coinsInSector(coins, "stablecoin")
        .filter((c) => c.id !== "tether")
        .reduce((s, c) => s + c.marketCap, 0) /
        g.totalMarketCap) *
      100
    : 0;
  const named = g.btcDominance + g.ethDominance + g.usdtDominance + otherStables;
  return [
    { id: "btc", label: "Bitcoin", share: g.btcDominance },
    { id: "eth", label: "Ethereum", share: g.ethDominance },
    { id: "usdt", label: "Tether (USDT)", share: g.usdtDominance },
    { id: "stables", label: "Other stablecoins", share: otherStables },
    { id: "rest", label: "Everything else", share: Math.max(0, 100 - named) },
  ];
}
