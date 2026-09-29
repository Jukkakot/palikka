import { expect, test } from "@playwright/test";
import { board, uniquePool } from "./helpers.ts";

/**
 * Production smoke, run by the prod-smoke workflow after a deploy (config `playwright.prod.config.ts`):
 * on the live site a quick game against a bot starts on the device at once; then a player wakes
 * the server, opens a game with Pelaa, seats a bot, starts, sees the board, leaves, and stays on
 * the start screen after a reload.
 */
test("live site: bot game on the device, then a server game with a bot, then leave", async ({ page }) => {
  const pool = uniquePool("prod");
  await page.goto(`./?pool=${pool}`);
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
  await page.getByRole("textbox", { name: "Nimimerkki" }).fill("Savutesti");

  // A quick bot game runs on the device: no waiting for the server.
  const oneBot = page.getByRole("button", { name: "Pikapeli: sinä ja 1 botti" });
  await oneBot.click();
  await expect(board(page).locator("[data-cell]")).toHaveCount(400, { timeout: 10_000 });
  await expect(page.getByText("Kettu, botti", { exact: false })).toBeAttached();
  await page.getByRole("button", { name: "Poistu pelistä" }).click();
  await page.getByRole("button", { name: "Poistu", exact: true }).click();

  // A sleeping server takes up to about a minute; Pelaa waits for it.
  const play = page.getByRole("button", { name: "Pelaa", exact: true });
  await expect(play).toBeEnabled({ timeout: 120_000 });
  await play.click();
  await expect(page.getByRole("heading", { name: "Odotushuone" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: /^Lisää botti paikalle/ }).first().click();
  await page.getByRole("button", { name: "Aloita peli" }).click();

  await expect(board(page).locator("[data-cell]")).toHaveCount(400, { timeout: 30_000 });
  await expect(page.getByText("Kettu, botti", { exact: false })).toBeAttached();

  await page.getByRole("button", { name: "Poistu pelistä" }).click();
  await page.getByRole("button", { name: "Poistu", exact: true }).click();
  await expect(play).toBeVisible();

  // Left for good: a reload does not bring the game back.
  await page.reload();
  await expect(play).toBeVisible({ timeout: 30_000 });
  await expect(board(page)).toHaveCount(0);
});
