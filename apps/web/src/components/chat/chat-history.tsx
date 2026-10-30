"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Plus, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/use-session";
import { api } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/keys";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useChat } from "@/stores/chat";

/** Saved Ask TRIYU conversations for signed-in users (FR-24); a sign-in nudge for guests. */
export function ChatHistory({
  className,
  onPick,
  onClose,
}: {
  className?: string;
  /** Called after a conversation is opened or a new one started. */
  onPick?: () => void;
  /** Phones: back to the chat without picking anything. */
  onClose?: () => void;
}) {
  const user = useSession().data;
  const qc = useQueryClient();
  const conversationId = useChat((s) => s.conversationId);
  const load = useChat((s) => s.load);
  const clear = useChat((s) => s.clear);
  const streaming = useChat((s) => s.messages.at(-1)?.status === "streaming");
  const [opening, setOpening] = useState<string | null>(null);

  const chats = useQuery({
    queryKey: queryKeys.chats,
    queryFn: () => api.chats.list(),
    enabled: !!user,
    select: (r) => r.data,
  });

  // A new conversation, or an answer that just finished, changes the list's order.
  useEffect(() => {
    if (user && !streaming) void qc.invalidateQueries({ queryKey: queryKeys.chats });
  }, [user, streaming, conversationId, qc]);

  if (!user)
    return (
      <div className={cn("text-muted p-4 text-sm", className)}>
        <h2 className="text-text mb-1 font-semibold">History</h2>
        <p>
          <Link href="/login" className="text-brand underline underline-offset-2">
            Sign in
          </Link>{" "}
          to keep your conversations and pick them up on any device.
        </p>
      </div>
    );

  const open = async (id: string) => {
    if (id === conversationId) return onPick?.();
    setOpening(id);
    try {
      load((await api.chats.get(id)).data);
      onPick?.();
    } catch {
      toast.error("Couldn't open that conversation.");
    } finally {
      setOpening(null);
    }
  };

  const remove = async (id: string, title: string) => {
    try {
      await api.chats.remove(id);
      if (id === conversationId) clear();
      await qc.invalidateQueries({ queryKey: queryKeys.chats });
    } catch {
      toast.error(`Couldn't delete “${title}”.`);
    }
  };

  return (
    <nav aria-label="Chat history" className={cn("flex min-h-0 flex-col", className)}>
      <div className="flex items-center justify-between gap-2 p-3">
        <h2 className="px-1 text-sm font-semibold">History</h2>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            clear();
            onPick?.();
          }}
        >
          <Plus /> New chat
        </Button>
        {onClose && (
          <Button
            size="icon"
            variant="ghost"
            className="ml-auto md:hidden"
            aria-label="Back to the chat"
            onClick={onClose}
          >
            <X />
          </Button>
        )}
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {chats.data?.length === 0 && (
          <li className="text-muted px-2 py-2 text-sm">Your questions will be saved here.</li>
        )}
        {chats.data?.map((c) => {
          const active = c.id === conversationId;
          return (
            <li key={c.id} className="group relative">
              <button
                type="button"
                onClick={() => void open(c.id)}
                aria-current={active ? "true" : undefined}
                disabled={opening === c.id}
                className={cn(
                  "hover:bg-surface flex w-full flex-col rounded-md px-2.5 py-2 pr-9 text-left text-sm",
                  // The open conversation gets the 1px accent line used for every selection.
                  active &&
                    "bg-surface before:bg-brand before:absolute before:inset-y-2 before:left-0 before:w-px",
                )}
              >
                <span className="truncate font-medium">{c.title}</span>
                <span className="text-muted text-xs" suppressHydrationWarning>
                  {timeAgo(c.updatedAt)}
                </span>
              </button>
              <button
                type="button"
                aria-label={`Delete conversation “${c.title}”`}
                onClick={() => void remove(c.id, c.title)}
                className="text-muted hover:text-text hover:bg-surface-2 absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1.5 opacity-0 focus-visible:opacity-100 group-hover:opacity-100 max-md:opacity-100"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
