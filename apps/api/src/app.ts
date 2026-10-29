import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import type { ChatService } from "./ai/chat";
import type { Cache } from "./cache";
import type { Env } from "./env";
import type { Logger } from "./lib/logger";
import { errorHandler, notFound, optionalUser, rateLimit } from "./middleware";
import { buildOpenApi, swaggerHtml, swaggerInit } from "./openapi";
import { aiRoutes } from "./routes/ai";
import { authRoutes } from "./routes/auth";
import { marketRoutes } from "./routes/market";
import { watchlistRoutes } from "./routes/watchlist";
import type { AuthService } from "./services/auth";
import type { MarketService } from "./services/market";
import type { WatchlistService } from "./services/watchlist";

export const VERSION = "0.3.0";

export type Deps = {
  env: Env;
  logger: Logger;
  cache: Cache;
  market: MarketService;
  auth: AuthService;
  watchlist: WatchlistService;
  chat: ChatService;
};

export function createApp(deps: Deps) {
  const { env, logger } = deps;
  const app = express();

  // Behind Vercel's proxy: req.ip comes from X-Forwarded-For.
  app.set("trust proxy", true);
  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          "script-src": ["'self'", "https://cdn.jsdelivr.net"],
          "style-src": ["'self'", "https://cdn.jsdelivr.net"],
          "img-src": ["'self'", "data:"],
        },
      },
    }),
  );
  app.use(cors({ origin: env.WEB_ORIGIN.split(","), credentials: true }));
  app.use(express.json({ limit: "32kb" }));
  app.use(cookieParser());
  if (env.NODE_ENV !== "test") app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === "/api/v1/health" } }));

  app.get("/", (_req, res) => res.redirect("/docs"));
  app.get("/api/v1/health", (_req, res) => {
    res.json({ status: "ok", version: VERSION, time: new Date().toISOString() });
  });
  const openapi = buildOpenApi(VERSION);
  app.get("/openapi.json", (_req, res) => res.json(openapi));
  app.get("/docs", (_req, res) => res.type("html").send(swaggerHtml));
  app.get("/docs/init.js", (_req, res) => res.type("js").send(swaggerInit));

  const v1 = express.Router();
  v1.use(rateLimit({ cache: deps.cache, logger, salt: env.IP_HASH_SALT, limit: 120, windowS: 60 }));
  v1.use(optionalUser(deps.auth));
  v1.use(marketRoutes(deps.market));
  v1.use("/auth", authRoutes(deps.auth, deps.watchlist, env.NODE_ENV === "production"));
  v1.use("/watchlist", watchlistRoutes(deps.watchlist));
  v1.use("/ai", aiRoutes({ chat: deps.chat, cache: deps.cache, salt: env.IP_HASH_SALT }));
  app.use("/api/v1", v1);

  app.use(notFound);
  app.use(errorHandler(logger));
  return app;
}
