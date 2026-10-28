"use client";

import { ArrowLeftRight, ArrowUpDown } from "lucide-react";
import { useMemo } from "react";
import { currencies, type CoinSummary, type Rates } from "@triyuai/shared";
import { CoinLogo } from "@/components/coin/coin-logo";
import { useRatesData } from "@/hooks/queries";
import { currencyLabel, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export type Asset = { id: string; symbol: string; name: string; image?: string; usd: number };

const fiatNames = { usd: "US Dollar", idr: "Indonesian Rupiah", eur: "Euro" } as const;

export function buildAssets(coins: CoinSummary[], rates?: Rates): Asset[] {
  const fiats: Asset[] = currencies.map((c) => ({
    id: c,
    symbol: currencyLabel[c],
    name: fiatNames[c],
    usd: 1 / (rates?.[c] ?? 1),
  }));
  return [
    ...fiats,
    ...coins.map((c) => ({
      id: c.id,
      symbol: c.symbol,
      name: c.name,
      image: c.image,
      usd: c.price,
    })),
  ];
}

export function convert(amount: number, from: Asset, to: Asset) {
  return (amount * from.usd) / to.usd;
}

/** Up to 8 significant digits for tiny values, 2–6 decimals otherwise. */
export function formatAmount(n: number) {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs === 0) return "0";
  if (abs < 1) return formatNumber(n, { maximumSignificantDigits: 6 });
  return formatNumber(n, { maximumFractionDigits: abs >= 1000 ? 2 : 6 });
}

type Props = {
  coins: CoinSummary[];
  from: string;
  to: string;
  amount: string;
  onChange: (next: { from?: string; to?: string; amount?: string }) => void;
  compact?: boolean;
};

/** FR-14 / FR-27: coin ↔ fiat/coin converter. State is owned by the caller (URL or local). */
export function Converter({ coins, from, to, amount, onChange, compact }: Props) {
  const rates = useRatesData();
  const assets = useMemo(() => buildAssets(coins, rates), [coins, rates]);
  const fromAsset = assets.find((a) => a.id === from) ?? assets[3]!;
  const toAsset = assets.find((a) => a.id === to) ?? assets[0]!;
  const value = Number(amount.replace(/,/g, ""));
  const result = Number.isFinite(value) ? convert(value, fromAsset, toAsset) : NaN;
  const unit = convert(1, fromAsset, toAsset);

  return (
    <div className={cn("space-y-3", compact && "space-y-2")}>
      <div
        className={cn(
          "grid items-end gap-2",
          compact ? "grid-cols-1" : "sm:grid-cols-[1fr_auto_1fr]",
        )}
      >
        <Field label="From">
          <div className="border-border bg-bg focus-within:border-brand flex rounded-xl border">
            <input
              inputMode="decimal"
              aria-label="Amount"
              value={amount}
              onChange={(e) => onChange({ amount: e.target.value.replace(/[^0-9.,]/g, "") })}
              className="tabular h-11 min-w-0 flex-1 bg-transparent px-3 text-base font-medium outline-none"
            />
            <AssetSelect
              assets={assets}
              value={fromAsset.id}
              onChange={(id) => onChange({ from: id })}
              label="From asset"
            />
          </div>
        </Field>
        <button
          type="button"
          onClick={() => onChange({ from: toAsset.id, to: fromAsset.id })}
          aria-label="Swap currencies"
          className={cn(
            "border-border bg-surface text-muted hover:text-text mx-auto flex size-10 items-center justify-center rounded-full border",
            compact && "-my-1 size-8",
          )}
        >
          {compact ? (
            <ArrowUpDown className="size-4" />
          ) : (
            <ArrowLeftRight className="size-4 rotate-90 sm:rotate-0" />
          )}
        </button>
        <Field label="To">
          <div className="border-border bg-surface flex rounded-xl border">
            <output
              aria-live="polite"
              className="tabular flex h-11 min-w-0 flex-1 items-center truncate px-3 text-base font-medium"
            >
              {formatAmount(result)}
            </output>
            <AssetSelect
              assets={assets}
              value={toAsset.id}
              onChange={(id) => onChange({ to: id })}
              label="To asset"
            />
          </div>
        </Field>
      </div>
      <p className="text-muted tabular text-xs">
        1 {fromAsset.symbol} = {formatAmount(unit)} {toAsset.symbol}
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <span className="text-muted text-xs font-medium">{label}</span>
      {children}
    </div>
  );
}

function AssetSelect({
  assets,
  value,
  onChange,
  label,
}: {
  assets: Asset[];
  value: string;
  onChange: (id: string) => void;
  label: string;
}) {
  const current = assets.find((a) => a.id === value);
  return (
    <label className="border-border relative flex items-center gap-1.5 border-l pl-2.5 pr-2">
      {current?.image && <CoinLogo src={current.image} name={current.name} size={18} />}
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 max-w-28 cursor-pointer appearance-none bg-transparent pr-4 text-sm font-semibold outline-none"
      >
        <optgroup label="Fiat">
          {assets.slice(0, 3).map((a) => (
            <option key={a.id} value={a.id}>
              {a.symbol}
            </option>
          ))}
        </optgroup>
        <optgroup label="Crypto">
          {assets.slice(3).map((a) => (
            <option key={a.id} value={a.id}>
              {a.symbol} · {a.name}
            </option>
          ))}
        </optgroup>
      </select>
      <span aria-hidden className="text-muted pointer-events-none absolute right-2 text-[10px]">
        ▼
      </span>
    </label>
  );
}
