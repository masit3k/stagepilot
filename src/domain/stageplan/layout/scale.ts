import type { StageplanStageSize } from "../../model/types.js";

export type StageScale = {
  readonly pxPerM: number;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly toPx: (meters: number) => number;
  readonly toM: (pixels: number) => number;
};

/**
 * Plocha se vejde do dostupného místa bez deformace — poměr stran pódia musí
 * zůstat, jinak by se rozmístění na obrazovce lišilo od skutečnosti.
 */
export function createStageScale(
  area: StageplanStageSize,
  viewport: { readonly widthPx: number; readonly heightPx: number },
): StageScale {
  const fitted = Math.min(
    viewport.widthPx / area.widthM,
    viewport.heightPx / area.depthM,
  );
  // Nulový viewport při prvním renderu by dal NaN i dělení nulou dál v kódu.
  const pxPerM = Number.isFinite(fitted) && fitted > 1 ? fitted : 1;

  return {
    pxPerM,
    widthPx: area.widthM * pxPerM,
    heightPx: area.depthM * pxPerM,
    toPx: (meters) => meters * pxPerM,
    toM: (pixels) => pixels / pxPerM,
  };
}
