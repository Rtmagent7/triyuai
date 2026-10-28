"use client";

import { useEffect, useRef, useState } from "react";
import { useLiveTick } from "@/hooks/use-live-prices";
import { useMoney } from "@/hooks/use-money";
import { cn } from "@/lib/utils";

type Props = { id: string; price: number; className?: string };

/** Price that follows the live Binance tick and flashes green/red on change (FR-09). */
export function PriceCell({ id, price, className }: Props) {
  const tick = useLiveTick(id);
  const money = useMoney();
  const value = tick?.price ?? price;
  const prev = useRef(value);
  const [flash, setFlash] = useState<{ dir: "up" | "down"; n: number } | null>(null);

  useEffect(() => {
    if (value !== prev.current) {
      const dir = value > prev.current ? "up" : "down";
      setFlash((f) => ({ dir, n: (f?.n ?? 0) + 1 }));
      prev.current = value;
    }
  }, [value]);

  return (
    <span
      key={flash?.n}
      className={cn(
        "tabular -mx-1 rounded px-1",
        flash?.dir === "up" && "animate-flash-up",
        flash?.dir === "down" && "animate-flash-down",
        className,
      )}
    >
      {money.price(value)}
    </span>
  );
}

/** 24h change that follows the live tick when available. */
export function useLiveChange(id: string, fallback: number | null) {
  const tick = useLiveTick(id);
  return tick?.change24h ?? fallback;
}
