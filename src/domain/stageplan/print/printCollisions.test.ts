import { describe, expect, it } from "vitest";
import {
  type PrintRect,
  findPrintCollisions,
  rectAabbMm,
  rectsOverlap,
} from "./printCollisions.js";

function rect(overrides: Partial<PrintRect> = {}): PrintRect {
  return {
    slot: "drums",
    centerXMm: 0,
    centerYMm: 0,
    widthMm: 20,
    heightMm: 20,
    rotationDeg: 0,
    ...overrides,
  };
}

describe("rectsOverlap", () => {
  it("finds an overlap of two unrotated boxes", () => {
    expect(rectsOverlap(rect(), rect({ slot: "bass", centerXMm: 15 }))).toBe(
      true,
    );
  });

  it("treats touching edges as separated", () => {
    expect(rectsOverlap(rect(), rect({ slot: "bass", centerXMm: 20 }))).toBe(
      false,
    );
  });

  it("separates two boxes rotated by 45 degrees whose bounding boxes overlap", () => {
    const a = rect({ rotationDeg: 45 });
    const b = rect({
      slot: "bass",
      centerXMm: 21,
      centerYMm: 21,
      rotationDeg: 45,
    });

    // Opsané obdélníky se překrývají — proto se kolize netestuje přes ně (R10).
    const aabbA = rectAabbMm(a);
    const aabbB = rectAabbMm(b);
    expect(aabbA.maxXMm).toBeGreaterThan(aabbB.minXMm);
    expect(aabbA.maxYMm).toBeGreaterThan(aabbB.minYMm);

    expect(rectsOverlap(a, b)).toBe(false);
  });

  it("finds an overlap of two rotated boxes that really intersect", () => {
    expect(
      rectsOverlap(
        rect({ rotationDeg: 45 }),
        rect({ slot: "bass", centerXMm: 8, centerYMm: 8, rotationDeg: 45 }),
      ),
    ).toBe(true);
  });
});

describe("rectAabbMm", () => {
  it("returns the box itself when there is no rotation", () => {
    expect(rectAabbMm(rect({ centerXMm: 50, centerYMm: 30 }))).toEqual({
      minXMm: 40,
      minYMm: 20,
      maxXMm: 60,
      maxYMm: 40,
    });
  });

  it("grows the extents of a rotated box", () => {
    const aabb = rectAabbMm(rect({ rotationDeg: 45 }));

    expect(aabb.maxXMm).toBeCloseTo(14.142, 3);
    expect(aabb.maxYMm).toBeCloseTo(14.142, 3);
  });
});

describe("findPrintCollisions", () => {
  it("reports nothing for boxes standing apart", () => {
    expect(
      findPrintCollisions([
        rect({ slot: "drums", centerXMm: 0 }),
        rect({ slot: "bass", centerXMm: 40 }),
        rect({ slot: "keys", centerXMm: 80 }),
      ]),
    ).toEqual([]);
  });

  it("reports each colliding pair once", () => {
    expect(
      findPrintCollisions([
        rect({ slot: "drums", centerXMm: 0 }),
        rect({ slot: "bass", centerXMm: 10 }),
        rect({ slot: "keys", centerXMm: 100 }),
      ]),
    ).toEqual([["drums", "bass"]]);
  });
});
