import type { ApiResponse } from "@triyuai/shared";
import { NEWS_SOURCES, mergeNews, parseRss, type NewsItem } from "@triyuai/shared/news";
import type { Cache } from "../cache";
import { AppError } from "../lib/errors";
import type { Logger } from "../lib/logger";
import type { MarketService } from "./market";

export const NEWS_TTL = 600;
/** The last good list, served (marked stale) if every feed fails. */
const LAST_GOOD_TTL = 7 * 86_400;
const UA = "Mozilla/5.0 (compatible; TRIYUAI news reader; +https://triyuai.vercel.app)";

export type NewsService = ReturnType<typeof createNewsService>;

type Cached = { items: NewsItem[]; fetchedAt: string };

/** Crypto news from public RSS feeds, merged, de-duplicated and tagged with coins (P2). */
export function createNewsService(deps: {
  cache: Cache;
  market: MarketService;
  logger: Logger;
  fetch?: typeof fetch;
}) {
  const get = deps.fetch ?? fetch;
  let inflight: Promise<Cached> | null = null;

  async function load(): Promise<Cached> {
    const feeds = await Promise.all(
      NEWS_SOURCES.map(async (s) => {
        try {
          const res = await get(s.feed, {
            headers: { "user-agent": UA, accept: "application/rss+xml, application/xml, text/xml" },
            signal: AbortSignal.timeout(8_000),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return parseRss(await res.text(), s.id);
        } catch (err) {
          deps.logger.warn({ err, source: s.id }, "news feed failed");
          return [];
        }
      }),
    );
    if (feeds.every((f) => f.length === 0))
      throw new AppError(502, "UPSTREAM_ERROR", "No news feed responded");
    const top = await deps.market.markets().catch(() => null);
    const coins = (top?.data ?? []).slice(0, 100);
    const fresh = { items: mergeNews(feeds, coins), fetchedAt: new Date().toISOString() };
    await Promise.all([
      deps.cache.set("news:all", fresh, NEWS_TTL),
      deps.cache.set("news:last", fresh, LAST_GOOD_TTL),
    ]);
    return fresh;
  }

  return {
    async list(coinId?: string): Promise<ApiResponse<NewsItem[]>> {
      let data = await deps.cache.get<Cached>("news:all");
      let stale = false;
      if (!data) {
        // Concurrent misses share one round of feed requests.
        inflight ??= load().finally(() => (inflight = null));
        try {
          data = await inflight;
        } catch (err) {
          data = await deps.cache.get<Cached>("news:last");
          if (!data) throw err;
          stale = true;
        }
      }
      const items = coinId ? data.items.filter((n) => n.coins.includes(coinId)) : data.items;
      return { data: items, meta: { fetchedAt: data.fetchedAt, source: "rss", stale } };
    },
  };
}
