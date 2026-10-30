"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import type { ChartRange, Coin } from "@triyuai/shared";
import { primarySector } from "@triyuai/shared/sectors";
import { AskMark } from "@/components/chat/ask-mark";
import { CoinLogo } from "@/components/coin/coin-logo";
import { PercentBadge } from "@/components/coin/percent-badge";
import { ErrorState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCoinsByIds, useSearch } from "@/hooks/queries";
import { useDebounce } from "@/hooks/use-debounce";
import { useMoney } from "@/hooks/use-money";
import { formatCompactNumber, formatDate, formatSignedPercent } from "@/lib/format";
import { MAX_COINS, SLOT_COLORS, parseCompareIds } from "@/lib/compare";
import { cn } from "@/lib/utils";
import { useChat } from "@/stores/chat";

const RANGES: { id: ChartRange; label: string }[] = [
  { id: "7d", label: "7D" },
  { id: "1m", label: "1M" },
  { id: "3m", label: "3M" },
  { id: "1y", label: "1Y" },
];

// Lightweight Charts loads after first paint, as on coin pages.
const PerformanceChart = dynamic(
  () => import("./performance-chart").then((m) => m.PerformanceChart),
  { ssr: false, loading: () => <Skeleton className="h-[22rem] w-full" /> },
);

