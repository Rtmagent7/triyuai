"use client";

import type { CoinDetail } from "@triyuai/shared";
import { useMoney } from "@/hooks/use-money";
import { formatCompactNumber, formatDate, formatSignedPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

/** FR-13: market cap, FDV, volume, supply with progress, ATH/ATL. */
export function StatsGrid({ coin }: { coin: CoinDetail }) {
  const money = useMoney();
  const supplyCap = coin.maxSupply ?? coin.totalSupply;
  const supplyPct =
    supplyCap && coin.circulatingSupply
      ? Math.min(100, (coin.circulatingSupply / supplyCap) * 100)
      : null;

  return (
    <section
      aria-labelledby="stats-heading"
      className="border-border rounded-2xl border p-4 sm:p-5"
    >
      <h2 id="stats-heading" className="mb-3 font-semibold">
        Statistics
      </h2>
      <dl>
        <Row label="Market cap" value={money.money(coin.marketCap)} />
        <Row label="Fully diluted valuation" value={money.money(coin.fdv)} />
        <Row label="24h trading volume" value={money.money(coin.volume24h)} />
        <Row
          label="Volume / market cap"
          value={coin.marketCap ? `${((coin.volume24h / coin.marketCap) * 100).toFixed(2)}%` : "—"}
        />
        <Row
          label="Circulating supply"
          value={`${formatCompactNumber(coin.circulatingSupply)} ${coin.symbol}`}
          extra={
            supplyPct != null && (
              <div className="mt-1.5 flex items-center gap-2">
                <div
                  className="bg-surface-2 h-1.5 flex-1 overflow-hidden rounded-full"
                  role="progressbar"
                  aria-valuenow={Math.round(supplyPct)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Circulating share of max supply"
                >
                  <div
                    className="bg-brand h-full rounded-full"
                    style={{ width: `${supplyPct}%` }}
                  />
                </div>
                <span className="text-muted tabular text-xs">{supplyPct.toFixed(0)}%</span>
              </div>
            )
          }
        />
        <Row
          label="Total supply"
          value={coin.totalSupply ? `${formatCompactNumber(coin.totalSupply)} ${coin.symbol}` : "—"}
        />
        <Row
          label="Max supply"
          value={coin.maxSupply ? `${formatCompactNumber(coin.maxSupply)} ${coin.symbol}` : "∞"}
        />
        <Row label="Genesis date" value={formatDate(coin.genesisDate)} />
        <Row
          label="All-time high"
          value={money.price(coin.ath)}
          extra={
            <p className="text-muted text-xs">
              {formatDate(coin.athDate)} ·{" "}
              <span className={cn((coin.athChangePct ?? 0) >= 0 ? "text-up" : "text-down")}>
                {formatSignedPercent(coin.athChangePct, 1)}
              </span>{" "}
              from ATH
            </p>
          }
        />
        <Row
          label="All-time low"
          value={money.price(coin.atl)}
          extra={
            <p className="text-muted text-xs">
              {formatDate(coin.atlDate)} ·{" "}
              <span className="text-up">{formatSignedPercent(coin.atlChangePct, 0)}</span> from ATL
            </p>
          }
        />
      </dl>
    </section>
  );
}

function Row({ label, value, extra }: { label: string; value: string; extra?: React.ReactNode }) {
  return (
    <div className="border-border border-b py-3 last:border-0">
      <div className="flex items-baseline justify-between gap-4">
        <dt className="text-muted text-sm">{label}</dt>
        <dd className="tabular text-right text-sm font-medium">{value}</dd>
      </div>
      {extra}
    </div>
  );
}
