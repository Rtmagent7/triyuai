import {
  PORTFOLIO_MAX_TRANSACTIONS,
  heldQuantity,
  transactionInputSchema,
  type Transaction,
} from "@triyuai/shared/portfolio";
import type { z } from "zod";
import type { Db } from "../db";
import { AppError } from "../lib/errors";

export type PortfolioService = ReturnType<typeof createPortfolioService>;

type Row = {
  id: string;
  coinId: string;
  type: string;
  quantity: number;
  priceUsd: number;
  date: Date;
  note: string | null;
  createdAt: Date;
};

const toTransaction = (r: Row): Transaction => ({
  id: r.id,
  coinId: r.coinId,
  type: r.type === "sell" ? "sell" : "buy",
  quantity: r.quantity,
  priceUsd: r.priceUsd,
  date: r.date.toISOString(),
  ...(r.note ? { note: r.note } : {}),
  createdAt: r.createdAt.toISOString(),
});

/** Portfolio tracker (P2): a user's buys and sells, newest first. */
export function createPortfolioService(db: Db) {
  const list = async (userId: string): Promise<Transaction[]> =>
    (
      await db.portfolioTransaction.findMany({
        where: { userId },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      })
    ).map(toTransaction);

  return {
    list,

    async add(userId: string, input: z.output<typeof transactionInputSchema>) {
      const existing = await list(userId);
      if (existing.length >= PORTFOLIO_MAX_TRANSACTIONS)
        throw new AppError(
          422,
          "PORTFOLIO_FULL",
          `A portfolio holds up to ${PORTFOLIO_MAX_TRANSACTIONS} transactions`,
        );
      if (input.type === "sell") {
        // Holdings as of the sell date, so a back-dated sell can't go below zero.
        const when = new Date(input.date).toISOString();
        const before = existing.filter((t) => t.date <= when);
        const held = heldQuantity(before, input.coinId);
        if (input.quantity > held + 1e-12)
          throw new AppError(
            422,
            "INSUFFICIENT_HOLDINGS",
            held > 0
              ? `You held ${held} of this coin on that date, so you can't sell ${input.quantity}.`
              : "You didn't hold this coin on that date.",
          );
      }
      await db.portfolioTransaction.create({
        data: {
          userId,
          coinId: input.coinId,
          type: input.type,
          quantity: input.quantity,
          priceUsd: input.priceUsd,
          date: new Date(input.date),
          note: input.note || null,
        },
      });
      return list(userId);
    },

    async remove(userId: string, id: string) {
      const { count } = await db.portfolioTransaction.deleteMany({ where: { id, userId } });
      if (!count) throw new AppError(404, "NOT_FOUND", "Transaction not found");
      return list(userId);
    },
  };
}
