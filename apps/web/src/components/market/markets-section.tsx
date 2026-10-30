"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useState } from "react";
import type { CoinsPage } from "@triyuai/shared";
import { ErrorState, EmptyState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { useCoinsPage } from "@/hooks/queries";
import { useLivePriceFeed } from "@/hooks/use-live-prices";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MarketTable } from "./market-table";
import { SectorNav } from "./sector-tags";

const PAGES = [1, 2, 3];

export function MarketsSection({
  page,
  initial,
  snapshotAt,
}: {
  page: number;
  initial: CoinsPage;
  snapshotAt: string;
}) {
  const query = useCoinsPage(page, initial);
  const [filter, setFilter] = useState("");
  const coins = query.data?.data.coins;
  // Live prices stream for the overall top 20, so only subscribe on page 1.
  useLivePriceFeed(page === 1 ? coins : undefined);

  return (
    <section aria-labelledby="markets-heading" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="markets-heading" className="text-xl font-semibold">
            Cryptocurrency prices by market cap
          </h2>
          <p className="text-muted mt-0.5 text-xs" suppressHydrationWarning>
            Top 250 · snapshot updated {timeAgo(snapshotAt)} · top 20 stream live
          </p>
        </div>
        <label className="relative block sm:w-64">
          <span className="sr-only">Filter coins on this page</span>
          <Search className="text-muted pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by name or symbol"
            className="border-border bg-surface placeholder:text-muted focus:border-brand h-9 w-full rounded-lg border pl-9 pr-3 text-sm outline-none"
          />
        </label>
      </div>

      <SectorNav />

      {query.isError && !coins ? (
        <ErrorState
          onRetry={() => void query.refetch()}
          className="border-border rounded-2xl border"
        />
      ) : (
        <MarketTable
          coins={coins ?? []}
          filter={filter}
          isLoading={!coins}
          emptyState={
            <EmptyState
              title={`No coins match “${filter}”`}
              message="Try another name or symbol, or search all 250 coins with Ctrl K."
              action={
                <Button size="sm" variant="outline" onClick={() => setFilter("")}>
                  Clear filter
                </Button>
              }
            />
          }
        />
      )}

      <nav aria-label="Pagination" className="flex items-center justify-center gap-1 pt-2">
        <PageLink page={page - 1} disabled={page <= 1} aria-label="Previous page">
          <ChevronLeft className="size-4" />
        </PageLink>
        {PAGES.map((p) => (
          <PageLink key={p} page={p} current={p === page}>
            {p}
          </PageLink>
        ))}
        <PageLink page={page + 1} disabled={page >= PAGES.length} aria-label="Next page">
          <ChevronRight className="size-4" />
        </PageLink>
      </nav>
    </section>
  );
}

function PageLink({
  page,
  current,
  disabled,
  children,
  ...rest
}: {
  page: number;
  current?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  "aria-label"?: string;
}) {
  const cls = cn(
    "inline-flex size-9 items-center justify-center rounded-lg text-sm font-medium tabular",
    current ? "bg-brand text-brand-fg" : "text-muted hover:bg-surface-2 hover:text-text",
    disabled && "pointer-events-none opacity-40",
  );
  if (disabled)
    return (
      <span className={cls} aria-hidden>
        {children}
      </span>
    );
  return (
    <Link
      href={page === 1 ? "/" : `/?page=${page}`}
      className={cls}
      aria-current={current ? "page" : undefined}
      {...rest}
    >
      {children}
    </Link>
  );
}
