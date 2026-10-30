"use client";

import { ArrowUpRight, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { Exchange } from "@triyuai/shared";
import { CoinLogo } from "@/components/coin/coin-logo";
import { EmptyState } from "@/components/common/states";
import { useMoney } from "@/hooks/use-money";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

type Sort = "trust" | "volume";

/** Trust Score as ten small cells: green from 8, plain from 5, red below. */
function TrustScore({ score }: { score: number | null }) {
  if (score == null) return <span className="text-muted">—</span>;
  const tone = score >= 8 ? "bg-up" : score >= 5 ? "bg-text/60" : "bg-down";
  return (
    <span className="inline-flex items-center gap-2" aria-label={`Trust Score ${score} of 10`}>
      <span className="tabular w-5 text-right font-semibold">{score}</span>
      <span className="flex gap-0.5" aria-hidden>
        {Array.from({ length: 10 }, (_, i) => (
          <span
            key={i}
            className={cn("h-2.5 w-1 rounded-[1px]", i < score ? tone : "bg-surface-2")}
          />
        ))}
      </span>
    </span>
  );
}

/** Exchanges ranked by CoinGecko's Trust Score, with volume in the chosen currency (P2). */
export function ExchangesTable({ exchanges }: { exchanges: Exchange[] }) {
  const money = useMoney();
  const [sort, setSort] = useState<Sort>("trust");
  const [filter, setFilter] = useState("");
  const total = useMemo(() => exchanges.reduce((s, e) => s + e.volume24hUsd, 0), [exchanges]);

  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = q ? exchanges.filter((e) => e.name.toLowerCase().includes(q)) : [...exchanges];
    return sort === "volume"
      ? list.sort((a, b) => b.volume24hUsd - a.volume24hUsd)
      : list.sort((a, b) => a.trustScoreRank - b.trustScoreRank);
  }, [exchanges, filter, sort]);
  const maxShare = Math.max(...exchanges.map((e) => e.volume24hUsd), 1) / (total || 1);

  return (
    <section aria-labelledby="exchanges-heading" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div role="radiogroup" aria-label="Sort by" className="border-border flex border-b">
          {(
            [
              ["trust", "Trust Score"],
              ["volume", "24h volume"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={sort === id}
              onClick={() => setSort(id)}
              className={cn(
                "relative px-3 py-1.5 text-sm font-medium",
                sort === id
                  ? "text-text after:bg-brand after:absolute after:inset-x-3 after:-bottom-px after:h-px"
                  : "text-muted hover:text-text",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="relative block sm:w-64">
          <span className="sr-only">Filter exchanges</span>
          <Search className="text-muted pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by name"
            className="border-border bg-surface placeholder:text-muted focus:border-brand h-9 w-full rounded-lg border pl-9 pr-3 text-sm outline-none"
          />
        </label>
      </div>
      <h2 id="exchanges-heading" className="sr-only">
        Exchanges
      </h2>

      {rows.length === 0 ? (
        <EmptyState
          title={`No exchange matches “${filter}”`}
          message="Try another name."
          className="border-border rounded-xl border"
        />
      ) : (
        <div className="border-border overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-muted border-border border-b text-xs">
              <tr>
                <th className="w-12 px-4 py-2.5 text-left font-medium">#</th>
                <th className="px-3 py-2.5 text-left font-medium">Exchange</th>
                <th className="px-3 py-2.5 text-left font-medium">Trust Score</th>
                <th className="px-3 py-2.5 text-right font-medium">24h volume</th>
                <th className="px-3 py-2.5 text-left font-medium">Share of volume</th>
                <th className="px-3 py-2.5 text-left font-medium">Country</th>
                <th className="px-4 py-2.5 text-right font-medium">Founded</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {rows.map((e) => {
                const share = total ? e.volume24hUsd / total : 0;
                return (
                  <tr key={e.id} className="hover:bg-surface">
                    <td className="text-muted tabular px-4 py-2.5">{e.trustScoreRank}</td>
                    <td className="px-3 py-2.5">
                      <a
                        href={e.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="hover:text-brand group inline-flex items-center gap-2.5 font-medium"
                      >
                        <CoinLogo src={e.image} name={e.name} size={22} />
                        {e.name}
                        <ArrowUpRight
                          aria-hidden
                          className="text-muted size-3.5 opacity-0 transition-opacity group-hover:opacity-100"
                        />
                        <span className="sr-only">(opens the exchange&apos;s website)</span>
                      </a>
                    </td>
                    <td className="px-3 py-2.5">
                      <TrustScore score={e.trustScore} />
                    </td>
                    <td className="tabular px-3 py-2.5 text-right">
                      {money.compact(e.volume24hUsd)}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-2">
                        <span
                          className="bg-surface-2 h-1.5 w-20 overflow-hidden rounded-full"
                          aria-hidden
                        >
                          <span
                            className="bg-brand block h-full"
                            style={{ width: `${Math.min(100, (share / maxShare) * 100)}%` }}
                          />
                        </span>
                        <span className="tabular text-muted text-xs">
                          {formatPercent(share * 100, 1)}
                        </span>
                      </span>
                    </td>
                    <td className="text-muted px-3 py-2.5">{e.country ?? "—"}</td>
                    <td className="text-muted tabular px-4 py-2.5 text-right">
                      {e.yearEstablished ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Headline figures for the whole list. */
export function ExchangesSummary({ exchanges }: { exchanges: Exchange[] }) {
  const money = useMoney();
  const total = exchanges.reduce((s, e) => s + e.volume24hUsd, 0);
  const top10 = [...exchanges]
    .sort((a, b) => b.volume24hUsd - a.volume24hUsd)
    .slice(0, 10)
    .reduce((s, e) => s + e.volume24hUsd, 0);
  const perfect = exchanges.filter((e) => e.trustScore === 10).length;
  return (
    <dl className="grid grid-cols-3 gap-x-8 gap-y-3">
      <div>
        <dt className="text-muted text-xs">24h volume, all {exchanges.length}</dt>
        <dd className="tabular font-semibold">{money.compact(total)}</dd>
      </div>
      <div>
        <dt className="text-muted text-xs">Top 10 by volume</dt>
        <dd className="tabular font-semibold">
          {formatPercent(total ? (top10 / total) * 100 : 0, 1)}
        </dd>
      </div>
      <div>
        <dt className="text-muted text-xs">With Trust Score 10</dt>
        <dd className="tabular font-semibold">{perfect}</dd>
      </div>
    </dl>
  );
}
