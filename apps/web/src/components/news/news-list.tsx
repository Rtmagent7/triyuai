"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { NEWS_SOURCES, type NewsItem, type NewsSourceId } from "@triyuai/shared/news";
import { api } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/keys";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

const sourceName = (id: NewsSourceId) => NEWS_SOURCES.find((s) => s.id === id)?.name ?? id;

/** Headlines with source, age, summary and the coins they mention; each opens the original. */
export function NewsList({
  items,
  symbols,
  compact,
}: {
  items: NewsItem[];
  /** coin id → ticker, for the coin tags. */
  symbols?: Record<string, string>;
  compact?: boolean;
}) {
  return (
    <ul className="divide-border divide-y">
      {items.map((n) => (
        <li key={n.id} className={compact ? "py-3" : "py-4"}>
          <p className="text-muted text-xs" suppressHydrationWarning>
            <span className="text-text font-medium">{sourceName(n.source)}</span> ·{" "}
            <time dateTime={n.publishedAt}>{timeAgo(n.publishedAt)}</time>
          </p>
          <a
            href={n.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className={cn(
              "hover:text-brand mt-1 block font-semibold leading-snug",
              compact ? "text-sm" : "text-base",
            )}
          >
            {n.title}
            <span className="sr-only"> (opens on {sourceName(n.source)})</span>
          </a>
          {!compact && n.summary && (
            <p className="text-muted mt-1 line-clamp-2 max-w-3xl text-sm">{n.summary}</p>
          )}
          {symbols && n.coins.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Coins mentioned">
              {n.coins.slice(0, 6).map((id) => (
                <li key={id}>
                  <Link
                    href={`/coins/${id}`}
                    prefetch={false}
                    className="border-border text-muted hover:text-text inline-flex h-6 items-center rounded-md border px-2 text-xs"
                  >
                    {symbols[id] ?? id}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

/** /news: every source, filterable. */
export function NewsView({
  items,
  symbols,
}: {
  items: NewsItem[];
  symbols: Record<string, string>;
}) {
  const [source, setSource] = useState<NewsSourceId | "all">("all");
  const shown = source === "all" ? items : items.filter((n) => n.source === source);
  return (
    <div className="space-y-2">
      <div
        role="radiogroup"
        aria-label="Source"
        className="border-border flex gap-1 overflow-x-auto border-b [scrollbar-width:none]"
      >
        {[{ id: "all" as const, name: "All sources" }, ...NEWS_SOURCES].map((s) => (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={source === s.id}
            onClick={() => setSource(s.id)}
            className={cn(
              "relative inline-flex h-9 shrink-0 items-center px-2.5 text-sm transition-colors",
              source === s.id
                ? "text-text after:bg-brand font-medium after:absolute after:inset-x-2.5 after:bottom-0 after:h-px"
                : "text-muted hover:text-text",
            )}
          >
            {s.name}
          </button>
        ))}
      </div>
      <NewsList items={shown} symbols={symbols} />
    </div>
  );
}

/** Coin page: the latest stories that mention this coin. */
export function CoinNews({ coinId, name }: { coinId: string; name: string }) {
  const q = useQuery({
    queryKey: queryKeys.news(coinId),
    queryFn: () => api.news(coinId),
    select: (r) => r.data.slice(0, 5),
    staleTime: 5 * 60_000,
  });
  if (q.isError || (q.data && q.data.length === 0)) return null;
  return (
    <section
      aria-labelledby="coin-news-heading"
      className="border-border rounded-2xl border p-4 sm:p-5"
    >
      <div className="flex items-baseline justify-between">
        <h2 id="coin-news-heading" className="font-semibold">
          Latest news on {name}
        </h2>
        <Link href="/news" className="text-muted hover:text-text text-xs">
          All news
        </Link>
      </div>
      {q.data ? (
        <NewsList items={q.data} compact />
      ) : (
        <div className="bg-surface-2 mt-3 h-24 animate-pulse rounded-md" />
      )}
    </section>
  );
}
