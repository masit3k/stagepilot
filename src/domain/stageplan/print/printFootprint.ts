import { STAGEPLAN_BAND_LEADER_LINE } from "../../formatters/stageplan.js";
import type { StageplanPrintBox } from "../../pipeline/pdf/buildPdfStageplanPrintModel.js";
import { countStageplanBoxLines } from "../../pipeline/pdf/countStageplanBoxLines.js";
import { measurePrintTextMm } from "./textWidth.js";

const MM_PER_PT = 25.4 / 72;
const MM_PER_PX = 25.4 / 96;

export type PrintTypography = {
  readonly fontSizePt: number;
  readonly lineHeight: number;
  /** Řádek BANDLEADER se sází menším mono řezem (R9). */
  readonly roleFontSizePt: number;
  readonly roleTrackingEm: number;
  readonly titleGapPt: number;
  /** Odsazení boxu na všech čtyřech stranách — jedna hodnota místo tří (R7). */
  readonly padPt: number;
  /** Mezera mezi odrážkou a textem; v px, protože v px ji sází CSS. */
  readonly bulletSpacingPx: number;
  /** Prověřená šířka dnešního čtyřsloupcového boxu — zaniká s R6. */
  readonly minBoxWidthMm: number;
};

export type PrintFootprintMm = {
  readonly widthMm: number;
  readonly heightMm: number;
};

/** Co ze stopy boxu potřebuje jeho text. */
export type PrintBoxText = Pick<
  StageplanPrintBox,
  | "header"
  | "hasBandLeaderLine"
  | "inputBullets"
  | "monitorBullets"
  | "extraBullets"
  | "hasPowerBadge"
  | "powerBadgeText"
>;

/**
 * Tisková stopa boxu **jen z textu** (R3). Zóna do ní nevstupuje v žádné ose:
 * měření na reálných datech ukázalo, že `max(zóna, text)` z F5b byl v praxi
 * vždycky `text`, takže maximum jen zakrývalo, že zóna a karta jsou dvě různé
 * věci — zóna je místo na pódiu, karta je štítek se seznamem kanálů.
 *
 * Šířka je na měřítku nezávislá, protože text se sází v bodech. Právě proto
 * může `resolvePrintScale` brát stopu jako vstup a nemusí iterovat.
 */
export function computePrintFootprintMm(args: {
  readonly box: PrintBoxText;
  readonly typography: PrintTypography;
}): PrintFootprintMm {
  const { box, typography } = args;
  const { fontSizePt } = typography;

  const lineMm = fontSizePt * typography.lineHeight * MM_PER_PT;
  const padMm = typography.padPt * MM_PER_PT;
  const titleGapMm = typography.titleGapPt * MM_PER_PT;

  const bullets = [
    ...box.inputBullets,
    ...box.monitorBullets,
    ...box.extraBullets,
  ];
  const bulletPrefixMm =
    measurePrintTextMm({ text: "•", style: "boxBody", fontSizePt }) +
    typography.bulletSpacingPx * MM_PER_PX;

  const widths = [
    measurePrintTextMm({ text: box.header, style: "boxHeader", fontSizePt }),
    box.hasBandLeaderLine
      ? measurePrintTextMm({
          text: STAGEPLAN_BAND_LEADER_LINE,
          style: "boxRole",
          fontSizePt: typography.roleFontSizePt,
          trackingEm: typography.roleTrackingEm,
        })
      : 0,
    ...bullets.map(
      (bullet) =>
        bulletPrefixMm +
        measurePrintTextMm({ text: bullet, style: "boxBody", fontSizePt }),
    ),
    box.hasPowerBadge
      ? measurePrintTextMm({
          text: box.powerBadgeText,
          style: "boxPower",
          fontSizePt,
        })
      : 0,
  ];

  return {
    widthMm: 2 * padMm + Math.max(...widths),
    heightMm:
      2 * padMm +
      lineMm +
      countStageplanBoxLines(box) * lineMm +
      (bullets.length > 0 ? titleGapMm : 0) +
      // R8: plný řádek nad napájením, stejný jako mezi skupinami odrážek.
      (box.hasPowerBadge ? 2 * lineMm : 0),
  };
}
