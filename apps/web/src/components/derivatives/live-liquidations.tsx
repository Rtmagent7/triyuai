"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { useMoney } from "@/hooks/use-money";
import { streamLiquidations, type Liquidation } from "@/lib/market/futures";
import { cn } from "@/lib/utils";

const KEEP = 40;

/** Forced liquidations on Binance futures as they happen, with running totals per side. */
export function LiveLiquidations({ symbol, className }: { symbol?: string; className?: string }) {
  const money = useMoney();
  const [onlySymbol, setOnlySymbol] = useState(false);
  const [rows, setRows] = useState<Liquidation[]>([]);
  const [totals, setTotals] = useState({ long: 0, short: 0 });
  const [status, setStatus] = useState<"connecting" | "open" | "closed">("connecting");
  const buffer = useRef<Liquidation[]>([]);

  useEffect(() => {
    const stop = streamLiquidations(
      (l) => buffer.current.push(l),
      (s) => setStatus(s),
    );
    // Frames can arrive dozens a second; render them in batches.
    const flush = setInterval(() => {
      const batch = buffer.current.splice(0);
      if (!batch.length) return;
      setRows((r) => [...batch.reverse(), ...r].slice(0, 400));
      setTotals((t) => {
        const next = { ...t };
        for (const l of batch) next[l.side] += l.usd;
        return next;
      });
    }, 500);
    return () => {
      stop();
      clearInterval(flush);
    };
  }, []);

  const shown = (onlySymbol && symbol ? rows.filter((r) => r.symbol === symbol) : rows).slice(
    0,
    KEEP,
  );
  const sum = totals.long + totals.short;

  return (
    <Card className={cn("flex min-h-0 flex-col p-4", className)}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="font-semibold">Live liquidations</h2>
        <span className="text-muted text-xs" aria-live="polite">
          {status === "open"
            ? "Binance futures · live"
            : status === "connecting"
              ? "Connecting…"
              : "Reconnecting…"}
        </span>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-muted text-xs">Longs liquidated</div>
          <div className="text-down tabular font-semibold">{money.compact(totals.long)}</div>
        </div>
        <div>
          <div className="text-muted text-xs">Shorts liquidated</div>
          <div className="text-up tabular font-semibold">{money.compact(totals.short)}</div>
        </div>
        <div
          className="bg-surface-2 col-span-2 flex h-1.5 overflow-hidden rounded-full"
          aria-hidden
        >
          <span
            className="bg-down"
            style={{ width: sum ? `${(totals.long / sum) * 100}%` : "50%" }}
          />
          <span className="bg-up flex-1" />
        </div>
        <p className="text-muted col-span-2 text-[11px]">Since you opened this page.</p>
      </div>
      {symbol && (
        <label className="text-muted mb-2 flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={onlySymbol}
            onChange={(e) => setOnlySymbol(e.target.checked)}
            className="accent-brand size-3.5"
          />
          Only {symbol.replace(/USDT$/, "")}
        </label>
      )}
      <ul
        className="divide-border min-h-0 flex-1 divide-y overflow-y-auto text-sm"
        aria-label="Recent liquidations"
      >
        {shown.length ? (
          shown.map((l, i) => (
            <li
              key={`${l.time}-${l.symbol}-${i}`}
              className="tabular flex items-center gap-2 py-1.5"
            >
              <span className="w-14 font-medium">{l.symbol.replace(/USDT$|USDC$/, "")}</span>
              <span className={cn("w-12 text-xs", l.side === "long" ? "text-down" : "text-up")}>
                {l.side === "long" ? "Long" : "Short"}
              </span>
              <span className="text-muted text-xs">
                {l.price.toLocaleString("en-US", { maximumSignificantDigits: 6 })}
              </span>
              <span className="ml-auto font-medium">{money.compact(l.usd)}</span>
            </li>
          ))
        ) : (
          <li className="text-muted py-6 text-center text-xs">
            {status === "open" ? "Waiting for the next liquidation…" : "Not connected yet."}
          </li>
        )}
      </ul>
    </Card>
  );
}
