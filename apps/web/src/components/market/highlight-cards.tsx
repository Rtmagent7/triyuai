"use client";

import Link from "next/link";
import { ArrowRight, Flame, TrendingDown, TrendingUp } from "lucide-react";
import type { CoinSummary, Highlights } from "@triyuai/shared";
import { Sparkle } from "@/components/chat/sparkle";
import { CoinLogo } from "@/components/coin/coin-logo";
import { PercentBadge } from "@/components/coin/percent-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useMoney } from "@/hooks/use-money";
import { useChat } from "@/stores/chat";

/** FR-07: three highlight lists + the Ask TRIYU promo above the market table. */
export function HighlightCards({ highlights }: { highlights: Highlights }) {
  const openChat = useChat((s) => s.openWith);
  return (
    <section
      aria-label="Market highlights"
      className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      <HighlightList
        title="Trending"
        icon={<Flame className="size-4 text-orange-500" />}
        coins={highlights.trending.slice(0, 3)}
      />
      <HighlightList
        title="Top Gainers"
        icon={<TrendingUp className="text-up size-4" />}
        coins={highlights.gainers.slice(0, 3)}
      />
      <HighlightList
        title="Top Losers"
        icon={<TrendingDown className="text-down size-4" />}
        coins={highlights.losers.slice(0, 3)}
      />
      <Card className="lift relative overflow-hidden border-transparent p-5">
        <div className="ai-gradient absolute inset-0 opacity-[0.14]" aria-hidden />
        <div className="relative flex h-full flex-col">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <span className="ai-gradient flex size-6 items-center justify-center rounded-full text-white">
              <Sparkle className="size-3.5" />
            </span>
            Ask <span className="ai-text -ml-1">TRIYU</span>
          </p>
          <p className="text-muted mt-2 text-sm">
            What&apos;s moving the market? Get an answer built from live market data.
          </p>
          <Button
            variant="ai"
            size="sm"
            className="mt-auto self-start"
            onClick={() => openChat({ prompt: "What's moving the market today?", coin: null })}
          >
            Ask now <ArrowRight />
          </Button>
        </div>
      </Card>
    </section>
  );
}

function HighlightList({
  title,
  icon,
  coins,
}: {
  title: string;
  icon: React.ReactNode;
  coins: CoinSummary[];
}) {
  const money = useMoney();
  return (
    <Card className="lift p-4">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          {icon}
          {title}
        </h2>
        <Link href="/highlights" className="text-muted hover:text-text text-xs">
          View more
        </Link>
      </div>
      <ul>
        {coins.map((c) => (
          <li key={c.id}>
            <Link
              href={`/coins/${c.id}`}
              // Lists show many coins; prefetching each would render every page (and call the API) up front.
              prefetch={false}
              className="hover:bg-surface-2 flex items-center gap-2.5 rounded-lg px-1 py-1.5 text-sm"
            >
              <CoinLogo src={c.image} name={c.name} size={20} />
              <span className="truncate font-medium">{c.name}</span>
              <span className="tabular ml-auto">{money.price(c.price)}</span>
              <PercentBadge value={c.change24h} className="w-16 justify-end text-xs" />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
