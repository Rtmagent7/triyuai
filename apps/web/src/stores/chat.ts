import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  CHAT_CONTEXT_MESSAGES,
  GUEST_DAILY_CHAT_QUOTA,
  chatStreamEventSchema,
  type ChatStreamEvent,
} from "@triyuai/shared";
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
  /** Coin page the chat was opened from (FR-16). */
  coinContext: CoinContext | null;
  quota: { day: string; used: number };
  setOpen: (open: boolean) => void;
  openWith: (opts?: { prompt?: string; coin?: CoinContext | null }) => void;
  setCoinContext: (coin: CoinContext | null) => void;
  send: (text: string) => Promise<void>;
  stop: () => void;
  regenerate: () => Promise<void>;
  clear: () => void;
  remaining: () => number;
};

const today = () => new Date().toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 10);

let controller: AbortController | null = null;

/** Parses an SSE body (`data: {json}\n\n`) into typed stream events. */
async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<ChatStreamEvent> {
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

      async function stream() {
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
            { messages: history, ...(coinId ? { context: { coinId } } : {}) },
            controller.signal,
          );
          if (res.status === 429)
            throw new Error("AI is busy right now. Please try again in a minute.");
          if (!res.ok || !res.body) throw new Error("Ask TRIYU couldn't answer. Please try again.");
          for await (const ev of readEvents(res.body)) {
            if (ev.type === "tool-call") {
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

      const consumeQuota = () => {
        const q = get().quota.day === today() ? get().quota : { day: today(), used: 0 };
        if (q.used >= GUEST_DAILY_CHAT_QUOTA) return false;
        set({ quota: { day: q.day, used: q.used + 1 } });
        return true;
      };

      return {
        open: false,
        messages: [],
        coinContext: null,
        quota: { day: today(), used: 0 },
        setOpen: (open) => set({ open }),
        setCoinContext: (coinContext) => set({ coinContext }),
        openWith: (opts) => {
          if (opts?.coin !== undefined) set({ coinContext: opts.coin });
          set({ open: true });
          if (opts?.prompt) void get().send(opts.prompt);
        },
        remaining: () =>
          get().quota.day === today()
            ? Math.max(0, GUEST_DAILY_CHAT_QUOTA - get().quota.used)
            : GUEST_DAILY_CHAT_QUOTA,
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
                  error: `You've used all ${GUEST_DAILY_CHAT_QUOTA} guest messages for today. Log in (coming in Phase 3) to get 30 messages a day, or come back tomorrow.`,
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
          await stream();
        },
        clear: () => {
          controller?.abort();
          set({ messages: [] });
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
