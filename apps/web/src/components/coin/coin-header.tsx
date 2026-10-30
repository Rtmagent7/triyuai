"use client";

import { Check, Link2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { CoinDetail } from "@triyuai/shared";
import { Sparkle } from "@/components/chat/sparkle";
import { Button } from "@/components/ui/button";
import { useLivePriceFeed, useLiveTick } from "@/hooks/use-live-prices";
import { useMoney } from "@/hooks/use-money";
import { clamp } from "@/lib/utils";
import { useChat } from "@/stores/chat";
import { CoinLogo } from "./coin-logo";
import { PercentBadge } from "./percent-badge";
import { PriceCell } from "./price-cell";
import { WatchlistButton } from "./watchlist-button";
import { LiveIndicator } from "@/components/layout/live-indicator";

/** FR-11 + FR-16: coin header with live price, 24h range, watchlist, share and Ask TRIYU. */
export function CoinHeader({ coin }: { coin: CoinDetail }) {
  const money = useMoney();
  const tick = useLiveTick(coin.id);
  const openWith = useChat((s) => s.openWith);
  const setCoinContext = useChat((s) => s.setCoinContext);
  const [copied, setCopied] = useState(false);
  useLivePriceFeed(coin.rank && coin.rank <= 25 ? [coin] : undefined);

  // The floating chat button on this page uses the coin as context.
  useEffect(() => {
    setCoinContext({ id: coin.id, name: coin.name });
    return () => setCoinContext(null);
  }, [coin.id, coin.name, setCoinContext]);

  const price = tick?.price ?? coin.price;
  const low = Math.min(coin.low24h ?? price, price);
  const high = Math.max(coin.high24h ?? price, price);
  const pos = high > low ? clamp(((price - low) / (high - low)) * 100, 0, 100) : 50;

  const share = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="w-full max-w-md space-y-3">
        <div className="flex items-center gap-3">
          <CoinLogo src={coin.image} name={coin.name} size={40} priority />
          <div>
            <h1 className="flex flex-wrap items-baseline gap-x-2 text-2xl font-semibold tracking-tight">
              {coin.name}
              <span className="text-muted text-base font-normal">{coin.symbol}</span>
            </h1>
            <div className="text-muted flex items-center gap-2 text-xs">
              <span className="bg-surface-2 text-text rounded-md px-1.5 py-0.5 font-medium">
                Rank #{coin.rank}
              </span>
              {tick && <LiveIndicator />}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-baseline gap-3">
          <p className="text-3xl font-semibold tracking-tight sm:text-4xl">
            <PriceCell id={coin.id} price={coin.price} />
          </p>
          <PercentBadge
            value={tick?.change24h ?? coin.change24h}
            variant="pill"
            className="text-sm"
          />
        </div>
        <div>
          <div
            className="from-down to-up relative h-1.5 rounded-full bg-gradient-to-r via-amber-400"
            aria-hidden
          >
            <span
              className="border-bg bg-text absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
              style={{ left: `${pos}%` }}
            />
          </div>
          <div className="text-muted tabular mt-1.5 flex justify-between text-xs">
            <span>Low {money.price(low)}</span>
            <span>24h range</span>
            <span>High {money.price(high)}</span>
          </div>
        </div>
      </div>

      {/* Phones: Watchlist and Share side by side, Ask TRIYU full width below. */}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <WatchlistButton id={coin.id} name={coin.name} withLabel className="h-9 justify-center" />
        <Button variant="outline" onClick={share} title="Copy link to this page">
          {copied ? <Check /> : <Link2 />} {copied ? "Copied" : "Share"}
        </Button>
        <Button
          variant="ai"
          className="col-span-2"
          onClick={() =>
            openWith({
              coin: { id: coin.id, name: coin.name },
              prompt: `How is ${coin.name} doing today?`,
            })
          }
        >
          <Sparkle className="text-white" /> Ask TRIYU about {coin.name}
        </Button>
      </div>
    </div>
  );
}
