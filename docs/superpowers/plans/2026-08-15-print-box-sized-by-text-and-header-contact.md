# F7 — tištěný box podle textu, kapelník v boxu a kontakt v hlavičce: implementační plán

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Velikost tištěného bloku určuje jeho text, ne zóna; box je souměrný, text z něj nevytéká, kapelnictví se značí jedním řádkem uvnitř boxu a kontaktní osoba stojí v hlavičce dokumentu.

**Architecture:** Doména dostane vygenerovanou tabulku šířek znaků (změřenou v Chromiu, tedy tím strojem, který PDF tiskne) a nad ní čistou funkci `measurePrintTextMm`. Tisková stopa boxu se přepočítá jen z textu — zóna do ní nevstupuje v žádné ose — takže stopa přestane záviset na měřítku a měřítko se naopak zobecní na rezervu per blok v obou osách. Kapelník se z hvězdičky v hlavičce a vysvětlivky pod plánem stěhuje na řádek `BANDLEADER` uvnitř boxu; kontaktní osoba z patičky do hlavičky.

**Tech Stack:** TypeScript ESM, React + Vite, Tauri (Rust), Puppeteer (Chromium), Vitest (node, bez jsdom), Biome, tsx pro skripty.

**Spec:** [2026-08-15-print-box-sized-by-text-and-header-contact-design.md](../specs/2026-08-15-print-box-sized-by-text-and-header-contact-design.md) — rozhodnutí `R1`–`R16`.

## Global Constraints

- **Vrstvy:** `src/domain/` bez I/O; `src/app/usecases/` orchestrace; `src/infra/` veškeré I/O; `packages/desktop/` jen UI a **nesmí importovat z `src/infra`**. Z `src/domain` importovat smí. Vygenerovaná tabulka šířek jsou **data, ne I/O**, takže do domény patří; generátor je skript v `scripts/`, ne součást běhu.
- **Jazyk:** rozhraní aplikace **anglicky**, obsah PDF **česky** (`DOWNSTAGE · PUBLIKUM`, `PÓDIUM … m`, `KONTAKTNÍ OSOBA · …`). Jediná vědomá výjimka je slovo **`BANDLEADER`** (R10) — neopravovat na `KAPELNÍK`. Komentáře v kódu zůstávají česky.
- **Commit message je jednořádkový.** Hook odmítne tělo i patičku. Formát jako v historii: `feat(scope): …`, `fix(scope): …`, `test(scope): …`, `refactor(scope): …`, `docs(design): …`.
- **Baseline repa je trvale červený. Měř rozdíl, ne absolutní čísla:** 2 padající testy (`assetsPaths`, `repoAssets`), ~1368 CRLF lint chyb, 10 typových chyb ve 4 testovacích souborech `packages/desktop`.
- **Lintovat jen dotčené soubory:** `npx biome check <cesty>`, ne `npm run lint` na celý repo.
- Testy: `npx vitest run <cesta>` pro jeden soubor, `npm test` pro celek. Testy `packages/desktop` běží pod kořenovým `vitest` (kořenový `vitest.config.ts` nemá `include`, takže bere i `packages/**`).
- **Nikdy nezapisovat mimo `%APPDATA%/StagePilot`** a nikdy neměnit `data/assets/` za běhu.
- **Chromium:** skripty, které měří nebo renderují, spouštějí prohlížeč **výhradně přes `launchPdfBrowser()`** z `src/infra/pdf/pdf.ts`. Nese pořadí systémový Chrome → svázaný Chromium → `PUPPETEER_EXECUTABLE_PATH` a hlavně přepínač `--font-render-hinting=none`, bez kterého nejsou šířky glyfů lineární ve velikosti písma a Task 1 i Task 8 se rozejdou.
- Reálné projekty pro ruční i smoke ověření (`%APPDATA%/StagePilot/projects`):
  `019f6578-3138-7dee-b334-6e9613c37a72` (FNB, Zámek Bon Repos) a
  `019e69c0-4c37-7e56-83eb-8b869fc84add` (BK, Konopiště).
- **Fyzikální konstanty používané napříč plánem:** `1pt = 25,4/72 mm = 0,352778 mm`, `1px = 25,4/96 mm = 0,264583 mm`. Řádek boxu při 8 pt a `line-height: 1.25` je `10 pt = 3,52778 mm`.

---

## File Structure

| Soubor | Odpovědnost | Akce |
|---|---|---|
| `scripts/printTextStyles.ts` | rodina a váha písma pro čtyři řezy boxu — jeden zdroj pro generátor i smoke | **create** |
| `scripts/generate_glyph_advances.ts` | změří znaky v Chromiu a vygeneruje tabulku šířek | **create** |
| `src/domain/stageplan/print/glyphAdvances.ts` | **vygenerovaná** data: šířka znaku jako zlomek velikosti písma, pro čtyři řezy | **create** |
| `src/domain/stageplan/print/glyphAdvances.test.ts` | pojistka nad tvarem a pokrytím vygenerované tabulky | **create** |
| `src/domain/stageplan/print/textWidth.ts` | `measurePrintTextMm` — součet šířek nad tabulkou | **create** |
| `src/domain/stageplan/print/textWidth.test.ts` | testy součtu, neznámého znaku a prostrkání | **create** |
| `src/domain/stageplan/print/printFootprint.ts` | tisková stopa boxu — nově jen z textu | modify |
| `src/domain/stageplan/print/printFootprint.test.ts` | testy stopy | modify |
| `src/domain/stageplan/print/printScale.ts` | měřítko plánu — nově rezerva per blok v obou osách | modify |
| `src/domain/stageplan/print/printScale.test.ts` | testy měřítka | modify |
| `src/domain/formatters/stageplan.ts` | hlavička boxu (bez hvězdičky) + konstanta `BANDLEADER` | modify |
| `src/domain/formatters/formatStageplanBoxHeader.test.ts` | testy formátování | modify |
| `src/domain/pipeline/pdf/buildPdfStageplanPrintModel.ts` | tiskový model boxu — `hasBandLeaderLine` místo `hasBandLeaderMark` | modify |
| `src/domain/pipeline/pdf/buildPdfStageplanPrintModel.test.ts` | testy modelu | modify |
| `src/domain/pipeline/pdf/countStageplanBoxLines.ts` | počet řádkových výšek pod hlavičkou — nově i řádek kapelníka | modify |
| `src/domain/pipeline/pdf/countStageplanBoxLines.test.ts` | testy počtu řádků | modify |
| `src/domain/model/bandLeader.ts` | `isBandLeader` ztrácí posledního konzumenta | modify |
| `src/infra/pdf/layout.ts` | rozpočet výšky hlavičky (kontakt + razítkový sloupec) | modify |
| `src/infra/pdf/layout.test.ts` | testy rozpočtu | modify |
| `src/infra/pdf/template.ts` | typ `PdfContact`, kontakt v hlavičce, patička bez kontaktu | modify |
| `src/infra/pdf/template.test.ts` | testy šablony | modify |
| `src/infra/pdf/pdf.ts` | `RenderPdfOptions.contact` místo `contactLine` | modify |
| `src/infra/pdf/sections/stageplan.ts` | typografie, stopa, měřítko, kresba boxu, zánik vysvětlivky | modify |
| `src/infra/pdf/sections/stageplan.test.ts` | testy kresby a pojistek | modify |
| `src/infra/pdf/styles.ts` | CSS boxu (odsazení, kerning, nowrap, řádek role), kontakt v hlavičce | modify |
| `src/infra/pdf/styles.test.ts` | testy CSS | modify |
| `src/app/usecases/exportPdf.ts` | `formatContactLine` bez kapelníka, vrací `PdfContact` | modify |
| `scripts/desktop_preview.ts` | volání načtení kontaktu | modify |
| `scripts/smoke_stageplan_print.ts` | dvě tiskové smoke kontroly z R16 | **create** |
| `packages/desktop/src/app/components/stageplan/blockPrint.ts` | tisková stopa bloku v editoru, zánik `isBelowPrintFloor` | modify |
| `packages/desktop/src/app/components/stageplan/blockPrint.test.ts` | testy | modify |
| `packages/desktop/src/app/components/stageplan/StageBlock.tsx` | řádek `BANDLEADER` a mezera před napájením na kartě | modify |
| `packages/desktop/src/app/components/stageplan/BlockInspector.tsx` | `PRINTED` bez zvýraznění | modify |
| `packages/desktop/src/app/pages/StagePlanEditorPage.tsx` | nové volání `resolvePrintScale` | modify |
| `packages/desktop/src/styles/features/stageplan-editor.css` | CSS karty (kerning, řádek role), zánik `--flagged` | modify |
| `package.json` | skripty `glyphs:generate` a `smoke:stageplan-print` | modify |

### Pořadí, ve kterém se to smí dělat

Stopa se počítá dřív, než se změní CSS boxu (Task 5 → Task 6). Obráceně by mezi commity existoval stav, kdy je nakreslený obsah větší než rezervovaná stopa, tedy stav, který **přetéká**. V pořadí model-první je stopa naopak o 4 pt velkorysejší než kresba, což je neškodné.

Měřítko (Task 7) je až po stopě, protože nová `resolvePrintScale` bere stopu boxu v milimetrech jako **vstup** — což jde teprve tehdy, když stopa přestane záviset na `mmPerM`.

---

## Task 1: Tabulka šířek znaků (R1)

**Files:**
- Create: `scripts/printTextStyles.ts`
- Create: `scripts/generate_glyph_advances.ts`
- Create: `src/domain/stageplan/print/glyphAdvances.ts` (vygenerovaný)
- Create: `src/domain/stageplan/print/glyphAdvances.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `launchPdfBrowser()` a `pdfStyles` z `src/infra/pdf/` (jen skript, ne doména).
- Produces:
  - `type PrintTextStyle = "boxHeader" | "boxRole" | "boxBody" | "boxPower"`
  - `const PRINT_TEXT_STYLES: readonly PrintTextStyle[]`
  - `type GlyphAdvanceTable = { readonly maxAdvance: number; readonly advances: Readonly<Record<string, number>> }`
  - `const GLYPH_ADVANCES: Readonly<Record<PrintTextStyle, GlyphAdvanceTable>>`

  Čísla jsou **zlomek velikosti písma** (advance / font-size), takže jsou na velikosti nezávislá.

- [ ] **Step 1: Napiš padající test**

Vytvoř `src/domain/stageplan/print/glyphAdvances.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  GLYPH_ADVANCES,
  PRINT_TEXT_STYLES,
  type PrintTextStyle,
} from "./glyphAdvances.js";

/**
 * Znaky, které se v tištěném boxu opravdu objevují: česká abeceda v obou
 * velikostech, číslice a interpunkce z odrážek. Chybějící znak by dostal
 * `maxAdvance`, takže by box vyšel zbytečně široký — tenhle test to odhalí
 * dřív než pohled na papír.
 */
const REQUIRED_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz" +
  "ÁČĎÉĚÍŇÓŘŠŤÚŮÝŽáčďéěíňóřšťúůýž" +
  "0123456789" +
  " .,:;()+-/&%*'\"–—•·×°";

describe("GLYPH_ADVANCES", () => {
  it("has a table for each of the four printed styles", () => {
    expect(PRINT_TEXT_STYLES).toEqual([
      "boxHeader",
      "boxRole",
      "boxBody",
      "boxPower",
    ]);
    for (const style of PRINT_TEXT_STYLES) {
      expect(Object.keys(GLYPH_ADVANCES[style].advances).length).toBeGreaterThan(
        100,
      );
    }
  });

  it("covers every character the printed box can contain", () => {
    for (const style of PRINT_TEXT_STYLES) {
      const missing = [...REQUIRED_CHARS].filter(
        (char) => GLYPH_ADVANCES[style].advances[char] === undefined,
      );
      expect({ style, missing }).toEqual({ style, missing: [] });
    }
  });

  it("keeps every advance a plausible fraction of the font size", () => {
    for (const style of PRINT_TEXT_STYLES) {
      for (const [char, advance] of Object.entries(
        GLYPH_ADVANCES[style].advances,
      )) {
        expect({ style, char, ok: advance > 0 && advance < 2 }).toEqual({
          style,
          char,
          ok: true,
        });
      }
    }
  });

  it("keeps maxAdvance the widest glyph of its own table", () => {
    for (const style of PRINT_TEXT_STYLES) {
      const table = GLYPH_ADVANCES[style];
      expect(table.maxAdvance).toBeCloseTo(
        Math.max(...Object.values(table.advances)),
        6,
      );
    }
  });

  it("measured four distinct cuts, not one table copied four times", () => {
    // Tučný nadpis musí být širší než základní řez a mono řez musí mít
    // všechny znaky stejně široké — kdyby generátor zapomněl přepnout
    // font-weight nebo font-family, tabulky by si byly rovné.
    const widthOf = (style: PrintTextStyle, char: string) =>
      GLYPH_ADVANCES[style].advances[char];

    expect(widthOf("boxHeader", "M")).toBeGreaterThan(widthOf("boxBody", "M"));
    expect(widthOf("boxPower", "M")).toBeGreaterThan(widthOf("boxBody", "M"));
    expect(widthOf("boxRole", "i")).toBeCloseTo(widthOf("boxRole", "M"), 6);
    expect(widthOf("boxBody", "i")).toBeLessThan(widthOf("boxBody", "M"));
  });
});
```

- [ ] **Step 2: Spusť test a ověř, že padá**

Run: `npx vitest run src/domain/stageplan/print/glyphAdvances.test.ts`
Expected: FAIL — `Failed to resolve import "./glyphAdvances.js"`

- [ ] **Step 3: Napiš sdílený popis řezů**

Vytvoř `scripts/printTextStyles.ts`. Tenhle seznam čte generátor (Task 1) i
smoke kontrola (Task 8). Kdyby ho měl každý svůj, mohly by se rozejít — a
kontrola, která měří jiný řez, než jaký tabulka drží, projde a nic neověří.

```ts
/**
 * Čtyři řezy, které tištěný box používá (R1). Rodina a váha jsou opsané z CSS
 * v `src/infra/pdf/styles.ts`: nadpis `.stageplanBoxHeader` je 700, řádek role
 * `.stageplanBoxRole` je mono 400, odrážka dědí 400 a napájení
 * `.stageplanPower` je 600.
 *
 * Skript, ne doména: doména drží naměřená čísla, tenhle soubor jen říká, co se
 * měřilo. Když se změní CSS, změní se nejdřív tady a pak se přegeneruje.
 */
export type PrintTextStyleSpec = {
  readonly name: "boxHeader" | "boxRole" | "boxBody" | "boxPower";
  readonly fontFamily: string;
  readonly fontWeight: number;
};

export const PRINT_TEXT_STYLE_SPECS: readonly PrintTextStyleSpec[] = [
  { name: "boxHeader", fontFamily: "Space Grotesk", fontWeight: 700 },
  { name: "boxRole", fontFamily: "IBM Plex Mono", fontWeight: 400 },
  { name: "boxBody", fontFamily: "Space Grotesk", fontWeight: 400 },
  { name: "boxPower", fontFamily: "Space Grotesk", fontWeight: 600 },
];
```

- [ ] **Step 4: Napiš generátor**

Vytvoř `scripts/generate_glyph_advances.ts`:

```ts
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { launchPdfBrowser } from "../src/infra/pdf/pdf.js";
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

