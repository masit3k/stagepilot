# Typografie a hlavička PDF (F4) — implementační plán

> **Pro agentní workery:** POVINNÝ SUB-SKILL: použij `superpowers:subagent-driven-development` (doporučeno) nebo `superpowers:executing-plans` a odpracuj plán úkol po úkolu. Kroky mají checkbox (`- [ ]`) syntaxi pro sledování postupu.

**Cíl:** Export PDF dostane hlavičku a patičku na obou stranách, písma z nové identity, tabulku bez rámečků — a pojistku proti přetečení A4, která na rozdíl od té dnešní opravdu funguje.

**Architektura:** Doména přestane vracet hlavičku jako hotovou českou větu a začne vracet její části (`DocumentHeaderModel`); druh strany a číslo strany skládá renderer, protože jsou to vlastnosti dokumentu, ne projektu. Rozměry tiskového zrcadla se v `layout.ts` odvodí z okrajů stránky, takže CSS i výškový rozpočet stage planu čtou jednu hodnotu. Pojistka proti přetečení dostane dvě vrstvy: měření v DOM nad stránkou s pevnými rozměry a kontrolu počtu stran nad už zapsaným PDF.

**Tech stack:** TypeScript (ESM, přípony `.js` v importech), Vitest v Node prostředí, Biome, Puppeteer, React 18 v `packages/desktop`.

**Spec:** [2026-08-12-pdf-typography-and-header-design.md](../specs/2026-08-12-pdf-typography-and-header-design.md) — rozhodnutí `R1`–`R11`.

## Globální omezení

- **Commit message je jediný řádek** ve tvaru `type(scope): description`. Hook víceřádkovou zprávu odmítne. Žádné tělo, žádná patička.
- **Biome, ne ESLint ani Prettier.** Kontrola: `npx biome check <cesta>`.
- **Import cesty v `src/` končí `.js`**, i když soubor je `.ts`. Je to ESM.
- **Vrstvy se nepřekračují:** `src/domain/` je bez I/O a bez vedlejších efektů, `src/infra/` dělá veškeré I/O, `packages/desktop/` volá Tauri příkazy.
- **Baseline před začátkem:** `npm test` má **2 trvale padající testy** v `src/infra/fs/` a `npx biome check` hlásí velké množství CRLF chyb. Měř **rozdíl proti baseline**, ne absolutní čísla. Před prvním úkolem si baseline zaznamenej: `npm test 2>&1 | tail -5`.
- **Chromium není v tomhle prostředí nainstalované.** `src/infra/pdf/pdf.test.ts` se přeskočí. Nepovažuj přeskočený test za zelený a netvrď, že se dokument vejde na dvě strany — to ověří uživatel spuštěním `npm run pdf:dev`.
- **Barevné hodnoty se nepíšou natvrdo do CSS.** Berou se z `pdfTokens` v `src/infra/pdf/layout.ts` (vzniká v úkolu 4).
- **Škála typografie je `1 px mocku = 0,9 pt`** (spec R1). Žádná velikost se neodvozuje jinak.

---

## Mapa souborů

| Soubor | Odpovědnost | Úkol |
|---|---|---|
| `packages/desktop/src/components/setup/MonitoringEditor.tsx` | přepínač dodavatele odposlechu | 1 |
| `src/infra/pdf/sections/stageplan.ts` | geometrie a výškový rozpočet strany 2 | 2, 7 |
| `src/infra/pdf/fonts/SpaceGrotesk/`, `fonts/IBMPlexMono/` | písma dokumentu | 3 |
| `src/infra/pdf/layout.ts` | rozměry, škála, barvy — jediný zdroj čísel | 4 |
| `src/infra/pdf/tokens.test.ts` | hlídá shodu barev s `primitives.css` | 4 |
| `src/domain/model/types.ts` | `DocumentHeaderModel` | 5 |
| `src/domain/formatters/meta.ts` | složení částí hlavičky z projektu | 5 |
| `src/infra/pdf/template.ts` | skládání stran, hlavička, patička, tabulka | 5, 6, 7, 8 |
| `src/infra/pdf/styles.ts` | CSS dokumentu | 3, 6, 7, 8, 9 |
| `src/infra/pdf/pdf.ts` | render, pojistka proti přetečení | 9 |

Pořadí úkolů drží dvě pravidla: **repo je zelené po každém commitu** a **nadpis strany 2 se ruší dřív, než se sáhne na `typography.title.size`**, na kterou je dnes navázaný.

---

### Úkol 1: Anglické popisky přepínače odposlechu

Nezávislé na zbytku plánu, jde první, protože nic neblokuje a odblokuje se tím rozpracovaná drobnost. Spec: dodatek.

**Soubory:**
- Upravit: `packages/desktop/src/components/setup/MonitoringEditor.tsx:52`, `:123-148`
- Test: `packages/desktop/src/components/setup/MonitoringEditor.test.tsx:76-90`

**Rozhraní:**
- Konzumuje: nic z předchozích úkolů
- Produkuje: nic pro další úkoly

- [ ] **Krok 1: Přepiš očekávání v testu**

V `MonitoringEditor.test.tsx` nahraď tělo testu `renders the supplier switch with the effective supplier selected` (řádky 86–89):

```tsx
    expect(html).toContain('aria-labelledby="setup-monitor-supplier"');
    expect(html).toContain("Monitor supplier");
    expect(html).toContain(">Band<");
    expect(html).toContain(">FOH<");
    expect(html).toContain('aria-pressed="true"');
```

- [ ] **Krok 2: Spusť test a ověř, že padá**

Spusť: `npx vitest run packages/desktop/src/components/setup/MonitoringEditor.test.tsx`
Očekávej: FAIL — `aria-labelledby` v HTML není, místo něj je `aria-label="Dodavatel odposlechu"`.

- [ ] **Krok 3: Doplň id popisku**

V `MonitoringEditor.tsx` hned pod řádek 52 (`const additionalWedgeControlId = "setup-additional-wedge";`):

```tsx
  const supplierLabelId = "setup-monitor-supplier";
```

- [ ] **Krok 4: Obal přepínač popiskem a přepiš texty**

Nahraď celý blok na řádcích 123–148:

```tsx
      <div className="setup-field-block">
        <span className="setup-field-block__label" id={supplierLabelId}>
          Monitor supplier
        </span>
        <div
          className="setup-field-row setup-supplier-switch"
          role="group"
          aria-labelledby={supplierLabelId}
        >
          {(["band", "foh"] as MonitorSupplier[]).map((supplier) => (
            <button
              key={supplier}
              type="button"
              className={`setup-supplier-switch__option ${
                selection?.supplier === supplier
                  ? "setup-supplier-switch__option--active"
                  : ""
              }`}
              aria-pressed={selection?.supplier === supplier}
              disabled={!selection}
              onClick={() =>
                commitMonitorRef(
                  resolveMonitorRef(axes, selection?.typeKey ?? "", supplier),
                )
              }
            >
              {supplier === "band" ? "Band" : "FOH"}
            </button>
          ))}
        </div>
      </div>
```

Třída `.setup-field-block__label` už v `packages/desktop/src/styles/features/setup.css:178` existuje a používají ji `DropdownField` i `AdditionalPickerField` — nové CSS nepřibývá. Vykreslí se verzálkami, mono 11 px.

- [ ] **Krok 5: Spusť test a ověř, že prochází**

Spusť: `npx vitest run packages/desktop/src/components/setup/MonitoringEditor.test.tsx`
Očekávej: PASS, všechny testy v souboru.

- [ ] **Krok 6: Ověř, že v repu nezbyly české řetězce**

Spusť: `npx biome check packages/desktop/src/components/setup/MonitoringEditor.tsx packages/desktop/src/components/setup/MonitoringEditor.test.tsx`
Spusť: `grep -rn "Vlastní\|Pořadatel\|Dodavatel odposlechu" packages/desktop/src`
Očekávej: biome bez nových chyb, grep bez výsledku.

- [ ] **Krok 7: Commit**

```bash
git add packages/desktop/src/components/setup/MonitoringEditor.tsx packages/desktop/src/components/setup/MonitoringEditor.test.tsx
git commit -m "fix(setup): label the monitor supplier switch in English"
```

---

### Úkol 2: Zrušení nadpisu Stageplan na straně 2

Musí předcházet změně typografie, protože `headingSizePt` je dnes odvozený z `typography.title.size` — kdyby se pořadí otočilo, nadpis by se potichu zmenšil. Zároveň se výškový rozpočet strany 2 vytáhne z testu do produkčního kódu, aby ho úkol 7 měnil na jednom místě. Spec: R10.

**Soubory:**
- Upravit: `src/infra/pdf/sections/stageplan.ts:50`, `:63-64`, `:227-232`, `:375-410`, `:487`
- Upravit: `src/infra/pdf/styles.ts:257-268`
- Test: `src/infra/pdf/sections/stageplan.test.ts:34-36`, `:304-315`
- Test: `src/infra/pdf/template.test.ts:36`

