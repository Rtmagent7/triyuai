"use client";

import { Command } from "cmdk";
import { Dialog } from "radix-ui";
import { Clock, Loader2, Search, TrendingUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CoinSummary } from "@triyuai/shared";
import { CoinLogo } from "@/components/coin/coin-logo";
import { PercentBadge } from "@/components/coin/percent-badge";
import { useHighlights, useSearch } from "@/hooks/queries";
import { useDebounce } from "@/hooks/use-debounce";
import { useMoney } from "@/hooks/use-money";
import { useRecentSearches } from "@/stores/recent-searches";
import { useUi } from "@/stores/ui";

/** FR-03: coin search with trending + recent searches when empty. Opened via CommandPaletteLoader. */
export function CommandPalette() {
  const open = useUi((s) => s.paletteOpen);
  const setOpen = useUi((s) => s.setPaletteOpen);
  const [query, setQuery] = useState("");
  const debounced = useDebounce(query, 250);
  const router = useRouter();
  const search = useSearch(debounced);
  const highlights = useHighlights();
  const recent = useRecentSearches((s) => s.items);
  const addRecent = useRecentSearches((s) => s.add);
  const clearRecent = useRecentSearches((s) => s.clear);

  const select = (coin: CoinSummary) => {
    addRecent(coin);
    setOpen(false);
    setQuery("");
    router.push(`/coins/${coin.id}`);
  };

  const typing = query.trim().length > 0;
  const results = typing && debounced === query ? (search.data?.data ?? []) : [];
  const pending = typing && (debounced !== query || search.isFetching);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery("");
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content
          aria-describedby={undefined}
          className="border-border bg-bg fixed left-1/2 top-[12vh] z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border shadow-2xl"
        >
          <Dialog.Title className="sr-only">Search coins</Dialog.Title>
          <Command shouldFilter={false} loop label="Search coins">
            <div className="border-border flex items-center gap-2 border-b px-4">
              <Search className="text-muted size-4" aria-hidden />
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder="Search by name or symbol, e.g. solana"
                className="h-13 placeholder:text-muted w-full bg-transparent text-[15px] outline-none"
              />
              {pending && (
                <Loader2 className="text-muted size-4 animate-spin" aria-label="Searching" />
              )}
              <kbd className="border-border text-muted rounded border px-1.5 text-[11px]">Esc</kbd>
            </div>
            <Command.List className="max-h-[min(60vh,420px)] overflow-y-auto p-2">
              {typing ? (
                <>
                  {!pending && (
                    <Command.Empty className="text-muted px-3 py-10 text-center text-sm">
                      No coins match “{query}” in the top 250.
                    </Command.Empty>
                  )}
                  {results.map((c) => (
                    <CoinItem key={c.id} coin={c} onSelect={select} />
                  ))}
                </>
              ) : (
                <>
                  {recent.length > 0 && (
                    <Command.Group heading="Recent">
                      {recent.map((c) => (
                        <CoinItem
                          key={`r-${c.id}`}
                          coin={c}
                          onSelect={select}
                          icon={<Clock className="text-muted size-3.5" />}
                        />
                      ))}
                      {/* An item, not a heading button: cmdk hides headings from assistive tech. */}
                      <Command.Item
                        value="clear-recent-searches"
                        onSelect={clearRecent}
                        className="text-muted data-[selected=true]:bg-surface-2 cursor-pointer rounded-lg px-3 py-2 text-xs"
                      >
                        Clear recent searches
                      </Command.Item>
                    </Command.Group>
                  )}
                  <Command.Group heading="Trending">
                    {(highlights.data?.data.trending ?? []).slice(0, 7).map((c) => (
                      <CoinItem
                        key={`t-${c.id}`}
                        coin={c}
                        onSelect={select}
                        icon={<TrendingUp className="text-muted size-3.5" />}
                      />
                    ))}
                  </Command.Group>
                </>
              )}
            </Command.List>
            <div className="border-border text-muted flex items-center gap-4 border-t px-4 py-2 text-[11px]">
              <span>↑↓ navigate</span>
              <span>↵ open</span>
              <span>esc close</span>
            </div>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function CoinItem({
  coin,
  onSelect,
  icon,
}: {
  coin: CoinSummary;
  onSelect: (c: CoinSummary) => void;
  icon?: React.ReactNode;
}) {
  const money = useMoney();
  return (
    <Command.Item
      value={coin.id}
      onSelect={() => onSelect(coin)}
      className="data-[selected=true]:bg-surface-2 flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm"
    >
      {icon}
      <CoinLogo src={coin.image} name={coin.name} size={22} />
      <span className="font-medium">{coin.name}</span>
      <span className="text-muted">{coin.symbol}</span>
      {coin.rank && <span className="text-muted text-xs">#{coin.rank}</span>}
      <span className="tabular ml-auto flex items-center gap-3">
        <span>{money.price(coin.price)}</span>
        <PercentBadge value={coin.change24h} className="w-16 justify-end text-xs" />
      </span>
    </Command.Item>
  );
}
