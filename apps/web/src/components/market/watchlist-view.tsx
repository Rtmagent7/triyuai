"use client";

import Link from "next/link";
import { Star } from "lucide-react";
import { useEffect, useState } from "react";
import { EmptyState, ErrorState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { useCoinsByIds } from "@/hooks/queries";
import { useLivePriceFeed } from "@/hooks/use-live-prices";
import { useWatchlist } from "@/stores/watchlist";
import { MarketTable } from "./market-table";

/** FR-30: reuses the market table for the locally stored watchlist. */
export function WatchlistView() {
  const ids = useWatchlist((s) => s.ids);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(useWatchlist.persist.hasHydrated());
    return useWatchlist.persist.onFinishHydration(() => setHydrated(true));
  }, []);

  const query = useCoinsByIds(ids);
  // Drop coins removed since the last fetch (placeholder data) and order by rank.
  const coins = (query.data?.data ?? [])
    .filter((c) => ids.includes(c.id))
    .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
  useLivePriceFeed(coins);

  if (!hydrated) return <MarketTable coins={[]} isLoading />;
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
  if (query.isError)
    return (
      <ErrorState
        onRetry={() => void query.refetch()}
        className="border-border rounded-2xl border"
      />
    );
  return <MarketTable coins={coins} isLoading={!query.data} />;
}
