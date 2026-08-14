import { describe, expect, it } from "vitest";
import type { StageplanBlock, StageplanStageSize } from "../../model/types.js";
import {
  MIN_ZONE_M,
  OVERHANG_TOLERANCE_M,
  clampToArea,
  moveBlockTo,
  nudgeBlockBy,
  resizeBlockTo,
  rotateBlockBy,
  rotateBlockTo,
  rotatedHalfExtents,
} from "./blockOps.js";

const AREA: StageplanStageSize = { widthM: 12, depthM: 8 };

const BLOCK: StageplanBlock = {
  slot: "drums",
  centerXM: 6,
  centerYM: 4,
  widthM: 2.8,
  depthM: 1.6,
  rotationDeg: 0,
};

describe("rotatedHalfExtents", () => {
  it("returns half the zone when the block is not rotated", () => {
    expect(rotatedHalfExtents(BLOCK)).toEqual({ halfXM: 1.4, halfYM: 0.8 });
  });

  it("swaps the axes at 90 degrees", () => {
    const extents = rotatedHalfExtents({ ...BLOCK, rotationDeg: 90 });
    expect(extents.halfXM).toBeCloseTo(0.8, 6);
    expect(extents.halfYM).toBeCloseTo(1.4, 6);
  });
});

describe("moveBlockTo", () => {
  it("snaps to ten centimetres", () => {
    const moved = moveBlockTo(
      BLOCK,
      { centerXM: 3.34, centerYM: 2.46 },
      { area: AREA, snap: true },
    );
    expect(moved).toMatchObject({ centerXM: 3.3, centerYM: 2.5 });
  });

  it("keeps millimetre precision with snap off", () => {
    const moved = moveBlockTo(
      BLOCK,
      { centerXM: 3.3412, centerYM: 2.4567 },
      { area: AREA, snap: false },
    );
    expect(moved).toMatchObject({ centerXM: 3.341, centerYM: 2.457 });
  });

  it("allows twenty centimetres of overhang and no more", () => {
    const moved = moveBlockTo(
      BLOCK,
      { centerXM: -50, centerYM: -50 },
      { area: AREA, snap: false },
    );
    expect(moved.centerXM).toBeCloseTo(1.4 - OVERHANG_TOLERANCE_M, 6);
    expect(moved.centerYM).toBeCloseTo(0.8 - OVERHANG_TOLERANCE_M, 6);
  });

  it("clamps against the downstage and right edges too", () => {
    const moved = moveBlockTo(
      BLOCK,
      { centerXM: 99, centerYM: 99 },
      { area: AREA, snap: false },
    );
    expect(moved.centerXM).toBeCloseTo(12 - 1.4 + OVERHANG_TOLERANCE_M, 6);
    expect(moved.centerYM).toBeCloseTo(8 - 0.8 + OVERHANG_TOLERANCE_M, 6);
  });

  it("centres a zone that is wider than the stage instead of pinning it", () => {
    const narrow: StageplanStageSize = { widthM: 2, depthM: 8 };
    const moved = moveBlockTo(
      BLOCK,
      { centerXM: 0, centerYM: 4 },
      { area: narrow, snap: false },
    );
    expect(moved.centerXM).toBe(1);
  });

  it("leaves the rotation untouched", () => {
    const rotated = { ...BLOCK, rotationDeg: 30 };
    expect(
      moveBlockTo(
        rotated,
        { centerXM: 5, centerYM: 5 },
        { area: AREA, snap: true },
      ).rotationDeg,
    ).toBe(30);
  });
});

describe("nudgeBlockBy", () => {
  it("moves by the exact step without snapping to the grid", () => {
    const start = { ...BLOCK, centerXM: 6.05 };
    expect(
      nudgeBlockBy(start, { xM: 0.1, yM: 0 }, { area: AREA }).centerXM,
    ).toBe(6.15);
  });

  it("clamps like a drag does", () => {
    const start = { ...BLOCK, centerXM: 1.2 };
    expect(
      nudgeBlockBy(start, { xM: -1, yM: 0 }, { area: AREA }).centerXM,
    ).toBeCloseTo(1.2, 6);
  });
});

describe("rotateBlockTo", () => {
  it("snaps to fifteen degrees", () => {
    expect(
      rotateBlockTo(BLOCK, 37, { area: AREA, snap: true }).rotationDeg,
    ).toBe(30);
  });

  it("keeps single degrees with snap off", () => {
    expect(
      rotateBlockTo(BLOCK, 37.4, { area: AREA, snap: false }).rotationDeg,
    ).toBe(37);
  });

  it("normalizes into 0-359", () => {
    expect(
      rotateBlockTo(BLOCK, -15, { area: AREA, snap: true }).rotationDeg,
    ).toBe(345);
    expect(
      rotateBlockTo(BLOCK, 360, { area: AREA, snap: true }).rotationDeg,
    ).toBe(0);
  });

  it("pulls a block back onto the area when rotation grows its footprint", () => {
    // Otočením o 90° se hloubka zóny 1,6 m vymění za šířku 2,8 m, takže blok
    // opřený o upstage hranu musí popojet dopředu: 0,6 m → 1,4 − 0,2 = 1,2 m.
    const upstage = { ...BLOCK, centerYM: 0.6 };
    const rotated = rotateBlockTo(upstage, 90, { area: AREA, snap: true });
    expect(rotated.centerYM).toBeCloseTo(1.2, 6);
  });
});

