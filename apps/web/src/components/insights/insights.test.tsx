import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import type { GlobalStats } from "@triyuai/shared";
import globalJson from "@/mocks/fixtures/global.json";
import { markets } from "@/mocks/data";
import { fearGreedSnapshot } from "@/lib/market/fear-greed";
import { sectorStats } from "@/lib/market/sectors";
import { server } from "@/test/server";
import { renderWithClient } from "@/test/utils";
import { FearGreedCard } from "./fear-greed-card";
import { AltcoinsVsBitcoinCard, DominanceCard, SectorTable } from "./market-structure";

const global = globalJson as GlobalStats;

describe("FearGreedCard", () => {
  it("shows today's reading, earlier readings and switches the history range", async () => {
    renderWithClient(<FearGreedCard />);
    const today = fearGreedSnapshot[0]!;
    expect(await screen.findByText("Updated daily", { exact: false })).toBeInTheDocument();
    expect(screen.getByText(`Today: ${today.value}, ${today.label}.`)).toBeInTheDocument();
    expect(screen.getByText("Yesterday")).toBeInTheDocument();
    expect(screen.getByText("Last month")).toBeInTheDocument();
    const year = screen.getByRole("radio", { name: "1Y" });
    await userEvent.click(year);
    expect(year).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("img", { name: /Fear and Greed from/ })).toBeInTheDocument();
  });

  it("falls back to the saved reading when the index is unreachable", async () => {
    server.use(http.get("https://api.alternative.me/fng/", () => HttpResponse.error()));
    renderWithClient(<FearGreedCard />);
    expect(await screen.findByText("Saved reading", { exact: false })).toBeInTheDocument();
  });
});

describe("DominanceCard", () => {
  it("splits the market into slices and lists the largest stablecoins", () => {
    renderWithClient(<DominanceCard global={global} coins={markets} />);
    expect(screen.getByRole("img", { name: /Bitcoin 59\.5%/ })).toBeInTheDocument();
    expect(screen.getByText("Tether (USDT)")).toBeInTheDocument();
    const stables = screen.getByRole("heading", {
      name: "Largest stablecoins",
    }).nextElementSibling!;
    expect(within(stables as HTMLElement).getByRole("link", { name: "Tether" })).toHaveAttribute(
      "href",
      "/coins/tether",
    );
  });
});

describe("AltcoinsVsBitcoinCard", () => {
  it("counts the top 50 altcoins that beat Bitcoin, one cell each", () => {
    renderWithClient(<AltcoinsVsBitcoinCard coins={markets} />);
    expect(screen.getByText(/^(Altcoin|Bitcoin|Neither) season$/)).toBeInTheDocument();
    expect(
      within(screen.getByRole("list", { name: "Each coin against Bitcoin" })).getAllByRole("link"),
    ).toHaveLength(50);
  });

  it("renders nothing without Bitcoin", () => {
    const { container } = renderWithClient(
      <AltcoinsVsBitcoinCard coins={markets.filter((c) => c.id !== "bitcoin")} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("SectorTable", () => {
  it("links each sector to its page and can be limited", () => {
    const stats = sectorStats(markets);
    renderWithClient(<SectorTable stats={stats} limit={3} />);
    expect(screen.getAllByRole("row")).toHaveLength(4);
    expect(screen.getByRole("link", { name: stats[0]!.sector.label })).toHaveAttribute(
      "href",
      `/categories/${stats[0]!.sector.id}`,
    );
  });
});
