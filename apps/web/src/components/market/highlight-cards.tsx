"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { CoinSummary, Highlights } from "@triyuai/shared";
import { AskMark } from "@/components/chat/ask-mark";
import { CoinLogo } from "@/components/coin/coin-logo";
import { PercentBadge } from "@/components/coin/percent-badge";
import { useMoney } from "@/hooks/use-money";
import { useChat } from "@/stores/chat";

const QUESTIONS = ["What's moving the market today?", "Compare BTC and ETH", "Why is SOL up?"];

/**
 * FR-07: the three movers lists and Ask TRIYU, as one panel split by hairlines
 * (grouped, not four floating cards).
 */
export function HighlightCards({ highlights }: { highlights: Highlights }) {
  const openChat = useChat((s) => s.openWith);
  return (
    <section
      aria-label="Market highlights"
      className="bg-border border-border grid gap-px overflow-hidden rounded-xl border sm:grid-cols-2 xl:grid-cols-4"
    >
      <HighlightList title="Trending" coins={highlights.trending.slice(0, 3)} />
      <HighlightList title="Top gainers · 24h" coins={highlights.gainers.slice(0, 3)} />
      <HighlightList title="Top losers · 24h" coins={highlights.losers.slice(0, 3)} />
      <div className="bg-bg flex flex-col p-4">
        {/* Same header rhythm as the lists beside it, so the four cells end level. */}
        <div className="mb-1.5 flex items-baseline justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <AskMark className="text-brand size-3.5 self-center" /> Ask TRIYU
          </h2>
          <span className="text-muted text-xs">from live prices</span>
        </div>
        <ul>
          {QUESTIONS.map((q) => (
            <li key={q}>
              <button
                type="button"
                onClick={() => openChat({ prompt: q, coin: null })}
                className="hover:text-brand group flex w-full items-center justify-between gap-2 py-1.5 text-left text-sm transition-colors"
              >
                {q}
                <ArrowUpRight className="text-muted group-hover:text-brand size-3.5 shrink-0 transition-[color,transform] group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function HighlightList({ title, coins }: { title: string; coins: CoinSummary[] }) {
  const money = useMoney();
  return (
    <div className="bg-bg p-4">
      <div className="mb-1.5 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        <Link href="/highlights" className="text-muted hover:text-text text-xs transition-colors">
          View all
        </Link>
      </div>
      <ul>
        {coins.map((c) => (
          <li key={c.id}>
            <Link
              href={`/coins/${c.id}`}
              // Lists show many coins; prefetching each would render every page (and call the API) up front.
              prefetch={false}
              className="hover:bg-surface -mx-1.5 flex items-center gap-2.5 rounded-md px-1.5 py-1.5 text-sm transition-colors"
            >
              <CoinLogo src={c.image} name={c.name} size={18} />
              <span className="truncate font-medium">{c.name}</span>
              <span className="tabular ml-auto">{money.price(c.price)}</span>
              <PercentBadge value={c.change24h} className="w-16 justify-end text-[13px]" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
