import { expect, hydrated, openPalette, test } from "./fixtures";

/** The five critical flows from the PRD §4 "60-second demo script". */

test("1 · homepage shows global stats and live prices that flash on change", async ({
  page,
  binance,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "Today's crypto market" }),
  ).toBeVisible();
  await expect(page.getByText(/Market Cap:/)).toBeVisible();
  await expect(page.getByRole("row")).toHaveCount(101);

  await binance.connected;
  await expect(page.getByTitle("Top 20 prices stream live from Binance")).toBeVisible();

  const btcRow = page.getByRole("row", { name: /Bitcoin BTC/ });
  binance.tick("BTCUSDT", 123456.78, 120000);
  await expect(btcRow.getByText("$123,456.78")).toBeVisible();
  await expect(btcRow.locator(".animate-flash-up")).toBeVisible();
  await expect(btcRow.getByText("2.88%")).toBeVisible();

  binance.tick("BTCUSDT", 100000, 120000);
  await expect(btcRow.locator(".animate-flash-down")).toBeVisible();
  await expect(btcRow.getByText("16.67%")).toBeVisible();
});

test("2 · ⌘K search opens the coin page", async ({ page }) => {
  await page.goto("/");
  await hydrated(page);
  await openPalette(page);
  await expect(page.getByRole("dialog").getByText("Trending")).toBeVisible();
  await page.getByRole("combobox").fill("solana");
  await expect(page.getByRole("option", { name: /Solana/ }).first()).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/coins\/solana$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Solana");
});

test("3 · chart switches range and line/candlestick", async ({ page }) => {
  await page.goto("/coins/solana");
  const chart = page.locator("canvas").first();
  await expect(chart).toBeVisible();
  await expect(page.getByText("7D change")).toBeVisible();

  await page.getByRole("radio", { name: "1Y" }).click();
  await expect(page.getByRole("radio", { name: "1Y" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText("1Y change")).toBeVisible();

  await page.getByRole("radio", { name: "Candles" }).click();
  await expect(page.getByRole("radio", { name: "Candles" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(chart).toBeVisible();

  // Crosshair tooltip replaces the range summary while hovering.
  const box = (await chart.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await expect(page.getByText(/ · O \$/)).toBeVisible();
});

test("4 · Ask TRIYU streams a grounded answer and refuses advice", async ({ page }) => {
  await page.goto("/coins/solana");
  await hydrated(page);
  await page.getByRole("button", { name: "Ask TRIYU about Solana" }).click();
  const panel = page.getByRole("dialog");
  await expect(panel.getByText("How is Solana doing today?")).toBeVisible();
  await expect(panel.getByText("Fetched: Solana price")).toBeVisible();
  await expect(panel.getByRole("table")).toBeVisible();
  await expect(panel.getByText(/Not financial advice\./).last()).toBeVisible({ timeout: 20_000 });
  await expect(panel.getByRole("button", { name: /Regenerate/ })).toBeVisible();

  await panel.getByRole("textbox", { name: "Message Ask TRIYU" }).fill("Should I buy SOL now?");
  await page.keyboard.press("Enter");
  await expect(panel.getByText(/can't tell you whether to buy, sell or hold/)).toBeVisible({
    timeout: 20_000,
  });
  await expect(panel.getByText(/8\/10 guest messages left today/)).toBeVisible();
});

test("5 · watchlist, dark mode and IDR persist across reloads", async ({ page }) => {
  await page.goto("/coins/solana");
  await hydrated(page);
  await page.getByRole("button", { name: "Add Solana to watchlist" }).click();
  await expect(page.getByRole("button", { name: "Remove Solana from watchlist" })).toBeVisible();

  await page.getByRole("button", { name: "Change theme" }).click();
  await page.getByRole("menuitemradio", { name: "Light" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);

  await page.getByRole("button", { name: "Currency: USD" }).click();
  await page.getByRole("menuitemradio", { name: /IDR/ }).click();

  await page.goto("/watchlist");
  const row = page.getByRole("row", { name: /Solana SOL/ });
  await expect(row).toBeVisible();
  await expect(row.getByText(/^Rp\s?[\d,]+$/).first()).toBeVisible();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await expect(page.getByRole("button", { name: "Currency: IDR" })).toBeVisible();
});

test("pagination, highlights, converter URL state and 404", async ({ page }) => {
  await page.goto("/?page=3");
  await expect(
    page.getByRole("navigation", { name: "Pagination" }).getByRole("link", { name: "3" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("row").nth(1)).toContainText("201");

  await page.goto("/highlights");
  await expect(page.getByRole("heading", { name: "Top gainers (24h)" })).toBeVisible();

  await page.goto("/converter?from=ethereum&to=idr&amount=2");
  await expect(page.getByRole("textbox", { name: "Amount" })).toHaveValue("2");
  await page.getByRole("button", { name: "Swap currencies" }).click();
  await expect(page).toHaveURL(/from=idr&to=ethereum&amount=2/);

  const res = await page.goto("/coins/definitely-not-a-coin");
  expect(res?.status()).toBe(404);
  await expect(page.getByText("This page went to the moon without us")).toBeVisible();
});
