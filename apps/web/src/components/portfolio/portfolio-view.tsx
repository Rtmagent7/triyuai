"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Plus, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { computePositions, summarizePortfolio } from "@triyuai/shared/portfolio";
import { CoinLogo } from "@/components/coin/coin-logo";
import { PercentBadge } from "@/components/coin/percent-badge";
import { ErrorState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCoinsByIds } from "@/hooks/queries";
import { useMoney } from "@/hooks/use-money";
import { useAuthActions, useSession } from "@/hooks/use-session";
import { api } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/keys";
import { formatDate, formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AddTransaction } from "./add-transaction";

/** Allocation colours, in order of size; the rest share one neutral slice. */
const SLICES = ["#1a9bff", "#f59e0b", "#14b8a6", "#ec4899", "#84cc16"];

const signed = (s: string, n: number) => (n > 0 ? `+${s}` : n < 0 ? `−${s.replace("-", "")}` : s);
const tone = (n: number | null) => (n == null || n === 0 ? "" : n > 0 ? "text-up" : "text-down");

/** Portfolio tracker (P2): positions, P&L and the transactions behind them. */
export function PortfolioView() {
  const session = useSession();
  const user = session.data;
  if (session.isPending) return <Skeleton className="h-64 w-full rounded-xl" />;
  if (!user) return <SignInNudge />;
  return <Portfolio />;
}

function SignInNudge() {
  const { demo } = useAuthActions();
  const [busy, setBusy] = useState(false);
  return (
    <div className="border-border rounded-xl border p-8 text-center">
      <h2 className="font-semibold">Track what you hold</h2>
      <p className="text-muted mx-auto mt-1 max-w-md text-sm">
        Record your buys and sells to see your positions, average cost and profit or loss at live
        prices. Your portfolio is saved to your account.
      </p>
      <div className="mt-5 flex justify-center gap-2">
        <Button asChild>
          <Link href="/login?next=/portfolio">Sign in</Link>
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await demo();
            } finally {
              setBusy(false);
            }
          }}
        >
          Try the demo account
        </Button>
      </div>
    </div>
  );
}

