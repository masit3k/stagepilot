import type { StageplanBlock } from "../../../../../../src/domain/model/types";
import type { StageplanPrintBox } from "../../../../../../src/domain/pipeline/pdf/buildPdfStageplanPrintModel";
import { computePrintFootprintMm } from "../../../../../../src/domain/stageplan/print/printFootprint";
import type { StageplanPrintGeometry } from "../../../../../../src/domain/stageplan/print/printMetrics";
import type { PrintScale } from "../../../../../../src/domain/stageplan/print/printScale";

export type BlockPrint = {
  readonly box: StageplanPrintBox;
  /** Rozměr tištěného boxu v metrech — karta se kreslí v něm (R3). */
  readonly footprint: { readonly widthM: number; readonly depthM: number };
  /** Zóna je užší, než tisk umí nakreslit; na papíře bude box širší (R10). */
  readonly isBelowPrintFloor: boolean;
};

/**
 * Co se o bloku dá říct z tiskového modelu. Jediné místo, které tiskovou stopu
 * v editoru počítá — plocha i panel čtou odsud, aby si nemohly odpovídat jinak.
 *
 * Celý box se nepřenáší po IPC jako rozměr, ale jako text; stopu z něj počítá
 * `computePrintFootprintMm`, tedy tatáž funkce, jakou používá renderer (R4).
 */
export function resolveBlockPrint(args: {
  readonly block: StageplanBlock;
  readonly geometry: StageplanPrintGeometry | null;
  readonly scale: PrintScale | null;
}): BlockPrint | null {
  const { block, geometry, scale } = args;
  if (!geometry || !scale) return null;
  const box = geometry.blocks.find((entry) => entry.slot === block.slot);
  if (!box) return null;

  const footprint = computePrintFootprintMm({
    box,
    typography: geometry.typography,
  });

  return {
    box,
    footprint: {
      widthM: scale.toM(footprint.widthMm),
      depthM: scale.toM(footprint.heightMm),
    },
    isBelowPrintFloor:
      block.widthM * scale.mmPerM < geometry.typography.minBoxWidthMm,
  };
}
