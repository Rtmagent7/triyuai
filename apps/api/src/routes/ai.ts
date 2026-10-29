import { Router } from "express";
import { GUEST_DAILY_CHAT_QUOTA, USER_DAILY_CHAT_QUOTA, chatRequestSchema } from "@triyuai/shared";
import type { ChatService } from "../ai/chat";
import type { Cache } from "../cache";
import { AppError } from "../lib/errors";
import { clientKey, parse } from "../lib/http";

export function aiRoutes(deps: { chat: ChatService; cache: Cache; salt: string }) {
  const r = Router();

  r.post("/chat", async (req, res) => {
    const body = parse(chatRequestSchema, req.body);
    if (!deps.chat.enabled) {
      throw new AppError(503, "AI_UNAVAILABLE", "Ask TRIYU is not configured on this server yet.");
    }

    // Daily quota per account (30) or per hashed guest IP (10), counted before streaming.
    const limit = req.userId ? USER_DAILY_CHAT_QUOTA : GUEST_DAILY_CHAT_QUOTA;
    const day = new Date().toISOString().slice(0, 10);
    const used = await deps.cache.incr(`ai:quota:${clientKey(req, deps.salt)}:${day}`, 86_400);
    res.setHeader("X-Quota-Limit", limit);
    res.setHeader("X-Quota-Remaining", Math.max(0, limit - used));
    if (used > limit) {
      throw new AppError(
        429,
        "QUOTA_EXCEEDED",
        req.userId
          ? `You've used all ${limit} messages for today. Come back tomorrow.`
          : `You've used all ${limit} guest messages for today. Sign in to get ${USER_DAILY_CHAT_QUOTA} messages a day, or come back tomorrow.`,
      );
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders();

    // Stop the model (and its token usage) as soon as the browser hits Stop or leaves.
    const abort = new AbortController();
    res.on("close", () => {
      if (!res.writableEnded) abort.abort();
    });

    for await (const event of deps.chat.stream(body, abort.signal)) {
      if (abort.signal.aborted) break;
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
    res.end();
  });

  return r;
}
