import { describe, expect, it } from "vitest";
import type { StageplanBlock } from "../../../../../../src/domain/model/types";
import type { StageplanPrintBox } from "../../../../../../src/domain/pipeline/pdf/buildPdfStageplanPrintModel";
import { computePrintFootprintMm } from "../../../../../../src/domain/stageplan/print/printFootprint";
import type { StageplanPrintGeometry } from "../../../../../../src/domain/stageplan/print/printMetrics";
import { resolvePrintScale } from "../../../../../../src/domain/stageplan/print/printScale";
import { resolveBlockPrint } from "./blockPrint";

/** Skutečná tisková plocha a prověřená minimální šířka strany 2 — stejná čísla
 *  jako printScale.test.ts a printFootprint.test.ts. */
const AREA = { widthMm: 162.5375, heightMm: 202.0914 };
const MIN_BOX_WIDTH_MM = 36.2594;
const TYPOGRAPHY = {
  fontSizePt: 8,
  lineHeight: 1.25,
  roleFontSizePt: 7.2,
  roleTrackingEm: 0.14,
  titleGapPt: 6,
  padPt: 6,
  bulletSpacingPx: 4,
  minBoxWidthMm: MIN_BOX_WIDTH_MM,
};

function block(overrides: Partial<StageplanBlock> = {}): StageplanBlock {
  return {
    slot: "guitar",
    centerXM: 2.6,
    centerYM: 5.5,
    widthM: 2.7,
    depthM: 1.4,
    rotationDeg: 0,
    ...overrides,
  };
}

function box(overrides: Partial<StageplanPrintBox> = {}): StageplanPrintBox {
  return {
    slot: "guitar",
    instrument: "Guitar",
    header: "GUITAR",
    hasBandLeaderLine: false,
    inputBullets: ["Guitar DI (5)", "Guitar Mic (6)"],
    monitorBullets: ["Wedge 1"],
    extraBullets: [],
    hasPowerBadge: true,
    powerBadgeText: "230V",
    ...overrides,
  };
}

function geometry(boxes: StageplanPrintBox[]): StageplanPrintGeometry {
  return { area: AREA, typography: TYPOGRAPHY, blocks: boxes };
}

/** Reálný výstup resolvePrintScale, ne vymyšlené číslo — stejný nominál 12 × 8 m. */
const scale = resolvePrintScale({
  stage: null,
  blocks: [block()],
  area: AREA,
  minBoxWidthMm: MIN_BOX_WIDTH_MM,
});

describe("resolveBlockPrint", () => {
  it("returns null without print geometry", () => {
    expect(
      resolveBlockPrint({ block: block(), geometry: null, scale }),
    ).toBeNull();
  });

  it("returns null without a resolved scale", () => {
    expect(
      resolveBlockPrint({
        block: block(),
        geometry: geometry([box()]),
        scale: null,
      }),
    ).toBeNull();
  });

  it("returns null when the geometry has no box for the block's slot", () => {
    const result = resolveBlockPrint({
      block: block({ slot: "bass" }),
      geometry: geometry([box({ slot: "guitar" })]),
      scale,
    });

    expect(result).toBeNull();
  });

  it("maps the footprint's width and depth to the matching mm axis", () => {
    // Zóna 2,7 × 1,4 m — schválně ne čtvercová, jinak by prohození os nešlo poznat.
    const zone = { widthM: 2.7, depthM: 1.4 };
    const printBox = box({
      inputBullets: ["Guitar DI (5)", "Guitar Mic (6)"],
      monitorBullets: ["Wedge 1"],
      extraBullets: [],
      hasPowerBadge: true,
    });
    const expectedMm = computePrintFootprintMm({
      box: printBox,
      typography: TYPOGRAPHY,
    });
    // Bez rozdílu os by test prohození `widthM`/`depthM` nezachytil.
    expect(expectedMm.widthMm).not.toBeCloseTo(expectedMm.heightMm, 1);

    const result = resolveBlockPrint({
      block: block(zone),
      geometry: geometry([printBox]),
      scale,
    });

    expect(result?.footprint.widthM).toBeCloseTo(
      scale.toM(expectedMm.widthMm),
      6,
    );
    expect(result?.footprint.depthM).toBeCloseTo(
      scale.toM(expectedMm.heightMm),
      6,
    );
  });

  it("flags a zone narrower than the print floor, and clears it once wide enough", () => {
    const floorWidthM = MIN_BOX_WIDTH_MM / scale.mmPerM;

    const narrow = resolveBlockPrint({
      block: block({ widthM: floorWidthM - 0.1 }),
      geometry: geometry([box()]),
      scale,
    });
    const wide = resolveBlockPrint({
      block: block({ widthM: floorWidthM + 0.1 }),
      geometry: geometry([box()]),
      scale,
    });

    expect(narrow?.isBelowPrintFloor).toBe(true);
    expect(wide?.isBelowPrintFloor).toBe(false);
  });

  it("adds one line to the footprint for the band leader row", () => {
    const withLeader = resolveBlockPrint({
      block: block(),
      geometry: geometry([box({ hasBandLeaderLine: true })]),
      scale,
    });
    const withoutLeader = resolveBlockPrint({
      block: block(),
      geometry: geometry([box({ hasBandLeaderLine: false })]),
      scale,
    });

    const lineM = scale.toM(
      (TYPOGRAPHY.fontSizePt * TYPOGRAPHY.lineHeight * 25.4) / 72,
    );
    expect(
      (withLeader?.footprint.depthM ?? 0) -
        (withoutLeader?.footprint.depthM ?? 0),
    ).toBeCloseTo(lineM, 6);
  });
});
