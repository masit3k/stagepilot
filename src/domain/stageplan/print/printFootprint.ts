import type { StageplanBlock } from "../../model/types.js";

const MM_PER_PT = 25.4 / 72;

export type PrintTypography = {
  readonly fontSizePt: number;
  readonly lineHeight: number;
  /**
   * Rozměry řádku BANDLEADER (R9). Nic je zatím nečte — Task 5 s nimi
   * počítá šířku boxu, až footprint přestane vycházet jen z počtu řádků.
   */
  readonly roleFontSizePt: number;
  readonly roleTrackingEm: number;
  readonly titleGapPt: number;
  readonly padBottomPt: number;
  /** Prověřená šířka dnešního čtyřsloupcového boxu — pod ni se nejde (R3). */
  readonly minBoxWidthMm: number;
};

export type PrintFootprintMm = {
  readonly widthMm: number;
  readonly heightMm: number;
};

/**
 * Tištěný blok je karta zakotvená na středu zóny: `max(zóna, text)` v obou
 * osách. Zóna unese asi polovinu textu, který v ní stojí, a zmenšit písmo na
 * pět bodů není možnost — kresba proto přiznává, že kreslí pozice, ne půdorys
 * aparátu (R1).
 */
export function computePrintFootprintMm(args: {
  readonly lineCount: number;
  readonly hasPower: boolean;
  readonly zone: Pick<StageplanBlock, "widthM" | "depthM">;
  readonly mmPerM: number;
  readonly typography: PrintTypography;
}): PrintFootprintMm {
  const { lineCount, hasPower, zone, mmPerM, typography } = args;
  const lineMm = typography.fontSizePt * typography.lineHeight * MM_PER_PT;
  const titleGapMm = typography.titleGapPt * MM_PER_PT;

  const textMm =
    titleGapMm +
    lineMm +
    (lineCount > 0 ? titleGapMm : 0) +
    lineCount * lineMm +
    (hasPower ? lineMm : 0) +
    typography.padBottomPt * MM_PER_PT;

  return {
    widthMm: Math.max(zone.widthM * mmPerM, typography.minBoxWidthMm),
    heightMm: Math.max(zone.depthM * mmPerM, textMm),
  };
}
