import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { GUEST_DAILY_CHAT_QUOTA } from "@triyuai/shared";
import { server } from "@/test/server";
import { useChat } from "./chat";
import { useRecentSearches } from "./recent-searches";
import { useWatchlist } from "./watchlist";
import { usePreferences } from "./preferences";

const initialChat = useChat.getState();

beforeEach(() => {
  useWatchlist.setState({ ids: [] });
  useRecentSearches.setState({ items: [] });
  useChat.setState({ ...initialChat, messages: [], coinContext: null, open: false });
});
afterEach(() => useChat.getState().stop());

describe("watchlist store", () => {
  it("toggles coins and reports whether they were added", () => {
    const { toggle } = useWatchlist.getState();
    expect(toggle("bitcoin")).toBe(true);
    expect(toggle("solana")).toBe(true);
    expect(useWatchlist.getState().has("bitcoin")).toBe(true);
    expect(toggle("bitcoin")).toBe(false);
    expect(useWatchlist.getState().ids).toEqual(["solana"]);
    useWatchlist.getState().remove("solana");
    expect(useWatchlist.getState().ids).toEqual([]);
  });

  it("persists to localStorage", () => {
    useWatchlist.getState().toggle("ethereum");
    expect(JSON.parse(localStorage.getItem("triyu:watchlist")!).state.ids).toEqual(["ethereum"]);
  });
});

describe("recent searches store", () => {
  it("keeps the 5 most recent unique coins, newest first", () => {
    const { add } = useRecentSearches.getState();
    const c = (id: string) => ({
      id,
      symbol: id,
      name: id,
      image: "",
      rank: 1,
      price: 1,
      change24h: 0,
    });
    ["a", "b", "c", "d", "e", "f", "b"].forEach((id) => add(c(id)));
    expect(useRecentSearches.getState().items.map((i) => i.id)).toEqual(["b", "f", "e", "d", "c"]);
    useRecentSearches.getState().clear();
    expect(useRecentSearches.getState().items).toEqual([]);
  });
});

describe("preferences store", () => {
  it("switches currency", () => {
    usePreferences.getState().setCurrency("idr");
    expect(usePreferences.getState().currency).toBe("idr");
    usePreferences.getState().setCurrency("usd");
  });
});

describe("chat store", () => {
  it("streams an answer with tool chips from the API", async () => {
    await useChat.getState().send("How is Bitcoin doing?");
    const [user, bot] = useChat.getState().messages;
    expect(user).toMatchObject({ role: "user", content: "How is Bitcoin doing?" });
    expect(bot!.status).toBe("done");
    expect(bot!.tools).toEqual([{ id: "call_0", label: "Fetched: Bitcoin price", done: true }]);
    expect(bot!.content).toMatch(/\*\*Bitcoin \(BTC\)\*\* is trading at/);
  }, 20_000);

  it("sends the coin page as context", async () => {
    let body: unknown;
    server.events.on("request:start", async ({ request }) => {
      if (request.url.endsWith("/ai/chat")) body = await request.clone().json();
    });
    useChat.getState().setCoinContext({ id: "solana", name: "Solana" });
    await useChat.getState().send("how is it doing?");
    server.events.removeAllListeners();
    expect(body).toMatchObject({ context: { coinId: "solana" } });
    expect(useChat.getState().messages[1]!.tools[0]!.label).toBe("Fetched: Solana price");
  }, 20_000);

  it("ignores empty input", async () => {
    await useChat.getState().send("   ");
    expect(useChat.getState().messages).toEqual([]);
  });

  it("can be stopped mid-stream", async () => {
    const pending = useChat.getState().send("What's moving the market today?");
    await new Promise((r) => setTimeout(r, 150));
    useChat.getState().stop();
    await pending;
    const bot = useChat.getState().messages[1]!;
    expect(bot.status).toBe("stopped");
    expect(bot.tools.every((t) => t.done)).toBe(true);
  }, 20_000);

  it("regenerates the last answer", async () => {
    await useChat.getState().send("Explain market cap vs FDV");
    const first = useChat.getState().messages[1]!.id;
    await useChat.getState().regenerate();
    const msgs = useChat.getState().messages;
    expect(msgs).toHaveLength(2);
    expect(msgs[1]!.id).not.toBe(first);
    expect(msgs[1]!.status).toBe("done");
  }, 20_000);

  it("shows a friendly error when the AI is rate-limited", async () => {
    server.use(http.post("*/api/v1/ai/chat", () => HttpResponse.json({}, { status: 429 })));
    await useChat.getState().send("hi");
    expect(useChat.getState().messages[1]).toMatchObject({
      status: "error",
      error: "AI is busy right now. Please try again in a minute.",
    });
  });

  it("enforces the guest daily quota", async () => {
    useChat.setState({
      quota: { day: new Date().toISOString().slice(0, 10), used: GUEST_DAILY_CHAT_QUOTA },
    });
    expect(useChat.getState().remaining()).toBe(0);
    await useChat.getState().send("one more?");
    const bot = useChat.getState().messages[1]!;
    expect(bot.status).toBe("error");
    expect(bot.error).toMatch(/used all 10 guest messages/);
  });

  it("resets the quota on a new day", () => {
    useChat.setState({ quota: { day: "2000-01-01", used: GUEST_DAILY_CHAT_QUOTA } });
    expect(useChat.getState().remaining()).toBe(GUEST_DAILY_CHAT_QUOTA);
  });

  it("opens with a prompt and coin, and clears", async () => {
    useChat.getState().openWith({ coin: { id: "bitcoin", name: "Bitcoin" } });
    expect(useChat.getState()).toMatchObject({ open: true, coinContext: { id: "bitcoin" } });
    useChat.getState().clear();
    expect(useChat.getState().messages).toEqual([]);
  });
});
