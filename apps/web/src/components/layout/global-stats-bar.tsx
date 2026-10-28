"use client";

import { PercentBadge } from "@/components/coin/percent-badge";
import { useGlobalStats } from "@/hooks/queries";
import { useMoney } from "@/hooks/use-money";
import { formatNumber, formatPercent } from "@/lib/format";
import { LiveIndicator } from "./live-indicator";

/** FR-02: refreshes every 60 s via React Query. */
export function GlobalStatsBar() {
  const { data } = useGlobalStats();
  const money = useMoney();
  const g = data?.data;
  return (
    <div className="border-border bg-surface border-b text-xs">
      <div className="text-muted mx-auto flex h-9 max-w-[1400px] items-center gap-5 overflow-x-auto whitespace-nowrap px-4 [scrollbar-width:none] sm:px-6">
        {g ? (
          <>
            <Stat label="Coins">{formatNumber(g.activeCoins)}</Stat>
            <Stat label="Market Cap">
              {money.compact(g.totalMarketCap)} <PercentBadge value={g.marketCapChange24h} />
            </Stat>
            <Stat label="24h Vol">{money.compact(g.totalVolume24h)}</Stat>
            <Stat label="Dominance">
              BTC {formatPercent(g.btcDominance, 1)} · ETH {formatPercent(g.ethDominance, 1)}
            </Stat>
          </>
        ) : (
          <span>Loading market stats…</span>
        )}
        <div className="ml-auto pl-4">
          <LiveIndicator />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {label}:{" "}
      <span className="text-text tabular inline-flex items-center gap-1.5 font-medium">
        {children}
      </span>
    </span>
  );
}
