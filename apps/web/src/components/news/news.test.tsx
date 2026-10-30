import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { getNews } from "@/mocks/data";
import { renderWithClient } from "@/test/utils";
import { CoinNews, NewsView } from "./news-list";

const news = getNews().data;

describe("NewsView", () => {
  it("lists headlines that open the publisher's page, filters by source, links coins", async () => {
    renderWithClient(<NewsView items={news} symbols={{ bitcoin: "BTC" }} />);
    const first = screen.getAllByRole("link", { name: /opens on/ })[0]!;
    expect(first).toHaveAttribute("href", news[0]!.url);
    expect(first).toHaveAttribute("target", "_blank");

    await userEvent.click(screen.getByRole("radio", { name: "Decrypt" }));
    const shown = screen.getAllByRole("link", { name: /opens on/ });
    expect(shown).toHaveLength(news.filter((n) => n.source === "decrypt").length);
    for (const l of shown) expect(l).toHaveAccessibleName(/opens on Decrypt/);

    await userEvent.click(screen.getByRole("radio", { name: "All sources" }));
    const tagged = news.find((n) => n.coins.includes("bitcoin"));
    if (tagged)
      expect(screen.getAllByRole("link", { name: "BTC" })[0]).toHaveAttribute(
        "href",
        "/coins/bitcoin",
      );
  });
});

describe("CoinNews", () => {
  it("shows up to five stories that mention the coin", async () => {
    const btc = news.filter((n) => n.coins.includes("bitcoin"));
    renderWithClient(<CoinNews coinId="bitcoin" name="Bitcoin" />);
    const section = await screen.findByRole("region", { name: "Latest news on Bitcoin" });
    expect(await within(section).findAllByRole("link", { name: /opens on/ })).toHaveLength(
      Math.min(5, btc.length),
    );
  });

  it("stays hidden when nothing mentions the coin", async () => {
    const { container } = renderWithClient(<CoinNews coinId="not-a-real-coin" name="Nothing" />);
    await new Promise((r) => setTimeout(r, 800));
    expect(container).toBeEmptyDOMElement();
  });
});
