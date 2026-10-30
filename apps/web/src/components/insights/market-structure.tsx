"use client";

import Link from "next/link";
import type { Coin, GlobalStats } from "@triyuai/shared";
import { CoinLogo } from "@/components/coin/coin-logo";
import { PercentBadge } from "@/components/coin/percent-badge";
import { Card } from "@/components/ui/card";
import { useMoney } from "@/hooks/use-money";
import { formatPercent, formatSignedPercent } from "@/lib/format";
import {
  altcoinsVsBitcoin,
  coinsInSector,
  dominance,
  type SectorStats,
} from "@/lib/market/sectors";
import { cn } from "@/lib/utils";

/** Each asset in its own recognisable colour; "everything else" stays neutral. */
const SLICE_COLOR: Record<string, string> = {
  btc: "#f7931a",
  eth: "#8a92b2",
  usdt: "#26a17b",
  stables: "#7cc9b0",
  rest: "var(--surface-2)",
};

/** BTC, ETH and USDT dominance plus the other stablecoins, as one bar that adds up to 100%. */
export function DominanceCard({ global, coins }: { global: GlobalStats; coins: Coin[] }) {
  const slices = dominance(global, coins);
  const stables = slices
    .filter((s) => s.id === "usdt" || s.id === "stables")
    .reduce((t, s) => t + s.share, 0);
  const money = useMoney();
  const topStables = coinsInSector(coins, "stablecoin")
    .sort((a, b) => b.marketCap - a.marketCap)
    .slice(0, 5);
  return (
    <Card className="flex flex-col gap-5 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-semibold">Dominance</h2>
        <span className="text-muted text-xs">Share of total market cap</span>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Big label="Bitcoin" value={global.btcDominance} />
        <Big label="USDT" value={global.usdtDominance} />
        <Big label="All stablecoins" value={stables} />
      </div>
      <div
        className="border-border flex h-3 overflow-hidden rounded-full border"
        role="img"
        aria-label={slices.map((s) => `${s.label} ${formatPercent(s.share, 1)}`).join(", ")}
      >
        {slices.map((s) => (
          <span key={s.id} style={{ width: `${s.share}%`, background: SLICE_COLOR[s.id] }} />
        ))}
      </div>
      <ul className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
        {slices.map((s) => (
          <li key={s.id} className="flex items-center gap-2">
            <span
              aria-hidden
              className="border-border size-2.5 rounded-sm border"
              style={{ background: SLICE_COLOR[s.id] }}
            />
            {s.label}
            <span className="tabular ml-auto font-medium">{formatPercent(s.share, 1)}</span>
          </li>
        ))}
      </ul>
      <div>
        <h3 className="text-muted mb-1.5 text-xs">Largest stablecoins</h3>
        <ul className="divide-border divide-y text-sm">
          {topStables.map((c) => (
            <li key={c.id} className="flex items-center gap-2.5 py-1.5">
              <CoinLogo src={c.image} name={c.name} size={18} />
              <Link href={`/coins/${c.id}`} prefetch={false} className="hover:text-brand truncate">
                {c.name}
              </Link>
              <span className="text-muted tabular ml-auto text-xs">
                {money.compact(c.marketCap)}
              </span>
              <span className="tabular w-12 text-right font-medium">
                {formatPercent((c.marketCap / global.totalMarketCap) * 100, 1)}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-muted mt-auto text-xs">
        Rising stablecoin dominance usually means money is waiting on the sidelines; rising Bitcoin
        dominance means it is moving out of altcoins.
      </p>
    </Card>
  );
}

function Big({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-muted text-xs">{label}</div>
      <div className="tabular text-2xl font-semibold">{formatPercent(value, 1)}</div>
    </div>
  );
}

/** How many of the 50 largest altcoins beat Bitcoin this week, one cell per coin. */
export function AltcoinsVsBitcoinCard({ coins }: { coins: Coin[] }) {
  const r = altcoinsVsBitcoin(coins);
  if (!r) return null;
  const btc = r.btcChange7d;
  const verdict =
    r.share >= 0.75 ? "Altcoin season" : r.share <= 0.25 ? "Bitcoin season" : "Neither season";
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div>
        <h2 className="font-semibold">Altcoins vs Bitcoin · 7d</h2>
        <p className="text-muted text-xs">Top {r.total} by market cap, pegged coins left out</p>
      </div>
      <div className="flex items-baseline gap-3">
        <span className="tabular text-4xl font-semibold leading-none">
          {r.beat}
          <span className="text-muted text-xl">/{r.total}</span>
        </span>
        <span className="font-medium">{verdict}</span>
      </div>
      <ul className="grid grid-cols-10 gap-1" aria-label="Each coin against Bitcoin">
        {r.alts.map((c) => {
          const beat = c.change7d! > btc;
          return (
            <li key={c.id}>
              <Link
                href={`/coins/${c.id}`}
                prefetch={false}
                title={`${c.symbol.toUpperCase()} ${formatSignedPercent(c.change7d)} vs BTC ${formatSignedPercent(btc)}`}
                aria-label={`${c.name}: ${formatSignedPercent(c.change7d)}, ${beat ? "beat" : "trailed"} Bitcoin`}
                className={cn(
                  "block aspect-square rounded-[3px] transition-opacity hover:opacity-70",
                  beat ? "bg-up" : "bg-surface-2",
                )}
              />
            </li>
          );
        })}
      </ul>
      <p className="text-muted text-xs">
        Bitcoin {formatSignedPercent(btc)} this week. Green cells beat it. 75% or more is usually
        called altcoin season; the common index measures 90 days, this one 7.
      </p>
    </Card>
  );
}

/** Sectors by market cap with their money-weighted moves and largest coins. */
export function SectorTable({ stats, limit }: { stats: SectorStats[]; limit?: number }) {
  const money = useMoney();
  const rows = limit ? stats.slice(0, limit) : stats;
  return (
    <div className="border-border overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="text-muted border-border border-b text-xs">
          <tr>
            <th className="px-4 py-2.5 text-left font-medium">Sector</th>
            <th className="px-3 py-2.5 text-right font-medium">24h</th>
            <th className="px-3 py-2.5 text-right font-medium">7d</th>
            <th className="px-3 py-2.5 text-right font-medium">Market cap</th>
            <th className="px-3 py-2.5 text-right font-medium">Volume 24h</th>
            <th className="px-4 py-2.5 text-left font-medium">Largest</th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {rows.map((s) => (
            <tr key={s.sector.id} className="hover:bg-surface">
              <td className="px-4 py-2.5">
                <Link href={`/categories/${s.sector.id}`} className="hover:text-brand font-medium">
                  {s.sector.label}
                </Link>
                <span className="text-muted ml-2 whitespace-nowrap text-xs">
                  {s.coins.length} coins
                </span>
              </td>
              <td className="px-3 py-2.5 text-right">
                <PercentBadge value={s.change24h} />
              </td>
              <td className="px-3 py-2.5 text-right">
                <PercentBadge value={s.change7d} />
              </td>
              <td className="tabular px-3 py-2.5 text-right">{money.compact(s.marketCap)}</td>
              <td className="tabular text-muted px-3 py-2.5 text-right">
                {money.compact(s.volume24h)}
              </td>
              <td className="px-4 py-2.5">
                <span className="flex -space-x-1.5">
                  {s.coins.slice(0, 4).map((c) => (
                    <span key={c.id} title={c.name} className="ring-bg rounded-full ring-2">
                      <CoinLogo src={c.image} name={c.name} size={20} />
                    </span>
                  ))}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
