import { TREASURES } from "@labyrinth/rules";
import { describe, expect, it } from "vitest";
import en from "../i18n/locales/en.json";
import fi from "../i18n/locales/fi.json";
import { TREASURE_ICONS } from "./treasureIcons.ts";

describe("board-view › Treasures shown as icons", () => {
  it("maps all 24 treasures to 24 different icons", () => {
    const icons = TREASURES.map((t) => TREASURE_ICONS[t]);
    expect(icons.every(Boolean)).toBe(true);
    expect(new Set(icons).size).toBe(24);
  });

  it("names every treasure in Finnish and English", () => {
    for (const t of TREASURES) {
      expect(fi.treasures[t]).toBeTruthy();
      expect(en.treasures[t]).toBeTruthy();
    }
    expect(fi.treasures.dragon).toBe("lohikäärme");
  });
});
