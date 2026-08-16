import type { StageplanPrintBox } from "./buildPdfStageplanPrintModel.js";

export type StageplanBoxLines = Pick<
  StageplanPrintBox,
  "hasBandLeaderLine" | "inputBullets" | "monitorBullets" | "extraBullets"
>;

/**
 * Kolik řádkových výšek box zabere **pod hlavičkou**. Řádek BANDLEADER je
 * jeden z nich: sází se menším písmem, ale rytmus boxu drží stejný (R9).
 * Skupiny odrážek dělí prázdný řádek, takže dvě neprázdné skupiny stojí o
 * řádek víc než jejich součet. Zalamování se neřeší — po R3 nemá co zalomit.
 */
export function countStageplanBoxLines(box: StageplanBoxLines): number {
  const inputs = box.inputBullets.length;
  const monitors = box.monitorBullets.length;
  const extras = box.extraBullets.length;

  let lines = inputs + monitors + extras;
  if (monitors > 0 && inputs > 0) lines += 1;
  if (extras > 0 && (monitors > 0 || inputs > 0)) lines += 1;
  if (box.hasBandLeaderLine) lines += 1;
  return lines;
}
