import { expect, type Page } from "@playwright/test";

/** A quick-play pool unique to one test, so tests never share games. */
export const uniquePool = (name: string) => `e2e-${name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const board = (page: Page) => page.getByRole("grid", { name: "Pelilauta" });

/** Opens the start screen in `pool`, enters `nickname`, taps "Luo peli" and waits for the waiting room. */
export async function createGame(page: Page, pool: string, nickname: string) {
  await page.goto(`/?pool=${pool}`);
  await page.getByRole("textbox", { name: "Nimimerkki" }).fill(nickname);
  await page.getByRole("button", { name: "Luo peli", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Odotushuone" })).toBeVisible();
}

/** Opens the invite link of game `id` in `pool`, enters `nickname`, joins and waits for the waiting room. */
export async function joinByInvite(page: Page, pool: string, id: string, nickname: string) {
  await page.goto(`/?pool=${pool}&game=${id}`);
  await page.getByRole("textbox", { name: "Nimimerkki" }).fill(nickname);
  await page.getByRole("button", { name: "Liity peliin", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Odotushuone" })).toBeVisible();
}

/**
 * Places the piece `id` (e.g. "I5") on the viewer's start corner square `square` as on a phone:
 * tap the piece, tap the square (the preview snaps there), tap it again. Taps, not clicks: a mouse
 * would preview on hover and place with the first click.
 */
export async function placeOnCorner(page: Page, id: string, square: number) {
  await page.getByRole("button", { name: new RegExp(`^Palikka ${id},`) }).tap();
  const cell = board(page).locator(`[data-cell='${square}']`);
  await cell.tap();
  await expect(cell).toHaveAttribute("data-preview", "ok");
  await cell.tap();
}

/** The game id shown in the top bar. */
export async function gameId(page: Page): Promise<string> {
  const label = await page.getByRole("button", { name: /^Peli .* Napauta jakaaksesi pelin linkin\.$/ }).getAttribute("aria-label");
  return label!.replace(/^Peli (.*)\. Napauta jakaaksesi pelin linkin\.$/, "$1");
}
