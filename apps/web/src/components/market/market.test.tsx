import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { coin, renderWithClient } from "@/test/utils";
import { getCoins, getHighlights } from "@/mocks/data";
import { useChat } from "@/stores/chat";
import { useWatchlist } from "@/stores/watchlist";
import { HighlightCards } from "./highlight-cards";
import { MarketTable } from "./market-table";
import { MarketsSection } from "./markets-section";
import { WatchlistView } from "./watchlist-view";

const coins = [coin("bitcoin"), coin("ethereum"), coin("solana"), coin("dogecoin")];
const names = () =>
  screen
    .getAllByRole("row")
    .slice(1)
    .map((r) => within(r).getByRole("link").textContent);

describe("MarketTable", () => {
  it("renders the PRD columns and one row per coin", () => {
    renderWithClient(<MarketTable coins={coins} />);
    for (const h of [
      "#",
      "Coin",
      "Price",
      "1h %",
      "24h %",
      "7d %",
      "24h Volume",
      "Market Cap",
      "Last 7 Days",
    ]) {
      expect(
        screen.getByRole("columnheader", { name: new RegExp(`^${h.replace(/[#%]/g, "\\$&")}`) }),
      ).toBeInTheDocument();
    }
    expect(screen.getAllByRole("row")).toHaveLength(coins.length + 1);
  });

  it("sorts by a column and toggles direction (aria-sort)", async () => {
    renderWithClient(<MarketTable coins={coins} />);
    const priceHeader = screen.getByRole("columnheader", { name: /Price/ });
    await userEvent.click(within(priceHeader).getByRole("button"));
    const firstSort = names();
    const byPrice = [...coins].sort((a, b) => b.price - a.price).map((c) => c.name);
    const asc = [...byPrice].reverse();
    expect([byPrice, asc].map((o) => o.join())).toContain(
      firstSort.map((n) => n!.replace(/[A-Z]+$/, "")).join(),
    );
    expect(priceHeader).toHaveAttribute("aria-sort");
    await userEvent.click(within(priceHeader).getByRole("button"));
    expect(names()).toEqual([...firstSort].reverse());
  });

  it("filters by name or symbol and shows the empty state", () => {
    const { rerender } = renderWithClient(<MarketTable coins={coins} filter="doge" />);
    expect(screen.getAllByRole("row")).toHaveLength(2);
    rerender(<MarketTable coins={coins} filter="ETH" />);
    expect(screen.getByRole("link", { name: /Ethereum/ })).toBeInTheDocument();
    rerender(<MarketTable coins={coins} filter="zzz" emptyState={<p>nothing here</p>} />);
    expect(screen.getByText("nothing here")).toBeInTheDocument();
  });

  it("shows skeleton rows while loading", () => {
    const { container } = renderWithClient(<MarketTable coins={[]} isLoading />);
    expect(container.querySelectorAll("tbody tr")).toHaveLength(10);
    expect(container.querySelectorAll("[aria-hidden].animate-pulse").length).toBeGreaterThan(0);
  });

  it("links each coin to its page", () => {
    renderWithClient(<MarketTable coins={[coin("solana")]} />);
    expect(screen.getByRole("link", { name: /Solana/ })).toHaveAttribute("href", "/coins/solana");
  });
});

describe("MarketsSection", () => {
  it("filters the page and offers to clear an empty filter", async () => {
    const initial = getCoins(1).data;
    renderWithClient(
      <MarketsSection page={1} initial={initial} snapshotAt={new Date().toISOString()} />,
    );
    expect(screen.getAllByRole("row")).toHaveLength(101);
    await userEvent.type(screen.getByRole("searchbox", { name: /Filter coins/ }), "qqqqzz");
    expect(screen.getByText(/No coins match/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Clear filter" }));
    expect(screen.getAllByRole("row")).toHaveLength(101);
  });

  it("renders pagination with the current page and disabled edges", () => {
    renderWithClient(
      <MarketsSection page={3} initial={getCoins(3).data} snapshotAt={new Date().toISOString()} />,
    );
    const nav = screen.getByRole("navigation", { name: "Pagination" });
    expect(within(nav).getByRole("link", { name: "3" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "1" })).toHaveAttribute("href", "/");
    expect(within(nav).getByRole("link", { name: "Previous page" })).toHaveAttribute(
      "href",
      "/?page=2",
    );
    expect(within(nav).queryByRole("link", { name: "Next page" })).toBeNull();
  });
});

describe("HighlightCards", () => {
  it("shows three coins per list and the Ask TRIYU promo", async () => {
    const h = getHighlights().data;
    const send = vi.fn().mockResolvedValue(undefined);
    useChat.setState({ send });
    renderWithClient(<HighlightCards highlights={h} />);
    for (const t of ["Trending", "Top gainers · 24h", "Top losers · 24h", "Ask TRIYU"]) {
      expect(screen.getByRole("heading", { name: t })).toBeInTheDocument();
    }
    expect(screen.getByRole("link", { name: new RegExp(h.gainers[0]!.name) })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /moving the market today/ }));
    expect(useChat.getState().open).toBe(true);
    expect(send).toHaveBeenCalledWith("What's moving the market today?");
  });
});

describe("WatchlistView", () => {
  beforeEach(() => {
    useWatchlist.setState({ ids: [] });
    void useWatchlist.persist.rehydrate();
  });

  it("when empty, offers the five largest coins to star", async () => {
    renderWithClient(<WatchlistView />);
    expect(await screen.findByText(/Nothing starred yet/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(6));
    expect(screen.getByRole("button", { name: "Add Bitcoin to watchlist" })).toBeInTheDocument();
  });

  it("lists starred coins by rank", async () => {
    useWatchlist.setState({ ids: ["solana", "bitcoin"] });
    renderWithClient(<WatchlistView />);
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(3));
    expect(names().map((n) => n!.replace(/[A-Z]+$/, ""))).toEqual(["Bitcoin", "Solana"]);
  });
});
