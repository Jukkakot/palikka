import { expect, test } from "@playwright/test";
import { board, gameId, quickPlay, uniquePool } from "./helpers.ts";

/**
 * Smoke: against a real server, two players meet in a waiting room through quick play, the host
 * starts, and both see the whole board on a Galaxy S24.
 */
test("two players meet in the waiting room, the host starts, and the board shows", async ({ browser }) => {
  const pool = uniquePool("smoke");
  const host = await (await browser.newContext({ ...test.info().project.use })).newPage();
  const guest = await (await browser.newContext({ ...test.info().project.use })).newPage();

  await quickPlay(host, pool, "Maija");
  await quickPlay(guest, pool, "Pekka");
  expect(await gameId(guest)).toBe(await gameId(host));
  expect(await gameId(host)).toMatch(/^[a-z]+(-[a-z]+)+$/);

  await expect(host.locator("li[data-seat]:not([data-free])")).toHaveCount(2);
  await expect(guest.getByText("Odotetaan, että Maija aloittaa pelin")).toBeVisible();
  await host.getByRole("button", { name: "Aloita peli" }).click();

  for (const [page, me] of [
    [host, "Maija (sinä)"],
    [guest, "Pekka (sinä)"],
  ] as const) {
    await expect(board(page).locator("[data-tile-id]")).toHaveCount(49);
    await expect(page.getByText("Ylimääräinen laatta")).toBeVisible();
    await expect(page.getByRole("img", { name: me })).toBeVisible();

    // board-view › Board fits a phone screen (360×780, no horizontal scroll).
    expect(page.viewportSize()).toEqual({ width: 360, height: 780 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const boardBox = (await board(page).boundingBox())!;
    const spareBox = (await page.getByRole("group", { name: "Ylimääräinen laatta" }).boundingBox())!;
    expect(boardBox.x + boardBox.width).toBeLessThanOrEqual(360);
    expect(spareBox.y + spareBox.height).toBeLessThanOrEqual(780);
  }
});
