import { describe, expect, it } from "vitest";
import en from "./locales/en.json";
import fi from "./locales/fi.json";

function keys(obj: object, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === "object" && v !== null ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe("locales", () => {
  it("en has exactly the same keys as fi", () => {
    expect(keys(en).sort()).toEqual(keys(fi).sort());
  });
});
