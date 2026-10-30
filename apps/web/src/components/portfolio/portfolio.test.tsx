import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { api } from "@/lib/api/client";
import { coin, renderWithClient } from "@/test/utils";
import { PortfolioView } from "./portfolio-view";

const bitcoin = coin("bitcoin");

async function addTransaction(opts: {
  type?: "buy" | "sell";
  search: string;
  pick: RegExp;
  qty: string;
  price?: string;
}) {
  if (!screen.queryByRole("form", { name: "Add transaction" }))
    await userEvent.click(screen.getByRole("button", { name: /Add transaction/ }));
  const form = screen.getByRole("form", { name: "Add transaction" });
  if (opts.type === "sell")
    await userEvent.click(within(form).getByRole("radio", { name: "sell" }));
  const change = within(form).queryByRole("button", { name: "Change" });
  if (change) await userEvent.click(change);
  await userEvent.type(within(form).getByLabelText("Coin"), opts.search);
  // The best match comes first ("bitcoin" also finds Bitcoin Cash).
  await userEvent.click((await within(form).findAllByRole("button", { name: opts.pick }))[0]!);
  await userEvent.type(within(form).getByLabelText("Quantity"), opts.qty);
  if (opts.price) {
    await userEvent.clear(within(form).getByLabelText(/Price per coin/));
    await userEvent.type(within(form).getByLabelText(/Price per coin/), opts.price);
  }
  await userEvent.click(within(form).getByRole("button", { name: /^Add (buy|sell)$/ }));
}

describe("PortfolioView", () => {
  it("invites guests to sign in or try the demo", async () => {
    renderWithClient(<PortfolioView />);
    expect(await screen.findByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login?next=/portfolio",
    );
    expect(screen.getByRole("button", { name: "Try the demo account" })).toBeInTheDocument();
  });

  it("records buys and sells, values positions and refuses an oversell", async () => {
    await api.auth.demo();
    renderWithClient(<PortfolioView />);
    expect(await screen.findByText(/No transactions yet/)).toBeInTheDocument();

    // Bought 2 BTC at half today's price: worth twice what it cost.
    const half = String(bitcoin.price / 2);
    await addTransaction({ search: "bitcoin", pick: /^Bitcoin/, qty: "2", price: half });
    const positions = await screen.findByRole("table");
    const row = await within(positions).findByRole("row", { name: /Bitcoin/ });
    expect(within(row).getByText("2")).toBeInTheDocument();
    const summary = screen.getByRole("region", { name: "Summary" });
    const pnl = within(summary).getByText("Unrealized P/L").nextElementSibling!;
    expect(pnl).toHaveTextContent(/^\+\$/);
    expect(pnl).toHaveClass("text-up");

    // Selling more than is held is refused with the server's reason.
    await addTransaction({ type: "sell", search: "bitcoin", pick: /^Bitcoin/, qty: "5" });
    expect(await screen.findByRole("alert")).toHaveTextContent(/can't sell 5/);

    // A partial sell books realized profit.
    const form = screen.getByRole("form", { name: "Add transaction" });
    await userEvent.clear(within(form).getByLabelText("Quantity"));
    await userEvent.type(within(form).getByLabelText("Quantity"), "1");
    await userEvent.click(within(form).getByRole("button", { name: "Add sell" }));
    await waitFor(() =>
      expect(screen.getByText("Realized P/L").nextElementSibling).toHaveTextContent(/^\+\$/),
    );

    // Deleting the sell restores the full holding.
    const list = screen.getByRole("heading", { name: "Transactions" })
      .nextElementSibling as HTMLElement;
    await userEvent.click(within(list).getByRole("button", { name: /Delete sell 1 BTC/ }));
    await waitFor(() => expect(within(list).getAllByRole("listitem")).toHaveLength(1));
  }, 30_000);
});
