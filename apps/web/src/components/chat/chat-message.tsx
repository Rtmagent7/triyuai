"use client";

import { Check, Copy, Loader2, RotateCcw, AlertCircle } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage as Message } from "@/stores/chat";
import { cn } from "@/lib/utils";
import { Sparkle } from "./sparkle";

type Props = { message: Message; isLast: boolean; onRegenerate: () => void };

export function ChatMessage({ message, isLast, onRegenerate }: Props) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="bg-brand text-brand-fg max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md px-3.5 py-2 text-sm">
          {message.content}
        </p>
      </div>
    );
  }

  const streaming = message.status === "streaming";
  return (
    <div className="flex gap-2.5">
      <span className="ai-gradient mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-white">
        <Sparkle className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        {message.tools.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Data sources used">
            {message.tools.map((t) => (
              <li
                key={t.id}
                className="border-border bg-surface text-muted inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
              >
                {t.done ? (
                  <Check className="text-up size-3" />
                ) : (
                  <Loader2 className="size-3 animate-spin" />
                )}
                {t.label}
              </li>
            ))}
          </ul>
        )}

        {message.content && (
          <div
            className="prose-triyu text-sm leading-relaxed"
            aria-live={streaming ? "polite" : undefined}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ href, children }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer nofollow">
                    {children}
                  </a>
                ),
                table: ({ children }) => (
                  <div className="overflow-x-auto">
                    <table>{children}</table>
                  </div>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
            {streaming && (
              <span
                className="animate-blink bg-text ml-0.5 inline-block h-4 w-1.5 translate-y-0.5"
                aria-hidden
              />
            )}
          </div>
        )}

        {streaming && !message.content && message.tools.every((t) => t.done) && (
          <p className="text-muted flex items-center gap-2 text-sm">
            <Loader2 className="size-3.5 animate-spin" /> Thinking…
          </p>
        )}

        {message.status === "error" && (
          <p
            role="alert"
            className="border-down/30 bg-down-soft flex items-start gap-2 rounded-xl border px-3 py-2 text-sm"
          >
            <AlertCircle className="text-down mt-0.5 size-4 shrink-0" />
            {message.error}
          </p>
        )}
        {message.status === "stopped" && <p className="text-muted text-xs italic">Stopped.</p>}

        {!streaming && message.content && (
          <MessageActions
            content={message.content}
            canRegenerate={isLast}
            onRegenerate={onRegenerate}
          />
        )}
      </div>
    </div>
  );
}

function MessageActions({
  content,
  canRegenerate,
  onRegenerate,
}: {
  content: string;
  canRegenerate: boolean;
  onRegenerate: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const btn =
    "inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted hover:bg-surface-2 hover:text-text";
  return (
    <div className="flex gap-1">
      <button
        type="button"
        className={btn}
        onClick={async () => {
          await navigator.clipboard.writeText(content);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {copied ? "Copied" : "Copy"}
      </button>
      {canRegenerate && (
        <button type="button" className={cn(btn)} onClick={onRegenerate}>
          <RotateCcw className="size-3.5" /> Regenerate
        </button>
      )}
    </div>
  );
}
