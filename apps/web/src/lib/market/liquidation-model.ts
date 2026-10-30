import type { Bar } from "@/lib/ta/indicators";

/**
 * Estimated liquidation levels, the idea behind the common "liquidation heatmap": positions
 * opened in a bar are assumed to sit at that bar's typical price, spread across a few
 * leverage tiers, and each tier's liquidation price is where a level appears. A level stays
 * until price trades through it (those positions are liquidated) or open interest falls
 * (some were closed). It models where leverage probably sits; it is not an order book.
 */

/** Share of new positions at each leverage (a rough exchange-wide mix). */
export const LEVERAGE_MIX = [
  { leverage: 5, share: 0.1 },
  { leverage: 10, share: 0.3 },
  { leverage: 25, share: 0.3 },
  { leverage: 50, share: 0.2 },
  { leverage: 100, share: 0.1 },
] as const;

/** Maintenance margin: liquidation lands this much before the full 1/leverage move. */
const MAINTENANCE = 0.004;

export const liqPrice = (entry: number, leverage: number, side: "long" | "short") =>
  side === "long"
    ? entry * (1 - 1 / leverage + MAINTENANCE)
    : entry * (1 + 1 / leverage - MAINTENANCE);

export type Heatmap = {
  /** Lower edge of each price bin, ascending. */
  prices: number[];
  binSize: number;
  /** Per bar: estimated USD waiting to be liquidated in each bin (longs + shorts). */
  columns: Float64Array[];
  /** The latest bar's levels, split by side. */
  longs: Float64Array;
  shorts: Float64Array;
  max: number;
};

/**
 * @param bars candles, oldest first
 * @param openInterest USD open interest at each bar (null where unknown); without it,
 *   a tenth of each bar's traded value stands in for newly opened positions.
 */
export function buildHeatmap(
  bars: Bar[],
  openInterest: (number | null)[],
  bins = 160,
): Heatmap | null {
  if (bars.length < 2) return null;
  const lo = Math.min(...bars.map((b) => b.low));
  const hi = Math.max(...bars.map((b) => b.high));
  // Room for the 10x levels either side of the traded range.
  const min = lo * 0.88;
  const max = hi * 1.12;
  const binSize = (max - min) / bins;
  const prices = Array.from({ length: bins }, (_, i) => min + i * binSize);
  const binOf = (p: number) => Math.floor((p - min) / binSize);

  const longs = new Float64Array(bins);
  const shorts = new Float64Array(bins);
  const columns: Float64Array[] = [];
  let peak = 0;

  bars.forEach((bar, i) => {
    // 1. Price traded through levels: longs liquidate at or above the low, shorts at or below the high.
    const lowBin = binOf(bar.low);
    for (let b = Math.max(0, lowBin); b < bins; b++) longs[b] = 0;
    const highBin = binOf(bar.high);
    for (let b = 0; b <= Math.min(bins - 1, highBin); b++) shorts[b] = 0;

    // 2. Positions opened this bar (half long, half short): rising open interest, or traded value.
    const oi = openInterest[i];
    const prevOi = i > 0 ? openInterest[i - 1] : null;
    let fresh: number;
    if (oi != null && prevOi != null) {
      fresh = Math.max(0, oi - prevOi);
      // Falling open interest: positions were closed, so thin every level in proportion.
      if (oi < prevOi && prevOi > 0) {
        const keep = oi / prevOi;
        for (let b = 0; b < bins; b++) {
          longs[b] = longs[b]! * keep;
          shorts[b] = shorts[b]! * keep;
        }
      }
    } else {
      fresh = bar.volume * ((bar.high + bar.low + bar.close) / 3) * 0.1;
    }
    const entry = (bar.high + bar.low + bar.close) / 3;
    for (const { leverage, share } of LEVERAGE_MIX) {
      const l = binOf(liqPrice(entry, leverage, "long"));
      const s = binOf(liqPrice(entry, leverage, "short"));
      if (l >= 0 && l < lowBin) longs[l] = longs[l]! + (fresh * share) / 2;
      if (s < bins && s > highBin) shorts[s] = shorts[s]! + (fresh * share) / 2;
    }

    const col = new Float64Array(bins);
    for (let b = 0; b < bins; b++) {
      col[b] = longs[b]! + shorts[b]!;
      if (col[b]! > peak) peak = col[b]!;
    }
    columns.push(col);
  });

  return { prices, binSize, columns, longs, shorts, max: peak };
}

/** The biggest estimated clusters on one side of the price, largest first. */
export function topClusters(levels: Float64Array, prices: number[], binSize: number, n = 5) {
  return Array.from(levels, (usd, i) => ({ price: prices[i]! + binSize / 2, usd }))
    .filter((c) => c.usd > 0)
    .sort((a, b) => b.usd - a.usd)
    .slice(0, n);
}

/** Open interest at each bar time: the latest reading at or before it. */
export function alignOpenInterest(barTimes: number[], oi: { time: number; value: number }[]) {
  const sorted = [...oi].sort((a, b) => a.time - b.time);
  let j = -1;
  return barTimes.map((t) => {
    while (j + 1 < sorted.length && sorted[j + 1]!.time <= t) j++;
    return j >= 0 ? sorted[j]!.value : null;
  });
}
