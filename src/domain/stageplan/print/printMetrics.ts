import type { StageplanBlockSlot } from "../../model/types.js";
import type { PrintTypography } from "./printFootprint.js";
import type { PrintArea } from "./printScale.js";

export type StageplanPrintBlockMetric = {
  readonly slot: StageplanBlockSlot;
  readonly lineCount: number;
  readonly hasPower: boolean;
};

/**
 * Co editor potřebuje, aby si tiskovou stopu spočítal stejnou funkcí jako tisk.
 * Plocha a typografie jdou v odpovědi s sebou, aby okno nemuselo importovat
 * konstanty z infra vrstvy (R12).
 */
export type StageplanPrintGeometry = {
  readonly area: PrintArea;
  readonly typography: PrintTypography;
  readonly blocks: readonly StageplanPrintBlockMetric[];
};
