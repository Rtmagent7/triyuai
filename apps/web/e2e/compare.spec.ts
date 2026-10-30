import { expect, test } from "./fixtures";

test("compare: defaults, add and remove coins, URL state", async ({ page }) => {
  await page.goto("/compare");
  const table = page.getByRole("table");
  await expect(table.getByRole("columnheader", { name: /Bitcoin/ })).toBeVisible();
  await expect(table.getByRole("columnheader", { name: /Ethereum/ })).toBeVisible();
  await expect(page.getByRole("list", { name: "Change over the range" })).toContainText("BTC");

  await page.getByRole("button", { name: "Add coin" }).click();
  await page.getByRole("textbox", { name: "Search a coin to add" }).fill("solana");
  await page.getByRole("button", { name: /^Solana/ }).click();
  await expect(page).toHaveURL(/coins=bitcoin,ethereum,solana$/);
  await expect(table.getByRole("columnheader", { name: /Solana/ })).toBeVisible();

  await page.getByRole("button", { name: "Remove Ethereum" }).click();
  await expect(page).toHaveURL(/coins=bitcoin,solana$/);
  // Two coins is the minimum.
  await expect(page.getByRole("button", { name: "Remove Bitcoin" })).toBeDisabled();

  await page.getByRole("radio", { name: "1Y" }).click();
  await expect(page.getByRole("radio", { name: "1Y" })).toHaveAttribute("aria-checked", "true");
});

test("compare: a coin page links to it", async ({ page }) => {
  await page.goto("/coins/solana");
  await page.getByRole("link", { name: "Compare with Bitcoin" }).click();
  await expect(page).toHaveURL(/\/compare\?coins=solana,bitcoin$/);
  await expect(page.getByRole("columnheader", { name: /Solana/ })).toBeVisible();
});

test("compare: three coins fit a phone screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/compare?coins=bitcoin,ethereum,solana");
  await expect(page.getByRole("table")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - 390);
  expect(overflow).toBeLessThanOrEqual(0);
});
