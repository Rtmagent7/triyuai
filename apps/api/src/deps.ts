import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import type { Deps } from "./app";
import { createChatService } from "./ai/chat";
import { createCache } from "./cache";
import { createDb } from "./db";
import type { Env } from "./env";
import { createLogger } from "./lib/logger";
import { createReporter } from "./lib/reporter";
import { createAuthService } from "./services/auth";
import { createChatHistoryService } from "./services/chats";
import { createCoinGecko } from "./services/coingecko";
import { createMarketService, prismaSnapshots } from "./services/market";
import { createPortfolioService } from "./services/portfolio";
import { createNewsService } from "./services/news";
import { createGoogleClient } from "./services/google";
import { createWatchlistService } from "./services/watchlist";

/** Wires real services from the environment. Tests build their own Deps. */
export async function buildDeps(env: Env): Promise<Deps> {
  const logger = createLogger(env.LOG_LEVEL, env.NODE_ENV === "development");
  const cache = createCache(env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN);
  const db = await createDb(env.DATABASE_URL);
  const coingecko = createCoinGecko({ apiKey: env.COINGECKO_API_KEY, cache });
  const market = createMarketService({
    cache,
    coingecko,
    snapshots: prismaSnapshots(db),
    logger,
    monthlyBudget: env.COINGECKO_MONTHLY_BUDGET,
    hasApiKey: !!env.COINGECKO_API_KEY,
  });

  // Groq first (fast, generous free tier), Gemini as fallback; either may be absent.
  const models = [
    ...(env.GROQ_API_KEY
      ? [{ name: "groq", model: createGroq({ apiKey: env.GROQ_API_KEY })(env.GROQ_MODEL) }]
      : []),
    ...(env.GOOGLE_GENERATIVE_AI_API_KEY
      ? [
          {
            name: "gemini",
            model: createGoogleGenerativeAI({ apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY })(
              env.GEMINI_MODEL,
            ),
          },
        ]
      : []),
  ];

  logger.info(
    {
      cache: env.UPSTASH_REDIS_REST_URL ? "upstash" : "memory",
      db: env.DATABASE_URL.startsWith("pglite:") ? "pglite" : "postgres",
      coingecko: env.COINGECKO_API_KEY ? "demo-key" : "keyless",
      ai: models.map((m) => m.name),
      google: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
      sentry: !!env.SENTRY_DSN,
    },
    "services configured",
  );

  const news = createNewsService({ cache, market, logger });
  const webOrigin = env.WEB_ORIGIN.split(",")[0]!.replace(/\/$/, "");
  const google =
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? createGoogleClient({
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
          // Through the web app's /api/v1 proxy, so the session cookies are first-party.
          redirectUri: `${webOrigin}/api/v1/auth/google/callback`,
        })
      : null;

  const reporter = await createReporter({
    dsn: env.SENTRY_DSN,
    environment: process.env.VERCEL_ENV ?? env.NODE_ENV,
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    logger,
  });

  return {
    env,
    logger,
    cache,
    market,
    auth: createAuthService({ db, cache, jwtSecret: env.JWT_SECRET }),
    watchlist: createWatchlistService(db),
    chat: createChatService({ market, news, models, logger }),
    history: createChatHistoryService(db),
    portfolio: createPortfolioService(db),
    news,
    google,
    reporter,
  };
}
