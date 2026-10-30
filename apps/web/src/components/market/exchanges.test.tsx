import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Exchange } from "@triyuai/shared";
import { getExchanges } from "@/mocks/data";
import { renderWithClient } from "@/test/utils";
import { ExchangesSummary, ExchangesTable } from "./exchanges-table";

const exchanges = getExchanges().data;
const names = () =>
  screen
    .getAllByRole("row")
    .slice(1)
    .map((r) =>
      within(r)
        .getAllByRole("cell")[1]!
        .textContent!.replace("(opens the exchange's website)", "")
        .trim(),
    );

describe("ExchangesTable", () => {
  it("ranks by Trust Score, re-sorts by volume and filters by name", async () => {
    renderWithClient(<ExchangesTable exchanges={exchanges} />);
    expect(screen.getAllByRole("row")).toHaveLength(exchanges.length + 1);
    const byTrust = [...exchanges].sort((a, b) => a.trustScoreRank - b.trustScoreRank);
    expect(names()[0]).toBe(byTrust[0]!.name);

    await userEvent.click(screen.getByRole("radio", { name: "24h volume" }));
    const byVolume = [...exchanges].sort((a, b) => b.volume24hUsd - a.volume24hUsd);
    expect(names().slice(0, 3)).toEqual(byVolume.slice(0, 3).map((e) => e.name));

    await userEvent.type(screen.getByRole("searchbox", { name: "Filter exchanges" }), "kraken");
    expect(names()).toEqual(["Kraken"]);
    await userEvent.clear(screen.getByRole("searchbox", { name: "Filter exchanges" }));
    await userEvent.type(screen.getByRole("searchbox", { name: "Filter exchanges" }), "zzz");
    expect(screen.getByText("No exchange matches “zzz”")).toBeInTheDocument();
  });

  it("links to the exchange in a new tab and shows the Trust Score", () => {
    renderWithClient(<ExchangesTable exchanges={exchanges.slice(0, 1)} />);
    const link = screen.getByRole("link", { name: new RegExp(exchanges[0]!.name) });
    expect(link).toHaveAttribute("href", exchanges[0]!.url);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(
      screen.getByLabelText(`Trust Score ${exchanges[0]!.trustScore} of 10`),
    ).toBeInTheDocument();
  });

  it("shows dashes for unknown fields", () => {
    const unknown: Exchange = {
      id: "x",
      name: "X",
      image: "",
      url: "https://x.example/",
      country: null,
      yearEstablished: null,
      trustScore: null,
      trustScoreRank: 1,
      volume24hBtc: 0,
      volume24hUsd: 0,
    };
    renderWithClient(<ExchangesTable exchanges={[unknown]} />);
    expect(within(screen.getAllByRole("row")[1]!).getAllByText("—")).toHaveLength(3);
  });
});

describe("ExchangesSummary", () => {
  it("adds up volume, the top-10 share and perfect scores", () => {
    renderWithClient(<ExchangesSummary exchanges={exchanges} />);
    const perfect = exchanges.filter((e) => e.trustScore === 10).length;
    expect(screen.getByText("With Trust Score 10").nextElementSibling).toHaveTextContent(
      String(perfect),
    );
    expect(screen.getByText(`24h volume, all ${exchanges.length}`)).toBeInTheDocument();
  });
});
