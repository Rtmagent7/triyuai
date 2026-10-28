"use client";

import { useEffect } from "react";
import { useChat } from "@/stores/chat";
import { ChatView } from "./chat-view";
import { Sparkle } from "./sparkle";

/** Dedicated /ask page sharing the conversation with the floating panel (FR-18). */
export function AskPage() {
  const setOpen = useChat((s) => s.setOpen);
  useEffect(() => setOpen(false), [setOpen]);

  return (
    <div className="border-border bg-bg mx-auto flex h-[calc(100dvh-9rem)] max-w-3xl flex-col overflow-hidden rounded-2xl border">
      <div className="border-border flex items-center gap-3 border-b px-4 py-3">
        <span className="ai-gradient flex size-8 items-center justify-center rounded-full text-white">
          <Sparkle />
        </span>
        <div>
          <h1 className="font-semibold">
            Ask <span className="ai-text">TRIYU</span>
          </h1>
          <p className="text-muted text-xs">AI market assistant · demo mode with snapshot data</p>
        </div>
      </div>
      <ChatView autoFocus />
    </div>
  );
}
