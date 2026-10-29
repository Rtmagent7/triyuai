import type { Cache } from "../cache";
import { NotFoundError, UpstreamError } from "../lib/errors";

const BASE = "https://api.coingecko.com/api/v3";

export const usageKey = (d = new Date()) => `usage:coingecko:${d.toISOString().slice(0, 7)}`;

export type CoinGeckoClient = {
  get<T>(path: string, params?: Record<string, string | number | boolean>): Promise<T>;
};

/**
 * Thin CoinGecko client. Every upstream call increments the monthly usage counter
 * (PRD §11) so the market service can stretch cache TTLs near the quota.
 */
export function createCoinGecko(opts: {
  apiKey?: string;
  cache: Cache;
  fetch?: typeof fetch;
  timeoutMs?: number;
}): CoinGeckoClient {
  const doFetch = opts.fetch ?? fetch;
  return {
    async get<T>(path: string, params: Record<string, string | number | boolean> = {}) {
      const url = new URL(BASE + path);
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
      await opts.cache.incr(usageKey(), 35 * 86_400);

      let res: Response;
      try {
        res = await doFetch(url, {
          headers: {
            accept: "application/json",
            ...(opts.apiKey ? { "x-cg-demo-api-key": opts.apiKey } : {}),
          },
          signal: AbortSignal.timeout(opts.timeoutMs ?? 8_000),
        });
      } catch {
        throw new UpstreamError(0);
      }
      if (res.status === 404) throw new NotFoundError("Coin not found");
      if (!res.ok) throw new UpstreamError(res.status);
      return (await res.json()) as T;
    },
  };
}