**Rozhraní:**
- Konzumuje: nic
- Produkuje: `StageplanPlan.budget: { totalHeightMm: number; availableHeightMm: number }` — úkol 7 do něj zapojí výšku hlavičky a patičky. `StageplanPlan.heading` **přestává existovat**.

- [ ] **Krok 1: Přepiš testy na nový tvar**

V `src/infra/pdf/sections/stageplan.test.ts` smaž assertci na řádcích 34–36:

```ts
      expect(parsePt(plan.heading.fontSize)).toBeLessThan(
        parsePt(pdfLayout.typography.title.size)
      );
```

a nahraď blok na řádcích 304–315 (od `const pageHeightMm = 297;` po `expect(totalHeightMm).toBeLessThanOrEqual(availableHeightMm);`) tímhle:

```ts
    // Rozpočet počítá produkční kód, test ho jen kontroluje — jinak by se
    // vzorec musel držet na dvou místech.
    expect(plan.budget.totalHeightMm).toBeLessThanOrEqual(
      plan.budget.availableHeightMm,
    );
    expect(plan.budget.availableHeightMm).toBe(262);
```

Číslo 262 tu stojí natvrdo záměrně: `pdfLayout.page.contentHeightMm` vzniká až v úkolu 4 a úkol 7 tuhle assertci stejně přepíše na odvozenou hodnotu.

V `src/infra/pdf/template.test.ts` nahraď řádek 36:

```ts
      expect(page2Html).toContain("Stageplan");
```

za:

```ts
      expect(page2Html).not.toContain("stageplanHeading");
```

- [ ] **Krok 2: Spusť testy a ověř, že padají**

Spusť: `npx vitest run src/infra/pdf/sections/stageplan.test.ts src/infra/pdf/template.test.ts`
Očekávej: FAIL — `plan.budget` neexistuje a `page2Html` pořád obsahuje `stageplanHeading`.

- [ ] **Krok 3: Odstraň nadpis z modelu plánu**

V `src/infra/pdf/sections/stageplan.ts`:

Smaž řádek 50:

```ts
const headingSizePt = parsePt(pdfLayout.typography.title.size) - 6;
```

V objektu `stageplanLayout` smaž řádky 63–64 a `sectionMarginTop`:

```ts
  headingSize: `${headingSizePt}pt`,
  headingWeight: 700,
```

```ts
  sectionMarginTop: "16pt",
```

Odsazení sekce se ruší celé — mezeru pod hlavičkou nese `marginBottomPt` hlavičky (úkol 6), takže druhá mezera by se sčítala.

V typu `StageplanPlan` (řádek 228) smaž `heading` a přidej `budget`:

```ts
  budget: { totalHeightMm: number; availableHeightMm: number };
```

- [ ] **Krok 4: Přepiš výškový rozpočet**

V `buildStageplanPlan` nahraď blok od `const pageHeightMm = 297;` (řádek 381) po `return {` tímhle:

```ts
  const availableHeightMm =
    297 - parseMm(pdfLayout.page.margins.top) - parseMm(pdfLayout.page.margins.bottom);
  const containerMarginTopMm =
    parsePt(stageplanLayout.containerMarginTop) / MM_TO_PT;
  const containerPadMm = (parsePt(stageplanLayout.containerPad) / MM_TO_PT) * 2;
  const totalHeightMm = containerMarginTopMm + containerPadMm + areaHeightMm;

  if (totalHeightMm > availableHeightMm) {
    throw new Error(
      `Stageplan layout overflow: required ${totalHeightMm.toFixed(2)}mm exceeds available ${availableHeightMm.toFixed(2)}mm.`,
    );
  }
```

a v návratovém objektu nahraď blok `heading: { ... }` za:

```ts
    budget: { totalHeightMm, availableHeightMm },
```

- [ ] **Krok 5: Odstraň nadpis z HTML a CSS**

V `src/infra/pdf/sections/stageplan.ts:487` smaž `<div class="stageplanHeading">…</div>`, takže sekce začíná rovnou kontejnerem:

```ts
<section class="stageplanSection">\n  <div class="stageplanContainer">\n    <div class="stageplanArea" style="height:${areaHeight}mm;">\n      ${boxesHtml}\n    </div>\n  </div>\n</section>`.trim();
```

V `src/infra/pdf/styles.ts` smaž celé pravidlo `.stageplanHeading` (řádky 262–268) a z `.stageplanSection` odstraň `margin-top`:

```css
.stageplanSection {
  text-align: center;
}
```

- [ ] **Krok 6: Spusť testy a ověř, že procházejí**

Spusť: `npx vitest run src/infra/pdf/`
Očekávej: PASS ve všech souborech kromě přeskočeného `pdf.test.ts`.

- [ ] **Krok 7: Ověř, že po nadpisu nezbyla stopa**

Spusť: `grep -rn "stageplanHeading\|headingSize\|headingWeight\|sectionMarginTop" src/`
Očekávej: bez výsledku.

- [ ] **Krok 8: Commit**

```bash
git add src/infra/pdf/sections/stageplan.ts src/infra/pdf/sections/stageplan.test.ts src/infra/pdf/styles.ts src/infra/pdf/template.test.ts
git commit -m "refactor(pdf): drop the stageplan heading and own the height budget"
```

---

### Úkol 3: Písma identity místo Interu

Spec: R9.

**Soubory:**
- Vytvořit: `src/infra/pdf/fonts/SpaceGrotesk/SpaceGrotesk-Variable.ttf`, `SpaceGrotesk-OFL.txt`
- Vytvořit: `src/infra/pdf/fonts/IBMPlexMono/IBMPlexMono-Regular.ttf`, `IBMPlexMono-Medium.ttf`, `IBMPlexMono-OFL.txt`
- Smazat: `src/infra/pdf/fonts/Inter/` (tři soubory)
- Upravit: `src/infra/pdf/layout.ts:13`, `src/infra/pdf/styles.ts:8-27`, `:47-52`, `:242-247`
- Test: `src/infra/pdf/styles.test.ts:5-9`

**Rozhraní:**
- Konzumuje: nic
- Produkuje: `pdfLayout.typography.fontFamily = "Space Grotesk"`, `pdfLayout.typography.monoFamily = "IBM Plex Mono"` — konzumují je úkoly 6, 7 a 8.

- [ ] **Krok 1: Přepiš test typografie poznámek**

V `src/infra/pdf/styles.test.ts` nahraď první test:

```ts
  it("matches table text size and drops italic from note paragraphs", () => {
    expect(pdfStyles).toContain(
      `.notes {\n  font-size: ${pdfLayout.typography.table.size};`,
    );
    expect(pdfStyles).not.toContain("font-style: italic");
  });

  it("loads only the two brand families", () => {
    expect(pdfStyles).toContain("font-family: 'Space Grotesk'");
    expect(pdfStyles).toContain("font-family: 'IBM Plex Mono'");
    expect(pdfStyles).not.toContain("Inter");
  });
```

- [ ] **Krok 2: Spusť test a ověř, že padá**

Spusť: `npx vitest run src/infra/pdf/styles.test.ts`
Očekávej: FAIL — `font-style: italic` v CSS pořád je a `Inter` taky.

- [ ] **Krok 3: Zkopíruj soubory písem**

```bash
mkdir -p src/infra/pdf/fonts/SpaceGrotesk src/infra/pdf/fonts/IBMPlexMono
cp packages/desktop/public/fonts/SpaceGrotesk-Variable.ttf packages/desktop/public/fonts/SpaceGrotesk-OFL.txt src/infra/pdf/fonts/SpaceGrotesk/
cp packages/desktop/public/fonts/IBMPlexMono-Regular.ttf packages/desktop/public/fonts/IBMPlexMono-Medium.ttf packages/desktop/public/fonts/IBMPlexMono-OFL.txt src/infra/pdf/fonts/IBMPlexMono/
rm -r src/infra/pdf/fonts/Inter
```

Licenční texty se kopírují spolu s písmy — obojí je SIL OFL 1.1 a licence musí zůstat u souborů, ke kterým patří.

- [ ] **Krok 4: Přepiš `@font-face` bloky**

V `src/infra/pdf/styles.ts` nahraď celý blok `Local fonts (deterministic)` (řádky 5–27):

```css
/* ===============================
   Local fonts (deterministic)

   Obě rodiny jsou SIL OFL 1.1 a leží v repu vedle licenčních textů. Nic se
   nestahuje ze sítě — render musí být stejný na každém stroji.
   Space Grotesk je jeden variabilní soubor pro váhy 300-700, proto jeden
   @font-face místo tří statických řezů.
   =============================== */
@font-face {
  font-family: 'Space Grotesk';
  font-style: normal;
  font-weight: 300 700;
  src: url('./fonts/SpaceGrotesk/SpaceGrotesk-Variable.ttf') format('truetype-variations');
}

@font-face {
  font-family: 'IBM Plex Mono';
  font-style: normal;
  font-weight: 400;
  src: url('./fonts/IBMPlexMono/IBMPlexMono-Regular.ttf') format('truetype');
}

