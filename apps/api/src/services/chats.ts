import type { ChatConversation, ChatThread } from "@triyuai/shared";
import type { Db } from "../db";
import { AppError } from "../lib/errors";

/** Conversations kept per account; the oldest are dropped beyond this. */
export const MAX_CONVERSATIONS = 50;

export type ChatHistoryService = ReturnType<typeof createChatHistoryService>;

const notFound = () => new AppError(404, "NOT_FOUND", "Conversation not found");

/** The first question, trimmed to one line, names the conversation. */
export const titleFrom = (text: string) => {
  const line = text.replace(/\s+/g, " ").trim();
  return line.length > 60 ? `${line.slice(0, 57).trimEnd()}…` : line || "New chat";
};

/** Ask TRIYU history for signed-in users (FR-24): saved per account, newest first. */
export function createChatHistoryService(db: Db) {
  const owned = async (userId: string, id: string) => {
    const c = await db.chatConversation.findFirst({ where: { id, userId } });
    if (!c) throw notFound();
    return c;
  };

  return {
    async list(userId: string): Promise<ChatConversation[]> {
      const rows = await db.chatConversation.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        take: MAX_CONVERSATIONS,
        select: { id: true, title: true, updatedAt: true },
      });
      return rows.map((r) => ({ ...r, updatedAt: r.updatedAt.toISOString() }));
    },

    async get(userId: string, id: string): Promise<ChatThread> {
      const c = await owned(userId, id);
      const messages = await db.chatMessage.findMany({
        where: { conversationId: id },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      return {
        id: c.id,
        title: c.title,
        updatedAt: c.updatedAt.toISOString(),
        messages: messages.map((m) => ({
          id: m.id,
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
          tools: Array.isArray(m.toolCalls) ? m.toolCalls.map(String) : [],
          createdAt: m.createdAt.toISOString(),
        })),
      };
    },

    async remove(userId: string, id: string) {
      await owned(userId, id);
      await db.chatConversation.delete({ where: { id } });
    },

    /**
     * Where a new exchange is saved: the given conversation when it belongs to the user,
     * otherwise a new one named after the question. Old conversations beyond the cap go.
     */
    async open(userId: string, conversationId: string | undefined, question: string) {
      if (conversationId) {
        const c = await db.chatConversation.findFirst({ where: { id: conversationId, userId } });
        if (c) return c.id;
      }
      const c = await db.chatConversation.create({ data: { userId, title: titleFrom(question) } });
      const stale = await db.chatConversation.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        skip: MAX_CONVERSATIONS,
        select: { id: true },
      });
      if (stale.length)
        await db.chatConversation.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });
      return c.id;
    },

    async addMessage(
      conversationId: string,
      message: { role: "user" | "assistant"; content: string; tools?: string[] },
    ) {
      await db.chatMessage.create({
        data: {
          conversationId,
          role: message.role,
          content: message.content,
          toolCalls: message.tools?.length ? message.tools : undefined,
        },
      });
      // Touch the conversation so it moves to the top of the list.
      await db.chatConversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });
    },

    /** Regenerate: the previous answer is replaced rather than kept beside the new one. */
    async dropLastAnswer(conversationId: string) {
      const last = await db.chatMessage.findFirst({
        where: { conversationId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      });
      if (last?.role === "assistant") await db.chatMessage.delete({ where: { id: last.id } });
    },
  };
}
