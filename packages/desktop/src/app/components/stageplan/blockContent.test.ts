import { describe, expect, it } from "vitest";
import type { StageplanBlock } from "../../../../../../src/domain/model/types";
import { formatScale, formatZone, narrowestZoneSlot } from "./blockContent";

function zone(slot: StageplanBlock["slot"], widthM: number): StageplanBlock {
  return {
    slot,
    centerXM: 6,
    centerYM: 4,
    widthM,
    depthM: 1.4,
    rotationDeg: 0,
  };
}

describe("formatZone", () => {
  it("uses a decimal point, because the interface is English (R14)", () => {
    expect(formatZone(2.8, 1.6)).toBe("2.8 m × 1.6 m");
  });
});

describe("formatScale", () => {
  it("rounds the scale to one decimal", () => {
    expect(formatScale(12.885)).toBe("12.9 mm/m");
  });
});

describe("narrowestZoneSlot", () => {
  it("names the zone that drives the print scale down", () => {
    expect(
      narrowestZoneSlot([zone("drums", 2.8), zone("lead_voc_1", 2.6)]),
    ).toBe("lead_voc_1");
  });

  it("returns null without blocks", () => {
    expect(narrowestZoneSlot([])).toBeNull();
  });
});
