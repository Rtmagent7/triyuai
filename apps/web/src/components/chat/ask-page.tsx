"use client";

import { History } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { mockingEnabled } from "@/lib/api/mocking";
import { cn } from "@/lib/utils";
import { useChat } from "@/stores/chat";
import { AskMark } from "./ask-mark";
import { ChatHistory } from "./chat-history";
import { ChatView } from "./chat-view";

/** Dedicated /ask page sharing the conversation with the navbar panel (FR-18), with history (FR-24). */
export function AskPage() {
  const setOpen = useChat((s) => s.setOpen);
  useEffect(() => setOpen(false), [setOpen]);
  // Phones: the history list replaces the chat until a conversation is picked.
  const [showHistory, setShowHistory] = useState(false);

  return (
    <div className="border-border bg-bg mx-auto flex h-[calc(100dvh-9rem)] max-w-5xl overflow-hidden rounded-2xl border">
      <ChatHistory
        className={cn(
          "border-border w-64 shrink-0 border-r max-md:w-full max-md:border-r-0",
          !showHistory && "max-md:hidden",
        )}
        onPick={() => setShowHistory(false)}
        onClose={() => setShowHistory(false)}
      />
      <div className={cn("flex min-w-0 flex-1 flex-col", showHistory && "max-md:hidden")}>
        <div className="border-border flex items-center gap-3 border-b px-4 py-3">
          <AskMark className="text-brand size-5" />
          <div className="min-w-0 flex-1">
            <h1 className="font-semibold">Ask TRIYU</h1>
            <p className="text-muted text-xs">
              AI market assistant ·{" "}
              {mockingEnabled ? "demo mode with snapshot data" : "answers from live market data"}
            </p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="md:hidden"
            aria-label="Show chat history"
            onClick={() => setShowHistory(true)}
          >
            <History />
          </Button>
        </div>
        <ChatView autoFocus />
      </div>
    </div>
  );
}