function formatTable(
  name: string,
  advances: Record<string, number>,
): string {
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

async function run(): Promise<void> {
  const pdfBaseDir = path.join(process.cwd(), "src", "infra", "pdf");
  const baseHref = pathToFileURL(pdfBaseDir + path.sep).href;

  const browser = await launchPdfBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(renderMeasurementHtml(baseHref), {
      waitUntil: "load",
    });

    const tables = (await page.evaluate(
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
```

- [ ] **Step 5: Přidej npm skript**

V `package.json` do `scripts` přidej:

```json
"glyphs:generate": "node --enable-source-maps --import tsx scripts/generate_glyph_advances.ts"
```

- [ ] **Step 6: Vygeneruj tabulku a naformátuj ji**

Run: `npm run glyphs:generate`
Expected: `[glyphs] wrote …/glyphAdvances.ts`, exit 0

Run: `npx biome format --write src/domain/stageplan/print/glyphAdvances.ts`

Pokud spuštění selže na prohlížeči (`PDF preview failed to launch browser`), **není to chyba plánu**: stroj nemá ani systémový Chrome, ani stažený Chromium. Náprava je `npx puppeteer browsers install chrome`, ne obcházení generátoru ručně psanými čísly — ručně psaná tabulka je přesně to, co smoke kontrola z Tasku 8 usvědčí.

- [ ] **Step 7: Spusť test a ověř, že prochází**

Run: `npx vitest run src/domain/stageplan/print/glyphAdvances.test.ts`
Expected: PASS (5 testů)

- [ ] **Step 8: Lint**

Run: `npx biome check scripts/printTextStyles.ts scripts/generate_glyph_advances.ts src/domain/stageplan/print/glyphAdvances.ts src/domain/stageplan/print/glyphAdvances.test.ts package.json`
Expected: krom CRLF hlášek z baseline žádná chyba

- [ ] **Step 9: Commit**

```bash
git add scripts/printTextStyles.ts scripts/generate_glyph_advances.ts src/domain/stageplan/print/glyphAdvances.ts src/domain/stageplan/print/glyphAdvances.test.ts package.json
git commit -m "feat(stageplan): generate glyph advance tables measured in chromium"
```

---

## Task 2: `measurePrintTextMm` (R1)

**Files:**
- Create: `src/domain/stageplan/print/textWidth.ts`
- Create: `src/domain/stageplan/print/textWidth.test.ts`

**Interfaces:**
- Consumes: `GLYPH_ADVANCES`, `PrintTextStyle` (Task 1).
- Produces:
  ```ts
  export function measurePrintTextMm(args: {
    readonly text: string;
    readonly style: PrintTextStyle;
    readonly fontSizePt: number;
    /** Prostrkání v em; Chromium ho přidává i za poslední znak. */
    readonly trackingEm?: number;
  }): number
  ```
  Vrací **milimetry**. Používají ji Task 5 (stopa) a Task 8 (smoke).

- [ ] **Step 1: Napiš padající test**

Vytvoř `src/domain/stageplan/print/textWidth.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { GLYPH_ADVANCES } from "./glyphAdvances.js";
import { measurePrintTextMm } from "./textWidth.js";

const MM_PER_PT = 25.4 / 72;

describe("measurePrintTextMm", () => {
  it("measures nothing for an empty string", () => {
    expect(
      measurePrintTextMm({ text: "", style: "boxBody", fontSizePt: 8 }),
    ).toBe(0);
  });

  it("sums the advances of its characters", () => {
    const advances = GLYPH_ADVANCES.boxBody.advances;
    const expected =
      (advances.B + advances.a + advances.s + advances.s) * 8 * MM_PER_PT;

    expect(
      measurePrintTextMm({ text: "Bass", style: "boxBody", fontSizePt: 8 }),
    ).toBeCloseTo(expected, 9);
  });

  it("scales linearly with the font size", () => {
    const small = measurePrintTextMm({
      text: "Drums (1–8)",
      style: "boxBody",
      fontSizePt: 8,
    });
    const large = measurePrintTextMm({
      text: "Drums (1–8)",
      style: "boxBody",
      fontSizePt: 16,
    });

    expect(large).toBeCloseTo(2 * small, 9);
  });

  it("gives an unknown character the widest advance of its own table", () => {
    // Řecká omega v korpusu není. Širší odhad je vědomá volba: opačná chyba
    // by znamenala uříznuté číslo kanálu (R1).
    const unknown = measurePrintTextMm({
      text: "Ω",
      style: "boxBody",
      fontSizePt: 8,
    });

    expect(unknown).toBeCloseTo(
      GLYPH_ADVANCES.boxBody.maxAdvance * 8 * MM_PER_PT,
      9,
    );
  });

  it("adds tracking after every character, including the last one", () => {
    const plain = measurePrintTextMm({
      text: "BANDLEADER",
      style: "boxRole",
      fontSizePt: 7.2,
    });
    const tracked = measurePrintTextMm({
      text: "BANDLEADER",
      style: "boxRole",
      fontSizePt: 7.2,
      trackingEm: 0.14,
    });

    // Deset znaků, tedy deset prostrků — Chromium sází letter-spacing i za
    // poslední znak, takže box musí počítat s desíti, ne s devíti.
    expect(tracked - plain).toBeCloseTo(10 * 0.14 * 7.2 * MM_PER_PT, 9);
  });

  it("counts a character, not a UTF-16 code unit", () => {
    // Znak mimo BMP je jeden znak, ne dva. Kdyby se iterovalo přes indexy,
    // dostal by maxAdvance dvakrát.
    const one = measurePrintTextMm({
      text: "😀",
      style: "boxBody",
      fontSizePt: 8,
    });

    expect(one).toBeCloseTo(GLYPH_ADVANCES.boxBody.maxAdvance * 8 * MM_PER_PT, 9);
  });
});
```

- [ ] **Step 2: Spusť test a ověř, že padá**

Run: `npx vitest run src/domain/stageplan/print/textWidth.test.ts`
Expected: FAIL — `Failed to resolve import "./textWidth.js"`

- [ ] **Step 3: Napiš implementaci**

Vytvoř `src/domain/stageplan/print/textWidth.ts`:

```ts
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
```

- [ ] **Step 4: Spusť test a ověř, že prochází**

Run: `npx vitest run src/domain/stageplan/print/textWidth.test.ts`
Expected: PASS (6 testů)

- [ ] **Step 5: Lint a commit**

Run: `npx biome check src/domain/stageplan/print/textWidth.ts src/domain/stageplan/print/textWidth.test.ts`

```bash
git add src/domain/stageplan/print/textWidth.ts src/domain/stageplan/print/textWidth.test.ts
git commit -m "feat(stageplan): measure printed text width from the glyph table"
```

---

## Task 3: Kapelník je řádek `BANDLEADER` v boxu (R9, R10, R13 část)

Hvězdička v hlavičce a vysvětlivka `* KAPELNÍK` pod plánem zanikají; místo nich má kapelník pod svým jménem řádek. Rezerva na výšku vysvětlivky mizí celá, takže plán získá zpátky ~2,4 mm.

**Files:**
- Modify: `src/domain/formatters/stageplan.ts`
- Modify: `src/domain/formatters/formatStageplanBoxHeader.test.ts`
- Modify: `src/domain/pipeline/pdf/buildPdfStageplanPrintModel.ts`
- Modify: `src/domain/pipeline/pdf/buildPdfStageplanPrintModel.test.ts`
- Modify: `src/domain/pipeline/pdf/countStageplanBoxLines.ts`
- Modify: `src/domain/pipeline/pdf/countStageplanBoxLines.test.ts`
- Modify: `src/infra/pdf/sections/stageplan.ts`
- Modify: `src/infra/pdf/sections/stageplan.test.ts`
- Modify: `src/infra/pdf/styles.ts`
- Modify: `src/infra/pdf/styles.test.ts`
- Modify: `packages/desktop/src/app/components/stageplan/StageBlock.tsx`
- Modify: `packages/desktop/src/app/components/stageplan/blockPrint.test.ts`
- Modify: `packages/desktop/src/styles/features/stageplan-editor.css`

**Interfaces:**
- Consumes: nic nového.
- Produces:
  - `export const STAGEPLAN_BAND_LEADER_LINE = "BANDLEADER"` v `src/domain/formatters/stageplan.ts` — čte ji Task 5 (šířka), renderer a editor.
  - `StageplanBoxHeaderArgs` bez `isBandLeader`.
  - `StageplanPrintBox.hasBandLeaderLine: boolean` **místo** `hasBandLeaderMark`.
  - `countStageplanBoxLines(box: StageplanBoxLines)`, kde
    `StageplanBoxLines = Pick<StageplanPrintBox, "hasBandLeaderLine" | "inputBullets" | "monitorBullets" | "extraBullets">`.
  - `stageplanLayout` bez `legendSize` a `legendGap`, nově s `boxRoleSize`, `boxRoleTracking` a `boxLine`.
  - `StageplanPlan` bez pole `legend`.

- [ ] **Step 1: Napiš padající testy domény**

V `src/domain/formatters/formatStageplanBoxHeader.test.ts` **nahraď** oba testy s hvězdičkou (`"marks the band leader with a footnote asterisk and no space"` a `"keeps the asterisk when musician names are hidden"`) jedním:

```ts
  it("never marks the band leader in the header (R9)", () => {
    // Kapelnictví značí jediné místo — řádek BANDLEADER uvnitř boxu.
    // Dvě souběžné mechaniky pro tutéž informaci jsou to, co F6 odstraňovala.
    const label = formatStageplanBoxHeader({
      instrumentLabel: "Bass",
      firstName: "Matěj",
    });

    expect(label).toBe("BASS – MATĚJ");
    expect(label).not.toContain("*");
  });
```

V `src/domain/pipeline/pdf/buildPdfStageplanPrintModel.test.ts`:
- na řádku ~68 změň `expect(model.boxesBySlot.lead_voc_1.header).toBe("LEAD VOC – ALICE*")` na `toBe("LEAD VOC – ALICE")`,
- nahraď test s `hasBandLeaderMark` (řádky ~206–207) tímto:

```ts
    expect(model.boxesBySlot.bass.hasBandLeaderLine).toBe(true);
    expect(model.boxesBySlot.drums.hasBandLeaderLine).toBe(false);
  });

  it("hides the band leader line together with the musician names (R9)", () => {
    // Kapelnictví je vlastnost osoby, ne pozice — když se osoba netiskne,
    // netiskne se ani její role.
    const model = buildPdfStageplanPrintModel(baseStageplan(), {
      hideMusicianNames: true,
    });

    expect(model.boxesBySlot.lead_voc_1.hasBandLeaderLine).toBe(false);
  });
```

V `src/domain/pipeline/pdf/countStageplanBoxLines.test.ts` doplň do pomocné funkce `box` pole `hasBandLeaderLine` a přidej test:

```ts
function box(args: {
  inputs?: string[];
  monitors?: string[];
  extras?: string[];
  bandLeader?: boolean;
}) {
  return {
    hasBandLeaderLine: args.bandLeader ?? false,
    inputBullets: args.inputs ?? [],
    monitorBullets: args.monitors ?? [],
    extraBullets: args.extras ?? [],
  };
}
```

```ts
  it("counts the band leader line as one line of the box (R9)", () => {
    // Řádek se sází menším písmem, ale rytmus boxu drží stejný, takže se do
    // stopy počítá týmž násobkem jako odrážka.
    expect(countStageplanBoxLines(box({ bandLeader: true }))).toBe(1);
    expect(
      countStageplanBoxLines(box({ inputs: ["a", "b"], bandLeader: true })),
    ).toBe(3);
  });
```

- [ ] **Step 2: Spusť testy a ověř, že padají**

Run: `npx vitest run src/domain/formatters/formatStageplanBoxHeader.test.ts src/domain/pipeline/pdf/countStageplanBoxLines.test.ts src/domain/pipeline/pdf/buildPdfStageplanPrintModel.test.ts`
Expected: FAIL — `expected 'BASS – MATĚJ*' to be 'BASS – MATĚJ'`, `hasBandLeaderLine` je `undefined`, počet řádků `0` místo `1`

- [ ] **Step 3: Uprav doménu**

V `src/domain/formatters/stageplan.ts` nahraď hlavičku boxu a přidej konstantu:

```ts
export type StageplanBoxHeaderArgs = {
  instrumentLabel: string;
  firstName?: string | null;
  hideMusicianNames?: boolean;
};

/**
 * Slovo, kterým se v boxu značí kapelník (R9). Vědomá anglická výjimka z
 * pravidla „PDF česky" (R10): pro zahraničního zvukaře je to zavedený termín,
 * srozumitelnější než KAPELNÍK. Neopravovat zpátky jako překlep.
 */
export const STAGEPLAN_BAND_LEADER_LINE = "BANDLEADER";

export function formatStageplanBoxHeader({
  instrumentLabel,
  firstName,
  hideMusicianNames = false,
}: StageplanBoxHeaderArgs): string {
  const resolvedName = firstName && firstName.trim() ? firstName.trim() : "";
  const displayInstrument =
    instrumentLabel === "Lead vocal" ? "Lead voc" : instrumentLabel;
  const mainBase =
    !hideMusicianNames && resolvedName
      ? `${displayInstrument} – ${resolvedName}`
      : displayInstrument;
  return mainBase.toUpperCase();
}
```

V `src/domain/pipeline/pdf/buildPdfStageplanPrintModel.ts`:

```ts
  /**
   * Zda box tiskne pod jménem řádek BANDLEADER (R9). Se skrytými jmény mizí i
   * on — kapelnictví je vlastnost osoby, ne pozice.
   */
  hasBandLeaderLine: boolean;
```

a v sestavení boxu (dnešní řádky 316–322):

```ts
      header: formatStageplanBoxHeader({
        instrumentLabel: roleData.instrument,
        firstName: roleData.firstName,
        hideMusicianNames: options.hideMusicianNames,
      }),
      hasBandLeaderLine:
        roleData.isBandLeader && !options.hideMusicianNames,
```

V `src/domain/pipeline/pdf/countStageplanBoxLines.ts`:

```ts
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
```

Přejmenuj i starý export `StageplanBoxBullets` → `StageplanBoxLines` (jiný konzument mimo tenhle soubor a jeho test není).

- [ ] **Step 4: Spusť doménové testy**

Run: `npx vitest run src/domain/formatters/formatStageplanBoxHeader.test.ts src/domain/pipeline/pdf/countStageplanBoxLines.test.ts src/domain/pipeline/pdf/buildPdfStageplanPrintModel.test.ts`
Expected: PASS

- [ ] **Step 5: Napiš padající testy rendereru**

V `src/infra/pdf/sections/stageplan.test.ts`:

- V testu `"keeps the print area derived from the page mirror"` uprav komentář a **přidej** tvrzení o výšce (vysvětlivka zanikla, takže plocha se vrací na hodnotu z R6 F5b):

```ts
    // Vysvětlivka pod plánem zanikla (R9), takže výška plochy je zase přesně
    // ta, kterou dal rozpočet strany v F5b — bez rezervy na řádek pod plánem.
    expect(stageplanLayout.areaHeightMm).toBeCloseTo(202.0911, 3);
```

- **Smaž** celý `describe("stageplan legend (R13)")` **kromě** testu
  `"keeps the print scale width-bound, so the reservation cannot shrink the plan"` a
  `"keeps the min-box-width reservation active for the default zones"` — ty přesuň do
  `describe("stageplan print geometry")` beze změny (zaniknou až v Tasku 7).
  Zanikají tedy: `"prints the legend when…"`, `"leaves the legend out when…"`,
  `"keeps the box footprint identical whether or not the header carries the mark"`,
  `"reserves exactly the legend's height in the area budget (R13)"`,
  `"keeps the legend element in the document flow…"`,
  `"ignores a band leader whose slot isn't among the printed blocks"`.

- Přidej nový `describe`:

```ts
describe("stageplan band leader line (R9)", () => {
  function vmWith(isLeader: boolean): DocumentViewModel["stageplan"] {
    return {
      ...emptyStageplan({
        stage: null,
        blocks: [
          {
            slot: "bass",
            centerXM: 6,
            centerYM: 4,
            widthM: 2.7,
            depthM: 1.4,
            rotationDeg: 0,
          },
        ],
      }),
      lineupByRole: { bass: { firstName: "Matěj", isBandLeader: isLeader } },
    };
  }

  it("prints the role under the name instead of an asterisk", () => {
    const html = renderStageplanSection({
      stageplan: vmWith(true),
    } as unknown as DocumentViewModel);

    expect(html).toContain('<div class="stageplanBoxHeader">BASS – MATĚJ</div>');
    expect(html).toContain('<div class="stageplanBoxRole">BANDLEADER</div>');
  });

  it("leaves the box alone when nobody in it leads the band", () => {
    const html = renderStageplanSection({
      stageplan: vmWith(false),
    } as unknown as DocumentViewModel);

    expect(html).not.toContain("stageplanBoxRole");
    expect(html).not.toContain("*");
  });

  it("drops the legend under the plan entirely", () => {
    // Vysvětlivka i její bezpodmínečná rezerva výšky zanikly — plán tím
    // získal zpátky ~2,4 mm a rozpočet o žádném řádku pod sebou neví.
    const html = renderStageplanSection({
      stageplan: vmWith(true),
    } as unknown as DocumentViewModel);

    expect(html).not.toContain("stageplanLegend");
    expect(html).not.toContain("KAPELNÍK");
  });

  it("puts the role line directly under the header, before the bullet gap", () => {
    // Jméno a role patří k sobě: mezi ně mezera nepatří, pod ně ano (R3).
    const html = renderStageplanSection({
      stageplan: {
        ...vmWith(true),
        inputs: [
          {
            channelNo: 5,
            label: "Bass DI",
            group: "bass",
            ownerRole: "bass",
          },
        ],
      },
    } as unknown as DocumentViewModel);

    const roleIndex = html.indexOf("stageplanBoxRole");
    const gapIndex = html.indexOf("stageplanTitleGap");
    const headerIndex = html.indexOf("stageplanBoxHeader");

    expect(headerIndex).toBeLessThan(roleIndex);
    expect(roleIndex).toBeLessThan(gapIndex);
  });
});
```

V `src/infra/pdf/styles.test.ts` nahraď test `"pins the legend's height budget…"` tímto:

```ts
  it("sets the band leader line in the same cut as the stage caption (R9)", () => {
    // Typografie se stěhuje dovnitř boxu, nová nevzniká: 7,2 pt mono,
    // prostrkané, šedé — týž řez, který měla vysvětlivka.
    expect(pdfStyles).not.toContain("stageplanLegend");
    expect(pdfStyles).toMatch(
      new RegExp(
        `\\.stageplanBoxRole\\s*\\{[^}]*font-size:\\s*${escapeRegExp(stageplanLayout.boxRoleSize)}`,
      ),
    );
    expect(pdfStyles).toMatch(
      new RegExp(
        `\\.stageplanBoxRole\\s*\\{[^}]*letter-spacing:\\s*${escapeRegExp(stageplanLayout.boxRoleTracking)}`,
      ),
    );
    expect(pdfStyles).toMatch(
      new RegExp(
        `\\.stageplanBoxRole\\s*\\{[^}]*line-height:\\s*${escapeRegExp(stageplanLayout.boxLine)}`,
      ),
    );
    expect(pdfStyles).toMatch(
      new RegExp(
        `\\.stageplanBoxRole\\s*\\{[^}]*color:\\s*${escapeRegExp(pdfTokens.steel)}`,
      ),
    );
  });
```

- [ ] **Step 6: Spusť testy rendereru a ověř, že padají**

Run: `npx vitest run src/infra/pdf/sections/stageplan.test.ts src/infra/pdf/styles.test.ts`
Expected: FAIL — `stageplanLayout.boxRoleSize` je `undefined`, HTML neobsahuje `stageplanBoxRole`, `areaHeightMm` je 198,14

- [ ] **Step 7: Uprav renderer**

V `src/infra/pdf/sections/stageplan.ts`:

1. Smaž konstanty `legendGapPt`, `legendHeightPt` i jejich blokový komentář a odečet `- ptToMm(legendHeightPt)` z `areaHeightMm`.
2. Smaž konstantu `BAND_LEADER_LEGEND` a pole `legend` z typu `StageplanPlan` i z návratu `buildStageplanPlan`.
3. V `renderStageplanSection` smaž `<div class="stageplanLegend">…</div>` z výsledného HTML.
4. Do `printTypography` přidej rozměry řádku role (potřebuje je Task 5 na šířku, CSS na sazbu):

```ts
const printTypography: PrintTypography = {
  fontSizePt: parsePt(pdfLayout.typography.table.size) - 1,
  lineHeight: 1.25,
  roleFontSizePt: parsePt(pdfLayout.typography.tableHead.size),
  roleTrackingEm: Number.parseFloat(pdfLayout.typography.tableHead.tracking),
  titleGapPt: 6,
  padBottomPt: parsePt(pdfLayout.table.padY),
  minBoxWidthMm,
};
```

> Pozn.: `roleFontSizePt`/`roleTrackingEm` přidej i do typu `PrintTypography`
> v `src/domain/stageplan/print/printFootprint.ts`. `padBottomPt` a
> `minBoxWidthMm` tam zatím zůstávají — mizí v Tasku 5, respektive 7.

5. V `stageplanLayout` nahraď `legendSize`/`legendGap` řádky pro roli a přidej odvozenou výšku řádku:

```ts
  boxRoleSize: pdfLayout.typography.tableHead.size,
  boxRoleTracking: pdfLayout.typography.tableHead.tracking,
  /** Řádková výška boxu v bodech — CSS i stopa boxu musí říkat totéž. */
  boxLine: `${printTypography.fontSizePt * printTypography.lineHeight}pt`,
```

6. V `renderBox` vlož řádek role hned za hlavičku:

```ts
  const lines: string[] = [
    `<div class="stageplanBoxHeader">${box.header}</div>`,
  ];

  // Jméno a role patří k sobě — mezi ně mezera nepatří (R3, R9).
  if (box.hasBandLeaderLine) {
    lines.push(
      `<div class="stageplanBoxRole">${STAGEPLAN_BAND_LEADER_LINE}</div>`,
    );
  }
```

s importem `STAGEPLAN_BAND_LEADER_LINE` z `../../../domain/formatters/stageplan.js`.

V `src/infra/pdf/styles.ts` smaž celý blok `.stageplanLegend` a za `.stageplanBoxHeader` přidej:

```css
/* Řádek role pod jménem: týž řez jako popisek pódia, jen uvnitř boxu (R9).
   Řádková výška je uzamčená na řádek boxu, ne na vlastní em — jinak by menší
   písmo rozhodilo rytmus, se kterým počítá tisková stopa. */
.stageplanBoxRole {
  font-family: '${pdfLayout.typography.monoFamily}', Consolas, monospace;
  font-size: ${stageplanLayout.boxRoleSize};
  line-height: ${stageplanLayout.boxLine};
  letter-spacing: ${stageplanLayout.boxRoleTracking};
  color: ${pdfTokens.steel};
  text-align: center;
  white-space: nowrap;
}
```

a v `.stageplanGap` nahraď `height: calc(1em * ${stageplanLayout.textLineHeight});` za `height: ${stageplanLayout.boxLine};` (číselně totéž, ale odvozené ze stejné konstanty jako stopa).

- [ ] **Step 8: Spusť testy rendereru a ověř, že prochází**

Run: `npx vitest run src/infra/pdf/sections/stageplan.test.ts src/infra/pdf/styles.test.ts src/infra/pdf/template.test.ts`
Expected: PASS

- [ ] **Step 9: Dotáhni editor**

V `packages/desktop/src/app/components/stageplan/StageBlock.tsx` vlož pod `.stage-block__label`:

```tsx
      {box?.hasBandLeaderLine ? (
        <div className="stage-block__role">{STAGEPLAN_BAND_LEADER_LINE}</div>
      ) : null}
```

s importem `import { STAGEPLAN_BAND_LEADER_LINE } from "../../../../../../src/domain/formatters/stageplan";`.

V `packages/desktop/src/styles/features/stageplan-editor.css` za `.stage-block__label`:

```css
/* Karta je tištěný box, takže role stojí i tady pod jménem (R9). */
.stage-block__role {
  text-align: center;
  letter-spacing: 0.14em;
  color: var(--color-stage-text-dim);
  white-space: nowrap;
}
```

V `packages/desktop/src/app/components/stageplan/blockPrint.test.ts` doplň do pomocné funkce `box` pole `hasBandLeaderLine: false` (jinak typ neprojde) a přidej test stopy s kapelníkem:

```ts
  it("adds one line to the footprint for the band leader row", () => {
    const withLeader = resolveBlockPrint({
      block: block(),
      geometry: geometry([box({ hasBandLeaderLine: true })]),
      scale,
    });
    const withoutLeader = resolveBlockPrint({
      block: block(),
      geometry: geometry([box({ hasBandLeaderLine: false })]),
      scale,
    });

    const lineM = scale.toM((TYPOGRAPHY.fontSizePt * TYPOGRAPHY.lineHeight * 25.4) / 72);
    expect(
      (withLeader?.footprint.depthM ?? 0) - (withoutLeader?.footprint.depthM ?? 0),
    ).toBeCloseTo(lineM, 6);
  });
```

a do `TYPOGRAPHY` doplň `roleFontSizePt: 7.2, roleTrackingEm: 0.14`.

- [ ] **Step 10: Spusť celou sadu a ověř rozdíl proti baseline**

Run: `npm test`
Expected: padají jen 2 testy z baseline (`assetsPaths`, `repoAssets`)

Run: `npx tsc -p tsconfig.json --noEmit`
Expected: 0 chyb

- [ ] **Step 11: Lint a commit**

Run: `npx biome check src/domain/formatters/stageplan.ts src/domain/formatters/formatStageplanBoxHeader.test.ts src/domain/pipeline/pdf/buildPdfStageplanPrintModel.ts src/domain/pipeline/pdf/buildPdfStageplanPrintModel.test.ts src/domain/pipeline/pdf/countStageplanBoxLines.ts src/domain/pipeline/pdf/countStageplanBoxLines.test.ts src/infra/pdf/sections/stageplan.ts src/infra/pdf/sections/stageplan.test.ts src/infra/pdf/styles.ts src/infra/pdf/styles.test.ts packages/desktop/src/app/components/stageplan/StageBlock.tsx packages/desktop/src/app/components/stageplan/blockPrint.test.ts packages/desktop/src/styles/features/stageplan-editor.css`

```bash
git add -A
git commit -m "feat(stageplan): mark the band leader with a line inside the box"
```

---

## Task 4: Kontaktní osoba je třetí řádek hlavičky (R12, R13 zbytek, R14)

**Files:**
- Modify: `src/infra/pdf/template.ts`
- Modify: `src/infra/pdf/template.test.ts`
- Modify: `src/infra/pdf/styles.ts`
- Modify: `src/infra/pdf/styles.test.ts`
- Modify: `src/infra/pdf/layout.ts`
- Modify: `src/infra/pdf/layout.test.ts`
- Modify: `src/infra/pdf/pdf.ts`
- Modify: `src/infra/pdf/sections/stageplan.test.ts`
- Modify: `src/app/usecases/exportPdf.ts`
- Modify: `src/domain/model/bandLeader.ts`
- Modify: `scripts/desktop_preview.ts`

**Interfaces:**
- Consumes: nic z předchozích tasků.
- Produces:
  - `export type PdfContact = { readonly text: string; readonly email: string | null }` v `src/infra/pdf/template.ts`.
  - `RenderTemplateOptions.contact?: PdfContact` a `RenderPdfOptions.contact?: PdfContact` **místo** `contactLine?: string`.
  - `formatContactLine(args: { contact: ContactEntity }): PdfContact`.
  - `loadDefaultContact(defaultContactId: string | undefined, runtimeRoot: string): Promise<PdfContact | undefined>` **místo** `loadDefaultContactLine(id, band, repo, runtimeRoot)`.

- [ ] **Step 1: Napiš padající testy**

V `src/app/usecases/` zatím test pro `formatContactLine` není; přidej ho do nového souboru `src/app/usecases/formatContactLine.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatContactLine } from "./exportPdf.js";

const contact = {
  id: "c-1",
  firstName: "Matěj",
  lastName: "Krečmer",
  phone: "+420731247870",
  email: "matej@example.com",
};

describe("formatContactLine", () => {
  it("builds the header row with a middot separator", () => {
    expect(formatContactLine({ contact })).toEqual({
      text: "Kontaktní osoba · Matěj Krečmer · + 420 731 247 870",
      email: "matej@example.com",
    });
  });

  it("never marks the band leader (R13)", () => {
    // Kontaktní osoba nemusí být hudebník, takže označení není vždy
    // použitelné — a kapelnictví značí jediné místo, řádek v boxu (R9).
    expect(formatContactLine({ contact }).text).not.toContain("band leader");
  });

  it("drops missing parts together with their separator", () => {
    expect(
      formatContactLine({ contact: { id: "c-2", firstName: "Jana", lastName: "Nová" } }),
    ).toEqual({ text: "Kontaktní osoba · Jana Nová", email: null });
  });

  it("refuses a contact without any name", () => {
    expect(() =>
      formatContactLine({ contact: { id: "c-3", firstName: " ", lastName: "" } }),
    ).toThrow(/Invalid contact/);
  });
});
```

V `src/infra/pdf/template.test.ts` nahraď oba testy o patičce (`"hides names only on stageplan; contact line renders in the footer, not the header"` a `"moves the contact line from the header into the footer"`) těmito. V prvním z nich **ponech** okolní `try/finally` s fixture rootem a jen vyměň volání i tvrzení:

```ts
  it("hides names only on stageplan; contact renders in the header, not the footer", async () => {
    const tmpRoot = await createPdfRendererFixtureRoot();

    try {
      const repo = await loadRepository({ userDataRoot: tmpRoot });
      const project = createPdfRendererFixtureProject("stageplan-hide-names");

      const vm = buildDocument(project, repo);
      const html = renderInputlistHtml(vm, {
        tabTitle: "Stageplan",
        baseHref: "file:///tmp/",
        contact: {
          text: "Kontaktní osoba · Test User · + 420 111 222 333",
          email: null,
        },
        stageplan: { hideMusicianNames: true },
      });

      const headerEnd = html.indexOf("</header>");
      expect(html.slice(0, headerEnd)).toContain("Kontaktní osoba");
      expect(html).not.toContain("docFooter__contact");
      expect(html).toContain("BASS");
      expect(html).not.toContain("BASS – MATEJ");
    } finally {
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
  });
```

Druhý test žije v `describe("document footer")`, kam po přesunu kontaktu do
hlavičky nepatří. Vyjmi ho i s následujícím novým testem do vlastního
`describe("document header contact")` nad ním; v patičce zůstane jen
číslování stran. Sousední test `"still numbers the pages when there is no
contact line"` v patičce zůstává, jen mu z názvu vyhoď `contact line` —
patička o kontaktu už nic neví.

```ts
  it("prints the contact in the header of both pages, with the e-mail in its own span", () => {
    const html = renderInputlistHtml(vm, {
      tabTitle: "Doc",
      baseHref: "file:///tmp/",
      contact: {
        text: "Kontaktní osoba · Matěj Krečmer · + 420 731 247 870",
        email: "matej@example.com",
      },
    });

    const { page1, page2 } = splitPages(html);

    for (const page of [page1, page2]) {
      const headerEnd = page.indexOf("</header>");
      expect(page.slice(0, headerEnd)).toContain("Matěj Krečmer");
      // E-mail ve verzálkách je hůř čitelný a v mailu se stejně píše malými,
      // takže má vlastní span s text-transform: none (R12).
      expect(page.slice(0, headerEnd)).toContain(
        '<span class="docHeader__contactEmail"> · matej@example.com</span>',
      );
    }

    // Přesně jedna kopie na každé straně, ne jen dvě celkem.
    expect(page1.match(/Matěj Krečmer/g) ?? []).toHaveLength(1);
    expect(page2.match(/Matěj Krečmer/g) ?? []).toHaveLength(1);
  });

  it("keeps the contact row in the flow even without a contact, so the budget holds", () => {
    // Rozpočet výšky hlavičky s řádkem počítá vždy (R14). Kdyby element mizel,
    // hlavička by byla o 14 pt nižší, než rozpočet tvrdí, a plán na straně 2
    // by o tu výšku přišel.
    const html = renderInputlistHtml(vm, {
      tabTitle: "Doc",
      baseHref: "file:///tmp/",
    });

    expect(html).toContain('<div class="docHeader__contact"></div>');
  });
```

V `src/infra/pdf/layout.test.ts` nahraď test výšky hlavičky:

```ts
  it("measures the header from its own type and spacing, contact row included", () => {
    // 17,1 + 2,7 + 11,34 + 2,7 + 11,34 = 45,18 pt textového sloupce, pak
    // 12,6 + 2 + 16,2 pt chromu → 75,98 pt = 26,80 mm. Proti F6 je hlavička
    // o 4,95 mm vyšší; to je cena R12 a nese ji obě strany.
    expect(pdfChromeHeights.headerMm).toBeCloseTo(26.8, 1);
  });

  it("counts every header column into the budget, stamp included (R14)", () => {
    // Razítko má dva řádky (STAGEPILOT / UPD …). Dnes je titulní sloupec
    // vyšší, takže na to nikdo nešlápl — kdyby se ale titul zkrátil, musí
    // rozpočet nést razítko. Testuje se proto nejvyšší sloupec obecně, ne
    // dnešní vítěz: tvrzení „headerMm ≥ razítko" by při dnešních číslech
    // platilo, i kdyby razítko v `Math.max` vůbec nefigurovalo.
    expect(pdfHeaderColumnsPt.mark).toBeCloseTo(23.4, 2);
    expect(pdfHeaderColumnsPt.title).toBeCloseTo(45.18, 2);
    expect(pdfHeaderColumnsPt.stamp).toBeCloseTo(25.92, 2);

    const tallestColumnPt = Math.max(...Object.values(pdfHeaderColumnsPt));
    const expectedMm =
      ((tallestColumnPt +
        pdfLayout.header.padBottomPt +
        pdfLayout.header.rulePt +
        pdfLayout.header.marginBottomPt) *
        25.4) /
      72;

    expect(pdfChromeHeights.headerMm).toBeCloseTo(expectedMm, 6);
  });
```

Import v hlavičce souboru rozšiř na
`import { parsePt, pdfChromeHeights, pdfHeaderColumnsPt, pdfLayout } from "./layout.js";`

V `src/infra/pdf/sections/stageplan.test.ts` uprav tvrzení o výšce plochy z Tasku 3 na novou hodnotu:

```ts
    // Hlavička vyrostla o 4,95 mm (R12), takže plocha plánu o tolik klesla.
    expect(stageplanLayout.areaHeightMm).toBeCloseTo(197.1382, 3);
```

V `src/infra/pdf/styles.test.ts` přidej:

```ts
describe("pdf header contact (R12)", () => {
  it("sets the contact row in the meta cut and keeps the e-mail out of caps", () => {
    expect(pdfStyles).toMatch(
      new RegExp(
        `\\.docHeader__contact\\s*\\{[^}]*font-size:\\s*${escapeRegExp(pdfLayout.typography.meta.size)}`,
      ),
    );
    expect(pdfStyles).toMatch(
      /\.docHeader__contact\s*\{[^}]*text-transform:\s*uppercase/,
    );
    expect(pdfStyles).toMatch(
      /\.docHeader__contactEmail\s*\{[^}]*text-transform:\s*none/,
    );
    expect(pdfStyles).not.toContain(".docFooter__contact");
  });
});
```

- [ ] **Step 2: Spusť testy a ověř, že padají**

Run: `npx vitest run src/app/usecases/formatContactLine.test.ts src/infra/pdf/template.test.ts src/infra/pdf/layout.test.ts src/infra/pdf/styles.test.ts src/infra/pdf/sections/stageplan.test.ts`
Expected: FAIL — `formatContactLine` vrací řetězec, `contact` není v `RenderTemplateOptions`, `headerMm` je 21,85

- [ ] **Step 3: Uprav rozpočet hlavičky**

V `src/infra/pdf/layout.ts` nahraď `headerTextColumnPt` a `pdfChromeHeights`:

```ts
/**
 * Titulní sloupec: název kapely, meta řádek a kontaktní osoba, prokládané
 * `textGapPt`. Kontaktní řádek se rezervuje **vždy**, i když projekt kontakt
 * nemá — jinak by výška hlavičky (a tím i plocha plánu na straně 2) závisela
 * na datech (R12).
 */
const headerTextColumnPt =
  parsePt(pdfLayout.typography.title.size) *
    pdfLayout.typography.title.lineHeight +
  pdfLayout.header.textGapPt +
  parsePt(pdfLayout.typography.meta.size) *
    pdfLayout.typography.meta.lineHeight +
  pdfLayout.header.textGapPt +
  parsePt(pdfLayout.typography.meta.size) *
    pdfLayout.typography.meta.lineHeight;

/**
 * Tři sloupce hlavičky vedle sebe. Exportované, aby se dal otestovat i ten,
 * který zrovna nevyhrává — razítko má dva řádky (STAGEPILOT / UPD …) a dnes
 * je nižší než titul, takže jeho chybějící započtení by jinak nebylo vidět
 * (R14).
 */
export const pdfHeaderColumnsPt = {
  mark: pdfLayout.header.markSizePt,
  title: headerTextColumnPt,
  stamp:
    2 *
    parsePt(pdfLayout.typography.stamp.size) *
    pdfLayout.typography.stamp.lineHeight,
} as const;

export const pdfChromeHeights = {
  headerMm: ptToMm(
    Math.max(...Object.values(pdfHeaderColumnsPt)) +
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
```

- [ ] **Step 4: Přesuň kontakt do hlavičky**

V `src/infra/pdf/template.ts`:

```ts
/**
 * Kontaktní osoba v hlavičce (R12). E-mail je zvlášť, protože se jako jediná
 * část řádku nesází verzálkami — adresa v kapitálkách je hůř čitelná a v
 * mailu se stejně píše malými.
 */
export type PdfContact = {
  readonly text: string;
  readonly email: string | null;
};

function renderContactRow(contact?: PdfContact): string {
  // Element zůstává v toku i prázdný: rozpočet výšky hlavičky s ním počítá
  // vždy, stejně jako počítá s popiskem rozměru pódia.
  if (!contact) return `<div class="docHeader__contact"></div>`;
  const emailHtml = contact.email
    ? `<span class="docHeader__contactEmail"> · ${esc(contact.email)}</span>`
    : "";
  return `<div class="docHeader__contact">${esc(contact.text)}${emailHtml}</div>`;
}
```

`renderDocumentHeader` dostane `contact?: PdfContact` a vloží řádek do titulního sloupce:

```ts
      <div class="docHeader__title">
        <div class="docHeader__band">${esc(args.bandName)}</div>
        <div class="docHeader__meta">${esc(metaText)}</div>
        ${renderContactRow(args.contact)}
      </div>
```

`renderFooter` ztrácí kontakt úplně:

```ts
function renderFooter(args: {
  pageNumber: number;
  pageCount: number;
}): string {
  return `<footer class="docFooter">
      <div class="docFooter__page">${args.pageNumber} / ${args.pageCount}</div>
    </footer>`;
}
```

`renderPage` předá `contact: args.opts.contact` do `renderDocumentHeader` a do `renderFooter` už jen čísla stran. V `RenderTemplateOptions` nahraď `contactLine?: string` za `contact?: PdfContact`.

V `src/infra/pdf/pdf.ts` nahraď v `RenderPdfOptions` řádek `contactLine?: string;` za:

```ts
    contact?: PdfContact;   // volitelné (doplníš z usecase)
```

s importem `import type { PdfContact } from "./template.js";` a v `renderInputlistHtml(...)` předej `contact: opts.contact`.

V `src/infra/pdf/styles.ts` smaž blok `.docFooter__contact` a za `.docHeader__meta` přidej:

```css
/* Kontaktní osoba u nadpisu dokumentu — tam, kde ji čtenář hledá (R12).
   min-height drží řádek v rozpočtu i tehdy, když projekt kontakt nemá. */
.docHeader__contact {
  font-family: '${pdfLayout.typography.monoFamily}', Consolas, monospace;
  font-size: ${pdfLayout.typography.meta.size};
  line-height: ${pdfLayout.typography.meta.lineHeight};
  letter-spacing: ${pdfLayout.typography.meta.tracking};
  text-transform: uppercase;
  color: ${pdfTokens.body};
  white-space: nowrap;
  min-height: ${parsePt(pdfLayout.typography.meta.size) * pdfLayout.typography.meta.lineHeight}pt;
}

.docHeader__contactEmail {
  text-transform: none;
}
```

a do importu v `styles.ts` doplň `parsePt`: `import { parsePt, pdfLayout, pdfTokens } from "./layout.js";`

- [ ] **Step 5: Uprav usecase a skript**

V `src/app/usecases/exportPdf.ts`:

```ts
export function formatContactLine(args: {
  contact: ContactEntity;
}): PdfContact {
  const { contact } = args;

  const first = (contact.firstName ?? "").trim();
  const last = (contact.lastName ?? "").trim();
  if (!first && !last) {
    throw new Error(
      `Invalid contact (missing firstName/lastName): ${contact.id}`,
    );
  }

  const phone = contact.phone ? formatCzPhone(contact.phone) : "";
  const email = contact.email ? contact.email.trim() : "";

  // "Kontaktní osoba · Jméno Příjmení · + 420 …", e-mail zvlášť (R12).
  // Vsuvka o kapelníkovi mizí bez náhrady: kapelnictví značí jediné místo,
  // řádek v boxu, a kontaktní osoba navíc nemusí být hudebník (R13).
  const parts = ["Kontaktní osoba", `${first} ${last}`.trim()];
  if (phone) parts.push(phone);

  return { text: parts.join(" · "), email: email || null };
}

export async function loadDefaultContact(
  defaultContactId: string | undefined,
  runtimeRoot: string,
): Promise<PdfContact | undefined> {
  if (!defaultContactId) return undefined;

  const contactPath = path.resolve(
    catalogPathsForRoot(runtimeRoot).contacts,
    `${defaultContactId}.json`,
  );
  const contact = await loadJsonFile<ContactEntity>(contactPath);

  return formatContactLine({ contact });
}
```

Smaž funkci `resolveContactMusicianId`, import `isBandLeader` a import typu `Band`, pokud po úpravě nezůstane použitý (zůstává — `exportPdfFromProject` s ním pracuje jen jako s hodnotou z `repo.getBand`, typ `Band` se dá odstranit, pokud ho TS označí za nepoužitý). Přidej `import type { PdfContact } from "../../infra/pdf/template.js";`.

Volání v `exportPdfFromProject`:

```ts
  const contact = await loadDefaultContact(band.defaultContactId, outDir);
  ...
  await renderPdf(vm, { outFile: pdfPath, contact, stageplan });
```

V `src/domain/model/bandLeader.ts` smaž funkci `isBandLeader` — po R13 nemá konzumenta (`resolveBandLeaderId` a `bandLeaderErrorMessage` zůstávají, používá je `validateBandLeader.ts`).

V `scripts/desktop_preview.ts` nahraď blok načtení kontaktu a předání do `renderPdf`:

```ts
  const contact = await loadDefaultContact(band.defaultContactId, userDataDir);
  ...
  await renderPdf(vm, {
    outFile: previewPdfPath,
    contact,
    stageplan: { hideMusicianNames },
  });
```

a uprav import na `loadDefaultContact`.

- [ ] **Step 6: Spusť testy a ověř, že prochází**

Run: `npx vitest run src/app/usecases/formatContactLine.test.ts src/infra/pdf/template.test.ts src/infra/pdf/layout.test.ts src/infra/pdf/styles.test.ts src/infra/pdf/sections/stageplan.test.ts`
Expected: PASS

Run: `npm test`
Expected: padají jen 2 testy z baseline

Run: `npx tsc -p tsconfig.json --noEmit`
Expected: 0 chyb

- [ ] **Step 7: Ověř na reálném projektu, že se strana 1 pořád vejde**

Run: `npm run cli:dev -- --project 019f6578-3138-7dee-b334-6e9613c37a72 --pdf`
Expected: exit 0. Hlavička je o 4,95 mm vyšší na obou stranách, takže tohle je
první místo, kde by se tabulka inputů velkého lineupu přestala vejít; pojistka
by spadla hláškou `PDF overflow: content does not fit A4 page.` Pokud spadne,
**nezmenšuj písmo ani okraje** — je to zjištění, které patří uživateli, ne
tichá oprava.

- [ ] **Step 8: Lint a commit**

Run: `npx biome check src/infra/pdf/template.ts src/infra/pdf/template.test.ts src/infra/pdf/styles.ts src/infra/pdf/styles.test.ts src/infra/pdf/layout.ts src/infra/pdf/layout.test.ts src/infra/pdf/pdf.ts src/app/usecases/exportPdf.ts src/app/usecases/formatContactLine.test.ts src/domain/model/bandLeader.ts scripts/desktop_preview.ts src/infra/pdf/sections/stageplan.test.ts`

```bash
git add -A
git commit -m "feat(pdf): move the contact person into the document header"
```

---

## Task 5: Tisková stopa je dána jen textem (R3, R7 a R8 v modelu)

**Files:**
- Modify: `src/domain/stageplan/print/printFootprint.ts`
- Modify: `src/domain/stageplan/print/printFootprint.test.ts`
- Modify: `src/infra/pdf/sections/stageplan.ts`
- Modify: `src/infra/pdf/sections/stageplan.test.ts`
- Modify: `packages/desktop/src/app/components/stageplan/blockPrint.ts`
- Modify: `packages/desktop/src/app/components/stageplan/blockPrint.test.ts`

**Interfaces:**
- Consumes: `measurePrintTextMm` (Task 2), `STAGEPLAN_BAND_LEADER_LINE` a `hasBandLeaderLine` (Task 3), `countStageplanBoxLines` (Task 3).
- Produces:
  ```ts
  export type PrintTypography = {
    readonly fontSizePt: number;
    readonly lineHeight: number;
    readonly roleFontSizePt: number;
    readonly roleTrackingEm: number;
    readonly titleGapPt: number;
    /** Odsazení boxu na všech čtyřech stranách (R7). */
    readonly padPt: number;
    /** Mezera mezi odrážkou a jejím textem, v px kvůli shodě s CSS. */
    readonly bulletSpacingPx: number;
    /** Umírá v Tasku 7 spolu s `resolvePrintScale`. */
    readonly minBoxWidthMm: number;
  };

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

  export function computePrintFootprintMm(args: {
    readonly box: PrintBoxText;
    readonly typography: PrintTypography;
  }): PrintFootprintMm
  ```
  `padBottomPt` z `PrintTypography` **mizí** (R7 sjednocuje odsazení). `bulletSpacingPx` se do typografie **stěhuje** z `StageplanPlan["typography"]`, protože ho nově potřebuje šířka.

- [ ] **Step 1: Přepiš test stopy**

Nahraď obsah `src/domain/stageplan/print/printFootprint.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { STAGEPLAN_BAND_LEADER_LINE } from "../../formatters/stageplan.js";
import {
  type PrintBoxText,
  type PrintTypography,
  computePrintFootprintMm,
} from "./printFootprint.js";
import { measurePrintTextMm } from "./textWidth.js";

/** Skutečná tisková typografie strany 2 po F7. */
const TYPOGRAPHY: PrintTypography = {
  fontSizePt: 8,
  lineHeight: 1.25,
  roleFontSizePt: 7.2,
  roleTrackingEm: 0.14,
  titleGapPt: 6,
  padPt: 6,
  bulletSpacingPx: 4,
  minBoxWidthMm: 36.2594,
};

const MM_PER_PT = 25.4 / 72;
const MM_PER_PX = 25.4 / 96;
const LINE_MM = 8 * 1.25 * MM_PER_PT; // 3,52778
const PAD_MM = 6 * MM_PER_PT; // 2,11667
const TITLE_GAP_MM = 6 * MM_PER_PT;

function bulletWidthMm(text: string): number {
  return (
    measurePrintTextMm({ text: "•", style: "boxBody", fontSizePt: 8 }) +
    4 * MM_PER_PX +
    measurePrintTextMm({ text, style: "boxBody", fontSizePt: 8 })
  );
}

function box(overrides: Partial<PrintBoxText> = {}): PrintBoxText {
  return {
    header: "BASS – MATĚJ",
    hasBandLeaderLine: false,
    inputBullets: [],
    monitorBullets: [],
    extraBullets: [],
    hasPowerBadge: false,
    powerBadgeText: "",
    ...overrides,
  };
}

describe("computePrintFootprintMm — výška", () => {
  it("is header plus symmetric padding for a box with nothing else", () => {
    const footprint = computePrintFootprintMm({
      box: box(),
      typography: TYPOGRAPHY,
    });

    expect(footprint.heightMm).toBeCloseTo(2 * PAD_MM + LINE_MM, 4);
  });

  it("adds one box line for the band leader row, with no gap above it", () => {
    const plain = computePrintFootprintMm({ box: box(), typography: TYPOGRAPHY });
    const leader = computePrintFootprintMm({
      box: box({ hasBandLeaderLine: true }),
      typography: TYPOGRAPHY,
    });

    expect(leader.heightMm - plain.heightMm).toBeCloseTo(LINE_MM, 6);
  });

  it("adds the gap below the header only when the box has bullets", () => {
    const bare = computePrintFootprintMm({ box: box(), typography: TYPOGRAPHY });
    const withBullets = computePrintFootprintMm({
      box: box({ inputBullets: ["Bass DI (5)"] }),
      typography: TYPOGRAPHY,
    });

    expect(withBullets.heightMm - bare.heightMm).toBeCloseTo(
      TITLE_GAP_MM + LINE_MM,
      6,
    );
  });

  it("counts the separator line between two non-empty bullet groups", () => {
    const oneGroup = computePrintFootprintMm({
      box: box({ inputBullets: ["a", "b"] }),
      typography: TYPOGRAPHY,
    });
    const twoGroups = computePrintFootprintMm({
      box: box({ inputBullets: ["a"], monitorBullets: ["b"] }),
      typography: TYPOGRAPHY,
    });

    expect(twoGroups.heightMm - oneGroup.heightMm).toBeCloseTo(LINE_MM, 6);
  });

  it("gives the power row a full empty line above it (R8)", () => {
    const withoutPower = computePrintFootprintMm({
      box: box({ inputBullets: ["a", "b"] }),
      typography: TYPOGRAPHY,
    });
    const withPower = computePrintFootprintMm({
      box: box({
        inputBullets: ["a", "b"],
        hasPowerBadge: true,
        powerBadgeText: "1x 230V",
      }),
      typography: TYPOGRAPHY,
    });

    // Mezera je stejně vysoká jako mezera mezi skupinami odrážek — napájení je
    // samostatná informace, ne pokračování poslední odrážky.
    expect(withPower.heightMm - withoutPower.heightMm).toBeCloseTo(2 * LINE_MM, 6);
  });

  it("ignores the zone entirely — a huge zone does not make the box taller", () => {
    // Kdyby zóna do stopy pořád vstupovala, tenhle test by neměl co ověřit:
    // funkce už zónu ani nepřijímá. Test drží podpis (R3).
    const footprint = computePrintFootprintMm({
      box: box({ inputBullets: ["a"] }),
      typography: TYPOGRAPHY,
    });

    expect(footprint.heightMm).toBeCloseTo(
      2 * PAD_MM + LINE_MM + TITLE_GAP_MM + LINE_MM,
      4,
    );
  });
});

describe("computePrintFootprintMm — šířka", () => {
  it("is set by the longest bullet, bullet glyph and spacing included", () => {
    const footprint = computePrintFootprintMm({
      box: box({
        header: "BASS",
        inputBullets: ["Electric bass guitar (12)"],
        monitorBullets: ["IEM (3)"],
      }),
      typography: TYPOGRAPHY,
    });

    expect(footprint.widthMm).toBeCloseTo(
      2 * PAD_MM + bulletWidthMm("Electric bass guitar (12)"),
      6,
    );
    // Zdravý rozum: dnešní box je 36,3 mm široký, tenhle má být širší, ale ne
    // absurdně — kdyby tabulka šířek byla nesmysl, tohle to chytí.
    expect(footprint.widthMm).toBeGreaterThan(30);
    expect(footprint.widthMm).toBeLessThan(60);
  });

  it("lets a long header win over short bullets", () => {
    const footprint = computePrintFootprintMm({
      box: box({ header: "LEAD VOC – ELIŠKA", inputBullets: ["A (1)"] }),
      typography: TYPOGRAPHY,
    });

    expect(footprint.widthMm).toBeCloseTo(
      2 * PAD_MM +
        measurePrintTextMm({
          text: "LEAD VOC – ELIŠKA",
          style: "boxHeader",
          fontSizePt: 8,
        }),
      6,
    );
  });

  it("lets the power row win when it is the longest line", () => {
    const footprint = computePrintFootprintMm({
      box: box({
        header: "KEYS",
        hasPowerBadge: true,
        powerBadgeText: "2x 230V + prodlužovačka",
      }),
      typography: TYPOGRAPHY,
    });

    expect(footprint.widthMm).toBeCloseTo(
      2 * PAD_MM +
        measurePrintTextMm({
          text: "2x 230V + prodlužovačka",
          style: "boxPower",
          fontSizePt: 8,
        }),
      6,
    );
  });

  it("measures the band leader row in the mono cut, tracking included", () => {
    const footprint = computePrintFootprintMm({
      box: box({ header: "BASS", hasBandLeaderLine: true }),
      typography: TYPOGRAPHY,
    });

    expect(footprint.widthMm).toBeCloseTo(
      2 * PAD_MM +
        measurePrintTextMm({
          text: STAGEPLAN_BAND_LEADER_LINE,
          style: "boxRole",
          fontSizePt: 7.2,
          trackingEm: 0.14,
        }),
      6,
    );
  });

  it("ignores the power text when the box has no power row", () => {
    const footprint = computePrintFootprintMm({
      box: box({ header: "BASS", powerBadgeText: "tenhle text se netiskne" }),
      typography: TYPOGRAPHY,
    });

    expect(footprint.widthMm).toBeCloseTo(
      2 * PAD_MM +
        measurePrintTextMm({ text: "BASS", style: "boxHeader", fontSizePt: 8 }),
      6,
    );
  });
});
```

- [ ] **Step 2: Spusť test a ověř, že padá**

Run: `npx vitest run src/domain/stageplan/print/printFootprint.test.ts`
Expected: FAIL — `computePrintFootprintMm` čeká `lineCount`/`zone`/`mmPerM`, ne `box`

- [ ] **Step 3: Přepiš stopu**

Nahraď obsah `src/domain/stageplan/print/printFootprint.ts`:

```ts
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
```

- [ ] **Step 4: Spusť test a ověř, že prochází**

Run: `npx vitest run src/domain/stageplan/print/printFootprint.test.ts`
Expected: PASS (11 testů)

- [ ] **Step 5: Přepoj volající**

V `src/infra/pdf/sections/stageplan.ts`:

- `printTypography` dostane `padPt: 6` a `bulletSpacingPx` a ztratí `padBottomPt`:

```ts
const printTypography: PrintTypography = {
  fontSizePt: parsePt(pdfLayout.typography.table.size) - 1,
  lineHeight: 1.25,
  roleFontSizePt: parsePt(pdfLayout.typography.tableHead.size),
  roleTrackingEm: Number.parseFloat(pdfLayout.typography.tableHead.tracking),
  titleGapPt: 6,
  // R7: jedna hodnota na všechny čtyři strany. Dřívější dolní odsazení
  // pocházelo z table.padY, tedy z odsazení řádku tabulky — jiné veličiny,
  // která do tiskového boxu nepatří.
  padPt: 6,
  bulletSpacingPx,
  minBoxWidthMm,
};
```

- `stageplanLayout` získá `boxPad`. `padX` a `padY` zatím **zůstávají** — CSS je pořád sází a odejdou až v Tasku 6. `boxPaddingBottom` se ale musí přestat odvozovat z `printTypography.padBottomPt`, který právě zanikl:

```ts
  padX: pdfLayout.table.padX,
  padY: pdfLayout.table.padY,
  boxPad: `${printTypography.padPt}pt`,
  /** Dočasné: CSS boxu se srovná s modelem až v Tasku 6 (R7). */
  boxPaddingBottom: pdfLayout.table.padY,
```

  (`bulletSpacingPx` v `stageplanLayout` zůstává, CSS ho pořád sází.)

- `StageplanPlan["typography"]` se zjednoduší na `PrintTypography` (bez `& { bulletSpacingPx }`) a v návratu `buildStageplanPlan` se `typography: { ...printTypography, bulletSpacingPx }` zkrátí na `typography: printTypography`.
- V `buildStageplanPlan` spočítej stopy **jednou** a použij je pro obdélníky:

```ts
  const footprintBySlot = new Map(
    vm.layout.blocks.map((block) => [
      block.slot,
      computePrintFootprintMm({
        box: printModel.boxesBySlot[block.slot],
        typography: printTypography,
      }),
    ]),
  );

  const rects: PrintRect[] = vm.layout.blocks.map((block) => {
    const footprint = footprintBySlot.get(block.slot);
    if (!footprint) {
      throw new Error(`Missing print footprint for block ${block.slot}`);
    }

    return {
      slot: block.slot,
      centerXMm: scale.toMm(block.centerXM),
      centerYMm: scale.toMm(block.centerYM),
      widthMm: footprint.widthMm,
      heightMm: footprint.heightMm,
      rotationDeg: block.rotationDeg,
    };
  });
```

  Import `countStageplanBoxLines` z `sections/stageplan.ts` odstraň — stopa si ho volá sama.

V `packages/desktop/src/app/components/stageplan/blockPrint.ts` nahraď volání stopy:

```ts
  const footprint = computePrintFootprintMm({
    box,
    typography: geometry.typography,
  });
```

a smaž import `countStageplanBoxLines`.

- [ ] **Step 6: Doplň testy volajících**

V `src/infra/pdf/sections/stageplan.test.ts` doplň import
`import { computePrintFootprintMm } from "../../../domain/stageplan/print/printFootprint.js";`
a uprav test `"places a block by its zone centre and prints its rotation"` — box už neroste ze zóny, takže očekávaná šířka je textová. Nahraď tvrzení o šířce:

```ts
    // Box je široký podle svého textu, ne podle zóny (R3): prázdný lineup dá
    // hlavičku "DRUMS" a nic víc.
    expect(box?.widthMm).toBeCloseTo(
      computePrintFootprintMm({
        box: { ...emptyDrumsBox },
        typography: stageplanPrintGeometry.typography,
      }).widthMm,
      3,
    );
```

kde `emptyDrumsBox` deklaruj nad `describe`:

```ts
/** Box, který vyjde z prázdného lineupu: hlavička a nic dalšího. */
const emptyDrumsBox = {
  header: "DRUMS",
  hasBandLeaderLine: false,
  inputBullets: [],
  monitorBullets: [],
  extraBullets: ["Drum riser 3x2"],
  hasPowerBadge: false,
  powerBadgeText: "",
};
```

Tvrzení o poloze (`(box.xMm + box.widthMm/2)`) uprav tak, aby počítalo s aktuálním `scale.mmPerM` z `plan` — pozice středu na měřítku pořád závisí, takže spočítej ji z `plan.stage.widthMm / NOMINAL_STAGE.widthM`:

```ts
    const mmPerM = plan.stage.widthMm / NOMINAL_STAGE.widthM;
    expect((box?.xMm ?? 0) + (box?.widthMm ?? 0) / 2).toBeCloseTo(
      6 * mmPerM + plan.stage.xMm,
      2,
    );
    expect(
      (box?.yMm ?? 0) + (box?.heightMm ?? 0) / 2 - plan.stage.yMm,
    ).toBeCloseTo(1.2 * mmPerM, 2);
```

Přidej test, který drží R7 a R8 na úrovni plánu:

```ts
  it("pads the box symmetrically and lifts the power row off the bullets", () => {
    const plan = buildStageplanPlan(
      emptyStageplan({
        stage: null,
        blocks: [
          {
            slot: "drums",
            centerXM: 6,
            centerYM: 4,
            widthM: 2.8,
            depthM: 1.6,
            rotationDeg: 0,
          },
        ],
      }),
    );

    const lineMm = (plan.typography.fontSizePt * plan.typography.lineHeight * 25.4) / 72;
    const padMm = (plan.typography.padPt * 25.4) / 72;
    const titleGapMm = (plan.typography.titleGapPt * 25.4) / 72;

    // Hlavička + mezera + jedna odrážka (Drum riser), odsazení 6 pt nahoře i dole.
    expect(plan.boxes[0]?.heightMm).toBeCloseTo(
      2 * padMm + lineMm + titleGapMm + lineMm,
      4,
    );
  });
```

V `packages/desktop/src/app/components/stageplan/blockPrint.test.ts` uprav `TYPOGRAPHY` na nový tvar (`padPt: 6`, `bulletSpacingPx: 4`, bez `padBottomPt`) a v testu `"maps the footprint's width and depth to the matching mm axis"` nahraď výpočet očekávání:

```ts
    const expectedMm = computePrintFootprintMm({
      box: printBox,
      typography: TYPOGRAPHY,
    });
```

- [ ] **Step 7: Spusť testy a typovou kontrolu**

Run: `npm test`
Expected: padají jen 2 testy z baseline

Run: `npx tsc -p tsconfig.json --noEmit`
Expected: 0 chyb

Run: `npx tsc -p packages/desktop/tsconfig.json --noEmit`
Expected: baseline 10 chyb ve 4 testových souborech, žádná nová

- [ ] **Step 8: Lint a commit**

Run: `npx biome check src/domain/stageplan/print/printFootprint.ts src/domain/stageplan/print/printFootprint.test.ts src/infra/pdf/sections/stageplan.ts src/infra/pdf/sections/stageplan.test.ts packages/desktop/src/app/components/stageplan/blockPrint.ts packages/desktop/src/app/components/stageplan/blockPrint.test.ts`

```bash
git add -A
git commit -m "feat(stageplan): size the printed box from its text instead of its zone"
```

---

## Task 6: CSS tištěného boxu (R2, R7, R8, R11)

Teprve tady se kresba srovná s modelem z Tasku 5.

**Files:**
- Modify: `src/infra/pdf/styles.ts`
- Modify: `src/infra/pdf/styles.test.ts`
- Modify: `src/infra/pdf/sections/stageplan.ts`
- Modify: `src/infra/pdf/sections/stageplan.test.ts`
- Modify: `packages/desktop/src/app/components/stageplan/StageBlock.tsx`
- Modify: `packages/desktop/src/styles/features/stageplan-editor.css`

**Interfaces:**
- Consumes: `stageplanLayout.boxPad`, `stageplanLayout.boxLine` (Tasky 3 a 5).
- Produces: nic nového pro další tasky; Task 8 to ověří v Chromiu.

- [ ] **Step 1: Napiš padající testy**

V `src/infra/pdf/styles.test.ts` přidej do `describe("pdf stageplan identity")`:

```ts
  it("turns off kerning and ligatures, so the width formula is exact (R2)", () => {
    // Bez tohohle slepí Chromium dvojice znaků těsněji, než součet šířek z
    // glyphAdvances tvrdí, a šířka boxu by byla odhad, ne číslo.
    expect(pdfStyles).toMatch(/\.stageplanBox\s*\{[^}]*font-kerning:\s*none/);
    expect(pdfStyles).toMatch(
      /\.stageplanBox\s*\{[^}]*font-variant-ligatures:\s*none/,
    );
  });

  it("pads the box with one value on all four sides (R7)", () => {
    expect(pdfStyles).toMatch(
      new RegExp(
        `\\.stageplanBox\\s*\\{[^}]*padding:\\s*${escapeRegExp(stageplanLayout.boxPad)};`,
      ),
    );
    expect(pdfStyles).not.toMatch(/\.stageplanBox\s*\{[^}]*padding-top:/);
  });

  it("refuses to wrap a bullet, and shows it when the text still overflows (R11)", () => {
    // Po R3 je box na svůj nejdelší řádek stavěný, takže zalomit nemá co.
    // Kdyby přesto přeteklo, má to být vidět — overflow: hidden se nezavádí.
    expect(pdfStyles).toMatch(
      /\.stageplanBoxLine\s*\{[^}]*white-space:\s*nowrap/,
    );
    expect(pdfStyles).not.toMatch(
      /\.stageplanBoxLine\s*\{[^}]*word-break:\s*break-word/,
    );
    expect(pdfStyles).toMatch(
      /\.stageplanBoxLine \.text\s*\{[^}]*display:\s*inline;/,
    );
    expect(pdfStyles).not.toMatch(/\.stageplanBox\s*\{[^}]*overflow:\s*hidden/);
  });
```

V `src/infra/pdf/sections/stageplan.test.ts` přidej do `describe`, který ověřuje HTML boxu:

```ts
  it("puts a full empty line above the power row (R8)", () => {
    const html = renderStageplanSection({
      stageplan: {
        ...emptyStageplan({
          stage: null,
          blocks: [
            {
              slot: "keys",
              centerXM: 6,
              centerYM: 4,
              widthM: 2.7,
              depthM: 1.4,
              rotationDeg: 0,
            },
          ],
        }),
        powerByRole: { keys: { hasPowerBadge: true, powerBadgeText: "1x 230V" } },
      },
    } as unknown as DocumentViewModel);

    expect(html).toContain(
      '<div class="stageplanGap"></div><div class="stageplanPower">1x 230V</div>',
    );
  });
```

- [ ] **Step 2: Spusť testy a ověř, že padají**

Run: `npx vitest run src/infra/pdf/styles.test.ts src/infra/pdf/sections/stageplan.test.ts`
Expected: FAIL — `font-kerning` v CSS není, `padding` je pořád trojhodnotové, mezera nad napájením chybí

- [ ] **Step 3: Uprav CSS a kresbu**

V `src/infra/pdf/styles.ts` nahraď blok `.stageplanBox`:

```css
.stageplanBox {
  position: absolute;
  transform-origin: center;
  border: 1px solid ${pdfTokens.ink};
  background: #fff;
  /* R7: jedna hodnota na všech čtyřech stranách. Dolní odsazení dřív
     pocházelo z table.padY, tedy z odsazení řádku tabulky — jiné veličiny. */
  padding: ${stageplanLayout.boxPad};
  font-size: ${stageplanLayout.textSize};
  line-height: ${stageplanLayout.textLineHeight};
  /* R2: bez kerningu a ligatur je součet šířek z glyphAdvances přesné číslo,
     ne odhad. Tabulka je měřená po jednom znaku, takže je kerningu-prostá už
     z konstrukce — tohle to dorovná i při sazbě. */
  font-kerning: none;
  font-variant-ligatures: none;
  /* Bez overflow: hidden (Finding 3, F5b fix): R11 je vědomá mezera — box,
     který přeteče, to má být vidět při vizuální kontrole PDF, ne potichu
     ztratit poslední řádek, který sound engineerovi řekne, který kanál je čí. */
}
```

a `.stageplanBoxLine`:

```css
.stageplanBoxLine {
  margin: 0;
  text-align: center;
  /* R11: po R3 je box na svůj nejdelší řádek stavěný, takže zalomit nemá co.
     Zalomení pod odrážku dělalo z jedné odrážky dva řádky a přetékalo. */
  white-space: nowrap;
}

.stageplanBoxLine .bullet {
  display: inline-block;
  margin-right: ${stageplanLayout.bulletSpacingPx}px;
}

/* Text se sází vedle odrážky, ne pod ni — proto inline, ne inline-block. */
.stageplanBoxLine .text {
  display: inline;
}
```

V `src/infra/pdf/sections/stageplan.ts` v `renderBox`:

```ts
  // Napájení je řádek v toku, ne badge v rohu — a stojí za plnou mezerou,
  // stejnou jako mezi skupinami odrážek (R8).
  if (box.hasPowerBadge) {
    lines.push(`<div class="stageplanGap"></div>`);
    lines.push(`<div class="stageplanPower">${box.powerBadgeText}</div>`);
  }
```

a ze `stageplanLayout` smaž `padX`, `padY` i `boxPaddingBottom` — po přechodu na
`boxPad` je nikdo nečte a `padY` byla ta veličina, kvůli které bylo odsazení
boxu svázané s odsazením řádku tabulky.

V `packages/desktop/src/styles/features/stageplan-editor.css` doplň do `.stage-block` (za `line-height: 1.35;`):

```css
  /* Karta ukazuje totéž co papír, takže vypíná totéž (R2). */
  font-kerning: none;
  font-variant-ligatures: none;
```

V `packages/desktop/src/app/components/stageplan/StageBlock.tsx` vlož mezeru před napájení:

```tsx
          {box.hasPowerBadge ? (
            <>
              <div className="stage-block__gap" />
              <div className="stage-block__power">{box.powerBadgeText}</div>
            </>
          ) : null}
```

a přepiš blokový komentář nad komponentou — tvrdí model, který právě zanikl:

```tsx
/**
 * Karta je tištěný box, zóna je obrys uvnitř (R3). Po F7 kartu měří **jen
 * text**, takže obrys zóny může ležet i vně karty: karta už nikdy neroste,
 * aby zónu pohltila (R4). Právě to je viditelná zpětná vazba — zvětšení zóny,
 * které tisk nepřevezme, je na první pohled poznat.
 *
 * Geometrie jde do `style` jako CSS proměnné, ne jako hotové deklarace —
 * vzhled zůstává v CSS, v komponentě je jen spočítané umístění.
 */
```

- [ ] **Step 4: Ověř, že obrys zóny není ořezaný (R4)**

Zóna se kreslí jako `.stage-block__zone`, absolutně umístěná uvnitř
`.stage-block`. Po R3 může přesáhnout hranu karty, takže **`.stage-block` nesmí
mít `overflow: hidden`** — jinak by se přesahující obrys tiše ořízl a zpětná
vazba, kvůli které R4 existuje, by nefungovala.

Run: `npx biome check packages/desktop/src/styles/features/stageplan-editor.css`
a projdi pravidlo `.stage-block` očima: `overflow` tam být nemá (dnes není).
`overflow: hidden` na `.stage-block__body` je jiná věc a zůstává — ořezává
výpis odrážek, ne obrys zóny.

- [ ] **Step 5: Spusť testy a ověř, že prochází**

Run: `npx vitest run src/infra/pdf/styles.test.ts src/infra/pdf/sections/stageplan.test.ts`
Expected: PASS

- [ ] **Step 6: Vyrenderuj reálný projekt a prohlédni ho**

Run: `npm run cli:dev -- --project 019f6578-3138-7dee-b334-6e9613c37a72 --pdf`
Expected: exit 0

Boxy jsou teď širší (bass odhadem z 29,6 na ~38,6 mm), takže tohle je první
místo, kde může spadnout kolizní pojistka
(`Stageplan print collision: … Blocks overlap on paper`). Pokud spadne, je to
**pravdivá informace** — bloky je potřeba srovnat v editoru, ne pojistku
obcházet. Zapiš, který pár kolidoval, do závěrečné zprávy.

- [ ] **Step 7: Lint a commit**

Run: `npx biome check src/infra/pdf/styles.ts src/infra/pdf/styles.test.ts src/infra/pdf/sections/stageplan.ts src/infra/pdf/sections/stageplan.test.ts packages/desktop/src/app/components/stageplan/StageBlock.tsx packages/desktop/src/styles/features/stageplan-editor.css`

```bash
git add -A
git commit -m "fix(pdf): pad the stageplan box evenly and keep its lines unbroken"
```

---

## Task 7: Měřítko rezervuje místo per blok v obou osách (R6, R5, R15)

**Files:**
- Modify: `src/domain/stageplan/print/printScale.ts`
- Modify: `src/domain/stageplan/print/printScale.test.ts`
- Modify: `src/domain/stageplan/print/printFootprint.ts`
- Modify: `src/infra/pdf/sections/stageplan.ts`
- Modify: `src/infra/pdf/sections/stageplan.test.ts`
- Modify: `packages/desktop/src/app/components/stageplan/blockPrint.ts`
- Modify: `packages/desktop/src/app/components/stageplan/blockPrint.test.ts`
- Modify: `packages/desktop/src/app/components/stageplan/BlockInspector.tsx`
- Modify: `packages/desktop/src/app/pages/StagePlanEditorPage.tsx`
- Modify: `packages/desktop/src/styles/features/stageplan-editor.css`

**Interfaces:**
- Consumes: `PrintFootprintMm` a `computePrintFootprintMm` (Task 5).
- Produces:
  ```ts
  export type PrintScaleBlock = {
    readonly zoneWidthM: number;
    readonly zoneDepthM: number;
    readonly boxWidthMm: number;
    readonly boxHeightMm: number;
  };

  export function toPrintScaleBlock(args: {
    readonly zone: Pick<StageplanBlock, "widthM" | "depthM">;
    readonly footprint: PrintFootprintMm;
  }): PrintScaleBlock

  export function resolvePrintScale(args: {
    readonly stage: StageplanStageSize | null;
    readonly blocks: readonly PrintScaleBlock[];
    readonly area: PrintArea;
  }): PrintScale
  ```
  `minBoxWidthMm` mizí z `PrintTypography`, z `resolvePrintScale` i z `stageplan.ts`.
  `BlockPrint.isBelowPrintFloor` mizí.

- [ ] **Step 1: Přepiš test měřítka**

Nahraď obsah `src/domain/stageplan/print/printScale.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { NOMINAL_STAGE } from "../layout/defaultLayout.js";
import {
  type PrintScaleBlock,
  resolvePrintScale,
  toPrintScaleBlock,
} from "./printScale.js";

/** Skutečná tisková plocha strany 2 po F7 (hlavička s kontaktem, bez vysvětlivky). */
const AREA = { widthMm: 162.5375, heightMm: 197.1382 };

function scaleBlock(overrides: Partial<PrintScaleBlock> = {}): PrintScaleBlock {
  return {
    zoneWidthM: 2.6,
    zoneDepthM: 1.2,
    boxWidthMm: 38.6,
    boxHeightMm: 25,
    ...overrides,
  };
}

describe("resolvePrintScale", () => {
  it("falls back to the tolerance-only scale for an empty layout", () => {
    const scale = resolvePrintScale({ stage: null, blocks: [], area: AREA });

    // Nominál 12 × 8 m plus 2 × 20 cm tolerance:
    // šířka 162,5375 / 12,4 = 13,1079; výška 197,1382 / 8,4 = 23,4688 → váže šířka.
    expect(scale.mmPerM).toBeCloseTo(13.1079, 3);
    expect(scale.planWidthMm).toBeCloseTo(157.294, 2);
  });

  it("reserves width for the block whose box outgrows its zone", () => {
    const scale = resolvePrintScale({
      stage: null,
      blocks: [scaleBlock()],
      area: AREA,
    });

    // Zóna 2,6 m dá při 13,1079 jen 34,08 mm, box chce 38,6 mm:
    // (162,5375 − 38,6) / (12,4 − 2,6) = 12,6467 mm/m.
    expect(scale.mmPerM).toBeCloseTo(12.6467, 3);
  });

  it("reserves nothing for a block whose zone already carries its box", () => {
    const scale = resolvePrintScale({
      stage: null,
      blocks: [scaleBlock({ zoneWidthM: 6, zoneDepthM: 4 })],
      area: AREA,
    });

    // 6 m dá 78,6 mm, box chce 38,6 — zóna vyhrává, rezerva se neuplatní.
    expect(scale.mmPerM).toBeCloseTo(13.1079, 3);
  });

  it("takes the tightest block, not the first one", () => {
    const scale = resolvePrintScale({
      stage: null,
      blocks: [
        scaleBlock({ zoneWidthM: 2.8, boxWidthMm: 37 }),
        scaleBlock({ zoneWidthM: 2.6, boxWidthMm: 44 }),
      ],
      area: AREA,
    });

    // Druhý blok: (162,5375 − 44) / 9,8 = 12,0957 — a ten je přísnější.
    expect(scale.mmPerM).toBeCloseTo(12.0957, 3);
  });

  it("reserves height too, where the budget used to have a hole (R6)", () => {
    // Dnes se výška počítá jen jako plocha / hloubka s přesahem, takže vysoký
    // box u horní hrany pódia plochu přeroste a rozpočet o tom neví.
    const scale = resolvePrintScale({
      stage: { widthM: 8, depthM: 14 },
      blocks: [scaleBlock({ zoneDepthM: 1.2, boxHeightMm: 40 })],
      area: AREA,
    });

    // Výšková mez bez rezervy: 197,1382 / 14,4 = 13,6902.
    // S rezervou: (197,1382 − 40) / (14,4 − 1,2) = 11,9044 — a ta váže.
    expect(scale.mmPerM).toBeCloseTo(11.9044, 3);
  });

  it("leaves the scale alone when a box is wider than the whole area", () => {
    // Rezervovat nejde; má spadnout pojistka a pojmenovat viníka (R5), ne
    // vyjít záporné nebo nulové měřítko.
    const scale = resolvePrintScale({
      stage: null,
      blocks: [scaleBlock({ boxWidthMm: 200 })],
      area: AREA,
    });

    expect(scale.mmPerM).toBeGreaterThan(0);
    expect(scale.mmPerM).toBeCloseTo(13.1079, 3);
  });

  it("never returns a scale larger than the unreserved one", () => {
    const reserved = resolvePrintScale({
      stage: null,
      blocks: [scaleBlock()],
      area: AREA,
    });
    const unreservedMmPerM = Math.min(
      AREA.widthMm / NOMINAL_STAGE.widthM,
      AREA.heightMm / NOMINAL_STAGE.depthM,
    );

    expect(reserved.mmPerM).toBeLessThan(unreservedMmPerM);
  });

  it("round-trips metres through millimetres", () => {
    const scale = resolvePrintScale({
      stage: { widthM: 11, depthM: 7 },
      blocks: [],
      area: AREA,
    });

    expect(scale.toM(scale.toMm(3.75))).toBeCloseTo(3.75, 6);
  });
});

describe("toPrintScaleBlock", () => {
  it("pairs each axis with its own measurement", () => {
    // Zóna i stopa jsou schválně nečtvercové, jinak by prohození os nešlo
    // poznat — a prohození je jediná chyba, kterou tenhle převod umí udělat.
    const block = toPrintScaleBlock({
      zone: { widthM: 2.7, depthM: 1.4 },
      footprint: { widthMm: 38.6, heightMm: 25.1 },
    });

    expect(block).toEqual({
      zoneWidthM: 2.7,
      zoneDepthM: 1.4,
      boxWidthMm: 38.6,
      boxHeightMm: 25.1,
    });
  });
});
```

- [ ] **Step 2: Spusť test a ověř, že padá**

Run: `npx vitest run src/domain/stageplan/print/printScale.test.ts`
Expected: FAIL — `toPrintScaleBlock` neexistuje, `blocks` má jiný tvar

- [ ] **Step 3: Přepiš měřítko**

Nahraď v `src/domain/stageplan/print/printScale.ts` vše od `resolvePrintScale` dolů (a doplň importy `StageplanBlock`, `PrintFootprintMm`):

```ts
export type PrintScaleBlock = {
  readonly zoneWidthM: number;
  readonly zoneDepthM: number;
  readonly boxWidthMm: number;
  readonly boxHeightMm: number;
};

/**
 * Spáruje zónu se stopou boxu. Jediné místo, kde se osy párují — prohození
 * `widthMm` a `heightMm` je přesně ta chyba, kterou tenhle typ jinak nechává
 * projít bez povšimnutí.
 */
export function toPrintScaleBlock(args: {
  readonly zone: Pick<StageplanBlock, "widthM" | "depthM">;
  readonly footprint: PrintFootprintMm;
}): PrintScaleBlock {
  return {
    zoneWidthM: args.zone.widthM,
    zoneDepthM: args.zone.depthM,
    boxWidthMm: args.footprint.widthMm,
    boxHeightMm: args.footprint.heightMm,
  };
}

/**
 * Největší `s`, při kterém se do plochy vejde pódium s tolerancí i přesah
 * jednoho boxu přes jeho zónu:
 *
 *   inflatedM·s + max(0, boxMm − zonaM·s) ≤ plochaMm
 *
 * Levá strana v `s` roste, takže stačí ověřit přerůstání při horní mezi: když
 * se box do zóny vejde tam, vejde se i při každém menším `s`. Uzavřený tvar,
 * bez iterace a bez binárního hledání.
 */
function reservedMmPerM(args: {
  readonly bound: number;
  readonly inflatedM: number;
  readonly areaMm: number;
  readonly zoneM: number;
  readonly boxMm: number;
}): number {
  const { bound, inflatedM, areaMm, zoneM, boxMm } = args;
  if (boxMm <= zoneM * bound) return bound;

  const denominator = inflatedM - zoneM;
  // Pódium užší než zóna i s tolerancí: rezervovat nejde, pojistka to chytí.
  if (denominator <= 0) return bound;

  const candidate = (areaMm - boxMm) / denominator;
  // Box větší než celá plocha: rezerva by vyšla záporná. Vrátit mez a nechat
  // spadnout pojistku, která umí pojmenovat viníka (R5).
  if (candidate <= 0) return bound;

  return Math.min(bound, candidate);
}

/**
 * Měřítko, do kterého se vejde i to, co smí přesahovat hranu pódia: clamp v
 * editoru nechává blok přesahovat o `OVERHANG_TOLERANCE_M` a tištěný box je
 * navíc velký podle svého textu, ne podle zóny (R3). Rezerva se proto počítá
 * **pro každý blok zvlášť a v obou osách** (R6) — svislá osa ji dřív neměla
 * vůbec, což byla skrytá díra: vysoký box u horní hrany pódia plochu přerostl
 * a rozpočet o tom nevěděl.
 *
 * Rotace do rezervy nevstupuje (stejně jako dřív); otočený box má větší opsaný
 * obdélník a chytá ho až kontrola union bboxu v rendereru.
 */
export function resolvePrintScale(args: {
  readonly stage: StageplanStageSize | null;
  readonly blocks: readonly PrintScaleBlock[];
  readonly area: PrintArea;
}): PrintScale {
  const { stage, blocks, area } = args;
  const plan = stage ?? NOMINAL_STAGE;
  const inflatedWidthM = plan.widthM + 2 * OVERHANG_TOLERANCE_M;
  const inflatedDepthM = plan.depthM + 2 * OVERHANG_TOLERANCE_M;

  const widthBound = area.widthMm / inflatedWidthM;
  const heightBound = area.heightMm / inflatedDepthM;

  let mmPerM = Math.min(widthBound, heightBound);
  for (const block of blocks) {
    mmPerM = Math.min(
      mmPerM,
      reservedMmPerM({
        bound: widthBound,
        inflatedM: inflatedWidthM,
        areaMm: area.widthMm,
        zoneM: block.zoneWidthM,
        boxMm: block.boxWidthMm,
      }),
      reservedMmPerM({
        bound: heightBound,
        inflatedM: inflatedDepthM,
        areaMm: area.heightMm,
        zoneM: block.zoneDepthM,
        boxMm: block.boxHeightMm,
      }),
    );
  }

  return buildPrintScale(plan, mmPerM);
}
```

V `src/domain/stageplan/print/printFootprint.ts` smaž z `PrintTypography` pole `minBoxWidthMm` i jeho komentář.

- [ ] **Step 4: Spusť test a ověř, že prochází**

Run: `npx vitest run src/domain/stageplan/print/printScale.test.ts`
Expected: PASS (9 testů)

- [ ] **Step 5: Přepoj renderer**

V `src/infra/pdf/sections/stageplan.ts`:

- Smaž konstantu `minBoxWidthMm` i její blokový komentář a odeber ji z `printTypography`.
- Stopu spočítej **před** měřítkem a měřítko z ní postav:

```ts
  const footprintBySlot = new Map(
    vm.layout.blocks.map((block) => [
      block.slot,
      computePrintFootprintMm({
        box: printModel.boxesBySlot[block.slot],
        typography: printTypography,
      }),
    ]),
  );

  // Stopa boxu na měřítku nezávisí (text se sází v bodech), takže se počítá
  // první a měřítko ji bere jako vstup (R3, R6).
  const scale = resolvePrintScale({
    stage: vm.layout.stage,
    blocks: vm.layout.blocks.map((block) => {
      const footprint = footprintBySlot.get(block.slot);
      if (!footprint) {
        throw new Error(`Missing print footprint for block ${block.slot}`);
      }
      return toPrintScaleBlock({ zone: block, footprint });
    }),
    area: stageplanPrintGeometry.area,
  });
```

- [ ] **Step 6: Přepoj editor**

V `packages/desktop/src/app/components/stageplan/blockPrint.ts` smaž pole `isBelowPrintFloor` z typu i z návratu a doplň export pomocníka, aby si stránka uměla postavit vstup měřítka. Dnešní řádek `import type { PrintScale } from ".../printScale";` **nahraď** (ne zdvoj) jedním importem:

```ts
import {
  type PrintScale,
  type PrintScaleBlock,
  toPrintScaleBlock,
} from "../../../../../../src/domain/stageplan/print/printScale";
```

```ts
export type BlockPrint = {
  readonly box: StageplanPrintBox;
  /** Rozměr tištěného boxu v metrech — karta se kreslí v něm (R3). */
  readonly footprint: { readonly widthM: number; readonly depthM: number };
};

/**
 * Vstup měřítka pro celý layout. Blok, ke kterému geometrie box nemá (lineup
 * se změnil, než dorazily metriky), rezervu nevyvolá — nulová stopa se do
 * každé zóny vejde.
 */
export function resolvePrintScaleBlocks(args: {
  readonly blocks: readonly StageplanBlock[];
  readonly geometry: StageplanPrintGeometry;
}): PrintScaleBlock[] {
  return args.blocks.map((block) => {
    const box = args.geometry.blocks.find((entry) => entry.slot === block.slot);
    const footprint = box
      ? computePrintFootprintMm({ box, typography: args.geometry.typography })
      : { widthMm: 0, heightMm: 0 };
    return toPrintScaleBlock({ zone: block, footprint });
  });
}
```

V `packages/desktop/src/app/pages/StagePlanEditorPage.tsx` nahraď sestavení měřítka:

```ts
  const printScale = printGeometry
    ? resolvePrintScale({
        stage: area,
        blocks: resolvePrintScaleBlocks({
          blocks: state.layout.blocks,
          geometry: printGeometry,
        }),
        area: printGeometry.area,
      })
    : null;
```

s importem `resolvePrintScaleBlocks` z `../components/stageplan/blockPrint`.

V `packages/desktop/src/app/components/stageplan/BlockInspector.tsx` zbav řádek `PRINTED` příznaku (R15):

```tsx
          {printedZone ? (
            <div className="stage-inspector__row">
              <span className="stage-inspector__label">PRINTED</span>
              <span className="stage-inspector__value">
                {formatZone(
                  printedZone.footprint.widthM,
                  printedZone.footprint.depthM,
                )}
              </span>
            </div>
          ) : null}
```

V `packages/desktop/src/styles/features/stageplan-editor.css` smaž pravidlo `.stage-inspector__value--flagged` — po R15 nemá kdo ho nasadit.

> **Mimo rozsah:** `NARROWEST ZONE` v `EditorToolbar` a funkce `narrowestZoneSlot`
> zůstávají beze změny. Údaj je pořád pravdivý (nejužší zóna v layoutu) a spec
> ho nemění; přepis na „blok, který měřítko váže" patří do vlastní fáze.

- [ ] **Step 7: Dorovnej testy**

V `packages/desktop/src/app/components/stageplan/blockPrint.test.ts`:
- z `TYPOGRAPHY` smaž `minBoxWidthMm`,
- smaž test `"flags a zone narrower than the print floor, and clears it once wide enough"`,
- volání `resolvePrintScale` na začátku souboru nahraď:

```ts
const scale = resolvePrintScale({
  stage: null,
  blocks: [
    toPrintScaleBlock({
      zone: block(),
      footprint: computePrintFootprintMm({ box: box(), typography: TYPOGRAPHY }),
    }),
  ],
  area: AREA,
});
```

- přidej test, který drží nové volání měřítka pohromadě:

```ts
  it("builds one scale input per block, missing boxes reserving nothing", () => {
    const blocks = [block({ slot: "guitar" }), block({ slot: "bass" })];
    const inputs = resolvePrintScaleBlocks({
      blocks,
      geometry: geometry([box({ slot: "guitar" })]),
    });

    expect(inputs).toHaveLength(2);
    expect(inputs[0]?.boxWidthMm).toBeGreaterThan(0);
    expect(inputs[1]).toEqual({
      zoneWidthM: 2.7,
      zoneDepthM: 1.4,
      boxWidthMm: 0,
      boxHeightMm: 0,
    });
  });
```

V `src/infra/pdf/sections/stageplan.test.ts`:
- z testu `"keeps the print area derived from the page mirror"` smaž tvrzení o `minBoxWidthMm`,
- smaž test `"keeps the min-box-width reservation active for the default zones"` (po R6 žádná podlaha není),
- test `"keeps the print scale width-bound, so the reservation cannot shrink the plan"` přepiš na nové volání:

```ts
  it("keeps the print scale width-bound for the default arrangement", () => {
    const stageplan = emptyStageplan(
      buildDefaultLayout({ slots: STAGEPLAN_BLOCK_SLOTS, stage: null }),
    );
    const plan = buildStageplanPlan(stageplan);
    const mmPerM = plan.stage.widthMm / NOMINAL_STAGE.widthM;
    const heightBound =
      stageplanPrintGeometry.area.heightMm /
      (NOMINAL_STAGE.depthM + 2 * OVERHANG_TOLERANCE_M);

    expect(mmPerM).toBeLessThan(heightBound);
  });
```

- [ ] **Step 8: Spusť vše**

Run: `npm test`
Expected: padají jen 2 testy z baseline

Run: `npx tsc -p tsconfig.json --noEmit` a `npx tsc -p packages/desktop/tsconfig.json --noEmit`
Expected: 0 chyb v kořeni, baseline 10 v desktopu

Run: `npm run cli:dev -- --project 019f6578-3138-7dee-b334-6e9613c37a72 --pdf`
Expected: exit 0; měřítko FNB má podle odhadu klesnout z 12,89 na ~12,54 mm/m

- [ ] **Step 9: Lint a commit**

Run: `npx biome check src/domain/stageplan/print/printScale.ts src/domain/stageplan/print/printScale.test.ts src/domain/stageplan/print/printFootprint.ts src/infra/pdf/sections/stageplan.ts src/infra/pdf/sections/stageplan.test.ts packages/desktop/src/app/components/stageplan/blockPrint.ts packages/desktop/src/app/components/stageplan/blockPrint.test.ts packages/desktop/src/app/components/stageplan/BlockInspector.tsx packages/desktop/src/app/pages/StagePlanEditorPage.tsx packages/desktop/src/styles/features/stageplan-editor.css`

```bash
git add -A
git commit -m "feat(stageplan): reserve print scale per block in both axes"
```

---

## Task 8: Dvě tiskové smoke kontroly (R16)

**Files:**
- Create: `scripts/smoke_stageplan_print.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `measurePrintTextMm` (Task 2), `PRINT_TEXT_STYLES` (Task 1), `STAGEPLAN_BAND_LEADER_LINE` (Task 3), `stageplanPrintGeometry` a `renderInputlistHtml` (infra), `launchPdfBrowser`.
- Produces: `npm run smoke:stageplan-print` — exit 0 když obě kontroly projdou, exit 1 s výpisem viníků když ne.

- [ ] **Step 1: Napiš skript**

Vytvoř `scripts/smoke_stageplan_print.ts`:

```ts
import { readdir } from "node:fs/promises";
import path from "node:path";
import { argv } from "node:process";
import { pathToFileURL } from "node:url";
import type { Page } from "puppeteer";
import { normalizeProject } from "../src/app/usecases/normalizeProject.js";
import { STAGEPLAN_BAND_LEADER_LINE } from "../src/domain/formatters/stageplan.js";
import type { ProjectJson } from "../src/domain/model/types.js";
import { buildDocument } from "../src/domain/pipeline/buildDocument.js";
import { buildPdfStageplanPrintModel } from "../src/domain/pipeline/pdf/buildPdfStageplanPrintModel.js";
import type { PrintTextStyle } from "../src/domain/stageplan/print/glyphAdvances.js";
import { measurePrintTextMm } from "../src/domain/stageplan/print/textWidth.js";
import { USER_DATA_ROOT } from "../src/infra/fs/dataRoot.js";
import { loadJsonFile } from "../src/infra/fs/loadJson.js";
import { loadRepository } from "../src/infra/fs/repo.js";
import { launchPdfBrowser } from "../src/infra/pdf/pdf.js";
import { stageplanPrintGeometry } from "../src/infra/pdf/sections/stageplan.js";
import { pdfStyles } from "../src/infra/pdf/styles.js";
import { renderInputlistHtml } from "../src/infra/pdf/template.js";
import { PRINT_TEXT_STYLE_SPECS } from "./printTextStyles.js";

/** R16: tabulka se smí od Chromia lišit nejvýš o pětinu setiny pixelu. */
const WIDTH_TOLERANCE_PX = 0.05;
/** Subpixelová rezerva pro měření řádku uvnitř boxu. */
const LINE_TOLERANCE_PX = 0.5;
const MM_TO_PX = 96 / 25.4;

/** Týž seznam, jaký měřil generátor — jinak by kontrola ověřovala jiný řez,
 *  než jaký tabulka drží, a mlčky prošla. */
const STYLE_PROBES = PRINT_TEXT_STYLE_SPECS;

type LoadedProject = {
  readonly file: string;
  /** null když plán vůbec nešel sestavit — kolize nebo přetečení. */
  readonly html: string | null;
  readonly buildError: string | null;
  readonly corpus: string[];
};

function pdfBaseHref(): string {
  return pathToFileURL(
    path.join(process.cwd(), "src", "infra", "pdf") + path.sep,
  ).href;
}

async function loadProjects(userDataDir: string): Promise<LoadedProject[]> {
  const projectsDir = path.join(userDataDir, "projects");
  const files = (await readdir(projectsDir)).filter((name) =>
    name.endsWith(".json"),
  );
  const repo = await loadRepository({ userDataRoot: userDataDir });

  const loaded: LoadedProject[] = [];
  for (const file of files) {
    const raw = await loadJsonFile<ProjectJson>(path.join(projectsDir, file));
    const vm = buildDocument(normalizeProject(raw), repo);
    const printModel = buildPdfStageplanPrintModel(vm.stageplan);

    const corpus = new Set<string>([STAGEPLAN_BAND_LEADER_LINE]);
    for (const box of Object.values(printModel.boxesBySlot)) {
      corpus.add(box.header);
      for (const bullet of [
        ...box.inputBullets,
        ...box.monitorBullets,
        ...box.extraBullets,
      ]) {
        corpus.add(bullet);
      }
      if (box.hasPowerBadge) corpus.add(box.powerBadgeText);
    }

    // Plán se sestavuje tady, ne až v prohlížeči: kolizní pojistka a kontrola
    // union bboxu hlásí chybu výjimkou, a ta má skončit jako pojmenované
    // selhání smoke kontroly, ne jako pád skriptu bez kontextu.
    let html: string | null = null;
    let buildError: string | null = null;
    try {
      html = renderInputlistHtml(vm, {
        tabTitle: file,
        baseHref: pdfBaseHref(),
      });
    } catch (error) {
      buildError = error instanceof Error ? error.message : String(error);
    }

    loaded.push({
      file,
      html,
      buildError,
      corpus: [...corpus].filter((text) => text.length > 0),
    });
  }
  return loaded;
}

function measurementPageHtml(): string {
  return `<!doctype html>
<html lang="cs"><head><meta charset="utf-8" /><base href="${pdfBaseHref()}">
<style>
${pdfStyles}
</style>
<style>
  .probe {
    position: absolute; top: 0; left: 0; white-space: pre;
    font-kerning: none; font-variant-ligatures: none;
  }
</style>
</head><body></body></html>`;
}

type WidthMismatch = {
  text: string;
  style: string;
  tablePx: number;
  chromiumPx: number;
};

/**
 * Kontrola 1 (R16): šířka z tabulky se rovná šířce naměřené v Chromiu. Tohle
 * je jediná pojistka proti tomu, aby se generovaná data rozešla s fontem —
 * ať už kvůli ručnímu zásahu, jiné verzi fontu, nebo změně shapingu v novém
 * Chromiu.
 */
async function checkTableAgainstChromium(
  page: Page,
  corpus: string[],
): Promise<WidthMismatch[]> {
  const fontSizePt = stageplanPrintGeometry.typography.fontSizePt;
  const roleFontSizePt = stageplanPrintGeometry.typography.roleFontSizePt;
  const roleTrackingEm = stageplanPrintGeometry.typography.roleTrackingEm;

  const cases = [
    ...corpus.flatMap((text) =>
      STYLE_PROBES.map((probe) => ({
        text,
        style: probe.name,
        fontFamily: probe.fontFamily,
        fontWeight: probe.fontWeight,
        fontSizePt,
        trackingEm: 0,
      })),
    ),
    {
      text: STAGEPLAN_BAND_LEADER_LINE,
      style: "boxRole" as PrintTextStyle,
      fontFamily: "IBM Plex Mono",
      fontWeight: 400,
      fontSizePt: roleFontSizePt,
      trackingEm: roleTrackingEm,
    },
  ];

  await page.setContent(measurementPageHtml(), { waitUntil: "load" });
  const measured = await page.evaluate(async (probes) => {
    const el = document.createElement("span");
    el.className = "probe";
    document.body.appendChild(el);

    const widths: number[] = [];
    for (const probe of probes) {
      const fontPx = (probe.fontSizePt * 96) / 72;
      await document.fonts.load(
        `${probe.fontWeight} ${fontPx}px '${probe.fontFamily}'`,
      );
      el.style.fontFamily = `'${probe.fontFamily}'`;
      el.style.fontWeight = String(probe.fontWeight);
      el.style.fontSize = `${fontPx}px`;
      el.style.letterSpacing = `${probe.trackingEm}em`;
      el.textContent = probe.text;
      widths.push(el.getBoundingClientRect().width);
    }
    el.remove();
    return widths;
  }, cases);

  const mismatches: WidthMismatch[] = [];
  cases.forEach((probe, index) => {
    const tablePx =
      measurePrintTextMm({
        text: probe.text,
        style: probe.style,
        fontSizePt: probe.fontSizePt,
        trackingEm: probe.trackingEm,
      }) * MM_TO_PX;
    const chromiumPx = measured[index];
    if (Math.abs(tablePx - chromiumPx) > WIDTH_TOLERANCE_PX) {
      mismatches.push({ text: probe.text, style: probe.style, tablePx, chromiumPx });
    }
  });
  return mismatches;
}

/**
 * Kontrola 2 (R16): žádný box v reálném projektu nepřetéká. Přesně tahle
 * sonda odhalila, že přetékaly tři boxy z pěti — box nemá overflow: hidden,
 * takže scrollHeight nad clientHeight je přímé měření přetečení. Šířka se
 * měří přes Range, protože text je vystředěný a přetéká na obě strany,
 * kam scrollWidth nevidí.
 */
async function checkBoxesFit(page: Page, html: string): Promise<string[]> {
  await page.setContent(html, { waitUntil: "load" });
  return page.evaluate((tolerancePx: number) => {
    const problems: string[] = [];
    for (const box of Array.from(document.querySelectorAll(".stageplanBox"))) {
      const name =
        box.querySelector(".stageplanBoxHeader")?.textContent ?? "<unnamed>";

      const overflowPx = box.scrollHeight - box.clientHeight;
      if (overflowPx > 0) {
        problems.push(`${name}: height overflows by ${overflowPx.toFixed(2)}px`);
      }

      const style = getComputedStyle(box);
      const contentWidthPx =
        box.clientWidth -
        Number.parseFloat(style.paddingLeft) -
        Number.parseFloat(style.paddingRight);

      for (const line of Array.from(
        box.querySelectorAll(
          ".stageplanBoxHeader, .stageplanBoxRole, .stageplanBoxLine, .stageplanPower",
        ),
      )) {
        const range = document.createRange();
        range.selectNodeContents(line);
        const widthPx = range.getBoundingClientRect().width;
        if (widthPx > contentWidthPx + tolerancePx) {
          problems.push(
            `${name}: "${line.textContent}" is ${widthPx.toFixed(2)}px wide, box offers ${contentWidthPx.toFixed(2)}px`,
          );
        }
      }
    }
    return problems;
  }, LINE_TOLERANCE_PX);
}

async function run(): Promise<number> {
  const dirIndex = argv.indexOf("--user-data-dir");
  const userDataDir = dirIndex === -1 ? USER_DATA_ROOT : argv[dirIndex + 1];

  const projects = await loadProjects(userDataDir);
  if (projects.length === 0) {
    console.error(`[smoke] no projects under ${userDataDir}`);
    return 1;
  }

  const browser = await launchPdfBrowser();
  let failures = 0;
  try {
    const page = await browser.newPage();

    const corpus = [...new Set(projects.flatMap((project) => project.corpus))];
    const mismatches = await checkTableAgainstChromium(page, corpus);
    if (mismatches.length > 0) {
      failures += mismatches.length;
      console.error(
        `[smoke] glyph table disagrees with Chromium on ${mismatches.length} of ${corpus.length * STYLE_PROBES.length + 1} cases:`,
      );
      for (const mismatch of mismatches.slice(0, 20)) {
        console.error(
          `  ${mismatch.style} "${mismatch.text}": table ${mismatch.tablePx.toFixed(4)}px vs chromium ${mismatch.chromiumPx.toFixed(4)}px`,
        );
      }
    } else {
      console.error(
        `[smoke] glyph table matches Chromium for ${corpus.length} strings in 4 cuts`,
      );
    }

    for (const project of projects) {
      if (project.html === null) {
        failures += 1;
        console.error(`[smoke] ${project.file}: plan refused to build — ${project.buildError}`);
        continue;
      }

      const problems = await checkBoxesFit(page, project.html);
      if (problems.length > 0) {
        failures += problems.length;
        console.error(`[smoke] ${project.file}: ${problems.length} overflowing box(es)`);
        for (const problem of problems) console.error(`  ${problem}`);
      } else {
        console.error(`[smoke] ${project.file}: every stageplan box fits`);
      }
    }
  } finally {
    await browser.close();
  }

  return failures === 0 ? 0 : 1;
}

run()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error("[smoke] stageplan print smoke failed", error);
    process.exitCode = 1;
  });
