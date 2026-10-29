import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient, coin } from "@/test/utils";
import { queryKeys } from "@/lib/api/keys";
import { useLivePrices } from "@/stores/live-prices";
import { usePreferences } from "@/stores/preferences";
import {
  useChart,
  useCoin,
  useCoinsByIds,
  useCoinsPage,
  useGlobalStats,
  useHighlights,
  useSearch,
} from "./queries";
import { useDebounce } from "./use-debounce";
import { useLivePriceFeed, useLiveTick } from "./use-live-prices";
import { useMoney } from "./use-money";

const wrapper = () => {
  const client = createTestQueryClient();
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, Wrapper };
};

describe("query hooks (via MSW)", () => {
  it("loads global stats, highlights and a coin", async () => {
    const { Wrapper } = wrapper();
    const { result } = renderHook(
      () => ({ g: useGlobalStats(), h: useHighlights(), c: useCoin("ethereum") }),
      {
        wrapper: Wrapper,
      },
    );
    await waitFor(() => expect(result.current.c.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.g.data?.data.btcDominance).toBeGreaterThan(0));
    await waitFor(() => expect(result.current.h.data?.data.gainers.length).toBeGreaterThan(0));
    expect(result.current.c.data?.data.name).toBe("Ethereum");
  });

  it("surfaces API errors", async () => {
    const { Wrapper } = wrapper();
    const { result } = renderHook(() => useCoin("not-a-coin"), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ status: 404, code: "NOT_FOUND" });
  });

  it("uses server-provided initial data for the coins page", async () => {
    const { Wrapper } = wrapper();
    const initial = { coins: [coin("bitcoin")], page: 1, perPage: 100, total: 1 };
    const { result } = renderHook(() => useCoinsPage(1, initial), { wrapper: Wrapper });
    expect(result.current.data?.data.coins[0]!.id).toBe("bitcoin");
  });

  it("fetches watchlist coins by id, and skips the request when empty", async () => {
    const { Wrapper } = wrapper();
    const { result } = renderHook(
      () => ({ some: useCoinsByIds(["solana"]), none: useCoinsByIds([]) }),
      {
        wrapper: Wrapper,
      },
    );
    await waitFor(() => expect(result.current.some.data?.data[0]!.id).toBe("solana"));
    expect(result.current.none.fetchStatus).toBe("idle");
  });

  it("caches chart ranges separately", async () => {
    const { Wrapper, client } = wrapper();
    const { result, rerender } = renderHook(({ r }) => useChart("bitcoin", r), {
      wrapper: Wrapper,
      initialProps: { r: "7d" as const } as { r: "7d" | "1y" },
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    rerender({ r: "1y" });
    await waitFor(() => expect(result.current.data?.data.range).toBe("1y"));
    expect(client.getQueryData(queryKeys.chart("bitcoin", "7d"))).toBeDefined();
  });

  it("searches only with a query", async () => {
    const { Wrapper } = wrapper();
    const { result, rerender } = renderHook(({ q }) => useSearch(q), {
      wrapper: Wrapper,
      initialProps: { q: "" },
    });
    expect(result.current.fetchStatus).toBe("idle");
    rerender({ q: "doge" });
    await waitFor(() => expect(result.current.data?.data[0]?.id).toBe("dogecoin"));
  });
});

describe("useMoney", () => {
  afterEach(() => usePreferences.setState({ currency: "usd" }));

  it("formats with the selected currency and cached rates", () => {
    const { Wrapper, client } = wrapper();
    client.setQueryData(queryKeys.rates, { data: { usd: 1, idr: 16_000, eur: 0.5 }, meta: {} });
    usePreferences.setState({ currency: "eur" });
    const { result } = renderHook(() => useMoney(), { wrapper: Wrapper });
    expect(result.current.price(10)).toBe("€5.00");
    expect(result.current.compact(2_000_000)).toBe("€1M");
    expect(result.current.money(1000)).toBe("€500");
  });
});

describe("useDebounce", () => {
  it("delays updates", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 250), {
      initialProps: { v: "a" },
    });
    rerender({ v: "ab" });
    expect(result.current).toBe("a");
    act(() => vi.advanceTimersByTime(250));
    expect(result.current).toBe("ab");
  });
});

describe("useLivePriceFeed", () => {
  class FakeWS {
    static last: FakeWS;
    onopen?: () => void;
    onmessage?: (m: { data: string }) => void;
    onclose?: () => void;
    onerror?: () => void;
    constructor(public url: string) {
      FakeWS.last = this;
    }
    close() {
      this.onclose?.();
    }
  }
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", FakeWS);
    useLivePrices.setState({ status: "idle", ticks: {} });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("streams the top coins with a USDT pair into the store", () => {
    const coins = [coin("bitcoin"), coin("tether"), coin("ethereum")];
    const { unmount } = renderHook(() => useLivePriceFeed(coins));
    expect(FakeWS.last.url).toContain("btcusdt@miniTicker/ethusdt@miniTicker");
    expect(FakeWS.last.url).not.toContain("usdtusdt");
    act(() => FakeWS.last.onopen?.());
    expect(useLivePrices.getState().status).toBe("live");

    act(() => {
      FakeWS.last.onmessage?.({
        data: JSON.stringify({ data: { s: "BTCUSDT", c: "100000", o: "95000" } }),
      });
      vi.advanceTimersByTime(500);
    });
    const { result } = renderHook(() => useLiveTick("bitcoin"));
    expect(result.current?.price).toBe(100000);
    expect(result.current?.change24h).toBeCloseTo(5.263, 2);

    unmount();
    expect(useLivePrices.getState().status).toBe("idle");
  });

  it("does nothing without coins", () => {
    FakeWS.last = undefined as unknown as FakeWS;
    renderHook(() => useLivePriceFeed(undefined));
    expect(FakeWS.last).toBeUndefined();
  });
});
