import { writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Page } from "puppeteer";
import { launchPdfBrowser, setPdfPageContent } from "../src/infra/pdf/pdf.js";
import { pdfStyles } from "../src/infra/pdf/styles.js";
import { PRINT_TEXT_STYLE_SPECS } from "./printTextStyles.js";

const STYLES = PRINT_TEXT_STYLE_SPECS;

/** Tisknutelné ASCII + česká diakritika + typografie z odrážek. */
const CORPUS: string[] = [
  ...Array.from({ length: 0x7e - 0x20 + 1 }, (_, index) =>
    String.fromCharCode(0x20 + index),
  ),
  ...Array.from("ÁČĎÉĚÍŇÓŘŠŤÚŮÝŽáčďéěíňóřšťúůýž"),
  ...Array.from("–—•·×°"),
];

/**
 * Měří se při velkém písmu a dělí velikostí, aby v podílu zbylo dost platných
 * číslic. Chromium běží s `--font-render-hinting=none` (viz launchPdfBrowser),
 * takže advance je ve velikosti lineární a podíl platí i pro 8 pt.
 */
const MEASURE_FONT_PX = 1000;

const OUT_FILE = path.join(
  process.cwd(),
  "src",
  "domain",
  "stageplan",
  "print",
  "glyphAdvances.ts",
);

type StyleTables = Record<string, Record<string, number>>;

function renderMeasurementHtml(baseHref: string): string {
  return `<!doctype html>
<html lang="cs">
<head>
  <meta charset="utf-8" />
  <base href="${baseHref}">
  <style>
${pdfStyles}
  </style>
  <style>
    /* Jeden znak v izolaci: kerning se nemá čeho chytit, takže je tabulka
       kerningu-prostá už z konstrukce. Součet pak platí jen tehdy, když ho
       CSS boxu vypne i při sazbě — o to se stará R2. */
    .probe {
      position: absolute;
      top: 0;
      left: 0;
      white-space: pre;
      font-kerning: none;
      font-variant-ligatures: none;
      letter-spacing: 0;
      font-size: ${MEASURE_FONT_PX}px;
    }
  </style>
</head>
<body></body>
</html>`;
}

function formatTable(name: string, advances: Record<string, number>): string {
  const entries = Object.entries(advances).sort(
    ([a], [b]) => (a.codePointAt(0) ?? 0) - (b.codePointAt(0) ?? 0),
  );
  const maxAdvance = Math.max(...entries.map(([, value]) => value));
  const body = entries
    .map(([char, value]) => `      ${JSON.stringify(char)}: ${value},`)
    .join("\n");
  return `  ${name}: {
    maxAdvance: ${maxAdvance},
    advances: {
${body}
    },
  },`;
}

function renderModule(tables: StyleTables): string {
  const styleUnion = STYLES.map((style) => `"${style.name}"`).join(" | ");
  const styleList = STYLES.map((style) => `"${style.name}"`).join(", ");
  const bodies = STYLES.map((style) =>
    formatTable(style.name, tables[style.name]),
  ).join("\n");

  return `/**
 * VYGENEROVANÝ SOUBOR — needituj ručně, přegeneruj \`npm run glyphs:generate\`.
 *
 * Šířka znaku jako zlomek velikosti písma, změřená v Chromiu — tedy tím
 * strojem, který PDF tiskne (R1). Čte se z ní v doméně i v editoru, aby obě
 * strany došly k témuž číslu. Znak, který v tabulce není, dostane
 * \`maxAdvance\` téhle tabulky: box radši vyjde o kus širší, než aby uřízl
 * číslo kanálu.
 */
export type PrintTextStyle = ${styleUnion};

export const PRINT_TEXT_STYLES: readonly PrintTextStyle[] = [${styleList}];

export type GlyphAdvanceTable = {
  readonly maxAdvance: number;
  readonly advances: Readonly<Record<string, number>>;
};

export const GLYPH_ADVANCES: Readonly<
  Record<PrintTextStyle, GlyphAdvanceTable>
> = {
${bodies}
};
`;
}

async function measureAllStyles(page: Page): Promise<StyleTables> {
  return (await page.evaluate(
    async (args) => {
      const probe = document.createElement("span");
      probe.className = "probe";
      document.body.appendChild(probe);

      const result: Record<string, Record<string, number>> = {};
      for (const style of args.styles) {
        await document.fonts.load(
          `${style.fontWeight} ${args.fontPx}px '${style.fontFamily}'`,
        );
        probe.style.fontFamily = `'${style.fontFamily}'`;
        probe.style.fontWeight = String(style.fontWeight);

        const table: Record<string, number> = {};
        for (const char of args.corpus) {
          probe.textContent = char;
          table[char] =
            Math.round(
              (probe.getBoundingClientRect().width / args.fontPx) * 1e5,
            ) / 1e5;
        }
        result[style.name] = table;
      }
      probe.remove();
      return result;
    },
    {
      styles: STYLES.map((style) => ({ ...style })),
      corpus: CORPUS,
      fontPx: MEASURE_FONT_PX,
    },
  )) as StyleTables;
}

function assertNoZeroWidth(tables: StyleTables): void {
  for (const style of STYLES) {
    const table = tables[style.name];
    const zeroWidth = Object.entries(table).filter(([, value]) => value <= 0);
    if (zeroWidth.length > 0) {
      throw new Error(
        `Style ${style.name} measured zero-width glyphs (font not loaded?): ${zeroWidth
          .map(([char]) => JSON.stringify(char))
          .join(", ")}`,
      );
    }
  }
}

async function run(): Promise<void> {
  const pdfBaseDir = path.join(process.cwd(), "src", "infra", "pdf");
  const baseHref = pathToFileURL(pdfBaseDir + path.sep).href;

  const browser = await launchPdfBrowser();
  try {
    const page = await browser.newPage();
    await setPdfPageContent(page, baseHref, renderMeasurementHtml(baseHref));

    const tables = await measureAllStyles(page);
    assertNoZeroWidth(tables);

    await writeFile(OUT_FILE, renderModule(tables), "utf8");
    console.error(`[glyphs] wrote ${OUT_FILE}`);
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error("[glyphs] generation failed", error);
  process.exitCode = 1;
});
