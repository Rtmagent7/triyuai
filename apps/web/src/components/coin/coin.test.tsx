import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { coin, renderWithClient } from "@/test/utils";
import { useLivePrices } from "@/stores/live-prices";
import { useWatchlist } from "@/stores/watchlist";
import { useChat } from "@/stores/chat";
import { getCoinDetail } from "@/mocks/data";
import { CoinHeader } from "./coin-header";
import { CoinLogo } from "./coin-logo";
import { MiniConverter } from "./mini-converter";
import { Money, Price } from "./money";
import { PercentBadge } from "./percent-badge";
import { PriceCell } from "./price-cell";
import { Sparkline } from "./sparkline";
import { StatsGrid } from "./stats-grid";
import { WatchlistButton } from "./watchlist-button";

beforeEach(() => {
  useLivePrices.setState({ status: "idle", ticks: {} });
  useWatchlist.setState({ ids: [] });
});

describe("PercentBadge", () => {
  it("shows ▲ and screen-reader text for gains", () => {
    render(<PercentBadge value={3.456} />);
    expect(screen.getByText("▲")).toBeInTheDocument();
    expect(screen.getByText(/up/)).toHaveClass("sr-only");
    expect(screen.getByText("3.46%")).toBeInTheDocument();
  });

  it("shows ▼ for losses, as a pill", () => {
    const { container } = render(<PercentBadge value={-1} variant="pill" />);
    expect(screen.getByText("▼")).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("text-down", "rounded-md");
  });

  it("renders a dash when missing", () => {
    render(<PercentBadge value={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});

describe("Sparkline", () => {
  it("draws a green line when the trend is up", () => {
    const { container } = render(<Sparkline data={[1, 2, 3]} />);
    expect(screen.getByRole("img", { name: "7 day trend up" })).toBeInTheDocument();
    expect(container.querySelector("polyline")).toHaveAttribute("stroke", "var(--up)");
  });

  it("draws red when down and nothing for < 2 points", () => {
    const { container, rerender } = render(<Sparkline data={[3, 1]} />);
    expect(container.querySelector("polyline")).toHaveAttribute("stroke", "var(--down)");
    rerender(<Sparkline data={[1]} />);
    expect(container.querySelector("polyline")).toBeNull();
  });
});

describe("CoinLogo", () => {
  it("loads the small CDN variant directly", () => {
    render(
      <CoinLogo
        src="https://coin-images.coingecko.com/coins/images/1/large/bitcoin.png"
        name="Bitcoin"
      />,
    );
    expect(screen.getByAltText("Bitcoin logo")).toHaveAttribute(
      "src",
      "https://coin-images.coingecko.com/coins/images/1/small/bitcoin.png",
    );
  });
});

describe("PriceCell", () => {
  it("follows live ticks and flashes in the direction of change", () => {
    const { container } = renderWithClient(<PriceCell id="bitcoin" price={100} />);
    expect(screen.getByText("$100.00")).toBeInTheDocument();
    act(() => useLivePrices.setState({ ticks: { bitcoin: { price: 105, change24h: 1, at: 1 } } }));
    expect(screen.getByText("$105.00")).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("animate-flash-up");
    act(() => useLivePrices.setState({ ticks: { bitcoin: { price: 101, change24h: 1, at: 2 } } }));
    expect(container.firstChild).toHaveClass("animate-flash-down");
  });
});

describe("Price / Money", () => {
  it("formats values as client islands", () => {
    renderWithClient(
      <>
        <Price value={1.5} />|<Money value={2_000_000_000} />
      </>,
    );
    expect(screen.getByText("$1.50|$2B")).toBeInTheDocument();
  });
});

describe("WatchlistButton", () => {
  it("toggles the coin and updates its label", async () => {
    renderWithClient(<WatchlistButton id="solana" name="Solana" withLabel />);
    const btn = screen.getByRole("button", { name: "Add Solana to watchlist" });
    expect(btn).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(btn);
    expect(useWatchlist.getState().ids).toEqual(["solana"]);
    expect(screen.getByRole("button", { name: "Remove Solana from watchlist" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("Watchlisted")).toBeInTheDocument();
  });
});

describe("coin page widgets", () => {
  it("StatsGrid shows supply progress, ATH and an infinite max supply", async () => {
    const sol = (await getCoinDetail("solana")).data;
    renderWithClient(<StatsGrid coin={{ ...sol, maxSupply: null }} />);
    expect(screen.getByRole("heading", { name: "Statistics" })).toBeInTheDocument();
    expect(screen.getByText("∞")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: /Circulating share/ })).toBeInTheDocument();
    expect(screen.getByText("All-time high")).toBeInTheDocument();
  });

  it("CoinHeader shows the 24h range, sets chat context and opens Ask TRIYU", async () => {
    const btc = (await getCoinDetail("bitcoin")).data;
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    const { unmount } = renderWithClient(<CoinHeader coin={btc} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("BitcoinBTC");
    expect(screen.getByText(`Rank #${btc.rank}`)).toBeInTheDocument();
    expect(screen.getByText(/24h range/)).toBeInTheDocument();
    expect(useChat.getState().coinContext).toEqual({ id: "bitcoin", name: "Bitcoin" });

    await userEvent.click(screen.getByRole("button", { name: "Share" }));
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    expect(await screen.findByText("Copied")).toBeInTheDocument();

    const send = vi.fn().mockResolvedValue(undefined);
    useChat.setState({ send });
    await userEvent.click(screen.getByRole("button", { name: /Ask TRIYU about Bitcoin/ }));
    expect(useChat.getState().open).toBe(true);
    expect(send).toHaveBeenCalledWith("How is Bitcoin doing today?");

    unmount();
    expect(useChat.getState().coinContext).toBeNull();
  });

  it("MiniConverter converts 1 coin to the selected fiat", () => {
    renderWithClient(<MiniConverter coin={coin("ethereum")} />);
    const out = screen.getByRole("status");
    expect(within(out.parentElement!).getByRole("combobox", { name: "To asset" })).toHaveValue(
      "usd",
    );
    expect(out).toHaveTextContent(
      new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(coin("ethereum").price),
    );
  });
});
