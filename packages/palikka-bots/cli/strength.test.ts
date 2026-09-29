import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { devicePlayer, parseBot } from "../src/index.js";

interface Requirement {
  readonly name: string;
  readonly candidate: string;
  readonly baseline: string;
  readonly colours: number;
  readonly games: number;
  readonly minShare: number;
}

describe("bot-tournament › Strength requirements", () => {
  it("Search requirement listed: the device bot at a machine-independent budget beats greedy ≥ 60 % over 200 games", () => {
    const list = JSON.parse(readFileSync(new URL("../strength.json", import.meta.url), "utf8")) as Requirement[];
    const search = list.find((r) => r.name === "search beats greedy");
    expect(search).toMatchObject({ baseline: "greedy", colours: 4, games: 200, minShare: 0.6 });
    const candidate = parseBot(search!.candidate);
    expect(candidate.bot).toBe(devicePlayer);
    expect(candidate.budget.timeMs).toBeUndefined();
  });
});
