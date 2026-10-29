import { afterEach, describe, expect, it } from "vitest";
import type { ChatRequest, ChatStreamEvent } from "@triyuai/shared";
import { useLivePrices } from "@/stores/live-prices";
import { answerEvents, detectCoins, planAnswer, tokenize } from "./chat-engine";

const ask = (content: string, extra: Partial<ChatRequest> = {}): ChatRequest => ({
  messages: [{ role: "user", content }],
  ...extra,
});

afterEach(() => useLivePrices.setState({ ticks: {}, status: "idle" }));

describe("detectCoins", () => {
  it("finds coins by name and ticker in order of mention", () => {
    expect(detectCoins("Compare ETH and Bitcoin").map((c) => c.id)).toEqual([
      "ethereum",
      "bitcoin",
    ]);
  });

  it("ignores stop words that collide with tickers", () => {
    expect(detectCoins("what is the market doing today").map((c) => c.id)).toEqual([]);
  });

  it("prefers the highest-ranked coin for an ambiguous ticker", () => {
    expect(detectCoins("sol")[0]?.id).toBe("solana");
  });
});

describe("planAnswer", () => {
  it("refuses buy/sell advice but still shares data", () => {
    const plan = planAnswer(ask("Should I buy SOL now?"));
    expect(plan.text).toMatch(/can't tell you whether to buy/);
    expect(plan.text).toMatch(/Solana/);
    expect(plan.tools.map((t) => t.name)).toEqual(["getCoinDetails"]);
  });

  it("refuses predictions without a coin", () => {
    const plan = planAnswer(ask("price prediction for next year?"));
    expect(plan.tools).toEqual([]);
    expect(plan.text).toMatch(/not a financial adviser/);
  });

  it("explains market cap vs FDV without tools", () => {
    const plan = planAnswer(ask("Explain market cap vs FDV"));
    expect(plan.tools).toEqual([]);
    expect(plan.text).toMatch(/fully diluted valuation/i);
  });

  it("compares two coins in a table", () => {
    const plan = planAnswer(ask("Compare BTC and ETH"));
    expect(plan.tools[0]).toMatchObject({
      name: "compareCoins",
      label: "Fetched: BTC vs ETH data",
    });
    expect(plan.text).toMatch(/\| Metric \| BTC \| ETH \|/);
  });

  it("answers about one coin and adds market context for 'why'", () => {
    const plan = planAnswer(ask("Why is Solana moving?"));
    expect(plan.tools.map((t) => t.name)).toEqual(["getCoinDetails", "getMarketOverview"]);
    expect(plan.text).toMatch(/whole market moved/);
  });

  it("gives a market overview", () => {
    const plan = planAnswer(ask("What's moving the market today?"));
    expect(plan.tools.map((t) => t.name)).toEqual(["getMarketOverview", "getTopMovers"]);
    expect(plan.text).toMatch(/Top gainers/);
  });

  it("resolves follow-ups from earlier turns", () => {
    const plan = planAnswer({
      messages: [
        { role: "user", content: "How is Ethereum doing?" },
        { role: "assistant", content: "…" },
        { role: "user", content: "and its all-time high?" },
      ],
    });
    expect(plan.tools[0]?.label).toBe("Fetched: Ethereum price");
  });

  it("uses the coin page context when nothing else matches", () => {
    const plan = planAnswer(ask("how is it doing?", { context: { coinId: "dogecoin" } }));
    expect(plan.tools[0]?.label).toBe("Fetched: Dogecoin price");
  });

  it("falls back to help text for unknown topics", () => {
    const plan = planAnswer(ask("tell me about qwertyuiop"));
    expect(plan.tools[0]).toMatchObject({ name: "searchCoin", label: 'Searched: "tell"' });
    expect(plan.text).toMatch(/couldn't match/);
  });

  it("quotes the live Binance price when one is streaming", () => {
    useLivePrices.setState({
      ticks: { solana: { price: 123.45, change24h: 9.9, at: Date.now() } },
    });
    const plan = planAnswer(ask("How is Solana doing?"));
    expect(plan.live).toBe(true);
    expect(plan.text).toContain("$123.45");
  });
});

describe("answerEvents", () => {
  const events = (req: ChatRequest) => [...answerEvents(req)].map((e) => e.event);

  it("emits tool-call → tool-result → text → finish", () => {
    const ev = events(ask("How is Bitcoin doing?"));
    const types = ev.map((e) => e.type);
    expect(types[0]).toBe("tool-call");
    expect(types[1]).toBe("tool-result");
    expect(types.at(-1)).toBe("finish");
    expect(types.slice(2, -1).every((t) => t === "text-delta")).toBe(true);
  });

  it("always ends with a timestamp and disclaimer", () => {
    const text = events(ask("Explain market cap vs FDV"))
      .filter((e): e is Extract<ChatStreamEvent, { type: "text-delta" }> => e.type === "text-delta")
      .map((e) => e.delta)
      .join("");
    expect(text).toMatch(/Data as of .* UTC \(prototype snapshot\)\. Not financial advice\._$/);
  });

  it("mentions Binance when live prices were used", () => {
    useLivePrices.setState({ ticks: { bitcoin: { price: 1, change24h: 0, at: 0 } } });
    const text = events(ask("How is Bitcoin doing?"))
      .map((e) => (e.type === "text-delta" ? e.delta : ""))
      .join("");
    expect(text).toMatch(/Prices live from Binance/);
  });
});

describe("tokenize", () => {
  it("keeps whitespace so the stream reassembles exactly", () => {
    const text = "Hello  world\n\n| a | b |";
    expect(tokenize(text).join("")).toBe(text);
  });
});
