# Model rozmístění stage planu a editor (F5a) — implementační plán

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rozmístění bloků na pódiu je doménová data v metrech uložená v projektu, vygenerovaná z lineupu a editovatelná myší na tmavé ploše; tisk se nemění.

**Architecture:** Veškerá geometrie je v `src/domain/stageplan/layout/` jako čisté funkce bez I/O — komponenty editoru jen překládají pointer eventy na doménová volání a kreslí výsledek. Persistence jde existující jedinou cestou `saveProjectPayload`, jejíž whitelist se musí rozšířit, jinak uložení z jiné obrazovky rozmístění smaže.

**Tech Stack:** TypeScript (ESM, strict), React 18, Vitest v node prostředí bez jsdom, Biome, Tauri.

**Spec:** [2026-08-13-stageplan-editor-and-layout-model-design.md](../specs/2026-08-13-stageplan-editor-and-layout-model-design.md) — rozhodnutí `R1`–`R17`.

## Global Constraints

- Souřadnice a rozměry se ukládají **v metrech**, rotace v **celých stupních** (R2, R3).
- Metry se zaokrouhlují na **3 desetinná místa**, rotace na celé stupně, a to **v doméně při každé operaci**, ne až při serializaci (R12).
- Nominální plocha pro nezadaný rozměr pódia: **12 × 8 m** (R5).
- Zóny podle slotu: `drums` 2,8 × 1,6 m · `keys` 2,8 × 1,4 m · `bass` 2,7 × 1,4 m · `guitar` 2,7 × 1,4 m · `lead_voc_1` a `lead_voc_2` 2,6 × 1,2 m (R2).
- Snap: **0,1 m** a **15°**; bez snapu 1°. Tolerance přesahu za hranu plochy: **0,2 m** (R16).
- Klávesnice: šipky 0,1 m, Shift+šipky 1 m, `R`/`Shift+R` ±15°, `Ctrl+Z`/`Ctrl+Y`, `Esc` ruší výběr, `Delete` nedělá nic (R17).
- Undo zásobník: **50 stavů**, plní se na `pointerup`, žije jen po dobu sezení (R15).
- Šest slotů, identita bloku je slot: `drums`, `bass`, `guitar`, `keys`, `lead_voc_1`, `lead_voc_2` (R4).
- `src/domain/` nesmí obsahovat I/O ani side efekty. Editor je v `packages/desktop/`, který volá Tauri jen přes `services/`.
- Testy běží v node prostředí **bez jsdom** — komponenty se netestují automaticky, proto je matematika v doméně (R10).
- Zápis na disk jde **výhradně** přes `saveProjectPayload` s `intent: "content"`, který posouvá `contentUpdatedAt` (R13).
- Editor je vždy tmavý, i ve světlém tématu; roly `--color-stage-*` se definují v obou tématech stejně (R14).
- Commit message je **jednořádková** — hook v repu odmítne tělo i patičku.
- Baseline před začátkem: dva trvale padající testy a velké množství CRLF hlášek z Biome. Hodnotí se **rozdíl**, ne absolutní čísla.
- Žádné inline styly pro vzhled; do `style` patří jen spočítaná geometrie, a to jako CSS proměnné.

---

### Task 1: Doménové typy a normalizace layoutu

**Files:**
- Modify: `src/domain/model/types.ts` (přidat typy; rozšířit `stageplan` v `Project`, `LegacyProjectJson`, `ProjectJsonV2`)
- Create: `src/domain/stageplan/layout/slots.ts`
- Create: `src/domain/stageplan/layout/normalizeLayout.ts`
- Create: `src/domain/stageplan/layout/normalizeLayout.test.ts`
- Modify: `src/app/usecases/normalizeProject.ts:199`
- Test: `src/app/usecases/normalizeProject.test.ts` (přidat případ)

**Interfaces:**
- Produces: `StageplanBlockSlot`, `StageplanBlock`, `StageplanStageSize`, `StageplanLayout` v `src/domain/model/types.ts`; `STAGEPLAN_BLOCK_SLOTS: readonly StageplanBlockSlot[]` a `isStageplanBlockSlot(value: unknown): value is StageplanBlockSlot` v `slots.ts`; `normalizeStageplanLayout(value: unknown): StageplanLayout | undefined`.

- [ ] **Step 1: Napsat padající test normalizace**

Vytvoř `src/domain/stageplan/layout/normalizeLayout.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { normalizeStageplanLayout } from "./normalizeLayout.js";

describe("normalizeStageplanLayout", () => {
  it("keeps a well formed layout", () => {
    const layout = normalizeStageplanLayout({
      stage: { widthM: 10, depthM: 6 },
      blocks: [
        { slot: "drums", centerXM: 5, centerYM: 1.2, widthM: 2.8, depthM: 1.6, rotationDeg: 15 },
      ],
    });

    expect(layout).toEqual({
      stage: { widthM: 10, depthM: 6 },
      blocks: [
        { slot: "drums", centerXM: 5, centerYM: 1.2, widthM: 2.8, depthM: 1.6, rotationDeg: 15 },
      ],
    });
  });

  it("drops blocks with an unknown slot", () => {
    const layout = normalizeStageplanLayout({
      stage: null,
      blocks: [
        { slot: "trombone", centerXM: 1, centerYM: 1, widthM: 1, depthM: 1, rotationDeg: 0 },
        { slot: "bass", centerXM: 1, centerYM: 1, widthM: 1, depthM: 1, rotationDeg: 0 },
      ],
    });

    expect(layout?.blocks.map((block) => block.slot)).toEqual(["bass"]);
  });

  it("keeps the first block of a duplicated slot", () => {
    const layout = normalizeStageplanLayout({
      blocks: [
        { slot: "keys", centerXM: 2, centerYM: 2, widthM: 2.8, depthM: 1.4, rotationDeg: 0 },
        { slot: "keys", centerXM: 9, centerYM: 5, widthM: 2.8, depthM: 1.4, rotationDeg: 0 },
      ],
    });

    expect(layout?.blocks).toHaveLength(1);
    expect(layout?.blocks[0]?.centerXM).toBe(2);
  });

  it("drops blocks with non numeric or non finite values", () => {
    const layout = normalizeStageplanLayout({
      blocks: [
        { slot: "drums", centerXM: "5", centerYM: 1, widthM: 2.8, depthM: 1.6, rotationDeg: 0 },
        { slot: "bass", centerXM: Number.POSITIVE_INFINITY, centerYM: 1, widthM: 2.7, depthM: 1.4, rotationDeg: 0 },
        { slot: "guitar", centerXM: 1, centerYM: 1, widthM: 0, depthM: 1.4, rotationDeg: 0 },
        { slot: "keys", centerXM: 1, centerYM: 1, widthM: 2.8, depthM: -1, rotationDeg: 0 },
      ],
    });

    expect(layout?.blocks).toEqual([]);
  });

  it("normalizes rotation into 0-359 whole degrees", () => {
    const layout = normalizeStageplanLayout({
      blocks: [
        { slot: "drums", centerXM: 1, centerYM: 1, widthM: 2.8, depthM: 1.6, rotationDeg: -45.4 },
        { slot: "bass", centerXM: 1, centerYM: 1, widthM: 2.7, depthM: 1.4, rotationDeg: 375 },
      ],
    });

    expect(layout?.blocks.map((block) => block.rotationDeg)).toEqual([315, 15]);
  });

  it("rejects a stage size with a non positive dimension", () => {
    const layout = normalizeStageplanLayout({ stage: { widthM: 12, depthM: 0 }, blocks: [] });
    expect(layout?.stage).toBeNull();
  });

  it("returns undefined when blocks are missing entirely", () => {
    expect(normalizeStageplanLayout(undefined)).toBeUndefined();
    expect(normalizeStageplanLayout({ stage: { widthM: 12, depthM: 8 } })).toBeUndefined();
  });
});
```

- [ ] **Step 2: Spustit test a ověřit, že padá**

Run: `npx vitest run src/domain/stageplan/layout/normalizeLayout.test.ts`
Expected: FAIL — `Failed to resolve import "./normalizeLayout.js"`

- [ ] **Step 3: Přidat typy do doménového modelu**

V `src/domain/model/types.ts` doplň za `StageplanPerson` (kolem řádku 27):

```ts
/** Slot, který se na stage planu kreslí jako blok. Shodný s tiskovými sloty PDF. */
export type StageplanBlockSlot =
  | "drums"
  | "bass"
  | "guitar"
  | "keys"
  | "lead_voc_1"
  | "lead_voc_2";

export type StageplanStageSize = {
  readonly widthM: number;
  readonly depthM: number;
};

/**
 * Zóna jednoho slotu na pódiu. Ukládá se **střed** zóny, protože rotace kolem
 * středu ho nemění — u levého horního rohu by každé otočení vypadalo jako posun.
 */
export type StageplanBlock = {
  readonly slot: StageplanBlockSlot;
  readonly centerXM: number;
  /** 0 = upstage hrana, roste směrem k publiku. */
  readonly centerYM: number;
  readonly widthM: number;
  readonly depthM: number;
  /** 0–359, celé stupně, kolem středu zóny. */
  readonly rotationDeg: number;
};

export type StageplanLayout = {
  /** null = rozměr pódia nezadán; kreslí se na nominální plochu 12 × 8 m. */
  readonly stage: StageplanStageSize | null;
  readonly blocks: readonly StageplanBlock[];
};
```

Pak ve všech třech výskytech `stageplan?:` (v `Project`, `LegacyProjectJson` a `ProjectJsonV2`) rozšiř tvar na:

```ts
  stageplan?: {
    powerOverridesByMusician?: Record<string, PowerRequirement>;
    layout?: StageplanLayout;
  };
```

- [ ] **Step 4: Vytvořit seznam slotů**

Vytvoř `src/domain/stageplan/layout/slots.ts`:

```ts
import type { StageplanBlockSlot } from "../../model/types.js";

/** Pořadí je stabilní, aby serializace layoutu nezáležela na pořadí vstupu. */
export const STAGEPLAN_BLOCK_SLOTS: readonly StageplanBlockSlot[] = [
  "drums",
  "bass",
  "guitar",
  "keys",
  "lead_voc_1",
  "lead_voc_2",
];

export function isStageplanBlockSlot(value: unknown): value is StageplanBlockSlot {
  return (
    typeof value === "string" &&
    (STAGEPLAN_BLOCK_SLOTS as readonly string[]).includes(value)
  );
}
```

- [ ] **Step 5: Napsat normalizaci**

Vytvoř `src/domain/stageplan/layout/normalizeLayout.ts`:

```ts
import type {
  StageplanBlock,
  StageplanLayout,
  StageplanStageSize,
} from "../../model/types.js";
import { isStageplanBlockSlot } from "./slots.js";

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function positiveNumber(value: unknown): number | null {
  const numeric = finiteNumber(value);
  return numeric !== null && numeric > 0 ? numeric : null;
}

function normalizeRotation(value: number): number {
  return ((Math.round(value) % 360) + 360) % 360;
}

function normalizeStage(value: unknown): StageplanStageSize | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as { widthM?: unknown; depthM?: unknown };
  const widthM = positiveNumber(raw.widthM);
  const depthM = positiveNumber(raw.depthM);
  if (widthM === null || depthM === null) return null;
  return { widthM, depthM };
}

function normalizeBlock(value: unknown): StageplanBlock | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (!isStageplanBlockSlot(raw.slot)) return null;
  const centerXM = finiteNumber(raw.centerXM);
  const centerYM = finiteNumber(raw.centerYM);
  const widthM = positiveNumber(raw.widthM);
  const depthM = positiveNumber(raw.depthM);
  const rotationDeg = finiteNumber(raw.rotationDeg);
  if (
    centerXM === null ||
    centerYM === null ||
    widthM === null ||
    depthM === null ||
    rotationDeg === null
  ) {
    return null;
  }
  return {
    slot: raw.slot,
    centerXM,
    centerYM,
    widthM,
    depthM,
    rotationDeg: normalizeRotation(rotationDeg),
  };
}

/**
 * Poškozený layout se zahazuje, ne vyhazuje výjimku — projekt se musí dát
 * otevřít i po ruční editaci JSONu. Chybějící layout je legitimní stav.
 */
export function normalizeStageplanLayout(
  value: unknown,
): StageplanLayout | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as { stage?: unknown; blocks?: unknown };
  if (!Array.isArray(raw.blocks)) return undefined;

  const seen = new Set<string>();
  const blocks: StageplanBlock[] = [];
  for (const entry of raw.blocks) {
    const block = normalizeBlock(entry);
    if (!block || seen.has(block.slot)) continue;
    seen.add(block.slot);
    blocks.push(block);
  }
  return { stage: normalizeStage(raw.stage), blocks };
}
```

- [ ] **Step 6: Spustit test a ověřit, že prochází**

Run: `npx vitest run src/domain/stageplan/layout/normalizeLayout.test.ts`
Expected: PASS, 7 testů

- [ ] **Step 7: Zapojit normalizaci do `normalizeProject`**

V `src/app/usecases/normalizeProject.ts` přidej import:

```ts
import { normalizeStageplanLayout } from "../../domain/stageplan/layout/normalizeLayout.js";
```

Nad `export function normalizeProject` doplň:

```ts
/**
 * Layout prochází normalizací, protože `stageplan` se dřív jen přiřadil a
 * věřilo se typu — ručně editovaný JSON tak dostal do domény cokoli.
 */
function normalizeProjectStageplan(
  value: Project["stageplan"],
): Project["stageplan"] {
  if (!value || typeof value !== "object") return undefined;
  const layout = normalizeStageplanLayout(value.layout);
  const powerOverridesByMusician = value.powerOverridesByMusician;
  if (!layout && !powerOverridesByMusician) return undefined;
  return {
    ...(powerOverridesByMusician ? { powerOverridesByMusician } : {}),
    ...(layout ? { layout } : {}),
  };
}
```

A na řádku 199 nahraď `const stageplan = (input as ProjectJson).stageplan;` za:

```ts
  const stageplan = normalizeProjectStageplan((input as ProjectJson).stageplan);
```

- [ ] **Step 8: Přidat test do `normalizeProject.test.ts`**

```ts
  it("drops a corrupt stageplan layout but keeps power overrides", () => {
    const project = normalizeProject({
      id: "p-1",
      bandRef: "band-1",
      purpose: "generic",
      documentDate: "2026-01-01",
      stageplan: {
        powerOverridesByMusician: { "musician-1": { voltage: 230, sockets: 5 } },
        layout: { stage: { widthM: 12, depthM: 8 }, blocks: "nonsense" },
      },
    } as never);

    expect(project.stageplan?.powerOverridesByMusician).toEqual({
      "musician-1": { voltage: 230, sockets: 5 },
    });
    expect(project.stageplan?.layout).toBeUndefined();
  });

  it("keeps a valid stageplan layout", () => {
    const project = normalizeProject({
      id: "p-2",
      bandRef: "band-1",
      purpose: "generic",
      documentDate: "2026-01-01",
      stageplan: {
        layout: {
          stage: null,
          blocks: [
            { slot: "drums", centerXM: 6, centerYM: 1.2, widthM: 2.8, depthM: 1.6, rotationDeg: 0 },
          ],
        },
      },
    } as never);

    expect(project.stageplan?.layout?.blocks).toHaveLength(1);
  });
```

- [ ] **Step 9: Spustit celou sadu a lint**

Run: `npm test && npm run lint`
Expected: nové testy prochází, počet padajících testů se nezvýšil proti baseline

- [ ] **Step 10: Commit**

```bash
git add src/domain/model/types.ts src/domain/stageplan/layout src/app/usecases/normalizeProject.ts src/app/usecases/normalizeProject.test.ts
git commit -m "feat(stageplan): model the layout of stage plan blocks and normalize it on load"
```

