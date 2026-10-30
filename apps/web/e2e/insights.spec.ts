import { expect, test } from "./fixtures";

test("insights: fear & greed, dominance and sectors", async ({ page }) => {
  await page.goto("/insights");
  await expect(page.getByRole("heading", { name: "Fear & Greed Index" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Dominance" })).toBeVisible();
  await expect(page.getByText("Tether (USDT)")).toBeVisible();
  await page.getByRole("radio", { name: "1Y" }).click();
  await expect(page.getByRole("radio", { name: "1Y" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("link", { name: "Meme", exact: true }).first().click();
  await expect(page).toHaveURL(/\/categories\/meme$/);
  await expect(page.getByRole("heading", { level: 1, name: "Meme" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Dogecoin/ })).toBeVisible();
});

test("a coin page links to its sectors", async ({ page }) => {
  await page.goto("/coins/dogecoin");
  await page.getByRole("list", { name: "Sectors" }).getByRole("link", { name: "Meme" }).click();
  await expect(page).toHaveURL(/\/categories\/meme$/);
});

test("derivatives: heatmap, funding and live liquidations", async ({ page }) => {
  await page.goto("/derivatives");
  await expect(page.getByRole("img", { name: /liquidation heatmap/i })).toBeVisible();
  await expect(page.getByText("Shorts above")).toBeVisible();
  await expect(page.getByRole("button", { name: /^ETH/ })).toBeVisible();
  await page.getByRole("button", { name: /^ETH/ }).click();
  await expect(page.getByRole("heading", { name: "Liquidation heatmap · ETH" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Recent liquidations" })).toContainText("BTC");
});
