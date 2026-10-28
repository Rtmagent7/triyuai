"use client";

import { Star } from "lucide-react";
import { toast } from "sonner";
import { useWatchlist } from "@/stores/watchlist";
import { cn } from "@/lib/utils";

type Props = { id: string; name: string; className?: string; withLabel?: boolean };

export function WatchlistButton({ id, name, className, withLabel }: Props) {
  const active = useWatchlist((s) => s.ids.includes(id));
  const toggle = useWatchlist((s) => s.toggle);
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? `Remove ${name} from watchlist` : `Add ${name} to watchlist`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const added = toggle(id);
        toast(added ? `${name} added to your watchlist` : `${name} removed from your watchlist`);
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
