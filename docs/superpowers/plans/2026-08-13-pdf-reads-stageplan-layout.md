# PDF čte rozmístění stage planu (F5b) — implementační plán

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tištěný stage plan kreslí bloky na pozicích a rotacích z `stageplan.layout`, v nové kresbě podle handoffu, a editor dopředu ukazuje, kolik místa blok na papíře zabere.

**Architecture:** Tisková geometrie je čistá doménová matematika (`src/domain/stageplan/print/`), která typografii dostává parametrem z `src/infra/pdf/layout.ts`. Renderer v `src/infra/pdf/sections/stageplan.ts` z ní jen sestaví HTML; oba pevné layouty mizí. Editor si stejnou matematiku zavolá s počty řádků, které mu vrátí nový lehký Tauri příkaz nad node skriptem.

**Tech Stack:** TypeScript (ESM, strict), React, Vitest (node prostředí, bez jsdom), Biome, Tauri (Rust), tsx pro skripty.

## Global Constraints

- Spec je `docs/superpowers/specs/2026-08-13-pdf-reads-stageplan-layout-design.md`; rozhodnutí `R1`–`R14` jsou závazná.
- `src/domain/` je bez I/O a **bez PDF konstant** — typografie a rozměry plochy tečou dovnitř parametrem (R9).
- `packages/desktop/` je jen UI; z infra vrstvy nesmí importovat nic, ani typy (proto R12 posílá plochu a typografii v odpovědi příkazu).
- Souřadnice a rozměry v modelu jsou **v metrech**, tisková geometrie počítá v **milimetrech**.
- Export nikdy nezapisuje do projektu — `stageplan.layout` se pro tisk dopočítává v paměti (R8, R9 ve F5a).
- Baseline repozitáře je trvale červený: `npm test` má 2 trvalá selhání (`src/infra/fs/assetsPaths.test.ts`, `src/infra/fs/repoAssets.test.ts`), `npm run lint` hlásí ~1400 CRLF chyb, `npm run build:desktop` padá na 10 typových chyb ve 4 předem existujících testovacích souborech a `npm run smoke:pdf-preview` je rozbitý nezávisle (`bandRef: "pl"` neexistuje). **Měř rozdíl, ne absolutní čísla.** Lint se ověřuje jen na dotčených cestách: `npx biome check <cesty>`. Nikdy nespouštěj `biome format --write` nad celým repem.
- Commit message je **jednořádkový** — hook odmítne tělo i patičku.
- Přesná čísla, na kterých plán stojí (nepřepisovat konstantami, počítat z `pdfLayout`):
  `areaWidthMm = 162,5375` · `areaHeightMm = 202,0914` · `mmPerM` při 12 × 8 m `= 13,5448` · `minBoxWidthMm = 36,2594`.

---

### Task 1: Doménové měřítko tisku

**Files:**
- Create: `src/domain/stageplan/print/printScale.ts`
- Test: `src/domain/stageplan/print/printScale.test.ts`

**Interfaces:**
- Consumes: `NOMINAL_STAGE` z `src/domain/stageplan/layout/defaultLayout.ts`, typ `StageplanStageSize`.
- Produces: `PrintArea = { widthMm, heightMm }`, `PrintScale = { mmPerM, planWidthMm, planHeightMm, toMm(m), toM(mm) }`, `createPrintScale(stage: StageplanStageSize | null, area: PrintArea): PrintScale`.

- [ ] **Step 1: Write the failing test**

Vytvoř `src/domain/stageplan/print/printScale.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createPrintScale } from "./printScale.js";

/** Skutečná tisková plocha strany 2 — stejná čísla, s jakými počítá renderer. */
const AREA = { widthMm: 162.5375, heightMm: 202.0914 };

describe("createPrintScale", () => {
  it("uses the nominal stage when the size is not entered", () => {
    const scale = createPrintScale(null, AREA);

    expect(scale.mmPerM).toBeCloseTo(13.5448, 3);
    expect(scale.planWidthMm).toBeCloseTo(162.5375, 3);
    expect(scale.planHeightMm).toBeCloseTo(108.3583, 3);
  });

  it("binds on width for a stage wider than deep", () => {
    const scale = createPrintScale({ widthM: 10, depthM: 6 }, AREA);

    expect(scale.mmPerM).toBeCloseTo(16.2538, 3);
    expect(scale.planWidthMm).toBeCloseTo(162.5375, 3);
    expect(scale.planHeightMm).toBeCloseTo(97.5225, 3);
  });

  it("binds on height for a stage deeper than 1,243 times its width", () => {
    const scale = createPrintScale({ widthM: 8, depthM: 14 }, AREA);

    expect(scale.mmPerM).toBeCloseTo(14.4351, 3);
    expect(scale.planHeightMm).toBeCloseTo(202.0914, 3);
    expect(scale.planWidthMm).toBeCloseTo(115.4808, 3);
  });

  it("round-trips metres through millimetres", () => {
    const scale = createPrintScale({ widthM: 11, depthM: 7 }, AREA);

    expect(scale.toM(scale.toMm(3.75))).toBeCloseTo(3.75, 6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/stageplan/print/printScale.test.ts`
Expected: FAIL — `Failed to load url ./printScale.js` (soubor neexistuje)

- [ ] **Step 3: Write minimal implementation**

Vytvoř `src/domain/stageplan/print/printScale.ts`:

```ts
import type { StageplanStageSize } from "../../model/types.js";
import { NOMINAL_STAGE } from "../layout/defaultLayout.js";

export type PrintArea = {
  readonly widthMm: number;
  readonly heightMm: number;
};

export type PrintScale = {
  readonly mmPerM: number;
  readonly planWidthMm: number;
  readonly planHeightMm: number;
  readonly toMm: (meters: number) => number;
  readonly toM: (millimeters: number) => number;
};

/**
 * Měřítko je jedno pro obě osy. V neizotropním by se otočená zóna kreslila jako
 * zkosený rovnoběžník a vytištěný údaj o rotaci by lhal — a rotace je přesně to,
 * co F5b tiskne.
 */
export function createPrintScale(
  stage: StageplanStageSize | null,
  area: PrintArea,
): PrintScale {
  const plan = stage ?? NOMINAL_STAGE;
  const mmPerM = Math.min(
    area.widthMm / plan.widthM,
    area.heightMm / plan.depthM,
  );

  return {
    mmPerM,
    planWidthMm: plan.widthM * mmPerM,
    planHeightMm: plan.depthM * mmPerM,
    toMm: (meters) => meters * mmPerM,
    toM: (millimeters) => millimeters / mmPerM,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/stageplan/print/printScale.test.ts`
Expected: PASS — 4 testy

- [ ] **Step 5: Lint the touched files**

Run: `npx biome check src/domain/stageplan/print/printScale.ts src/domain/stageplan/print/printScale.test.ts`
Expected: jen hlášky `format` o CRLF, žádné porušení pravidel (lint rules)

- [ ] **Step 6: Commit**

```bash
git add src/domain/stageplan/print/printScale.ts src/domain/stageplan/print/printScale.test.ts
git commit -m "feat(stageplan): derive the isotropic print scale from the stage size"
```

---

### Task 2: Počet řádků boxu se přesune do domény

**Files:**
- Create: `src/domain/pipeline/pdf/countStageplanBoxLines.ts`
- Test: `src/domain/pipeline/pdf/countStageplanBoxLines.test.ts`
- Modify: `src/infra/pdf/sections/stageplan.ts` (smaž lokální `countRenderedLines`, importuj novou funkci)

**Interfaces:**
- Consumes: typ `StageplanPrintBox` z `src/domain/pipeline/pdf/buildPdfStageplanPrintModel.ts`.
- Produces: `StageplanBoxBullets`, `countStageplanBoxLines(box: StageplanBoxBullets): number`.

- [ ] **Step 1: Write the failing test**

Vytvoř `src/domain/pipeline/pdf/countStageplanBoxLines.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { countStageplanBoxLines } from "./countStageplanBoxLines.js";

function box(args: {
  inputs?: string[];
  monitors?: string[];
  extras?: string[];
}) {
  return {
    inputBullets: args.inputs ?? [],
    monitorBullets: args.monitors ?? [],
    extraBullets: args.extras ?? [],
  };
}

describe("countStageplanBoxLines", () => {
  it("counts nothing for an empty box", () => {
    expect(countStageplanBoxLines(box({}))).toBe(0);
  });

  it("counts bullets of a single group without a separator", () => {
    expect(countStageplanBoxLines(box({ inputs: ["a", "b", "c"] }))).toBe(3);
    expect(countStageplanBoxLines(box({ monitors: ["a"] }))).toBe(1);
  });

  it("adds a separator line between two non-empty groups", () => {
    expect(countStageplanBoxLines(box({ inputs: ["a"], monitors: ["b"] }))).toBe(
      3,
    );
  });

  it("counts the drums box with all three groups", () => {
    expect(
      countStageplanBoxLines(
        box({
          inputs: ["Drums (1–8)", "PAD SFX (9+10)", "Backing track (11–12)"],
          monitors: ["IEM STEREO wired (5)"],
          extras: ["Drum riser 3x2"],
        }),
      ),
    ).toBe(7);
  });

  it("does not add a separator when only later groups are filled", () => {
    expect(
      countStageplanBoxLines(box({ monitors: ["a"], extras: ["b"] })),
    ).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/pipeline/pdf/countStageplanBoxLines.test.ts`
Expected: FAIL — soubor `./countStageplanBoxLines.js` neexistuje

- [ ] **Step 3: Write the implementation**

Vytvoř `src/domain/pipeline/pdf/countStageplanBoxLines.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/pipeline/pdf/countStageplanBoxLines.test.ts`
Expected: PASS — 5 testů

- [ ] **Step 5: Use it in the renderer**

V `src/infra/pdf/sections/stageplan.ts` smaž celou lokální funkci `countRenderedLines` (dnes na řádcích 316–324) a nahraď její jediné použití v `calculateRequiredHeightPt`:

```ts
// nahoře k importům
import { countStageplanBoxLines } from "../../../domain/pipeline/pdf/countStageplanBoxLines.js";

// v calculateRequiredHeightPt místo `const lines = countRenderedLines(box);`
const lines = countStageplanBoxLines(box);
```

- [ ] **Step 6: Run the existing renderer tests to prove nothing changed**

Run: `npx vitest run src/infra/pdf/sections/stageplan.test.ts`
Expected: PASS — stejný počet testů jako před změnou (chování se nemění, jen se přesunul výpočet)

- [ ] **Step 7: Lint and commit**

```bash
npx biome check src/domain/pipeline/pdf/countStageplanBoxLines.ts src/domain/pipeline/pdf/countStageplanBoxLines.test.ts src/infra/pdf/sections/stageplan.ts
git add src/domain/pipeline/pdf/countStageplanBoxLines.ts src/domain/pipeline/pdf/countStageplanBoxLines.test.ts src/infra/pdf/sections/stageplan.ts
git commit -m "refactor(stageplan): move the printed box line count into the domain"
```

---

### Task 3: Tisková stopa boxu

