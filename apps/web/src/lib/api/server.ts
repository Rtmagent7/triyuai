import "server-only";
import type {
  ApiResponse,
  ChartData,
  ChartRange,
  CoinDetail,
  CoinsPage,
  Exchange,
  GlobalStats,
  Highlights,
  Rates,
} from "@triyuai/shared";
import { NotFoundError } from "./errors";
import { mockingEnabled } from "./mocking";

/** Express API origin (server-only). The browser reaches it through the /api/v1 rewrite. */
const API_ORIGIN = process.env.API_ORIGIN ?? "http://localhost:4000";

async function get<T>(path: string, revalidate = 60): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_ORIGIN}/api/v1${path}`, {
    next: { revalidate },
    headers: {
      accept: "application/json",
      // Server-rendered pages share one IP; this key exempts them from the per-IP rate limit.
      ...(process.env.INTERNAL_API_KEY ? { "x-internal-key": process.env.INTERNAL_API_KEY } : {}),
    },
  });
  if (res.status === 404) throw new NotFoundError(path);
  if (!res.ok) throw new Error(`API responded ${res.status} for ${path}`);
  return (await res.json()) as ApiResponse<T>;
}

const mock = () => import("@/mocks/data");

/**
 * Server-side data access for Server Components (SSR/ISR). In prototype mode it reads
 * the same fixture-backed functions MSW uses; otherwise it calls the Express API.
 */
export const serverApi = {
  global: async (): Promise<ApiResponse<GlobalStats>> =>
    mockingEnabled ? (await mock()).getGlobal() : get("/global"),
  exchanges: async (): Promise<ApiResponse<Exchange[]>> =>
    mockingEnabled ? (await mock()).getExchanges() : get("/exchanges", 600),
  rates: async (): Promise<ApiResponse<Rates>> =>
    mockingEnabled ? (await mock()).getRates() : get("/rates", 3600),
  coins: async (page = 1, perPage = 100): Promise<ApiResponse<CoinsPage>> =>
    mockingEnabled
      ? (await mock()).getCoins(page, perPage)
      : get(`/coins?page=${page}&perPage=${perPage}`),
  coin: async (id: string): Promise<ApiResponse<CoinDetail>> =>
    mockingEnabled ? (await mock()).getCoinDetail(id) : get(`/coins/${encodeURIComponent(id)}`),
  chart: async (id: string, range: ChartRange): Promise<ApiResponse<ChartData>> =>
    mockingEnabled
      ? (await mock()).getChart(id, range)
      : get(`/coins/${encodeURIComponent(id)}/chart?range=${range}`),
  highlights: async (): Promise<ApiResponse<Highlights>> =>
    mockingEnabled ? (await mock()).getHighlights() : get("/highlights"),
  /** Coin ids to pre-render at build time; none if the API is unreachable (pages render on demand). */
  topIds: async (n: number): Promise<string[]> => {
    if (mockingEnabled) return (await mock()).markets.slice(0, n).map((c) => c.id);
    return get<CoinsPage>(`/coins?page=1&perPage=${n}`)
      .then((r) => r.data.coins.map((c) => c.id))
      .catch(() => []);
  },
};

export { NotFoundError };
