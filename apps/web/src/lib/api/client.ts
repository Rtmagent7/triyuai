import type {
  ApiResponse,
  ChartData,
  ChartRange,
  ChatRequest,
  Coin,
  CoinDetail,
  CoinSummary,
  CoinsPage,
  GlobalStats,
  Highlights,
  Rates,
} from "@triyuai/shared";

import { ensureMocks } from "./mocking";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
  await ensureMocks();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { accept: "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: { code: string; message: string };
    } | null;
    throw new ApiRequestError(
      res.status,
      body?.error?.code ?? "HTTP_ERROR",
      body?.error?.message ?? res.statusText,
    );
  }
  return (await res.json()) as ApiResponse<T>;
}

/** Browser API client. In Phase 1 every call is answered by MSW (src/mocks). */
export const api = {
  global: () => request<GlobalStats>("/global"),
  rates: () => request<Rates>("/rates"),
  coins: (page = 1, perPage = 100) => request<CoinsPage>(`/coins?page=${page}&perPage=${perPage}`),
  coinsByIds: (ids: string[]) =>
    request<Coin[]>(`/coins?ids=${ids.map(encodeURIComponent).join(",")}`),
  coin: (id: string) => request<CoinDetail>(`/coins/${encodeURIComponent(id)}`),
  chart: (id: string, range: ChartRange) =>
    request<ChartData>(`/coins/${encodeURIComponent(id)}/chart?range=${range}`),
  highlights: () => request<Highlights>("/highlights"),
  search: (q: string) => request<CoinSummary[]>(`/search?q=${encodeURIComponent(q)}`),
  chat: async (body: ChatRequest, signal?: AbortSignal) => {
    await ensureMocks();
    return fetch(`${API_URL}/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "text/event-stream" },
      body: JSON.stringify(body),
      signal,
    });
  },
};