**Files:**
- Create: `src/domain/stageplan/print/printFootprint.ts`
- Test: `src/domain/stageplan/print/printFootprint.test.ts`

**Interfaces:**
- Consumes: typ `StageplanBlock` (jen `widthM`, `depthM`).
- Produces: `PrintTypography = { fontSizePt, lineHeight, titleGapPt, padBottomPt, minBoxWidthMm }`, `PrintFootprintMm = { widthMm, heightMm }`, `computePrintFootprintMm(args): PrintFootprintMm` s argumenty `{ lineCount, hasPower, zone, mmPerM, typography }`.

- [ ] **Step 1: Write the failing test**

Vytvoř `src/domain/stageplan/print/printFootprint.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  type PrintTypography,
  computePrintFootprintMm,
} from "./printFootprint.js";

/** Skutečná tisková typografie strany 2 — 8 pt je dnešní dolní řada. */
const TYPOGRAPHY: PrintTypography = {
  fontSizePt: 8,
  lineHeight: 1.25,
  titleGapPt: 6,
  padBottomPt: 2,
  minBoxWidthMm: 36.2594,
};

/** Nominální pódium 12 × 8 m na ploše 162,5375 mm. */
const MM_PER_M = 13.5448;

describe("computePrintFootprintMm", () => {
  it("grows the drums box beyond its zone because the text needs the room", () => {
    const footprint = computePrintFootprintMm({
      lineCount: 8,
      hasPower: true,
      zone: { widthM: 2.8, depthM: 1.6 },
      mmPerM: MM_PER_M,
      typography: TYPOGRAPHY,
    });

    expect(footprint.widthMm).toBeCloseTo(37.925, 2);
    // Zóna dá 21,67 mm, text potřebuje 40,22 mm — vítězí text (R1).
    expect(footprint.heightMm).toBeCloseTo(40.217, 2);
  });

  it("lifts a narrow zone to the minimum readable width", () => {
    const footprint = computePrintFootprintMm({
      lineCount: 3,
      hasPower: false,
      zone: { widthM: 2.6, depthM: 1.2 },
      mmPerM: MM_PER_M,
      typography: TYPOGRAPHY,
    });

    // 2,6 m dá 35,22 mm, což je pod prověřenou šířkou 36,26 mm (R3).
    expect(footprint.widthMm).toBeCloseTo(36.2594, 3);
    expect(footprint.heightMm).toBeCloseTo(19.05, 2);
  });

  it("keeps the zone when the text fits inside it", () => {
    const footprint = computePrintFootprintMm({
      lineCount: 1,
      hasPower: false,
      zone: { widthM: 2.8, depthM: 1.6 },
      mmPerM: MM_PER_M,
      typography: TYPOGRAPHY,
    });

    expect(footprint.heightMm).toBeCloseTo(21.672, 2);
  });

  it("skips the gap below the header when the box has no bullets", () => {
    const footprint = computePrintFootprintMm({
      lineCount: 0,
      hasPower: false,
      zone: { widthM: 0.1, depthM: 0.1 },
      mmPerM: MM_PER_M,
      typography: TYPOGRAPHY,
    });

    // titleGap + hlavička + padBottom, žádná mezera pod hlavičkou.
    expect(footprint.heightMm).toBeCloseTo(6.35, 2);
  });

  it("counts the power line in the height", () => {
    const withPower = computePrintFootprintMm({
      lineCount: 2,
      hasPower: true,
      zone: { widthM: 0.1, depthM: 0.1 },
      mmPerM: MM_PER_M,
      typography: TYPOGRAPHY,
    });
    const withoutPower = computePrintFootprintMm({
      lineCount: 2,
      hasPower: false,
      zone: { widthM: 0.1, depthM: 0.1 },
      mmPerM: MM_PER_M,
      typography: TYPOGRAPHY,
    });

    expect(withPower.heightMm - withoutPower.heightMm).toBeCloseTo(3.5278, 3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/stageplan/print/printFootprint.test.ts`
Expected: FAIL — soubor `./printFootprint.js` neexistuje

- [ ] **Step 3: Write the implementation**

Vytvoř `src/domain/stageplan/print/printFootprint.ts`:

```ts
import type { StageplanBlock } from "../../model/types.js";

const MM_PER_PT = 25.4 / 72;

export type PrintTypography = {
  readonly fontSizePt: number;
  readonly lineHeight: number;
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/stageplan/print/printFootprint.test.ts`
Expected: PASS — 5 testů

- [ ] **Step 5: Lint and commit**

```bash
npx biome check src/domain/stageplan/print/printFootprint.ts src/domain/stageplan/print/printFootprint.test.ts
git add src/domain/stageplan/print/printFootprint.ts src/domain/stageplan/print/printFootprint.test.ts
git commit -m "feat(stageplan): compute the printed footprint of a block from its zone and text"
```

---

### Task 4: Kolize otočených obdélníků

**Files:**
- Create: `src/domain/stageplan/print/printCollisions.ts`
- Test: `src/domain/stageplan/print/printCollisions.test.ts`

**Interfaces:**
- Consumes: typ `StageplanBlockSlot`.
- Produces: `PrintRect = { slot, centerXMm, centerYMm, widthMm, heightMm, rotationDeg }`, `rectsOverlap(a, b): boolean`, `findPrintCollisions(rects): Array<readonly [StageplanBlockSlot, StageplanBlockSlot]>`, `rectAabbMm(rect): { minXMm, minYMm, maxXMm, maxYMm }`.
- Poznámka: `rectAabbMm` je ve stejném modulu, protože stojí na stejné matematice rohů jako SAT. Spec jmenuje moduly, ne exporty — není to odchylka.

- [ ] **Step 1: Write the failing test**

Vytvoř `src/domain/stageplan/print/printCollisions.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  type PrintRect,
  findPrintCollisions,
  rectAabbMm,
  rectsOverlap,
} from "./printCollisions.js";

function rect(overrides: Partial<PrintRect> = {}): PrintRect {
  return {
    slot: "drums",
    centerXMm: 0,
    centerYMm: 0,
    widthMm: 20,
    heightMm: 20,
    rotationDeg: 0,
    ...overrides,
  };
}

describe("rectsOverlap", () => {
  it("finds an overlap of two unrotated boxes", () => {
    expect(
      rectsOverlap(rect(), rect({ slot: "bass", centerXMm: 15 })),
    ).toBe(true);
  });

  it("treats touching edges as separated", () => {
    expect(
      rectsOverlap(rect(), rect({ slot: "bass", centerXMm: 20 })),
    ).toBe(false);
  });

  it("separates two boxes rotated by 45 degrees whose bounding boxes overlap", () => {
    const a = rect({ rotationDeg: 45 });
    const b = rect({
      slot: "bass",
      centerXMm: 21,
      centerYMm: 21,
      rotationDeg: 45,
    });

    // Opsané obdélníky se překrývají — proto se kolize netestuje přes ně (R10).
    const aabbA = rectAabbMm(a);
    const aabbB = rectAabbMm(b);
    expect(aabbA.maxXMm).toBeGreaterThan(aabbB.minXMm);
    expect(aabbA.maxYMm).toBeGreaterThan(aabbB.minYMm);

    expect(rectsOverlap(a, b)).toBe(false);
  });

  it("finds an overlap of two rotated boxes that really intersect", () => {
    expect(
      rectsOverlap(
        rect({ rotationDeg: 45 }),
        rect({ slot: "bass", centerXMm: 8, centerYMm: 8, rotationDeg: 45 }),
      ),
    ).toBe(true);
  });
});

describe("rectAabbMm", () => {
  it("returns the box itself when there is no rotation", () => {
    expect(rectAabbMm(rect({ centerXMm: 50, centerYMm: 30 }))).toEqual({
      minXMm: 40,
      minYMm: 20,
      maxXMm: 60,
      maxYMm: 40,
    });
  });

  it("grows the extents of a rotated box", () => {
    const aabb = rectAabbMm(rect({ rotationDeg: 45 }));

    expect(aabb.maxXMm).toBeCloseTo(14.142, 3);
    expect(aabb.maxYMm).toBeCloseTo(14.142, 3);
  });
});

describe("findPrintCollisions", () => {
  it("reports nothing for boxes standing apart", () => {
    expect(
      findPrintCollisions([
        rect({ slot: "drums", centerXMm: 0 }),
        rect({ slot: "bass", centerXMm: 40 }),
        rect({ slot: "keys", centerXMm: 80 }),
      ]),
    ).toEqual([]);
  });

  it("reports each colliding pair once", () => {
    expect(
      findPrintCollisions([
        rect({ slot: "drums", centerXMm: 0 }),
        rect({ slot: "bass", centerXMm: 10 }),
        rect({ slot: "keys", centerXMm: 100 }),
      ]),
    ).toEqual([["drums", "bass"]]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/stageplan/print/printCollisions.test.ts`
Expected: FAIL — soubor `./printCollisions.js` neexistuje

- [ ] **Step 3: Write the implementation**

Vytvoř `src/domain/stageplan/print/printCollisions.ts`:

```ts
import type { StageplanBlockSlot } from "../../model/types.js";

/** Milimetrová tolerance: dotyk hran není překryv. */
const EPSILON_MM = 0.01;

export type PrintRect = {
  readonly slot: StageplanBlockSlot;
  readonly centerXMm: number;
  readonly centerYMm: number;
  readonly widthMm: number;
  readonly heightMm: number;
  readonly rotationDeg: number;
};

type Point = { readonly x: number; readonly y: number };

function corners(rect: PrintRect): Point[] {
  const radians = (rect.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const halfW = rect.widthMm / 2;
  const halfH = rect.heightMm / 2;

  return [
    { x: -halfW, y: -halfH },
    { x: halfW, y: -halfH },
    { x: halfW, y: halfH },
    { x: -halfW, y: halfH },
  ].map((point) => ({
    x: rect.centerXMm + point.x * cos - point.y * sin,
    y: rect.centerYMm + point.x * sin + point.y * cos,
  }));
}

function axes(rect: PrintRect): Point[] {
  const radians = (rect.rotationDeg * Math.PI) / 180;
  return [
    { x: Math.cos(radians), y: Math.sin(radians) },
    { x: -Math.sin(radians), y: Math.cos(radians) },
  ];
}

function overlapsOnAxis(a: Point[], b: Point[], axis: Point): boolean {
  const project = (points: Point[]) =>
    points.map((point) => point.x * axis.x + point.y * axis.y);
  const pa = project(a);
  const pb = project(b);

  return (
    Math.min(...pa) < Math.max(...pb) - EPSILON_MM &&
    Math.min(...pb) < Math.max(...pa) - EPSILON_MM
  );
}

/**
 * Separating axis test. Opsané obdélníky nestačí: dva bloky otočené o 45° je
 * mají přeložené, i když se samy nedotýkají, a pojistka by odmítla legitimní
 * rozmístění (R10).
 */
export function rectsOverlap(a: PrintRect, b: PrintRect): boolean {
  const cornersA = corners(a);
  const cornersB = corners(b);

  return [...axes(a), ...axes(b)].every((axis) =>
    overlapsOnAxis(cornersA, cornersB, axis),
  );
}

/** Opsaný obdélník otočeného boxu — union bbox kontejneru z něj počítá rozměry. */
export function rectAabbMm(rect: PrintRect): {
  readonly minXMm: number;
  readonly minYMm: number;
  readonly maxXMm: number;
  readonly maxYMm: number;
} {
  const points = corners(rect);
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);

  return {
    minXMm: Math.min(...xs),
    minYMm: Math.min(...ys),
    maxXMm: Math.max(...xs),
    maxYMm: Math.max(...ys),
  };
}

export function findPrintCollisions(
  rects: readonly PrintRect[],
): Array<readonly [StageplanBlockSlot, StageplanBlockSlot]> {
  const pairs: Array<readonly [StageplanBlockSlot, StageplanBlockSlot]> = [];

  for (let i = 0; i < rects.length; i += 1) {
    for (let j = i + 1; j < rects.length; j += 1) {
      const a = rects[i];
      const b = rects[j];
      if (a && b && rectsOverlap(a, b)) pairs.push([a.slot, b.slot]);
    }
  }

  return pairs;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/stageplan/print/printCollisions.test.ts`