@font-face {
  font-family: 'IBM Plex Mono';
  font-style: normal;
  font-weight: 500;
  src: url('./fonts/IBMPlexMono/IBMPlexMono-Medium.ttf') format('truetype');
}
```

- [ ] **Krok 5: Přepni tělo dokumentu a poznámky**

V `src/infra/pdf/styles.ts` uprav pravidlo `body` (řádek 48):

```css
  font-family: ${pdfLayout.typography.fontFamily}, 'Segoe UI', Helvetica, Arial, sans-serif;
```

a z pravidla `.notes` (řádky 242–247) smaž řádek:

```css
  font-style: italic;        /* použije Inter-Italic.ttf */
```

- [ ] **Krok 6: Přepiš rodiny v layoutu**

V `src/infra/pdf/layout.ts` nahraď řádek 13:

```ts
    fontFamily: "Space Grotesk",
    monoFamily: "IBM Plex Mono",
```

- [ ] **Krok 7: Spusť testy a ověř, že procházejí**

Spusť: `npx vitest run src/infra/pdf/`
Očekávej: PASS.

- [ ] **Krok 8: Ověř, že po Interu nezbyla stopa**

Spusť: `grep -rn "Inter-\|'Inter'\|fonts/Inter" src/infra/pdf/; ls src/infra/pdf/fonts/`
Očekávej: grep bez výsledku, ve `fonts/` jen `SpaceGrotesk` a `IBMPlexMono`. Vzor je záměrně užší než pouhé `Inter`, aby nechytal slova jako `interface`.

- [ ] **Krok 9: Commit**

```bash
git add src/infra/pdf/fonts src/infra/pdf/layout.ts src/infra/pdf/styles.ts src/infra/pdf/styles.test.ts
git commit -m "feat(pdf): swap Inter for the brand typefaces"
```

---

### Úkol 4: Barvy, škála a tiskové zrcadlo v `layout.ts`

Jediné místo, odkud další úkoly berou čísla. Staré klíče (`typography.contact`, `typography.table.headerWeight`) se **nemažou** — mizí až s posledním konzumentem v úkolech 7 a 8, aby každý commit zůstal zelený. Spec: R1, R7, R11.

**Soubory:**
- Upravit: `src/infra/pdf/layout.ts` (celý soubor)
- Vytvořit: `src/infra/pdf/tokens.test.ts`
- Upravit: `src/infra/pdf/sections/stageplan.ts:32-38` (lokální `parsePt` se nahradí importem)

**Rozhraní:**
- Konzumuje: `pdfLayout.typography.fontFamily`, `monoFamily` z úkolu 3
- Produkuje:
  - `pdfTokens: { ink, body, steel, line, lineFaint, signal }` — hex řetězce
  - `pdfLayout.page.contentWidthMm = 180`, `contentHeightMm = 262`
  - `pdfLayout.typography.{ title, meta, stamp, tableHead, table, footer }`
  - `pdfLayout.header.{ markSizePt, logoMaxWidthMm, gapPt, textGapPt, padBottomPt, rulePt, marginBottomPt }`
  - `pdfLayout.footer.{ padTopPt, rulePt }`
  - `pdfChromeHeights: { headerMm: number; footerMm: number }`
  - `parsePt(value: string): number`

- [ ] **Krok 1: Napiš test odvozených rozměrů**

Vytvoř `src/infra/pdf/layout.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { pdfChromeHeights, pdfLayout, parsePt } from "./layout.js";

describe("pdf page box", () => {
  it("derives the print area from the page margins", () => {
    // 210 - 15 - 15 a 297 - 20 - 15. Kdyby se okraje změnily, musí se
    // změnit i zrcadlo — jinak DOM kontrola měří jinou stránku, než se tiskne.
    expect(pdfLayout.page.contentWidthMm).toBe(180);
    expect(pdfLayout.page.contentHeightMm).toBe(262);
  });

  it("keeps the derived box in sync with the declared margins", () => {
    const left = Number.parseFloat(pdfLayout.page.margins.left);
    const right = Number.parseFloat(pdfLayout.page.margins.right);
    const top = Number.parseFloat(pdfLayout.page.margins.top);
    const bottom = Number.parseFloat(pdfLayout.page.margins.bottom);

    expect(pdfLayout.page.contentWidthMm).toBe(210 - left - right);
    expect(pdfLayout.page.contentHeightMm).toBe(297 - top - bottom);
  });
});

describe("pdf chrome heights", () => {
  it("measures the header from its own type and spacing", () => {
    expect(pdfChromeHeights.headerMm).toBeCloseTo(21.85, 1);
  });

  it("measures the footer from its own type and spacing", () => {
    expect(pdfChromeHeights.footerMm).toBeCloseTo(8.18, 1);
  });
});

describe("parsePt", () => {
  it("reads a pt value", () => {
    expect(parsePt("17.1pt")).toBe(17.1);
  });

  it("throws on anything else, instead of guessing", () => {
    expect(() => parsePt("17.1mm")).toThrow();
  });
});
```

- [ ] **Krok 2: Napiš test shody barev s `primitives.css`**

Vytvoř `src/infra/pdf/tokens.test.ts`:

```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { pdfTokens } from "./layout.js";

/**
 * Zdroj pravdy o barvách je packages/desktop/src/styles/primitives.css. Infra
 * vrstva ho nemůže importovat, takže hodnoty v layout.ts jsou kopie — a tenhle
 * test hlídá, že se kopie nerozešly s originálem.
 */
const primitivesPath = path.join(
  process.cwd(),
  "packages",
  "desktop",
  "src",
  "styles",
  "primitives.css",
);

function readPrimitive(name: string): string {
  const css = readFileSync(primitivesPath, "utf8");
  // Dvojtečka hned za názvem: --sp-line: nesmí chytit --sp-line-faint:.
  const match = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8})\\s*;`).exec(css);
  if (!match) {
    throw new Error(`Primitive --${name} not found in primitives.css`);
  }
  return match[1].toLowerCase();
}

const PAIRS = [
  ["ink", "sp-ink"],
  ["body", "sp-body"],
  ["steel", "sp-steel"],
  ["line", "sp-line"],
  ["lineFaint", "sp-line-faint"],
  ["signal", "sp-signal"],
] as const;

describe("pdf colour tokens", () => {
  for (const [token, primitive] of PAIRS) {
    it(`${token} matches --${primitive}`, () => {
      expect(pdfTokens[token]).toBe(readPrimitive(primitive));
    });
  }
});
```

- [ ] **Krok 3: Spusť oba testy a ověř, že padají**

Spusť: `npx vitest run src/infra/pdf/layout.test.ts src/infra/pdf/tokens.test.ts`
Očekávej: FAIL — `pdfTokens`, `pdfChromeHeights`, `parsePt` ani `contentWidthMm` zatím neexistují.

- [ ] **Krok 4: Přepiš `layout.ts`**

Nahraď celý obsah `src/infra/pdf/layout.ts`:

```ts
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
    contentHeightMm: A4_HEIGHT_MM - PAGE_MARGINS_MM.top - PAGE_MARGINS_MM.bottom,
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
    contact: { size: "11pt", weight: 700 as const, lineHeight: 1.3 },
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
  parsePt(pdfLayout.typography.title.size) * pdfLayout.typography.title.lineHeight +
  pdfLayout.header.textGapPt +
  parsePt(pdfLayout.typography.meta.size) * pdfLayout.typography.meta.lineHeight;

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
```

- [ ] **Krok 5: Zruš duplicitní `parsePt` ve stage planu**

V `src/infra/pdf/sections/stageplan.ts` smaž lokální funkci `parsePt` (řádky 32–38) a přidej ji do importu z layoutu:

```ts
import { pdfLayout, parsePt } from "../layout.js";
```

- [ ] **Krok 6: Spusť testy a ověř, že procházejí**

Spusť: `npx vitest run src/infra/pdf/`
Očekávej: PASS. Pokud padne assertce na `headerMm`, zkontroluj `title.lineHeight` (musí být `1`) a `meta.lineHeight` (musí být `1.4`).

- [ ] **Krok 7: Commit**

```bash
git add src/infra/pdf/layout.ts src/infra/pdf/layout.test.ts src/infra/pdf/tokens.test.ts src/infra/pdf/sections/stageplan.ts
git commit -m "feat(pdf): derive the print box, type scale and colour tokens"
```

---

### Úkol 5: `DocumentHeaderModel` v doméně

Šablona se v tomhle úkolu upraví jen minimálně — jen tak, aby zůstala zelená. Skutečnou hlavičku staví úkol 6. Spec: R2, R3, R4.

**Soubory:**
- Upravit: `src/domain/model/types.ts:363-387`, `:408-409`
- Upravit: `src/domain/formatters/meta.ts:36-73`
- Upravit: `src/domain/pipeline/buildDocument.ts:8`, `:15`, `:51-62`, `:650`
- Upravit: `src/infra/pdf/template.ts:1-2`, `:17-43`, `:89`
- Test: `src/domain/formatters/meta.test.ts` (celý soubor od řádku 24)
- Test: `src/infra/pdf/template.test.ts:81`

