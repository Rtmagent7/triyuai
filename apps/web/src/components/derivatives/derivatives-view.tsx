"use client";

import { useState } from "react";
import { HEATMAP_WINDOWS, type HeatmapWindow } from "@/lib/market/futures";
import { cn } from "@/lib/utils";
import { FundingTable } from "./funding-table";
import { LiquidationHeatmap } from "./liquidation-heatmap";
import { LiveLiquidations } from "./live-liquidations";

/** The perpetuals with the deepest open interest on Binance. */
export const PERPS = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "XRPUSDT",
  "DOGEUSDT",
  "BNBUSDT",
  "SUIUSDT",
  "ADAUSDT",
  "LINKUSDT",
  "AVAXUSDT",
  "LTCUSDT",
  "TRXUSDT",
];

export function DerivativesView() {
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [span, setSpan] = useState<HeatmapWindow>("7d");

  return (
    <div className="space-y-8">
      <section aria-labelledby="heatmap-heading" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="heatmap-heading" className="font-semibold">
              Liquidation heatmap · {symbol.replace(/USDT$/, "")}
            </h2>
            <p className="text-muted text-xs">
              Where leveraged positions would be forced to close. Brighter means more.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="text-muted flex items-center gap-2 text-xs">
              Pair
              <select
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="border-border bg-surface text-text focus:border-brand h-8 rounded-md border px-2 text-sm outline-none"
              >
                {PERPS.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/USDT$/, "")}/USDT
                  </option>
                ))}
              </select>
            </label>
            <div role="radiogroup" aria-label="Window" className="border-border flex border-b">
              {(Object.keys(HEATMAP_WINDOWS) as HeatmapWindow[]).map((w) => (
                <button
                  key={w}
                  type="button"
                  role="radio"
                  aria-checked={span === w}
                  onClick={() => setSpan(w)}
                  className={cn(
                    "relative px-2.5 py-1 text-sm font-medium",
                    span === w
                      ? "text-text after:bg-brand after:absolute after:inset-x-2 after:-bottom-px after:h-px"
                      : "text-muted hover:text-text",
                  )}
                >
                  {HEATMAP_WINDOWS[w].label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <LiquidationHeatmap symbol={symbol} span={span} />
      </section>

      <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
        <section aria-labelledby="funding-heading" className="min-w-0 space-y-3">
          <div>
            <h2 id="funding-heading" className="font-semibold">
              Funding &amp; open interest
            </h2>
            <p className="text-muted text-xs">
              Positive funding: longs pay shorts, so the crowd leans long. Select a pair to map it.
            </p>
          </div>
          <FundingTable symbols={PERPS} selected={symbol} onSelect={setSymbol} />
        </section>
        <LiveLiquidations symbol={symbol} className="h-[460px] xl:mt-[52px]" />
      </div>
    </div>
  );
}
