"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useMoney } from "@/hooks/use-money";
import { fetchPerpStats } from "@/lib/market/futures";
import { cn } from "@/lib/utils";

const pct = (f: number, digits = 4) => `${f >= 0 ? "+" : ""}${(f * 100).toFixed(digits)}%`;

function countdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

/** Funding, open interest and the long/short account ratio for the main perpetuals. */
export function FundingTable({
  symbols,
  selected,
  onSelect,
}: {
  symbols: string[];
  selected?: string;
  onSelect?: (symbol: string) => void;
}) {
  const money = useMoney();
  const q = useQuery({
    queryKey: ["perp-stats", symbols],
    queryFn: ({ signal }) => fetchPerpStats(symbols, signal),
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 1,
  });
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  if (q.isError)
    return (
      <p className="border-border text-muted rounded-xl border p-6 text-center text-sm">
        Binance futures data couldn&apos;t be reached. It may be blocked on this network.
      </p>
    );

  return (
    <div className="border-border overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[680px] text-sm">
        <thead className="text-muted border-border border-b text-xs">
          <tr>
            <th className="px-4 py-2.5 text-left font-medium">Perpetual</th>
            <th className="px-3 py-2.5 text-right font-medium">Mark price</th>
            <th className="px-3 py-2.5 text-right font-medium">Funding · 8h</th>
            <th className="px-3 py-2.5 text-right font-medium">Next in</th>
            <th className="px-3 py-2.5 text-right font-medium">Open interest</th>
            <th className="px-4 py-2.5 text-left font-medium">Accounts long / short</th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {q.data
            ? q.data.map((p) => {
                const longShare = p.longShortRatio
                  ? p.longShortRatio / (1 + p.longShortRatio)
                  : null;
                const active = p.symbol === selected;
                return (
                  <tr key={p.symbol} className={cn("hover:bg-surface", active && "bg-surface")}>
                    <td className="px-4 py-2">
                      {onSelect ? (
                        <button
                          type="button"
                          onClick={() => onSelect(p.symbol)}
                          aria-pressed={active}
                          className={cn("hover:text-brand font-medium", active && "text-brand")}
                        >
                          {p.symbol.replace(/USDT$/, "")}
                          <span className="text-muted ml-1 text-xs font-normal">PERP</span>
                        </button>
                      ) : (
                        p.symbol
                      )}
                    </td>
                    <td className="tabular px-3 py-2 text-right">
                      {p.markPrice.toLocaleString("en-US", { maximumSignificantDigits: 6 })}
                    </td>
                    <td
                      className={cn(
                        "tabular px-3 py-2 text-right font-medium",
                        p.fundingRate > 0 ? "text-up" : p.fundingRate < 0 ? "text-down" : "",
                      )}
                      title={`About ${pct(p.fundingRate * 3 * 365, 1)} a year at this rate`}
                    >
                      {pct(p.fundingRate)}
                    </td>
                    <td
                      className="text-muted tabular px-3 py-2 text-right"
                      suppressHydrationWarning
                    >
                      {countdown(p.nextFundingTime - now)}
                    </td>
                    <td className="tabular px-3 py-2 text-right">
                      {money.compact(p.openInterestUsd)}
                    </td>
                    <td className="px-4 py-2">
                      {longShare != null ? (
                        <span className="flex items-center gap-2">
                          <span className="tabular text-up w-9 text-xs">
                            {Math.round(longShare * 100)}%
                          </span>
                          <span
                            className="bg-down/80 flex h-1.5 w-24 overflow-hidden rounded-full"
                            aria-hidden
                          >
                            <span className="bg-up" style={{ width: `${longShare * 100}%` }} />
                          </span>
                          <span className="tabular text-down w-9 text-xs">
                            {Math.round((1 - longShare) * 100)}%
                          </span>
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })
            : symbols.map((s) => (
                <tr key={s}>
                  <td colSpan={6} className="px-4 py-2">
                    <span className="bg-surface-2 block h-5 animate-pulse rounded" />
                  </td>
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}
