import { Router } from "express";
import { GUEST_DAILY_CHAT_QUOTA, USER_DAILY_CHAT_QUOTA, chatRequestSchema } from "@triyuai/shared";
import type { ChatService } from "../ai/chat";
import type { ChatHistoryService } from "../services/chats";
import type { Cache } from "../cache";
import { AppError } from "../lib/errors";
import { clientKey, parse } from "../lib/http";

export function aiRoutes(deps: {
  chat: ChatService;
  history: ChatHistoryService;
  cache: Cache;
  salt: string;
}) {
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

    const send = (event: object) => res.write(`data: ${JSON.stringify(event)}\n\n`);

    // Signed-in users: the exchange is saved (FR-24). The question is stored before the
    // answer streams, so a failed or stopped answer still leaves the question in history.
    let conversationId: string | null = null;
    if (req.userId) {
      const question = body.messages.at(-1)!;
      conversationId = await deps.history.open(req.userId, body.conversationId, question.content);
      if (body.regenerate) await deps.history.dropLastAnswer(conversationId);
      else if (question.role === "user")
        await deps.history.addMessage(conversationId, { role: "user", content: question.content });
      send({ type: "conversation", id: conversationId });
    }
    let answer = "";
    const tools: string[] = [];

    // Stop the model (and its token usage) as soon as the browser hits Stop or leaves.
    const abort = new AbortController();
    res.on("close", () => {
      if (!res.writableEnded) abort.abort();
    });

    for await (const event of deps.chat.stream(body, abort.signal)) {
      if (abort.signal.aborted) break;
      if (event.type === "text-delta") answer += event.delta;
      else if (event.type === "tool-call") tools.push(event.label);
      send(event);
    }
    // A stopped answer is kept as far as it got, like in the browser.
    if (conversationId && answer.trim())
      await deps.history.addMessage(conversationId, { role: "assistant", content: answer, tools });
    res.end();
  });

  return r;
}
