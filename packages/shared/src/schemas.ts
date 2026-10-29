import { z } from "zod";
import { WATCHLIST_MAX, chartRanges, chatToolNames, currencies } from "./constants";

/**
 * API contract for TRIYUAI (PRD §13). Prices are always in USD;
 * the frontend converts to IDR/EUR with `Rates`.
 */

export const metaSchema = z.object({
  fetchedAt: z.string(),
  source: z.enum(["coingecko", "snapshot", "mock", "database"]),
  stale: z.boolean(),
});
export type Meta = z.infer<typeof metaSchema>;

export const apiResponse = <T extends z.ZodTypeAny>(data: T) =>
  z.object({ data, meta: metaSchema });

export type ApiResponse<T> = { data: T; meta: Meta };

export const apiErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

export const coinSummarySchema = z.object({
  id: z.string(),
  symbol: z.string(),
  name: z.string(),
  image: z.string(),
  rank: z.number().nullable(),
  price: z.number(),
  change24h: z.number().nullable(),
});
export type CoinSummary = z.infer<typeof coinSummarySchema>;

export const coinSchema = coinSummarySchema.extend({
  change1h: z.number().nullable(),
  change7d: z.number().nullable(),
  marketCap: z.number(),
  volume24h: z.number(),
  high24h: z.number().nullable(),
  low24h: z.number().nullable(),
  circulatingSupply: z.number().nullable(),
  totalSupply: z.number().nullable(),
  maxSupply: z.number().nullable(),
  fdv: z.number().nullable(),
  ath: z.number().nullable(),
  athDate: z.string().nullable(),
  athChangePct: z.number().nullable(),
  atl: z.number().nullable(),
  atlDate: z.string().nullable(),
  atlChangePct: z.number().nullable(),
  sparkline7d: z.array(z.number()),
});
export type Coin = z.infer<typeof coinSchema>;

export const coinLinksSchema = z.object({
  homepage: z.string().nullable(),
  whitepaper: z.string().nullable(),
  explorers: z.array(z.string()),
  twitter: z.string().nullable(),
  reddit: z.string().nullable(),
  github: z.string().nullable(),
});
export type CoinLinks = z.infer<typeof coinLinksSchema>;

export const coinDetailSchema = coinSchema.extend({
  description: z.string(),
  links: coinLinksSchema,
  categories: z.array(z.string()),
  genesisDate: z.string().nullable(),
  /** false when only market data is available for this coin. */
  hasFullDetail: z.boolean(),
});
export type CoinDetail = z.infer<typeof coinDetailSchema>;

export const globalStatsSchema = z.object({
  totalMarketCap: z.number(),
  marketCapChange24h: z.number(),
  totalVolume24h: z.number(),
  btcDominance: z.number(),
  ethDominance: z.number(),
  activeCoins: z.number(),
  updatedAt: z.string(),
});
export type GlobalStats = z.infer<typeof globalStatsSchema>;

export const highlightsSchema = z.object({
  trending: z.array(coinSummarySchema),
  gainers: z.array(coinSummarySchema),
  losers: z.array(coinSummarySchema),
  highestVolume: z.array(coinSummarySchema.extend({ volume24h: z.number() })),
});
export type Highlights = z.infer<typeof highlightsSchema>;

export const chartRangeSchema = z.enum(chartRanges);
export type ChartRange = z.infer<typeof chartRangeSchema>;

export const chartTypeSchema = z.enum(["line", "ohlc"]);
export type ChartType = z.infer<typeof chartTypeSchema>;

/** `time` is a UNIX timestamp in seconds. */
export const linePointSchema = z.object({ time: z.number(), value: z.number() });
export type LinePoint = z.infer<typeof linePointSchema>;

export const ohlcPointSchema = z.object({
  time: z.number(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
});
export type OhlcPoint = z.infer<typeof ohlcPointSchema>;

export const chartDataSchema = z.object({
  range: chartRangeSchema,
  line: z.array(linePointSchema),
  ohlc: z.array(ohlcPointSchema),
  /** true when the series was synthesised from the 7d sparkline (no detail fixture). */
  simulated: z.boolean(),
});
export type ChartData = z.infer<typeof chartDataSchema>;

export const currencySchema = z.enum(currencies);
export type Currency = z.infer<typeof currencySchema>;

export const ratesSchema = z.object({ usd: z.number(), idr: z.number(), eur: z.number() });
export type Rates = z.infer<typeof ratesSchema>;

export const coinsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(3).default(1),
  perPage: z.coerce.number().int().min(1).max(250).default(100),
});
export type CoinsQuery = z.infer<typeof coinsQuerySchema>;

export const coinsPageSchema = z.object({
  coins: z.array(coinSchema),
  page: z.number(),
  perPage: z.number(),
  total: z.number(),
});
export type CoinsPage = z.infer<typeof coinsPageSchema>;

/* ---------- Ask TRIYU chatbot ---------- */

export const chatRoleSchema = z.enum(["user", "assistant"]);
export const chatRequestSchema = z.object({
  messages: z
    .array(z.object({ role: chatRoleSchema, content: z.string().max(2000) }))
    .min(1)
    .max(10),
  context: z.object({ coinId: z.string() }).optional(),
});
export type ChatRequest = z.infer<typeof chatRequestSchema>;

export type ChatToolName = (typeof chatToolNames)[number];

/** One event per SSE `data:` line on POST /api/v1/ai/chat. */
export const chatStreamEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("tool-call"),
    id: z.string(),
    name: z.enum(chatToolNames),
    label: z.string(),
  }),
  z.object({ type: z.literal("tool-result"), id: z.string() }),
  z.object({ type: z.literal("text-delta"), delta: z.string() }),
  z.object({ type: z.literal("finish"), fetchedAt: z.string() }),
  z.object({ type: z.literal("error"), code: z.string(), message: z.string() }),
]);
export type ChatStreamEvent = z.infer<typeof chatStreamEventSchema>;

/* ---------- Accounts & watchlist (Phase 3) ---------- */

/** CoinGecko ids: lowercase letters, digits and dashes. */
export const coinIdSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,99}$/, "Invalid coin id");

export const passwordSchema = z
  .string()
  .min(8, "At least 8 characters")
  .max(128, "At most 128 characters")
  .regex(/[a-z]/, "Add a lowercase letter")
  .regex(/[A-Z]/, "Add an uppercase letter")
  .regex(/\d/, "Add a number");

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(50),
  email: z.email("Enter a valid email").max(254).transform((e) => e.toLowerCase()),
  password: passwordSchema,
});
export type RegisterInput = z.input<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.email("Enter a valid email").max(254).transform((e) => e.toLowerCase()),
  password: z.string().min(1, "Enter your password").max(128),
});
export type LoginInput = z.input<typeof loginSchema>;

export const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  isDemo: z.boolean(),
});
export type User = z.infer<typeof userSchema>;

export const watchlistSchema = z.array(coinIdSchema);
export const watchlistMergeSchema = z.object({
  coinIds: z.array(coinIdSchema).max(WATCHLIST_MAX),
});
