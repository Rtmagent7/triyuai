import type { Currency, Rates } from "@triyuai/shared";

const LOCALE = "en-US";

const cache = new Map<string, Intl.NumberFormat>();
function nf(key: string, options: Intl.NumberFormatOptions) {
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(LOCALE, options);
    cache.set(key, f);
  }
  return f;
}

export const toCurrency = (usd: number, currency: Currency, rates?: Rates) =>
  usd * (rates?.[currency] ?? 1);

/** Price with precision that adapts to magnitude: $67,123.45 · $0.4521 · $0.00001234 */
export function formatPrice(
  usd: number | null | undefined,
  currency: Currency = "usd",
  rates?: Rates,
) {
  if (usd == null || !Number.isFinite(usd)) return "—";
  const v = toCurrency(usd, currency, rates);
  const abs = Math.abs(v);
  let options: Intl.NumberFormatOptions;
  if (currency === "idr" && abs >= 100) {
    options = { minimumFractionDigits: 0, maximumFractionDigits: 0 };
  } else if (abs >= 1) {
    options = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  } else if (abs === 0) {
    options = { maximumFractionDigits: 2 };
  } else {
    options = { maximumSignificantDigits: 4 };
  }
  const key = `price:${currency}:${JSON.stringify(options)}`;
  return nf(key, {
    style: "currency",
    currency: currency.toUpperCase(),
    currencyDisplay: "narrowSymbol",
    ...options,
  }).format(v);
}

/** Large values in compact notation: $1.62T, Rp25.9Q */
export function formatCompact(
  usd: number | null | undefined,
  currency: Currency = "usd",
  rates?: Rates,
) {
  if (usd == null || !Number.isFinite(usd)) return "—";
  return nf(`compact:${currency}`, {
    style: "currency",
    currency: currency.toUpperCase(),
    currencyDisplay: "narrowSymbol",
    notation: "compact",
    // Explicit minimum: older ICU (Node 22 on Vercel) pads currency to 2 decimals ("$1.00B")
    // while browsers don't ("$1B"), which breaks hydration.
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(toCurrency(usd, currency, rates));
}

/** Full-precision money for stat grids: $1,623,456,789 */
export function formatMoney(
  usd: number | null | undefined,
  currency: Currency = "usd",
  rates?: Rates,
) {
  if (usd == null || !Number.isFinite(usd)) return "—";
  return nf(`money:${currency}`, {
    style: "currency",
    currency: currency.toUpperCase(),
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(toCurrency(usd, currency, rates));
}

/** Absolute percentage; direction is conveyed by the ▲/▼ icon in PercentBadge. */
export function formatPercent(n: number | null | undefined, digits = 2) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${nf(`pct:${digits}`, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Math.abs(n))}%`;
}

export function formatSignedPercent(n: number | null | undefined, digits = 2) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n >= 0 ? "+" : "−"}${formatPercent(n, digits)}`;
}

export function formatNumber(n: number | null | undefined, options: Intl.NumberFormatOptions = {}) {
  if (n == null || !Number.isFinite(n)) return "—";
  return nf(`num:${JSON.stringify(options)}`, { maximumFractionDigits: 0, ...options }).format(n);
}

export function formatCompactNumber(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return nf("cnum", { notation: "compact", maximumFractionDigits: 2 }).format(n);
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(LOCALE, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function timeAgo(iso: string, now = Date.now()) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}

export const currencyLabel: Record<Currency, string> = { usd: "USD", idr: "IDR", eur: "EUR" };
export const currencySymbol: Record<Currency, string> = { usd: "$", idr: "Rp", eur: "€" };