---

### Task 2: Zaokrouhlení, nominální plocha a výchozí rozmístění

**Files:**
- Create: `src/domain/stageplan/layout/round.ts`
- Create: `src/domain/stageplan/layout/defaultLayout.ts`
- Create: `src/domain/stageplan/layout/defaultLayout.test.ts`

**Interfaces:**
- Consumes: `STAGEPLAN_BLOCK_SLOTS` (Task 1), typy `StageplanBlock`, `StageplanLayout`, `StageplanStageSize`, `StageplanBlockSlot` (Task 1).
- Produces: `roundM(value: number): number`, `roundDeg(value: number): number` v `round.ts`; `NOMINAL_STAGE: StageplanStageSize`, `ZONE_BY_SLOT`, `buildDefaultLayout(args: { slots: readonly StageplanBlockSlot[]; stage: StageplanStageSize | null }): StageplanLayout` v `defaultLayout.ts`.

- [ ] **Step 1: Napsat padající test výchozího rozmístění**

Vytvoř `src/domain/stageplan/layout/defaultLayout.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { NOMINAL_STAGE, buildDefaultLayout } from "./defaultLayout.js";

const FIVE = ["drums", "bass", "guitar", "keys", "lead_voc_1"] as const;
const SIX = [...FIVE, "lead_voc_2"] as const;

describe("buildDefaultLayout", () => {
  it("mirrors today's print layout for five blocks", () => {
    const layout = buildDefaultLayout({ slots: FIVE, stage: null });

    expect(layout.stage).toBeNull();
    expect(
      layout.blocks.map((block) => [block.slot, block.centerXM, block.centerYM]),
    ).toEqual([
      ["drums", 6, 1.2],
      ["bass", 9.4, 1.2],
      ["guitar", 2.6, 5.5],
      ["keys", 9.4, 5.5],
      ["lead_voc_1", 6, 5.5],
    ]);
  });

  it("uses the four column bottom row when a second lead vocal exists", () => {
    const layout = buildDefaultLayout({ slots: SIX, stage: null });
    const centers = new Map(layout.blocks.map((block) => [block.slot, block.centerXM]));

    expect(centers.get("guitar")).toBe(1.5);
    expect(centers.get("lead_voc_1")).toBe(4.5);
    expect(centers.get("lead_voc_2")).toBe(7.5);
    expect(centers.get("keys")).toBe(10.5);
  });

  it("gives every slot its zone size and no rotation", () => {
    const layout = buildDefaultLayout({ slots: FIVE, stage: null });
    const drums = layout.blocks.find((block) => block.slot === "drums");

    expect(drums).toMatchObject({ widthM: 2.8, depthM: 1.6, rotationDeg: 0 });
    expect(layout.blocks.every((block) => block.rotationDeg === 0)).toBe(true);
  });

  it("scales the nominal centres onto a smaller stage but keeps zone sizes", () => {
    const layout = buildDefaultLayout({
      slots: FIVE,
      stage: { widthM: 6, depthM: 4 },
    });
    const drums = layout.blocks.find((block) => block.slot === "drums");

    expect(drums?.centerXM).toBe(3);
    expect(drums?.centerYM).toBe(0.6);
    expect(drums?.widthM).toBe(2.8);
  });

  it("keeps only the requested slots and ignores their input order", () => {
    const layout = buildDefaultLayout({
      slots: ["lead_voc_1", "drums"],
      stage: null,
    });

    expect(layout.blocks.map((block) => block.slot)).toEqual(["drums", "lead_voc_1"]);
  });

  it("returns an empty layout for an empty lineup", () => {
    expect(buildDefaultLayout({ slots: [], stage: null }).blocks).toEqual([]);
  });

  it("is deterministic", () => {
    expect(buildDefaultLayout({ slots: SIX, stage: null })).toEqual(
      buildDefaultLayout({ slots: SIX, stage: null }),
    );
  });

  it("draws a project without a stage size on the nominal area", () => {
    expect(NOMINAL_STAGE).toEqual({ widthM: 12, depthM: 8 });
  });
});
```

- [ ] **Step 2: Spustit test a ověřit, že padá**

Run: `npx vitest run src/domain/stageplan/layout/defaultLayout.test.ts`
Expected: FAIL — `Failed to resolve import "./defaultLayout.js"`

- [ ] **Step 3: Napsat zaokrouhlení**

Vytvoř `src/domain/stageplan/layout/round.ts`:

```ts
/**
 * Metry se drží na milimetru a stupně na celém čísle. Bez toho by tažení myší
 * plnilo JSON hodnotami typu 4.300000000000001 a každý diff projektu by
 * vypadal jako změna obsahu.
 */
export function roundM(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function roundDeg(value: number): number {
  return ((Math.round(value) % 360) + 360) % 360;
}
```

- [ ] **Step 4: Napsat výchozí rozmístění**

Vytvoř `src/domain/stageplan/layout/defaultLayout.ts`:

```ts
import type {
  StageplanBlockSlot,
  StageplanLayout,
  StageplanStageSize,
} from "../../model/types.js";
import { roundM } from "./round.js";
import { STAGEPLAN_BLOCK_SLOTS } from "./slots.js";

/** Kreslicí plocha projektu, který rozměr pódia nezadal. */
export const NOMINAL_STAGE: StageplanStageSize = { widthM: 12, depthM: 8 };

/** Kolik místa muzikant na pódiu zabere s backlinem. Odvozeno z prototypu 3g. */
export const ZONE_BY_SLOT: Readonly<
  Record<StageplanBlockSlot, { readonly widthM: number; readonly depthM: number }>
> = {
  drums: { widthM: 2.8, depthM: 1.6 },
  bass: { widthM: 2.7, depthM: 1.4 },
  guitar: { widthM: 2.7, depthM: 1.4 },
  keys: { widthM: 2.8, depthM: 1.4 },
  lead_voc_1: { widthM: 2.6, depthM: 1.2 },
  lead_voc_2: { widthM: 2.6, depthM: 1.2 },
};

type Center = { readonly xM: number; readonly yM: number };

/** Pět bloků: kopie dnešního `layout_5_party`, dolní řada o třech sloupcích. */
const CENTER_5: Readonly<Record<StageplanBlockSlot, Center>> = {
  drums: { xM: 6, yM: 1.2 },
  bass: { xM: 9.4, yM: 1.2 },
  guitar: { xM: 2.6, yM: 5.5 },
  keys: { xM: 9.4, yM: 5.5 },
  lead_voc_1: { xM: 6, yM: 5.5 },
  /** Ve pětiblokové variantě neexistuje; hodnota je tu jen pro úplnost tabulky. */
  lead_voc_2: { xM: 7.5, yM: 5.5 },
};

/** Šest bloků: kopie dnešního `layout_6_2_vocs`, dolní řada o čtyřech sloupcích. */
const CENTER_6: Readonly<Record<StageplanBlockSlot, Center>> = {
  drums: { xM: 6, yM: 1.2 },
  bass: { xM: 9.4, yM: 1.2 },
  guitar: { xM: 1.5, yM: 5.5 },
  keys: { xM: 10.5, yM: 5.5 },
  lead_voc_1: { xM: 4.5, yM: 5.5 },
  lead_voc_2: { xM: 7.5, yM: 5.5 },
};

/**
 * Deterministické výchozí rozmístění. `Reset rozmístění` je jen další zavolání
 * téhle funkce — proto v ní nesmí být nic náhodného ani závislého na času.
 */
export function buildDefaultLayout(args: {
  readonly slots: readonly StageplanBlockSlot[];
  readonly stage: StageplanStageSize | null;
}): StageplanLayout {
  const table = args.slots.includes("lead_voc_2") ? CENTER_6 : CENTER_5;
  const area = args.stage ?? NOMINAL_STAGE;
  const scaleX = area.widthM / NOMINAL_STAGE.widthM;
  const scaleY = area.depthM / NOMINAL_STAGE.depthM;

  const blocks = STAGEPLAN_BLOCK_SLOTS.flatMap((slot) => {
    if (!args.slots.includes(slot)) return [];
    return [
      {
        slot,
        centerXM: roundM(table[slot].xM * scaleX),
        centerYM: roundM(table[slot].yM * scaleY),
        widthM: ZONE_BY_SLOT[slot].widthM,
        depthM: ZONE_BY_SLOT[slot].depthM,
        rotationDeg: 0,
      },
    ];
  });

  return { stage: args.stage, blocks };
}
```

- [ ] **Step 5: Spustit test a ověřit, že prochází**

Run: `npx vitest run src/domain/stageplan/layout/defaultLayout.test.ts`
Expected: PASS, 8 testů

- [ ] **Step 6: Commit**

```bash
git add src/domain/stageplan/layout/round.ts src/domain/stageplan/layout/defaultLayout.ts src/domain/stageplan/layout/defaultLayout.test.ts
git commit -m "feat(stageplan): generate the default block arrangement from today's print layout"
```

---

### Task 3: Sloty z lineupu a sloučení se stávajícím rozmístěním

**Files:**
- Create: `src/domain/stageplan/layout/resolveBlockSlots.ts`
- Create: `src/domain/stageplan/layout/resolveBlockSlots.test.ts`
- Create: `src/domain/stageplan/layout/mergeWithLineup.ts`
- Create: `src/domain/stageplan/layout/mergeWithLineup.test.ts`

**Interfaces:**
- Consumes: `buildDefaultLayout` (Task 2), `STAGEPLAN_BLOCK_SLOTS` (Task 1).
- Produces: `resolveStageplanBlockSlots(args: { musicianIdsByGroup: Readonly<Partial<Record<"drums" | "bass" | "guitar" | "keys", readonly string[]>>>; leadVocalIds: readonly string[] }): StageplanBlockSlot[]`; `mergeWithLineup(existing: StageplanLayout | undefined, args: { slots: readonly StageplanBlockSlot[]; stage: StageplanStageSize | null }): StageplanLayout`.

- [ ] **Step 1: Napsat padající test odvození slotů**

Vytvoř `src/domain/stageplan/layout/resolveBlockSlots.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { resolveStageplanBlockSlots } from "./resolveBlockSlots.js";

describe("resolveStageplanBlockSlots", () => {
  it("gives a slot to every occupied instrument group", () => {
    const slots = resolveStageplanBlockSlots({
      musicianIdsByGroup: { drums: ["d1"], bass: ["b1"], guitar: [], keys: ["k1"] },
      leadVocalIds: [],
    });

    expect(slots).toEqual(["drums", "bass", "keys"]);
  });

  it("turns the first two free lead vocalists into voc slots", () => {
    const slots = resolveStageplanBlockSlots({
      musicianIdsByGroup: { drums: ["d1"] },
      leadVocalIds: ["v1", "v2", "v3"],
    });

    expect(slots).toEqual(["drums", "lead_voc_1", "lead_voc_2"]);
  });

  it("does not give a voc slot to a lead vocalist who already plays an instrument", () => {
    const slots = resolveStageplanBlockSlots({
      musicianIdsByGroup: { keys: ["k1"] },
      leadVocalIds: ["k1"],
    });

    expect(slots).toEqual(["keys"]);
  });

  it("returns an empty list for an empty lineup", () => {
    expect(
      resolveStageplanBlockSlots({ musicianIdsByGroup: {}, leadVocalIds: [] }),
    ).toEqual([]);
  });

  it("keeps the canonical slot order regardless of input order", () => {
    const slots = resolveStageplanBlockSlots({
      musicianIdsByGroup: { keys: ["k1"], drums: ["d1"] },
      leadVocalIds: ["v1"],
    });

    expect(slots).toEqual(["drums", "keys", "lead_voc_1"]);
  });
});
```

- [ ] **Step 2: Spustit test a ověřit, že padá**

Run: `npx vitest run src/domain/stageplan/layout/resolveBlockSlots.test.ts`
Expected: FAIL — `Failed to resolve import "./resolveBlockSlots.js"`

- [ ] **Step 3: Napsat odvození slotů**

Vytvoř `src/domain/stageplan/layout/resolveBlockSlots.ts`:

```ts
import type { StageplanBlockSlot } from "../../model/types.js";
import { STAGEPLAN_BLOCK_SLOTS } from "./slots.js";

const INSTRUMENT_GROUPS = ["drums", "bass", "guitar", "keys"] as const;

type InstrumentGroup = (typeof INSTRUMENT_GROUPS)[number];

/**
 * Které bloky stage plan má. Pravidlo je stejné, jakým dnes tiskový model
 * obsazuje slot `lead_voc_1` a `lead_voc_2`: zpěvák, který už drží nástroj,
 * druhý blok nedostane.
 */
export function resolveStageplanBlockSlots(args: {
  readonly musicianIdsByGroup: Readonly<
    Partial<Record<InstrumentGroup, readonly string[]>>
  >;
  readonly leadVocalIds: readonly string[];
}): StageplanBlockSlot[] {
  const present = new Set<StageplanBlockSlot>();
  const instrumentIds = new Set<string>();

  for (const group of INSTRUMENT_GROUPS) {
    const ids = args.musicianIdsByGroup[group] ?? [];
    if (ids.length > 0) present.add(group);
    for (const id of ids) instrumentIds.add(id);
  }

  const freeLeads = args.leadVocalIds.filter((id) => !instrumentIds.has(id));
  if (freeLeads.length > 0) present.add("lead_voc_1");
  if (freeLeads.length > 1) present.add("lead_voc_2");

  return STAGEPLAN_BLOCK_SLOTS.filter((slot) => present.has(slot));
}
```

- [ ] **Step 4: Spustit test a ověřit, že prochází**

Run: `npx vitest run src/domain/stageplan/layout/resolveBlockSlots.test.ts`
Expected: PASS, 5 testů

- [ ] **Step 5: Napsat padající test sloučení**

Vytvoř `src/domain/stageplan/layout/mergeWithLineup.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { StageplanLayout } from "../../model/types.js";
import { mergeWithLineup } from "./mergeWithLineup.js";

const MOVED: StageplanLayout = {
  stage: { widthM: 10, depthM: 6 },
  blocks: [
    { slot: "drums", centerXM: 1.5, centerYM: 4.2, widthM: 2.8, depthM: 1.6, rotationDeg: 45 },
    { slot: "bass", centerXM: 8, centerYM: 1, widthM: 2.7, depthM: 1.4, rotationDeg: 0 },
  ],
};

describe("mergeWithLineup", () => {
  it("builds the default layout when nothing exists yet", () => {
    const merged = mergeWithLineup(undefined, {
      slots: ["drums", "bass"],
      stage: null,
    });

    expect(merged.blocks.map((block) => block.slot)).toEqual(["drums", "bass"]);
    expect(merged.blocks[0]?.centerXM).toBe(6);
  });

  it("never rewrites a hand placed block", () => {
    const merged = mergeWithLineup(MOVED, {
      slots: ["drums", "bass"],
      stage: null,
    });

    expect(merged.blocks.find((block) => block.slot === "drums")).toEqual(
      MOVED.blocks[0],
    );
  });

  it("adds a new slot at its default position", () => {
    const merged = mergeWithLineup(MOVED, {
      slots: ["drums", "bass", "lead_voc_1"],
      stage: null,
    });
    const lead = merged.blocks.find((block) => block.slot === "lead_voc_1");

    expect(lead).toMatchObject({ widthM: 2.6, depthM: 1.2, rotationDeg: 0 });
    expect(lead?.centerXM).not.toBe(0);
  });

  it("removes blocks whose slot left the lineup", () => {
    const merged = mergeWithLineup(MOVED, { slots: ["drums"], stage: null });

    expect(merged.blocks.map((block) => block.slot)).toEqual(["drums"]);
  });

  it("keeps the stage size of the existing layout", () => {
    const merged = mergeWithLineup(MOVED, {
      slots: ["drums", "bass"],
      stage: null,
    });

    expect(merged.stage).toEqual({ widthM: 10, depthM: 6 });
  });

  it("places a new slot on the existing stage, not on the nominal one", () => {
    const merged = mergeWithLineup(MOVED, {
      slots: ["drums", "bass", "keys"],
      stage: null,
    });
    const keys = merged.blocks.find((block) => block.slot === "keys");

    // 9,4 m z dvanácti nominálních přepočteno na desetimetrové pódium.
    expect(keys?.centerXM).toBeCloseTo(7.833, 3);
  });

  it("keeps the canonical slot order after a merge", () => {
    const merged = mergeWithLineup(MOVED, {
      slots: ["lead_voc_1", "bass", "drums"],
      stage: null,
    });

    expect(merged.blocks.map((block) => block.slot)).toEqual([
      "drums",
      "bass",
      "lead_voc_1",
    ]);
  });
});
```

