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
  LoginInput,
  Rates,
  RegisterInput,
  User,
  ChatConversation,
  ChatThread,
} from "@triyuai/shared";
import type { Transaction, TransactionInput } from "@triyuai/shared/portfolio";
import type { NewsItem } from "@triyuai/shared/news";

import { ensureMocks } from "./mocking";

/** Same-origin by default: Next.js proxies /api/v1 to the Express API, so auth cookies are first-party. */
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

export type Me = User & { watchlist: string[] };

/** Non-secret cookie set next to the httpOnly session cookies; guests skip /auth/me entirely. */
export const hasSessionHint = () =>
  typeof document !== "undefined" && /(?:^|;s*)triyu_session=/.test(document.cookie);

let refreshing: Promise<boolean> | null = null;

/** Rotates the refresh token once for any number of concurrent 401s. */
function refreshSession(): Promise<boolean> {
  refreshing ??= fetch(`${API_URL}/auth/refresh`, { method: "POST", credentials: "include" })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

async function request<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
  retried = false,
): Promise<ApiResponse<T>> {
  await ensureMocks();
  const { json, ...rest } = init ?? {};
  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    credentials: "include",
    headers: {
      accept: "application/json",
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...rest.headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  // Access tokens last 15 minutes; refresh silently and retry once.
  if (res.status === 401 && !retried && !path.startsWith("/auth/") && (await refreshSession())) {
    return request<T>(path, init, true);
  }
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
  if (res.status === 204)
    return { data: undefined as T, meta: { fetchedAt: "", source: "database", stale: false } };
  return (await res.json()) as ApiResponse<T>;
}

const post = <T>(path: string, json?: unknown) =>
  request<T>(path, { method: "POST", json: json ?? {} });

/** Browser API client. With NEXT_PUBLIC_API_MOCKING enabled every call is answered by MSW (src/mocks). */
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

  auth: {
    me: async (): Promise<Me | null> => {
      if (!hasSessionHint()) return null;
      try {
        return (await request<Me>("/auth/me")).data;
      } catch (err) {
        // Signed out, or the access token expired: try one refresh before giving up.
        if (err instanceof ApiRequestError && err.status === 401) {
          return (await refreshSession()) ? (await request<Me>("/auth/me")).data : null;
        }
        throw err;
      }
    },
    register: (input: RegisterInput) => post<User>("/auth/register", input),
    login: (input: LoginInput) => post<User>("/auth/login", input),
    demo: () => post<User>("/auth/demo"),
    logout: () => post<void>("/auth/logout"),
  },

  watchlist: {
    list: () => request<string[]>("/watchlist"),
    add: (coinId: string) => post<string[]>("/watchlist", { coinId }),
    remove: (coinId: string) =>
      request<string[]>(`/watchlist/${encodeURIComponent(coinId)}`, { method: "DELETE" }),
    merge: (coinIds: string[]) => post<string[]>("/watchlist/merge", { coinIds }),
  },

  news: (coin?: string) =>
    request<NewsItem[]>(coin ? `/news?coin=${encodeURIComponent(coin)}` : "/news"),

  /** Portfolio tracker (P2): the signed-in user's transactions. */
  portfolio: {
    list: () => request<Transaction[]>("/portfolio/transactions"),
    add: (input: TransactionInput) => post<Transaction[]>("/portfolio/transactions", input),
    remove: (id: string) =>
      request<Transaction[]>(`/portfolio/transactions/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
  },

  /** Saved Ask TRIYU conversations of the signed-in user (FR-24). */
  chats: {
    list: () => request<ChatConversation[]>("/chats"),
    get: (id: string) => request<ChatThread>(`/chats/${encodeURIComponent(id)}`),
    remove: (id: string) => request<void>(`/chats/${encodeURIComponent(id)}`, { method: "DELETE" }),
  },

  chat: async (body: ChatRequest, signal?: AbortSignal) => {
    await ensureMocks();
    return fetch(`${API_URL}/ai/chat`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", accept: "text/event-stream" },
      body: JSON.stringify(body),
      signal,
    });
  },
};
