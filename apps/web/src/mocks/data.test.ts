import { describe, expect, it } from "vitest";
import { chartRanges } from "@triyuai/shared";
import {
  NotFoundError,
  getChart,
  getCoinDetail,
  getCoins,
  getCoinsByIds,
  getHighlights,
  markets,
  searchCoins,
  toOhlc,
} from "./data";

describe("mock data layer", () => {
  it("paginates the top 250 by 100", () => {
    const p1 = getCoins(1).data;
    const p3 = getCoins(3).data;
    expect(p1.coins).toHaveLength(100);
    expect(p1.coins[0]!.rank).toBe(1);
    expect(p3.coins).toHaveLength(markets.length - 200);
    expect(p1.total).toBe(markets.length);
  });

  it("wraps responses in { data, meta }", () => {
    const res = getCoins(1);
    expect(res.meta).toMatchObject({ source: "mock", stale: false });
    expect(Date.parse(res.meta.fetchedAt)).not.toBeNaN();
  });

  it("looks up coins by id and skips unknown ones", () => {
    expect(getCoinsByIds(["ethereum", "nope", "bitcoin"]).data.map((c) => c.id)).toEqual([
      "ethereum",
      "bitcoin",
    ]);
  });

  it("ranks search results: exact symbol first, then prefix, then substring", () => {
    const ids = searchCoins("sol").data.map((c) => c.id);
    expect(ids[0]).toBe("solana");
    expect(searchCoins("  ").data).toEqual([]);
    expect(searchCoins("zzzzqqq").data).toEqual([]);
    expect(searchCoins("bit", 3).data.length).toBeLessThanOrEqual(3);
  });

  it("builds gainers/losers in order and keeps trending inside the top 250", () => {
    const h = getHighlights().data;
    const ids = new Set(markets.map((c) => c.id));
    expect(h.trending.every((c) => ids.has(c.id))).toBe(true);
    const g = h.gainers.map((c) => c.change24h ?? 0);
    expect([...g].sort((a, b) => b - a)).toEqual(g);
    const l = h.losers.map((c) => c.change24h ?? 0);
    expect([...l].sort((a, b) => a - b)).toEqual(l);
    const v = h.highestVolume.map((c) => c.volume24h);
    expect([...v].sort((a, b) => b - a)).toEqual(v);
  });

  it("returns full details for fixture coins and a fallback for the rest", async () => {
    const btc = (await getCoinDetail("bitcoin")).data;
    expect(btc.hasFullDetail).toBe(true);
    expect(btc.description.length).toBeGreaterThan(50);
    const tail = markets[markets.length - 1]!;
    const other = (await getCoinDetail(tail.id)).data;
    expect(other.hasFullDetail).toBe(false);
    expect(other.links.homepage).toBeNull();
  });

  it("throws NotFoundError for unknown coins", async () => {
    await expect(getCoinDetail("not-a-coin")).rejects.toBeInstanceOf(NotFoundError);
    await expect(getChart("not-a-coin", "7d")).rejects.toBeInstanceOf(NotFoundError);
  });

  it.each(chartRanges)("serves a strictly increasing %s chart for fixture coins", async (range) => {
    const c = (await getChart("bitcoin", range)).data;
    expect(c.simulated).toBe(false);
    expect(c.line.length).toBeGreaterThan(10);
    for (let i = 1; i < c.line.length; i++)
      expect(c.line[i]!.time).toBeGreaterThan(c.line[i - 1]!.time);
    expect(c.ohlc.length).toBeGreaterThan(0);
  });

  it("simulates history for coins without chart fixtures, ending at the current price", async () => {
    const tail = markets[markets.length - 1]!;
    const c = (await getChart(tail.id, "1y")).data;
    expect(c.simulated).toBe(true);
    expect(c.line.at(-1)!.value).toBe(tail.price);
    // Deterministic: same input → same series.
    expect((await getChart(tail.id, "1y")).data.line).toEqual(c.line);
  });

  it("narrows ranges: 24h ⊂ 7d ⊂ 1y", async () => {
    const span = async (r: (typeof chartRanges)[number]) => {
      const l = (await getChart("ethereum", r)).data.line;
      return l.at(-1)!.time - l[0]!.time;
    };
    expect(await span("24h")).toBeLessThanOrEqual(86_400 + 600);
    expect(await span("7d")).toBeLessThanOrEqual(7 * 86_400 + 3600);
    expect(await span("1y")).toBeGreaterThan(300 * 86_400);
  });
});

describe("toOhlc", () => {
  it("buckets points into candles that open at the previous close", () => {
    const line = [1, 3, 2, 5, 4, 6].map((value, i) => ({ time: i, value }));
    const candles = toOhlc(line, 3);
    expect(candles).toEqual([
      { time: 0, open: 1, high: 3, low: 1, close: 3 },
      { time: 2, open: 3, high: 5, low: 2, close: 5 },
      { time: 4, open: 5, high: 6, low: 4, close: 6 },
    ]);
  });

  it("needs at least two points", () => {
    expect(toOhlc([{ time: 0, value: 1 }])).toEqual([]);
  });
});
