"use client";

import Link from "next/link";
import { Star } from "lucide-react";
import { EmptyState, ErrorState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
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

/** FR-30/32: reuses the market table for the device or account watchlist. */
export function WatchlistView() {
  const { ids, ready, isError, refetch } = useWatchlistIds();

  const query = useCoinsByIds(ids);
  // Drop coins removed since the last fetch (placeholder data) and order by rank.
  const coins = (query.data?.data ?? [])
    .filter((c) => ids.includes(c.id))
    .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
  useLivePriceFeed(coins);

  if (!ready && !isError) return <MarketTable coins={[]} isLoading />;
  if (ids.length === 0)
    return (
      <div className="border-border rounded-2xl border border-dashed">
        <EmptyState
          icon={<Star className="size-8 text-amber-500" />}
          title="Your watchlist is empty"
          message="Tap the star next to any coin to keep track of it here."
          action={
            <Button asChild variant="primary" size="sm">
              <Link href="/">Browse the market</Link>
            </Button>
          }
        />
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
