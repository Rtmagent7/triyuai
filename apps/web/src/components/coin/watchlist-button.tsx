"use client";

import { Star } from "lucide-react";
import { useToggleWatchlist, useWatchlistIds } from "@/hooks/use-watchlist";
import { cn } from "@/lib/utils";

type Props = { id: string; name: string; className?: string; withLabel?: boolean };

export function WatchlistButton({ id, name, className, withLabel }: Props) {
  const active = useWatchlistIds().ids.includes(id);
  const toggle = useToggleWatchlist();
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? `Remove ${name} from watchlist` : `Add ${name} to watchlist`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void toggle(id, name, active);
      }}
      className={cn(
        "text-muted hover:bg-surface-2 hover:text-text inline-flex items-center gap-1.5 rounded-lg p-1.5 transition-colors",
        active && "text-amber-500 hover:text-amber-500",
        withLabel && "border-border border px-3 text-sm",
        className,
      )}
    >
      <Star className={cn("size-4", active && "fill-current")} />
      {withLabel && <span>{active ? "Watchlisted" : "Watchlist"}</span>}
    </button>
  );
}