- [ ] **Step 6: Spustit test a ověřit, že padá**

Run: `npx vitest run src/domain/stageplan/layout/mergeWithLineup.test.ts`
Expected: FAIL — `Failed to resolve import "./mergeWithLineup.js"`

- [ ] **Step 7: Napsat sloučení**

Vytvoř `src/domain/stageplan/layout/mergeWithLineup.ts`:

```ts
import type {
  StageplanBlock,
  StageplanBlockSlot,
  StageplanLayout,
  StageplanStageSize,
} from "../../model/types.js";
import { buildDefaultLayout } from "./defaultLayout.js";
import { STAGEPLAN_BLOCK_SLOTS } from "./slots.js";

/**
 * Doplní bloky pro nové sloty, odebere bloky slotů, které z lineupu zmizely, a
 * existující nechá beze změny — včetně pozice, rotace i rozměru. Výměna
 * kytaristy nesmí přerovnat plán.
 */
export function mergeWithLineup(
  existing: StageplanLayout | undefined,
  args: {
    readonly slots: readonly StageplanBlockSlot[];
    readonly stage: StageplanStageSize | null;
  },
): StageplanLayout {
  if (!existing) return buildDefaultLayout(args);

  const keptBySlot = new Map<StageplanBlockSlot, StageplanBlock>(
    existing.blocks.map((block) => [block.slot, block]),
  );
  const defaults = buildDefaultLayout({
    slots: args.slots,
    stage: existing.stage,
  });
  const defaultBySlot = new Map<StageplanBlockSlot, StageplanBlock>(
    defaults.blocks.map((block) => [block.slot, block]),
  );

  const blocks = STAGEPLAN_BLOCK_SLOTS.flatMap((slot) => {
    if (!args.slots.includes(slot)) return [];
    const kept = keptBySlot.get(slot);
    if (kept) return [kept];
    const fresh = defaultBySlot.get(slot);
    return fresh ? [fresh] : [];
  });

  return { stage: existing.stage, blocks };
}
```

- [ ] **Step 8: Spustit oba testy a lint**

Run: `npx vitest run src/domain/stageplan/layout && npm run lint`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/domain/stageplan/layout
git commit -m "feat(stageplan): derive block slots from the lineup and merge without rewriting hand placement"
```

---

### Task 4: Operace s blokem — snap, clamp, posun, rotace

**Files:**
- Create: `src/domain/stageplan/layout/blockOps.ts`
- Create: `src/domain/stageplan/layout/blockOps.test.ts`

**Interfaces:**
- Consumes: `roundM`, `roundDeg` (Task 2).
- Produces: `SNAP_STEP_M = 0.1`, `SNAP_STEP_DEG = 15`, `OVERHANG_TOLERANCE_M = 0.2`, `rotatedHalfExtents(block): { halfXM: number; halfYM: number }`, `clampToArea(block, area): StageplanBlock`, `moveBlockTo(block, target: { centerXM: number; centerYM: number }, options: { area: StageplanStageSize; snap: boolean }): StageplanBlock`, `nudgeBlockBy(block, delta: { xM: number; yM: number }, options: { area: StageplanStageSize }): StageplanBlock`, `rotateBlockTo(block, deg, options: { area: StageplanStageSize; snap: boolean }): StageplanBlock`, `rotateBlockBy(block, deltaDeg, options: { area: StageplanStageSize; snap: boolean }): StageplanBlock`.

- [ ] **Step 1: Napsat padající test operací**

Vytvoř `src/domain/stageplan/layout/blockOps.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { StageplanBlock, StageplanStageSize } from "../../model/types.js";
import {
  OVERHANG_TOLERANCE_M,
  clampToArea,
  moveBlockTo,
  nudgeBlockBy,
  rotateBlockBy,
  rotateBlockTo,
  rotatedHalfExtents,
} from "./blockOps.js";

const AREA: StageplanStageSize = { widthM: 12, depthM: 8 };

const BLOCK: StageplanBlock = {
  slot: "drums",
  centerXM: 6,
  centerYM: 4,
  widthM: 2.8,
  depthM: 1.6,
  rotationDeg: 0,
};

describe("rotatedHalfExtents", () => {
  it("returns half the zone when the block is not rotated", () => {
    expect(rotatedHalfExtents(BLOCK)).toEqual({ halfXM: 1.4, halfYM: 0.8 });
  });

  it("swaps the axes at 90 degrees", () => {
    const extents = rotatedHalfExtents({ ...BLOCK, rotationDeg: 90 });
    expect(extents.halfXM).toBeCloseTo(0.8, 6);
    expect(extents.halfYM).toBeCloseTo(1.4, 6);
  });
});

describe("moveBlockTo", () => {
  it("snaps to ten centimetres", () => {
    const moved = moveBlockTo(BLOCK, { centerXM: 3.34, centerYM: 2.46 }, { area: AREA, snap: true });
    expect(moved).toMatchObject({ centerXM: 3.3, centerYM: 2.5 });
  });

  it("keeps millimetre precision with snap off", () => {
    const moved = moveBlockTo(BLOCK, { centerXM: 3.3412, centerYM: 2.4567 }, { area: AREA, snap: false });
    expect(moved).toMatchObject({ centerXM: 3.341, centerYM: 2.457 });
  });

  it("allows twenty centimetres of overhang and no more", () => {
    const moved = moveBlockTo(BLOCK, { centerXM: -50, centerYM: -50 }, { area: AREA, snap: false });
    expect(moved.centerXM).toBeCloseTo(1.4 - OVERHANG_TOLERANCE_M, 6);
    expect(moved.centerYM).toBeCloseTo(0.8 - OVERHANG_TOLERANCE_M, 6);
  });

  it("clamps against the downstage and right edges too", () => {
    const moved = moveBlockTo(BLOCK, { centerXM: 99, centerYM: 99 }, { area: AREA, snap: false });
    expect(moved.centerXM).toBeCloseTo(12 - 1.4 + OVERHANG_TOLERANCE_M, 6);
    expect(moved.centerYM).toBeCloseTo(8 - 0.8 + OVERHANG_TOLERANCE_M, 6);
  });

  it("centres a zone that is wider than the stage instead of pinning it", () => {
    const narrow: StageplanStageSize = { widthM: 2, depthM: 8 };
    const moved = moveBlockTo(BLOCK, { centerXM: 0, centerYM: 4 }, { area: narrow, snap: false });
    expect(moved.centerXM).toBe(1);
  });

  it("leaves the rotation untouched", () => {
    const rotated = { ...BLOCK, rotationDeg: 30 };
    expect(moveBlockTo(rotated, { centerXM: 5, centerYM: 5 }, { area: AREA, snap: true }).rotationDeg).toBe(30);
  });
});

describe("nudgeBlockBy", () => {
  it("moves by the exact step without snapping to the grid", () => {
    const start = { ...BLOCK, centerXM: 6.05 };
    expect(nudgeBlockBy(start, { xM: 0.1, yM: 0 }, { area: AREA }).centerXM).toBe(6.15);
  });

  it("clamps like a drag does", () => {
    const start = { ...BLOCK, centerXM: 1.2 };
    expect(nudgeBlockBy(start, { xM: -1, yM: 0 }, { area: AREA }).centerXM).toBeCloseTo(1.2, 6);
  });
});

describe("rotateBlockTo", () => {
  it("snaps to fifteen degrees", () => {
    expect(rotateBlockTo(BLOCK, 37, { area: AREA, snap: true }).rotationDeg).toBe(30);
  });

  it("keeps single degrees with snap off", () => {
    expect(rotateBlockTo(BLOCK, 37.4, { area: AREA, snap: false }).rotationDeg).toBe(37);
  });

  it("normalizes into 0-359", () => {
    expect(rotateBlockTo(BLOCK, -15, { area: AREA, snap: true }).rotationDeg).toBe(345);
    expect(rotateBlockTo(BLOCK, 360, { area: AREA, snap: true }).rotationDeg).toBe(0);
  });

  it("pulls a block back onto the area when rotation grows its footprint", () => {
    const corner = { ...BLOCK, centerXM: 1.2, centerYM: 4 };
    const rotated = rotateBlockTo(corner, 90, { area: AREA, snap: true });
    expect(rotated.centerXM).toBeCloseTo(0.6, 6);
  });
});

describe("rotateBlockBy", () => {
  it("adds the delta and re-snaps", () => {
    expect(rotateBlockBy({ ...BLOCK, rotationDeg: 30 }, 15, { area: AREA, snap: true }).rotationDeg).toBe(45);
    expect(rotateBlockBy({ ...BLOCK, rotationDeg: 7 }, -15, { area: AREA, snap: true }).rotationDeg).toBe(0);
  });
});

describe("clampToArea", () => {
  it("leaves a block that already fits alone", () => {
    expect(clampToArea(BLOCK, AREA)).toEqual(BLOCK);
  });
});
```

- [ ] **Step 2: Spustit test a ověřit, že padá**

Run: `npx vitest run src/domain/stageplan/layout/blockOps.test.ts`
Expected: FAIL — `Failed to resolve import "./blockOps.js"`

- [ ] **Step 3: Napsat operace**

Vytvoř `src/domain/stageplan/layout/blockOps.ts`:

```ts
import type { StageplanBlock, StageplanStageSize } from "../../model/types.js";
import { roundDeg, roundM } from "./round.js";

export const SNAP_STEP_M = 0.1;
export const SNAP_STEP_DEG = 15;
/** Pódia bývají nepravidelná, takže blok smí kousek přesahovat za hranu. */
export const OVERHANG_TOLERANCE_M = 0.2;

type Zone = Pick<StageplanBlock, "widthM" | "depthM" | "rotationDeg">;

/** Poloosy opsaného obdélníku otočené zóny — clamp musí počítat s rotací. */
export function rotatedHalfExtents(zone: Zone): {
  halfXM: number;
  halfYM: number;
} {
  const radians = (zone.rotationDeg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  return {
    halfXM: (zone.widthM * cos + zone.depthM * sin) / 2,
    halfYM: (zone.widthM * sin + zone.depthM * cos) / 2,
  };
}

function clampAxis(value: number, halfM: number, extentM: number): number {
  const min = halfM - OVERHANG_TOLERANCE_M;
  const max = extentM - halfM + OVERHANG_TOLERANCE_M;
  // Zóna širší než plocha: pinovat ji k jedné hraně by lhalo, patří na střed.
  if (min > max) return extentM / 2;
  return Math.min(Math.max(value, min), max);
}

export function clampToArea(
  block: StageplanBlock,
  area: StageplanStageSize,
): StageplanBlock {
  const { halfXM, halfYM } = rotatedHalfExtents(block);
  return {
    ...block,
    centerXM: roundM(clampAxis(block.centerXM, halfXM, area.widthM)),
    centerYM: roundM(clampAxis(block.centerYM, halfYM, area.depthM)),
  };
}

function snapM(value: number): number {
  return roundM(Math.round(value / SNAP_STEP_M) * SNAP_STEP_M);
}

/**
 * Pořadí je snap → clamp → zaokrouhlení. Blok opřený o hranu proto nemusí
 * ležet na mřížce; to je správně, hrana pódia má přednost před mřížkou.
 */
export function moveBlockTo(
  block: StageplanBlock,
  target: { readonly centerXM: number; readonly centerYM: number },
  options: { readonly area: StageplanStageSize; readonly snap: boolean },
): StageplanBlock {
  const next = options.snap
    ? { centerXM: snapM(target.centerXM), centerYM: snapM(target.centerYM) }
    : { centerXM: roundM(target.centerXM), centerYM: roundM(target.centerYM) };
  return clampToArea({ ...block, ...next }, options.area);
}

/** Klávesnice posouvá o přesný krok, takže se na mřížku nesnapuje. */
export function nudgeBlockBy(
  block: StageplanBlock,
  delta: { readonly xM: number; readonly yM: number },
  options: { readonly area: StageplanStageSize },
): StageplanBlock {
  return clampToArea(
    {
      ...block,
      centerXM: roundM(block.centerXM + delta.xM),
      centerYM: roundM(block.centerYM + delta.yM),
    },
    options.area,
  );
}

export function rotateBlockTo(
  block: StageplanBlock,
  deg: number,
  options: { readonly area: StageplanStageSize; readonly snap: boolean },
): StageplanBlock {
  const snapped = options.snap
    ? Math.round(deg / SNAP_STEP_DEG) * SNAP_STEP_DEG
    : deg;
  // Otočení zvětší opsaný obdélník, takže blok u hrany se musí vrátit na plochu.
  return clampToArea(
    { ...block, rotationDeg: roundDeg(snapped) },
    options.area,
  );
}

export function rotateBlockBy(
  block: StageplanBlock,
  deltaDeg: number,
  options: { readonly area: StageplanStageSize; readonly snap: boolean },
): StageplanBlock {
  return rotateBlockTo(block, block.rotationDeg + deltaDeg, options);
}
```

- [ ] **Step 4: Spustit test a ověřit, že prochází**

Run: `npx vitest run src/domain/stageplan/layout/blockOps.test.ts`
Expected: PASS, 16 testů

- [ ] **Step 5: Commit**

```bash
git add src/domain/stageplan/layout/blockOps.ts src/domain/stageplan/layout/blockOps.test.ts
git commit -m "feat(stageplan): add snapping, clamping and rotation for stage plan blocks"
```

---

### Task 5: Přeškálování pódia, dirty stav a měřítko plochy

**Files:**
- Create: `src/domain/stageplan/layout/rescaleForStage.ts`
- Create: `src/domain/stageplan/layout/rescaleForStage.test.ts`
- Create: `src/domain/stageplan/layout/dirty.ts`
- Create: `src/domain/stageplan/layout/dirty.test.ts`
- Create: `src/domain/stageplan/layout/scale.ts`
- Create: `src/domain/stageplan/layout/scale.test.ts`

**Interfaces:**
- Consumes: `NOMINAL_STAGE` (Task 2), `clampToArea` (Task 4), `roundM`, `roundDeg` (Task 2).
- Produces: `rescaleForStage(layout, nextStage: StageplanStageSize | null): StageplanLayout`; `isStageplanLayoutDirty(initial: StageplanLayout | undefined, current: StageplanLayout): boolean`; `createStageScale(area: StageplanStageSize, viewport: { widthPx: number; heightPx: number }): StageScale` s `StageScale = { pxPerM: number; widthPx: number; heightPx: number; toPx(m: number): number; toM(px: number): number }`.

- [ ] **Step 1: Napsat padající testy všech tří modulů**

Vytvoř `src/domain/stageplan/layout/rescaleForStage.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { StageplanLayout } from "../../model/types.js";
import { rescaleForStage } from "./rescaleForStage.js";

const NOMINAL_LAYOUT: StageplanLayout = {
  stage: null,
  blocks: [
    { slot: "drums", centerXM: 6, centerYM: 1.2, widthM: 2.8, depthM: 1.6, rotationDeg: 0 },
    { slot: "keys", centerXM: 9.4, centerYM: 5.5, widthM: 2.8, depthM: 1.4, rotationDeg: 0 },
  ],
};

describe("rescaleForStage", () => {
  it("scales centres proportionally from the nominal area", () => {
    const rescaled = rescaleForStage(NOMINAL_LAYOUT, { widthM: 6, depthM: 4 });

    expect(rescaled.blocks[0]).toMatchObject({ centerXM: 3, centerYM: 0.6 });
  });

  it("keeps zone sizes — a drummer needs the same space on any stage", () => {
    const rescaled = rescaleForStage(NOMINAL_LAYOUT, { widthM: 6, depthM: 4 });

    expect(rescaled.blocks.map((block) => block.widthM)).toEqual([2.8, 2.8]);
  });

  it("stores the new stage size", () => {
    expect(rescaleForStage(NOMINAL_LAYOUT, { widthM: 10, depthM: 6 }).stage).toEqual({
      widthM: 10,
      depthM: 6,
    });
  });

  it("scales back onto the nominal area when the size is cleared", () => {
    const sized = rescaleForStage(NOMINAL_LAYOUT, { widthM: 6, depthM: 4 });
    const cleared = rescaleForStage(sized, null);

    expect(cleared.stage).toBeNull();
    expect(cleared.blocks[0]?.centerXM).toBeCloseTo(6, 3);
  });

  it("keeps every block on the shrunken area", () => {
    const rescaled = rescaleForStage(NOMINAL_LAYOUT, { widthM: 6, depthM: 4 });

    for (const block of rescaled.blocks) {
      expect(block.centerXM).toBeLessThanOrEqual(6);
      expect(block.centerYM).toBeLessThanOrEqual(4);
    }
  });
});
```

Vytvoř `src/domain/stageplan/layout/dirty.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { StageplanLayout } from "../../model/types.js";
import { isStageplanLayoutDirty } from "./dirty.js";

const LAYOUT: StageplanLayout = {
  stage: null,
  blocks: [
    { slot: "drums", centerXM: 6, centerYM: 1.2, widthM: 2.8, depthM: 1.6, rotationDeg: 0 },
    { slot: "bass", centerXM: 9.4, centerYM: 1.2, widthM: 2.7, depthM: 1.4, rotationDeg: 0 },
  ],
};

describe("isStageplanLayoutDirty", () => {
  it("is clean against an identical layout", () => {
    expect(isStageplanLayoutDirty(LAYOUT, { ...LAYOUT })).toBe(false);
  });

  it("ignores block order", () => {
    const reordered: StageplanLayout = {
      stage: LAYOUT.stage,
      blocks: [...LAYOUT.blocks].reverse(),
    };

    expect(isStageplanLayoutDirty(LAYOUT, reordered)).toBe(false);
  });

  it("ignores rounding noise below a millimetre", () => {
    const noisy: StageplanLayout = {
      stage: LAYOUT.stage,
      blocks: LAYOUT.blocks.map((block) => ({
        ...block,
        centerXM: block.centerXM + 0.00004,
      })),
    };

    expect(isStageplanLayoutDirty(LAYOUT, noisy)).toBe(false);
  });

  it("sees a moved block", () => {
    const moved: StageplanLayout = {
      stage: LAYOUT.stage,
      blocks: LAYOUT.blocks.map((block, index) =>
        index === 0 ? { ...block, centerXM: 5.9 } : block,
      ),
    };

    expect(isStageplanLayoutDirty(LAYOUT, moved)).toBe(true);
  });

  it("sees a rotated block, a changed stage size and a removed block", () => {
    expect(
      isStageplanLayoutDirty(LAYOUT, {
        stage: LAYOUT.stage,
        blocks: LAYOUT.blocks.map((block, index) =>
          index === 0 ? { ...block, rotationDeg: 15 } : block,
        ),
      }),
    ).toBe(true);
    expect(
      isStageplanLayoutDirty(LAYOUT, { stage: { widthM: 10, depthM: 6 }, blocks: LAYOUT.blocks }),
    ).toBe(true);
    expect(
      isStageplanLayoutDirty(LAYOUT, { stage: LAYOUT.stage, blocks: [LAYOUT.blocks[0]] }),
    ).toBe(true);
  });

  it("treats a missing initial layout as dirty once blocks exist", () => {
    expect(isStageplanLayoutDirty(undefined, LAYOUT)).toBe(true);
  });
});
```

Vytvoř `src/domain/stageplan/layout/scale.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createStageScale } from "./scale.js";

