/**
 * Zod-free constants for client bundles. Importing these from "@triyuai/shared/constants"
 * keeps the schema library out of pages that only need the values.
 */
export const currencies = ["usd", "idr", "eur"] as const;
export const chartRanges = ["24h", "7d", "1m", "3m", "1y", "max"] as const;
export const chatToolNames = [
  "getMarketOverview",
  "getCoinDetails",
  "getTopMovers",
  "searchCoin",
  "compareCoins",
  "getSentiment",
  "getSectorPerformance",
  "getNews",
] as const;

export const GUEST_DAILY_CHAT_QUOTA = 10;
export const USER_DAILY_CHAT_QUOTA = 30;
export const CHAT_CONTEXT_MESSAGES = 10;
export const WATCHLIST_MAX = 100;
