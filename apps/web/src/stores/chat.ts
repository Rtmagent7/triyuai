import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { ChatStreamEvent, ChatThread } from "@triyuai/shared";
import {
  CHAT_CONTEXT_MESSAGES,
  GUEST_DAILY_CHAT_QUOTA,
  USER_DAILY_CHAT_QUOTA,
} from "@triyuai/shared/constants";
import { api } from "@/lib/api/client";

export type ToolChip = { id: string; label: string; done: boolean };
export type CoinContext = { id: string; name: string };
export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  tools: ToolChip[];
  status: "streaming" | "done" | "stopped" | "error";
  error?: string;
};

type ChatState = {
  open: boolean;
  messages: ChatMessage[];
  /** Saved conversation this chat continues (signed-in users, FR-24); null starts a new one. */
  conversationId: string | null;
  /** Coin page the chat was opened from (FR-16). */
  coinContext: CoinContext | null;
  /** Local mirror of the server's daily quota; `owner` is "guest" or the user id. */
  quota: Quota;
  setOpen: (open: boolean) => void;
  openWith: (opts?: { prompt?: string; coin?: CoinContext | null }) => void;
  setCoinContext: (coin: CoinContext | null) => void;
  send: (text: string) => Promise<void>;
  stop: () => void;
  regenerate: () => Promise<void>;
  clear: () => void;
  /** Opens a saved conversation from the history list. */
  load: (thread: ChatThread) => void;
  remaining: () => number;
  /** Switches the quota to the signed-in user (30/day) or back to guest (10/day). */
  syncQuota: (owner: string, limit: number) => void;
};

type Quota = { day: string; used: number; owner?: string; limit?: number };

const today = () => new Date().toISOString().slice(0, 10);
const limitOf = (q: Quota) => q.limit ?? GUEST_DAILY_CHAT_QUOTA;
const quotaMessage = (q: Quota) =>
  (q.owner ?? "guest") === "guest"
    ? `You've used all ${limitOf(q)} guest messages for today. Sign in to get ${USER_DAILY_CHAT_QUOTA} messages a day, or come back tomorrow.`
    : `You've used all ${limitOf(q)} messages for today. Come back tomorrow.`;
const uid = () => Math.random().toString(36).slice(2, 10);

let controller: AbortController | null = null;

/** Parses an SSE body (`data: {json}\n\n`) into typed stream events. */
async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<ChatStreamEvent> {
  // Zod is only needed once someone chats, so it stays out of the initial bundle.
  const { chatStreamEventSchema } = await import("@triyuai/shared");
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) >= 0) {
      const chunk = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const data = chunk
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trim())
        .join("");
      if (!data) continue;
      const parsed = chatStreamEventSchema.safeParse(JSON.parse(data));
      if (parsed.success) yield parsed.data;
    }
  }
}

