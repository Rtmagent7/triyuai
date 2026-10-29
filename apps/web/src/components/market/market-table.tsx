"use client";

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { startTransition, useEffect, useMemo, useState } from "react";
import type { Coin } from "@triyuai/shared";
import { CoinLogo } from "@/components/coin/coin-logo";
import { PercentBadge } from "@/components/coin/percent-badge";
import { PriceCell, useLiveChange } from "@/components/coin/price-cell";
import { Sparkline } from "@/components/coin/sparkline";
import { WatchlistButton } from "@/components/coin/watchlist-button";
import { Money } from "@/components/coin/money";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const col = createColumnHelper<Coin>();

function LiveChange({ coin }: { coin: Coin }) {
  return <PercentBadge value={useLiveChange(coin.id, coin.change24h)} />;
}

/** Per-column cell classes; the coin column is sticky on mobile so the table can scroll sideways. */
const cellClass: Record<string, string> = {
  rank: "hidden w-20 sm:table-cell",
  name: "sticky left-0 z-10 bg-bg group-hover:bg-surface sm:static min-w-40 max-w-[11rem] sm:max-w-none",
  price: "text-right",
  change1h: "hidden text-right md:table-cell",
  change24h: "text-right",
  change7d: "text-right",
  volume24h: "text-right",
  marketCap: "text-right",
  sparkline: "hidden w-32 xl:table-cell",
};

type Props = {
  coins: Coin[];
  filter?: string;
  isLoading?: boolean;
  emptyState?: React.ReactNode;
  className?: string;
};

/** FR-08: market table with sorting, filtering, sparklines and a live price column. */
/** Rows rendered on the server and during hydration; the rest follow in a transition. */
const FIRST_PAINT_ROWS = 20;

export function MarketTable({ coins, filter = "", isLoading, emptyState, className }: Props) {
  const [sorting, setSorting] = useState<SortingState>([]);
  // Hydrating 100 rows of sparklines at once blocks the main thread on mobile;
  // render what is above the fold first and stream in the rest without blocking input.
  const [rowLimit, setRowLimit] = useState(FIRST_PAINT_ROWS);
  useEffect(() => startTransition(() => setRowLimit(Number.POSITIVE_INFINITY)), []);

  const columns = useMemo(
    () => [
      col.accessor("rank", {
        header: "#",
        sortingFn: "basic",
        cell: ({ row }) => (
          <span className="text-muted tabular flex items-center gap-1">
            <WatchlistButton id={row.original.id} name={row.original.name} />
            {row.original.rank}
          </span>
        ),
      }),
      col.accessor("name", {
        header: "Coin",
        cell: ({ row }) => {
          const c = row.original;
          return (
            <Link
              href={`/coins/${c.id}`}
              // Lists show many coins; prefetching each would render every page (and call the API) up front.
              prefetch={false}
              className="hover:text-brand flex min-w-0 items-center gap-2.5 font-medium"
            >
              <CoinLogo src={c.image} name={c.name} size={24} />
              <span className="truncate">{c.name}</span>
              <span className="text-muted text-xs">{c.symbol}</span>
            </Link>
          );
        },
      }),
      col.accessor("price", {
        header: "Price",
        cell: ({ row }) => <PriceCell id={row.original.id} price={row.original.price} />,
      }),
      col.accessor("change1h", {
        header: "1h %",
        sortUndefined: "last",
        cell: (i) => <PercentBadge value={i.getValue()} />,
      }),
      col.accessor("change24h", {
        header: "24h %",
        cell: ({ row }) => <LiveChange coin={row.original} />,
      }),
      col.accessor("change7d", {
        header: "7d %",
        cell: (i) => <PercentBadge value={i.getValue()} />,
      }),
      col.accessor("volume24h", {
        header: "24h Volume",
        cell: (i) => <Money value={i.getValue()} />,
      }),
      col.accessor("marketCap", {
        header: "Market Cap",
        cell: (i) => <Money value={i.getValue()} />,
      }),
      col.accessor("sparkline7d", {
        id: "sparkline",
        header: "Last 7 Days",
        enableSorting: false,
        cell: (i) => <Sparkline data={i.getValue()} width={112} height={34} />,
      }),
    ],
    [],
  );

  const table = useReactTable({
    data: coins,
    columns,
    state: { sorting, globalFilter: filter },
    onSortingChange: setSorting,
    globalFilterFn: (row, _id, value: string) => {
      const q = value.trim().toLowerCase();
      return (
        !q ||
        row.original.name.toLowerCase().includes(q) ||
        row.original.symbol.toLowerCase().includes(q)
      );
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const allRows = table.getRowModel().rows;
  const rows = allRows.slice(0, rowLimit);

  return (
    <div
      className={cn(
        "border-border overflow-x-auto rounded-2xl border lg:overflow-visible",
        className,
      )}
    >
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead className="lg:sticky lg:top-16 lg:z-20">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id} className="bg-surface">
              {hg.headers.map((h) => {
                const sorted = h.column.getIsSorted();
                const canSort = h.column.getCanSort();
                return (
                  <th
                    key={h.id}
                    scope="col"
                    aria-sort={
                      sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined
                    }
                    className={cn(
                      "border-border text-muted h-11 whitespace-nowrap border-b px-3 text-xs font-medium first:rounded-tl-2xl last:rounded-tr-2xl",
                      cellClass[h.column.id],
                      h.column.id === "name" && "bg-surface text-left",
                      h.column.id === "rank" && "text-left",
                    )}
                  >
                    {canSort ? (
                      <button
                        type="button"
                        onClick={h.column.getToggleSortingHandler()}
                        className={cn(
                          "hover:text-text inline-flex items-center gap-1",
                          sorted && "text-text",
                        )}
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {sorted === "asc" ? (
                          <ArrowUp className="size-3" />
                        ) : sorted === "desc" ? (
                          <ArrowDown className="size-3" />
                        ) : (
                          <ArrowUpDown className="size-3 opacity-40" />
                        )}
                      </button>
                    ) : (
                      flexRender(h.column.columnDef.header, h.getContext())
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {isLoading
            ? Array.from({ length: 10 }, (_, i) => (
                <tr key={i} className="border-border border-b last:border-0">
                  {columns.map((c, j) => (
                    <td
                      key={j}
                      className={cn(
                        "h-14 px-3",
                        cellClass[c.id ?? ("accessorKey" in c ? String(c.accessorKey) : "")],
                      )}
                    >
                      <Skeleton className={cn("h-4", j === 1 ? "w-32" : "ml-auto w-16")} />
                    </td>
                  ))}
                </tr>
              ))
            : rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-border hover:bg-surface group border-b transition-colors last:border-0"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={cn(
                        "tabular h-14 whitespace-nowrap px-2.5",
                        cellClass[cell.column.id],
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
      {!isLoading && allRows.length === 0 && emptyState}
    </div>
  );
}