function Portfolio() {
  const money = useMoney();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const txs = useQuery({
    queryKey: queryKeys.portfolio,
    queryFn: () => api.portfolio.list(),
    select: (r) => r.data,
  });
  const ids = useMemo(() => [...new Set((txs.data ?? []).map((t) => t.coinId))].sort(), [txs.data]);
  const coins = useCoinsByIds(ids);
  const byId = useMemo(() => new Map((coins.data?.data ?? []).map((c) => [c.id, c])), [coins.data]);
  const summary = useMemo(() => {
    const prices = Object.fromEntries(
      [...byId.values()].map((c) => [c.id, { price: c.price, change24h: c.change24h }]),
    );
    return summarizePortfolio(computePositions(txs.data ?? []), prices);
  }, [txs.data, byId]);
  const remove = useMutation({
    mutationFn: api.portfolio.remove,
    onSuccess: (res) => qc.setQueryData(queryKeys.portfolio, res),
  });

  if (txs.isError)
    return (
      <ErrorState onRetry={() => void txs.refetch()} className="border-border rounded-xl border" />
    );
  if (txs.isPending) return <Skeleton className="h-64 w-full rounded-xl" />;

  const held = summary.rows.filter((r) => r.quantity > 0);
  const closed = summary.rows.filter((r) => r.quantity === 0);
  const empty = (txs.data ?? []).length === 0;

  return (
    <div className="space-y-8">
      <section
        aria-label="Summary"
        className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"
      >
        <dl className="grid grid-cols-2 gap-x-10 gap-y-4 sm:grid-cols-4">
          <div>
            <dt className="text-muted text-xs">Value</dt>
            <dd className="tabular text-2xl font-semibold">{money.money(summary.value)}</dd>
            {summary.change24h != null && (
              <dd className={cn("tabular text-xs", tone(summary.change24h))}>
                {signed(money.money(summary.change24h), summary.change24h)} today
              </dd>
            )}
          </div>
          <div>
            <dt className="text-muted text-xs">Cost of holdings</dt>
            <dd className="tabular text-2xl font-semibold">{money.money(summary.costBasis)}</dd>
          </div>
          <div>
            <dt className="text-muted text-xs">Unrealized P/L</dt>
            <dd className={cn("tabular text-2xl font-semibold", tone(summary.unrealizedPnl))}>
              {signed(money.money(summary.unrealizedPnl), summary.unrealizedPnl)}
            </dd>
            {summary.unrealizedPct != null && (
              <PercentBadge value={summary.unrealizedPct} className="text-xs" />
            )}
          </div>
          <div>
            <dt className="text-muted text-xs">Realized P/L</dt>
            <dd className={cn("tabular text-2xl font-semibold", tone(summary.realizedPnl))}>
              {signed(money.money(summary.realizedPnl), summary.realizedPnl)}
            </dd>
          </div>
        </dl>
        <Button onClick={() => setAdding((a) => !a)} variant={adding ? "outline" : "primary"}>
          {adding ? <X /> : <Plus />} {adding ? "Close" : "Add transaction"}
        </Button>
      </section>

      {adding && (
        <section className="border-border max-w-2xl rounded-xl border p-5">
          <h2 className="mb-4 font-semibold">New transaction</h2>
          <AddTransaction onDone={() => setAdding(false)} />
        </section>
      )}

      {empty && !adding ? (
        <div className="border-border text-muted rounded-xl border p-8 text-center text-sm">
          No transactions yet. Add your first buy to start tracking.
        </div>
      ) : (
        <>
          {held.length > 0 && (
            <section aria-labelledby="alloc-heading" className="space-y-2">
              <h2 id="alloc-heading" className="text-sm font-semibold">
                Allocation
              </h2>
              <div
                className="border-border flex h-3 overflow-hidden rounded-full border"
                role="img"
                aria-label={held
                  .map(
                    (r) =>
                      `${byId.get(r.coinId)?.symbol ?? r.coinId} ${formatPercent(r.weight * 100, 1)}`,
                  )
                  .join(", ")}
              >
                {held.map((r, i) => (
                  <span
                    key={r.coinId}
                    style={{
                      width: `${r.weight * 100}%`,
                      background: SLICES[i] ?? "var(--surface-2)",
                    }}
                  />
                ))}
              </div>
              <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
                {held.slice(0, 6).map((r, i) => (
                  <li key={r.coinId} className="flex items-center gap-1.5">
                    <span
                      aria-hidden
                      className="size-2 rounded-sm"
                      style={{ background: SLICES[i] ?? "var(--surface-2)" }}
                    />
                    {byId.get(r.coinId)?.symbol.toUpperCase() ?? r.coinId}
                    <span className="text-muted tabular">{formatPercent(r.weight * 100, 1)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="positions-heading" className="space-y-2">
            <h2 id="positions-heading" className="text-sm font-semibold">
              Positions
            </h2>
            {/* relative: keeps the badges' screen-reader text inside the scroll box on phones. */}
            <div className="border-border relative overflow-x-auto rounded-xl border">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="text-muted border-border border-b text-xs">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium">Coin</th>
                    <th className="px-3 py-2.5 text-right font-medium">Holdings</th>
                    <th className="px-3 py-2.5 text-right font-medium">Avg cost</th>
                    <th className="px-3 py-2.5 text-right font-medium">Price</th>
                    <th className="px-3 py-2.5 text-right font-medium">24h</th>
                    <th className="px-3 py-2.5 text-right font-medium">Value</th>
                    <th className="px-4 py-2.5 text-right font-medium">Unrealized P/L</th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {[...held, ...closed].map((r) => {
                    const c = byId.get(r.coinId);
                    return (
                      <tr
                        key={r.coinId}
                        className={cn("hover:bg-surface", r.quantity === 0 && "text-muted")}
                      >
                        <td className="px-4 py-2.5">
                          <Link
                            href={`/coins/${r.coinId}`}
                            className="hover:text-brand inline-flex items-center gap-2.5 font-medium"
                          >
                            {c && <CoinLogo src={c.image} name={c.name} size={20} />}
                            {c?.name ?? r.coinId}
                            {c && (
                              <span className="text-muted text-xs">{c.symbol.toUpperCase()}</span>
                            )}
                          </Link>
                          {r.quantity === 0 && (
                            <span className="text-muted ml-2 text-xs">closed</span>
                          )}
                        </td>
                        <td className="tabular px-3 py-2.5 text-right">
                          {formatNumber(r.quantity, { maximumFractionDigits: 8 })}
                        </td>
                        <td className="tabular px-3 py-2.5 text-right">
                          {r.quantity ? money.price(r.avgCost) : "—"}
                        </td>
                        <td className="tabular px-3 py-2.5 text-right">{money.price(r.price)}</td>
                        <td className="px-3 py-2.5 text-right">
                          <PercentBadge value={r.change24h} />
                        </td>
                        <td className="tabular px-3 py-2.5 text-right font-medium">
                          {money.money(r.value)}
                        </td>
                        <td className={cn("tabular px-4 py-2.5 text-right", tone(r.unrealizedPnl))}>
                          {r.quantity ? signed(money.money(r.unrealizedPnl), r.unrealizedPnl) : "—"}
                          {r.unrealizedPct != null && r.quantity > 0 && (
                            <span className="ml-1.5 text-xs">
                              ({signed(formatPercent(r.unrealizedPct, 1), r.unrealizedPct)})
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section aria-labelledby="tx-heading" className="space-y-2">
            <h2 id="tx-heading" className="text-sm font-semibold">
              Transactions
            </h2>
            <ul className="border-border divide-border divide-y rounded-xl border text-sm">
              {(txs.data ?? []).map((t) => {
                const c = byId.get(t.coinId);
                const label = `${t.type} ${formatNumber(t.quantity, { maximumFractionDigits: 8 })} ${c?.symbol.toUpperCase() ?? t.coinId}`;
                return (
                  <li key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                    {/* Phones: date and type above the details; wider screens: one line. */}
                    <div className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-4">
                      <div className="flex items-center gap-2 sm:contents">
                        <span className="text-muted tabular text-xs sm:w-24">
                          {formatDate(t.date)}
                        </span>
                        <span
                          className={cn(
                            "text-xs font-medium uppercase sm:w-10",
                            t.type === "buy" ? "text-up" : "text-down",
                          )}
                        >
                          {t.type}
                        </span>
                      </div>
                      <span className="tabular block min-w-0 truncate sm:flex-1">
                        {formatNumber(t.quantity, { maximumFractionDigits: 8 })}{" "}
                        {c?.symbol.toUpperCase() ?? t.coinId}{" "}
                        <span className="text-muted">at {money.price(t.priceUsd)}</span>
                        {t.note && <span className="text-muted ml-2 text-xs">· {t.note}</span>}
                      </span>
                    </div>
                    <span className="tabular font-medium">
                      {money.money(t.quantity * t.priceUsd)}
                    </span>
                    <button
                      type="button"
                      aria-label={`Delete ${label}`}
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(t.id)}
                      className="text-muted hover:text-text hover:bg-surface-2 rounded p-1.5"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
            {remove.isError && (
              <p role="alert" className="text-down text-sm">
                {(remove.error as Error).message}
              </p>
            )}
          </section>
        </>
      )}
      <p className="text-muted text-xs">
        Average-cost method; prices from the live market data. Not financial advice.
      </p>
    </div>
  );
}