**Rozhraní:**
- Konzumuje: nic
- Produkuje:
  - `DocumentHeaderModel { readonly contextParts: readonly string[]; readonly updatedDate: string }`
  - `formatDocumentHeader(args): DocumentHeaderModel`
  - `vm.meta.header: DocumentHeaderModel` (dřív `vm.meta.metaLine`)

- [ ] **Krok 1: Přepiš testy formátovače**

V `src/domain/formatters/meta.test.ts` smaž pomocnou funkci `metaLineValue` (řádky 5–11), uprav import na řádku 2–3:

```ts
import { formatDocumentDate, formatDocumentHeader } from "./meta.js";
```

a nahraď celý blok `describe("formatProjectMetaLine", …)` (řádky 24–142):

```ts
describe("formatDocumentHeader", () => {
  it("splits an event into date and venue", () => {
    expect(
      formatDocumentHeader({
        purpose: "event",
        eventDate: "2026-03-10",
        eventVenue: "Klub",
        documentDate: "2026-01-01",
        updatedAt: "2026-03-12T09:45:00.000Z",
      }),
    ).toEqual({
      contextParts: ["10. 3. 2026", "Klub"],
      updatedDate: "12. 3. 2026",
    });
  });

  it("drops an empty venue instead of leaving a dangling separator", () => {
    expect(
      formatDocumentHeader({
        purpose: "event",
        eventDate: "2026-03-10",
        eventVenue: "   ",
        documentDate: "2026-01-01",
        updatedAt: "2026-03-12T09:45:00.000Z",
      }).contextParts,
    ).toEqual(["10. 3. 2026"]);
  });

  it("drops an unparseable event date", () => {
    expect(
      formatDocumentHeader({
        purpose: "event",
        eventDate: "RRRR-01-01",
        eventVenue: "Klub",
        documentDate: "2026-01-01",
        updatedAt: "2026-03-12T09:45:00.000Z",
      }).contextParts,
    ).toEqual(["Klub"]);
  });

  it("joins note and validity year into one part for a general project", () => {
    expect(
      formatDocumentHeader({
        purpose: "general",
        note: "Léto s Blaníkem",
        documentDate: "2026-01-01",
        updatedAt: "2026-03-16T09:45:00.000Z",
      }),
    ).toEqual({
      contextParts: ["Léto s Blaníkem 2026"],
      updatedDate: "16. 3. 2026",
    });
  });

  it("keeps the note alone when there is no validity year", () => {
    expect(
      formatDocumentHeader({
        purpose: "general",
        note: "Léto s Blaníkem",
        documentDate: "",
        updatedAt: "2026-03-16T09:45:00.000Z",
      }).contextParts,
    ).toEqual(["Léto s Blaníkem"]);
  });

  it("keeps the year alone when there is no note", () => {
    expect(
      formatDocumentHeader({
        purpose: "general",
        documentDate: "2026-01-01",
        updatedAt: "2026-03-16T09:45:00.000Z",
      }).contextParts,
    ).toEqual(["2026"]);
  });

  it("returns no context parts when a general project has neither", () => {
    expect(
      formatDocumentHeader({
        purpose: "general",
        documentDate: "",
        updatedAt: "2026-03-16T09:45:00.000Z",
      }).contextParts,
    ).toEqual([]);
  });

  it("prefers contentUpdatedAt over updatedAt", () => {
    expect(
      formatDocumentHeader({
        purpose: "event",
        eventDate: "2026-08-22",
        eventVenue: "Zámek Bon Repos",
        documentDate: "2026-01-01",
        updatedAt: "2026-07-30T09:45:00.000Z",
        contentUpdatedAt: "2026-07-15T09:45:00.000Z",
      }).updatedDate,
    ).toBe("15. 7. 2026");
  });

  it("falls back to updatedAt when contentUpdatedAt is missing", () => {
    expect(
      formatDocumentHeader({
        purpose: "event",
        eventDate: "2026-08-22",
        eventVenue: "Zámek Bon Repos",
        documentDate: "2026-01-01",
        updatedAt: "2026-07-30T09:45:00.000Z",
      }).updatedDate,
    ).toBe("30. 7. 2026");
  });

  it("falls back to documentDate when both stamps are invalid", () => {
    expect(
      formatDocumentHeader({
        purpose: "event",
        eventDate: "2026-08-22",
        eventVenue: "Zámek Bon Repos",
        documentDate: "2026-01-01",
        updatedAt: "RRRR-01-01",
        contentUpdatedAt: "RRRR-02-02",
      }).updatedDate,
    ).toBe("1. 1. 2026");
  });
});
```

- [ ] **Krok 2: Spusť test a ověř, že padá**

Spusť: `npx vitest run src/domain/formatters/meta.test.ts`
Očekávej: FAIL — `formatDocumentHeader` není exportovaná.

- [ ] **Krok 3: Vyměň typ v doméně**

V `src/domain/model/types.ts` nahraď komentář a typ na řádcích 363–387:

```ts
/**
 * Hlavička dokumentu rozložená na části.
 *
 * Druh strany (INPUT LIST / STAGE PLAN) doplňuje renderer — liší se stránku od
 * stránky a doména nemá vědět, kolik má dokument stran. Verzálky dělá CSS, aby
 * v datech zůstaly názvy tak, jak je uživatel zadal.
 */
export interface DocumentHeaderModel {
  /** event: ["22. 8. 2026", "Zámek Bon Repos"] · general: ["Univerzální stage plan 2026"] */
  readonly contextParts: readonly string[];
  /** "12. 8. 2026" */
  readonly updatedDate: string;
}
```

a na řádcích 408–409:

```ts
    /** Části hlavičky, které renderer poskládá do mono řádku */
    header: DocumentHeaderModel;
```

- [ ] **Krok 4: Přepiš formátovač**

V `src/domain/formatters/meta.ts` uprav import na řádku 1 a nahraď `formatProjectMetaLine` (řádky 36–73):

```ts
import type { DocumentHeaderModel } from "../model/types.js";
```

```ts
export function formatDocumentHeader(args: {
  purpose: "event" | "general";
  eventDate?: string;
  eventVenue?: string;
  documentDate: string;
  updatedAt?: string;
  contentUpdatedAt?: string;
  note?: string;
}): DocumentHeaderModel {
  const updatedDate = formatDocumentDate(
    resolveUpdatedDateIso({
      contentUpdatedAt: args.contentUpdatedAt,
      updatedAt: args.updatedAt,
      documentDate: args.documentDate,
    }),
  );

  if (args.purpose === "event") {
    // Prázdné části vypadnou, jinak by v řádku zůstal osamocený oddělovač.
    const contextParts = [
      formatDocumentDate(args.eventDate ?? ""),
      (args.eventVenue ?? "").trim(),
    ].filter((part) => part.length > 0);

    return { contextParts, updatedDate };
  }

  const note = args.note?.trim() ?? "";
  const validityYear = extractYearFromIso(args.documentDate);
  const subtitle = [note, validityYear].filter(Boolean).join(" ");

  return { contextParts: subtitle ? [subtitle] : [], updatedDate };
}
```

- [ ] **Krok 5: Přepoj pipeline**

V `src/domain/pipeline/buildDocument.ts` uprav import na řádku 8 (`formatProjectMetaLine` → `formatDocumentHeader`), na řádku 15 (`MetaLineModel` → `DocumentHeaderModel`), nahraď funkci na řádcích 51–62:

```ts
function buildDocumentHeader(project: Project): DocumentHeaderModel {
  const purpose = project.purpose === "event" ? "event" : "general";
  return formatDocumentHeader({
    purpose,
    eventDate: project.eventDate,
    eventVenue: project.eventVenue,
    documentDate: project.documentDate,
    note: project.note,
    updatedAt: project.updatedAt,
    contentUpdatedAt: project.contentUpdatedAt,
  });
}
```

a na řádku 650:

```ts
      header: buildDocumentHeader(project),
```

- [ ] **Krok 6: Udrž šablonu zelenou**

V `src/infra/pdf/template.ts` uprav importy na řádcích 1–2 a nahraď `renderMetaLine` (řádky 17–43) dočasnou podobou — skutečnou hlavičku staví úkol 6:

```ts
import type { DocumentHeaderModel, DocumentViewModel } from "../../domain/model/types.js";
```

```ts
function renderMetaLine(header: DocumentHeaderModel, esc: (s: string) => string): string {
  const parts = [...header.contextParts, `UPD ${header.updatedDate}`];
  return `<div class="metaLine">${esc(parts.join(" · "))}</div>`;
}
```

a na řádku 89:

```ts
  const metaHtml = renderMetaLine(vm.meta.header, esc);
```

- [ ] **Krok 7: Sjednoť fixture v testu šablony**

