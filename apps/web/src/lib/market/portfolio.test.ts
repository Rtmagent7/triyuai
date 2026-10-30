import { describe, expect, it } from "vitest";
import {
  computePositions,
  heldQuantity,
  summarizePortfolio,
  transactionInputSchema,
} from "@triyuai/shared/portfolio";

const tx = (
  type: "buy" | "sell",
  quantity: number,
  priceUsd: number,
  date: string,
  coinId = "bitcoin",
) => ({
  coinId,
  type,
  quantity,
  priceUsd,
  date: `${date}T00:00:00.000Z`,
});

describe("computePositions (average cost)", () => {
  it("blends buys into one average cost", () => {
    const [p] = computePositions([
      tx("buy", 1, 60_000, "2026-01-01"),
      tx("buy", 1, 80_000, "2026-02-01"),
    ]);
    expect(p).toMatchObject({ quantity: 2, avgCost: 70_000, costBasis: 140_000, realizedPnl: 0 });
  });

  it("books realized P&L on a partial sell and keeps the average", () => {
    const [p] = computePositions([
      tx("buy", 2, 70_000, "2026-01-01"),
      tx("sell", 0.5, 90_000, "2026-03-01"),
    ]);
    expect(p!.quantity).toBeCloseTo(1.5, 10);
    expect(p!.avgCost).toBeCloseTo(70_000, 6);
    expect(p!.costBasis).toBeCloseTo(105_000, 6);
    expect(p!.realizedPnl).toBeCloseTo(10_000, 6);
  });

  it("applies transactions in date order, whatever order they were entered", () => {
    const [p] = computePositions([
      tx("sell", 1, 50_000, "2026-03-01"),
      tx("buy", 1, 40_000, "2026-01-01"),
    ]);
    expect(p).toMatchObject({ quantity: 0, realizedPnl: 10_000, costBasis: 0, avgCost: 0 });
  });

  it("never sells more than is held", () => {
    const [p] = computePositions([
      tx("buy", 1, 100, "2026-01-01"),
      tx("sell", 5, 200, "2026-02-01"),
    ]);
    expect(p).toMatchObject({ quantity: 0, realizedPnl: 100 });
    expect(
      heldQuantity([tx("buy", 3, 1, "2026-01-01"), tx("sell", 1, 1, "2026-01-02")], "bitcoin"),
    ).toBe(2);
  });
});

describe("summarizePortfolio", () => {
  it("values holdings, unrealized P&L, weights and the 24h change", () => {
    const positions = computePositions([
      tx("buy", 1, 50_000, "2026-01-01"),
      tx("buy", 10, 2_000, "2026-01-01", "ethereum"),
      tx("buy", 100, 1, "2026-01-01", "unlisted-coin"),
    ]);
    const s = summarizePortfolio(positions, {
      bitcoin: { price: 60_000, change24h: 20 },
      ethereum: { price: 2_000, change24h: null },
    });
    expect(s.value).toBe(80_000);
    expect(s.costBasis).toBe(70_100);
    expect(s.unrealizedPnl).toBe(10_000);
    expect(s.rows[0]).toMatchObject({ coinId: "bitcoin", weight: 0.75, unrealizedPct: 20 });
    // Only Bitcoin has a 24h move: 60,000 today vs 50,000 yesterday.
    expect(s.change24h).toBeCloseTo(10_000, 6);
    expect(s.rows.find((r) => r.coinId === "unlisted-coin")).toMatchObject({
      price: null,
      value: 0,
    });
  });
});

describe("transactionInputSchema", () => {
  it("rejects zero quantities, negative prices and future dates", () => {
    const base = {
      coinId: "bitcoin",
      type: "buy",
      quantity: 1,
      priceUsd: 1,
      date: "2026-01-01T00:00:00Z",
    };
    expect(transactionInputSchema.safeParse(base).success).toBe(true);
    expect(transactionInputSchema.safeParse({ ...base, quantity: 0 }).success).toBe(false);
    expect(transactionInputSchema.safeParse({ ...base, priceUsd: -1 }).success).toBe(false);
    expect(
      transactionInputSchema.safeParse({ ...base, date: "2999-01-01T00:00:00Z" }).success,
    ).toBe(false);
  });
});
