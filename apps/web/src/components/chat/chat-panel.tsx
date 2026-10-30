"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Loader2, Maximize2 } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useChat } from "@/stores/chat";
import { Sparkle } from "./sparkle";

// The conversation UI pulls in react-markdown; load it when the panel first opens.
const loadChatView = () => import("./chat-view").then((m) => m.ChatView);
const ChatView = dynamic(loadChatView, {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 items-center justify-center" aria-label="Loading Ask TRIYU">
      <Loader2 className="text-muted size-5 animate-spin" />
    </div>
  ),
});

/** Floating button on every page → drawer on desktop, full-screen sheet on mobile (FR-18). */
export function ChatPanel() {
  const open = useChat((s) => s.open);
  const setOpen = useChat((s) => s.setOpen);
  const pathname = usePathname();
  const onAskPage = pathname === "/ask";

  return (
    <>
      {!onAskPage && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          onPointerEnter={() => void loadChatView()}
          onFocus={() => void loadChatView()}
          aria-label="Open Ask TRIYU"
          className="ai-gradient h-13 shadow-ai-from/30 hover:shadow-ai-from/50 group fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full pl-4 pr-5 font-medium text-white shadow-xl transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:scale-[1.03] active:scale-95 sm:bottom-6 sm:right-6"
        >
          <Sparkle className="size-5 transition-transform duration-500 group-hover:rotate-[20deg] group-hover:scale-110" />
          <span>Ask TRIYU</span>
        </button>
      )}
      <Sheet open={open && !onAskPage} onOpenChange={setOpen}>
        <SheetContent className="sm:max-w-[440px]" hideClose>
          <div className="border-border flex h-14 items-center gap-2 border-b px-4">
            <span className="ai-gradient flex size-7 items-center justify-center rounded-full text-white">
              <Sparkle className="size-3.5" />
            </span>
            <div className="min-w-0">
              <SheetTitle className="text-sm font-semibold">Ask TRIYU</SheetTitle>
              <SheetDescription className="text-muted text-[11px]">
                AI market assistant · demo mode
              </SheetDescription>
            </div>
            <Link
              href="/ask"
              onClick={() => setOpen(false)}
              className="text-muted hover:bg-surface-2 hover:text-text ml-auto rounded-lg p-2"
              aria-label="Open full page"
              title="Open full page"
            >
              <Maximize2 className="size-4" />
            </Link>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-muted hover:bg-surface-2 hover:text-text rounded-lg p-2"
              aria-label="Close Ask TRIYU"
            >
              <span aria-hidden className="text-lg leading-none">
                ×
              </span>
            </button>
          </div>
          <ChatView autoFocus />
        </SheetContent>
      </Sheet>
    </>
  );
}
