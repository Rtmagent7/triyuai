"use client";

import { ArrowUp, Square, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { GUEST_DAILY_CHAT_QUOTA } from "@triyuai/shared";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useChat } from "@/stores/chat";
import { ChatMessage } from "./chat-message";
import { Sparkle } from "./sparkle";

const GENERAL_PROMPTS = [
  "What's moving the market today?",
  "Compare BTC and ETH",
  "Explain market cap vs FDV",
];

const coinPrompts = (name: string) => [
  `How is ${name} doing today?`,
  `Why is ${name} moving?`,
  `Compare ${name} and Bitcoin`,
];

/** Shared conversation UI for the floating panel and the /ask page (FR-18–23). */
export function ChatView({ className, autoFocus }: { className?: string; autoFocus?: boolean }) {
  const messages = useChat((s) => s.messages);
  const send = useChat((s) => s.send);
  const stop = useChat((s) => s.stop);
  const regenerate = useChat((s) => s.regenerate);
  const clear = useChat((s) => s.clear);
  const coinContext = useChat((s) => s.coinContext);
  const remaining = useChat((s) => s.remaining());
  const [input, setInput] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const streaming = messages.at(-1)?.status === "streaming";
  const coinName = coinContext?.name ?? null;
  const prompts = coinName ? [...coinPrompts(coinName), GENERAL_PROMPTS[0]!] : GENERAL_PROMPTS;

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight });
  }, [messages]);

  useEffect(() => {
    if (autoFocus) textarea.current?.focus();
  }, [autoFocus]);

  const submit = (text = input) => {
    if (!text.trim() || streaming) return;
    setInput("");
    void send(text);
  };

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div ref={scroller} className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center px-2 pt-6 text-center">
            <span className="ai-gradient shadow-ai-from/30 flex size-12 items-center justify-center rounded-2xl text-white shadow-lg">
              <Sparkle className="size-6" />
            </span>
            <h3 className="mt-4 text-lg font-semibold">
              Ask <span className="ai-text">TRIYU</span>
            </h3>
            <p className="text-muted mt-1 max-w-xs text-sm">
              Your AI market assistant. Answers are grounded in the latest market data
              {coinName ? `, with ${coinName} as context` : ""}.
            </p>
            <div className="mt-6 flex w-full flex-col gap-2">
              {prompts.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => submit(p)}
                  className="border-border bg-surface hover:border-ai-from/50 hover:bg-surface-2 rounded-xl border px-3.5 py-2.5 text-left text-sm transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <ChatMessage
              key={m.id}
              message={m}
              isLast={i === messages.length - 1}
              onRegenerate={() => void regenerate()}
            />
          ))
        )}
      </div>

      <div className="border-border border-t p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="border-border bg-surface focus-within:border-ai-from/60 flex items-end gap-2 rounded-2xl border p-1.5"
        >
          <label htmlFor="chat-input" className="sr-only">
            Message Ask TRIYU
          </label>
          <textarea
            id="chat-input"
            ref={textarea}
            rows={1}
            value={input}
            maxLength={2000}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={coinName ? `Ask about ${coinName}…` : "Ask about prices, trends, coins…"}
            className="placeholder:text-muted max-h-32 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none"
          />
          {streaming ? (
            <Button size="icon" variant="secondary" onClick={stop} aria-label="Stop generating">
              <Square className="size-3.5 fill-current" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              variant="ai"
              disabled={!input.trim()}
              aria-label="Send message"
            >
              <ArrowUp />
            </Button>
          )}
        </form>
        <div className="text-muted mt-2 flex items-center justify-between gap-2 px-1 text-[11px]">
          <span>
            Not financial advice · {remaining}/{GUEST_DAILY_CHAT_QUOTA} guest messages left today
          </span>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={clear}
              className="hover:text-text inline-flex items-center gap-1"
            >
              <Trash2 className="size-3" /> Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
