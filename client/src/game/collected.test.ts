import { TILE_SET } from "@labyrinth/rules";
import { describe, expect, it } from "vitest";
import { collectedTreasures, isCollected } from "./collected.ts";

describe("collectedTreasures", () => {
  it("joins every seat's found treasures", () => {
    const collected = collectedTreasures([{ found: ["dragon"] }, { found: ["bat", "ghost"] }, { found: [] }]);
    expect([...collected].sort()).toEqual(["bat", "dragon", "ghost"]);
  });

  it("isCollected: only tiles whose treasure is collected", () => {
    const dragon = TILE_SET.find((t) => t.treasure === "dragon")!;
    const plain = TILE_SET.find((t) => !t.treasure)!;
    const collected = collectedTreasures([{ found: ["dragon"] }]);
    expect(isCollected(dragon.id, collected)).toBe(true);
    expect(isCollected(plain.id, collected)).toBe(false);
    expect(isCollected(dragon.id, undefined)).toBe(false);
  });
});