describe("rotateBlockBy", () => {
  it("adds the delta and re-snaps", () => {
    expect(
      rotateBlockBy({ ...BLOCK, rotationDeg: 30 }, 15, {
        area: AREA,
        snap: true,
      }).rotationDeg,
    ).toBe(45);
    // Blok mimo mřížku se snapem srovná: 7 − 15 = −8, nejbližší násobek je −15.
    expect(
      rotateBlockBy({ ...BLOCK, rotationDeg: 7 }, -15, {
        area: AREA,
        snap: true,
      }).rotationDeg,
    ).toBe(345);
  });
});

describe("clampToArea", () => {
  it("leaves a block that already fits alone", () => {
    expect(clampToArea(BLOCK, AREA)).toEqual(BLOCK);
  });
});

describe("resizeBlockTo", () => {
  const zone: StageplanBlock = {
    slot: "drums",
    centerXM: 6,
    centerYM: 4,
    widthM: 2.8,
    depthM: 1.6,
    rotationDeg: 0,
  };
  const area: StageplanStageSize = { widthM: 12, depthM: 8 };

  it("grows the east edge and leaves the west edge standing", () => {
    const next = resizeBlockTo(
      zone,
      "e",
      { xM: 1, yM: 0 },
      { area, snap: false },
    );

    expect(next.widthM).toBe(3.8);
    expect(next.depthM).toBe(1.6);
    // Západní hrana stála: 6 − 2,8/2 = 4,6 = 6,5 − 3,8/2.
    expect(next.centerXM).toBe(6.5);
    expect(next.centerYM).toBe(4);
  });

  it("grows the west edge to the left and leaves the east edge standing", () => {
    const next = resizeBlockTo(
      zone,
      "w",
      { xM: -1, yM: 0 },
      { area, snap: false },
    );

    expect(next.widthM).toBe(3.8);
    expect(next.centerXM).toBe(5.5);
  });

  it("resizes both axes from a corner handle", () => {
    const next = resizeBlockTo(
      zone,
      "se",
      { xM: 0.4, yM: 0.4 },
      { area, snap: false },
    );

    expect(next.widthM).toBe(3.2);
    expect(next.depthM).toBe(2);
    expect(next.centerXM).toBe(6.2);
    expect(next.centerYM).toBe(4.2);
  });

  it("stops at the minimum zone and moves the centre only by what it allowed", () => {
    const next = resizeBlockTo(
      zone,
      "e",
      { xM: -5, yM: 0 },
      { area, snap: false },
    );

    expect(next.widthM).toBe(MIN_ZONE_M);
    // Povolený úbytek je 2,8 − 0,8 = 2, střed jde o polovinu: 6 − 1 = 5.
    expect(next.centerXM).toBe(5);
  });

  it("reads the drag in the zone's own axes when it is rotated", () => {
    const rotated = { ...zone, rotationDeg: 90 };
    // Při 90° leží šířková osa zóny svisle, takže vodorovný tah šířku nemění.
    const sideways = resizeBlockTo(
      rotated,
      "e",
      { xM: 1, yM: 0 },
      { area, snap: false },
    );
    expect(sideways.widthM).toBe(2.8);

    // Svislý tah ji naopak mění a střed jde svisle.
    const along = resizeBlockTo(
      rotated,
      "e",
      { xM: 0, yM: 1 },
      { area, snap: false },
    );
    expect(along.widthM).toBe(3.8);
    expect(along.centerXM).toBe(6);
    expect(along.centerYM).toBe(4.5);
  });

  it("snaps the resulting size to the grid when snap is on", () => {
    const next = resizeBlockTo(
      zone,
      "e",
      { xM: 0.23, yM: 0 },
      { area, snap: true },
    );

    expect(next.widthM).toBe(3);
  });

  it("clamps the grown zone back onto the stage", () => {
    const atEdge = { ...zone, centerXM: 11 };
    const next = resizeBlockTo(
      atEdge,
      "e",
      { xM: 2, yM: 0 },
      { area, snap: false },
    );

    expect(next.widthM).toBe(4.8);
    // clampAxis: max = 12 − 2,4 + 0,2 = 9,8.
    expect(next.centerXM).toBe(9.8);
  });
});
