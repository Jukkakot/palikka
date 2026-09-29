import { expect, test } from "@playwright/test";
import { board, createGame, gameId, joinByInvite, placeOnCorner, uniquePool } from "./helpers.ts";

/**
 * Smoke: against a real server, the host creates a game and the guest joins by its invite link, the
 * host starts, both see the whole board on a Galaxy S24, and the host's first piece, placed through
 * the piece tray, reaches the guest.
 */
test("two players meet in the waiting room, the host starts, and a placed piece syncs", async ({ browser }) => {
  const pool = uniquePool("smoke");
  const host = await (await browser.newContext({ ...test.info().project.use })).newPage();
  const guest = await (await browser.newContext({ ...test.info().project.use })).newPage();

  await createGame(host, pool, "Maija");
  await joinByInvite(guest, pool, await gameId(host), "Pekka");
  expect(await gameId(guest)).toBe(await gameId(host));
  expect(await gameId(host)).toMatch(/^[a-z]+(-[a-z]+)+$/);

  await expect(host.locator("li[data-seat]:not([data-free])")).toHaveCount(2);
  await expect(guest.getByText("Odotetaan, että Maija aloittaa pelin")).toBeVisible();
  await host.getByRole("button", { name: "Aloita peli" }).click();

  for (const [page, me] of [
    [host, "Maija (sinä)"],
    [guest, "Pekka (sinä)"],
  ] as const) {
    await expect(board(page).locator("[data-cell]")).toHaveCount(400);
    await expect(page.getByRole("list", { name: "Pelaajat ja pisteet" })).toContainText(me);

    // board-view › Board fits a phone screen (360×780, no horizontal scroll).
    expect(page.viewportSize()).toEqual({ width: 360, height: 780 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const boardBox = (await board(page).boundingBox())!;
    expect(boardBox.x + boardBox.width).toBeLessThanOrEqual(360);
    expect(boardBox.y + boardBox.height).toBeLessThanOrEqual(780);
  }

  await placeOnCorner(host, "I5", 0);
  await expect(board(guest).locator("[data-cell='0']")).toHaveAttribute("data-owner", "1");
  await expect(board(host).locator("[data-cell='0']")).toHaveAttribute("data-owner", "1");
  await expect(guest.getByText("Sinun vuorosi", { exact: true })).toBeVisible();
});
