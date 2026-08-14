import type { StageplanPrintBox } from "../../pipeline/pdf/buildPdfStageplanPrintModel.js";
import type { PrintTypography } from "./printFootprint.js";
import type { PrintArea } from "./printScale.js";

/**
 * Co editor potřebuje, aby si tiskovou stopu i obsah karty spočítal stejnými
 * funkcemi jako tisk. Plocha a typografie jdou v odpovědi s sebou, aby okno
 * nemuselo importovat konstanty z infra vrstvy (R12 z F5b).
 *
 * `blocks` nese **celé tiskové boxy**, ne odvozená čísla: počet řádků si obě
 * strany dopočítají `countStageplanBoxLines`, takže se nemají čím rozejít (R4).
 */
export type StageplanPrintGeometry = {
  readonly area: PrintArea;
  readonly typography: PrintTypography;
  readonly blocks: readonly StageplanPrintBox[];
};
