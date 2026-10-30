import { expect, test } from "./fixtures";

test("chat history: a signed-in user's chats are saved and reopen after a reload", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Try the demo account" }).click();
  await expect(page).not.toHaveURL(/\/login/);

  await page.goto("/ask");
  const history = page.getByRole("navigation", { name: "Chat history" });
  await expect(history).toContainText("Your questions will be saved here.");

  const input = page.getByRole("textbox", { name: "Message Ask TRIYU" });
  await input.fill("How are meme coins doing?");
  await input.press("Enter");
  await expect(page.getByRole("button", { name: /Regenerate/ })).toBeVisible({ timeout: 20_000 });
  const saved = history.getByRole("button", { name: /^How are meme coins doing\?/ });
  await expect(saved).toHaveAttribute("aria-current", "true");

  // A fresh page starts empty; the conversation comes back from history.
  await page.reload();
  await expect(page.getByText("Try one of these")).toBeVisible();
  await saved.click();
  await expect(page.getByText("Fetched: Meme sector")).toBeVisible();
  await expect(
    page.getByText("**Dogecoin**", { exact: false }).or(page.getByText("Dogecoin").first()),
  ).toBeVisible();

  await history.getByRole("button", { name: "New chat" }).click();
  await expect(page.getByText("Try one of these")).toBeVisible();
  await history
    .getByRole("button", { name: "Delete conversation “How are meme coins doing?”" })
    .click();
  await expect(saved).toHaveCount(0);
});
