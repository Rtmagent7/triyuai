import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseCompareIds } from "@/lib/compare";
import { useChat } from "@/stores/chat";
import { navigation, router } from "@/test/setup";
import { renderWithClient } from "@/test/utils";
import { CompareView } from "./compare-view";

// The canvas chart is covered by Playwright; here it only has to render something.
vi.mock("./performance-chart", () => ({
  PerformanceChart: ({ ids }: { ids: string[] }) => <p>chart of {ids.join(" ")}</p>,
}));

const at = (coins: string) => {
  navigation.pathname = "/compare";
  navigation.searchParams = new URLSearchParams({ coins });
};

afterEach(() => {
  navigation.searchParams = new URLSearchParams();
  useChat.setState({ open: false, messages: [] });
});

describe("parseCompareIds", () => {
  it("keeps 2–4 valid, unique ids and fills in a partner", () => {
    expect(parseCompareIds("solana,bitcoin")).toEqual(["solana", "bitcoin"]);
    expect(parseCompareIds("a,b,c,d,e")).toEqual(["a", "b", "c", "d"]);
    expect(parseCompareIds("solana,solana,Bad!")).toEqual(["solana", "bitcoin"]);
    expect(parseCompareIds("bitcoin")).toEqual(["bitcoin", "ethereum"]);
    expect(parseCompareIds(null)).toEqual(["bitcoin", "ethereum"]);
  });
});

describe("CompareView", () => {
  it("shows the coins side by side and bolds the best value per row", async () => {
    at("bitcoin,ethereum");
    renderWithClient(<CompareView />);
    const table = await screen.findByRole("table");
    expect(within(table).getByRole("columnheader", { name: /Bitcoin/ })).toBeInTheDocument();
    const cap = within(table).getByRole("row", { name: /Market cap/ });
    expect(within(cap).getAllByRole("cell")[0]).toHaveClass("font-semibold");
    expect(within(cap).getByText("(highest)")).toBeInTheDocument();
    expect(screen.getByText("chart of bitcoin ethereum")).toBeInTheDocument();
    // Two coins is the minimum.
    expect(screen.getByRole("button", { name: "Remove Bitcoin" })).toBeDisabled();
  });

  it("adds and removes coins through the URL", async () => {
    at("bitcoin,ethereum,solana");
    renderWithClient(<CompareView />);
    await screen.findByRole("table");
    await userEvent.click(screen.getByRole("button", { name: "Remove Ethereum" }));
    expect(router.replace).toHaveBeenCalledWith("/compare?coins=bitcoin,solana", { scroll: false });

    await userEvent.click(screen.getByRole("button", { name: "Add coin" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Search a coin to add" }), "cardano");
    await userEvent.click(await screen.findByRole("button", { name: /^Cardano/ }));
    expect(router.replace).toHaveBeenCalledWith("/compare?coins=bitcoin,ethereum,solana,cardano", {
      scroll: false,
    });
  });

  it("hands the comparison to Ask TRIYU", async () => {
    at("bitcoin,ethereum");
    renderWithClient(<CompareView />);
    await screen.findByRole("table");
    await userEvent.click(screen.getByRole("button", { name: "Ask TRIYU to compare" }));
    expect(useChat.getState().open).toBe(true);
    expect(useChat.getState().messages[0]?.content).toBe("Compare Bitcoin, Ethereum");
  });

  it("caps the list at four coins", async () => {
    at("bitcoin,ethereum,solana,cardano");
    renderWithClient(<CompareView />);
    await screen.findByRole("table");
    expect(screen.queryByRole("button", { name: "Add coin" })).not.toBeInTheDocument();
  });
});
