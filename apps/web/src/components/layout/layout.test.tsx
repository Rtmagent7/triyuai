import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "next-themes";
import { beforeEach, describe, expect, it } from "vitest";
import { navigation, router } from "@/test/setup";
import { renderWithClient } from "@/test/utils";
import { CommandPalette } from "@/components/search/command-palette";
import { CommandPaletteLoader } from "@/components/search/command-palette-loader";
import { EmptyState, ErrorState } from "@/components/common/states";
import { useLivePrices } from "@/stores/live-prices";
import { usePreferences } from "@/stores/preferences";
import { useRecentSearches } from "@/stores/recent-searches";
import { useUi } from "@/stores/ui";
import { Footer } from "./footer";
import { GlobalStatsBar } from "./global-stats-bar";
import { LiveIndicator } from "./live-indicator";
import { Navbar } from "./navbar";

beforeEach(() => {
  navigation.pathname = "/";
  useUi.setState({ paletteOpen: false });
  useRecentSearches.setState({ items: [] });
  usePreferences.setState({ currency: "usd" });
});

describe("Navbar", () => {
  it("marks the active link and opens search", async () => {
    navigation.pathname = "/insights";
    renderWithClient(
      <ThemeProvider attribute="class">
        <Navbar />
      </ThemeProvider>,
    );
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("link", { name: "Insights" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(nav).getByRole("link", { name: "Markets" })).not.toHaveAttribute("aria-current");
    await userEvent.click(screen.getByRole("button", { name: "Search coins…" }));
    expect(useUi.getState().paletteOpen).toBe(true);
  });

  it("switches currency from the menu", async () => {
    renderWithClient(
      <ThemeProvider attribute="class">
        <Navbar />
      </ThemeProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Currency: USD" }));
    await userEvent.click(await screen.findByRole("menuitemradio", { name: /IDR/ }));
    expect(usePreferences.getState().currency).toBe("idr");
  });
});

describe("GlobalStatsBar and LiveIndicator", () => {
  it("shows global market stats", async () => {
    renderWithClient(<GlobalStatsBar />);
    expect(await screen.findByText(/Market Cap:/)).toBeInTheDocument();
    expect(screen.getByText(/Dominance:/)).toHaveTextContent(/BTC \d+\.\d% · ETH \d+\.\d%/);
  });

  it("reflects the live feed status", () => {
    render(<LiveIndicator />);
    expect(screen.getByText("Snapshot")).toBeInTheDocument();
    act(() => useLivePrices.setState({ status: "live" }));
    expect(screen.getByText("Live")).toBeInTheDocument();
    act(() => useLivePrices.setState({ status: "polling" }));
    expect(screen.getByText("Delayed")).toBeInTheDocument();
  });
});

describe("Footer", () => {
  it("includes the CoinGecko attribution and disclaimer", () => {
    render(<Footer />);
    expect(screen.getByRole("link", { name: "CoinGecko" })).toHaveAttribute(
      "href",
      "https://www.coingecko.com/",
    );
    expect(screen.getByText("Not financial advice.")).toBeInTheDocument();
  });
});

describe("CommandPalette", () => {
  it("opens with Ctrl+K, shows trending, searches and navigates", async () => {
    renderWithClient(<CommandPaletteLoader />);
    expect(screen.queryByRole("dialog")).toBeNull();
    await userEvent.keyboard("{Control>}k{/Control}");
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(within(dialog).getByText("Trending")).toBeInTheDocument());

    await userEvent.type(within(dialog).getByRole("combobox"), "solana");
    const option = await within(dialog).findByRole("option", { name: /Solana/ }, { timeout: 3000 });
    expect(option).toBeInTheDocument();
    await userEvent.keyboard("{Enter}");
    expect(router.push).toHaveBeenCalledWith("/coins/solana");
    expect(useRecentSearches.getState().items[0]?.id).toBe("solana");
    expect(useUi.getState().paletteOpen).toBe(false);
  });

  it("shows an empty message for unknown coins and recent searches when empty", async () => {
    useRecentSearches.setState({
      items: [
        {
          id: "bitcoin",
          symbol: "BTC",
          name: "Bitcoin",
          image: "https://x/large/b.png",
          rank: 1,
          price: 1,
          change24h: 1,
        },
      ],
    });
    useUi.setState({ paletteOpen: true });
    renderWithClient(<CommandPalette />);
    expect(await screen.findByText("Recent")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("option", { name: "Clear recent searches" }));
    expect(useRecentSearches.getState().items).toEqual([]);
    await userEvent.type(screen.getByRole("combobox"), "zzzqqq");
    expect(await screen.findByText(/No coins match/, {}, { timeout: 3000 })).toBeInTheDocument();
  });
});

describe("states", () => {
  it("renders error with retry and empty state with action", async () => {
    let retried = false;
    render(
      <>
        <ErrorState onRetry={() => (retried = true)} />
        <EmptyState
          title="Nothing"
          message="Try again"
          action={<button type="button">Go</button>}
        />
      </>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retried).toBe(true);
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
    expect(screen.getByText("Nothing")).toBeInTheDocument();
  });
});
