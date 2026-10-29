import { WATCHLIST_MAX } from "@triyuai/shared";
import type { Db } from "../db";
import { AppError } from "../lib/errors";

export type WatchlistService = ReturnType<typeof createWatchlistService>;

export function createWatchlistService(db: Db) {
  const list = async (userId: string) =>
    (
      await db.watchlistItem.findMany({
        where: { userId },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { coinId: true },
      })
    ).map((i) => i.coinId);

  async function addMany(userId: string, coinIds: string[], truncate = false) {
    const current = new Set(await list(userId));
    let fresh = [...new Set(coinIds)].filter((id) => !current.has(id));
    if (truncate) fresh = fresh.slice(0, Math.max(0, WATCHLIST_MAX - current.size));
    if (current.size + fresh.length > WATCHLIST_MAX) {
      throw new AppError(422, "WATCHLIST_FULL", `A watchlist holds up to ${WATCHLIST_MAX} coins`);
    }
    // skipDuplicates makes concurrent adds of the same coin harmless (unique userId+coinId).
    await db.watchlistItem.createMany({
      data: fresh.map((coinId) => ({ userId, coinId })),
      skipDuplicates: true,
    });
    return list(userId);
  }

  return {
    list,
    add: (userId: string, coinId: string) => addMany(userId, [coinId]),
    async remove(userId: string, coinId: string) {
      await db.watchlistItem.deleteMany({ where: { userId, coinId } });
      return list(userId);
    },
    /**
     * First login: the browser's local watchlist is merged into the account, without
     * duplicates. Coins beyond the limit are dropped rather than failing the sign-in.
     */
    merge: (userId: string, coinIds: string[]) => addMany(userId, coinIds, true),
  };
}