V `src/infra/pdf/template.test.ts` nahraď řádek 81:

```ts
          header: { contextParts: ["Meta"], updatedDate: "1. 1. 2026" },
```

- [ ] **Krok 8: Spusť testy a ověř, že procházejí**

Spusť: `npx vitest run src/domain/ src/infra/pdf/`
Očekávej: PASS.

- [ ] **Krok 9: Ověř, že po starém modelu nezbyla stopa**

Spusť: `grep -rn "metaLine\|MetaLineModel\|formatProjectMetaLine" src/ packages/ scripts/ --include=*.ts --include=*.tsx`
Očekávej: jediné zbylé výskyty jsou CSS třída `.metaLine` v `styles.ts` a její použití v `template.ts` — ty mizí v úkolu 6.

- [ ] **Krok 10: Commit**

```bash
git add src/domain/model/types.ts src/domain/formatters/meta.ts src/domain/formatters/meta.test.ts src/domain/pipeline/buildDocument.ts src/infra/pdf/template.ts src/infra/pdf/template.test.ts
git commit -m "refactor(domain): replace the meta line with a structured document header"
```

---

### Úkol 6: Hlavička na obou stranách

Spec: R3, R5, R7.

**Soubory:**
- Upravit: `src/infra/pdf/template.ts:17-43`, `:84-166`
- Upravit: `src/infra/pdf/styles.ts:85-143`
- Test: `src/infra/pdf/template.test.ts` (nový popis)

**Rozhraní:**
- Konzumuje: `vm.meta.header` (úkol 5), `pdfTokens`, `pdfLayout.header`, `pdfLayout.typography.{title,meta,stamp}` (úkol 4)
- Produkuje: `renderDocumentHeader(args: { header: DocumentHeaderModel; bandName: string; documentKind: string; logoHref?: string }): string`

- [ ] **Krok 1: Napiš testy hlavičky**

Přidej do `src/infra/pdf/template.test.ts` nový `describe`:

```ts
describe("document header", () => {
  const vm = {
    meta: {
      bandName: "Friday Night Band",
      header: {
        contextParts: ["22. 8. 2026", "Zámek Bon Repos"],
        updatedDate: "12. 8. 2026",
      },
    },
    inputRows: [],
    notes: { inputs: [], monitors: [] },
    stageplan: {
      lineupByRole: {},
      inputs: [],
      monitorOutputs: [],
      powerByRole: {},
    },
  } as any;

  it("labels page one INPUT LIST and page two STAGE PLAN", () => {
    const html = renderInputlistHtml(vm, {
      tabTitle: "Doc",
      baseHref: "file:///tmp/",
    });

    const page2Start = html.indexOf(`id="${pdfLayout.ids.page2}"`);
    const page1Html = html.slice(0, page2Start);
    const page2Html = html.slice(page2Start);

    expect(page1Html).toContain("INPUT LIST · 22. 8. 2026 · Zámek Bon Repos");
    expect(page2Html).toContain("STAGE PLAN · 22. 8. 2026 · Zámek Bon Repos");
  });

  it("stamps the tool and the update date on both pages", () => {
    const html = renderInputlistHtml(vm, {
      tabTitle: "Doc",
      baseHref: "file:///tmp/",
    });

    expect(html.match(/STAGEPILOT/g) ?? []).toHaveLength(2);
    expect(html.match(/UPD 12\. 8\. 2026/g) ?? []).toHaveLength(2);
  });

  it("prints only the document kind when the project carries no context", () => {
    const html = renderInputlistHtml(
      { ...vm, meta: { ...vm.meta, header: { contextParts: [], updatedDate: "1. 1. 2026" } } },
      { tabTitle: "Doc", baseHref: "file:///tmp/" },
    );

    expect(html).toContain(">INPUT LIST<");
    expect(html).not.toContain("INPUT LIST ·");
  });

  // Stylopis je vložený do <head> a obsahuje obě třídy vždycky, takže hledat
  // je v celém dokumentu by nic neprokázalo. Assertce míří jen do <body>.
  const bodyOf = (html: string) => html.slice(html.indexOf("<body>"));

  it("falls back to the XLR mark when the band has no logo", () => {
    const body = bodyOf(
      renderInputlistHtml(vm, { tabTitle: "Doc", baseHref: "file:///tmp/" }),
    );

    expect(body).toContain("docHeader__mark");
    expect(body).not.toContain("docHeader__logo");
  });

  it("prefers the band logo over the XLR mark", () => {
    const body = bodyOf(
      renderInputlistHtml(vm, {
        tabTitle: "Doc",
        baseHref: "file:///tmp/",
        logoHref: "file:///tmp/logo.png",
      }),
    );

    expect(body).toContain("docHeader__logo");
    expect(body).not.toContain("docHeader__mark");
  });
});
```

- [ ] **Krok 2: Spusť testy a ověř, že padají**

Spusť: `npx vitest run src/infra/pdf/template.test.ts`
Očekávej: FAIL — `INPUT LIST` v HTML není.

- [ ] **Krok 3: Napiš renderer hlavičky**

V `src/infra/pdf/template.ts` nahraď funkci `renderMetaLine` (kterou zavedl úkol 5):

```ts
/**
 * Znak XLR je inline SVG, ne soubor: odpadá tím závislost na baseHref a jedna
 * cesta k selhání. Geometrie je z docs/design/brand-handoff-2026-08/README.md.
 */
function renderMark(): string {
  return `<svg class="docHeader__mark" viewBox="0 0 64 64" fill="none">
      <rect x="26" y="1" width="12" height="11" rx="3" fill="${pdfTokens.ink}" />
      <circle cx="32" cy="34" r="22" stroke="${pdfTokens.ink}" stroke-width="6" />
      <circle cx="32" cy="25" r="5.5" fill="${pdfTokens.signal}" />
      <circle cx="23" cy="41" r="5.5" fill="${pdfTokens.ink}" />
      <circle cx="41" cy="41" r="5.5" fill="${pdfTokens.ink}" />
    </svg>`;
}

function renderDocumentHeader(args: {
  header: DocumentHeaderModel;
  bandName: string;
  documentKind: string;
  logoHref?: string;
}): string {
  const markHtml = args.logoHref
    ? `<img class="docHeader__logo" src="${esc(args.logoHref)}" alt="" />`
    : renderMark();

  const metaText = [args.documentKind, ...args.header.contextParts].join(" · ");

  return `<header class="docHeader">
      ${markHtml}
      <div class="docHeader__title">
        <div class="docHeader__band">${esc(args.bandName)}</div>
        <div class="docHeader__meta">${esc(metaText)}</div>
      </div>
      <div class="docHeader__stamp">STAGEPILOT<br />UPD ${esc(args.header.updatedDate)}</div>
    </header>`;
}
```

Doplň import tokenů nahoře v souboru:

```ts
import { pdfLayout, pdfTokens } from "./layout.js";
```

- [ ] **Krok 4: Vlož hlavičku na obě strany**

V `renderInputlistHtml` smaž staré `contactHtml` a `metaHtml` a nahraď `<header class="header">…</header>` na straně 1:

```ts
    ${renderDocumentHeader({
      header: vm.meta.header,
      bandName: vm.meta.bandName,
      documentKind: "INPUT LIST",
      logoHref: opts.logoHref,
    })}
```

a stejný blok vlož na začátek `div#page2`, nad `<main id="content2">`, s `documentKind: "STAGE PLAN"`.

Kontaktní řádek zatím zmizí úplně — vrací ho úkol 7 do patičky. `opts.contactLine` nech v `RenderTemplateOptions`, jen ho dočasně nikdo nečte.

- [ ] **Krok 5: Napiš CSS hlavičky**

V `src/infra/pdf/styles.ts` nahraď celý blok `Header (Variant A)` (řádky 85–143):

```css
/* ===============================
   Hlavička dokumentu
   =============================== */
.docHeader {
  display: flex;
  align-items: flex-start;
  gap: ${pdfLayout.header.gapPt}pt;
  padding-bottom: ${pdfLayout.header.padBottomPt}pt;
  border-bottom: ${pdfLayout.header.rulePt}pt solid ${pdfTokens.ink};
  margin-bottom: ${pdfLayout.header.marginBottomPt}pt;
}

.docHeader__mark {
  flex: 0 0 auto;
  width: ${pdfLayout.header.markSizePt}pt;
  height: ${pdfLayout.header.markSizePt}pt;
}

.docHeader__logo {
  flex: 0 0 auto;
  height: ${pdfLayout.header.markSizePt}pt;
  width: auto;
  max-width: ${pdfLayout.header.logoMaxWidthMm}mm;
}

.docHeader__title {
  display: flex;
  flex-direction: column;
  gap: ${pdfLayout.header.textGapPt}pt;
  min-width: 0;
}

.docHeader__band {
  font-size: ${pdfLayout.typography.title.size};
  font-weight: ${pdfLayout.typography.title.weight};
  line-height: ${pdfLayout.typography.title.lineHeight};
  letter-spacing: ${pdfLayout.typography.title.tracking};
  color: ${pdfTokens.ink};
}

.docHeader__meta {
  font-family: '${pdfLayout.typography.monoFamily}', Consolas, monospace;
  font-size: ${pdfLayout.typography.meta.size};
  line-height: ${pdfLayout.typography.meta.lineHeight};
  letter-spacing: ${pdfLayout.typography.meta.tracking};
  text-transform: uppercase;
  color: ${pdfTokens.body};
}

.docHeader__stamp {
  margin-left: auto;
  text-align: right;
  white-space: nowrap;
  font-family: '${pdfLayout.typography.monoFamily}', Consolas, monospace;
  font-size: ${pdfLayout.typography.stamp.size};
  line-height: ${pdfLayout.typography.stamp.lineHeight};
  letter-spacing: ${pdfLayout.typography.stamp.tracking};
  color: ${pdfTokens.steel};
}
```