export const useChat = create<ChatState>()(
  persist(
    (set, get) => {
      const patchLast = (fn: (m: ChatMessage) => ChatMessage) =>
        set((s) => ({
          messages: s.messages.map((m, i) => (i === s.messages.length - 1 ? fn(m) : m)),
        }));

      async function stream(regenerate = false) {
        const history = get()
          .messages.filter((m) => m.status !== "error" && m.content)
          .slice(-CHAT_CONTEXT_MESSAGES)
          .map(({ role, content }) => ({ role, content }));
        const coinId = get().coinContext?.id;

        set((s) => ({
          messages: [
            ...s.messages,
            { id: uid(), role: "assistant", content: "", tools: [], status: "streaming" },
          ],
        }));
        controller = new AbortController();
        try {
          const res = await api.chat(
            {
              messages: history,
              ...(coinId ? { context: { coinId } } : {}),
              ...(get().conversationId ? { conversationId: get().conversationId! } : {}),
              ...(regenerate ? { regenerate } : {}),
            },
            controller.signal,
          );
          // The server is the source of truth for the quota (it counts per account or IP).
          const limit = Number(res.headers.get("x-quota-limit"));
          const left = res.headers.get("x-quota-remaining");
          if (limit && left !== null) {
            set((s) => ({ quota: { ...s.quota, limit, used: limit - Number(left) } }));
          }
          if (!res.ok || !res.body) {
            const body = (await res.json().catch(() => null)) as {
              error?: { code?: string; message?: string };
            } | null;
            if (body?.error?.code === "QUOTA_EXCEEDED")
              set((s) => ({ quota: { ...s.quota, used: limitOf(s.quota) } }));
            throw new Error(
              body?.error?.message ??
                (res.status === 429
                  ? "AI is busy right now. Please try again in a minute."
                  : "Ask TRIYU couldn't answer. Please try again."),
            );
          }
          for await (const ev of readEvents(res.body)) {
            if (ev.type === "conversation") {
              set({ conversationId: ev.id });
            } else if (ev.type === "tool-call") {
              patchLast((m) => ({
                ...m,
                tools: [...m.tools, { id: ev.id, label: ev.label, done: false }],
              }));
            } else if (ev.type === "tool-result") {
              patchLast((m) => ({
                ...m,
                tools: m.tools.map((t) => (t.id === ev.id ? { ...t, done: true } : t)),
              }));
            } else if (ev.type === "text-delta") {
              patchLast((m) => ({ ...m, content: m.content + ev.delta }));
            } else if (ev.type === "error") {
              throw new Error(ev.message);
            }
          }
          patchLast((m) => ({ ...m, status: "done" }));
        } catch (err) {
          if ((err as Error).name === "AbortError") {
            patchLast((m) => ({
              ...m,
              status: "stopped",
              tools: m.tools.map((t) => ({ ...t, done: true })),
            }));
          } else {
            patchLast((m) => ({ ...m, status: "error", error: (err as Error).message }));
          }
        } finally {
          controller = null;
        }
      }

      const currentQuota = (): Quota => {
        const q = get().quota;
        return q.day === today() ? q : { ...q, day: today(), used: 0 };
      };
      const consumeQuota = () => {
        const q = currentQuota();
        if (q.used >= limitOf(q)) return false;
        set({ quota: { ...q, used: q.used + 1 } });
        return true;
      };

      return {
        open: false,
        messages: [],
        conversationId: null,
        coinContext: null,
        quota: { day: today(), used: 0, owner: "guest", limit: GUEST_DAILY_CHAT_QUOTA },
        setOpen: (open) => set({ open }),
        setCoinContext: (coinContext) => set({ coinContext }),
        openWith: (opts) => {
          if (opts?.coin !== undefined) set({ coinContext: opts.coin });
          set({ open: true });
          if (opts?.prompt) void get().send(opts.prompt);
        },
        remaining: () => Math.max(0, limitOf(currentQuota()) - currentQuota().used),
        syncQuota: (owner, limit) => {
          const q = currentQuota();
          if ((q.owner ?? "guest") === owner && limitOf(q) === limit) return;
          set({
            quota: {
              day: today(),
              used: (q.owner ?? "guest") === owner ? q.used : 0,
              owner,
              limit,
            },
          });
        },
        send: async (text) => {
          const content = text.trim().slice(0, 2000);
          if (!content || controller) return;
          if (!consumeQuota()) {
            set((s) => ({
              messages: [
                ...s.messages,
                { id: uid(), role: "user", content, tools: [], status: "done" },
                {
                  id: uid(),
                  role: "assistant",
                  content: "",
                  tools: [],
                  status: "error",
                  error: quotaMessage(currentQuota()),
                },
              ],
            }));
            return;
          }
          set((s) => ({
            messages: [
              ...s.messages,
              { id: uid(), role: "user", content, tools: [], status: "done" },
            ],
          }));
          await stream();
        },
        stop: () => controller?.abort(),
        regenerate: async () => {
          if (controller) return;
          const msgs = get().messages;
          const last = msgs[msgs.length - 1];
          if (!last || last.role !== "assistant") return;
          if (!consumeQuota()) return;
          set({ messages: msgs.slice(0, -1) });
          await stream(true);
        },
        clear: () => {
          controller?.abort();
          set({ messages: [], conversationId: null });
        },
        load: (thread) => {
          controller?.abort();
          set({
            conversationId: thread.id,
            coinContext: null,
            messages: thread.messages.map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              tools: m.tools.map((label, i) => ({ id: `${m.id}-${i}`, label, done: true })),
              status: "done",
            })),
          });
        },
      };
    },
    {
      name: "triyu:chat",
      // Conversation lives for the browser session; the quota survives across sessions.
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ quota: s.quota }),
      skipHydration: true,
    },
  ),
);