/** `/compare?coins=a,b`: side-by-side stats and a normalised performance chart (FR-28). */
export function CompareView() {
  const raw = useSearchParams().get("coins");
  const ids = useMemo(() => parseCompareIds(raw), [raw]);
  const router = useRouter();
  const pathname = usePathname();
  const [range, setRange] = useState<ChartRange>("1m");
  const openChat = useChat((s) => s.openWith);
  const coinsQ = useCoinsByIds(ids);
  // Keep the URL's order: it decides each coin's colour.
  const coins = useMemo(() => {
    const byId = new Map((coinsQ.data?.data ?? []).map((c) => [c.id, c]));
    return ids.map((id) => byId.get(id)).filter((c): c is Coin => !!c);
  }, [coinsQ.data, ids]);

  const setIds = (next: string[]) =>
    router.replace(`${pathname}?coins=${next.join(",")}`, { scroll: false });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {ids.map((id, i) => {
          const c = coins.find((x) => x.id === id);
          return (
            <span
              key={id}
              className="border-border flex h-9 items-center gap-2 rounded-lg border pl-2 pr-1 text-sm"
            >
              <span
                aria-hidden
                className="size-2.5 rounded-full"
                style={{ background: SLOT_COLORS[i] }}
              />
              {c ? <CoinLogo src={c.image} name={c.name} size={18} /> : null}
              <span className="font-medium">{c?.name ?? id}</span>
              <button
                type="button"
                aria-label={`Remove ${c?.name ?? id}`}
                disabled={ids.length <= 2}
                onClick={() => setIds(ids.filter((x) => x !== id))}
                className="text-muted hover:text-text hover:bg-surface-2 rounded p-1 disabled:pointer-events-none disabled:opacity-30"
              >
                <X className="size-3.5" />
              </button>
            </span>
          );
        })}
        {ids.length < MAX_COINS && <AddCoin exclude={ids} onAdd={(id) => setIds([...ids, id])} />}
        {coins.length >= 2 && (
          <Button
            variant="ai"
            className="ml-auto"
            onClick={() =>
              openChat({
                prompt: `Compare ${coins.map((c) => c.name).join(", ")}`,
                coin: null,
              })
            }
          >
            <AskMark /> Ask TRIYU to compare
          </Button>
        )}
      </div>

      {coinsQ.isError ? (
        <ErrorState
          onRetry={() => void coinsQ.refetch()}
          className="border-border rounded-xl border"
        />
      ) : (
        <>
          <section aria-labelledby="perf-heading" className="border-border rounded-xl border p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 id="perf-heading" className="font-semibold">
                Performance
              </h2>
              <div role="radiogroup" aria-label="Range" className="border-border flex border-b">
                {RANGES.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    role="radio"
                    aria-checked={range === r.id}
                    onClick={() => setRange(r.id)}
                    className={cn(
                      "relative px-2.5 py-1 text-sm font-medium",
                      range === r.id
                        ? "text-text after:bg-brand after:absolute after:inset-x-2 after:-bottom-px after:h-px"
                        : "text-muted hover:text-text",
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            <PerformanceChart ids={ids} coins={coins} range={range} />
          </section>
          <StatsTable ids={ids} coins={coins} loading={coinsQ.isPending} />
        </>
      )}
    </div>
  );
}

function AddCoin({ exclude, onAdd }: { exclude: string[]; onAdd: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const results = useSearch(useDebounce(q)).data?.data.filter((c) => !exclude.includes(c.id));
  if (!open)
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Plus /> Add coin
      </Button>
    );
  return (
    <div className="relative">
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search a coin…"
        aria-label="Search a coin to add"
        className="border-border bg-surface placeholder:text-muted focus:border-brand h-9 w-56 rounded-lg border px-3 text-sm outline-none"
      />
      {results && results.length > 0 && (
        <ul className="border-border bg-bg absolute left-0 top-10 z-20 w-64 overflow-hidden rounded-lg border shadow-lg">
          {results.slice(0, 6).map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onAdd(c.id);
                  setQ("");
                  setOpen(false);
                }}
                className="hover:bg-surface flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
              >
                <CoinLogo src={c.image} name={c.name} size={18} />
                {c.name}
                <span className="text-muted text-xs">{c.symbol.toUpperCase()}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type Row = {
  label: string;
  render: (c: Coin) => React.ReactNode;
  /** Highlights the coin with the largest value (where "larger" means something). */
  best?: (c: Coin) => number | null;
};

function StatsTable({ ids, coins, loading }: { ids: string[]; coins: Coin[]; loading: boolean }) {
  const money = useMoney();
  const rows: Row[] = [
    { label: "Price", render: (c) => money.price(c.price) },
    { label: "Rank", render: (c) => (c.rank ? `#${c.rank}` : "—") },
    { label: "Sector", render: (c) => primarySector(c.id)?.label ?? "—" },
    { label: "1h", render: (c) => <PercentBadge value={c.change1h} />, best: (c) => c.change1h },
    { label: "24h", render: (c) => <PercentBadge value={c.change24h} />, best: (c) => c.change24h },
    { label: "7d", render: (c) => <PercentBadge value={c.change7d} />, best: (c) => c.change7d },
    { label: "Market cap", render: (c) => money.compact(c.marketCap), best: (c) => c.marketCap },
    { label: "Volume 24h", render: (c) => money.compact(c.volume24h), best: (c) => c.volume24h },
    {
      label: "Volume / market cap",
      render: (c) => (c.marketCap ? `${((c.volume24h / c.marketCap) * 100).toFixed(2)}%` : "—"),
    },
    { label: "Fully diluted value", render: (c) => money.compact(c.fdv) },
    { label: "Circulating supply", render: (c) => formatCompactNumber(c.circulatingSupply) },
    { label: "Max supply", render: (c) => (c.maxSupply ? formatCompactNumber(c.maxSupply) : "∞") },
    {
      label: "All-time high",
      render: (c) => (
        <>
          {money.price(c.ath)}
          <span className="text-muted block text-xs">{formatDate(c.athDate)}</span>
        </>
      ),
    },
    {
      label: "From all-time high",
      render: (c) => formatSignedPercent(c.athChangePct, 1),
      best: (c) => c.athChangePct,
    },
  ];

  if (loading) return <Skeleton className="h-96 w-full rounded-xl" />;

  // relative: keeps the sr-only "(highest)" notes inside the scroll box on phones.
  return (
    <div className="border-border relative overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="border-border border-b">
          <tr>
            <th className="text-muted w-44 px-4 py-3 text-left text-xs font-medium">
              <span className="sr-only">Stat</span>
            </th>
            {ids.map((id, i) => {
              const c = coins.find((x) => x.id === id);
              return (
                <th key={id} scope="col" className="px-4 py-3 text-right font-semibold">
                  <Link
                    href={`/coins/${id}`}
                    className="hover:text-brand inline-flex items-center gap-2"
                  >
                    <span
                      aria-hidden
                      className="size-2 rounded-full"
                      style={{ background: SLOT_COLORS[i] }}
                    />
                    {c ? <CoinLogo src={c.image} name={c.name} size={20} /> : null}
                    {c?.name ?? id}
                  </Link>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {rows.map((r) => {
            const values = ids.map((id) => {
              const c = coins.find((x) => x.id === id);
              return c && r.best ? r.best(c) : null;
            });
            const top = Math.max(...values.map((v) => v ?? -Infinity));
            return (
              <tr key={r.label}>
                <th scope="row" className="text-muted px-4 py-2.5 text-left font-normal">
                  {r.label}
                </th>
                {ids.map((id, i) => {
                  const c = coins.find((x) => x.id === id);
                  const best = r.best && values[i] != null && values[i] === top && ids.length > 1;
                  return (
                    <td
                      key={id}
                      className={cn("tabular px-4 py-2.5 text-right", best && "font-semibold")}
                    >
                      {c ? r.render(c) : "—"}
                      {best && <span className="sr-only"> (highest)</span>}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
