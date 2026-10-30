import { describe, expect, it } from "vitest";
import type { Coin } from "@triyuai/shared";
import { primarySector, sectorsOf } from "@triyuai/shared/sectors";
import global from "@/mocks/fixtures/global.json";
import markets from "@/mocks/fixtures/markets.json";
import { fgAgo, fgBand, fgTone } from "./fear-greed";
import { parseForceOrder } from "./futures";
import { alignOpenInterest, buildHeatmap, liqPrice, topClusters } from "./liquidation-model";
import { altcoinsVsBitcoin, dominance, sectorStats } from "./sectors";

const coins = markets as Coin[];

describe("sectors", () => {
  it("files coins under their real sector", () => {
    expect(primarySector("dogecoin")?.label).toBe("Meme");
    expect(primarySector("bitcoin")?.label).toBe("Layer 1");
    expect(primarySector("tether")?.label).toBe("Stablecoins");
    expect(primarySector("ondo-finance")?.label).toBe("RWA");
    expect(primarySector("chainlink")?.label).toBe("Oracles");
    expect(primarySector("uniswap")?.label).toBe("DEX");
    expect(primarySector("bittensor")?.label).toBe("AI");
    expect(sectorsOf("near")).toEqual(expect.arrayContaining(["layer-1", "ai"]));
  });

  it("gives almost every top-250 coin a sector", () => {
    const missing = coins.filter((c) => !sectorsOf(c.id).length);
    expect(missing.length).toBeLessThanOrEqual(3);
  });

  it("weights sector moves by market cap", () => {
    const stats = sectorStats(coins);
    const meme = stats.find((s) => s.sector.id === "meme")!;
    expect(meme.coins[0]!.id).toBe("dogecoin");
    expect(meme.marketCap).toBe(meme.coins.reduce((s, c) => s + c.marketCap, 0));
    const cap = meme.coins.reduce((s, c) => s + (c.change24h == null ? 0 : c.marketCap), 0);
    const w = meme.coins.reduce((s, c) => s + (c.change24h ?? 0) * c.marketCap, 0) / cap;
    expect(meme.change24h).toBeCloseTo(w, 6);
  });

  it("splits dominance into slices that add up to 100%", () => {
    const slices = dominance(global, coins);
    expect(slices.find((x) => x.id === "stables")!.share).toBeGreaterThan(0);
    expect(slices.reduce((s, x) => s + x.share, 0)).toBeCloseTo(100, 6);
  });

  it("leaves pegged coins out of altcoins vs Bitcoin", () => {
    const r = altcoinsVsBitcoin(coins)!;
    expect(r.total).toBe(50);
    expect(r.alts.some((c) => c.id === "tether" || c.id === "usd-coin")).toBe(false);
  });
});

describe("fear & greed", () => {
  it("uses the index's own bands", () => {
    expect(fgBand(10).label).toBe("Extreme Fear");
    expect(fgBand(50).label).toBe("Neutral");
    expect(fgBand(80).label).toBe("Extreme Greed");
    expect(fgTone(30)).toBe("down");
    expect(fgTone(60)).toBe("up");
  });

  it("finds the reading a given number of days back", () => {
    const pts = [0, 1, 2, 7].map((d) => ({
      value: d,
      label: "",
      time: 1000 * 86_400 - d * 86_400,
    }));
    expect(fgAgo(pts, 7)?.value).toBe(7);
    expect(fgAgo(pts, 1)?.value).toBe(1);
  });
});

describe("liquidation model", () => {
  const bar = (time: number, low: number, high: number) => ({
    time,
    open: (low + high) / 2,
    high,
    low,
    close: (low + high) / 2,
    volume: 10,
  });

  it("places liquidations at the leverage distance", () => {
    expect(liqPrice(100, 10, "long")).toBeCloseTo(90.4, 6);
    expect(liqPrice(100, 10, "short")).toBeCloseTo(109.6, 6);
  });

  it("adds levels on rising open interest and clears them once price trades through", () => {
    const flat = Array.from({ length: 5 }, (_, i) => bar(i, 99, 101));
    const oi = [100, 200, 200, 200, 200];
    const calm = buildHeatmap(flat, oi)!;
    const below = topClusters(calm.longs, calm.prices, calm.binSize, 10);
    expect(below.length).toBeGreaterThan(0);
    // A crash to 85 sweeps every 10x+ long level.
    const crash = buildHeatmap([...flat, bar(5, 85, 100)], [...oi, 200])!;
    const surviving = topClusters(crash.longs, crash.prices, crash.binSize, 10);
    expect(surviving.every((c) => c.price < 85)).toBe(true);
  });

  it("thins every level when open interest falls", () => {
    const bars = Array.from({ length: 3 }, (_, i) => bar(i, 99, 101));
    const full = buildHeatmap(bars, [100, 200, 200])!;
    const half = buildHeatmap(bars, [100, 200, 100])!;
    const sum = (a: Float64Array) => a.reduce((s, v) => s + v, 0);
    expect(sum(half.longs)).toBeCloseTo(sum(full.longs) / 2, 6);
  });

  it("aligns open interest to the latest reading at or before each bar", () => {
    expect(
      alignOpenInterest(
        [5, 10, 15],
        [
          { time: 10, value: 1 },
          { time: 14, value: 2 },
        ],
      ),
    ).toEqual([null, 1, 2]);
  });
});

describe("liquidation stream", () => {
  it("reads Binance force orders", () => {
    expect(
      parseForceOrder({ o: { s: "BTCUSDT", S: "SELL", ap: "80000", z: "0.5", T: 1 } }),
    ).toEqual({ symbol: "BTCUSDT", side: "long", price: 80000, usd: 40000, time: 1 });
    expect(parseForceOrder({ e: "other" })).toBeNull();
  });
});