Doplň import tokenů nahoře v `styles.ts`:

```ts
import { pdfLayout, pdfTokens } from "./layout.js";
```

- [ ] **Krok 6: Spusť testy a ověř, že procházejí**

Spusť: `npx vitest run src/infra/pdf/`
Očekávej: PASS.

- [ ] **Krok 7: Ověř, že staré třídy zmizely**

Spusť: `grep -rn "bandName\b\|bandLogo\|metaLine\|metaLabel\|metaSep\|headerCenter" src/infra/pdf/`
Očekávej: bez výsledku. `.contactLine` ještě zůstává, ruší ho úkol 7.

- [ ] **Krok 8: Commit**

```bash
git add src/infra/pdf/template.ts src/infra/pdf/template.test.ts src/infra/pdf/styles.ts
git commit -m "feat(pdf): brand the header on both pages"
```

---

### Úkol 7: Patička a číslování stran

Zároveň se výškový rozpočet strany 2 dozví o hlavičce a patičce. Spec: R6, R11.

**Soubory:**
- Upravit: `src/infra/pdf/template.ts` (skládání stran)
- Upravit: `src/infra/pdf/styles.ts` (smazat `.contactLine`, přidat `.docFooter`)
- Upravit: `src/infra/pdf/layout.ts` (smazat `typography.contact`)
- Upravit: `src/infra/pdf/sections/stageplan.ts` (rozpočet)
- Test: `src/infra/pdf/template.test.ts`, `src/infra/pdf/sections/stageplan.test.ts`

**Rozhraní:**
- Konzumuje: `pdfChromeHeights` (úkol 4), `renderDocumentHeader` (úkol 6)
- Produkuje: patičku na obou stranách; `plan.budget.availableHeightMm` je nově `262 − headerMm − footerMm`

- [ ] **Krok 1: Napiš testy patičky**

Přidej do `src/infra/pdf/template.test.ts`:

```ts
describe("document footer", () => {
  const vm = {
    meta: {
      bandName: "Friday Night Band",
      header: { contextParts: ["22. 8. 2026"], updatedDate: "12. 8. 2026" },
    },
    inputRows: [],
    notes: { inputs: [], monitors: [] },
    stageplan: {
      lineupByRole: {},
      inputs: [],
      monitorOutputs: [],
      powerByRole: {},
    },
  } as any;

  it("numbers the pages from their position, not from a literal", () => {
    const html = renderInputlistHtml(vm, {
      tabTitle: "Doc",
      baseHref: "file:///tmp/",
    });

    expect(html).toContain("1 / 2");
    expect(html).toContain("2 / 2");
  });

  it("moves the contact line from the header into the footer", () => {
    const html = renderInputlistHtml(vm, {
      tabTitle: "Doc",
      baseHref: "file:///tmp/",
      contactLine: "Matěj Krečmer · +420 731 247 870",
    });

    const headerEnd = html.indexOf("</header>");
    expect(html.slice(0, headerEnd)).not.toContain("Matěj Krečmer");
    expect(html.match(/Matěj Krečmer/g) ?? []).toHaveLength(2);
  });

  it("still numbers the pages when there is no contact line", () => {
    const html = renderInputlistHtml(vm, {
      tabTitle: "Doc",
      baseHref: "file:///tmp/",
    });

    expect(html).toContain('class="docFooter"');
    expect(html).toContain("1 / 2");
  });
});
```

A v `src/infra/pdf/sections/stageplan.test.ts` uprav assertci dostupné výšky z úkolu 2:

```ts
    expect(plan.budget.availableHeightMm).toBeCloseTo(
      262 - pdfChromeHeights.headerMm - pdfChromeHeights.footerMm,
      2,
    );
```

s importem `import { pdfChromeHeights, pdfLayout } from "../layout.js";`

- [ ] **Krok 2: Spusť testy a ověř, že padají**

Spusť: `npx vitest run src/infra/pdf/`
Očekávej: FAIL — `docFooter` v HTML není a rozpočet pořád tvrdí 262 mm.

- [ ] **Krok 3: Přepiš skládání stran na seznam**

V `src/infra/pdf/template.ts` přidej typ a renderer stránky:

```ts
type PdfPage = {
  readonly pageId: string;
  readonly contentId: string;
  readonly documentKind: string;
  readonly body: string;
};

function renderFooter(args: {
  contactLine?: string;
  pageNumber: number;
  pageCount: number;
}): string {
  const contactHtml = args.contactLine
    ? `<div class="docFooter__contact">${esc(args.contactLine)}</div>`
    : "";

  return `<footer class="docFooter">
      ${contactHtml}
      <div class="docFooter__page">${args.pageNumber} / ${args.pageCount}</div>
    </footer>`;
}

function renderPage(args: {
  page: PdfPage;
  index: number;
  pageCount: number;
  vm: DocumentViewModel;
  opts: RenderTemplateOptions;
}): string {
  const isLast = args.index === args.pageCount - 1;

  return `  <div class="pdfPage${isLast ? "" : " pdfPage--break"}" id="${args.page.pageId}">
    ${renderDocumentHeader({
      header: args.vm.meta.header,
      bandName: args.vm.meta.bandName,
      documentKind: args.page.documentKind,
      logoHref: args.opts.logoHref,
    })}
    <main id="${args.page.contentId}">
${args.page.body}
    </main>
    ${renderFooter({
      contactLine: args.opts.contactLine,
      pageNumber: args.index + 1,
      pageCount: args.pageCount,
    })}
  </div>`;
}
```

a v `renderInputlistHtml` sestav `<body>` ze seznamu:

```ts
  const pages: PdfPage[] = [
    {
      pageId: pdfLayout.ids.page,
      contentId: pdfLayout.ids.content,
      documentKind: "INPUT LIST",
      body: inputListBodyHtml,
    },
    {
      pageId: pdfLayout.ids.page2,
      contentId: pdfLayout.ids.content2,
      documentKind: "STAGE PLAN",
      body: stageplanHtml,
    },
  ];

  const pagesHtml = pages
    .map((page, index) =>
      renderPage({ page, index, pageCount: pages.length, vm, opts }),
    )
    .join("\n");
```

Obsah strany 1 vytáhni z dosavadního `<main id="content">` do proměnné nad tím:

```ts
  const inputListBodyHtml = `
  <div class="tableBlock">
    <table class="table inputTable">
      <thead>
        <tr>
          <th class="colNo">no.</th>
          <th class="colInput">input</th>
          <th class="colNote">note</th>
        </tr>
      </thead>
      <tbody>
        ${vm.inputRows
          .map(
            (r) => `
          <tr>
            <td class="colNo">${esc(r.no)}</td>
            <td class="colInput">${esc(r.label)}</td>
            <td class="colNote">${r.note ? esc(r.note) : ""}</td>
          </tr>`,
          )
          .join("")}
      </tbody>
    </table>
  </div>

  <div class="tableBlock">
    ${monitorTableHtml}
  </div>

  <div class="notesBlock">
    <div class="notes">
      ${vm.notes.inputs.map((n) => `<div class="noteLine">${esc(n.text)}</div>`).join("")}
      ${vm.notes.monitors.map((n) => `<div class="noteLine">${esc(n.text)}</div>`).join("")}
    </div>
  </div>`;
```

Je to **věrný přesun**, ne úprava — obaly `<div class="tableBlock">` tu zatím zůstávají, ruší je až úkol 8. Kdyby zmizely tady, test v úkolu 8 by byl zelený dřív, než k němu dojde.

Tělo dokumentu pak obsahuje jen `${pagesHtml}`:

```ts
<body>
${pagesHtml}
</body>
```

- [ ] **Krok 4: Napiš CSS patičky a smaž kontaktní řádek**

V `src/infra/pdf/styles.ts` smaž pravidlo `.contactLine` a přidej:

