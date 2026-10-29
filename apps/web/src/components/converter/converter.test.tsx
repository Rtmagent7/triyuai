import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { coin, renderWithClient } from "@/test/utils";
import { navigation, router } from "@/test/setup";
import { toSummary } from "@/mocks/data";
import { Converter, buildAssets, convert, formatAmount } from "./converter";
import { ConverterPage } from "./converter-page";

const coins = [toSummary(coin("bitcoin")), toSummary(coin("ethereum"))];
const rates = { usd: 1, idr: 16_000, eur: 0.9 };

describe("converter math", () => {
  const assets = buildAssets(coins, rates);
  const get = (id: string) => assets.find((a) => a.id === id)!;

  it("puts fiats first, then coins", () => {
    expect(assets.map((a) => a.id)).toEqual(["usd", "idr", "eur", "bitcoin", "ethereum"]);
  });

  it("converts coin → fiat, fiat → fiat and coin → coin", () => {
    const btc = coin("bitcoin").price;
    const eth = coin("ethereum").price;
    expect(convert(2, get("bitcoin"), get("usd"))).toBeCloseTo(2 * btc);
    expect(convert(1, get("usd"), get("idr"))).toBeCloseTo(16_000);
    expect(convert(1, get("bitcoin"), get("ethereum"))).toBeCloseTo(btc / eth);
  });

  it("formats amounts by magnitude", () => {
    expect(formatAmount(1234.5678)).toBe("1,234.57");
    expect(formatAmount(12.3456789)).toBe("12.345679");
    expect(formatAmount(0.000012345678)).toBe("0.0000123457");
    expect(formatAmount(0)).toBe("0");
    expect(formatAmount(Number.NaN)).toBe("—");
  });
});

describe("Converter", () => {
  it("emits amount, swap and asset changes", async () => {
    const onChange = vi.fn();
    renderWithClient(
      <Converter coins={coins} from="bitcoin" to="usd" amount="1" onChange={onChange} />,
    );
    expect(screen.getByText(/^1 BTC = /)).toBeInTheDocument();

    await userEvent.type(screen.getByRole("textbox", { name: "Amount" }), "2a");
    expect(onChange).toHaveBeenCalledWith({ amount: "12" });
    expect(onChange).not.toHaveBeenCalledWith({ amount: "12a" });

    await userEvent.click(screen.getByRole("button", { name: "Swap currencies" }));
    expect(onChange).toHaveBeenCalledWith({ from: "usd", to: "bitcoin" });

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "To asset" }), "ethereum");
    expect(onChange).toHaveBeenCalledWith({ to: "ethereum" });
  });
});

describe("ConverterPage", () => {
  it("reads initial state from the URL and writes changes back", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    navigation.pathname = "/converter";
    navigation.searchParams = new URLSearchParams("from=ethereum&to=eur&amount=3");
    renderWithClient(<ConverterPage coins={coins} />);
    expect(screen.getByRole("textbox", { name: "Amount" })).toHaveValue("3");
    expect(screen.getByRole("combobox", { name: "From asset" })).toHaveValue("ethereum");
    act(() => vi.advanceTimersByTime(350));
    expect(router.replace).toHaveBeenLastCalledWith("/converter?from=ethereum&to=eur&amount=3", {
      scroll: false,
    });
    navigation.pathname = "/";
    navigation.searchParams = new URLSearchParams();
  });
});
