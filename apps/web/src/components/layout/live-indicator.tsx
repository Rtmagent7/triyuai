"use client";

import { useLivePrices } from "@/stores/live-prices";
import { cn } from "@/lib/utils";

const labels = {
  idle: { text: "Snapshot", dot: "bg-muted", title: "Showing the latest snapshot" },
  connecting: { text: "Connecting", dot: "bg-amber-500", title: "Connecting to live prices" },
  live: { text: "Live", dot: "bg-up", title: "Top 20 prices stream live from Binance" },
  polling: {
    text: "Delayed",
    dot: "bg-amber-500",
    title: "Live feed unavailable, refreshing every 30 s",
  },
} as const;

export function LiveIndicator({ className }: { className?: string }) {
  const status = useLivePrices((s) => s.status);
  const l = labels[status];
  return (
    <span
      className={cn("text-text inline-flex items-center gap-1.5 font-medium", className)}
      title={l.title}
      aria-live="polite"
    >
      <span className="relative flex size-2">
        {status === "live" && (
          <span className="bg-up absolute inline-flex size-full animate-ping rounded-full opacity-60" />
        )}
        <span className={cn("relative inline-flex size-2 rounded-full", l.dot)} />
      </span>
      {l.text}
    </span>
  );
}