```css
/* ===============================
   Patička dokumentu
   =============================== */
.docFooter {
  display: flex;
  align-items: baseline;
  gap: 12pt;
  padding-top: ${pdfLayout.footer.padTopPt}pt;
  border-top: ${pdfLayout.footer.rulePt}pt solid ${pdfTokens.line};
  font-family: '${pdfLayout.typography.monoFamily}', Consolas, monospace;
  font-size: ${pdfLayout.typography.footer.size};
  line-height: ${pdfLayout.typography.footer.lineHeight};
  letter-spacing: ${pdfLayout.typography.footer.tracking};
  text-transform: uppercase;
  color: ${pdfTokens.steel};
}

.docFooter__contact {
  min-width: 0;
  overflow: hidden;
  text-overflow: clip;
  white-space: nowrap;
}

.docFooter__page {
  margin-left: auto;
  white-space: nowrap;
}
```

V `src/infra/pdf/layout.ts` smaž `typography.contact` — po smazání `.contactLine` ji nic nečte.

- [ ] **Krok 5: Odečti hlavičku a patičku z rozpočtu strany 2**

V `src/infra/pdf/sections/stageplan.ts` uprav výpočet dostupné výšky:

```ts
  // Hlavička a patička ukrajují ze zrcadla dřív, než na plán vůbec dojde.
  const availableHeightMm =
    pdfLayout.page.contentHeightMm -
    pdfChromeHeights.headerMm -
    pdfChromeHeights.footerMm;
```

s importem `import { pdfChromeHeights, pdfLayout, parsePt } from "../layout.js";`

Tímhle přestane být `parseMm` k čemu — jediná dvě použití byla `marginTopMm` a `marginBottomMm`. **Smaž ji** (`src/infra/pdf/sections/stageplan.ts:41-48`), jinak ji lint nahlásí jako mrtvý kód.

- [ ] **Krok 6: Spusť testy a ověř, že procházejí**

Spusť: `npx vitest run src/infra/pdf/`
Očekávej: PASS. Rozpočet strany 2 musí vyjít na zhruba 231,97 mm dostupné výšky proti 88,68 mm obsazené — rezerva 143 mm.

- [ ] **Krok 7: Commit**

```bash
git add src/infra/pdf/template.ts src/infra/pdf/template.test.ts src/infra/pdf/styles.ts src/infra/pdf/layout.ts src/infra/pdf/sections/stageplan.ts src/infra/pdf/sections/stageplan.test.ts
git commit -m "feat(pdf): add the document footer and page numbering"
```

---

### Úkol 8: Tabulka bez rámečků

Spec: R8.

**Soubory:**
- Upravit: `src/infra/pdf/styles.ts:145-232`
- Upravit: `src/infra/pdf/template.ts` (zrušení `<div class="tableBlock">`)
- Upravit: `src/infra/pdf/layout.ts` (smazat `typography.table.headerWeight`)
- Test: `src/infra/pdf/styles.test.ts`

**Rozhraní:**
- Konzumuje: `pdfTokens`, `pdfLayout.typography.{tableHead,table}` (úkol 4)
- Produkuje: nic pro další úkoly

- [ ] **Krok 1: Napiš testy tabulky**

Přidej do `src/infra/pdf/styles.test.ts`:

```ts
describe("pdf table", () => {
  it("carries rows on hairlines instead of a frame", () => {
    expect(pdfStyles).not.toContain(".tableBlock");
    expect(pdfStyles).toContain("--w-grid");
  });

  it("sets the channel number in mono", () => {
    expect(pdfStyles).toContain(
      `font-family: '${pdfLayout.typography.monoFamily}'`,
    );
  });
});
```

a do `src/infra/pdf/template.test.ts`:

```ts
  it("renders the tables without a frame wrapper", () => {
    const html = renderInputlistHtml(vm, {
      tabTitle: "Doc",
      baseHref: "file:///tmp/",
    });

    // Tady stačí hledat v celém dokumentu: úkol ruší .tableBlock i ze stylopisu.
    expect(html).not.toContain("tableBlock");
  });
```

Vlož ho dovnitř `describe("document footer", …)` z úkolu 7 — `vm` je tam už nachystané.

- [ ] **Krok 2: Spusť testy a ověř, že padají**

Spusť: `npx vitest run src/infra/pdf/`
Očekávej: FAIL — `.tableBlock` v CSS i HTML pořád je.

- [ ] **Krok 3: Přepiš CSS tabulky**

V `src/infra/pdf/styles.ts` smaž celý blok `Table blocks (outer thick frame)` (`.tableBlock`) i pravidla, která z něj odstraňují vnější okraje buněk (`.tableBlock .table tr > *:first-child` a další tři), a nahraď blok tabulky:

```css
/* ===============================
   Tabulka — drží ji linky, ne rámeček
   =============================== */
.table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: ${pdfLayout.typography.table.size};
  line-height: ${pdfLayout.typography.table.lineHeight};
  margin: 0 0 var(--block-gap) 0;
}

.table th,
.table td {
  border: 0;
  border-bottom: var(--w-grid) solid ${pdfTokens.lineFaint};
  padding: ${pdfLayout.table.padY} ${pdfLayout.table.padX};
  vertical-align: middle;
}

.table tbody tr:last-child > * {
  border-bottom: 0;
}

.table thead th {
  font-family: '${pdfLayout.typography.monoFamily}', Consolas, monospace;
  font-size: ${pdfLayout.typography.tableHead.size};
  font-weight: ${pdfLayout.typography.tableHead.weight};
  line-height: ${pdfLayout.typography.tableHead.lineHeight};
  letter-spacing: ${pdfLayout.typography.tableHead.tracking};
  text-transform: uppercase;
  color: ${pdfTokens.steel};
  text-align: left;
  border-bottom: var(--w-grid) solid ${pdfTokens.line};
}

.table thead th.colNo {
  text-align: center;
}

.table tbody td.colNo {
  font-family: '${pdfLayout.typography.monoFamily}', Consolas, monospace;
  font-weight: 400;
  color: ${pdfTokens.steel};
}

.table tbody td.colInput {
  font-weight: ${pdfLayout.typography.table.inputWeight};
  color: ${pdfTokens.ink};
}

.table tbody td.colNote {
  color: ${pdfTokens.body};
}
```

Konstanty na začátku souboru uprav tak, aby `--c-line` mířila na ink a `--w-frame` zůstala jen pro linku pod hlavičkou:

```css
  --c-line: ${pdfTokens.ink};
  --w-frame: 2pt;   /* linka pod hlavičkou dokumentu */
  --w-grid: 0.5pt;  /* linky mezi řádky tabulky */
```

- [ ] **Krok 4: Zruš obal tabulek v šabloně**

V `src/infra/pdf/template.ts` smaž oba `<div class="tableBlock">` obaly — tabulky stojí samy.

- [ ] **Krok 5: Smaž nepoužitou váhu**

V `src/infra/pdf/layout.ts` smaž `headerWeight: 700 as const,` z `typography.table` — po přepsání `thead th` ji nic nečte.

- [ ] **Krok 6: Spusť testy a ověř, že procházejí**

Spusť: `npx vitest run src/infra/pdf/`
Očekávej: PASS.

- [ ] **Krok 7: Ověř, že nezbyla mrtvá třída**

Spusť: `grep -rn "tableBlock\|headerWeight" src/`
Očekávej: bez výsledku.

- [ ] **Krok 8: Commit**

```bash
git add src/infra/pdf/styles.ts src/infra/pdf/styles.test.ts src/infra/pdf/template.ts src/infra/pdf/template.test.ts src/infra/pdf/layout.ts
git commit -m "feat(pdf): rebuild the input table on hairlines"
```

---

### Úkol 9: Pojistka proti přetečení A4

Poslední, protože měří výsledek všech předchozích. Spec: R11.

**Soubory:**
- Upravit: `src/infra/pdf/styles.ts` (`.pdfPage`, `#content`)
- Upravit: `src/infra/pdf/pdf.ts:13-18`, `:150-279`
- Test: `src/infra/pdf/pdf.test.ts` (celý soubor)
- Vytvořit: `src/infra/pdf/pdfPageCount.ts`

**Rozhraní:**
- Konzumuje: `pdfLayout.page.contentWidthMm`, `contentHeightMm` (úkol 4)
- Produkuje: `countPdfPages(buffer: Buffer): number`, `launchPdfBrowser(): Promise<Browser>`

- [ ] **Krok 1: Napiš test počítadla stran**

Vytvoř `src/infra/pdf/pdfPageCount.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { countPdfPages } from "./pdfPageCount.js";

describe("countPdfPages", () => {
  it("counts page objects", () => {
    const pdf = Buffer.from("/Type /Page\n/Type /Page\n", "latin1");
    expect(countPdfPages(pdf)).toBe(2);
  });

  it("does not mistake the page tree for a page", () => {
    // /Type /Pages je kořen stromu stránek, ne stránka. Kdyby se počítal,
    // dvoustránkový dokument by hlásil tři.
    const pdf = Buffer.from("/Type /Pages\n/Type /Page\n", "latin1");
    expect(countPdfPages(pdf)).toBe(1);
  });

  it("tolerates the space-free form", () => {
    expect(countPdfPages(Buffer.from("/Type/Page\n", "latin1"))).toBe(1);
  });
});
```