Expected: PASS — 8 testů

- [ ] **Step 5: Lint and commit**

```bash
npx biome check src/domain/stageplan/print/printCollisions.ts src/domain/stageplan/print/printCollisions.test.ts
git add src/domain/stageplan/print/printCollisions.ts src/domain/stageplan/print/printCollisions.test.ts
git commit -m "feat(stageplan): detect print collisions of rotated blocks with a separating axis test"
```

---

### Task 5: Layout ve view modelu

**Files:**
- Modify: `src/domain/model/types.ts` (do `DocumentViewModel.stageplan` přidej `layout`)
- Modify: `src/domain/pipeline/pdf/buildPdfStageplan.ts`
- Test: `src/domain/pipeline/pdf/buildPdfStageplan.layout.test.ts`

**Interfaces:**
- Consumes: `mergeWithLineup` z `src/domain/stageplan/layout/mergeWithLineup.ts`, `resolveStageplanBlockSlots` z `src/domain/stageplan/layout/resolveBlockSlots.ts`.
- Produces: `DocumentViewModel["stageplan"]["layout"]: StageplanLayout` (povinné pole) — čtou ho Tasky 6, 7 a 9.

- [ ] **Step 1: Write the failing test**

Vytvoř `src/domain/pipeline/pdf/buildPdfStageplan.layout.test.ts`:

```ts
import fs from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { loadRepository } from "../../../infra/fs/repo.js";
import {
  createPdfRendererFixtureProject,
  createPdfRendererFixtureRoot,
} from "../../../infra/pdf/pdfRendererFixture.js";
import { buildDocument } from "../buildDocument.js";

describe("stageplan layout in the document view model", () => {
  it("derives the default arrangement when the project has no layout", async () => {
    const tmpRoot = await createPdfRendererFixtureRoot();
    try {
      const repo = await loadRepository({ userDataRoot: tmpRoot });
      const project = createPdfRendererFixtureProject("layout-default");

      const vm = buildDocument(project, repo);

      expect(vm.stageplan.layout.stage).toBeNull();
      expect(vm.stageplan.layout.blocks.map((block) => block.slot)).toEqual([
        "drums",
        "bass",
        "guitar",
        "keys",
        "lead_voc_1",
      ]);
      const drums = vm.stageplan.layout.blocks.find(
        (block) => block.slot === "drums",
      );
      expect(drums).toMatchObject({
        centerXM: 6,
        centerYM: 1.2,
        widthM: 2.8,
        depthM: 1.6,
        rotationDeg: 0,
      });
    } finally {
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
  });

  it("keeps a hand-placed block and never writes into the project", async () => {
    const tmpRoot = await createPdfRendererFixtureRoot();
    try {
      const repo = await loadRepository({ userDataRoot: tmpRoot });
      const project = createPdfRendererFixtureProject("layout-saved");
      project.stageplan = {
        layout: {
          stage: { widthM: 10, depthM: 6 },
          blocks: [
            {
              slot: "drums",
              centerXM: 1.5,
              centerYM: 4.2,
              widthM: 2.8,
              depthM: 1.6,
              rotationDeg: 45,
            },
          ],
        },
      };
      const before = JSON.stringify(project.stageplan);

      const vm = buildDocument(project, repo);

      expect(vm.stageplan.layout.stage).toEqual({ widthM: 10, depthM: 6 });
      expect(
        vm.stageplan.layout.blocks.find((block) => block.slot === "drums"),
      ).toMatchObject({ centerXM: 1.5, centerYM: 4.2, rotationDeg: 45 });
      // Chybějící sloty se doplní na výchozí pozici přepočtenou na 10 × 6 m.
      expect(vm.stageplan.layout.blocks).toHaveLength(5);
      // Export nesmí projekt měnit (R8).
      expect(JSON.stringify(project.stageplan)).toBe(before);
    } finally {
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/pipeline/pdf/buildPdfStageplan.layout.test.ts`
Expected: FAIL — `vm.stageplan.layout` je `undefined` (a TypeScript o poli neví)

- [ ] **Step 3: Add the field to the view model type**

V `src/domain/model/types.ts` v bloku `stageplan: { ... }` uvnitř `DocumentViewModel` (dnes řádek 498) přidej jako první pole:

```ts
  stageplan: {
    /** Rozmístění, které tisk kreslí. Dopočítává se v paměti, nikdy se neukládá (R8). */
    layout: StageplanLayout;
    lineupByRole: Partial<Record<StageplanInstrumentKey, StageplanPerson>>;
```

- [ ] **Step 4: Resolve the layout in the stageplan model**

V `src/domain/pipeline/pdf/buildPdfStageplan.ts` přidej importy:

```ts
import { mergeWithLineup } from "../../stageplan/layout/mergeWithLineup.js";
import { resolveStageplanBlockSlots } from "../../stageplan/layout/resolveBlockSlots.js";
```

a na začátek `return { ... }` v `buildPdfStageplanModel` přidej `layout` spočítaný těsně před returnem:

```ts
  // Sloučení s lineupem běží i pro tisk — ale jen v paměti. Zápis do projektu
  // by posunul contentUpdatedAt bez uživatelovy akce (R8, R9 ve F5a).
  const layout = mergeWithLineup(args.project.stageplan?.layout, {
    slots: resolveStageplanBlockSlots({
      musicianIdsByGroup: {
        drums: args.lineup.drums,
        bass: args.lineup.bass,
        guitar: args.lineup.guitar,
        keys: args.lineup.keys,
      },
      leadVocalIds: args.leadOverlayMembers.map((musician) => musician.id),
    }),
    stage: null,
  });

  return {
    layout,
    lineupByRole,
```

- [ ] **Step 5: Run the test and the pipeline suite**

Run: `npx vitest run src/domain/pipeline/pdf/buildPdfStageplan.layout.test.ts src/domain/pipeline`
Expected: PASS — nové 2 testy projdou, existující testy pipeline zůstanou zelené

- [ ] **Step 6: Type-check, lint and commit**

```bash
npx tsc --noEmit -p tsconfig.json
npx biome check src/domain/model/types.ts src/domain/pipeline/pdf/buildPdfStageplan.ts src/domain/pipeline/pdf/buildPdfStageplan.layout.test.ts
git add src/domain/model/types.ts src/domain/pipeline/pdf/buildPdfStageplan.ts src/domain/pipeline/pdf/buildPdfStageplan.layout.test.ts
git commit -m "feat(stageplan): resolve the print layout into the document view model"
```

Pozn.: `tsc --noEmit` v rootu musí projít bez chyb. Chyby v `packages/desktop` (10 předem existujících ve 4 testovacích souborech) sem nepatří — ty se ověřují až v Tasku 10.

---

### Task 6: Renderer počítá geometrii z layoutu

**Files:**
- Modify: `src/infra/pdf/sections/stageplan.ts` (přepis)
- Modify: `src/infra/pdf/styles.ts` (napájení jde do toku, zmizí spacer a absolutní badge)
- Test: `src/infra/pdf/sections/stageplan.test.ts` (přepis)
- Modify: `src/infra/pdf/template.test.ts:103-108` (čte `box.position.xMm`, což zaniká)

**Interfaces:**
- Consumes: `createPrintScale` (Task 1), `countStageplanBoxLines` (Task 2), `computePrintFootprintMm` + `PrintTypography` (Task 3), `findPrintCollisions` + `rectAabbMm` + `PrintRect` (Task 4), `vm.stageplan.layout` (Task 5).
- Produces: `stageplanLayout` (konstanty pro `styles.ts`), `stageplanPrintGeometry = { area, typography }` (čte Task 9), `StageplanPlan`, `StageplanBoxPlan`, `buildStageplanPlan`, `renderStageplanSection`.
- Zaniká: `matchStageplanLayout`, `STAGEPLAN_LAYOUTS`, `computeTopRowGeometry`, `computeBottomRowGeometry`, `__stageplanTestExports`, `stageplanLayout.boxWidthMm`, `.gapXmm`, `.gapYmm`, `.sideInsetXmm`, `.powerCellColor`, `.powerBadgeSpacerHeight`.

- [ ] **Step 1: Write the failing test**

Přepiš `src/infra/pdf/sections/stageplan.test.ts` celý na:

```ts
import fs from "node:fs/promises";
import { describe, expect, it } from "vitest";
import type { DocumentViewModel } from "../../../domain/model/types.js";
import { buildDocument } from "../../../domain/pipeline/buildDocument.js";
import { loadRepository } from "../../fs/repo.js";
import {
  createPdfRendererFixtureProject,
  createPdfRendererFixtureRoot,
} from "../pdfRendererFixture.js";
import { pdfLayout } from "../layout.js";
import {
  buildStageplanPlan,
  renderStageplanSection,
  stageplanLayout,
  stageplanPrintGeometry,
} from "./stageplan.js";

function emptyStageplan(
  layout: DocumentViewModel["stageplan"]["layout"],
): DocumentViewModel["stageplan"] {
  return {
    layout,
    lineupByRole: {},
    leadVocals: [],
    inputs: [],
    monitorOutputs: [],
    powerByRole: {},
  };
}

describe("stageplan print geometry", () => {
  it("keeps the print area derived from the page mirror", () => {
    // Pojistka z F4: opsaná konstanta udělá kontejner širší než stránka a
    // Chromium zmenší celý dokument.
    expect(stageplanLayout.areaWidthMm).toBeCloseTo(162.5375, 3);
    expect(stageplanLayout.areaWidthMm).toBeLessThan(
      pdfLayout.page.contentWidthMm,
    );
    expect(stageplanLayout.areaHeightMm).toBeCloseTo(202.0914, 3);
    expect(stageplanPrintGeometry.typography.minBoxWidthMm).toBeCloseTo(
      36.2594,
      3,
    );
    expect(stageplanPrintGeometry.typography.fontSizePt).toBe(8);
  });

  it("places a block by its zone centre and prints its rotation", () => {
    const plan = buildStageplanPlan(
      emptyStageplan({
        stage: null,
        blocks: [
          {
            slot: "drums",
            centerXM: 6,
            centerYM: 1.2,
            widthM: 2.8,
            depthM: 1.6,
            rotationDeg: 30,
          },
        ],
      }),
    );

    expect(plan.boxes).toHaveLength(1);
    const box = plan.boxes[0];
    expect(box?.slot).toBe("drums");
    expect(box?.rotationDeg).toBe(30);
    expect(box?.widthMm).toBeCloseTo(37.925, 2);
    // Střed 6 m × 13,5448 = 81,27 mm; levý horní roh je o půl šířky vlevo.
    expect((box?.xMm ?? 0) + (box?.widthMm ?? 0) / 2).toBeCloseTo(
      81.269 + plan.stage.xMm,
      2,
    );
    // Osa y roste od upstage hrany k publiku (R4): 1,2 m = 16,25 mm.
    expect((box?.yMm ?? 0) + (box?.heightMm ?? 0) / 2 - plan.stage.yMm).toBeCloseTo(
      16.254,
      2,
    );
  });

  it("refuses to print a block that pushes the container past the mirror", () => {
    expect(() =>
      buildStageplanPlan(
        emptyStageplan({
          stage: null,
          blocks: [
            {
              slot: "drums",
              centerXM: 20,
              centerYM: 1.2,
              widthM: 2.8,
              depthM: 1.6,
              rotationDeg: 0,
            },
          ],
        }),
      ),
    ).toThrow(/overflow/);
  });

  it("prints the stage caption only when the size is entered", () => {
    const withStage = buildStageplanPlan(
      emptyStageplan({ stage: { widthM: 10, depthM: 6 }, blocks: [] }),
    );
    const withoutStage = buildStageplanPlan(
      emptyStageplan({ stage: null, blocks: [] }),
    );

    expect(withStage.stage.caption).toBe("PÓDIUM 10,0 × 6,0 m");
    expect(withoutStage.stage.caption).toBeNull();
  });

  it("sizes the container from the union of the stage frame and the boxes", () => {
    const plan = buildStageplanPlan(
      emptyStageplan({
        stage: null,
        blocks: [
          {
            slot: "drums",
            centerXM: 6,
            centerYM: 0.2,
            widthM: 2.8,
            depthM: 1.6,
            rotationDeg: 0,
          },
        ],
      }),
    );

    // Zóna bicích je 21,7 mm vysoká, takže na 0,2 m (2,7 mm) od hrany
    // přesahuje box za upstage hranu a kontejner se o ten přesah zvětší.
    expect(plan.stage.yMm).toBeGreaterThan(0);
    expect(plan.container.heightMm).toBeGreaterThan(plan.stage.heightMm);
    expect(plan.container.widthMm).toBeLessThanOrEqual(
      stageplanLayout.areaWidthMm,
    );
  });

  it("refuses to print blocks that overlap on paper", () => {
    expect(() =>
      buildStageplanPlan(
        emptyStageplan({
          stage: null,
          blocks: [
            {
              slot: "drums",
              centerXM: 6,
              centerYM: 2,
              widthM: 2.8,
              depthM: 1.6,
              rotationDeg: 0,
            },
            {
              slot: "bass",
              centerXM: 6.2,
              centerYM: 2.4,
              widthM: 2.7,
              depthM: 1.4,
              rotationDeg: 0,
            },
          ],
        }),
      ),
    ).toThrow(/collision: drums × bass/);
  });

  it("builds boxes and content for the fixture project", async () => {
    const tmpRoot = await createPdfRendererFixtureRoot();
    try {
      const repo = await loadRepository({ userDataRoot: tmpRoot });
      const project = createPdfRendererFixtureProject("stageplan-smoke");
      const vm = buildDocument(project, repo);

      const plan = buildStageplanPlan(vm.stageplan);

      expect(plan.boxes).toHaveLength(5);
      const drumsBox = plan.boxes.find((box) => box.slot === "drums");
      expect(drumsBox?.header).toBe("DRUMS – PAVEL");
      expect(drumsBox?.inputBullets[0]).toMatch(/^Drums \(\d+(–\d+)?\)$/);
      expect(drumsBox?.extraBullets).toEqual(
        expect.arrayContaining(["Drum riser 3x2"]),
      );

      const html = renderStageplanSection(vm);
      expect(html).toContain("transform:rotate(0deg)");
      expect(html).toContain("stageplanStage");
    } finally {
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/infra/pdf/sections/stageplan.test.ts`
Expected: FAIL — `stageplanPrintGeometry` neexistuje, `buildStageplanPlan` má jiný tvar výsledku

- [ ] **Step 3: Rewrite the section module**

Přepiš `src/infra/pdf/sections/stageplan.ts` celý na:

```ts
import type {
  DocumentViewModel,
  StageplanStageSize,
} from "../../../domain/model/types.js";
import {
  type StageplanPrintBox,
  buildPdfStageplanPrintModel,
} from "../../../domain/pipeline/pdf/buildPdfStageplanPrintModel.js";
import { countStageplanBoxLines } from "../../../domain/pipeline/pdf/countStageplanBoxLines.js";
import {
  type PrintRect,
  findPrintCollisions,
  rectAabbMm,
} from "../../../domain/stageplan/print/printCollisions.js";
import {
  type PrintTypography,
  computePrintFootprintMm,
} from "../../../domain/stageplan/print/printFootprint.js";
import { createPrintScale } from "../../../domain/stageplan/print/printScale.js";
import { parsePt, pdfChromeHeights, pdfLayout } from "../layout.js";
import {
  type StageplanRenderOptions,
  resolveStageplanRenderOptions,
} from "../stageplanRenderOptions.js";

const MM_TO_PT = 72 / 25.4;

function ptToMm(pt: number): number {
  return pt / MM_TO_PT;
}

function pxToMm(px: number): number {
  return ptToMm(px * 0.75); // 1px = 0.75pt (96px = 72pt)
}

const containerMarginTopPt = 24;
const containerPadPt = 24;
/** .stageplanContainer border-width — konstanta pro styles.ts i pro rozpočet. */
const containerBorderPx = 1;
const captionGapPt = 4;
/**
 * Řádek popisku rozměru pódia se rezervuje vždy, i když se rozměr netiskne —
 * jinak by měřítko plánu záviselo na tom, jestli uživatel rozměr vyplnil (R6).
 */
const captionHeightPt =
  parsePt(pdfLayout.typography.tableHead.size) *
    pdfLayout.typography.tableHead.lineHeight +
  captionGapPt;

/**
 * Finding 1 (F4): .stageplanContainer je inline-block, takže když areaWidthMm
 * nesedí s paddingem a rámečkem, je kontejner širší než tiskové zrcadlo a
 * Chromium na to reaguje tichým zmenšením *celého* dokumentu. Odvozovat, ne
 * opisovat.
 */
const areaWidthMm =
  pdfLayout.page.contentWidthMm -
  2 * ptToMm(containerPadPt) -
  2 * pxToMm(containerBorderPx);

const availableHeightMm =
  pdfLayout.page.contentHeightMm -
  pdfChromeHeights.headerMm -
  pdfChromeHeights.footerMm;

const areaHeightMm =
  availableHeightMm -
  ptToMm(containerMarginTopPt) -
  2 * ptToMm(containerPadPt) -
  2 * pxToMm(containerBorderPx) -
  ptToMm(captionHeightPt);

/**
 * Šířka dnešního čtyřsloupcového boxu. Není to odhad — je to geometrie, o
 * které z dosavadního exportu víme, že se do ní odrážky při 8 pt vejdou (R3).
 */
const minBoxWidthMm = (areaWidthMm - 2 * 2 - 3 * 4.5) / 4;

const bulletSpacingPx = 4;

const printTypography: PrintTypography = {
  fontSizePt: parsePt(pdfLayout.typography.table.size) - 1,
  lineHeight: 1.25,
  titleGapPt: 6,
  padBottomPt: parsePt(pdfLayout.table.padY),
  minBoxWidthMm,
};

/** Co potřebuje editor, aby si tiskovou stopu spočítal stejnou funkcí (R12). */
export const stageplanPrintGeometry = {
  area: { widthMm: areaWidthMm, heightMm: areaHeightMm },
  typography: printTypography,
} as const;

/** Konstanty pro styles.ts — CSS a rozpočet se nesmí rozejít. */
export const stageplanLayout = {
  containerMarginTop: `${containerMarginTopPt}pt`,
  containerPad: `${containerPadPt}pt`,
  containerBorderPx,
  areaWidthMm,
  areaHeightMm,
  captionGap: `${captionGapPt}pt`,
  captionSize: pdfLayout.typography.tableHead.size,
  captionTracking: pdfLayout.typography.tableHead.tracking,
  padX: pdfLayout.table.padX,
  padY: pdfLayout.table.padY,
  boxTitleGap: `${printTypography.titleGapPt}pt`,
  boxPaddingBottom: `${printTypography.padBottomPt}pt`,
  textSize: `${printTypography.fontSizePt}pt`,
  textLineHeight: printTypography.lineHeight,
  bulletSpacingPx,
} as const;

export type StageplanBoxPlan = StageplanPrintBox & {
  /** Levý horní roh neotočeného boxu v souřadnicích kontejneru. */
  readonly xMm: number;
  readonly yMm: number;
  readonly widthMm: number;
  readonly heightMm: number;
  readonly rotationDeg: number;
  readonly isLeadVocal: boolean;
};

export type StageplanPlan = {
  readonly container: { readonly widthMm: number; readonly heightMm: number };
  readonly stage: {
    readonly xMm: number;
    readonly yMm: number;
    readonly widthMm: number;
    readonly heightMm: number;
    readonly caption: string | null;
  };
  readonly typography: PrintTypography & { readonly bulletSpacingPx: number };
  readonly boxes: readonly StageplanBoxPlan[];
};

function formatStageCaption(stage: StageplanStageSize | null): string | null {
  if (!stage) return null;
  const format = (value: number) => value.toFixed(1).replace(".", ",");
  return `PÓDIUM ${format(stage.widthM)} × ${format(stage.depthM)} m`;
}

export function buildStageplanPlan(
  vm: DocumentViewModel["stageplan"],
  options?: Partial<StageplanRenderOptions>,
): StageplanPlan {
  const resolvedOptions = resolveStageplanRenderOptions(options);
  const printModel = buildPdfStageplanPrintModel(vm, {
    hideMusicianNames: resolvedOptions.hideMusicianNames,
  });
  const scale = createPrintScale(vm.layout.stage, stageplanPrintGeometry.area);

  const rects: PrintRect[] = vm.layout.blocks.map((block) => {
    const printBox = printModel.boxesBySlot[block.slot];
    const footprint = computePrintFootprintMm({
      lineCount: countStageplanBoxLines(printBox),
      hasPower: printBox.hasPowerBadge,
      zone: block,
      mmPerM: scale.mmPerM,
      typography: printTypography,
    });

    return {
      slot: block.slot,
      centerXMm: scale.toMm(block.centerXM),
      centerYMm: scale.toMm(block.centerYM),
      widthMm: footprint.widthMm,
      heightMm: footprint.heightMm,
      rotationDeg: block.rotationDeg,
    };
  });

  const collisions = findPrintCollisions(rects);
  if (collisions.length > 0) {
    const pairs = collisions.map(([a, b]) => `${a} × ${b}`).join(", ");
    throw new Error(
      `Stageplan print collision: ${pairs}. Bloky se na papíře překrývají — přerovnej rozmístění v editoru.`,
    );
  }

  // Union bbox rámu pódia a všech boxů. Přerostlý box nesmí kontejner rozšířit
  // nad zrcadlo, jinak Chromium zmenší celý dokument (past z F4).
  let minXMm = 0;
  let minYMm = 0;
  let maxXMm = scale.planWidthMm;
  let maxYMm = scale.planHeightMm;
  for (const rect of rects) {
    const aabb = rectAabbMm(rect);
    minXMm = Math.min(minXMm, aabb.minXMm);
    minYMm = Math.min(minYMm, aabb.minYMm);
    maxXMm = Math.max(maxXMm, aabb.maxXMm);
    maxYMm = Math.max(maxYMm, aabb.maxYMm);
  }

  const container = { widthMm: maxXMm - minXMm, heightMm: maxYMm - minYMm };
  if (container.widthMm > areaWidthMm || container.heightMm > areaHeightMm) {
    throw new Error(
      `Stageplan layout overflow: required ${container.widthMm.toFixed(2)} × ${container.heightMm.toFixed(2)}mm exceeds available ${areaWidthMm.toFixed(2)} × ${areaHeightMm.toFixed(2)}mm.`,
    );
  }

  return {
    container,
    stage: {
      xMm: -minXMm,
      yMm: -minYMm,
      widthMm: scale.planWidthMm,
      heightMm: scale.planHeightMm,
      caption: formatStageCaption(vm.layout.stage),
    },
    typography: { ...printTypography, bulletSpacingPx },
    boxes: rects.map((rect) => {
      const printBox = printModel.boxesBySlot[rect.slot];
      return {
        ...printBox,
        xMm: rect.centerXMm - minXMm - rect.widthMm / 2,
        yMm: rect.centerYMm - minYMm - rect.heightMm / 2,
        widthMm: rect.widthMm,
        heightMm: rect.heightMm,
        rotationDeg: rect.rotationDeg,
        isLeadVocal:
          rect.slot === "lead_voc_1" || rect.slot === "lead_voc_2",
      };
    }),
  };
}

function renderBox(
  box: StageplanBoxPlan,
  typography: StageplanPlan["typography"],
): string {
  const lines: string[] = [
    `<div class="stageplanBoxHeader">${box.header}</div>`,
  ];

  const hasBody =
    box.inputBullets.length > 0 ||
    box.monitorBullets.length > 0 ||
    box.extraBullets.length > 0;
  if (hasBody) lines.push(`<div class="stageplanTitleGap"></div>`);

  const addBullets = (bullets: string[]) => {
    for (const bullet of bullets) {
      lines.push(
        `<div class="stageplanBoxLine"><span class="bullet" style="margin-right:${typography.bulletSpacingPx}px;">•</span><span class="text">${bullet}</span></div>`,
      );
    }
  };

  addBullets(box.inputBullets);
  if (box.monitorBullets.length > 0) {
    if (box.inputBullets.length > 0)
      lines.push(`<div class="stageplanGap"></div>`);
    addBullets(box.monitorBullets);
  }
  if (box.extraBullets.length > 0) {
    if (box.monitorBullets.length > 0 || box.inputBullets.length > 0)
      lines.push(`<div class="stageplanGap"></div>`);
    addBullets(box.extraBullets);
  }
  // Napájení je řádek v toku, ne badge v rohu — výška boxu s ním počítá (R5).
  if (box.hasPowerBadge) {
    lines.push(`<div class="stageplanPower">${box.powerBadgeText}</div>`);
  }

  const leadClass = box.isLeadVocal ? " stageplanBox--lead" : "";
  return `<div class="stageplanBox${leadClass}" style="left:${box.xMm}mm; top:${box.yMm}mm; width:${box.widthMm}mm; height:${box.heightMm}mm; transform:rotate(${box.rotationDeg}deg);">${lines.join("")}</div>`;
}

export function renderStageplanSection(
  vm: DocumentViewModel,
  options?: Partial<StageplanRenderOptions>,
): string {
  const plan = buildStageplanPlan(vm.stageplan, options);
  const boxesHtml = plan.boxes
    .map((box) => renderBox(box, plan.typography))
    .join("\n");

  return `
