import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { api } from "@/lib/api/client";
import { useChat } from "@/stores/chat";
import { renderWithClient } from "@/test/utils";
import { ChatHistory } from "./chat-history";

afterEach(() => useChat.setState({ messages: [], conversationId: null, open: false }));

describe("chat history", () => {
  it("asks guests to sign in", async () => {
    renderWithClient(<ChatHistory />);
    expect(await screen.findByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
  });

  it("saves a signed-in user's chats, reopens them and deletes them", async () => {
    await api.auth.demo();
    // Two exchanges in one conversation, then a second conversation.
    await useChat.getState().send("How is Solana doing?");
    const first = useChat.getState().conversationId;
    expect(first).toBeTruthy();
    await useChat.getState().send("And Bitcoin?");
    expect(useChat.getState().conversationId).toBe(first);
    useChat.getState().clear();
    await useChat.getState().send("What's the Fear & Greed today?");
    expect(useChat.getState().conversationId).not.toBe(first);

    renderWithClient(<ChatHistory />);
    const nav = await screen.findByRole("navigation", { name: "Chat history" });
    const solana = await within(nav).findByRole("button", { name: /^How is Solana doing\?/ });
    expect(within(nav).getByRole("button", { name: /^What.s the Fear & Greed/ })).toHaveAttribute(
      "aria-current",
      "true",
    );

    await userEvent.click(solana);
    await waitFor(() => expect(useChat.getState().conversationId).toBe(first));
    const msgs = useChat.getState().messages;
    expect(msgs.map((m) => m.role)).toEqual(["user", "assistant", "user", "assistant"]);
    expect(msgs[1]!.tools[0]).toMatchObject({ label: "Fetched: Solana price", done: true });

    await userEvent.click(
      within(nav).getByRole("button", { name: "Delete conversation “How is Solana doing?”" }),
    );
    await waitFor(() =>
      expect(within(nav).queryByRole("button", { name: /^How is Solana/ })).not.toBeInTheDocument(),
    );
    // Deleting the open conversation starts a new one.
    expect(useChat.getState().conversationId).toBeNull();

    await userEvent.click(within(nav).getByRole("button", { name: "New chat" }));
    expect(useChat.getState().messages).toEqual([]);
    // Three streamed mock answers (word by word, with typing delays).
  }, 60_000);

  it("replaces the saved answer when regenerating", async () => {
    await api.auth.demo();
    await useChat.getState().send("How is Solana doing?");
    await useChat.getState().regenerate();
    const id = useChat.getState().conversationId!;
    const thread = (await api.chats.get(id)).data;
    expect(thread.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
  }, 30_000);

  it("does not save guest chats", async () => {
    await useChat.getState().send("How is Solana doing?");
    expect(useChat.getState().conversationId).toBeNull();
  });
});
