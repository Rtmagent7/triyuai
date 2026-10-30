"use client";

import { mockingEnabled } from "@/lib/api/mocking";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Loader2, Maximize2 } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useChat } from "@/stores/chat";
import { AskMark } from "./ask-mark";

// The conversation UI pulls in react-markdown; load it when the panel first opens.
const loadChatView = () => import("./chat-view").then((m) => m.ChatView);
/** Warm the chunk when the pointer nears an Ask TRIYU button. */
export const preloadChatView = () => void loadChatView();
const ChatView = dynamic(loadChatView, {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 items-center justify-center" aria-label="Loading Ask TRIYU">
      <Loader2 className="text-muted size-5 animate-spin" />
    </div>
  ),
});

/** Ask TRIYU as a drawer on desktop and a full-screen sheet on mobile (FR-18), opened from the navbar. */
export function ChatPanel() {
  const open = useChat((s) => s.open);
  const setOpen = useChat((s) => s.setOpen);
  const pathname = usePathname();
  const onAskPage = pathname === "/ask";

  return (
    <>
      <Sheet open={open && !onAskPage} onOpenChange={setOpen}>
        <SheetContent className="sm:max-w-[440px]" hideClose>
          <div className="border-border flex h-14 items-center gap-2 border-b px-4">
            <AskMark className="text-brand size-4" />
            <div className="min-w-0">
              <SheetTitle className="text-sm font-semibold">Ask TRIYU</SheetTitle>
              <SheetDescription className="text-muted text-[11px]">
                AI market assistant{mockingEnabled ? " · demo mode" : ""}
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
