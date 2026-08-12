const MM_TO_PT = 72 / 25.4;

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

const PAGE_MARGINS_MM = {
  top: 20,
  right: 15,
  bottom: 15,
  left: 15,
} as const;

/** Čte "17.1pt". Hází, místo aby hádala — špatná jednotka je chyba, ne nula. */
export function parsePt(value: string): number {
  const match = /([0-9.]+)\s*pt/i.exec(value);
  if (!match) {
    throw new Error(`Expected a pt value, got "${value}"`);
  }
  return Number.parseFloat(match[1]);
}

function ptToMm(pt: number): number {
  return pt / MM_TO_PT;
}

/**
 * Barvy dokumentu. Zdroj pravdy je packages/desktop/src/styles/primitives.css;
 * infra vrstva ho nemůže importovat, takže tokens.test.ts hlídá shodu.
 *
 * steel je záměrně ztmavená varianta (--sp-steel), ne hodnota z handoffu
 * (--sp-steel-decor #8a8d92) — ta dává na papíře 2,98:1 a text má 7,2 pt.
 */
export const pdfTokens = {
  ink: "#101112",
  body: "#55585c",
  steel: "#6b6d71",
  line: "#e4e1da",
  lineFaint: "#f0ede7",
  signal: "#ff5b1f",
} as const;

export const pdfLayout = {
  page: {
    size: "A4",
    margins: {
      top: `${PAGE_MARGINS_MM.top}mm`,
      right: `${PAGE_MARGINS_MM.right}mm`,
      bottom: `${PAGE_MARGINS_MM.bottom}mm`,
      left: `${PAGE_MARGINS_MM.left}mm`,
    },
    /**
     * Tiskové zrcadlo. Odvozené z okrajů, ne opsané — .pdfPage si tyhle rozměry
     * bere jako pevné, takže rozložení na obrazovce odpovídá tomu na papíře a
     * kontrola přetečení měří skutečný dokument.
     */
    contentWidthMm: A4_WIDTH_MM - PAGE_MARGINS_MM.left - PAGE_MARGINS_MM.right,
    contentHeightMm:
      A4_HEIGHT_MM - PAGE_MARGINS_MM.top - PAGE_MARGINS_MM.bottom,
  },

  /** Škála 1 px mocku = 0,9 pt, ukotvená na řádek tabulky (9 pt). */
  typography: {
    fontFamily: "Space Grotesk",
    monoFamily: "IBM Plex Mono",
    title: {
      size: "17.1pt",
      weight: 600 as const,
      lineHeight: 1,
      tracking: "-0.025em",
    },
    meta: { size: "8.1pt", lineHeight: 1.4, tracking: "0.04em" },
    stamp: { size: "8.1pt", lineHeight: 1.6, tracking: "0.04em" },
    tableHead: {
      size: "7.2pt",
      weight: 400 as const,
      lineHeight: 1,
      tracking: "0.14em",
    },
    table: {
      size: "9pt",
      lineHeight: 1.2,
      inputWeight: 500 as const,
      headerWeight: 700 as const,
    },
    footer: { size: "7.2pt", lineHeight: 1.4, tracking: "0.04em" },
  },

  header: {
    markSizePt: 23.4,
    logoMaxWidthMm: 40,
    gapPt: 10.8,
    textGapPt: 2.7,
    padBottomPt: 12.6,
    rulePt: 2,
    marginBottomPt: 16.2,
  },

  footer: {
    padTopPt: 12.6,
    rulePt: 0.5,
  },

  table: {
    colNo: "42pt",
    colInput: "145pt",
    borderPx: 0.5,
    padY: "2pt",
    padX: "6pt",
  },

  ids: {
    page: "page",
    content: "content",
    page2: "page2",
    content2: "content2",
  },
} as const;

const headerTextColumnPt =
  parsePt(pdfLayout.typography.title.size) *
    pdfLayout.typography.title.lineHeight +
  pdfLayout.header.textGapPt +
  parsePt(pdfLayout.typography.meta.size) *
    pdfLayout.typography.meta.lineHeight;

/**
 * Výška hlavičky a patičky v mm. Čte je CSS i výškový rozpočet stage planu,
 * aby se nemohly rozejít — rozpočet by jinak tvrdil, že je na straně místo,
 * které hlavička zabírá.
 */
export const pdfChromeHeights = {
  headerMm: ptToMm(
    Math.max(pdfLayout.header.markSizePt, headerTextColumnPt) +
      pdfLayout.header.padBottomPt +
      pdfLayout.header.rulePt +
      pdfLayout.header.marginBottomPt,
  ),
  footerMm: ptToMm(
    pdfLayout.footer.rulePt +
      pdfLayout.footer.padTopPt +
      parsePt(pdfLayout.typography.footer.size) *
        pdfLayout.typography.footer.lineHeight,
  ),
} as const;