```

- [ ] **Step 2: Přidej npm skript**

V `package.json` do `scripts`:

```json
"smoke:stageplan-print": "node --enable-source-maps --import tsx scripts/smoke_stageplan_print.ts"
```

- [ ] **Step 3: Spusť kontrolu na reálných projektech**

Run: `npm run smoke:stageplan-print`
Expected: exit 0; výpis `glyph table matches Chromium for … strings in 4 cuts` a pro každý projekt `every stageplan box fits`

Když kontrola 1 selže o vlásek, **nezvyšuj toleranci.** Reálné příčiny jsou
tři a všechny se dají ověřit: kerning nebo ligatury pořád zapnuté (R2), špatná
váha písma v `STYLE_PROBES` proti CSS, nebo tabulka vygenerovaná jinou verzí
Chromia než tou, která teď měří. Náprava je `npm run glyphs:generate` a nový
commit tabulky, ne posunutá mez.

Když selže kontrola 2, viník je pojmenovaný v hlášce — je to buď chyba ve
vzorci šířky (řádek je širší, než box nabízí), nebo ve vzorci výšky.

- [ ] **Step 4: Lint a commit**

Run: `npx biome check scripts/smoke_stageplan_print.ts package.json`

```bash
git add scripts/smoke_stageplan_print.ts package.json
git commit -m "test(stageplan): add chromium smoke checks for text width and box fit"
```

---

## Závěrečná verifikace

Automaticky:

- [ ] `npm test` — padají jen 2 testy z baseline (`assetsPaths`, `repoAssets`)
- [ ] `npx tsc -p tsconfig.json --noEmit` — 0 chyb
- [ ] `npx tsc -p packages/desktop/tsconfig.json --noEmit` — baseline 10 chyb ve 4 testových souborech, žádná nová
- [ ] `npx biome check` na všech souborech z tabulky File Structure — krom CRLF baseline čisto
- [ ] `npm run smoke:stageplan-print` — exit 0
- [ ] `npm run cli:dev -- --project 019f6578-3138-7dee-b334-6e9613c37a72 --pdf` — exit 0
- [ ] `npm run cli:dev -- --project 019e69c0-4c37-7e56-83eb-8b869fc84add --pdf` — exit 0

Ručně (vyžaduje `npm run dev` nebo prohlédnutí PDF):

- [ ] Kontaktní osoba je v hlavičce obou stran a e-mail není ve verzálkách.
- [ ] Tabulka inputů se po zvýšení hlavičky vejde na stranu 1.
- [ ] Žádná odrážka nestojí na řádku sama.
- [ ] Odstup nad nadpisem a pod napájením je na oko stejný.
- [ ] Mezera před napájením je stejná jako mezi skupinami odrážek.
- [ ] Kapelník má pod jménem `BANDLEADER` a pod plánem není žádná vysvětlivka.
- [ ] V editoru odpovídá karta tomu, co je v PDF, a obrys zóny je vidět i když leží vně karty.
- [ ] Inspektor u vybraného bloku ukazuje `ZONE` i `PRINTED` bez zvýraznění.

Po dokončení: v `docs/design/rebranding-roadmap.md` označit F7 jako
naimplementovanou a zapsat směr F5c z oddílu „Navazuje" ve specu.
