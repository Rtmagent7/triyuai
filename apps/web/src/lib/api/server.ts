import "server-only";
import type { ChartRange } from "@triyuai/shared";
import * as mock from "@/mocks/data";

/**
 * Server-side data access for Server Components (SSR/ISR). In Phase 1 it reads
 * the same fixture-backed functions MSW uses; in Phase 3 these become fetches
 * to the Express API with `next: { revalidate: 60 }`.
 */
export const serverApi = {
  global: async () => mock.getGlobal(),
  rates: async () => mock.getRates(),
  coins: async (page = 1, perPage = 100) => mock.getCoins(page, perPage),
  coin: (id: string) => mock.getCoinDetail(id),
  chart: (id: string, range: ChartRange) => mock.getChart(id, range),
  highlights: async () => mock.getHighlights(),
  topIds: (n: number) => mock.markets.slice(0, n).map((c) => c.id),
};

export { NotFoundError } from "@/mocks/data";
