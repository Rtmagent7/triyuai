"use client";

import { useEffect } from "react";
import type { Coin } from "@triyuai/shared";
import { binanceSymbol, connectMiniTicker } from "@/lib/binance-ws";
import { useLivePrices, type LiveTick } from "@/stores/live-prices";

export const LIVE_COUNT = 20;

/** Subscribes the top coins (with a USDT pair) to Binance. Mount once per page. */
export function useLivePriceFeed(coins: Coin[] | undefined) {
  const key = (coins ?? [])
    .map((c) => ({ id: c.id, pair: binanceSymbol(c.symbol) }))
    .filter((c): c is { id: string; pair: string } => !!c.pair)
    .slice(0, LIVE_COUNT)
    .map((c) => `${c.id}:${c.pair}`)
    .join(",");

  useEffect(() => {
    if (!key) return;
    const pairs = key.split(",").map((p) => p.split(":") as [string, string]);
    const idByPair = new Map(pairs.map(([id, pair]) => [pair, id]));
    const { setStatus, apply } = useLivePrices.getState();

    const disconnect = connectMiniTicker({
      symbols: pairs.map(([, pair]) => pair),
      onStatus: (s) => setStatus(s === "open" ? "live" : s === "failed" ? "polling" : "connecting"),
      onTicks: (ticks) => {
        const updates: Record<string, LiveTick> = {};
        for (const t of ticks) {
          const id = idByPair.get(t.symbol);
          if (id) updates[id] = { price: t.price, change24h: t.change24h, at: Date.now() };
        }
        apply(updates);
      },
    });
    return () => {
      disconnect();
      setStatus("idle");
    };
  }, [key]);
}

/** Latest live tick for a coin, if it is one of the streamed ones. */
export const useLiveTick = (id: string) => useLivePrices((s) => s.ticks[id]);
