import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { navigation } from "@/test/setup";
import { renderWithClient } from "@/test/utils";
import { useChat, type ChatMessage as Message } from "@/stores/chat";
import { AskPage } from "./ask-page";
import { ChatMessage } from "./chat-message";
import { ChatPanel } from "./chat-panel";
import { ChatView } from "./chat-view";

const initial = useChat.getState();
beforeEach(() => {
  useChat.setState({ ...initial, messages: [], coinContext: null, open: false });
  navigation.pathname = "/";
});

const msg = (over: Partial<Message>): Message => ({
  id: "m1",
  role: "assistant",
  content: "",
  tools: [],
  status: "done",
  ...over,
});

describe("ChatMessage", () => {
  it("renders user bubbles as plain text", () => {
    render(
      <ChatMessage
        message={msg({ role: "user", content: "**hi**" })}
        isLast
        onRegenerate={vi.fn()}
      />,
    );
    expect(screen.getByText("**hi**")).toBeInTheDocument();
  });

  it("renders markdown tables, tool chips and actions for answers", async () => {
    const onRegenerate = vi.fn();
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    render(
      <ChatMessage
        message={msg({
          content: "**Bold**\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n[link](https://x.io)",
          tools: [{ id: "t", label: "Fetched: Bitcoin price", done: true }],
        })}
        isLast
        onRegenerate={onRegenerate}
      />,
    );
    expect(screen.getByText("Bold").tagName).toBe("STRONG");
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "link" })).toHaveAttribute(
      "rel",
      "noopener noreferrer nofollow",
    );
    expect(screen.getByRole("list", { name: "Data sources used" })).toHaveTextContent(
      "Fetched: Bitcoin price",
    );
    await userEvent.click(screen.getByRole("button", { name: /Copy/ }));
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    expect(await screen.findByText("Copied")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Regenerate/ }));
    expect(onRegenerate).toHaveBeenCalled();
  });

  it("shows thinking, error and stopped states", () => {
    const { rerender } = render(
      <ChatMessage message={msg({ status: "streaming" })} isLast onRegenerate={vi.fn()} />,
    );
    expect(screen.getByText(/Thinking/)).toBeInTheDocument();
    rerender(
      <ChatMessage
        message={msg({ status: "error", error: "AI is busy" })}
        isLast
        onRegenerate={vi.fn()}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("AI is busy");
    rerender(
      <ChatMessage
        message={msg({ status: "stopped", content: "partial" })}
        isLast={false}
        onRegenerate={vi.fn()}
      />,
    );
    expect(screen.getByText("Stopped.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Regenerate/ })).toBeNull();
  });
});

describe("ChatView", () => {
  it("offers suggested prompts and streams an answer", async () => {
    renderWithClient(<ChatView />);
    expect(
      screen.getByText("10/10 guest messages left today", { exact: false }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Compare BTC and ETH" }));
    expect(
      await screen.findByText("Fetched: BTC vs ETH data", {}, { timeout: 5000 }),
    ).toBeInTheDocument();
    await waitFor(
      () => expect(screen.getByRole("button", { name: /Regenerate/ })).toBeInTheDocument(),
      {
        timeout: 15_000,
      },
    );
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText(/9\/10 guest messages/)).toBeInTheDocument();
  }, 20_000);

  it("sends on Enter, keeps Shift+Enter for new lines, and clears", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    useChat.setState({ send });
    renderWithClient(<ChatView />);
    const input = screen.getByRole("textbox", { name: "Message Ask TRIYU" });
    await userEvent.type(input, "line1{Shift>}{Enter}{/Shift}line2");
    expect(send).not.toHaveBeenCalled();
    await userEvent.type(input, "{Enter}");
    expect(send).toHaveBeenCalledWith("line1\nline2");
    expect(input).toHaveValue("");
  });

  it("uses coin-specific prompts on coin pages", () => {
    useChat.setState({ coinContext: { id: "solana", name: "Solana" } });
    renderWithClient(<ChatView />);
    expect(screen.getByRole("button", { name: "Why is Solana moving?" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Ask about Solana…")).toBeInTheDocument();
  });

  it("shows Stop while streaming", async () => {
    const stop = vi.fn();
    useChat.setState({ stop, messages: [msg({ status: "streaming", content: "…" })] });
    renderWithClient(<ChatView />);
    await userEvent.click(screen.getByRole("button", { name: "Stop generating" }));
    expect(stop).toHaveBeenCalled();
    act(() => useChat.setState({ messages: [msg({ content: "done" })] }));
    await userEvent.click(screen.getByRole("button", { name: /Clear/ }));
    expect(useChat.getState().messages).toEqual([]);
  });
});

describe("ChatPanel and /ask", () => {
  it("opens as a drawer and closes", async () => {
    renderWithClient(<ChatPanel />);
    act(() => useChat.getState().setOpen(true));
    expect(await screen.findByRole("dialog")).toHaveTextContent("AI market assistant");
    await userEvent.click(screen.getByRole("button", { name: "Close Ask TRIYU" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("stays closed on /ask, where the page hosts the conversation", () => {
    navigation.pathname = "/ask";
    useChat.setState({ open: true });
    renderWithClient(
      <>
        <ChatPanel />
        <AskPage />
      </>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Ask TRIYU");
    expect(useChat.getState().open).toBe(false);
  });
});
