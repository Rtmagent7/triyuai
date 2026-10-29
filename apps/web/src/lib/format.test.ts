import { describe, expect, it } from "vitest";
import {
  formatCompact,
  formatCompactNumber,
  formatDate,
  formatMoney,
  formatNumber,
  formatPercent,
  formatPrice,
  formatSignedPercent,
  timeAgo,
  toCurrency,
} from "./format";

const rates = { usd: 1, idr: 16_000, eur: 0.9 };
/** Intl separates "Rp" with a no-break space. */
const nbsp = (s: string) => s.replace(/ /g, "\u00a0");

describe("formatPrice", () => {
  it("uses 2 decimals for values ≥ 1", () => {
    expect(formatPrice(67123.456)).toBe("$67,123.46");
    expect(formatPrice(1)).toBe("$1.00");
  });

  it("keeps 4 significant digits for sub-dollar prices", () => {
    expect(formatPrice(0.45213)).toBe("$0.4521");
    expect(formatPrice(0.00001234567)).toBe("$0.00001235");
  });

  it("converts to the selected currency", () => {
    expect(formatPrice(2, "eur", rates)).toBe("€1.80");
    expect(formatPrice(100, "idr", rates)).toBe(nbsp("Rp 1,600,000"));
  });

  it("drops IDR decimals for large amounts but keeps them for tiny ones", () => {
    expect(formatPrice(0.001, "idr", rates)).toBe(nbsp("Rp 16.00"));
    expect(formatPrice(0.000001, "idr", rates)).toBe(nbsp("Rp 0.016"));
  });

  it("renders a dash for missing values", () => {
    expect(formatPrice(null)).toBe("—");
    expect(formatPrice(undefined)).toBe("—");
    expect(formatPrice(Number.NaN)).toBe("—");
  });

  it("handles zero", () => {
    expect(formatPrice(0)).toBe("$0.00");
  });
});

describe("formatCompact", () => {
  it("uses compact notation without padding zeros (hydration-safe)", () => {
    expect(formatCompact(1_620_000_000_000)).toBe("$1.62T");
    expect(formatCompact(1_000_000_000)).toBe("$1B");
    expect(formatCompact(42_400_000_000)).toBe("$42.4B");
  });

  it("converts currencies", () => {
    expect(formatCompact(1_000_000_000, "eur", rates)).toBe("€900M");
  });

  it("renders a dash for missing values", () => {
    expect(formatCompact(null)).toBe("—");
  });
});

describe("formatMoney", () => {
  it("prints whole units", () => {
    expect(formatMoney(1_623_456_789.9)).toBe("$1,623,456,790");
    expect(formatMoney(undefined)).toBe("—");
  });
});

describe("percentages", () => {
  it("formats the absolute value (direction comes from the ▲/▼ icon)", () => {
    expect(formatPercent(-2.345)).toBe("2.35%");
    expect(formatPercent(12, 1)).toBe("12.0%");
    expect(formatPercent(null)).toBe("—");
  });

  it("adds an explicit sign when asked", () => {
    expect(formatSignedPercent(3.2)).toBe("+3.20%");
    expect(formatSignedPercent(-3.2)).toBe("−3.20%");
    expect(formatSignedPercent(0)).toBe("+0.00%");
    expect(formatSignedPercent(undefined)).toBe("—");
  });
});

describe("numbers and dates", () => {
  it("formats plain and compact numbers", () => {
    expect(formatNumber(22557)).toBe("22,557");
    expect(formatNumber(1.23456, { maximumFractionDigits: 2 })).toBe("1.23");
    expect(formatNumber(null)).toBe("—");
    expect(formatCompactNumber(589_930_000)).toBe("589.93M");
    expect(formatCompactNumber(undefined)).toBe("—");
  });

  it("formats dates in en-US", () => {
    expect(formatDate("2025-01-19T12:00:00.000Z")).toBe("Jan 19, 2025");
    expect(formatDate(null)).toBe("—");
  });

  it("describes elapsed time", () => {
    const now = Date.parse("2026-10-29T12:00:00Z");
    expect(timeAgo("2026-10-29T11:59:30Z", now)).toBe("just now");
    expect(timeAgo("2026-10-29T11:53:00Z", now)).toBe("7 min ago");
    expect(timeAgo("2026-10-29T09:00:00Z", now)).toBe("3 h ago");
    expect(timeAgo("2026-10-25T12:00:00Z", now)).toBe("4 days ago");
    expect(timeAgo("2026-10-29T12:05:00Z", now)).toBe("just now");
  });

  it("converts USD with rates, defaulting to 1", () => {
    expect(toCurrency(10, "idr", rates)).toBe(160_000);
    expect(toCurrency(10, "eur")).toBe(10);
  });
});
