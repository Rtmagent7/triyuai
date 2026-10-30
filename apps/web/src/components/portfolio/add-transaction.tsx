"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { CoinSummary } from "@triyuai/shared";
import { transactionInputSchema, type TransactionType } from "@triyuai/shared/portfolio";
import { CoinLogo } from "@/components/coin/coin-logo";
import { Button } from "@/components/ui/button";
import { useSearch } from "@/hooks/queries";
import { useDebounce } from "@/hooks/use-debounce";
import { useMoney } from "@/hooks/use-money";
import { api } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/keys";
import { currencyLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

const today = () => new Date().toISOString().slice(0, 10);
const inputCls =
  "border-border bg-surface placeholder:text-muted focus:border-brand h-9 w-full rounded-lg border px-3 text-sm outline-none";

/** Records a buy or sell. The price is entered in the currency being viewed and stored in USD. */
export function AddTransaction({ onDone }: { onDone?: () => void }) {
  const money = useMoney();
  const qc = useQueryClient();
  const [coin, setCoin] = useState<CoinSummary | null>(null);
  const [q, setQ] = useState("");
  const [type, setType] = useState<TransactionType>("buy");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const results = useSearch(useDebounce(q)).data?.data;
  const rate = money.rates?.[money.currency] ?? 1;

  const save = useMutation({
    mutationFn: api.portfolio.add,
    onSuccess: (res) => {
      qc.setQueryData(queryKeys.portfolio, res);
      setQuantity("");
      setNote("");
      onDone?.();
    },
    onError: (e: Error) => setError(e.message),
  });

  const pick = (c: CoinSummary) => {
    setCoin(c);
    setQ("");
    // Today's price as a starting point, in the viewed currency.
    setPrice(String(Number((c.price * rate).toPrecision(8))));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!coin) return setError("Choose a coin first.");
    const parsed = transactionInputSchema.safeParse({
      coinId: coin.id,
      type,
      quantity: Number(quantity),
      priceUsd: Number(price) / rate,
      // Noon UTC keeps the chosen calendar day in every time zone.
      date: date === today() ? new Date().toISOString() : `${date}T12:00:00.000Z`,
      note: note || undefined,
    });
    if (!parsed.success) return setError(parsed.error.issues[0]!.message);
    save.mutate(parsed.data);
  };

  return (
    <form onSubmit={submit} className="space-y-4" aria-label="Add transaction">
      <div role="radiogroup" aria-label="Type" className="border-border inline-flex border-b">
        {(["buy", "sell"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={type === t}
            onClick={() => setType(t)}
            className={cn(
              "relative px-3 py-1.5 text-sm font-medium capitalize",
              type === t
                ? "text-text after:bg-brand after:absolute after:inset-x-3 after:-bottom-px after:h-px"
                : "text-muted hover:text-text",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="relative">
        <label htmlFor="tx-coin" className="mb-1.5 block text-sm font-medium">
          Coin
        </label>
        {coin ? (
          <div className="border-border flex h-9 items-center gap-2 rounded-lg border px-3 text-sm">
            <CoinLogo src={coin.image} name={coin.name} size={18} />
            <span className="font-medium">{coin.name}</span>
            <span className="text-muted text-xs">{coin.symbol.toUpperCase()}</span>
            <button
              type="button"
              onClick={() => setCoin(null)}
              className="text-brand ml-auto text-xs hover:underline"
            >
              Change
            </button>
          </div>
        ) : (
          <>
            <input
              id="tx-coin"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search a coin…"
              autoComplete="off"
              className={inputCls}
            />
            {q && results && results.length > 0 && (
              <ul className="border-border bg-bg absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-lg border shadow-lg">
                {results.slice(0, 6).map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => pick(c)}
                      className="hover:bg-surface flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
                    >
                      <CoinLogo src={c.image} name={c.name} size={18} />
                      {c.name}
                      <span className="text-muted text-xs">{c.symbol.toUpperCase()}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="tx-qty" className="mb-1.5 block text-sm font-medium">
            Quantity
          </label>
          <input
            id="tx-qty"
            inputMode="decimal"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value.replace(",", "."))}
            placeholder="0.5"
            className={cn(inputCls, "tabular")}
          />
        </div>
        <div>
          <label htmlFor="tx-price" className="mb-1.5 block text-sm font-medium">
            Price per coin ({currencyLabel[money.currency]})
          </label>
          <input
            id="tx-price"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value.replace(",", "."))}
            className={cn(inputCls, "tabular")}
          />
        </div>
        <div>
          <label htmlFor="tx-date" className="mb-1.5 block text-sm font-medium">
            Date
          </label>
          <input
            id="tx-date"
            type="date"
            value={date}
            max={today()}
            onChange={(e) => setDate(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="tx-note" className="mb-1.5 block text-sm font-medium">
            Note <span className="text-muted font-normal">(optional)</span>
          </label>
          <input
            id="tx-note"
            value={note}
            maxLength={140}
            onChange={(e) => setNote(e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      {quantity && price && Number(quantity) > 0 && (
        <p className="text-muted text-sm">
          Total{" "}
          <span className="text-text tabular font-medium">
            {money.money((Number(quantity) * Number(price)) / rate)}
          </span>
        </p>
      )}
      {error && (
        <p role="alert" className="text-down text-sm">
          {error}
        </p>
      )}
      <Button type="submit" disabled={save.isPending}>
        {save.isPending ? "Saving…" : type === "buy" ? "Add buy" : "Add sell"}
      </Button>
    </form>
  );
}
