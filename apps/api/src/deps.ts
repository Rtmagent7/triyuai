import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import type { Deps } from "./app";
import { createChatService } from "./ai/chat";
import { createCache } from "./cache";
import { createDb } from "./db";
import type { Env } from "./env";
import { createLogger } from "./lib/logger";
import { createAuthService } from "./services/auth";
import { createCoinGecko } from "./services/coingecko";
import { createMarketService, prismaSnapshots } from "./services/market";
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
    },
    "services configured",
  );

  return {
    env,
    logger,
    cache,
    market,
    auth: createAuthService({ db, cache, jwtSecret: env.JWT_SECRET }),
    watchlist: createWatchlistService(db),
    chat: createChatService({ market, models, logger }),
  };
}
