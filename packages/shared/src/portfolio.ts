import { z } from "zod";
import { coinIdSchema } from "./schemas";

/** Transactions kept per account. */
export const PORTFOLIO_MAX_TRANSACTIONS = 500;

export const transactionTypeSchema = z.enum(["buy", "sell"]);
export type TransactionType = z.infer<typeof transactionTypeSchema>;

/** What the user enters; prices are in USD (the web app converts from the chosen currency). */
export const transactionInputSchema = z.object({
  coinId: coinIdSchema,
  type: transactionTypeSchema,
  quantity: z.number().positive("Quantity must be more than 0").max(1e15),
  priceUsd: z.number().min(0, "Price can't be negative").max(1e12),
  /** ISO date-time; not in the future. */
  date: z
    .string()
    .datetime({ offset: true })
    .refine((d) => new Date(d).getTime() <= Date.now() + 60_000, "Date can't be in the future"),
  note: z.string().trim().max(140).optional(),
});
export type TransactionInput = z.input<typeof transactionInputSchema>;

export const transactionSchema = transactionInputSchema.extend({
  id: z.string(),
  createdAt: z.string(),
});
export type Transaction = z.infer<typeof transactionSchema>;

export type Position = {
  coinId: string;
  quantity: number;
  /** Average cost per coin of what is still held (USD). */
  avgCost: number;
  /** What the held coins cost (USD). */
  costBasis: number;
  /** Profit already locked in by sells (USD). */
  realizedPnl: number;
};

const EPS = 1e-12;

/**
 * Positions by the average-cost method: buys raise the quantity and blend the average
 * cost; sells lower the quantity at that average and book the difference as realized P&L.
 * Transactions are applied oldest first; a coin sold to zero keeps its realized P&L.
 */
export function computePositions(transactions: Pick<Transaction, "coinId" | "type" | "quantity" | "priceUsd" | "date">[]) {
  const byCoin = new Map<string, Position>();
  const ordered = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  for (const t of ordered) {
    const p = byCoin.get(t.coinId) ?? {
      coinId: t.coinId,
      quantity: 0,
      avgCost: 0,
      costBasis: 0,
      realizedPnl: 0,
    };
    if (t.type === "buy") {
      p.costBasis += t.quantity * t.priceUsd;
      p.quantity += t.quantity;
    } else {
      const sold = Math.min(t.quantity, p.quantity);
      p.realizedPnl += sold * (t.priceUsd - p.avgCost);
      p.costBasis -= sold * p.avgCost;
      p.quantity -= sold;
    }
    if (p.quantity < EPS) {
      p.quantity = 0;
      p.costBasis = 0;
    }
    p.avgCost = p.quantity > 0 ? p.costBasis / p.quantity : 0;
    byCoin.set(t.coinId, p);
  }
  return [...byCoin.values()];
}

/** How many coins are held right now, for validating a sell. */
export const heldQuantity = (
  transactions: Pick<Transaction, "coinId" | "type" | "quantity" | "priceUsd" | "date">[],
  coinId: string,
) => computePositions(transactions.filter((t) => t.coinId === coinId))[0]?.quantity ?? 0;

export type PortfolioSummary = {
  value: number;
  costBasis: number;
  unrealizedPnl: number;
  /** Unrealized P&L as a % of cost basis (null with nothing held). */
  unrealizedPct: number | null;
  realizedPnl: number;
  /** Value change over 24h from each coin's 24h move (null when unknown). */
  change24h: number | null;
  rows: (Position & {
    price: number | null;
    value: number;
    unrealizedPnl: number;
    unrealizedPct: number | null;
    change24h: number | null;
    /** Share of the portfolio's value, 0–1. */
    weight: number;
  })[];
};

/** Values positions at current prices. Coins without a price count at zero value. */
export function summarizePortfolio(
  positions: Position[],
  prices: Record<string, { price: number; change24h: number | null } | undefined>,
): PortfolioSummary {
  const rows = positions.map((p) => {
    const q = prices[p.coinId];
    const value = q ? p.quantity * q.price : 0;
    const unrealizedPnl = q ? value - p.costBasis : 0;
    return {
      ...p,
      price: q?.price ?? null,
      value,
      unrealizedPnl,
      unrealizedPct: p.costBasis > 0 && q ? (unrealizedPnl / p.costBasis) * 100 : null,
      change24h: q?.change24h ?? null,
      weight: 0,
    };
  });
  const value = rows.reduce((s, r) => s + r.value, 0);
  for (const r of rows) r.weight = value > 0 ? r.value / value : 0;
  const costBasis = rows.reduce((s, r) => s + r.costBasis, 0);
  const unrealizedPnl = rows.reduce((s, r) => s + r.unrealizedPnl, 0);
  // Yesterday's value of each holding = today's / (1 + change).
  // Only holdings with a known 24h move count, on both sides of the difference.
  let today = 0;
  let yesterday = 0;
  let known = false;
  for (const r of rows) {
    if (!r.value || r.change24h == null) continue;
    known = true;
    today += r.value;
    yesterday += r.value / (1 + r.change24h / 100);
  }
  return {
    value,
    costBasis,
    unrealizedPnl,
    unrealizedPct: costBasis > 0 ? (unrealizedPnl / costBasis) * 100 : null,
    realizedPnl: rows.reduce((s, r) => s + r.realizedPnl, 0),
    change24h: known ? today - yesterday : null,
    rows: rows.sort((a, b) => b.value - a.value || b.realizedPnl - a.realizedPnl),
  };
}