const AREA = { widthM: 12, depthM: 8 };

describe("createStageScale", () => {
  it("fits the area into the viewport without distorting it", () => {
    const scale = createStageScale(AREA, { widthPx: 1200, heightPx: 600 });

    expect(scale.pxPerM).toBe(75);
    expect(scale.widthPx).toBe(900);
    expect(scale.heightPx).toBe(600);
  });

  it("is limited by width when the viewport is tall", () => {
    const scale = createStageScale(AREA, { widthPx: 600, heightPx: 2000 });

    expect(scale.pxPerM).toBe(50);
  });

  it("round trips metres through pixels", () => {
    const scale = createStageScale(AREA, { widthPx: 1000, heightPx: 700 });

    expect(scale.toM(scale.toPx(4.237))).toBeCloseTo(4.237, 6);
  });

  it("never returns a zero or negative scale for a collapsed viewport", () => {
    const scale = createStageScale(AREA, { widthPx: 0, heightPx: 0 });

    expect(scale.pxPerM).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Spustit testy a ověřit, že padají**

Run: `npx vitest run src/domain/stageplan/layout/rescaleForStage.test.ts src/domain/stageplan/layout/dirty.test.ts src/domain/stageplan/layout/scale.test.ts`
Expected: FAIL — tři nevyřešené importy

- [ ] **Step 3: Napsat přeškálování**

Vytvoř `src/domain/stageplan/layout/rescaleForStage.ts`:

```ts
import type { StageplanLayout, StageplanStageSize } from "../../model/types.js";
import { clampToArea } from "./blockOps.js";
import { NOMINAL_STAGE } from "./defaultLayout.js";
import { roundM } from "./round.js";

/**
 * Volá se **výhradně** při explicitní změně rozměru pódia, nikdy při načtení.
 * Pozice drží tvar rozestavění, rozměry zón se nemění — na malém pódiu se tedy
 * zóny mohou překrývat, což je pravdivá informace, ne chyba k uklizení.
 */
export function rescaleForStage(
  layout: StageplanLayout,
  nextStage: StageplanStageSize | null,
): StageplanLayout {
  const from = layout.stage ?? NOMINAL_STAGE;
  const to = nextStage ?? NOMINAL_STAGE;
  const scaleX = to.widthM / from.widthM;
  const scaleY = to.depthM / from.depthM;

  const blocks = layout.blocks.map((block) =>
    clampToArea(
      {
        ...block,
        centerXM: roundM(block.centerXM * scaleX),
        centerYM: roundM(block.centerYM * scaleY),
      },
      to,
    ),
  );

  return { stage: nextStage, blocks };
}
```

- [ ] **Step 4: Napsat dirty a měřítko**

Vytvoř `src/domain/stageplan/layout/dirty.ts`:

```ts
import type { StageplanLayout } from "../../model/types.js";
import { roundDeg, roundM } from "./round.js";

/**
 * Porovnává zaokrouhlené hodnoty a nezávisle na pořadí bloků, takže dirty
 * stav nezapne float šum z tažení ani přeskládané pole.
 */
function serialize(layout: StageplanLayout | undefined): string {
  if (!layout) return "";
  const stage = layout.stage
    ? `${roundM(layout.stage.widthM)}x${roundM(layout.stage.depthM)}`
    : "none";
  const blocks = [...layout.blocks]
    .sort((a, b) => a.slot.localeCompare(b.slot))
    .map((block) =>
      [
        block.slot,
        roundM(block.centerXM),
        roundM(block.centerYM),
        roundM(block.widthM),
        roundM(block.depthM),
        roundDeg(block.rotationDeg),
      ].join(","),
    )
    .join("|");
  return `${stage}#${blocks}`;
}

export function isStageplanLayoutDirty(
  initial: StageplanLayout | undefined,
  current: StageplanLayout,
): boolean {
  return serialize(initial) !== serialize(current);
}
```

Vytvoř `src/domain/stageplan/layout/scale.ts`:

```ts
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
```

- [ ] **Step 5: Spustit testy a ověřit, že prochází**

Run: `npx vitest run src/domain/stageplan/layout`
Expected: PASS — všech pět souborů v modulu

- [ ] **Step 6: Spustit celou sadu a lint**

Run: `npm test && npm run lint`
Expected: bez nových chyb proti baseline

- [ ] **Step 7: Commit**

```bash
git add src/domain/stageplan/layout
git commit -m "feat(stageplan): rescale layout for a stage size, detect dirty state and fit the canvas scale"
```

---

### Task 6: Persistence — payload nese `stageplan`

**Files:**
- Modify: `packages/desktop/src/app/shell/types.ts:79-169`
- Test: `packages/desktop/src/app/shell/types.test.ts` (přidat případy)
- Create: `packages/desktop/src/app/domain/stageplan/resolveBlockSlotsFromPayload.ts`
- Create: `packages/desktop/src/app/domain/stageplan/resolveBlockSlotsFromPayload.test.ts`

**Interfaces:**
- Consumes: `StageplanLayout`, `PowerRequirement` (Task 1), `resolveStageplanBlockSlots` (Task 3).
- Produces: `NewProjectPayload.stageplan?: { powerOverridesByMusician?: Record<string, PowerRequirement>; layout?: StageplanLayout }`; `resolveBlockSlotsFromPayload(payload: Pick<NewProjectPayload, "lineup" | "overlays">): StageplanBlockSlot[]`.

- [ ] **Step 1: Napsat padající test persistence**

Do `packages/desktop/src/app/shell/types.test.ts` přidej nový `describe`:

```ts
describe("toPersistableProject stageplan persistence", () => {
  const layout = {
    stage: { widthM: 10, depthM: 6 },
    blocks: [
      { slot: "drums" as const, centerXM: 1.5, centerYM: 4.2, widthM: 2.8, depthM: 1.6, rotationDeg: 45 },
    ],
  };

  it("keeps the stage plan layout", () => {
    const persisted = toPersistableProject({
      id: "p-5",
      purpose: "event",
      eventDate: "2026-06-01",
      eventVenue: "Arena",
      bandRef: "band-1",
      documentDate: "2026-06-01",
      createdAt: "2026-01-01T00:00:00.000Z",
      stageplan: { layout },
    });

    expect(persisted.stageplan?.layout).toEqual(layout);
  });

  it("keeps the layout when a lineup change is saved from the setup screen", () => {
    const persisted = toPersistableProject({
      id: "p-6",
      purpose: "event",
      eventDate: "2026-06-01",
      eventVenue: "Arena",
      bandRef: "band-1",
      documentDate: "2026-06-01",
      createdAt: "2026-01-01T00:00:00.000Z",
      lineup: { drums: "drummer-2", bass: "bass-1" },
      stageplan: { layout, powerOverridesByMusician: { "bass-1": { voltage: 230, sockets: 5 } } },
    });

    expect(persisted.stageplan?.layout).toEqual(layout);
    expect(persisted.stageplan?.powerOverridesByMusician).toEqual({
      "bass-1": { voltage: 230, sockets: 5 },
    });
  });

  it("omits the stageplan key entirely when there is nothing to store", () => {
    const persisted = toPersistableProject({
      id: "p-7",
      purpose: "generic",
      bandRef: "band-1",
      documentDate: "2026-01-01",
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    expect("stageplan" in persisted).toBe(false);
  });
});
```

- [ ] **Step 2: Spustit test a ověřit, že padá**

Run: `npx vitest run packages/desktop/src/app/shell/types.test.ts`
Expected: FAIL — `stageplan` není v `NewProjectPayload`, TS chyba i neúspěšné assertions

- [ ] **Step 3: Rozšířit payload a whitelist**

V `packages/desktop/src/app/shell/types.ts` uprav import doménových typů:

```ts
import type {
  MusicianSetupPreset,
  PowerRequirement,
  PresetEntity,
  PresetItem,
  StageplanLayout,
} from "../../../../../src/domain/model/types";
```

Do `NewProjectPayload` doplň za `talkbackOverride` a `hasTalkbackOverride`:

```ts
  /**
   * Stage plan projektu. Whitelist v `toPersistableProject` ho musí nést
   * výslovně — jinak by uložení z jiné obrazovky smazalo ruční rozmístění.
   */
  stageplan?: {
    powerOverridesByMusician?: Record<string, PowerRequirement>;
    layout?: StageplanLayout;
  };
```

V `toPersistableProject` přidej `stageplan` do destrukturalizace (za `note`) a na konec návratového objektu:

```ts
    ...(bandLeaderId ? { bandLeaderId } : {}),
    ...(stageplan ? { stageplan } : {}),
  };
```

- [ ] **Step 4: Spustit test a ověřit, že prochází**

Run: `npx vitest run packages/desktop/src/app/shell/types.test.ts`
Expected: PASS

- [ ] **Step 5: Napsat padající test adaptéru**

Vytvoř `packages/desktop/src/app/domain/stageplan/resolveBlockSlotsFromPayload.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { resolveBlockSlotsFromPayload } from "./resolveBlockSlotsFromPayload";

describe("resolveBlockSlotsFromPayload", () => {
  it("reads plain string lineup entries", () => {
    const slots = resolveBlockSlotsFromPayload({
      lineup: { drums: "d1", bass: "b1" },
      overlays: { leadVocals: ["v1"] },
    });

    expect(slots).toEqual(["drums", "bass", "lead_voc_1"]);
  });

  it("reads array and object lineup entries", () => {
    const slots = resolveBlockSlotsFromPayload({
      lineup: { keys: [{ musicianId: "k1" }], guitar: ["g1", "g2"] },
    });

    expect(slots).toEqual(["guitar", "keys"]);
  });

  it("falls back to lineup vocs when there is no lead vocal overlay", () => {
    const slots = resolveBlockSlotsFromPayload({
      lineup: { drums: "d1", vocs: ["v1", "v2"] },
    });

    expect(slots).toEqual(["drums", "lead_voc_1", "lead_voc_2"]);
  });

  it("ignores empty and blank entries", () => {
    const slots = resolveBlockSlotsFromPayload({
      lineup: { drums: "", bass: [], keys: "k1" },
    });

    expect(slots).toEqual(["keys"]);
  });

  it("returns nothing for a project without a lineup", () => {
    expect(resolveBlockSlotsFromPayload({})).toEqual([]);
  });
});
```

- [ ] **Step 6: Spustit test a ověřit, že padá**

Run: `npx vitest run packages/desktop/src/app/domain/stageplan/resolveBlockSlotsFromPayload.test.ts`
Expected: FAIL — nevyřešený import

- [ ] **Step 7: Napsat adaptér**

Vytvoř `packages/desktop/src/app/domain/stageplan/resolveBlockSlotsFromPayload.ts`:

```ts
import type { StageplanBlockSlot } from "../../../../../../src/domain/model/types";
import { resolveStageplanBlockSlots } from "../../../../../../src/domain/stageplan/layout/resolveBlockSlots";
import type { LineupEntry, RichLineupValue } from "../../../projectRules";
import type { NewProjectPayload } from "../../shell/types";

/** Lineup v payloadu smí být string, objekt, nebo pole obojího. */
function toMusicianIds(value: RichLineupValue | undefined): string[] {
  if (value === undefined) return [];
  const entries: LineupEntry[] = Array.isArray(value) ? value : [value];
  return entries.flatMap((entry) => {
    const id = typeof entry === "string" ? entry : entry.musicianId;
    const trimmed = id?.trim() ?? "";
    return trimmed ? [trimmed] : [];
  });
}

/**
 * Most mezi payloadem obrazovky a doménovým pravidlem. Když projekt nemá
 * overlay lead vokálů, bere se obsazení skupiny `vocs` — starší projekty
 * overlay nenesou.
 */
export function resolveBlockSlotsFromPayload(
  payload: Pick<NewProjectPayload, "lineup" | "overlays">,
): StageplanBlockSlot[] {
  const leadVocalIds =
    payload.overlays?.leadVocals ?? toMusicianIds(payload.lineup?.vocs);

  return resolveStageplanBlockSlots({
    musicianIdsByGroup: {
      drums: toMusicianIds(payload.lineup?.drums),
      bass: toMusicianIds(payload.lineup?.bass),
      guitar: toMusicianIds(payload.lineup?.guitar),
      keys: toMusicianIds(payload.lineup?.keys),
    },
    leadVocalIds,
  });
}
```

- [ ] **Step 8: Spustit testy a lint**

Run: `npx vitest run packages/desktop/src/app/domain/stageplan packages/desktop/src/app/shell/types.test.ts && npm run lint`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add packages/desktop/src/app/shell/types.ts packages/desktop/src/app/shell/types.test.ts packages/desktop/src/app/domain/stageplan
git commit -m "feat(stageplan): persist the layout in the project payload and derive slots from it"
```

---

### Task 7: Routa `/projects/:id/stageplan` a procesní stopa

**Files:**
- Modify: `packages/desktop/src/app/shell/routes.ts:5-25` (SHELL_ROUTES) a sekce s `match*` funkcemi
- Modify: `packages/desktop/src/app/shell/chrome/processSteps.ts:30-72`
- Test: `packages/desktop/src/app/shell/chrome/processSteps.test.ts`

**Interfaces:**
- Produces: `matchProjectStageplanPath(pathname: string): string | null`; krok `stageplan` s `segment: "stageplan"`.

- [ ] **Step 1: Napsat padající testy procesní stopy**

V `packages/desktop/src/app/shell/chrome/processSteps.test.ts` uprav test `leaves the steps without a screen unavailable and unlinked` tak, aby hlídal už jen `inputs`:

```ts
  it("leaves the inputs step unavailable and unlinked — the screen is still missing", () => {
    for (const pathname of ["/projects/p1/setup", "/projects/p1/preview", "/projects/p1/stageplan"]) {
      const trail = buildProcessSteps(pathname);
      const step = trail?.find((s) => s.id === "inputs");
      expect(step?.state, `inputs on ${pathname}`).toBe("unavailable");
      expect(step?.path, `inputs on ${pathname}`).toBeNull();
    }
  });
```

A přidej:

```ts
  it("marks the stage plan as the current step on its own route", () => {
    const trail = buildProcessSteps("/projects/p1/stageplan");
    const step = trail?.find((s) => s.id === "stageplan");
    expect(step?.state).toBe("current");
    expect(step?.path).toBeNull();
  });

  it("offers the stage plan as a link from the other project screens", () => {
    for (const pathname of ["/projects/p1/setup", "/projects/p1/preview"]) {
      const step = buildProcessSteps(pathname)?.find((s) => s.id === "stageplan");
      expect(step?.state, pathname).toBe("available");
      expect(step?.path, pathname).toBe("/projects/p1/stageplan");
    }
  });

  it("still offers lineup and export while on the stage plan", () => {
    const trail = buildProcessSteps("/projects/p1/stageplan");
    expect(trail?.find((s) => s.id === "lineup")?.path).toBe("/projects/p1/setup");
    expect(trail?.find((s) => s.id === "export")?.path).toBe("/projects/p1/preview");
  });
```

- [ ] **Step 2: Spustit test a ověřit, že padá**

Run: `npx vitest run packages/desktop/src/app/shell/chrome/processSteps.test.ts`
Expected: FAIL — `stageplan` je `unavailable`, na nové routě vrací trail `null`

- [ ] **Step 3: Přidat routu**

V `packages/desktop/src/app/shell/routes.ts` přidej do `SHELL_ROUTES` za `project-setup`:

```ts
  { key: "project-stageplan", test: (pathname) => Boolean(matchProjectStageplanPath(pathname)) },
```

a k ostatním `match*` funkcím:

```ts
export function matchProjectStageplanPath(pathname: string): string | null {
  return pathname.match(/^\/projects\/([^/]+)\/stageplan$/)?.[1] ?? null;
}
```

- [ ] **Step 4: Odemknout krok v procesní stopě**

V `packages/desktop/src/app/shell/chrome/processSteps.ts` uprav import a `STEPS`:

```ts
import {
  matchProjectPreviewPath,
  matchProjectSetupPath,
  matchProjectStageplanPath,
} from "../routes";
```

```ts
  { id: "stageplan", label: "STAGE PLAN", segment: "stageplan" },
```

a v `buildProcessSteps` nahraď určení projektu a aktuálního kroku:

```ts
  const setupProjectId = matchProjectSetupPath(pathname);
  const stageplanProjectId = matchProjectStageplanPath(pathname);
  const projectId =
    setupProjectId ?? stageplanProjectId ?? matchProjectPreviewPath(pathname);
  if (projectId === null) return null;

  const currentId: StepId =
    setupProjectId !== null
      ? "lineup"
      : stageplanProjectId !== null
        ? "stageplan"
        : "export";
```

Uprav i komentář v hlavičce souboru — `02 INPUTS` je nadále jediný krok bez obrazovky.

- [ ] **Step 5: Spustit test a ověřit, že prochází**

Run: `npx vitest run packages/desktop/src/app/shell/chrome/processSteps.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/desktop/src/app/shell/routes.ts packages/desktop/src/app/shell/chrome/processSteps.ts packages/desktop/src/app/shell/chrome/processSteps.test.ts
git commit -m "feat(stageplan): route the stage plan screen and unlock its process step"
```

---

### Task 8: Sémantické roly editoru a kontrastní test

**Files:**
- Modify: `packages/desktop/src/styles/semantic.css` (bloky `:root` i `:root[data-theme="dark"]`)
- Modify: `packages/desktop/src/styles/semantic.contrast.test.ts`

**Interfaces:**
- Produces: `--color-stage-canvas`, `--color-stage-grid`, `--color-stage-block`, `--color-stage-block-selected`, `--color-stage-border`, `--color-stage-border-soft`, `--color-stage-text`, `--color-stage-text-mid`, `--color-stage-text-dim`.

- [ ] **Step 1: Rozšířit kontrastní test**

V `packages/desktop/src/styles/semantic.contrast.test.ts` doplň za `SURFACES`:

```ts
/** Editor stage planu je tmavý v obou tématech, takže roly platí pro oba. */
const STAGE_SURFACES = [
  "--color-stage-canvas",
  "--color-stage-block",
  "--color-stage-block-selected",
] as const;

const STAGE_TEXT: readonly { fg: string; what: string }[] = [
  { fg: "--color-stage-text", what: "stage text" },
  { fg: "--color-stage-text-mid", what: "stage mid text" },
  { fg: "--color-stage-text-dim", what: "stage dim text" },
];
```

a do `buildPairs()` přidej:

```ts
  for (const { fg, what } of STAGE_TEXT) {
    for (const background of STAGE_SURFACES) {
      pairs.push({
        foreground: fg,
        background,
        minimum: AA_NORMAL_TEXT,
        what: `${what} on ${background.replace("--color-stage-", "stage ")}`,
      });
    }
  }
```

- [ ] **Step 2: Spustit test a ověřit, že padá**

Run: `npx vitest run packages/desktop/src/styles/semantic.contrast.test.ts`
Expected: FAIL — `Token is not defined: --color-stage-canvas`

- [ ] **Step 3: Přidat roly do obou témat**

V `packages/desktop/src/styles/semantic.css` vlož **stejný blok** do `:root` i do `:root[data-theme="dark"]`, vedle rolí titlebaru (které jsou tam duplikované z téhož důvodu):

```css
  /* Stage plan editor: tmavý v obou tématech. Plán je pracovní plocha, ne
     dokument — na světlém papíře by mřížka i vybraný blok ztratily kontrast. */
  --color-stage-canvas: var(--sp-canvas);
  --color-stage-grid: var(--sp-block);
  --color-stage-block: var(--sp-block);
  --color-stage-block-selected: var(--sp-block-selected);
  --color-stage-border: var(--sp-border-dark);
  --color-stage-border-soft: var(--sp-border-dark-2);
  --color-stage-text: var(--sp-text-dark);
  --color-stage-text-mid: var(--sp-text-dark-mid);
  --color-stage-text-dim: var(--sp-text-dark-dim);
  /* Handoff: blok 0 2px 8px rgba(0,0,0,.3), vybraný 0 10px 28px rgba(255,91,31,.22). */
  --elevation-block: 0 2px 8px rgba(0, 0, 0, 0.3);
  --elevation-block-selected: 0 10px 28px rgba(255, 91, 31, 0.22);
```

- [ ] **Step 4: Spustit test a ověřit, že prochází**

Run: `npx vitest run packages/desktop/src/styles/semantic.contrast.test.ts`
Expected: PASS — devět nových párů, všechny nad 4,5:1

- [ ] **Step 5: Commit**

```bash
git add packages/desktop/src/styles/semantic.css packages/desktop/src/styles/semantic.contrast.test.ts
git commit -m "feat(stageplan): add always-dark semantic roles for the stage plan editor"
```

---

### Task 9: Obrazovka editoru, plocha a bloky bez interakce

**Files:**
- Create: `packages/desktop/src/app/pages/StagePlanEditorPage.tsx`
- Create: `packages/desktop/src/app/components/stageplan/EditorToolbar.tsx`
- Create: `packages/desktop/src/app/components/stageplan/StageCanvas.tsx`
- Create: `packages/desktop/src/app/components/stageplan/StageBlock.tsx`
- Create: `packages/desktop/src/app/components/stageplan/useStageViewport.ts`
- Create: `packages/desktop/src/app/components/stageplan/blockContent.ts`
- Create: `packages/desktop/src/styles/features/stageplan-editor.css`
- Modify: `packages/desktop/src/styles/app.css` (import nového souboru)
- Modify: `packages/desktop/src/app/pages/index.ts` (export stránky)
- Modify: `packages/desktop/src/app/shell/ShellRouter.tsx` (napojení routy)

**Interfaces:**
- Consumes: `mergeWithLineup` (Task 3), `NOMINAL_STAGE` (Task 2), `createStageScale` (Task 5), `resolveBlockSlotsFromPayload` (Task 6), `matchProjectStageplanPath` (Task 7), roly `--color-stage-*` (Task 8), `readProject`, `parseProjectPayload` (existující `services/projectsApi`), `ProjectRouteProps` (existující `pages/shared/pageTypes`).
- Produces: `StagePlanEditorPage` (komponenta s `ProjectRouteProps`); `useStageViewport(): { ref, viewport }`; `LABEL_BY_SLOT: Record<StageplanBlockSlot, string>` v `blockContent.ts`.

**Poznámka k testování:** tahle a všechny další úlohy jsou React bez jsdom, takže **testy tu nejsou** — ověřuje se `npm run lint`, `npm test` (že nic nerozbily) a ruční kontrola v `npm run dev`. Když `npm run dev` spadne na obsazeném portu 1420, uvolni ho; Vite je na `--strictPort`.

- [ ] **Step 1: Napsat popisky slotů**

Vytvoř `packages/desktop/src/app/components/stageplan/blockContent.ts`:

```ts
import type { StageplanBlockSlot } from "../../../../../../src/domain/model/types";

/** Popisek bloku na ploše. Mono, uppercase — jako tiskové slotové hlavičky. */
export const LABEL_BY_SLOT: Readonly<Record<StageplanBlockSlot, string>> = {
  drums: "DRUMS",
  bass: "BASS",
  guitar: "EL. GUITAR",
  keys: "KEYS",
  lead_voc_1: "LEAD VOC 1",
  lead_voc_2: "LEAD VOC 2",
};

export function formatMeters(value: number): string {
  return `${value.toFixed(1).replace(".", ",")} m`;
}

export function formatZone(widthM: number, depthM: number): string {
  return `${formatMeters(widthM)} × ${formatMeters(depthM)}`;
}
```

- [ ] **Step 2: Napsat hook pro velikost plochy**

Vytvoř `packages/desktop/src/app/components/stageplan/useStageViewport.ts`:

```ts
import { useEffect, useRef, useState } from "react";

export type Viewport = { readonly widthPx: number; readonly heightPx: number };

/**
 * Plocha se přizpůsobuje oknu, takže měřítko musí přepočítat každá změna
 * velikosti. ResizeObserver místo window.resize — panel se mění i bez okna.
 */
export function useStageViewport() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState<Viewport>({ widthPx: 0, heightPx: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (!box) return;
      setViewport({ widthPx: box.width, heightPx: box.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, viewport };
}
```

- [ ] **Step 3: Napsat blok**

Vytvoř `packages/desktop/src/app/components/stageplan/StageBlock.tsx`:

```tsx
import type { CSSProperties } from "react";
import type { StageplanBlock } from "../../../../../../src/domain/model/types";
import type { StageScale } from "../../../../../../src/domain/stageplan/layout/scale";
import { LABEL_BY_SLOT } from "./blockContent";

type StageBlockProps = {
  block: StageplanBlock;
  scale: StageScale;
  isSelected: boolean;
  onSelect: (slot: StageplanBlock["slot"]) => void;
};

/**
 * Geometrie jde do `style` jako CSS proměnné, ne jako hotové deklarace —
 * vzhled zůstává v CSS, v komponentě je jen spočítané umístění.
 */
export function StageBlock({ block, scale, isSelected, onSelect }: StageBlockProps) {
  const geometry = {
    "--block-w": `${scale.toPx(block.widthM)}px`,
    "--block-h": `${scale.toPx(block.depthM)}px`,
    "--block-x": `${scale.toPx(block.centerXM - block.widthM / 2)}px`,
    "--block-y": `${scale.toPx(block.centerYM - block.depthM / 2)}px`,
    "--block-rot": `${block.rotationDeg}deg`,
  } as CSSProperties;

  return (
    <div
      className={`stage-block${isSelected ? " stage-block--selected" : ""}`}
      style={geometry}
      onPointerDown={() => onSelect(block.slot)}
    >
      <div className="stage-block__label">{LABEL_BY_SLOT[block.slot]}</div>
      <div className="stage-block__rotation">{block.rotationDeg}°</div>
    </div>
  );
}
```

- [ ] **Step 4: Napsat plochu**

Vytvoř `packages/desktop/src/app/components/stageplan/StageCanvas.tsx`:

```tsx
import type { CSSProperties } from "react";
import type {
  StageplanBlock,
  StageplanBlockSlot,
  StageplanStageSize,
} from "../../../../../../src/domain/model/types";
import { createStageScale } from "../../../../../../src/domain/stageplan/layout/scale";
import { StageBlock } from "./StageBlock";
import { useStageViewport } from "./useStageViewport";

type StageCanvasProps = {
  area: StageplanStageSize;
  blocks: readonly StageplanBlock[];
  selectedSlot: StageplanBlockSlot | null;
  onSelect: (slot: StageplanBlockSlot | null) => void;
};

export function StageCanvas({ area, blocks, selectedSlot, onSelect }: StageCanvasProps) {
  const { ref, viewport } = useStageViewport();
  const scale = createStageScale(area, viewport);
  const surface = {
    "--stage-w": `${scale.widthPx}px`,
    "--stage-h": `${scale.heightPx}px`,
    /** Mřížka je půl metru, jako 30 px při 90 px/m v prototypu. */
    "--stage-grid": `${scale.toPx(0.5)}px`,
  } as CSSProperties;

  return (
    <div className="stage-canvas-frame" ref={ref}>
      <div
        className="stage-canvas"
        style={surface}
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) onSelect(null);
        }}
      >
        {blocks.map((block) => (
          <StageBlock
            key={block.slot}
            block={block}
            scale={scale}
            isSelected={block.slot === selectedSlot}
            onSelect={onSelect}
          />
        ))}
        <div className="stage-canvas__downstage">DOWNSTAGE · PUBLIKUM</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Napsat toolbar**

Vytvoř `packages/desktop/src/app/components/stageplan/EditorToolbar.tsx`:

```tsx
import type { StageplanStageSize } from "../../../../../../src/domain/model/types";
import { formatZone } from "./blockContent";

type EditorToolbarProps = {
  stage: StageplanStageSize | null;
  onOpenPreview: () => void;
};

/**
 * Nástrojové čtverce z prototypu tu nejsou: tažení i rotace fungují přímo, tak
 * by to byly ovladače bez funkce — stejný důvod, proč vypadl popisek ZOOM.
 */
export function EditorToolbar({ stage, onOpenPreview }: EditorToolbarProps) {
  return (
    <div className="stage-toolbar">
      <div className="stage-toolbar__tabs">
        <span className="stage-tab stage-tab--active">STAGE PLAN</span>
        <span className="stage-tab stage-tab--disabled">INPUT LIST</span>
        <button type="button" className="stage-tab" onClick={onOpenPreview}>
          PDF PREVIEW
        </button>
      </div>
      <div className="stage-toolbar__meta">
        {stage ? `PÓDIUM ${formatZone(stage.widthM, stage.depthM)}` : "PÓDIUM · ROZMĚR NEZADÁN"}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Napsat stránku**

Vytvoř `packages/desktop/src/app/pages/StagePlanEditorPage.tsx`:

```tsx
import { useEffect, useState } from "react";
import type {
  StageplanBlockSlot,
  StageplanLayout,
} from "../../../../../src/domain/model/types";
import { NOMINAL_STAGE } from "../../../../../src/domain/stageplan/layout/defaultLayout";
import { mergeWithLineup } from "../../../../../src/domain/stageplan/layout/mergeWithLineup";
import { EditorToolbar } from "../components/stageplan/EditorToolbar";
import { StageCanvas } from "../components/stageplan/StageCanvas";
import { resolveBlockSlotsFromPayload } from "../domain/stageplan/resolveBlockSlotsFromPayload";
import { parseProjectPayload, readProject } from "../services/projectsApi";
import type { NewProjectPayload } from "../shell/types";
import type { ProjectRouteProps } from "./shared/pageTypes";

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; project: NewProjectPayload; layout: StageplanLayout };

export function StagePlanEditorPage({ id, navigate }: ProjectRouteProps) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [selectedSlot, setSelectedSlot] = useState<StageplanBlockSlot | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const project = parseProjectPayload(await readProject(id));
        // Sloučení běží jen tady. Nikde jinde se layout nedopočítává.
        const layout = mergeWithLineup(project.stageplan?.layout, {
          slots: resolveBlockSlotsFromPayload(project),
          stage: project.stageplan?.layout?.stage ?? null,
        });
        if (cancelled) return;
        setState({ kind: "ready", project, layout });
        setSelectedSlot(layout.blocks[0]?.slot ?? null);
      } catch (error) {
        if (cancelled) return;
        setState({
          kind: "error",
          message: error instanceof Error ? error.message : "Projekt se nepodařilo načíst.",
        });
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (state.kind === "loading") return <div className="stage-editor__status">Načítám…</div>;
  if (state.kind === "error") return <div className="stage-editor__status">{state.message}</div>;

  const area = state.layout.stage ?? NOMINAL_STAGE;

  return (
    <div className="stage-editor">
      <EditorToolbar
        stage={state.layout.stage}
        onOpenPreview={() => navigate(`/projects/${encodeURIComponent(id)}/preview`)}
      />
      {state.layout.blocks.length === 0 ? (
        <div className="stage-editor__empty">
          <p>Projekt nemá obsazený lineup, takže na pódiu není co rozmístit.</p>
          <button type="button" onClick={() => navigate(`/projects/${encodeURIComponent(id)}/setup`)}>
            Otevřít Lineup Setup
          </button>
        </div>
      ) : (
        <StageCanvas
          area={area}
          blocks={state.layout.blocks}
          selectedSlot={selectedSlot}
          onSelect={setSelectedSlot}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 7: Napsat CSS**

Vytvoř `packages/desktop/src/styles/features/stageplan-editor.css`:

```css
/* ==========================================================================
   STAGE PLAN EDITOR — vždy tmavý, v obou tématech
   ========================================================================== */

.stage-editor {
  display: grid;
  grid-template-rows: auto 1fr;
  min-height: calc(100vh - 140px);
  background: var(--color-stage-canvas);
  color: var(--color-stage-text);
  border-radius: var(--sp-r-card);
  overflow: hidden;
}

.stage-editor__status,
.stage-editor__empty {
  display: grid;
  place-content: center;
  gap: var(--sp-4);
  padding: var(--sp-7);
  color: var(--color-stage-text-mid);
}

.stage-toolbar {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
  padding: var(--sp-4) var(--sp-5);
  border-bottom: 1px solid var(--color-stage-border-soft);
}

.stage-toolbar__tabs {
  display: flex;
  gap: var(--sp-2);
}

.stage-toolbar__meta {
  margin-left: auto;
  font: var(--sp-mono-xs);
  letter-spacing: 0.1em;
  color: var(--color-stage-text-dim);
}

.stage-tab {
  font: var(--sp-mono-xs);
  letter-spacing: 0.1em;
  padding: 8px 14px;
  border: 1px solid var(--color-stage-border);
  border-radius: var(--sp-r-btn);
  background: transparent;
  color: var(--color-stage-text-mid);
  cursor: pointer;
}

.stage-tab--active {
  background: var(--sp-paper);
  border-color: var(--sp-paper);
  color: var(--sp-ink);
  font-weight: 500;
}

.stage-tab--disabled {
  opacity: 0.5;
  cursor: default;
}

.stage-canvas-frame {
  display: grid;
  place-items: center;
  padding: var(--sp-5);
  min-height: 0;
}

.stage-canvas {
  position: relative;
  width: var(--stage-w);
  height: var(--stage-h);
  background-color: var(--color-stage-canvas);
  background-image: linear-gradient(var(--color-stage-grid) 1px, transparent 1px),
    linear-gradient(90deg, var(--color-stage-grid) 1px, transparent 1px);
  background-size: var(--stage-grid) var(--stage-grid);
  overflow: hidden;
  touch-action: none;
}

.stage-canvas__downstage {
  position: absolute;
  inset: auto 0 0 0;
  height: 30px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 6px;
  font: var(--sp-mono-xs);
  letter-spacing: 0.2em;
  color: var(--color-stage-text-dim);
  background: linear-gradient(180deg, transparent 0%, rgba(16, 17, 18, 0.92) 100%);
  pointer-events: none;
}

.stage-block {
  position: absolute;
  left: var(--block-x);
  top: var(--block-y);
  width: var(--block-w);
  height: var(--block-h);
  transform: rotate(var(--block-rot));
  transform-origin: center;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border: 1px solid var(--color-stage-border);
  border-radius: var(--sp-r-card);
  background: var(--color-stage-block);
  box-shadow: var(--elevation-block);
  cursor: grab;
  user-select: none;
  /* Pozice bez transition — jinak tažení drhne. Barvy ano. */
  transition: background-color 120ms ease-out, border-color 120ms ease-out;
}

.stage-block--selected {
  background: var(--color-stage-block-selected);
  border: 2px solid var(--color-primary);
  box-shadow: var(--elevation-block-selected);
}

.stage-block__label {
  font: var(--sp-mono-sm);
  letter-spacing: 0.1em;
  color: var(--color-stage-text);
}

.stage-block__rotation {
  margin-top: auto;
  align-self: flex-end;
  font: var(--sp-mono-xs);
  color: var(--color-stage-text-dim);
}
```

Všechny použité tokeny v repu existují: `--sp-mono-xs` (11 px), `--sp-mono-sm` (12 px), `--sp-mono-2xs` (10 px), radiusy `--sp-r-btn` a `--sp-r-card`, mezery `--sp-1` až `--sp-13`, `--sp-paper`, `--sp-ink`, oranžová je role `--color-primary` a text na ní `--color-primary-text`. Stíny `--elevation-block` a `--elevation-block-selected` přidala Task 8. Nezaváděj nové tokeny a nepiš barvy natvrdo.

- [ ] **Step 8: Zapojit CSS, barrel a routu**

Do `packages/desktop/src/styles/app.css` přidej za `@import "./features/preview.css";`:

```css
@import "./features/stageplan-editor.css";
```

Do `packages/desktop/src/app/pages/index.ts` přidej:

```ts
export * from "./StagePlanEditorPage";
```

V `packages/desktop/src/app/shell/ShellRouter.tsx` přidej import `StagePlanEditorPage` do seznamu z `../pages/ShellRoutedPages`, import `matchProjectStageplanPath` z `./routes`, a za blok `setupProjectId`:

```tsx
  const stageplanProjectId = matchProjectStageplanPath(pathname);
```

```tsx
  if (stageplanProjectId) {
    return (
      <StagePlanEditorPage
        id={stageplanProjectId}
        navigate={navigate}
        registerNavigationGuard={registerNavigationGuard}
        search={search}
      />
    );
  }
```

- [ ] **Step 9: Lint, testy a ruční kontrola**

Run: `npm run lint && npm test`
Expected: bez nových chyb proti baseline

Run: `npm run dev`, otevři existující projekt a přejdi na `/projects/<id>/stageplan` (klikem na krok `03 STAGE PLAN` v procesní stopě).
Expected: tmavá obrazovka, mřížka po půl metru, pět nebo šest bloků v rozestavení podle R7, pruh `DOWNSTAGE · PUBLIKUM`, popisek `PÓDIUM · ROZMĚR NEZADÁN`, klik na blok ho zvýrazní, klik do prázdna výběr zruší, změna velikosti okna plochu přepočítá.

- [ ] **Step 10: Commit**

```bash
git add packages/desktop/src/app/pages/StagePlanEditorPage.tsx packages/desktop/src/app/pages/index.ts packages/desktop/src/app/components/stageplan packages/desktop/src/app/shell/ShellRouter.tsx packages/desktop/src/styles/features/stageplan-editor.css packages/desktop/src/styles/app.css
git commit -m "feat(stageplan): draw the stage plan editor canvas with blocks from the lineup"
```

---

### Task 10: Tažení bloku a rotace úchytem

**Files:**
- Create: `packages/desktop/src/app/components/stageplan/useBlockDrag.ts`
- Modify: `packages/desktop/src/app/components/stageplan/StageBlock.tsx` (úchyt a gesta)
- Modify: `packages/desktop/src/app/components/stageplan/StageCanvas.tsx` (předání callbacků)
- Modify: `packages/desktop/src/app/pages/StagePlanEditorPage.tsx` (změna layoutu ve state)
- Modify: `packages/desktop/src/styles/features/stageplan-editor.css` (rotační úchyt, `grabbing`)

**Interfaces:**
- Consumes: `moveBlockTo`, `rotateBlockTo` (Task 4), `StageScale` (Task 5).
- Produces: `useBlockDrag(args: { scale: StageScale; area: StageplanStageSize; snap: boolean; onChange: (slot: StageplanBlockSlot, next: StageplanBlock) => void; onGestureStart: () => void; onGestureEnd: () => void }): { startMove: (event: React.PointerEvent, block: StageplanBlock) => void; startRotate: (event: React.PointerEvent, block: StageplanBlock) => void }`. `onGestureStart` se volá jednou na začátku gesta a `onGestureEnd` jednou na konci — nikdy při `pointermove`, aby jedno tažení byl jeden krok undo.

- [ ] **Step 1: Napsat hook gest**

Vytvoř `packages/desktop/src/app/components/stageplan/useBlockDrag.ts`:

```ts
import type { PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useRef } from "react";
import type {
  StageplanBlock,
  StageplanBlockSlot,
  StageplanStageSize,
} from "../../../../../../src/domain/model/types";
import {
  moveBlockTo,
  rotateBlockTo,
} from "../../../../../../src/domain/stageplan/layout/blockOps";
import type { StageScale } from "../../../../../../src/domain/stageplan/layout/scale";

type Gesture =
  | { kind: "move"; block: StageplanBlock; startXPx: number; startYPx: number }
  | { kind: "rotate"; block: StageplanBlock; centerXPx: number; centerYPx: number };

/**
 * Hook drží jen ukazatel gesta a výchozí bod. Snap, clamp i zaokrouhlení dělá
 * doména — tady se pixely jen převedou na metry.
 */
export function useBlockDrag(args: {
  scale: StageScale;
  area: StageplanStageSize;
  snap: boolean;
  onChange: (slot: StageplanBlockSlot, next: StageplanBlock) => void;
  /** Jednou na začátku gesta — odsud si stránka bere snapshot pro undo. */
  onGestureStart: () => void;
  onGestureEnd: () => void;
}) {
  const gestureRef = useRef<Gesture | null>(null);

  const finish = useCallback(() => {
    if (!gestureRef.current) return;
    gestureRef.current = null;
    args.onGestureEnd();
  }, [args]);

  const handleMove = useCallback(
    (event: PointerEvent) => {
      const gesture = gestureRef.current;
      if (!gesture) return;

      if (gesture.kind === "move") {
        const deltaXM = args.scale.toM(event.clientX - gesture.startXPx);
        const deltaYM = args.scale.toM(event.clientY - gesture.startYPx);
        args.onChange(
          gesture.block.slot,
          moveBlockTo(
            gesture.block,
            {
              centerXM: gesture.block.centerXM + deltaXM,
              centerYM: gesture.block.centerYM + deltaYM,
            },
            { area: args.area, snap: args.snap },
          ),
        );
        return;
      }

      const radians = Math.atan2(
        event.clientY - gesture.centerYPx,
        event.clientX - gesture.centerXPx,
      );
      const degrees = (radians * 180) / Math.PI + 90;
      args.onChange(
        gesture.block.slot,
        rotateBlockTo(gesture.block, degrees, { area: args.area, snap: args.snap }),
      );
    },
    [args],
  );

  const bindWindow = useCallback(() => {
    function onPointerMove(event: PointerEvent) {
      handleMove(event);
    }
    function onPointerUp() {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      finish();
    }
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }, [finish, handleMove]);

  const startMove = useCallback(
    (event: ReactPointerEvent, block: StageplanBlock) => {
      event.preventDefault();
      event.stopPropagation();
      gestureRef.current = {
        kind: "move",
        block,
        startXPx: event.clientX,
        startYPx: event.clientY,
      };
      args.onGestureStart();
      bindWindow();
    },
    [bindWindow],
  );

  const startRotate = useCallback(
    (event: ReactPointerEvent, block: StageplanBlock) => {
      event.preventDefault();
      event.stopPropagation();
      const rect = event.currentTarget.closest(".stage-block")?.getBoundingClientRect();
      if (!rect) return;
      gestureRef.current = {
        kind: "rotate",
        block,
        centerXPx: rect.left + rect.width / 2,
        centerYPx: rect.top + rect.height / 2,
      };
      args.onGestureStart();
      bindWindow();
    },
    [bindWindow],
  );

  return { startMove, startRotate };
}
```

- [ ] **Step 2: Napojit gesta na blok**

V `StageBlock.tsx` rozšiř props o `onStartMove: (event: ReactPointerEvent, block: StageplanBlock) => void` a `onStartRotate: (event: ReactPointerEvent, block: StageplanBlock) => void`, nahraď `onPointerDown={() => onSelect(block.slot)}` za:

```tsx
      onPointerDown={(event) => {
        onSelect(block.slot);
        onStartMove(event, block);
      }}
```

a před uzavírací `</div>` přidej úchyt jen pro vybraný blok:

```tsx
      {isSelected ? (
        <button
          type="button"
          className="stage-block__rotate"
          aria-label="Otočit blok"
          onPointerDown={(event) => onStartRotate(event, block)}
        >
          ↻
        </button>
      ) : null}
```

- [ ] **Step 3: Propojit plochu a stránku**

V `StageCanvas.tsx` přidej props `onChangeBlock: (slot: StageplanBlockSlot, next: StageplanBlock) => void`, `onGestureEnd: () => void` a `snap: boolean`, zavolej hook a předej `startMove` a `startRotate` do `StageBlock`:

```tsx
  const { startMove, startRotate } = useBlockDrag({
    scale,
    area,
    snap,
    onChange: onChangeBlock,
    onGestureStart,
    onGestureEnd,
  });
```

`onGestureStart` a `onGestureEnd` přidej i do props `StageCanvas` jako `() => void`.

Ve `StagePlanEditorPage.tsx` doplň zápis do state:

```tsx
  function updateBlock(slot: StageplanBlockSlot, next: StageplanBlock) {
    setState((current) => {
      if (current.kind !== "ready") return current;
      return {
        ...current,
        layout: {
          stage: current.layout.stage,
          blocks: current.layout.blocks.map((block) => (block.slot === slot ? next : block)),
        },
      };
    });
  }
```

a předej `snap={true}` (přepínač přijde v Task 11), `onChangeBlock={updateBlock}` a prázdné `onGestureStart={() => undefined}` i `onGestureEnd={() => undefined}` (historii do nich zapojí Task 12).

- [ ] **Step 4: Dopsat CSS úchytu**

Do `stageplan-editor.css` přidej:

```css
.stage-block:active {
  cursor: grabbing;
}

.stage-block__rotate {
  position: absolute;
  left: 50%;
  top: -34px;
  margin-left: -11px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid var(--sp-ink);
  background: var(--color-primary);
  color: var(--color-primary-text);
  font-size: 12px;
  line-height: 1;
  cursor: grab;
  touch-action: none;
}
```

- [ ] **Step 5: Lint, testy a ruční kontrola**

Run: `npm run lint && npm test`
Expected: bez nových chyb

Run: `npm run dev`
Expected: blok se dá chytit a táhnout, pozice snapuje po 10 cm, blok se nedá vytáhnout dál než 20 cm za hranu, u vybraného bloku je oranžové kolečko, tažením za kolečko se blok otáčí po 15° a popisek rotace v bloku se mění, tažení nedrhne.

- [ ] **Step 6: Commit**

```bash
git add packages/desktop/src/app/components/stageplan packages/desktop/src/app/pages/StagePlanEditorPage.tsx packages/desktop/src/styles/features/stageplan-editor.css
git commit -m "feat(stageplan): drag blocks and rotate them by the handle"
```

---

### Task 11: Pravý panel, seznam bloků, snap a reset

**Files:**
- Create: `packages/desktop/src/app/components/stageplan/BlockInspector.tsx`
- Modify: `packages/desktop/src/app/components/stageplan/EditorToolbar.tsx` (přepínač snapu)
- Modify: `packages/desktop/src/app/pages/StagePlanEditorPage.tsx` (stav snapu, reset, rozvržení těla)
- Modify: `packages/desktop/src/styles/features/stageplan-editor.css`

**Interfaces:**
- Consumes: `rotateBlockBy` (Task 4), `buildDefaultLayout` (Task 2), `resolveBlockSlotsFromPayload` (Task 6), `LABEL_BY_SLOT`, `formatZone` (Task 9).
- Produces: `BlockInspector` s props `{ blocks, selectedSlot, onSelect, onRotateBy, onReset }`.

- [ ] **Step 1: Napsat panel**

Vytvoř `packages/desktop/src/app/components/stageplan/BlockInspector.tsx`:

```tsx
import type {
  StageplanBlock,
  StageplanBlockSlot,
} from "../../../../../../src/domain/model/types";
import { LABEL_BY_SLOT, formatZone } from "./blockContent";

type BlockInspectorProps = {
  blocks: readonly StageplanBlock[];
  selectedSlot: StageplanBlockSlot | null;
  onSelect: (slot: StageplanBlockSlot) => void;
  onRotateBy: (deltaDeg: number) => void;
  onReset: () => void;
};

export function BlockInspector({
  blocks,
  selectedSlot,
  onSelect,
  onRotateBy,
  onReset,
}: BlockInspectorProps) {
  const selected = blocks.find((block) => block.slot === selectedSlot) ?? null;

  return (
    <aside className="stage-inspector">
      <div className="stage-inspector__section">
        <div className="stage-inspector__eyebrow">VYBRANÝ BLOK</div>
        <div className="stage-inspector__title">
          {selected ? LABEL_BY_SLOT[selected.slot] : "—"}
        </div>
      </div>

      {selected ? (
        <div className="stage-inspector__section">
          <div className="stage-inspector__row">
            <span className="stage-inspector__label">ROTACE</span>
            <button type="button" onClick={() => onRotateBy(-15)} aria-label="Otočit o 15 stupňů vlevo">
              ↺
            </button>
            <span className="stage-inspector__value">{selected.rotationDeg}°</span>
            <button type="button" onClick={() => onRotateBy(15)} aria-label="Otočit o 15 stupňů vpravo">
              ↻
            </button>
          </div>
          <div className="stage-inspector__row">
            <span className="stage-inspector__label">ROZMĚR</span>
            <span className="stage-inspector__value">
              {formatZone(selected.widthM, selected.depthM)}
            </span>
          </div>
        </div>
      ) : null}

      <div className="stage-inspector__section">
        <div className="stage-inspector__eyebrow">BLOKY NA PÓDIU</div>
        <ul className="stage-inspector__list">
          {blocks.map((block) => (
            <li key={block.slot}>
              <button
                type="button"
                className={`stage-inspector__item${
                  block.slot === selectedSlot ? " stage-inspector__item--active" : ""
                }`}
                onClick={() => onSelect(block.slot)}
              >
                <span>{LABEL_BY_SLOT[block.slot]}</span>
                <span>{block.rotationDeg}°</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <button type="button" className="stage-inspector__reset" onClick={onReset}>
        Reset rozmístění
      </button>
    </aside>
  );
}
```

- [ ] **Step 2: Přidat přepínač snapu do toolbaru**

V `EditorToolbar.tsx` rozšiř props o `snap: boolean` a `onToggleSnap: () => void` a vlož mezi taby a `stage-toolbar__meta`:

```tsx
      <button
        type="button"
        className={`stage-snap${snap ? " stage-snap--on" : ""}`}
        onClick={onToggleSnap}
      >
        {snap ? "SNAP 10 CM · 15°" : "SNAP OFF"}
      </button>
```

- [ ] **Step 3: Doplnit stav a rozvržení ve stránce**

Ve `StagePlanEditorPage.tsx` přidej `const [snap, setSnap] = useState(true);`, obal plochu a panel do `<div className="stage-editor__body">`, předej `snap` do `StageCanvas` a `EditorToolbar`, a doplň dvě akce:

```tsx
  function rotateSelectedBy(deltaDeg: number) {
    setState((current) => {
      if (current.kind !== "ready" || selectedSlot === null) return current;
      const area = current.layout.stage ?? NOMINAL_STAGE;
      return {
        ...current,
        layout: {
          stage: current.layout.stage,
          blocks: current.layout.blocks.map((block) =>
            block.slot === selectedSlot
              ? rotateBlockBy(block, deltaDeg, { area, snap })
              : block,
          ),
        },
      };
    });
  }

  function resetArrangement() {
    setState((current) => {
      if (current.kind !== "ready") return current;
      const layout = buildDefaultLayout({
        slots: resolveBlockSlotsFromPayload(current.project),
        stage: current.layout.stage,
      });
      setSelectedSlot(layout.blocks[0]?.slot ?? null);
      return { ...current, layout };
    });
  }
```

- [ ] **Step 4: Dopsat CSS panelu**

Do `stageplan-editor.css` přidej:

```css
.stage-editor__body {
  display: grid;
  grid-template-columns: 1fr 296px;
  min-height: 0;
}

.stage-inspector {
  display: grid;
  gap: var(--sp-7);
  align-content: start;
  padding: var(--sp-8);
  border-left: 1px solid var(--color-stage-border-soft);
}

.stage-inspector__section {
  display: grid;
  gap: var(--sp-3);
}

.stage-inspector__eyebrow {
  font: var(--sp-mono-2xs);
  letter-spacing: 0.16em;
  color: var(--color-stage-text-dim);
}

.stage-inspector__title {
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--color-stage-text);
}

.stage-inspector__row {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
}

.stage-inspector__label {
  width: 62px;
  font: var(--sp-mono-xs);
  color: var(--color-stage-text-dim);
}

.stage-inspector__value {
  font: var(--sp-mono-md);
  color: var(--color-stage-text);
  min-width: 42px;
  text-align: center;
}

.stage-inspector__row button {
  width: 30px;
  height: 30px;
  border: 1px solid var(--color-stage-border);
  border-radius: var(--sp-r-btn);
  background: transparent;
  color: var(--color-stage-text);
  cursor: pointer;
}

.stage-inspector__list {
  display: grid;
  gap: var(--sp-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.stage-inspector__item {
  display: flex;
  justify-content: space-between;
  width: 100%;
  padding: 9px 12px;
  font: var(--sp-mono-xs);
  border: 1px solid var(--sp-border-dark-2);
  border-radius: var(--sp-r-btn-lg);
  background: transparent;
  color: var(--color-stage-text-mid);
  cursor: pointer;
}

.stage-inspector__item--active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-primary-text);
}

.stage-inspector__reset {
  width: 100%;
  padding: var(--sp-5);
  border: 1px solid var(--color-stage-border);
  border-radius: var(--sp-r-btn-lg);
  background: transparent;
  color: var(--color-stage-text-mid);
  cursor: pointer;
}

.stage-snap {
  font: var(--sp-mono-xs);
  letter-spacing: 0.1em;
  padding: 8px 12px;
  border: 1px solid var(--color-stage-border);
  border-radius: var(--sp-r-btn);
  background: transparent;
  color: var(--color-stage-text-mid);
  cursor: pointer;
}

.stage-snap--on {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-primary-text);
}
```

- [ ] **Step 5: Lint, testy a ruční kontrola**

Run: `npm run lint && npm test`
Expected: bez nových chyb

Run: `npm run dev`
Expected: panel ukazuje vybraný blok, rotaci lze měnit tlačítky ±15°, rozměr je jen text, klik na položku v seznamu vybere blok na ploše (plocha nescrolluje), `SNAP OFF` vypne mřížkování a tažení jde po milimetrech, `Reset rozmístění` vrátí výchozí layout a vybere první blok.

- [ ] **Step 6: Commit**

```bash
git add packages/desktop/src/app/components/stageplan packages/desktop/src/app/pages/StagePlanEditorPage.tsx packages/desktop/src/styles/features/stageplan-editor.css
git commit -m "feat(stageplan): add the block inspector, snap toggle and arrangement reset"
```

---

### Task 12: Klávesnice a undo

**Files:**
- Create: `packages/desktop/src/app/components/stageplan/useLayoutHistory.ts`
- Create: `packages/desktop/src/app/components/stageplan/useEditorKeyboard.ts`
- Modify: `packages/desktop/src/app/pages/StagePlanEditorPage.tsx`

**Interfaces:**
- Consumes: `nudgeBlockBy`, `rotateBlockBy` (Task 4), `StageplanLayout` (Task 1).
- Produces: `useLayoutHistory(): { push: (layout: StageplanLayout) => void; undo: (current: StageplanLayout) => StageplanLayout | null; redo: (current: StageplanLayout) => StageplanLayout | null; reset: () => void }`; `useEditorKeyboard(args: { enabled: boolean; onNudge: (delta: { xM: number; yM: number }) => void; onRotateBy: (deltaDeg: number) => void; onUndo: () => void; onRedo: () => void; onClearSelection: () => void }): void`.

- [ ] **Step 1: Napsat zásobník historie**

Vytvoř `packages/desktop/src/app/components/stageplan/useLayoutHistory.ts`:

```ts
import { useCallback, useRef } from "react";
import type { StageplanLayout } from "../../../../../../src/domain/model/types";

const LIMIT = 50;

/**
 * Snapshoty místo inverzních operací: stav je šest bloků po šesti číslech, tak
 * je celý layout levnější než skládání opačných gest. Žije jen po dobu sezení.
 */
export function useLayoutHistory() {
  const pastRef = useRef<StageplanLayout[]>([]);
  const futureRef = useRef<StageplanLayout[]>([]);

  const push = useCallback((layout: StageplanLayout) => {
    pastRef.current = [...pastRef.current, layout].slice(-LIMIT);
    futureRef.current = [];
  }, []);

  const undo = useCallback((current: StageplanLayout): StageplanLayout | null => {
    const previous = pastRef.current.at(-1);
    if (!previous) return null;
    pastRef.current = pastRef.current.slice(0, -1);
    futureRef.current = [...futureRef.current, current].slice(-LIMIT);
    return previous;
  }, []);

  const redo = useCallback((current: StageplanLayout): StageplanLayout | null => {
    const next = futureRef.current.at(-1);
    if (!next) return null;
    futureRef.current = futureRef.current.slice(0, -1);
    pastRef.current = [...pastRef.current, current].slice(-LIMIT);
    return next;
  }, []);

  /** Po načtení jiného projektu nesmí undo skočit do cizího rozmístění. */
  const reset = useCallback(() => {
    pastRef.current = [];
    futureRef.current = [];
  }, []);

  return { push, undo, redo, reset };
}
```

- [ ] **Step 2: Napsat klávesnici**

Vytvoř `packages/desktop/src/app/components/stageplan/useEditorKeyboard.ts`:

```ts
import { useEffect } from "react";

const STEP_M = 0.1;
const BIG_STEP_M = 1;

/** Nesmí střílet, když uživatel píše do pole — proto kontrola cíle eventu. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
}

export function useEditorKeyboard(args: {
  enabled: boolean;
  onNudge: (delta: { xM: number; yM: number }) => void;
  onRotateBy: (deltaDeg: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClearSelection: () => void;
}): void {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) return;

      const ctrl = event.ctrlKey || event.metaKey;
      if (ctrl && event.key.toLowerCase() === "z") {
        event.preventDefault();
        args.onUndo();
        return;
      }
      if (ctrl && event.key.toLowerCase() === "y") {
        event.preventDefault();
        args.onRedo();
        return;
      }
      if (event.key === "Escape") {
        args.onClearSelection();
        return;
      }
      if (!args.enabled) return;

      const step = event.shiftKey ? BIG_STEP_M : STEP_M;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        args.onNudge({ xM: -step, yM: 0 });
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        args.onNudge({ xM: step, yM: 0 });
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        args.onNudge({ xM: 0, yM: -step });
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        args.onNudge({ xM: 0, yM: step });
        return;
      }
      if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        args.onRotateBy(event.shiftKey ? -15 : 15);
      }
      // Delete je vědomě prázdný: bloky vznikají z lineupu, mazat je nelze.
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [args]);
}
```

- [ ] **Step 3: Zapojit do stránky**

Ve `StagePlanEditorPage.tsx` zavolej `const history = useLayoutHistory();`, po načtení projektu `history.reset()`, a doplň posun z klávesnice:

```tsx
  function nudgeSelectedBy(delta: { xM: number; yM: number }) {
    setState((current) => {
      if (current.kind !== "ready" || selectedSlot === null) return current;
      const area = current.layout.stage ?? NOMINAL_STAGE;
      history.push(current.layout);
      return {
        ...current,
        layout: {
          stage: current.layout.stage,
          blocks: current.layout.blocks.map((block) =>
            block.slot === selectedSlot ? nudgeBlockBy(block, delta, { area }) : block,
          ),
        },
      };
    });
  }
```

Stejné `history.push(current.layout)` přidej na začátek `rotateSelectedBy` i `resetArrangement` z Task 11 — snapshot patří **před** změnu, aby undo vrátil stav před ní. U tažení a rotace úchytem to zajistí `onGestureStart` z Task 10, který nahraď za:

```tsx
        onGestureStart={() =>
          setState((current) => {
            if (current.kind === "ready") history.push(current.layout);
            return current;
          })
        }
```

Tím je jedno tažení jeden krok undo, ne stovka kroků z každého `pointermove`. `onGestureEnd` zůstává prázdný — undo už má, co potřebuje. Pak doplň klávesnici:

```tsx
  useEditorKeyboard({
    enabled: selectedSlot !== null,
    onNudge: (delta) => nudgeSelectedBy(delta),
    onRotateBy: (deltaDeg) => rotateSelectedBy(deltaDeg),
    onUndo: () =>
      setState((current) => {
        if (current.kind !== "ready") return current;
        const previous = history.undo(current.layout);
        return previous ? { ...current, layout: previous } : current;
      }),
    onRedo: () =>
      setState((current) => {
        if (current.kind !== "ready") return current;
        const next = history.redo(current.layout);
        return next ? { ...current, layout: next } : current;
      }),
    onClearSelection: () => setSelectedSlot(null),
  });
```

- [ ] **Step 4: Lint, testy a ruční kontrola**

Run: `npm run lint && npm test`
Expected: bez nových chyb

Run: `npm run dev`
Expected: šipky posouvají o 10 cm, se Shiftem o metr, `R` otáčí o 15°, `Shift+R` opačně, `Esc` zruší výběr, `Ctrl+Z` vrací jednotlivá gesta i akce panelu, `Ctrl+Y` je vrací zpět, `Delete` nedělá nic.

- [ ] **Step 5: Commit**

```bash
git add packages/desktop/src/app/components/stageplan packages/desktop/src/app/pages/StagePlanEditorPage.tsx
git commit -m "feat(stageplan): move blocks from the keyboard and undo editor gestures"
```

---

### Task 13: Rozměr pódia v toolbaru

**Files:**
- Create: `packages/desktop/src/app/components/stageplan/StageSizeFields.tsx`
- Modify: `packages/desktop/src/app/components/stageplan/EditorToolbar.tsx`
- Modify: `packages/desktop/src/app/pages/StagePlanEditorPage.tsx`
- Modify: `packages/desktop/src/styles/features/stageplan-editor.css`

**Interfaces:**
- Consumes: `rescaleForStage` (Task 5), `useLayoutHistory` (Task 12), `StageplanStageSize` (Task 1).
- Produces: `StageSizeFields` s props `{ stage: StageplanStageSize | null; onChange: (next: StageplanStageSize | null) => void }`.

Bez téhle úlohy by `rescaleForStage` nemělo volajícího a verifikační bod 5 ze specu (zadání pódia 10 × 6 m) by nebyl proveditelný.

- [ ] **Step 1: Napsat pole rozměru**

Vytvoř `packages/desktop/src/app/components/stageplan/StageSizeFields.tsx`:

```tsx
import { useEffect, useState } from "react";
import type { StageplanStageSize } from "../../../../../../src/domain/model/types";

type StageSizeFieldsProps = {
  stage: StageplanStageSize | null;
  onChange: (next: StageplanStageSize | null) => void;
};

function toDraft(value: number | undefined): string {
  return value === undefined ? "" : String(value);
}

function parseMeters(value: string): number | null {
  const numeric = Number(value.trim().replace(",", "."));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

/**
 * Přepočet se pouští teprve na blur nebo Enter. Při každém stisku klávesy by se
 * rozmístění přeškálovalo znovu a znovu a zaokrouhlení by se sčítalo.
 */
export function StageSizeFields({ stage, onChange }: StageSizeFieldsProps) {
  const [widthDraft, setWidthDraft] = useState(toDraft(stage?.widthM));
  const [depthDraft, setDepthDraft] = useState(toDraft(stage?.depthM));

  useEffect(() => {
    setWidthDraft(toDraft(stage?.widthM));
    setDepthDraft(toDraft(stage?.depthM));
  }, [stage]);

  function commit() {
    const widthM = parseMeters(widthDraft);
    const depthM = parseMeters(depthDraft);
    if (widthM !== null && depthM !== null) {
      if (widthM !== stage?.widthM || depthM !== stage?.depthM) {
        onChange({ widthM, depthM });
      }
      return;
    }
    // Prázdná nebo neplatná pole znamenají „rozměr nezadán“, ne chybu.
    if (widthDraft.trim() === "" && depthDraft.trim() === "") {
      if (stage !== null) onChange(null);
      return;
    }
    setWidthDraft(toDraft(stage?.widthM));
    setDepthDraft(toDraft(stage?.depthM));
  }

  return (
    <div className="stage-size">
      <span className="stage-size__label">PÓDIUM</span>
      <input
        className="stage-size__input"
        aria-label="Šířka pódia v metrech"
        inputMode="decimal"
        placeholder="?"
        value={widthDraft}
        onChange={(event) => setWidthDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
      <span className="stage-size__times">×</span>
      <input
        className="stage-size__input"
        aria-label="Hloubka pódia v metrech"
        inputMode="decimal"
        placeholder="?"
        value={depthDraft}
        onChange={(event) => setDepthDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
      <span className="stage-size__unit">{stage ? "m" : "m · NEZADÁNO"}</span>
    </div>
  );
}
```

- [ ] **Step 2: Nahradit statický popisek v toolbaru**

V `EditorToolbar.tsx` rozšiř props o `onChangeStage: (next: StageplanStageSize | null) => void` a nahraď celý `<div className="stage-toolbar__meta">…</div>` za:

```tsx
      <div className="stage-toolbar__meta">
        <StageSizeFields stage={stage} onChange={onChangeStage} />
      </div>
```

Doplň import `StageSizeFields` a smaž nepoužitý import `formatZone`, pokud ho už nic jiného v souboru nepotřebuje.

- [ ] **Step 3: Zapojit přeškálování ve stránce**

Ve `StagePlanEditorPage.tsx` doplň a předej do `EditorToolbar` jako `onChangeStage`:

```tsx
  function applyStageSize(next: StageplanStageSize | null) {
    setState((current) => {
      if (current.kind !== "ready") return current;
      history.push(current.layout);
      // Jediné místo, kde se souřadnice přepočítávají — R6.
      return { ...current, layout: rescaleForStage(current.layout, next) };
    });
  }
```

- [ ] **Step 4: Dopsat CSS**

Do `stageplan-editor.css` přidej:

```css
.stage-size {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  font: var(--sp-mono-xs);
  letter-spacing: 0.1em;
  color: var(--color-stage-text-dim);
}

.stage-size__input {
  width: 52px;
  padding: 5px 7px;
  font: var(--sp-mono-xs);
  text-align: right;
  border: 1px solid var(--color-stage-border);
  border-radius: var(--sp-r-chip);
  background: transparent;
  color: var(--color-stage-text);
}

.stage-size__input:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}
```

- [ ] **Step 5: Lint, testy a ruční kontrola**

Run: `npm run lint && npm test`
Expected: bez nových chyb

Run: `npm run dev`
Expected: prázdná pole píší `NEZADÁNO` a plán se kreslí na 12 × 8 m; zadání `10` a `6` plochu zúží a rozmístění drží tvar bez bloků za hranou; vyprázdnění obou polí vrátí nominální plochu; `Ctrl+Z` přeškálování vrátí; nesmyslná hodnota (`0`, `abc`) pole vrátí na poslední platný stav a s rozmístěním nehne.

- [ ] **Step 6: Commit**

```bash
git add packages/desktop/src/app/components/stageplan packages/desktop/src/app/pages/StagePlanEditorPage.tsx packages/desktop/src/styles/features/stageplan-editor.css
git commit -m "feat(stageplan): enter the stage size and rescale the arrangement proportionally"
```

---

### Task 14: Ukládání, dirty guard a patička

**Files:**
- Create: `packages/desktop/src/app/components/stageplan/EditorFooter.tsx`
- Modify: `packages/desktop/src/app/pages/StagePlanEditorPage.tsx`
- Modify: `packages/desktop/src/styles/features/stageplan-editor.css`

**Interfaces:**
- Consumes: `isStageplanLayoutDirty` (Task 5), `saveProjectPayload` (existující `services/projectsApi`), `NavigationGuard` (existující `shell/types`), `useToast` (existující `components/ui/toast/useToast`).
- Produces: `EditorFooter` s props `{ onBack, onGeneratePdf, isSaving }`.

- [ ] **Step 1: Napsat patičku**

Vytvoř `packages/desktop/src/app/components/stageplan/EditorFooter.tsx`:

```tsx
type EditorFooterProps = {
  onBack: () => void;
  onGeneratePdf: () => void;
  isSaving: boolean;
};

/**
 * Handoff tu má větu „Změny se propíší do PDF exportu“. Do F5b by to byla
 * nepravda — tisk zatím rozmístění nečte.
 */
export function EditorFooter({ onBack, onGeneratePdf, isSaving }: EditorFooterProps) {
  return (
    <div className="stage-footer">
      <button type="button" className="stage-footer__ghost" onClick={onBack}>
        Zpět na Lineup
      </button>
      <span className="stage-footer__note">ROZMÍSTĚNÍ SE ZATÍM DO PDF NEPROPISUJE</span>
      <button
        type="button"
        className="stage-footer__primary"
        onClick={onGeneratePdf}
        disabled={isSaving}
      >
        Generate PDF
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Doplnit ukládání a guard do stránky**

Ve `StagePlanEditorPage.tsx` doplň k importům `useCallback` a `useRef` z Reactu, `isStageplanLayoutDirty` z `../../../../../src/domain/stageplan/layout/dirty`, `saveProjectPayload` z `../services/projectsApi` a `useToast` z `../../components/ui/toast/useToast`. Přidej stav a ref:

```tsx
  const [isSaving, setIsSaving] = useState(false);
  const { notify } = useToast();
  /** Stav, proti kterému se poznává dirty — po každém uložení se posune. */
  const initialLayoutRef = useRef<StageplanLayout | undefined>(undefined);
```

V `load()` z Task 9 nastav `initialLayoutRef.current = project.stageplan?.layout;` — tedy **uložený** layout, ne výsledek sloučení. Doplnění chybějícího bloku po změně lineupu je tím pádem samo o sobě dirty změna, což je správně: na disku ten blok ještě není. Pak doplň:

```tsx
  const saveLayout = useCallback(
    async (layout: StageplanLayout, project: NewProjectPayload) => {
      setIsSaving(true);
      try {
        await saveProjectPayload({
          projectId: project.id,
          payload: {
            ...project,
            stageplan: { ...project.stageplan, layout },
          },
          // Posunuté rozmístění je změna obsahu rideru, ne kosmetika.
          intent: "content",
        });
        initialLayoutRef.current = layout;
      } finally {
        setIsSaving(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (state.kind !== "ready") return;
    const { project, layout } = state;
    registerNavigationGuard({
      isDirty: () => isStageplanLayoutDirty(initialLayoutRef.current, layout),
      save: () => saveLayout(layout, project),
      discard: () => {
        const initial = initialLayoutRef.current;
        if (initial) setState((current) => (current.kind === "ready" ? { ...current, layout: initial } : current));
      },
    });
    return () => registerNavigationGuard(null);
  }, [registerNavigationGuard, saveLayout, state]);
```

Patičku vlož pod tělo editoru:

```tsx
      <EditorFooter
        isSaving={isSaving}
        onBack={() => navigate(`/projects/${encodeURIComponent(id)}/setup`)}
        onGeneratePdf={async () => {
          if (state.kind !== "ready") return;
          await saveLayout(state.layout, state.project);
          notify("success", "Rozmístění uloženo.");
          navigate(`/projects/${encodeURIComponent(id)}/preview`);
        }}
      />
```

- [ ] **Step 3: Dopsat CSS patičky**

V `stageplan-editor.css` změň grid `.stage-editor` na `grid-template-rows: auto 1fr auto;` a přidej:

```css
.stage-footer {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
  height: 60px;
  padding: 0 var(--sp-5);
  border-top: 1px solid var(--color-stage-border-soft);
}

.stage-footer__note {
  margin-left: auto;
  font: var(--sp-mono-xs);
  letter-spacing: 0.1em;
  color: var(--color-stage-text-dim);
}

.stage-footer__ghost {
  padding: 11px 18px;
  border: 1px solid var(--color-stage-border);
  border-radius: var(--sp-r-btn-lg);
  background: transparent;
  color: var(--color-stage-text-mid);
  cursor: pointer;
}

.stage-footer__primary {
  padding: 12px 30px;
  border: none;
  border-radius: var(--sp-r-btn-lg);
  background: var(--color-primary);
  color: var(--color-primary-text);
  font-weight: 600;
  cursor: pointer;
}

.stage-footer__primary:disabled {
  opacity: 0.6;
  cursor: default;
}
```

- [ ] **Step 4: Lint, testy a ruční kontrola**

Run: `npm run lint && npm test`
Expected: bez nových chyb proti baseline

Run: `npm run dev` a projdi celou verifikaci ze specu:
1. Nový projekt otevře editor s bloky v rozestavení podle R7 a popiskem `PÓDIUM · ROZMĚR NEZADÁN`
2. Posun a rotace, `Generate PDF`, návrat do editoru — pozice i rotace drží, JSON v `%APPDATA%/StagePilot/projects/` má souřadnice na tři desetinná místa a `contentUpdatedAt` je nové
3. Změna obsazení v Lineup Setupu a uložení — rozmístění zůstává; přidaný lead vokál dostane blok, odebraná role ho ztratí
4. Odchod z editoru s neuloženou změnou vyvolá `UnsavedChangesModal`, Save uloží, Discard vrátí výchozí stav
5. Procesní stopa: `03 STAGE PLAN` je dostupný, `02 INPUTS` zůstává `unavailable`
6. Export PDF vypadá stejně jako před F5a

- [ ] **Step 5: Commit**

```bash
git add packages/desktop/src/app/components/stageplan packages/desktop/src/app/pages/StagePlanEditorPage.tsx packages/desktop/src/styles/features/stageplan-editor.css
git commit -m "feat(stageplan): save the arrangement, guard unsaved changes and wire the editor footer"
```

---

### Task 15: Zapsat stav implementace do specu

**Files:**
- Modify: `docs/superpowers/specs/2026-08-13-stageplan-editor-and-layout-model-design.md`
- Modify: `docs/design/rebranding-roadmap.md`

- [ ] **Step 1: Doplnit do specu sekci „Stav implementace"**

Za sekci `Verifikace` přidej `## Stav implementace` a v ní: co je hotové, jaké odchylky implementace přinesla (například nástrojové čtverce toolbaru, které vypadly ze stejného důvodu jako popisek `ZOOM`), co ruční kontrola v `npm run dev` odhalila a co se předává do F5b (chybějící layout znamená „neupravováno", tisk si dopočítá výchozí rozmístění za běhu).

- [ ] **Step 2: Aktualizovat roadmapu**

V tabulce `## Stav` přepiš řádek `F5a` na `hotovo` a doplň hash prvního a posledního commitu fáze.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-08-13-stageplan-editor-and-layout-model-design.md docs/design/rebranding-roadmap.md
git commit -m "docs(design): record the F5a implementation state and close the sub-phase"
```
