"use client";

import { Star } from "lucide-react";
import { ErrorState } from "@/components/common/states";
import { useCoinsByIds } from "@/hooks/queries";
import { useLivePriceFeed } from "@/hooks/use-live-prices";
import { useWatchlistIds } from "@/hooks/use-watchlist";
import { MarketTable } from "./market-table";

export function WatchlistSubtitle() {
  const { signedIn } = useWatchlistIds();
  return (
    <p className="text-muted mt-1 text-sm">
      {signedIn
        ? "Coins you starred, synced to your account."
        : "Coins you starred, saved on this device. Sign in to sync them across devices."}
    </p>
  );
}

/** Shown, with their stars, while the watchlist is empty: something real to start from. */
const STARTERS = ["bitcoin", "ethereum", "solana", "binancecoin", "ripple"];

/** FR-30/32: reuses the market table for the device or account watchlist. */
export function WatchlistView() {
  const { ids, ready, isError, refetch } = useWatchlistIds();
  const empty = ready && ids.length === 0;
  const shown = empty ? STARTERS : ids;

  const query = useCoinsByIds(shown);
  // Drop coins removed since the last fetch (placeholder data) and order by rank.
  const coins = (query.data?.data ?? [])
    .filter((c) => shown.includes(c.id))
    .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
  useLivePriceFeed(coins);

  if (!ready && !isError) return <MarketTable coins={[]} isLoading />;
  if (empty)
    return (
      <div className="space-y-3">
        <p className="text-sm">
          Nothing starred yet. Tap{" "}
          <Star aria-hidden className="text-muted inline size-3.5 -translate-y-px" />
          <span className="sr-only">the star</span> on any coin to keep it here, or start with the
          five largest:
        </p>
        <MarketTable coins={coins} isLoading={!query.data} />
      </div>
    );
  if (query.isError || isError)
    return (
      <ErrorState
        onRetry={() => void (isError ? refetch() : query.refetch())}
        className="border-border rounded-2xl border"
      />
    );
  return <MarketTable coins={coins} isLoading={!query.data} />;
}
