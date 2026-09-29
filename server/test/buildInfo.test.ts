import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readBuiltAt } from "../src/buildInfo.js";

describe("readBuiltAt", () => {
  it("returns the build time from the build info file", () => {
    const file = join(mkdtempSync(join(tmpdir(), "build-info-")), "build-info.json");
    writeFileSync(file, JSON.stringify({ builtAt: "2026-09-26T15:35:00.000Z" }));
    expect(readBuiltAt(file)).toBe("2026-09-26T15:35:00.000Z");
  });

  it("returns null when the server runs without a build", () => {
    expect(readBuiltAt(join(tmpdir(), "no-such-dir", "build-info.json"))).toBeNull();
  });
});
