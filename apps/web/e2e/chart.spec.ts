import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const drawings = (page: Page, coin: string) =>
  page.evaluate(
    (c) =>
      JSON.parse(localStorage.getItem("triyu:chart-layout") ?? "{}")?.state?.drawings?.[c]
        ?.length ?? 0,
    coin,
  );

async function chartBox(page: Page) {
  const box = await page.getByTestId("trading-chart").boundingBox();
  if (!box) throw new Error("chart not visible");
  return box;
}

test("full chart: timeframes, indicators and drawings that persist", async ({ page }) => {
  await page.goto("/chart/bitcoin");
  const legend = page.getByTestId("ohlc-legend");
  await expect(legend).toContainText("BTC/USDT · 1H · Binance");

  const fourHour = page.waitForRequest((r) => r.url().includes("interval=4h"));
  await page.getByRole("radio", { name: "4H" }).click();
  await fourHour;
  await expect(legend).toContainText("BTC/USDT · 4H · Binance");

  await page.getByRole("button", { name: "Indicators" }).click();
  await page.getByRole("menu").getByText("Relative Strength Index", { exact: true }).click();
  await expect(page.getByText("RSI 14")).toBeVisible();

  // Trend line: two clicks in the price pane.
  const box = await chartBox(page);
  await page.getByRole("button", { name: "Trend line" }).click();
  await expect(page.getByText("Click to set the first point")).toBeVisible();
  await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.45);
  await expect(page.getByText("Click to set the second point · Esc to cancel")).toBeVisible();
  await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.25);
  await expect.poll(() => drawings(page, "bitcoin")).toBe(1);

  // Horizontal line with the keyboard shortcut, then a text note.
  await page.keyboard.press("Alt+h");
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.6);
  await page.getByRole("button", { name: "Text note" }).click();
  await page.mouse.click(box.x + box.width * 0.2, box.y + box.height * 0.2);
  await page.getByRole("textbox", { name: "Note text" }).fill("Breakout?");
  await page.keyboard.press("Enter");
  await expect.poll(() => drawings(page, "bitcoin")).toBe(3);

  // Layout survives a reload.
  await page.reload();
  await expect(legend).toContainText("4H");
  await expect(page.getByText("RSI 14")).toBeVisible();
  expect(await drawings(page, "bitcoin")).toBe(3);

  // Select the trend line by clicking its middle, then delete it.
  await page.mouse.click(box.x + box.width * 0.45, box.y + box.height * 0.35);
  await expect(page.getByRole("button", { name: "Delete selected drawing" })).toBeEnabled();
  await page.keyboard.press("Delete");
  await expect.poll(() => drawings(page, "bitcoin")).toBe(2);

  await page.getByRole("button", { name: "Remove all drawings" }).click();
  await expect.poll(() => drawings(page, "bitcoin")).toBe(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect.poll(() => drawings(page, "bitcoin")).toBe(2);
});

test("chart style, scale and crosshair legend", async ({ page }) => {
  await page.goto("/chart/ethereum");
  const legend = page.getByTestId("ohlc-legend");
  await expect(legend).toContainText("ETH/USDT");
  const latest = await legend.textContent();

  const box = await chartBox(page);
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.4);
  await expect(legend).not.toHaveText(latest!);

  await page.getByRole("button", { name: "Chart style: Candles" }).click();
  await page.getByRole("menuitemradio", { name: "Heikin Ashi" }).click();
  await expect(page.getByRole("button", { name: "Chart style: Heikin Ashi" })).toBeVisible();
  await page.getByRole("radio", { name: "Log" }).click();
  await expect(page.getByRole("radio", { name: "Log" })).toHaveAttribute("aria-checked", "true");
});

test("coin page: compact chart opens the full chart; unlisted coins fall back", async ({
  page,
}) => {
  await page.goto("/coins/solana");
  await expect(page.getByTestId("ohlc-legend")).toContainText("SOL/USDT");
  await expect(page.getByRole("button", { name: "Trend line" })).toHaveCount(0);
  await page.getByRole("link", { name: "Full chart" }).click();
  await expect(page).toHaveURL(/\/chart\/solana$/);
  await expect(page.getByRole("button", { name: "Trend line" })).toBeVisible();

  // Monero has no Binance pair: the CoinGecko chart is shown instead.
  await page.goto("/coins/monero");
  await expect(page.getByRole("radiogroup", { name: "Range" })).toBeVisible();
  await expect(page.getByTestId("trading-chart")).toHaveCount(0);
});

test("detailed styling: drawing toolbar, drawing settings and indicator settings", async ({
  page,
}) => {
  await page.goto("/chart/bitcoin");
  await expect(page.getByTestId("ohlc-legend")).toBeVisible();
  const box = await chartBox(page);

  // Style for the next drawing from the left toolbar.
  await page.getByRole("button", { name: /New drawing colour/ }).click();
  await page.getByRole("radio", { name: "#f23645" }).click();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Rectangle" }).click();
  await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.3);
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);

  // The new drawing is selected: floating toolbar → settings dialog.
  const options = page.getByRole("toolbar", { name: "Rectangle options" });
  await expect(options).toBeVisible();
  await options.getByRole("button", { name: "Drawing settings" }).click();
  const dialog = page.getByRole("dialog", { name: "Rectangle settings" });
  await dialog.getByRole("checkbox", { name: "Lock in place" }).check();
  await dialog.getByRole("button", { name: "OK" }).click();

  const stored = () =>
    page.evaluate(
      () => JSON.parse(localStorage.getItem("triyu:chart-layout")!).state.drawings.bitcoin[0],
    );
  await expect
    .poll(stored)
    .toMatchObject({ type: "rect", color: "#f23645", locked: true, fillOpacity: 0.15 });

  await options.getByRole("button", { name: "Clone drawing" }).click();
  await expect.poll(() => drawings(page, "bitcoin")).toBe(2);

  // Indicator settings: inputs and style.
  await page.getByRole("button", { name: "Indicators" }).click();
  await page.getByRole("menu").getByText("Relative Strength Index", { exact: true }).click();
  await page.getByText("RSI 14").hover();
  await page.getByRole("button", { name: "Settings for RSI 14" }).click();
  const rsi = page.getByRole("dialog");
  await rsi.getByRole("spinbutton", { name: "Length" }).fill("21");
  await rsi.getByRole("combobox", { name: "Source" }).selectOption("hl2");
  await rsi.getByRole("tab", { name: "Style" }).click();
  await rsi.getByRole("spinbutton", { name: "Level 2" }).fill("80");
  await rsi.getByRole("button", { name: "OK" }).click();
  await expect(page.getByText("RSI 21")).toBeVisible();
});