<section class="stageplanSection">\n  <div class="stageplanCaption">${plan.stage.caption ?? ""}</div>\n  <div class="stageplanContainer" style="width:${plan.container.widthMm}mm; height:${plan.container.heightMm}mm;">\n    <div class="stageplanStage" style="left:${plan.stage.xMm}mm; top:${plan.stage.yMm}mm; width:${plan.stage.widthMm}mm; height:${plan.stage.heightMm}mm;">\n      <div class="stageplanDownstage">DOWNSTAGE · PUBLIKUM</div>\n    </div>\n    ${boxesHtml}\n  </div>\n</section>`.trim();
}
```

- [ ] **Step 4: Keep styles.ts compiling with the new constants**

V `src/infra/pdf/styles.ts` uprav blok stage planu tak, aby nesahal na zaniklé konstanty (barvy a nová kresba přijdou v Tasku 7 — teď jde jen o to, aby se sestavil a napájení bylo v toku):

```css
.stageplanContainer {
  position: relative;
  display: inline-block;
  margin-top: ${stageplanLayout.containerMarginTop};
  padding: ${stageplanLayout.containerPad};
  background: #fff;
  border: ${stageplanLayout.containerBorderPx}px solid ${pdfTokens.line};
}

.stageplanStage {
  position: absolute;
  border: ${stageplanLayout.containerBorderPx}px solid ${pdfTokens.line};
}

.stageplanBox {
  position: absolute;
  transform-origin: center;
  border: 2px solid var(--c-line);
  background: #fff;
  padding: 0 ${stageplanLayout.padX} ${stageplanLayout.boxPaddingBottom};
  padding-top: ${stageplanLayout.boxTitleGap};
  font-size: ${stageplanLayout.textSize};
  line-height: ${stageplanLayout.textLineHeight};
}

.stageplanTitleGap {
  height: ${stageplanLayout.boxTitleGap};
}

.stageplanGap {
  height: calc(1em * ${stageplanLayout.textLineHeight});
}
```

Smaž pravidla `.stageplanArea`, `.stageplanBox--withPower`, `.stageplanPowerGap` a absolutní pozicování v `.stageplanPower`; z `.stageplanPower` nech jen `white-space: nowrap;`. Pravidla `.stageplanSection`, `.stageplanBoxHeader`, `.stageplanBoxLine`, `.bullet`, `.text` zůstávají.

- [ ] **Step 5: Fix the template test, which reads the old plan shape**

V `src/infra/pdf/template.test.ts` (dnes řádky 103–108) nahraď smyčku:

```ts
      const plan = buildStageplanPlan(vm.stageplan);
      for (const box of plan.boxes) {
        expect(page2Html).toContain(`left:${box.xMm}mm; top:${box.yMm}mm;`);
      }
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run src/infra/pdf/sections/stageplan.test.ts src/infra/pdf/styles.test.ts src/infra/pdf/template.test.ts`
Expected: PASS — 8 nových testů sekce a existující testy stylů i šablony

- [ ] **Step 7: Type-check, lint and commit**

```bash
npx tsc --noEmit -p tsconfig.json
npx biome check src/infra/pdf/sections/stageplan.ts src/infra/pdf/sections/stageplan.test.ts src/infra/pdf/styles.ts src/infra/pdf/template.test.ts
git add src/infra/pdf/sections/stageplan.ts src/infra/pdf/sections/stageplan.test.ts src/infra/pdf/styles.ts src/infra/pdf/template.test.ts
git commit -m "feat(pdf): draw stageplan blocks from the saved layout instead of fixed rows"
```

---

### Task 7: Nová kresba bloku, rám a popisek

**Files:**
- Modify: `src/infra/pdf/styles.ts`
- Test: `src/infra/pdf/styles.test.ts`, `src/infra/pdf/sections/stageplan.test.ts` (přidat tvrzení o kresbě)

**Interfaces:**
- Consumes: `stageplanLayout`, `pdfTokens` (z `../layout.js`), třídy `stageplanBox--lead`, `stageplanPower`, `stageplanStage`, `stageplanDownstage`, `stageplanCaption` z Tasku 6.
- Produces: žádné nové exporty — jen finální CSS.

- [ ] **Step 1: Write the failing tests**

Do `src/infra/pdf/styles.test.ts` přidej:

```ts
  it("draws stageplan blocks in the F5b identity", () => {
    // R5: 1px ink bez radiusu, inverzní lead vokál, oranžové napájení.
    expect(pdfStyles).toContain(`border: 1px solid ${pdfTokens.ink}`);
    expect(pdfStyles).toMatch(
      /\.stageplanBox--lead\s*\{[^}]*background:\s*#101112/,
    );
    expect(pdfStyles).toMatch(/\.stageplanBox--lead\s*\{[^}]*color:\s*#fff/i);
    expect(pdfStyles).toMatch(
      /\.stageplanPower\s*\{[^}]*color:\s*#ff5b1f/i,
    );
    expect(pdfStyles).not.toContain("#F7E65A");
    expect(pdfStyles).not.toContain(".stageplanPowerGap");
  });

  it("keeps the downstage strip and the stage caption legible", () => {
    expect(pdfStyles).toMatch(/\.stageplanDownstage\s*\{[^}]*bottom:\s*0/);
    expect(pdfStyles).toMatch(
      /\.stageplanCaption\s*\{[^}]*letter-spacing:\s*0\.14em/,
    );
  });
```

Pokud `styles.test.ts` ještě neimportuje `pdfTokens`, přidej `import { pdfTokens } from "./layout.js";`.

Do `src/infra/pdf/sections/stageplan.test.ts` přidej:

```ts
  it("marks the lead vocal box and renders power as a line", () => {
    const html = renderStageplanSection({
      stageplan: emptyStageplan({
        stage: null,
        blocks: [
          {
            slot: "lead_voc_1",
            centerXM: 6,
            centerYM: 5.5,
            widthM: 2.6,
            depthM: 1.2,
            rotationDeg: 0,
          },
        ],
      }),
    } as unknown as DocumentViewModel);

    expect(html).toContain("stageplanBox--lead");
    expect(html).toContain("DOWNSTAGE · PUBLIKUM");
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/infra/pdf/styles.test.ts src/infra/pdf/sections/stageplan.test.ts`
Expected: FAIL — `border: 1px solid #101112` v CSS není, `.stageplanCaption` nemá letter-spacing

- [ ] **Step 3: Write the final CSS**

