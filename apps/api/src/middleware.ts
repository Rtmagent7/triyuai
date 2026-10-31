import { timingSafeEqual } from "node:crypto";
import type { ErrorRequestHandler, RequestHandler } from "express";
import type { Cache } from "./cache";
import { AppError, UnauthorizedError } from "./lib/errors";
import { clientKey } from "./lib/http";
import type { Logger } from "./lib/logger";
import { noopReporter, type ErrorReporter } from "./lib/reporter";
import type { AuthService } from "./services/auth";

export const ACCESS_COOKIE = "triyu_at";
export const REFRESH_COOKIE = "triyu_rt";
export const SESSION_HINT_COOKIE = "triyu_session";

/** Fixed-window limit per client (PRD §13: 120 requests/min per IP). Fails open if Redis is down. */
export function rateLimit(opts: {
  cache: Cache;
  logger: Logger;
  salt: string;
  limit: number;
  windowS: number;
  internalKey?: string;
}): RequestHandler {
  const internal = opts.internalKey ? Buffer.from(opts.internalKey) : null;
  return async (req, res, next) => {
    const presented = Buffer.from(req.get("x-internal-key") ?? "");
    if (internal && presented.length === internal.length && timingSafeEqual(presented, internal)) {
      next();
      return;
    }
    const window = Math.floor(Date.now() / 1000 / opts.windowS);
    try {
      const n = await opts.cache.incr(
        `ratelimit:api:${clientKey(req, opts.salt)}:${window}`,
        opts.windowS,
      );
      res.setHeader("RateLimit-Limit", opts.limit);
      res.setHeader("RateLimit-Remaining", Math.max(0, opts.limit - n));
      if (n > opts.limit) {
        res.setHeader("Retry-After", opts.windowS - (Math.floor(Date.now() / 1000) % opts.windowS));
        throw new AppError(429, "RATE_LIMITED", "Too many requests. Please slow down.");
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      opts.logger.warn({ err }, "rate limiter unavailable");
    }
    next();
  };
}

export const optionalUser =
  (auth: AuthService): RequestHandler =>
  async (req, _res, next) => {
    req.userId = (await auth.verifyAccess(req.cookies?.[ACCESS_COOKIE])) ?? undefined;
    next();
  };

export const requireUser: RequestHandler = (req, _res, next) => {
  if (!req.userId) throw new UnauthorizedError();
  next();
};

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } });
};

export const errorHandler =
  (logger: Logger, reporter: ErrorReporter = noopReporter): ErrorRequestHandler =>
  async (err, req, res, _next) => {
    if (err instanceof AppError) {
      res.status(err.status).json({ error: { code: err.code, message: err.message } });
      return;
    }
    // Malformed JSON bodies from express.json().
    if ((err as { type?: string }).type === "entity.parse.failed") {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "Invalid JSON body" } });
      return;
    }
    if ((err as { type?: string }).type === "entity.too.large") {
      res
        .status(413)
        .json({ error: { code: "PAYLOAD_TOO_LARGE", message: "Request body is too large" } });
      return;
    }
    logger.error({ err, path: req.path }, "unhandled error");
    reporter.capture(err, { method: req.method, path: req.path });
    await reporter.flush().catch(() => undefined);
    res.status(500).json({ error: { code: "INTERNAL", message: "Something went wrong" } });
  };