- [ ] **Krok 2: Spusť test a ověř, že padá**

Spusť: `npx vitest run src/infra/pdf/pdfPageCount.test.ts`
Očekávej: FAIL — modul neexistuje.

- [ ] **Krok 3: Vytáhni počítadlo do produkčního kódu**

Vytvoř `src/infra/pdf/pdfPageCount.ts`:

```ts
/**
 * Počet stránek v hotovém PDF. Druhá vrstva pojistky proti přetečení: DOM
 * kontrola měří layout na obrazovce, tohle měří, co Chromium doopravdy zalomilo.
 */
export function countPdfPages(buffer: Buffer): number {
  const content = buffer.toString("latin1");
  // \b za Page odmítne /Type /Pages, což je kořen stromu stránek.
  const matches = content.match(/\/Type\s*\/Page\b/g) ?? [];
  return matches.length;
}
```

- [ ] **Krok 4: Dej stránce pevné rozměry**

V `src/infra/pdf/styles.ts` nahraď pravidlo `.pdfPage` a prázdné selektory `#page` / `#content`:

```css
/*
  Pevná šířka srovná rozložení na obrazovce s tiskem — bez ní se sloupec note
  zalamuje při měření jinak než na papíře. Pevná výška dá kontrole přetečení
  co měřit; bez ní je .pdfPage jen tak vysoká jako její obsah.
*/
.pdfPage {
  position: relative;
  width: ${pdfLayout.page.contentWidthMm}mm;
  height: ${pdfLayout.page.contentHeightMm}mm;
  display: flex;
  flex-direction: column;
}

#${pdfLayout.ids.content},
#${pdfLayout.ids.content2} {
  flex: 1 1 auto;
  min-height: 0;
}
```

- [ ] **Krok 5: Přepiš kontrolu přetečení**

V `src/infra/pdf/pdf.ts` nahraď blok od `// Overflow check` po `throw new Error(msg);` (řádky 231–268):

```ts
        // #content je flex položka s pevnou výškou stránky, takže scrollHeight
        // nad clientHeight je přímé měření přetečení. Předchozí verze
        // porovnávala rodiče s jeho vlastním dítětem a nemohla nikdy spadnout.
        const contentIds = [pdfLayout.ids.content, pdfLayout.ids.content2];

        const overflow = await page.evaluate((ids: string[]) => {
            const tolerancePx = 2;
            for (const id of ids) {
                const el = document.getElementById(id);
                if (!el) {
                    return { ok: false as const, reason: `missing #${id}` };
                }
                const overflowPx = el.scrollHeight - el.clientHeight;
                if (overflowPx > tolerancePx) {
                    return { ok: false as const, contentId: id, overflowPx };
                }
            }
            return { ok: true as const };
        }, contentIds);

        if (!overflow.ok) {
            throw new Error(
                `PDF overflow: content does not fit A4 page. ${
                    "overflowPx" in overflow
                        ? `contentId=${overflow.contentId} overflowPx=${overflow.overflowPx}`
                        : overflow.reason
                }`,
            );
        }
```

- [ ] **Krok 6: Zkontroluj počet stran nad hotovým souborem**

V `src/infra/pdf/pdf.ts` doplň za volání `page.pdf(...)`:

```ts
        const rendered = await fs.readFile(opts.outFile);
        const pageCount = countPdfPages(rendered);
        if (pageCount !== EXPECTED_PAGE_COUNT) {
            throw new Error(
                `PDF page count mismatch: expected ${EXPECTED_PAGE_COUNT}, got ${pageCount}. Content overflowed the A4 page.`,
            );
        }
```

s konstantou nahoře v souboru a importem:

```ts
import { countPdfPages } from "./pdfPageCount.js";

/** Input list a stage plan. Třetí strana znamená, že se obsah nevešel. */
const EXPECTED_PAGE_COUNT = 2;
```

- [ ] **Krok 7: Vytáhni spouštění prohlížeče, aby ho mohl použít test**

Test dnes hádá dostupnost prohlížeče z linuxových cest a na Windows se proto vždycky přeskočí. Aby ho mohl prostě zkusit spustit, vytáhni z `renderPdf` řádky 172–223 do exportované funkce:

```ts
/** Spuštění prohlížeče podle pořadí systémový Chrome → svázaný Chromium → env. */
export async function launchPdfBrowser(): Promise<Browser> {
    const executablePath = resolveChromiumExecutablePath();
    const dumpio = process.env.STAGEPILOT_PDF_DUMPIO === "1";
    const baseLaunchOptions = {
        headless: true,
        dumpio,
        args: DESKTOP_CHROMIUM_ARGS,
    } as const satisfies LaunchOptions;

    const launchStrategies: LaunchStrategy[] = [];
    const explicitExecutablePath = hasExplicitExecutablePath();

    if (!explicitExecutablePath) {
        launchStrategies.push(...getSystemBrowserFallbacks(baseLaunchOptions));
    }

    if (executablePath) {
        launchStrategies.push({
            name: explicitExecutablePath
                ? "env:PUPPETEER_EXECUTABLE_PATH"
                : "puppeteer.executablePath()",
            executablePath,
            launchOptions: { ...baseLaunchOptions, executablePath },
        });
    } else {
        launchStrategies.push({
            name: "puppeteer default resolution",
            launchOptions: { ...baseLaunchOptions },
        });
    }

    console.error("[pdf] chromium launch plan", {
        platform: process.platform,
        nodeVersion: process.versions.node,
        executablePath: executablePath ?? "<puppeteer default>",
        cwd: process.cwd(),
        dumpio,
        args: DESKTOP_CHROMIUM_ARGS,
        strategies: launchStrategies.map((strategy) => ({
            name: strategy.name,
            executablePath: strategy.executablePath ?? null,
            channel: strategy.launchOptions.channel ?? null,
        })),
    });

    return launchWithFallback(launchStrategies);
}
```

a v `renderPdf` nahraď celý ten blok jediným řádkem:

```ts
    const browser = await launchPdfBrowser();
```

Deklaraci `let browser;` nad ním smaž — proměnná je od téhle chvíle `const`.

- [ ] **Krok 8: Přepiš detekci Chromia v testu**

Nahraď `src/infra/pdf/pdf.test.ts` (řádky 17–22) tímhle — místo hádání z cest v linuxovém filesystému se prohlížeč prostě zkusí spustit:

```ts
import { beforeAll, describe, expect, it } from "vitest";
import { launchPdfBrowser, renderPdf } from "./pdf.js";

let chromiumAvailable = false;

beforeAll(async () => {
  try {
    const browser = await launchPdfBrowser();
    await browser.close();
    chromiumAvailable = true;
  } catch {
    chromiumAvailable = false;
  }
}, 60000);
```

a v testu nahraď `maybeIt` podmínkou uvnitř:

```ts
  it("renders two pages when stageplan is included", { timeout: 60000 }, async () => {
    if (!chromiumAvailable) {
      // Bez prohlížeče se nedá render ověřit. Přeskočení není zelený výsledek.
      console.warn("[pdf.test] Chromium unavailable — skipping render check");
      return;
    }
    // (zbytek beze změny, včetně countPdfPages importované z pdfPageCount.js)
  });
```

Lokální `countPdfPages` v testu smaž a importuj ho z `./pdfPageCount.js`.

- [ ] **Krok 9: Spusť testy a ověř výsledek**

Spusť: `npx vitest run src/infra/pdf/`
Očekávej: PASS. `pdf.test.ts` v tomhle prostředí vypíše varování o chybějícím Chromiu — **to není potvrzení, že se dokument vejde**.

- [ ] **Krok 10: Spusť celou sadu a lint**

Spusť: `npm test 2>&1 | tail -20`
Očekávej: proti baseline žádné nové selhání (baseline jsou 2 padající testy v `src/infra/fs/`).

Spusť: `npx biome check src/infra/pdf src/domain/formatters src/domain/model src/domain/pipeline`
Očekávej: žádná nová chyba proti baseline CRLF hlášek.

- [ ] **Krok 11: Commit**

```bash
git add src/infra/pdf/pdf.ts src/infra/pdf/pdf.test.ts src/infra/pdf/pdfPageCount.ts src/infra/pdf/pdfPageCount.test.ts src/infra/pdf/styles.ts
git commit -m "fix(pdf): make the A4 overflow guard actually measure overflow"
```

---

## Po dokončení

- [ ] **Vizuální ověření uživatelem.** Spusť `npm run pdf:dev -- --project <id>` a otevři výsledek. Kontroluj: hlavička na obou stranách, patička s `1 / 2` a `2 / 2`, tabulka bez rámečků, mono čísla kanálů, dvě strany.
- [ ] **Doplň do specu sekci „Stav implementace"** s odchylkami, které z implementace vyplynuly — tak to udělaly F1 až F3.
- [ ] **Uprav roadmapu:** řádek F4 na `hotovo` a doplň hash commitu.