V `src/infra/pdf/styles.ts` nahraď blok stage planu (od `.stageplanSection` po `.stageplanPower`) tímto:

```css
.stageplanSection {
  text-align: center;
}

.stageplanCaption {
  /* Výška je jeden řádek popisku vždy, i když je prázdný — měřítko plánu na
     tom stojí (R6). */
  height: ${stageplanLayout.captionSize};
  line-height: 1;
  margin-bottom: ${stageplanLayout.captionGap};
  font-family: '${pdfLayout.typography.monoFamily}', Consolas, monospace;
  font-size: ${stageplanLayout.captionSize};
  letter-spacing: ${stageplanLayout.captionTracking};
  color: ${pdfTokens.steel};
  text-align: center;
}

.stageplanContainer {
  position: relative;
  display: inline-block;
  margin-top: ${stageplanLayout.containerMarginTop};
  padding: ${stageplanLayout.containerPad};
  background: #fff;
  border: ${stageplanLayout.containerBorderPx}px solid ${pdfTokens.line};
}

/* Rám ohraničuje plochu pódia — orientaci na papíře nese on a pruh dole (R6). */
.stageplanStage {
  position: absolute;
  border: ${stageplanLayout.containerBorderPx}px solid ${pdfTokens.line};
}

.stageplanDownstage {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 1pt 0;
  font-family: '${pdfLayout.typography.monoFamily}', Consolas, monospace;
  font-size: ${pdfLayout.typography.footer.size};
  letter-spacing: 0.2em;
  color: ${pdfTokens.steel};
  text-align: center;
}

.stageplanBox {
  position: absolute;
  transform-origin: center;
  border: 1px solid ${pdfTokens.ink};
  background: #fff;
  padding: 0 ${stageplanLayout.padX} ${stageplanLayout.boxPaddingBottom};
  padding-top: ${stageplanLayout.boxTitleGap};
  font-size: ${stageplanLayout.textSize};
  line-height: ${stageplanLayout.textLineHeight};
  overflow: hidden;
}

/* Lead vokál je jediný plný blok — handoff řádek 125. */
.stageplanBox--lead {
  background: ${pdfTokens.ink};
  color: #fff;
}

.stageplanBoxHeader {
  font-weight: 700;
  margin: 0;
  padding-top: 0;
  text-align: center;
}

.stageplanTitleGap {
  height: ${stageplanLayout.boxTitleGap};
}

.stageplanBoxLine {
  margin: 0;
  text-align: center;
  white-space: normal;
  word-break: break-word;
}

.stageplanBoxLine .bullet {
  display: inline-block;
  margin-right: ${stageplanLayout.bulletSpacingPx}px;
}

.stageplanBoxLine .text {
  display: inline-block;
}

.stageplanGap {
  height: calc(1em * ${stageplanLayout.textLineHeight});
}

/* Napájení je jediná barva na stránce (handoff řádek 123). */
.stageplanPower {
  font-weight: 600;
  color: ${pdfTokens.signal};
  text-align: center;
  white-space: nowrap;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/infra/pdf/styles.test.ts src/infra/pdf/sections/stageplan.test.ts src/infra/pdf/tokens.test.ts`
Expected: PASS — nová tvrzení projdou, kontrolní test tokenů zůstane zelený

- [ ] **Step 5: Lint and commit**

```bash
npx biome check src/infra/pdf/styles.ts src/infra/pdf/styles.test.ts src/infra/pdf/sections/stageplan.test.ts
git add src/infra/pdf/styles.ts src/infra/pdf/styles.test.ts src/infra/pdf/sections/stageplan.test.ts
git commit -m "feat(pdf): redraw stageplan blocks with the F5b identity"
```

---

### Task 8: Regrese výchozího rozmístění a render celého PDF

**Files:**
- Create: `src/infra/pdf/sections/stageplan.regression.test.ts`
- Test: `src/infra/pdf/pdf.test.ts` (jen spustit, neměnit)

**Interfaces:**
- Consumes: `buildDefaultLayout` + `NOMINAL_STAGE` z `src/domain/stageplan/layout/defaultLayout.ts`, `buildStageplanPlan` (Task 6), `countStageplanBoxLines` (Task 2).
- Produces: nic — je to pojistka proti tomu, aby existující projekty po upgradu nešly vytisknout.

- [ ] **Step 1: Write the failing test**

Vytvoř `src/infra/pdf/sections/stageplan.regression.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type {
  DocumentViewModel,
  StageplanBlockSlot,
} from "../../../domain/model/types.js";
import { buildDefaultLayout } from "../../../domain/stageplan/layout/defaultLayout.js";
import { buildStageplanPlan } from "./stageplan.js";

/**
 * Nejhorší reálný obsah: bicí s deseti odrážkami a napájením u každé role.
 * Kdyby výchozí rozmístění kolidovalo, existující projekty by po upgradu
 * přestaly jít vytisknout.
 */
function stageplanWithFullBoxes(
  slots: readonly StageplanBlockSlot[],
): DocumentViewModel["stageplan"] {
  const layout = buildDefaultLayout({ slots, stage: null });
  const inputs = Array.from({ length: 10 }, (_, index) => ({
    channelNo: index + 1,
    label: `Drums ${index + 1}`,
    group: "drums" as const,
    ownerRole: "drums" as const,
  }));

  return {
    layout,
    lineupByRole: {
      drums: { firstName: "Pavel", isBandLeader: false },
      bass: { firstName: "Matej", isBandLeader: true },
      guitar: { firstName: "Karel", isBandLeader: false },
      keys: { firstName: "Klara", isBandLeader: false },
      vocs: { firstName: "Eva", isBandLeader: false },
    },
    leadVocals: slots.includes("lead_voc_2")
      ? [
          { firstName: "Eva", isBandLeader: false },
          { firstName: "Jana", isBandLeader: false },
        ]
      : [{ firstName: "Eva", isBandLeader: false }],
    inputs,
    monitorOutputs: [],
    powerByRole: {
      drums: { hasPowerBadge: true, powerBadgeText: "2x 230 V" },
      bass: { hasPowerBadge: true, powerBadgeText: "2x 230 V" },
      guitar: { hasPowerBadge: true, powerBadgeText: "2x 230 V" },
      keys: { hasPowerBadge: true, powerBadgeText: "2x 230 V" },
      vocs: { hasPowerBadge: true, powerBadgeText: "2x 230 V" },
    },
  };
}

describe("default arrangement stays printable", () => {
  const FIVE = [
    "drums",
    "bass",
    "guitar",
    "keys",
    "lead_voc_1",
  ] as const satisfies readonly StageplanBlockSlot[];
  const SIX = [...FIVE, "lead_voc_2"] as const satisfies readonly StageplanBlockSlot[];

  it("prints five blocks without a collision or an overflow", () => {
    // buildStageplanPlan hází při kolizi i při přetečení — tohle je ta pojistka.
    expect(() =>
      buildStageplanPlan(stageplanWithFullBoxes(FIVE)),
    ).not.toThrow();

    const plan = buildStageplanPlan(stageplanWithFullBoxes(FIVE));
    expect(plan.boxes).toHaveLength(5);
    expect(plan.container.widthMm).toBeLessThanOrEqual(162.5375);
    expect(plan.container.heightMm).toBeLessThanOrEqual(202.0914);
  });

  it("prints six blocks without a collision or an overflow", () => {
    expect(() => buildStageplanPlan(stageplanWithFullBoxes(SIX))).not.toThrow();

    const plan = buildStageplanPlan(stageplanWithFullBoxes(SIX));
    expect(plan.boxes).toHaveLength(6);
    expect(plan.container.widthMm).toBeLessThanOrEqual(162.5375);
    expect(plan.container.heightMm).toBeLessThanOrEqual(202.0914);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run src/infra/pdf/sections/stageplan.regression.test.ts`
Expected: PASS. **Když spadne na kolizi**, je to skutečný nález, ne chyba testu: uveď v hlášení, které bloky kolidují a o kolik milimetrů, a zastav se — řešení (menší rozteč výchozích pozic, jiná typografie) je rozhodnutí pro zadavatele, ne pro implementaci.

- [ ] **Step 3: Render a real PDF end to end**

Run: `npx vitest run src/infra/pdf/pdf.test.ts`
Expected: PASS — test spouští skutečné Chromium přes strategii `system-browser:chrome-channel` a kontroluje počet stran i přetečení. Pokud selže na chybějícím prohlížeči, uveď to v hlášení jako neověřený bod, ne jako regresi.

- [ ] **Step 4: Run the whole suite and compare with the baseline**

Run: `npm test`
Expected: jen dvě známá selhání (`assetsPaths`, `repoAssets`); počet prošlých testů vzroste. Rozdíl uveď v hlášení.

- [ ] **Step 5: Lint and commit**

```bash
npx biome check src/infra/pdf/sections/stageplan.regression.test.ts
git add src/infra/pdf/sections/stageplan.regression.test.ts
git commit -m "test(pdf): guard that the default arrangement stays printable"
```

---

### Task 9: Metriky pro editor — doména, skript, Tauri příkaz

**Files:**
- Create: `src/domain/stageplan/print/printMetrics.ts`
- Create: `src/domain/pipeline/pdf/buildStageplanPrintMetrics.ts`
- Test: `src/domain/pipeline/pdf/buildStageplanPrintMetrics.test.ts`
- Create: `scripts/stageplan_print_metrics.ts`
- Modify: `packages/desktop/src-tauri/src/lib.rs` (nový příkaz + registrace v `invoke_handler`)

**Interfaces:**
- Consumes: `countStageplanBoxLines` (Task 2), `PrintTypography` + `PrintArea` (Tasky 1 a 3), `vm.stageplan.layout` (Task 5), `stageplanPrintGeometry` (Task 6).
- Produces: typy `StageplanPrintBlockMetric = { slot, lineCount, hasPower }` a `StageplanPrintGeometry = { area, typography, blocks }`, funkce `buildStageplanPrintMetrics(vm.stageplan): StageplanPrintBlockMetric[]`, Tauri příkaz `build_stageplan_print_metrics` s argumentem `projectId`.

- [ ] **Step 1: Write the failing test**

