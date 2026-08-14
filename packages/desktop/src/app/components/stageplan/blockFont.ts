/** Čitelný strop na velkém okně a podlaha, pod kterou už text nemá smysl (R5). */
export const BLOCK_FONT_MAX_PX = 11;
export const BLOCK_FONT_MIN_PX = 7;

const MM_PER_PT = 25.4 / 72;

/**
 * Velikost písma v kartě bloku. `pxPerM` jsou pixely obrazovky na metr pódia,
 * `mmPerM` milimetry papíru na metr pódia — jejich podíl je tedy **pixel
 * obrazovky na milimetr papíru**, a tím se tisková velikost písma převede na
 * obrazovku.
 *
 * Na velkém okně vyjde proporce nad strop, takže se použije čitelných
 * `BLOCK_FONT_MAX_PX` a výpis se do karty vejde s rezervou. Na malém okně
 * proporce klesne a písmo jde s ní, aby výpis z karty nevypadl. Pod podlahou
 * vrací `null` — volající pak vykreslí jen hlavičku.
 */
export function resolveBlockFontPx(args: {
  readonly fontSizePt: number;
  readonly pxPerM: number;
  readonly mmPerM: number;
}): number | null {
  const pxPerPrintMm = args.pxPerM / args.mmPerM;
  const proportionalPx = args.fontSizePt * MM_PER_PT * pxPerPrintMm;
  const fontPx = Math.min(BLOCK_FONT_MAX_PX, proportionalPx);
  return fontPx < BLOCK_FONT_MIN_PX ? null : fontPx;
}
