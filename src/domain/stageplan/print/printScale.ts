import type { StageplanBlock, StageplanStageSize } from "../../model/types.js";
import { OVERHANG_TOLERANCE_M } from "../layout/blockOps.js";
import { NOMINAL_STAGE } from "../layout/defaultLayout.js";

export type PrintArea = {
  readonly widthMm: number;
  readonly heightMm: number;
};

export type PrintScale = {
  readonly mmPerM: number;
  readonly planWidthMm: number;
  readonly planHeightMm: number;
  readonly toMm: (meters: number) => number;
  readonly toM: (millimeters: number) => number;
};

/**
 * Sestaví `PrintScale` z rozměru pódia a `mmPerM` — jediné místo, které to dělá,
 * aby konstrukce nemohla rozejít mezi voláními.
 *
 * Měřítko je jedno pro obě osy. V neizotropním by se otočená zóna kreslila jako
 * zkosený rovnoběžník a vytištěný údaj o rotaci by lhal — a rotace je přesně to,
 * co F5b tiskne.
 */
function buildPrintScale(plan: StageplanStageSize, mmPerM: number): PrintScale {
  return {
    mmPerM,
    planWidthMm: plan.widthM * mmPerM,
    planHeightMm: plan.depthM * mmPerM,
    toMm: (meters) => meters * mmPerM,
    toM: (millimeters) => millimeters / mmPerM,
  };
}

/**
 * Měřítko, do kterého se vejde i to, co smí přesahovat hranu pódia: clamp v
 * editoru nechává blok přesahovat o `OVERHANG_TOLERANCE_M` a tištěný box je
 * navíc širší než úzká zóna, protože nesmí klesnout pod minimální šířku.
 * Bez téhle rezervy shodí export každý blok postavený k boční hraně.
 *
 * Uzavřený tvar, ne iterace: hledá se největší `s`, pro které platí
 * `(šířkaPódia + 2·tolerance)·s + 2·max(0, (minŠířka − nejužšíZóna·s)/2) ≤ šířkaPlochy`.
 */
export function resolvePrintScale(args: {
  readonly stage: StageplanStageSize | null;
  readonly blocks: readonly Pick<StageplanBlock, "widthM">[];
  readonly area: PrintArea;
  readonly minBoxWidthMm: number;
}): PrintScale {
  const { stage, blocks, area, minBoxWidthMm } = args;
  const plan = stage ?? NOMINAL_STAGE;
  const inflatedWidthM = plan.widthM + 2 * OVERHANG_TOLERANCE_M;
  const inflatedDepthM = plan.depthM + 2 * OVERHANG_TOLERANCE_M;

  const toleranceOnlyMmPerM = area.widthMm / inflatedWidthM;
  const narrowestZoneM = blocks.reduce(
    (narrowest, block) => Math.min(narrowest, block.widthM),
    Number.POSITIVE_INFINITY,
  );

  let widthMmPerM = toleranceOnlyMmPerM;
  const growsAtToleranceOnly =
    Number.isFinite(narrowestZoneM) &&
    narrowestZoneM * toleranceOnlyMmPerM < minBoxWidthMm;
  if (growsAtToleranceOnly) {
    const denominator = inflatedWidthM - narrowestZoneM;
    // Pódium užší než zóna i s tolerancí: rezervovat nejde, pojistka to chytí.
    if (denominator > 0) {
      widthMmPerM = (area.widthMm - minBoxWidthMm) / denominator;
    }
  }

  const mmPerM = Math.min(widthMmPerM, area.heightMm / inflatedDepthM);

  return buildPrintScale(plan, mmPerM);
}
