import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { handlers } from "@/mocks/handlers";
import { fearGreedSnapshot } from "@/lib/market/fear-greed";

const NOW = 1_793_318_400;
const FAPI = "https://fapi.binance.com";

/** A gentle wave around `base`, one bar per `step` seconds, oldest first. */
export function fakeFuturesKlines(base: number, step: number, limit: number) {
  return Array.from({ length: limit }, (_, i) => {
    const t = NOW - (limit - 1 - i) * step;
    const mid = base * (1 + 0.03 * Math.sin(i / 12));
    return [
      t * 1000,
      String(mid * 0.999),
      String(mid * 1.004),
      String(mid * 0.996),
      String(mid),
      "120",
    ];
  });
}

/** Third-party feeds the browser calls directly; never mocked in the app itself, so they stay live. */
const external = [
  http.get("https://api.alternative.me/fng/", () =>
    HttpResponse.json({
      data: fearGreedSnapshot.map((p) => ({
        value: String(p.value),
        value_classification: p.label,
        timestamp: String(p.time),
      })),
    }),
  ),
  http.get(`${FAPI}/fapi/v1/klines`, ({ request }) => {
    const q = new URL(request.url).searchParams;
    const base = q.get("symbol")?.startsWith("BTC") ? 80_000 : 2_400;
    return HttpResponse.json(fakeFuturesKlines(base, 3600, Number(q.get("limit") ?? 100)));
  }),
  http.get(`${FAPI}/futures/data/openInterestHist`, ({ request }) => {
    const limit = Number(new URL(request.url).searchParams.get("limit") ?? 100);
    return HttpResponse.json(
      Array.from({ length: limit }, (_, i) => ({
        sumOpenInterestValue: String(7e9 + i * 2e7 * (i % 3 ? 1 : -0.5)),
        timestamp: (NOW - (limit - 1 - i) * 3600) * 1000,
      })),
    );
  }),
  http.get(`${FAPI}/fapi/v1/premiumIndex`, () =>
    HttpResponse.json([
      {
        symbol: "BTCUSDT",
        markPrice: "80000",
        lastFundingRate: "0.0001",
        nextFundingTime: (NOW + 7200) * 1000,
      },
      {
        symbol: "ETHUSDT",
        markPrice: "2400",
        lastFundingRate: "-0.00005",
        nextFundingTime: (NOW + 7200) * 1000,
      },
    ]),
  ),
  http.get(`${FAPI}/fapi/v1/openInterest`, () => HttpResponse.json({ openInterest: "90000" })),
  http.get(`${FAPI}/futures/data/globalLongShortAccountRatio`, () =>
    HttpResponse.json([{ longShortRatio: "3" }]),
  ),
];

/** Same handlers as the browser mock, so tests exercise the real API contract. */
export const server = setupServer(...handlers, ...external);
