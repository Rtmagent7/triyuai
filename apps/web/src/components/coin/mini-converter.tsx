"use client";

import { useState } from "react";
import type { CoinSummary } from "@triyuai/shared";
import { Converter } from "@/components/converter/converter";
import { usePreferences } from "@/stores/preferences";

export function MiniConverter({ coin }: { coin: CoinSummary }) {
  const currency = usePreferences((s) => s.currency);
  const [state, setState] = useState<{ from: string; to: string | null; amount: string }>({
    from: coin.id,
    to: null,
    amount: "1",
  });
  return (
    <section
      aria-labelledby="mini-converter-heading"
      className="border-border rounded-2xl border p-4 sm:p-5"
    >
      <h2 id="mini-converter-heading" className="mb-3 font-semibold">
        {coin.symbol} converter
      </h2>
      <Converter
        compact
        coins={[coin]}
        from={state.from}
        to={state.to ?? currency}
        amount={state.amount}
        onChange={(next) =>
          setState((s) => ({
            from: next.from ?? s.from,
            to: next.to ?? s.to ?? currency,
            amount: next.amount ?? s.amount,
          }))
        }
      />
    </section>
  );
}