Vytvoř `src/domain/pipeline/pdf/buildStageplanPrintMetrics.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { DocumentViewModel } from "../../model/types.js";
import { buildStageplanPrintMetrics } from "./buildStageplanPrintMetrics.js";

const stageplan: DocumentViewModel["stageplan"] = {
  layout: {
    stage: null,
    blocks: [
      {
        slot: "drums",
        centerXM: 6,
        centerYM: 1.2,
        widthM: 2.8,
        depthM: 1.6,
        rotationDeg: 0,
      },
      {
        slot: "bass",
        centerXM: 9.4,
        centerYM: 1.2,
        widthM: 2.7,
        depthM: 1.4,
        rotationDeg: 0,
      },
    ],
  },
  lineupByRole: {
    drums: { firstName: "Pavel", isBandLeader: false },
    bass: { firstName: "Matej", isBandLeader: false },
  },
  leadVocals: [],
  inputs: [
    { channelNo: 1, label: "Kick in", group: "drums", ownerRole: "drums" },
    { channelNo: 2, label: "Snare top", group: "drums", ownerRole: "drums" },
    { channelNo: 9, label: "Bass XLR", group: "bass", ownerRole: "bass" },
  ],
  monitorOutputs: [],
  powerByRole: {
    drums: { hasPowerBadge: false, powerBadgeText: "" },
    bass: { hasPowerBadge: true, powerBadgeText: "2x 230 V" },
  },
};

describe("buildStageplanPrintMetrics", () => {
  it("reports one metric per block in layout order", () => {
    const metrics = buildStageplanPrintMetrics(stageplan);

    expect(metrics.map((metric) => metric.slot)).toEqual(["drums", "bass"]);
  });

  it("carries the line count and the power flag of each block", () => {
    const metrics = buildStageplanPrintMetrics(stageplan);

    expect(metrics[0]).toEqual({
      slot: "drums",
      lineCount: 1,
      hasPower: false,
    });
    expect(metrics[1]).toEqual({
      slot: "bass",
      lineCount: 1,
      hasPower: true,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/pipeline/pdf/buildStageplanPrintMetrics.test.ts`
Expected: FAIL — soubor `./buildStageplanPrintMetrics.js` neexistuje

- [ ] **Step 3: Write the types and the builder**

Vytvoř `src/domain/stageplan/print/printMetrics.ts`:

```ts
import type { StageplanBlockSlot } from "../../model/types.js";
import type { PrintTypography } from "./printFootprint.js";
import type { PrintArea } from "./printScale.js";

export type StageplanPrintBlockMetric = {
  readonly slot: StageplanBlockSlot;
  readonly lineCount: number;
  readonly hasPower: boolean;
};

/**
 * Co editor potřebuje, aby si tiskovou stopu spočítal stejnou funkcí jako tisk.
 * Plocha a typografie jdou v odpovědi s sebou, aby okno nemuselo importovat
 * konstanty z infra vrstvy (R12).
 */
export type StageplanPrintGeometry = {
  readonly area: PrintArea;
  readonly typography: PrintTypography;
  readonly blocks: readonly StageplanPrintBlockMetric[];
};
```

Vytvoř `src/domain/pipeline/pdf/buildStageplanPrintMetrics.ts`:

```ts
import type { DocumentViewModel } from "../../model/types.js";
import type { StageplanPrintBlockMetric } from "../../stageplan/print/printMetrics.js";
import { buildPdfStageplanPrintModel } from "./buildPdfStageplanPrintModel.js";
import { countStageplanBoxLines } from "./countStageplanBoxLines.js";

/** Metriky pokrývají právě bloky z layoutu — editor kreslí stopu jen k nim. */
export function buildStageplanPrintMetrics(
  vm: DocumentViewModel["stageplan"],
): StageplanPrintBlockMetric[] {
  const printModel = buildPdfStageplanPrintModel(vm);

  return vm.layout.blocks.map((block) => {
    const printBox = printModel.boxesBySlot[block.slot];
    return {
      slot: block.slot,
      lineCount: countStageplanBoxLines(printBox),
      hasPower: printBox.hasPowerBadge,
    };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/pipeline/pdf/buildStageplanPrintMetrics.test.ts`
Expected: PASS — 2 testy

- [ ] **Step 5: Write the node script**

Vytvoř `scripts/stageplan_print_metrics.ts`:

```ts
import { Console } from "node:console";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { argv, exit } from "node:process";
import { pathToFileURL } from "node:url";
import { normalizeProject } from "../src/app/usecases/normalizeProject.js";
import type { ProjectJson } from "../src/domain/model/types.js";
import { buildDocument } from "../src/domain/pipeline/buildDocument.js";
import { buildStageplanPrintMetrics } from "../src/domain/pipeline/pdf/buildStageplanPrintMetrics.js";
import type { StageplanPrintGeometry } from "../src/domain/stageplan/print/printMetrics.js";
import { loadJsonFile } from "../src/infra/fs/loadJson.js";
import { loadRepository } from "../src/infra/fs/repo.js";
import { stageplanPrintGeometry } from "../src/infra/pdf/sections/stageplan.js";

type Args = { projectId: string; userDataDir: string };
type ErrorPayload = { message: string; stack?: string; phase: string };
type Response =
  | { ok: true; result: StageplanPrintGeometry }
  | { ok: false; code: string; message: string; error: ErrorPayload };
type ScriptIo = { stdout: NodeJS.WriteStream; stderr: NodeJS.WriteStream };
type MetricsLogger = (message: string, details?: unknown) => void;

function parseArgs(args: string[]): Args {
  const projectIdIndex = args.indexOf("--project-id");
  const userDataIndex = args.indexOf("--user-data-dir");
  if (projectIdIndex === -1 || userDataIndex === -1)
    throw new Error("Missing required args: --project-id and --user-data-dir");
  const projectId = args[projectIdIndex + 1];
  const userDataDir = args[userDataIndex + 1];
  if (!projectId || !userDataDir)
    throw new Error("Invalid args: project-id or user-data-dir missing");
  return { projectId, userDataDir };
}

async function resolveProjectPathById(
  projectsDir: string,
  projectId: string,
): Promise<string> {
  const files = await readdir(projectsDir);
  for (const fileName of files) {
    if (!fileName.endsWith(".json")) continue;
    const candidatePath = path.join(projectsDir, fileName);
    const json = await loadJsonFile<ProjectJson>(candidatePath);
    if (json.id === projectId) return candidatePath;
  }
  throw new Error(`Project not found: ${projectId}`);
}

async function run(args: string[], log: MetricsLogger): Promise<Response> {
  const { projectId, userDataDir } = parseArgs(args);
  log("[stageplan-metrics] start", { projectId });

  const projectsDir = path.join(userDataDir, "projects");
  const projectPath = await resolveProjectPathById(projectsDir, projectId);
  const rawProject = await loadJsonFile<ProjectJson>(projectPath);
  const project = normalizeProject(rawProject);

  log("[stageplan-metrics] load repository");
  const repo = await loadRepository({ userDataRoot: userDataDir });

  log("[stageplan-metrics] buildDocument");
  const vm = buildDocument(project, repo);

  return {
    ok: true,
    result: {
      area: stageplanPrintGeometry.area,
      typography: stageplanPrintGeometry.typography,
      blocks: buildStageplanPrintMetrics(vm.stageplan),
    },
  };
}

function writeJsonPayload(io: ScriptIo, response: Response): void {
  io.stdout.write(`${JSON.stringify(response)}\n`);
}

function toErrorResponse(err: unknown, phase: string): Response {
  const message = err instanceof Error ? err.message : "Unknown metrics error";
  return {
    ok: false,
    code: "STAGEPLAN_METRICS_FAILED",
    message,
    error: {
      message,
      stack: err instanceof Error ? err.stack : undefined,
      phase,
    },
  };
}

export async function main(
  args: string[] = argv.slice(2),
  io: ScriptIo = { stdout: process.stdout, stderr: process.stderr },
  runner: (runArgs: string[], log: MetricsLogger) => Promise<Response> = run,
): Promise<number> {
  const scriptConsole = new Console({ stdout: io.stdout, stderr: io.stderr });
  let phase = "start";
  const log: MetricsLogger = (message, details) => {
    const match = /^\[stageplan-metrics\]\s+(.+)$/.exec(message);
    if (match?.[1]) phase = match[1];
    if (details === undefined) {
      scriptConsole.error(message);
      return;
    }
    scriptConsole.error(message, details);
  };

  try {
    writeJsonPayload(io, await runner(args, log));
    return 0;
  } catch (err) {
    writeJsonPayload(io, toErrorResponse(err, phase));
    return 0;
  }
}

export function isExecutedAsMainModule(
  argvEntryPoint: string | undefined = process.argv[1],
  moduleUrl: string = import.meta.url,
): boolean {
  if (!argvEntryPoint) return false;
  return moduleUrl === pathToFileURL(argvEntryPoint).href;
}

if (isExecutedAsMainModule()) {
  main()
    .then((code) => exit(code))
    .catch(() => exit(0));
}
```

- [ ] **Step 6: Add the Tauri command**

V `packages/desktop/src-tauri/src/lib.rs` přidej vedle `build_project_pdf_preview` (kolem řádku 1360):

```rust
#[tauri::command]
fn build_stageplan_print_metrics(
    app: tauri::AppHandle,
    project_id: String,
) -> Result<Value, ApiError> {
    let user_data_dir = stagepilot_user_data_dir(&app).map_err(|err| {
        map_storage_error(
            err,
            "STAGEPLAN_METRICS_FAILED",
            "Failed to resolve user storage root",
        )
    })?;
    let workspace_root = resolve_workspace_root();
    let script_path = workspace_root
        .join("scripts")
        .join("stageplan_print_metrics.ts");

    let output = Command::new("node")
        .arg("--import")
        .arg("tsx")
        .arg(script_path.as_os_str())
        .arg("--project-id")
        .arg(&project_id)
        .arg("--user-data-dir")
        .arg(user_data_dir.as_os_str())
        .current_dir(&workspace_root)
        .output()
        .map_err(|err| {
            map_io_error(
                err,
                "STAGEPLAN_METRICS_FAILED",
                "Failed to execute stageplan metrics",
            )
        })?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let response = parse_node_export_response(&stdout, &stderr).map_err(|err| ApiError {
        code: "STAGEPLAN_METRICS_FAILED".into(),
        message: err.message,
        export_pdf_path: None,
        version_pdf_path: None,
    })?;

    if response.ok {
        if let Some(result) = response.result {
            return Ok(result);
        }
    }

    Err(ApiError {
        code: "STAGEPLAN_METRICS_FAILED".into(),
        message: response
            .message
            .unwrap_or_else(|| "Stageplan metrics command failed.".into()),
        export_pdf_path: None,
        version_pdf_path: None,
    })
}
```

A do `tauri::generate_handler![...]` (řádek ~1917) přidej `build_stageplan_print_metrics,` hned za `build_project_pdf_preview,`.

- [ ] **Step 7: Verify the script runs against real data**

Run (dosaď skutečné `id` projektu z `%APPDATA%/StagePilot/projects`):

```bash
node --import tsx scripts/stageplan_print_metrics.ts --project-id <id> --user-data-dir "$APPDATA/StagePilot"
```

Expected: jednořádkový JSON `{"ok":true,"result":{"area":{...},"typography":{...},"blocks":[...]}}` na stdout, logy na stderr. Rust příkaz se automaticky netestuje (stejný precedens má `build_project_pdf_preview`).

- [ ] **Step 8: Type-check, lint and commit**

```bash
npx tsc --noEmit -p tsconfig.json
npx biome check src/domain/stageplan/print/printMetrics.ts src/domain/pipeline/pdf/buildStageplanPrintMetrics.ts src/domain/pipeline/pdf/buildStageplanPrintMetrics.test.ts scripts/stageplan_print_metrics.ts
cargo fmt --manifest-path packages/desktop/src-tauri/Cargo.toml
git add src/domain/stageplan/print/printMetrics.ts src/domain/pipeline/pdf/buildStageplanPrintMetrics.ts src/domain/pipeline/pdf/buildStageplanPrintMetrics.test.ts scripts/stageplan_print_metrics.ts packages/desktop/src-tauri/src/lib.rs
git commit -m "feat(stageplan): expose printed line counts to the editor via a lightweight command"
```

