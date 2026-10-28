"use client";

import { useMemo } from "react";
import { formatCompact, formatMoney, formatPrice } from "@/lib/format";
import { usePreferences } from "@/stores/preferences";
import { useRatesData } from "./queries";

/** Currency-aware formatters bound to the user's selected currency (FR-04). */
export function useMoney() {
  const currency = usePreferences((s) => s.currency);
  const rates = useRatesData();
  return useMemo(
    () => ({
      currency,
      rates,
      price: (usd: number | null | undefined) => formatPrice(usd, currency, rates),
      compact: (usd: number | null | undefined) => formatCompact(usd, currency, rates),
      money: (usd: number | null | undefined) => formatMoney(usd, currency, rates),
    }),
    [currency, rates],
  );
}
