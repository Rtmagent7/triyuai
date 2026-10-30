"use client";

import { PercentBadge } from "@/components/coin/percent-badge";
import { useGlobalStats } from "@/hooks/queries";
import { useMoney } from "@/hooks/use-money";
import { cn } from "@/lib/utils";
import { formatNumber, formatPercent, timeAgo } from "@/lib/format";
import { LiveIndicator } from "./live-indicator";
import Link from "next/link";
import { useFearGreed } from "@/components/insights/fear-greed-card";
import { fgTone } from "@/lib/market/fear-greed";

/** FR-02: refreshes every 60 s via React Query. */
export function GlobalStatsBar() {
  const { data } = useGlobalStats();
  const money = useMoney();
  const g = data?.data;
  return (
    <div className="border-border bg-surface border-b text-xs">
      <div className="text-muted relative mx-auto flex h-9 max-w-[1400px] items-center gap-5 overflow-x-auto whitespace-nowrap px-4 [scrollbar-width:none] sm:px-6">
        {g ? (
          <>
            <Stat label="Coins">{formatNumber(g.activeCoins)}</Stat>
            <Stat label="Market Cap">
              {money.compact(g.totalMarketCap)} <PercentBadge value={g.marketCapChange24h} />
            </Stat>
            <Stat label="24h Vol">{money.compact(g.totalVolume24h)}</Stat>
            <Stat label="Dominance" className="hidden lg:inline-flex">
              BTC {formatPercent(g.btcDominance, 1)} · ETH {formatPercent(g.ethDominance, 1)} · USDT{" "}
              {formatPercent(g.usdtDominance, 1)}
            </Stat>
            <FearGreedStat />
          </>
        ) : (
          <span>Loading market stats…</span>
        )}
        <div className="ml-auto flex items-center gap-3 pl-4">
          {data?.meta.stale && (
            // PRD §11: CoinGecko is rate-limited, so the API serves its last saved snapshot.
            <span
              suppressHydrationWarning
              className="rounded-full bg-amber-500/15 px-2 py-0.5 font-medium text-amber-700 dark:text-amber-400"
              title={`Market data provider is busy. Showing data saved ${timeAgo(data.meta.fetchedAt)}.`}
            >
              Data delayed
            </span>
          )}
          <LiveIndicator />
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      {label}:{" "}
      <span className="text-text tabular inline-flex items-center gap-1.5 font-medium">
        {children}
      </span>
    </span>
  );
}

/** Today's Fear & Greed reading, linking to its history on /insights. */
function FearGreedStat() {
  const { points } = useFearGreed();
  const now = points[0];
  if (!now) return null;
  const tone = fgTone(now.value);
  return (
    <Link href="/insights" className="hover:text-text inline-flex items-center gap-1.5">
      Fear &amp; Greed:{" "}
      <span
        className={cn(
          "tabular font-medium",
          tone === "down" ? "text-down" : tone === "up" ? "text-up" : "text-text",
        )}
      >
        {now.value} {now.label}
      </span>
    </Link>
  );
}
