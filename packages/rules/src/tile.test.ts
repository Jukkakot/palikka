import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { openings, ROTATIONS, rotate, TILE_KINDS, type Tile } from "./tile.js";

const tileArb = fc.record({
  id: fc.nat(49),
  kind: fc.constantFrom(...TILE_KINDS),
  rotation: fc.constantFrom(...ROTATIONS),
});

describe("board › Tile kinds and openings", () => {
  it("Openings at rotation 0", () => {
    expect(openings({ id: 0, kind: "corner", rotation: 0 })).toEqual(["N", "E"]);
    expect(openings({ id: 0, kind: "straight", rotation: 0 })).toEqual(["N", "S"]);
    expect(openings({ id: 0, kind: "tee", rotation: 0 })).toEqual(["E", "S", "W"]);
  });
});

describe("board › Rotation", () => {
  it("Rotating a corner", () => {
    const turned = rotate({ id: 5, kind: "corner", rotation: 0 });
    expect(turned.rotation).toBe(90);
    expect(openings(turned)).toEqual(["E", "S"]);
  });

  it("Rotating a T-junction to 270°", () => {
    expect(openings({ id: 0, kind: "tee", rotation: 270 })).toEqual(["N", "E", "S"]);
    expect(openings({ id: 0, kind: "tee", rotation: 90 })).toEqual(["N", "S", "W"]);
  });

  it("Straight tile symmetry", () => {
    expect(openings({ id: 0, kind: "straight", rotation: 180 })).toEqual(
      openings({ id: 0, kind: "straight", rotation: 0 }),
    );
  });

  it("Full turn (property): four clockwise quarter turns restore openings, kind and id", () => {
    fc.assert(
      fc.property(tileArb, (tile: Tile) => {
        const back = rotate(rotate(rotate(rotate(tile))));
        expect(back).toEqual(tile);
        expect(openings(back)).toEqual(openings(tile));
      }),
    );
  });

  it("property: rotation keeps id, kind and the number of openings", () => {
    fc.assert(
      fc.property(tileArb, fc.integer({ min: -8, max: 8 }), (tile: Tile, steps: number) => {
        const turned = rotate(tile, steps);
        expect(turned.id).toBe(tile.id);
        expect(turned.kind).toBe(tile.kind);
        expect(openings(turned)).toHaveLength(openings(tile).length);
      }),
    );
  });

  it("property: turning back undoes a turn", () => {
    fc.assert(
      fc.property(tileArb, fc.integer({ min: -8, max: 8 }), (tile: Tile, steps: number) => {
        expect(rotate(rotate(tile, steps), -steps)).toEqual(tile);
      }),
    );
  });
});
