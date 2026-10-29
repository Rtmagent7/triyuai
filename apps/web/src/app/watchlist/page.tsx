import type { Metadata } from "next";
import { WatchlistSubtitle, WatchlistView } from "@/components/market/watchlist-view";

export const metadata: Metadata = { title: "Watchlist", robots: { index: false } };

export default function WatchlistPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Watchlist</h1>
        <WatchlistSubtitle />
      </div>
      <WatchlistView />
    </div>
  );
}
