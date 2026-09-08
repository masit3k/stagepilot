import { describe, expect, it } from "vitest";
import type { StageplanBlock, StageplanLayout } from "../model/types.js";
import {
  ROW_BAND_DEPTH_FRACTION,
  TALKBACK_POSITION_RANK,
  resolveStagePositionOrder,
  resolveStagePositionRankByRole,
  resolveStagePositionRankBySlot,
} from "./resolveStagePositionOrder.js";

function block(
  slot: StageplanBlock["slot"],
  centerXM: number,
  centerYM: number,
): StageplanBlock {
  return {
    slot,
    centerXM,
    centerYM,
    widthM: 2.6,
    depthM: 1.4,
    rotationDeg: 0,
  };
}

/** Uložený layout projektu KD Slavie: default rozmístění, pódium nezadané. */
const KD_SLAVIE: StageplanLayout = {
  stage: null,
  blocks: [
    block("drums", 6, 1.2),
    block("bass", 9.4, 1.2),
    block("guitar", 2.6, 5.5),
    block("keys", 9.4, 5.5),
    block("lead_voc_1", 6, 5.5),
  ],
};

/** Bon Repos: bicí přetažené dopředu a doleva, ostatní bloky na defaultu. */
const BON_REPOS: StageplanLayout = {
  stage: null,
  blocks: [
    block("drums", 4, 2),
    block("bass", 9.4, 1.2),
    block("guitar", 2.6, 5.5),
    block("keys", 9.4, 5.5),
    block("lead_voc_1", 6, 5.5),
  ],
};

describe("resolveStagePositionOrder", () => {
  it("reads the stage as a boustrophedon snake: front row left to right, next row back to front", () => {
    expect(resolveStagePositionOrder(KD_SLAVIE)).toEqual([
      "guitar",
      "lead_voc_1",
      "keys",
      "bass",
      "drums",
    ]);
  });

  it("ranks slots from 1 upwards in snake order", () => {
    const rank = resolveStagePositionRankBySlot(KD_SLAVIE);
    expect(rank.get("guitar")).toBe(1);
    expect(rank.get("lead_voc_1")).toBe(2);
    expect(rank.get("keys")).toBe(3);
    expect(rank.get("bass")).toBe(4);
    expect(rank.get("drums")).toBe(5);
  });

  it("gives no rank to a slot the layout has no block for", () => {
    expect(resolveStagePositionRankBySlot(KD_SLAVIE).has("lead_voc_2")).toBe(
      false,
    );
  });

  /**
   * Rozhodnutí o toleranci pásma je tady vidět: 0.8 m mezi bicími (y = 2) a
   * basou (y = 1.2) je pod pásmem 1.2 m (15 % z hloubky 8 m), takže spadnou do
   * jedné — druhé, obrácené — řady a basa se čte první. Není to bug, jen jiná
   * geometrie než u KD Slavie.
   */
  it("keeps a dragged drum block in the back row while it stays inside the row band", () => {
    expect(resolveStagePositionOrder(BON_REPOS)).toEqual([
      "guitar",
      "lead_voc_1",
      "keys",
      "bass",
      "drums",
    ]);
  });

  it("splits the row once the gap grows past the band", () => {
    const dragged: StageplanLayout = {
      stage: null,
      blocks: [
        block("drums", 4, 2.6),
        block("bass", 9.4, 1.2),
        block("guitar", 2.6, 5.5),
        block("keys", 9.4, 5.5),
        block("lead_voc_1", 6, 5.5),
      ],
    };
    // Tři řady: y ≈ 5.5 (zleva), y = 2.6 (obrácená, sama), y = 1.2 (zleva).
    expect(resolveStagePositionOrder(dragged)).toEqual([
      "guitar",
      "lead_voc_1",
      "keys",
      "drums",
      "bass",
    ]);
  });

  it("scales the row band with the stage depth, not with a fixed metre value", () => {
    // Rozestup 1.2 m v ose y. Na hlubokém pódiu (pásmo 2.4 m) je to jedna řada
    // čtená zleva doprava; na plochém (pásmo 0.6 m) dvě řady čtené zepředu
    // dozadu — a proto vyjde obrácené pořadí.
    const blocks = [block("drums", 6, 1.2), block("bass", 9.4, 2.4)];
    expect(
      resolveStagePositionOrder({ stage: { widthM: 12, depthM: 16 }, blocks }),
    ).toEqual(["drums", "bass"]);
    expect(
      resolveStagePositionOrder({ stage: { widthM: 12, depthM: 4 }, blocks }),
    ).toEqual(["bass", "drums"]);
    expect(ROW_BAND_DEPTH_FRACTION).toBeCloseTo(0.15);
  });

  it("falls back to the nominal stage depth when the stage size is unknown", () => {
    // 12 × 8 m → pásmo 1.2 m. Rozestup 1.1 m drží bloky v jedné řadě.
    expect(
      resolveStagePositionOrder({
        stage: null,
        blocks: [block("bass", 9.4, 1.1), block("drums", 6, 2.2)],
      }),
    ).toEqual(["drums", "bass"]);
  });

  it("returns nothing for a layout without blocks", () => {
    expect(resolveStagePositionOrder({ stage: null, blocks: [] })).toEqual([]);
  });

  it("breaks an exact position tie deterministically by slot", () => {
    const overlapping: StageplanLayout = {
      stage: null,
      blocks: [block("keys", 6, 5.5), block("guitar", 6, 5.5)],
    };
    expect(resolveStagePositionOrder(overlapping)).toEqual(["guitar", "keys"]);
  });
});

describe("resolveStagePositionRankByRole", () => {
  it("keys the snake order by ownership role", () => {
    const byRole = resolveStagePositionRankByRole(KD_SLAVIE);
    expect([...byRole].filter(([role]) => role !== "talkback")).toEqual([
      ["guitar", 1],
      ["vocs", 2],
      ["keys", 3],
      ["bass", 4],
      ["drums", 5],
    ]);
  });

  it("ranks talkback last regardless of the layout", () => {
    const byRole = resolveStagePositionRankByRole(KD_SLAVIE);
    expect(byRole.get("talkback")).toBe(TALKBACK_POSITION_RANK);
    expect(byRole.get("talkback")).toBeGreaterThan(byRole.get("drums") ?? 0);
  });

  it("gives vocs the frontmost of the two lead vocal blocks", () => {
    const twoLeads: StageplanLayout = {
      stage: null,
      blocks: [
        block("drums", 6, 1.2),
        block("lead_voc_2", 7.5, 5.5),
        block("lead_voc_1", 4.5, 5.5),
      ],
    };
    // lead_voc_1 je v hadu první (x = 4.5), takže rank role `vocs` je jeho.
    expect(resolveStagePositionRankByRole(twoLeads).get("vocs")).toBe(1);
  });

  it("leaves a role out when no block carries it", () => {
    const noKeys: StageplanLayout = {
      stage: null,
      blocks: [block("drums", 6, 1.2), block("bass", 9.4, 1.2)],
    };
    expect(resolveStagePositionRankByRole(noKeys).has("keys")).toBe(false);
  });
});
