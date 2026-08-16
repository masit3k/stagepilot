import { GLYPH_ADVANCES, type PrintTextStyle } from "./glyphAdvances.js";

const MM_PER_PT = 25.4 / 72;

/**
 * Šířka řetězce v milimetrech podle vygenerované tabulky (R1). Doména text
 * měřit neumí a měřit ho nemůže — čte proto čísla, která pro tytéž řezy
 * naměřilo Chromium, tedy stroj, který PDF tiskne.
 *
 * Součet platí jen tehdy, když sazba nemá kerning ani ligatury: obojí CSS
 * tištěného boxu vypíná (R2). Bez toho by tohle číslo byl odhad.
 *
 * Prostrkání se přičítá za **každý** znak včetně posledního, protože přesně
 * tak sází CSS `letter-spacing`.
 */
export function measurePrintTextMm(args: {
  readonly text: string;
  readonly style: PrintTextStyle;
  readonly fontSizePt: number;
  readonly trackingEm?: number;
}): number {
  const table = GLYPH_ADVANCES[args.style];
  const trackingEm = args.trackingEm ?? 0;

  let advanceEm = 0;
  let charCount = 0;
  for (const char of args.text) {
    advanceEm += table.advances[char] ?? table.maxAdvance;
    charCount += 1;
  }

  const widthPt = (advanceEm + charCount * trackingEm) * args.fontSizePt;
  return widthPt * MM_PER_PT;
}
