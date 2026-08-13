import type { StageplanStageSize } from "../../model/types.js";
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
 * Měřítko je jedno pro obě osy. V neizotropním by se otočená zóna kreslila jako
 * zkosený rovnoběžník a vytištěný údaj o rotaci by lhal — a rotace je přesně to,
 * co F5b tiskne.
 */
export function createPrintScale(
  stage: StageplanStageSize | null,
  area: PrintArea,
): PrintScale {
  const plan = stage ?? NOMINAL_STAGE;
  const mmPerM = Math.min(
    area.widthMm / plan.widthM,
    area.heightMm / plan.depthM,
  );

  return {
    mmPerM,
    planWidthMm: plan.widthM * mmPerM,
    planHeightMm: plan.depthM * mmPerM,
    toMm: (meters) => meters * mmPerM,
    toM: (millimeters) => millimeters / mmPerM,
  };
}
