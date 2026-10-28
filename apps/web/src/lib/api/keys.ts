import type { ChartRange } from "@triyuai/shared";

export const queryKeys = {
  global: ["global"] as const,
  rates: ["rates"] as const,
  coins: (page: number) => ["coins", page] as const,
  coinsByIds: (ids: string[]) => ["coins", "ids", ...ids] as const,
  coin: (id: string) => ["coin", id] as const,
  chart: (id: string, range: ChartRange) => ["chart", id, range] as const,
  highlights: ["highlights"] as const,
  search: (q: string) => ["search", q] as const,
};
