import { expect, test } from "./fixtures";

test("portfolio: the demo account records a buy and sees its position", async ({ page }) => {
  await page.goto("/portfolio");
  await page.getByRole("button", { name: "Try the demo account" }).click();
  await expect(page.getByText(/No transactions yet/)).toBeVisible();

  await page.getByRole("button", { name: /Add transaction/ }).click();
  const form = page.getByRole("form", { name: "Add transaction" });
  await form.getByLabel("Coin", { exact: true }).fill("ethereum");
  await form
    .getByRole("button", { name: /^Ethereum/ })
    .first()
    .click();
  await form.getByLabel("Quantity").fill("3");
  await form.getByRole("button", { name: "Add buy" }).click();

  await expect(page.getByRole("row", { name: /Ethereum/ })).toBeVisible();
  await expect(page.getByRole("img", { name: /ETH 100\.0%/ })).toBeVisible();
  await page.getByRole("button", { name: /Delete buy 3 ETH/ }).click();
  await expect(page.getByText(/No transactions yet/)).toBeVisible();
});
