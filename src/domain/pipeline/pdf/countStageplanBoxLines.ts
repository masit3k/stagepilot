import type { StageplanPrintBox } from "./buildPdfStageplanPrintModel.js";

export type StageplanBoxBullets = Pick<
  StageplanPrintBox,
  "inputBullets" | "monitorBullets" | "extraBullets"
>;

/**
 * Kolik řádků box zabere. Skupiny odrážek dělí prázdný řádek, takže dvě
 * neprázdné skupiny stojí o řádek víc než jejich součet. Zalamování se neřeší
 * (R13) — jedna odrážka je jeden řádek, stejně jako v dnešním rendereru.
 */
export function countStageplanBoxLines(box: StageplanBoxBullets): number {
  const inputs = box.inputBullets.length;
  const monitors = box.monitorBullets.length;
  const extras = box.extraBullets.length;

  let lines = inputs + monitors + extras;
  if (monitors > 0 && inputs > 0) lines += 1;
  if (extras > 0 && (monitors > 0 || inputs > 0)) lines += 1;
  return lines;
}