---

### Task 10: Editor kreslí tiskovou stopu

**Files:**
- Create: `packages/desktop/src/app/services/stageplanMetrics.ts`
- Modify: `packages/desktop/src/app/services/tauriCommands.ts`
- Modify: `packages/desktop/src/app/pages/StagePlanEditorPage.tsx`
- Modify: `packages/desktop/src/app/components/stageplan/StageCanvas.tsx`
- Modify: `packages/desktop/src/app/components/stageplan/StageBlock.tsx`
- Modify: `packages/desktop/src/app/components/stageplan/EditorFooter.tsx`
- Modify: `packages/desktop/src/styles/features/stageplan-editor.css`

**Interfaces:**
- Consumes: `StageplanPrintGeometry` (Task 9), `createPrintScale` (Task 1), `computePrintFootprintMm` (Task 3), příkaz `build_stageplan_print_metrics` (Task 9).
- Produces: `fetchStageplanPrintGeometry(projectId): Promise<StageplanPrintGeometry>`, prop `printGeometry` na `StageCanvas`, prop `printFootprint` na `StageBlock`.

- [ ] **Step 1: Add the command name and the service**

Do `packages/desktop/src/app/services/tauriCommands.ts` přidej do objektu:

```ts
  STAGEPLAN_PRINT_METRICS: "build_stageplan_print_metrics",
```

Vytvoř `packages/desktop/src/app/services/stageplanMetrics.ts`:

```ts
import { invoke } from "@tauri-apps/api/core";
import type { StageplanPrintGeometry } from "../../../../../src/domain/stageplan/print/printMetrics";
import { TAURI_COMMANDS } from "./tauriCommands";

/** Stopa je pomůcka, ne podmínka editace — volající chybu jen zaloguje (R12). */
export function fetchStageplanPrintGeometry(projectId: string) {
  return invoke<StageplanPrintGeometry>(
    TAURI_COMMANDS.STAGEPLAN_PRINT_METRICS,
    { projectId },
  );
}
```

- [ ] **Step 2: Load the geometry in the editor page**

V `packages/desktop/src/app/pages/StagePlanEditorPage.tsx` přidej import a stav:

```ts
import type { StageplanPrintGeometry } from "../../../../../src/domain/stageplan/print/printMetrics";
import { fetchStageplanPrintGeometry } from "../services/stageplanMetrics";
```

```tsx
  const [printGeometry, setPrintGeometry] =
    useState<StageplanPrintGeometry | null>(null);
```

a nový efekt hned za efekt, který načítá projekt:

```tsx
  useEffect(() => {
    let cancelled = false;
    fetchStageplanPrintGeometry(id)
      .then((geometry) => {
        if (!cancelled) setPrintGeometry(geometry);
      })
      .catch((error) => {
        // Bez metrik se stopa nenakreslí; editace tím netrpí.
        console.error("[stageplan] print metrics unavailable", error);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);
```

Do `<StageCanvas ... />` přidej `printGeometry={printGeometry}`.

- [ ] **Step 3: Compute the footprint in the canvas**

V `packages/desktop/src/app/components/stageplan/StageCanvas.tsx` přidej importy a prop:

```ts
import { computePrintFootprintMm } from "../../../../../../src/domain/stageplan/print/printFootprint";
import type { StageplanPrintGeometry } from "../../../../../../src/domain/stageplan/print/printMetrics";
import { createPrintScale } from "../../../../../../src/domain/stageplan/print/printScale";
```

```ts
  printGeometry: StageplanPrintGeometry | null;
```

a uvnitř komponenty, nad `return`:

```tsx
  // Tisková stopa: stejná doménová funkce jako v rendereru, jen výsledek v mm
  // se vrací do metrů měřítkem tisku — proto se překreslí i po změně pódia.
  const printScale = printGeometry
    ? createPrintScale(area, printGeometry.area)
    : null;
  const footprintFor = (block: StageplanBlock) => {
    if (!printGeometry || !printScale) return null;
    const metric = printGeometry.blocks.find(
      (entry) => entry.slot === block.slot,
    );
    if (!metric) return null;
    const footprint = computePrintFootprintMm({
      lineCount: metric.lineCount,
      hasPower: metric.hasPower,
      zone: block,
      mmPerM: printScale.mmPerM,
      typography: printGeometry.typography,
    });
    return {
      widthM: printScale.toM(footprint.widthMm),
      depthM: printScale.toM(footprint.heightMm),
    };
  };
```

a do `<StageBlock ... />` přidej `printFootprint={footprintFor(block)}`.

- [ ] **Step 4: Draw the outline in the block**

V `packages/desktop/src/app/components/stageplan/StageBlock.tsx` přidej do props:

```ts
  printFootprint: { widthM: number; depthM: number } | null;
```

a do JSX jako první potomka `.stage-block` (obrys rotuje s blokem, protože je jeho potomek):

```tsx
      {printFootprint ? (
        <div
          className="stage-block__print-footprint"
          style={
            {
              "--footprint-w": `${scale.toPx(printFootprint.widthM)}px`,
              "--footprint-h": `${scale.toPx(printFootprint.depthM)}px`,
            } as CSSProperties
          }
        />
      ) : null}
```

- [ ] **Step 5: Style the outline and fix the footer sentence**

Do `packages/desktop/src/styles/features/stageplan-editor.css` přidej za pravidlo `.stage-block`:

```css
/* Kolik místa blok zabere na papíře — text ho nafoukne nad hloubku zóny (R12). */
.stage-block__print-footprint {
  position: absolute;
  left: 50%;
  top: 50%;
  width: var(--footprint-w);
  height: var(--footprint-h);
  transform: translate(-50%, -50%);
  border: 1px dashed var(--color-stage-border);
  border-radius: var(--sp-r-card);
  pointer-events: none;
}
```

V `packages/desktop/src/app/components/stageplan/EditorFooter.tsx` nahraď text i komentář:

```tsx
/**
 * Tisk rozmístění čte od F5b, takže věta z handoffu je pravdivá — obrys tiskové
 * stopy v canvasu ukazuje, kolik místa blok na papíře zabere.
 */
```

```tsx
      <span className="stage-footer__note">
        Změny se propíší do PDF exportu
      </span>
```

- [ ] **Step 6: Type-check and build the frontend**

Run:

```bash
cd packages/desktop && npx tsc --noEmit ; npx vite build
```

Expected: `tsc` hlásí **jen** 10 předem existujících chyb ve 4 testovacích souborech (`BassFieldRendering.test.tsx`, `buildBassFields.test.ts`, `buildKeysFields.test.ts`, `projectMaintenance.test.ts`); `vite build` projde. Jakákoli chyba v souborech tohoto tasku je regrese.

- [ ] **Step 7: Lint and commit**

```bash
npx biome check packages/desktop/src/app/services/stageplanMetrics.ts packages/desktop/src/app/services/tauriCommands.ts packages/desktop/src/app/pages/StagePlanEditorPage.tsx packages/desktop/src/app/components/stageplan/StageCanvas.tsx packages/desktop/src/app/components/stageplan/StageBlock.tsx packages/desktop/src/app/components/stageplan/EditorFooter.tsx packages/desktop/src/styles/features/stageplan-editor.css
git add packages/desktop/src/app/services/stageplanMetrics.ts packages/desktop/src/app/services/tauriCommands.ts packages/desktop/src/app/pages/StagePlanEditorPage.tsx packages/desktop/src/app/components/stageplan/StageCanvas.tsx packages/desktop/src/app/components/stageplan/StageBlock.tsx packages/desktop/src/app/components/stageplan/EditorFooter.tsx packages/desktop/src/styles/features/stageplan-editor.css
git commit -m "feat(stageplan): outline the printed footprint in the editor"
```

---

### Task 11: Dokumentace stavu implementace

**Files:**
- Modify: `docs/superpowers/specs/2026-08-13-pdf-reads-stageplan-layout-design.md`
- Modify: `docs/design/rebranding-roadmap.md`

**Interfaces:**
- Consumes: výsledky Tasků 1–10 (počty testů, odchylky, neověřené body).
- Produces: nic spustitelného — jen zápis, který musí být pravdivý.

- [ ] **Step 1: Collect the numbers**

Run:

```bash
npm test 2>&1 | tail -20
```

Zapiš si počet prošlých a padajících testů a porovnej se baseline (2 trvalá selhání).

- [ ] **Step 2: Append the implementation status to the spec**

Na konec specu přidej sekci `## Stav implementace` podle vzoru F5a (`docs/superpowers/specs/2026-08-13-stageplan-editor-and-layout-model-design.md`): co vzniklo po vrstvách, čísla testů proti baseline, **odchylky, které přinesla implementace**, a výslovně **co ověřeno není** — body 2 až 7 z Verifikace vyžadují okno Tauri (`npm run dev`), takže je nelze odbavit automaticky; bod 8 je ruční vizuální kontrola vytištěného PDF.

- [ ] **Step 3: Update the roadmap**

V `docs/design/rebranding-roadmap.md` v tabulce Stav přepiš řádek F5b na `hotovo, čeká na ruční kontrolu` a doplň rozsah commitů. V sekci `## F5 — Stage Plan Editor` uprav odstavec, který dnes tvrdí „Do F5b tisk rozmístění nečte a patička editoru to přiznává" — po F5b to není pravda.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-08-13-pdf-reads-stageplan-layout-design.md docs/design/rebranding-roadmap.md
git commit -m "docs(design): record the F5b implementation state and close the sub-phase"
```

---

## Ruční kontrola po dokončení (nelze automatizovat)

Editor běží v okně Tauri, takže tyto body musí projít člověk přes `npm run dev`. Před spuštěním zkontroluj, že port 1420 nedrží osiřelý Vite (`netstat -ano | grep :1420` → `taskkill //PID <pid> //F`).

1. Export projektu s ručně upraveným rozmístěním: bloky stojí na pozicích z editoru, rotace se tiskne, lead vokál je inverzní, napájení oranžové, rám a pruh `DOWNSTAGE · PUBLIKUM` na místě.
2. Posun bloku → uložení → export: blok je na novém místě a `contentUpdatedAt` se **exportem** neposunul.
3. Starý projekt bez `stageplan.layout`: vytiskne se výchozí rozmístění a do JSONu se nic nezapsalo.
4. Pódium 10 × 6 m: nad rámem stojí `PÓDIUM 10,0 × 6,0 m`, plán drží proporce; bez zadaného rozměru se netvrdí nic.
5. Bloky namáčknuté na sebe: export selže s hláškou, která bloky pojmenuje; obrysy stop v editoru byly přeložené už dřív.
6. Lineup bez klávesáka: box `Keys` se netiskne.
7. Vizuální kontrola vytištěného PDF.
