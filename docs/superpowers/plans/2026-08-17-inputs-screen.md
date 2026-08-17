# Obrazovka `02 INPUTS` — implementační plán

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Otevřít krok `02` jako editovatelné zrcadlo strany 1 dokumentu — kanály, monitory a poznámky na jedné obrazovce, s odchylkami uloženými na projektu.

**Architecture:** Doména dostane dvě nové čisté vrstvy (ruční pořadí kanálů, poznámky jako odchylky projektu) a obě se zapojí do existujícího řetězu v `buildDocument`. Desktop dostane novou obrazovku na vzoru `StagePlanEditorPage` a sdílený setup stav se vytáhne z `ProjectSetupPage` do modulu, jehož logika je testovatelná bez Reactu.

**Tech Stack:** TypeScript ESM, React + Vite, Tauri, Vitest (node prostředí), Biome.

**Spec:** `docs/superpowers/specs/2026-08-17-inputs-screen-design.md` (rozhodnutí R1–R16)

## Global Constraints

- `src/domain/` je čistá logika: **žádné I/O, žádné side efekty**. Importy uvnitř `src/` nesou příponu `.js` (ESM), importy v `packages/desktop/` příponu nemají.
- Vitest běží v **node prostředí bez jsdom** (`vitest.config.ts`). Komponenty se netestují interakcí. Vzor repozitáře: **čistá logika se vytáhne z komponenty do vlastního modulu a testuje se přímo**, JSX se ověří přes `renderToStaticMarkup` (viz `shellChrome.test.tsx`, `ProjectPreviewPage.test.tsx`). Interakce (drag, klik) patří do ruční verifikace, ne do testu.
- **Popisky rozhraní jsou anglicky** (R14 z F6). Text poznámek zůstává český — je to obsah dokumentu, ne rozhraní.
- **Commit message je jednořádkový.** Hook v tomto repozitáři odmítne tělo i patičku. Formát `type(scope): summary`, malá počáteční písmena.
- Lint: `npx biome check <cesty>` **jen na dotčené soubory**. Celý `npm run lint` má baseline ~1368 CRLF chyb, která s touto fází nesouvisí.
- `npm test` má baseline **2 trvale padající testy** (`assetsPaths`, `repoAssets`). Měř rozdíl, ne absolutní čísla.
- `npx tsc -p packages/desktop/tsconfig.json --noEmit` má baseline **10 chyb ve 4 testových souborech**.
- Nesahej na `src/infra/pdf/styles.ts`. Kdyby to task potřeboval, po změně je povinné `npm run glyphs:generate` a `npm run smoke:stageplan-print`.
- Jakýkoli kód, který sází `pdfStyles` do Chromia, musí jít přes `setPdfPageContent` ze `src/infra/pdf/pdf.ts`. Bez toho zůstane dokument na `about:blank`, Chromium tiše odmítne `file://` fonty a vysází náhradní písmo.

---

## File Structure

**Doména** (`src/`)

| Soubor | Odpovědnost |
|---|---|
| `src/domain/model/types.ts` | modifikace — `ProjectNotesOverride`, `Project.inputOrder`, `Project.notes`, totéž na `ProjectJsonV2` |
| `src/domain/pipeline/applyManualInputOrder.ts` | nový — ruční pořadí kanálů, slučovací pravidla a stereo adjacency (R8, R9) |
| `src/domain/pipeline/applyManualInputOrder.test.ts` | nový |
| `src/domain/pipeline/pdf/buildPdfNotes.ts` | modifikace — čtvrtý krok rozlišení poznámek (R11) |
| `src/domain/pipeline/buildDocument.ts` | modifikace — dva zásahy v řetězu (řádky ~600 a ~620) |
| `src/app/usecases/normalizeProject.ts` | modifikace — nová pole ve **všech třech** návratových větvích |

**Persistence a shell** (`packages/desktop/`)

| Soubor | Odpovědnost |
|---|---|
| `src/app/shell/types.ts` | modifikace — `NewProjectPayload` a whitelist v `toPersistableProject` (R14) |
| `src/app/shell/routes.ts` | modifikace — `matchProjectInputsPath`, položka `project-inputs` |
| `src/app/shell/chrome/processSteps.ts` | modifikace — `segment: "inputs"`, čtvrtá větev pro `current` |
| `src/app/shell/ShellRouter.tsx` | modifikace — routa na novou stránku |

**Sdílený setup stav** (`packages/desktop/`)

| Soubor | Odpovědnost |
|---|---|
| `src/app/domain/setup/resolveSetupForSlot.ts` | nový — **čisté** funkce, které dnes žijí jako `useCallback` v `ProjectSetupPage` (R16) |
| `src/app/domain/setup/resolveSetupForSlot.test.ts` | nový |
| `src/app/domain/setup/useSetupOverrides.ts` | nový — tenký React obal nad čistými funkcemi |

**Obrazovka** (`packages/desktop/`)

| Soubor | Odpovědnost |
|---|---|
| `src/app/pages/ProjectInputsPage.tsx` | nový — načtení, uložení, navigační pojistka, skládání sekcí |
| `src/app/domain/inputs/buildInputEditorRows.ts` | nový — **čistý** model řádků tabulky včetně vypnutých (R3) |
| `src/app/domain/inputs/buildInputEditorRows.test.ts` | nový |
| `src/app/domain/inputs/moveInputRow.ts` | nový — **čisté** přeřazení řádku, zdroj `inputOrder` (R8) |
| `src/app/domain/inputs/moveInputRow.test.ts` | nový |
| `src/app/domain/inputs/resolveNotesEditorModel.ts` | nový — **čistý** model editoru poznámek včetně skrytých (R13) |
| `src/app/domain/inputs/resolveNotesEditorModel.test.ts` | nový |
| `src/app/components/inputs/InputTable.tsx` | nový — tabulka kanálů |
| `src/app/components/inputs/InputRowInspector.tsx` | nový — kontextový panel (R2) |
| `src/app/components/inputs/AddInputPicker.tsx` | nový — dvoukrokový výběr (R4) |
| `src/app/components/inputs/MonitorTable.tsx` | nový — tabulka monitorů (R7) |
| `src/app/components/inputs/NotesEditor.tsx` | nový — editor poznámek (R11–R13) |
| `src/app/pages/ProjectSetupPage.tsx` | modifikace — odebrat setup modál, `Continue` → `/inputs` |

Přesouvané bez úprav vnitřku: `src/components/setup/MonitoringEditor.tsx`, `src/components/setup/DrumsPartsEditor.tsx`, `src/components/setup/InputsEditor.tsx`, `src/app/components/setup/SetupModalShell.tsx`.

---

## Task 1: Nová pole na projektu a jejich normalizace (R8, R11)

Nejdřív datové vrstvy, protože všechno další na nich stojí. **Pozor na dva whitelisty:** doménová normalizace (tento task) a persistence v desktopu (Task 7). Kdyby se zapomnělo na jeden, projekt data ztratí a nikdo se to nedozví.

**Files:**
- Modify: `src/domain/model/types.ts`
- Modify: `src/app/usecases/normalizeProject.ts`
- Test: `src/app/usecases/normalizeProject.test.ts` (existující soubor, přidat describe blok)

**Interfaces:**
- Consumes: nic.
- Produces: `ProjectNotesOverride`, `Project["inputOrder"]: readonly string[] | undefined`, `Project["notes"]: ProjectNotesOverride | undefined`. Task 4, 6 a 7 na nich staví.

- [ ] **Step 1: Napiš padající test normalizace**

Do `src/app/usecases/normalizeProject.test.ts` přidej na konec:

```ts
describe("normalizeProject inputs screen fields", () => {
  const base = {
    id: "p1",
    bandRef: "b1",
    purpose: "event" as const,
    eventDate: "2026-08-22",
    eventVenue: "Zámek Bon Repos",
    documentDate: "2026-08-22",
  };

  it("passes the manual input order through", () => {
    const project = normalizeProject({
      ...base,
      inputOrder: ["kick_in", "snare_top"],
    } as never);

    expect(project.inputOrder).toEqual(["kick_in", "snare_top"]);
  });

  it("passes notes deviations through", () => {
    const project = normalizeProject({
      ...base,
      notes: {
        disabled: ["drum_riser_required"],
        overrides: { no_foh_engineer: "Vlastní znění." },
        custom: [{ id: "custom_1", section: "inputs", text: "Naše věta." }],
      },
    } as never);

    expect(project.notes?.disabled).toEqual(["drum_riser_required"]);
    expect(project.notes?.overrides).toEqual({
      no_foh_engineer: "Vlastní znění.",
    });
    expect(project.notes?.custom).toEqual([
      { id: "custom_1", section: "inputs", text: "Naše věta." },
    ]);
  });

  it("leaves both fields undefined when the json has neither", () => {
    const project = normalizeProject(base as never);

    expect(project.inputOrder).toBeUndefined();
    expect(project.notes).toBeUndefined();
  });

  it("drops an empty manual order instead of storing an empty array", () => {
    const project = normalizeProject({ ...base, inputOrder: [] } as never);

    expect(project.inputOrder).toBeUndefined();
  });

  it("passes the fields through the generic branch as well", () => {
    const project = normalizeProject({
      id: "p2",
      bandRef: "b1",
      purpose: "generic",
      documentDate: "2026-01-01",
      inputOrder: ["kick_in"],
      notes: { disabled: ["x"] },
    } as never);

    expect(project.inputOrder).toEqual(["kick_in"]);
    expect(project.notes?.disabled).toEqual(["x"]);
  });

  it("passes the fields through the legacy date branch as well", () => {
    const project = normalizeProject({
      id: "p3",
      bandRef: "b1",
      date: "2026-08-22",
      inputOrder: ["kick_in"],
      notes: { disabled: ["x"] },
    } as never);

    expect(project.inputOrder).toEqual(["kick_in"]);
    expect(project.notes?.disabled).toEqual(["x"]);
  });
});
```

- [ ] **Step 2: Spusť test a zkontroluj, že padá**

Run: `npx vitest run src/app/usecases/normalizeProject.test.ts`
Expected: FAIL — `inputOrder` a `notes` na `Project` neexistují, TypeScript i asserty si stěžují.

- [ ] **Step 3: Přidej typy do `src/domain/model/types.ts`**

Nad `export type PresetOverridePatch` (asi řádek 303) vlož:

```ts
/**
 * Poznámky pod tabulkami jako odchylka projektu nad šablonou kapely (R11).
 * Šablona dál určuje, co se nabídne; projekt drží jen rozdíl, takže nový
 * řádek v šabloně se ve starším projektu objeví sám.
 */
export type ProjectNotesOverride = {
  /** id řádků šablony, které se v tomto projektu netisknou */
  readonly disabled?: readonly string[];
  /** id řádku šablony -> vlastní znění */
  readonly overrides?: Readonly<Record<string, string>>;
  /** vlastní řádky projektu, řadí se za šablonové ve své sekci */
  readonly custom?: readonly {
    /** vždy s prefixem `custom_`, aby nekolidovalo s id ze šablony */
    readonly id: string;
    readonly section: "inputs" | "monitors";
    readonly text: string;
  }[];
};
```

Do `interface Project` (za `stageplan`) přidej:

```ts
  /**
   * Ruční pořadí kanálů jako seznam klíčů (R8). Chybí, dokud uživatel
   * nepřeřadil — projekt bez tohoto pole se řídí vypočteným pořadím.
   */
  inputOrder?: readonly string[];

  /** Odchylky poznámek proti šabloně kapely (R11). */
  notes?: ProjectNotesOverride;
```

Totéž přidej do `ProjectJsonV2` (za jeho `stageplan`), aby je loader viděl jako legální vstup.

- [ ] **Step 4: Přidej normalizaci do `src/app/usecases/normalizeProject.ts`**

Nad `export function normalizeProject` vlož dva pomocníky:

```ts
/** Prázdné pořadí se nedrží — absence pole znamená „řiď se výpočtem" (R8). */
function normalizeInputOrder(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const keys = value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return keys.length > 0 ? keys : undefined;
}

function normalizeProjectNotes(
  value: unknown,
): ProjectNotesOverride | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as {
    disabled?: unknown;
    overrides?: unknown;
    custom?: unknown;
  };

  const disabled = Array.isArray(raw.disabled)
    ? raw.disabled
        .filter((id): id is string => typeof id === "string")
        .map((id) => id.trim())
        .filter((id) => id.length > 0)
    : [];

  const overrides: Record<string, string> = {};
  if (raw.overrides && typeof raw.overrides === "object") {
    for (const [id, text] of Object.entries(
      raw.overrides as Record<string, unknown>,
    )) {
      if (typeof text === "string" && text.trim().length > 0) {
        overrides[id] = text;
      }
    }
  }

  const custom = Array.isArray(raw.custom)
    ? raw.custom
        .filter(
          (
            entry,
          ): entry is { id: string; section: "inputs" | "monitors"; text: string } =>
            Boolean(entry) &&
            typeof entry === "object" &&
            typeof (entry as { id?: unknown }).id === "string" &&
            typeof (entry as { text?: unknown }).text === "string" &&
            ((entry as { section?: unknown }).section === "inputs" ||
              (entry as { section?: unknown }).section === "monitors"),
        )
        .map((entry) => ({
          id: entry.id.trim(),
          section: entry.section,
          text: entry.text,
        }))
        .filter((entry) => entry.id.length > 0 && entry.text.trim().length > 0)
    : [];

  const hasAnything =
    disabled.length > 0 || Object.keys(overrides).length > 0 || custom.length > 0;
  if (!hasAnything) return undefined;

  return {
    ...(disabled.length > 0 ? { disabled } : {}),
    ...(Object.keys(overrides).length > 0 ? { overrides } : {}),
    ...(custom.length > 0 ? { custom } : {}),
  };
}
```

Import `ProjectNotesOverride` z `../../domain/model/types.js`.

Za řádek `const stageplan = normalizeProjectStageplan(...)` přidej:

```ts
  const inputOrder = normalizeInputOrder(
    (input as { inputOrder?: unknown }).inputOrder,
  );
  const notes = normalizeProjectNotes((input as { notes?: unknown }).notes);
```

A do **všech tří** `return` bloků přidej za `stageplan,` dva řádky:

```ts
        stageplan,
        inputOrder,
        notes,
```

- [ ] **Step 5: Spusť test a zkontroluj, že prochází**

Run: `npx vitest run src/app/usecases/normalizeProject.test.ts`
Expected: PASS, všech šest nových testů.

- [ ] **Step 6: Zkontroluj, že se nic nerozbilo**

Run: `npm test`
Expected: proti baseline žádný nový pád (jen `assetsPaths` a `repoAssets`).

Run: `npx biome check src/domain/model/types.ts src/app/usecases/normalizeProject.ts src/app/usecases/normalizeProject.test.ts`
Expected: kromě CRLF nic.

- [ ] **Step 7: Commit**

```bash
git add src/domain/model/types.ts src/app/usecases/normalizeProject.ts src/app/usecases/normalizeProject.test.ts
git commit -m "feat(model): add manual input order and notes deviations to the project"
```

---

## Task 2: `applyManualInputOrder` — slučovací pravidla (R8)

Čtyři pravidla z R8, bez stereo párů. Ty přidá Task 3 zvlášť, protože jde o jinou vlastnost a recenzent má mít možnost schválit jedno a odmítnout druhé.

**Files:**
- Create: `src/domain/pipeline/applyManualInputOrder.ts`
- Test: `src/domain/pipeline/applyManualInputOrder.test.ts`

**Interfaces:**
- Consumes: nic.
- Produces: `applyManualInputOrder<T extends { key: string }>(computed: readonly T[], manualOrder: readonly string[] | undefined): T[]`. Task 3 tuto funkci rozšiřuje, Task 4 ji zapojuje.

- [ ] **Step 1: Napiš padající test**

```ts
import { describe, expect, it } from "vitest";
import { applyManualInputOrder } from "./applyManualInputOrder.js";

type Row = { key: string; group?: string; label?: string; note?: string };

const keys = (rows: Row[]) => rows.map((row) => row.key);
const rows = (...list: string[]): Row[] => list.map((key) => ({ key }));

describe("applyManualInputOrder", () => {
  it("returns the computed order unchanged when there is no manual order", () => {
    const computed = rows("a", "b", "c");

    expect(keys(applyManualInputOrder(computed, undefined))).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(keys(applyManualInputOrder(computed, []))).toEqual(["a", "b", "c"]);
  });

  it("follows the manual order for keys it knows", () => {
    const result = applyManualInputOrder(rows("a", "b", "c"), ["c", "a", "b"]);

    expect(keys(result)).toEqual(["c", "a", "b"]);
  });

  it("ignores manual keys that no longer exist", () => {
    const result = applyManualInputOrder(rows("a", "c"), ["c", "gone", "a"]);

    expect(keys(result)).toEqual(["c", "a"]);
  });

  it("inserts an unknown key after its computed predecessor, not at the end", () => {
    // Vypočtené pořadí a, b, c, d. Ruční pořadí zná d, a, c — b je nový.
    // b následuje po a ve výpočtu, takže patří za a.
    const result = applyManualInputOrder(rows("a", "b", "c", "d"), [
      "d",
      "a",
      "c",
    ]);

    expect(keys(result)).toEqual(["d", "a", "b", "c"]);
  });

  it("puts an unknown key with no known predecessor in front", () => {
    // Vypočtené pořadí new, a, b. Ruční pořadí zná b, a. `new` nemá
    // ve výpočtu žádného známého předchůdce, takže jde na začátek.
    const result = applyManualInputOrder(rows("new", "a", "b"), ["b", "a"]);

    expect(keys(result)).toEqual(["new", "b", "a"]);
  });

  it("keeps several new neighbours in their computed order", () => {
    const result = applyManualInputOrder(rows("a", "n1", "n2", "b"), ["b", "a"]);

    expect(keys(result)).toEqual(["b", "a", "n1", "n2"]);
  });

  it("lets the manual order cross group boundaries", () => {
    const computed: Row[] = [
      { key: "kick", group: "drums" },
      { key: "bass", group: "bass" },
      { key: "voc", group: "vocs" },
    ];

    const result = applyManualInputOrder(computed, ["voc", "kick", "bass"]);

    expect(keys(result)).toEqual(["voc", "kick", "bass"]);
  });

  it("does not mutate its input", () => {
    const computed = rows("a", "b", "c");

    applyManualInputOrder(computed, ["c", "b", "a"]);

    expect(keys(computed)).toEqual(["a", "b", "c"]);
  });

  it("keeps duplicates in the manual order from duplicating rows", () => {
    const result = applyManualInputOrder(rows("a", "b"), ["b", "b", "a"]);

    expect(keys(result)).toEqual(["b", "a"]);
  });
});
```

- [ ] **Step 2: Spusť test a zkontroluj, že padá**

Run: `npx vitest run src/domain/pipeline/applyManualInputOrder.test.ts`
Expected: FAIL — modul neexistuje.

- [ ] **Step 3: Napiš implementaci**

```ts
/**
 * Co? Přerovná vypočtené pořadí kanálů podle ručního pořadí uloženého
 * na projektu (R8).
 *
 * Proč tak? Ruční pořadí musí přežít změnu lineupu. Kanál, který uživatel
 * nikdy neviděl, proto nepadá na konec seznamu, ale vkládá se tam, kam ho
 * dal výpočet — za posledního známého předchůdce. Zmizelé klíče se tiše
 * ignorují, protože lineup se mění častěji než pořadí.
 *
 * Pořadí je čistá funkce nad klíči. Volá se mezi `composeFinalPdfInputOrder`
 * a `assignPdfChannels`, tedy až po `disambiguateInputKeys`, kde jsou klíče
 * unikátní.
 */
export function applyManualInputOrder<T extends { key: string }>(
  computed: readonly T[],
  manualOrder: readonly string[] | undefined,
): T[] {
  if (!manualOrder || manualOrder.length === 0) return [...computed];

  const byKey = new Map<string, T>();
  for (const row of computed) {
    if (!byKey.has(row.key)) byKey.set(row.key, row);
  }

  // Pravidlo 1: základ je ruční pořadí profiltrované na existující klíče,
  // bez duplikátů.
  const placed = new Set<string>();
  const result: T[] = [];
  for (const key of manualOrder) {
    const row = byKey.get(key);
    if (!row || placed.has(key)) continue;
    placed.add(key);
    result.push(row);
  }

  // Pravidla 2 a 3: klíč, který v ručním pořadí není, se vloží za posledního
  // známého předchůdce z vypočteného pořadí; bez předchůdce jde na začátek.
  let anchorKey: string | null = null;
  for (const row of computed) {
    if (placed.has(row.key)) {
      anchorKey = row.key;
      continue;
    }

    const at =
      anchorKey === null
        ? 0
        : result.findIndex((entry) => entry.key === anchorKey) + 1;
    result.splice(at, 0, row);
    placed.add(row.key);
    anchorKey = row.key;
  }

  return result;
}
```

- [ ] **Step 4: Spusť test a zkontroluj, že prochází**

Run: `npx vitest run src/domain/pipeline/applyManualInputOrder.test.ts`
Expected: PASS, všech devět testů.

- [ ] **Step 5: Commit**

```bash
git add src/domain/pipeline/applyManualInputOrder.ts src/domain/pipeline/applyManualInputOrder.test.ts
git commit -m "feat(pipeline): order inputs by the manual key list"
```

---

## Task 3: `applyManualInputOrder` — stereo partneři zůstávají spolu (R9)

`assignPdfChannels` páruje stereo jen z **sousedních** položek (`resolveStereoPair(a, b)`) a navíc vkládá výplňový kanál `spare_ch_N`, aby pár začínal na nepatrném čísle. Rozdělený pár by tedy ztratil jak sloučení `13+14`, tak zarovnání. Hlídá to doména, protože UI testy nemáme.

**Files:**
- Modify: `src/domain/pipeline/applyManualInputOrder.ts`
- Test: `src/domain/pipeline/applyManualInputOrder.test.ts`

**Interfaces:**
- Consumes: `applyManualInputOrder` z Tasku 2; `resolveStereoPair` z `src/domain/formatters/index.js`.
- Produces: stejná signatura, jen zúžená na `T extends { key: string; label: string; group: string; note?: string }`, což je minimum, které `resolveStereoPair` potřebuje. Task 4 s tím počítá.

- [ ] **Step 1: Napiš padající test**

Přidej do `describe("applyManualInputOrder", ...)`:

```ts
  it("pulls a stereo partner back next to its pair", () => {
    const computed = [
      { key: "keys_l", label: "Keys L", group: "keys" },
      { key: "keys_r", label: "Keys R", group: "keys" },
      { key: "bass", label: "Bass DI", group: "bass" },
    ];

    // Uživatel protáhl bass mezi L a R.
    const result = applyManualInputOrder(computed, [
      "keys_l",
      "bass",
      "keys_r",
    ]);

    expect(result.map((row) => row.key)).toEqual([
      "keys_l",
      "keys_r",
      "bass",
    ]);
  });

  it("keeps a pair together when the partner was moved in front", () => {
    const computed = [
      { key: "keys_l", label: "Keys L", group: "keys" },
      { key: "keys_r", label: "Keys R", group: "keys" },
      { key: "bass", label: "Bass DI", group: "bass" },
    ];

    const result = applyManualInputOrder(computed, [
      "keys_r",
      "bass",
      "keys_l",
    ]);

    expect(result.map((row) => row.key)).toEqual([
      "keys_r",
      "keys_l",
      "bass",
    ]);
  });

  it("does not join two channels that only look like a pair", () => {
    // Různá poznámka znamená, že to pár není — `resolveStereoPair` je
    // odmítne a pořadí se nesmí měnit.
    const computed = [
      { key: "keys_l", label: "Keys L", group: "keys", note: "DI" },
      { key: "bass", label: "Bass DI", group: "bass" },
      { key: "keys_r", label: "Keys R", group: "keys", note: "mic" },
    ];

    const result = applyManualInputOrder(computed, [
      "keys_l",
      "bass",
      "keys_r",
    ]);

    expect(result.map((row) => row.key)).toEqual([
      "keys_l",
      "bass",
      "keys_r",
    ]);
  });

  it("leaves an unpaired stereo side alone", () => {
    const computed = [
      { key: "keys_l", label: "Keys L", group: "keys" },
      { key: "bass", label: "Bass DI", group: "bass" },
    ];

    const result = applyManualInputOrder(computed, ["bass", "keys_l"]);

    expect(result.map((row) => row.key)).toEqual(["bass", "keys_l"]);
  });
```

- [ ] **Step 2: Spusť test a zkontroluj, že padá**

Run: `npx vitest run src/domain/pipeline/applyManualInputOrder.test.ts`
Expected: FAIL na prvních dvou nových testech — pár se nespojí.

- [ ] **Step 3: Přidej opravu párů do implementace**

Rozšiř generický parametr a přidej druhý průchod. Na začátek souboru:

```ts
import { resolveStereoPair } from "../formatters/index.js";

type StereoSortable = {
  key: string;
  label: string;
  group: string;
  note?: string;
};
```

Změň signaturu na:

```ts
export function applyManualInputOrder<T extends StereoSortable>(
  computed: readonly T[],
  manualOrder: readonly string[] | undefined,
): T[] {
```

a `return result;` nahraď za `return rejoinStereoPairs(result);`. Ve větvi bez ručního pořadí nech `return [...computed]` — vypočtené pořadí páry nikdy nerozdělí.

Pod hlavní funkci přidej:

```ts
/**
 * Vrátí `R` vedle jeho `L` (R9). `assignPdfChannels` páruje jen sousedy,
 * takže rozdělený pár by se tiskl jako dva samostatné kanály a ztratil by
 * zarovnání na nepatrné číslo.
 *
 * Kritérium páru je `resolveStereoPair`, tedy přesně to, které používá
 * číslování. Dvě položky, které jen vypadají jako pár (jiná skupina, jiná
 * poznámka), se nespojí.
 */
function rejoinStereoPairs<T extends StereoSortable>(rows: T[]): T[] {
  const out = [...rows];

  for (let i = 0; i < out.length; i++) {
    const a = out[i];
    if (out[i + 1] && resolveStereoPair(a, out[i + 1])) {
      i++;
      continue;
    }

    const partnerAt = out.findIndex(
      (candidate, index) => index > i + 1 && resolveStereoPair(a, candidate),
    );
    if (partnerAt === -1) continue;

    const [partner] = out.splice(partnerAt, 1);
    out.splice(i + 1, 0, partner);
    i++;
  }

  return out;
}
```

- [ ] **Step 4: Spusť test a zkontroluj, že prochází**

Run: `npx vitest run src/domain/pipeline/applyManualInputOrder.test.ts`
Expected: PASS, všech třináct testů.

- [ ] **Step 5: Commit**

```bash
git add src/domain/pipeline/applyManualInputOrder.ts src/domain/pipeline/applyManualInputOrder.test.ts
git commit -m "fix(pipeline): keep stereo partners adjacent after manual ordering"
```

---

## Task 4: Zapojení ručního pořadí do pipeline (R8)

**Files:**
- Modify: `src/domain/pipeline/buildDocument.ts:600-606`
- Test: `src/domain/pipeline/buildDocument.manualInputOrder.test.ts` (nový)

**Interfaces:**
- Consumes: `applyManualInputOrder` z Tasků 2 a 3; `Project.inputOrder` z Tasku 1.
- Produces: `DocumentViewModel.inputs[].ch` respektuje `project.inputOrder`.

- [ ] **Step 1: Napiš padající test**

Vytvoř `src/domain/pipeline/buildDocument.manualInputOrder.test.ts`. Fixtura je záměrně tři **mono** kanály jednoho muzikanta: bez stereo páru nevloží `assignPdfChannels` výplňový kanál `spare_ch_N` a čísla se dají porovnávat přímo.

```ts
import { describe, expect, it } from "vitest";
import type { DataRepository } from "../../infra/fs/repo.js";
import type {
  Band,
  Musician,
  NotesTemplate,
  Preset,
  Project,
} from "../model/types.js";
import { buildDocument } from "./buildDocument.js";

const band: Band = {
  id: "band",
  name: "Band",
  bandLeader: "bass-1",
  defaultLineup: { bass: ["bass-1"] },
  defaultOverlays: { leadVocals: [], backVocals: [] },
};

const musician: Musician = {
  id: "bass-1",
  firstName: "Bass",
  lastName: "Player",
  group: "bass",
  presets: [{ kind: "preset", ref: "bass_rig" }],
};

const preset: Preset = {
  type: "preset",
  id: "bass_rig",
  label: "Bass rig",
  group: "bass",
  inputs: [
    { key: "bass_di", label: "Bass DI", group: "bass" },
    { key: "bass_mic", label: "Bass mic", group: "bass" },
    { key: "bass_sub", label: "Bass sub", group: "bass" },
  ],
};

const notes: NotesTemplate = {
  id: "notes_default_cs",
  lang: "cs",
  inputs: [],
  monitors: [],
};

function makeProject(extra: Partial<Project> = {}): Project {
  return {
    id: "p1",
    bandRef: "band",
    purpose: "event",
    documentDate: "2026-01-01",
    lineup: { bass: { musicianId: "bass-1" } },
    ...extra,
  } as Project;
}

function makeRepo(project: Project): DataRepository {
  return {
    getBand: () => band,
    getMusician: () => musician,
    getProject: () => project,
    getPreset: (id: string) => {
      if (id === "bass_rig") return preset;
      throw new Error(`unknown preset ${id}`);
    },
    getNotesTemplate: () => notes,
  } as DataRepository;
}

function build(extra: Partial<Project> = {}) {
  const project = makeProject(extra);
  return buildDocument(project, makeRepo(project));
}

describe("buildDocument manual input order", () => {
  it("numbers channels from one in computed order when the project has none", () => {
    const vm = build();

    expect(vm.inputs.map((input) => [input.key, input.ch])).toEqual([
      ["bass_di", 1],
      ["bass_mic", 2],
      ["bass_sub", 3],
    ]);
  });

  it("renumbers channels according to the manual order", () => {
    const vm = build({ inputOrder: ["bass_sub", "bass_di", "bass_mic"] });

    expect(vm.inputs.map((input) => [input.key, input.ch])).toEqual([
      ["bass_sub", 1],
      ["bass_di", 2],
      ["bass_mic", 3],
    ]);
  });

  it("ignores a manual key the project no longer has (R10)", () => {
    const vm = build({ inputOrder: ["gone", "bass_sub", "bass_di"] });

    expect(vm.inputs.map((input) => input.key)).toEqual([
      "bass_sub",
      "bass_di",
      "bass_mic",
    ]);
  });

  it("keeps the printed rows consistent with the renumbered channels", () => {
    const vm = build({ inputOrder: ["bass_sub", "bass_di", "bass_mic"] });

    expect(vm.inputRows.map((row) => [row.no, row.label])).toEqual([
      ["1", "Bass sub"],
      ["2", "Bass DI"],
      ["3", "Bass mic"],
    ]);
  });
});
```

**Poznámka:** kdyby `inputRows[].no` neslo číslo v jiném formátu (například s vedoucí nulou), uprav očekávání podle skutečného výstupu `compactStereoInputChannelsForPdf` — ne naopak.

- [ ] **Step 2: Spusť test a zkontroluj, že padá**

Run: `npx vitest run src/domain/pipeline/buildDocument.manualInputOrder.test.ts`
Expected: FAIL — druhý test dá pořadí bez ohledu na `inputOrder`.

- [ ] **Step 3: Zapoj funkci do řetězu**

V `src/domain/pipeline/buildDocument.ts` přidej import:

```ts
import { applyManualInputOrder } from "./applyManualInputOrder.js";
```

a nahraď blok na řádcích ~600-606:

```ts
  const orderedInputs = composeFinalPdfInputOrder(
    finalizedInputs,
    leadVocsSlotByMusicianId,
    backVocsSlotByMusicianId,
  );

  // Ruční pořadí se aplikuje až na vypočtené (R8), aby nový kanál po změně
  // lineupu přistál na své vypočtené pozici a ne na konci.
  const inputsWithCh = assignPdfChannels(
    applyManualInputOrder(orderedInputs, project.inputOrder),
  );
```

- [ ] **Step 4: Spusť test a zkontroluj, že prochází**

Run: `npx vitest run src/domain/pipeline/buildDocument.manualInputOrder.test.ts`
Expected: PASS.

- [ ] **Step 5: Zkontroluj, že se nerozbily regrese**

Run: `npm test`
Expected: proti baseline žádný nový pád. Zejména `buildDocument.pdfRegression.test.ts` musí projít — projekty bez `inputOrder` se nesmí změnit ani o kanál.

- [ ] **Step 6: Commit**

```bash
git add src/domain/pipeline/buildDocument.ts src/domain/pipeline/buildDocument.manualInputOrder.test.ts
git commit -m "feat(pipeline): apply the project manual input order before numbering"
```

---

## Task 5: `buildPdfNotes` — odchylky projektu (R11, R13)

Čtyři kroky v **závazném pořadí**: filtr podmínek, vyhození vypnutých, přepis textu, připojení vlastních.

**Files:**
- Modify: `src/domain/pipeline/pdf/buildPdfNotes.ts`
- Test: `src/domain/pipeline/pdf/buildPdfNotes.test.ts`

**Interfaces:**
- Consumes: `ProjectNotesOverride` z Tasku 1.
- Produces: `buildPdfNotes(args: { template: NotesTemplate; monitors: MonitorNoteContext; overrides?: ProjectNotesOverride })`. Task 6 to zapojuje; parametr je **volitelný**, takže existující volání dál platí.

- [ ] **Step 1: Napiš padající test**

Do `buildPdfNotes.test.ts` přidej nový describe blok (fixtura `template` a `NOTHING` už v souboru je):

```ts
const ALL_IEM = {
  hasWedge: false,
  hasBandSuppliedIem: true,
  hasFohSuppliedIem: false,
};

describe("buildPdfNotes project deviations", () => {
  it("drops a disabled template line", () => {
    const notes = buildPdfNotes({
      template,
      monitors: NOTHING,
      overrides: { disabled: ["always"] },
    });

    expect(ids(notes.inputs)).toEqual([]);
  });

  it("drops a disabled line even when a condition would show it", () => {
    const notes = buildPdfNotes({
      template,
      monitors: ALL_IEM,
      overrides: { disabled: ["band_iem"] },
    });

    expect(ids(notes.monitors)).toEqual(["unconditional"]);
  });

  it("replaces the text of a template line and keeps its id and position", () => {
    const notes = buildPdfNotes({
      template,
      monitors: NOTHING,
      overrides: { overrides: { always: "Jiné znění." } },
    });

    expect(notes.inputs).toEqual([{ id: "always", text: "Jiné znění." }]);
  });

  it("ignores an override for a line the condition hides", () => {
    const notes = buildPdfNotes({
      template,
      monitors: NOTHING,
      overrides: { overrides: { band_iem: "Nezobrazí se." } },
    });

    expect(ids(notes.monitors)).toEqual(["unconditional"]);
  });

  it("ignores an override for an id the template does not have", () => {
    const notes = buildPdfNotes({
      template,
      monitors: NOTHING,
      overrides: { overrides: { nonsense: "Nikam nepatří." } },
    });

    expect(ids(notes.inputs)).toEqual(["always"]);
    expect(ids(notes.monitors)).toEqual(["unconditional"]);
  });

  it("appends custom lines at the end of their own section", () => {
    const notes = buildPdfNotes({
      template,
      monitors: NOTHING,
      overrides: {
        custom: [
          { id: "custom_1", section: "inputs", text: "Vstupní věta." },
          { id: "custom_2", section: "monitors", text: "Monitorová věta." },
        ],
      },
    });

    expect(ids(notes.inputs)).toEqual(["always", "custom_1"]);
    expect(ids(notes.monitors)).toEqual(["unconditional", "custom_2"]);
  });

  it("keeps custom lines in their stored order", () => {
    const notes = buildPdfNotes({
      template,
      monitors: NOTHING,
      overrides: {
        custom: [
          { id: "custom_2", section: "inputs", text: "Druhá." },
          { id: "custom_1", section: "inputs", text: "První." },
        ],
      },
    });

    expect(ids(notes.inputs)).toEqual(["always", "custom_2", "custom_1"]);
  });

  it("does not let a custom line be disabled by an unrelated template id", () => {
    const notes = buildPdfNotes({
      template,
      monitors: NOTHING,
      overrides: {
        disabled: ["always"],
        custom: [{ id: "custom_1", section: "inputs", text: "Zůstane." }],
      },
    });

    expect(ids(notes.inputs)).toEqual(["custom_1"]);
  });

  it("behaves exactly as before when there are no deviations", () => {
    expect(buildPdfNotes({ template, monitors: NOTHING })).toEqual(
      buildPdfNotes({ template, monitors: NOTHING, overrides: {} }),
    );
  });
});
```

- [ ] **Step 2: Spusť test a zkontroluj, že padá**

Run: `npx vitest run src/domain/pipeline/pdf/buildPdfNotes.test.ts`
Expected: FAIL — `overrides` není parametr.

- [ ] **Step 3: Napiš implementaci**

Nahraď `export function buildPdfNotes` za:

```ts
/**
 * Poznámky projektu vzniknou ve **čtyřech krocích a v tomto pořadí** (R11):
 * filtr podmínek, vyhození vypnutých, přepis textu, připojení vlastních.
 *
 * Pořadí není libovolné. Přepis se aplikuje až po filtru, takže přepsat řádek,
 * který podmínka skrývá, ho nezobrazí — editor to uživateli říká předem (R13).
 * Vlastní řádky se připojují nakonec, protože nesou vlastní text a žádné
 * podmínky se na ně nevztahují.
 */
function applySectionDeviations(
  lines: NoteLine[],
  section: "inputs" | "monitors",
  overrides: ProjectNotesOverride | undefined,
): NoteLine[] {
  if (!overrides) return lines;

  const disabled = new Set(overrides.disabled ?? []);
  const texts = overrides.overrides ?? {};

  const kept = lines
    .filter((note) => !disabled.has(note.id))
    .map((note) =>
      typeof texts[note.id] === "string"
        ? { ...note, text: texts[note.id] }
        : note,
    );

  const custom = (overrides.custom ?? [])
    .filter((entry) => entry.section === section)
    .map((entry) => ({ id: entry.id, text: entry.text }));

  return [...kept, ...custom];
}

export function buildPdfNotes(args: {
  template: NotesTemplate;
  monitors: MonitorNoteContext;
  overrides?: ProjectNotesOverride;
}): DocumentViewModel["notes"] {
  const { template, monitors, overrides } = args;

  return {
    inputs: applySectionDeviations(
      template.inputs ?? [],
      "inputs",
      overrides,
    ),
    monitors: applySectionDeviations(
      (template.monitors ?? []).filter((note) =>
        matchesCondition(note, monitors),
      ),
      "monitors",
      overrides,
    ),
  };
}
```

Doplň `ProjectNotesOverride` do importu typů z `../../model/types.js`.

- [ ] **Step 4: Spusť test a zkontroluj, že prochází**

Run: `npx vitest run src/domain/pipeline/pdf/buildPdfNotes.test.ts`
Expected: PASS, staré i nové testy.

- [ ] **Step 5: Commit**

```bash
git add src/domain/pipeline/pdf/buildPdfNotes.ts src/domain/pipeline/pdf/buildPdfNotes.test.ts
git commit -m "feat(pipeline): resolve notes as project deviations over the band template"
```

---

## Task 6: Zapojení poznámek do pipeline (R11)

**Files:**
- Modify: `src/domain/pipeline/buildDocument.ts:619-622`
- Test: `src/domain/pipeline/buildDocument.notes.test.ts` (nový)

**Interfaces:**
- Consumes: `buildPdfNotes` s parametrem `overrides` z Tasku 5; `Project.notes` z Tasku 1.
- Produces: `DocumentViewModel.notes` respektuje `project.notes`.

- [ ] **Step 1: Napiš padající test**

Vytvoř `src/domain/pipeline/buildDocument.notes.test.ts`. Fixtura je stejná jako v Tasku 4, jen šablona poznámek není prázdná:

```ts
import { describe, expect, it } from "vitest";
import type { DataRepository } from "../../infra/fs/repo.js";
import type {
  Band,
  Musician,
  NotesTemplate,
  Preset,
  Project,
} from "../model/types.js";
import { buildDocument } from "./buildDocument.js";

const band: Band = {
  id: "band",
  name: "Band",
  bandLeader: "bass-1",
  defaultLineup: { bass: ["bass-1"] },
  defaultOverlays: { leadVocals: [], backVocals: [] },
};

const musician: Musician = {
  id: "bass-1",
  firstName: "Bass",
  lastName: "Player",
  group: "bass",
  presets: [{ kind: "preset", ref: "bass_rig" }],
};

const preset: Preset = {
  type: "preset",
  id: "bass_rig",
  label: "Bass rig",
  group: "bass",
  inputs: [{ key: "bass_di", label: "Bass DI", group: "bass" }],
};

const notes: NotesTemplate = {
  id: "notes_default_cs",
  lang: "cs",
  version: 1,
  inputs: [
    { id: "no_foh_engineer", text: "Kapela NEMÁ vlastního zvukaře." },
    { id: "drum_riser_required", text: "Drum riser 3 × 2 m." },
  ],
  monitors: [{ id: "console_access", text: "Přístup do pultu." }],
};

function makeProject(extra: Partial<Project> = {}): Project {
  return {
    id: "p1",
    bandRef: "band",
    purpose: "event",
    documentDate: "2026-01-01",
    lineup: { bass: { musicianId: "bass-1" } },
    ...extra,
  } as Project;
}

function build(extra: Partial<Project> = {}) {
  const project = makeProject(extra);
  const repo = {
    getBand: () => band,
    getMusician: () => musician,
    getProject: () => project,
    getPreset: (id: string) => {
      if (id === "bass_rig") return preset;
      throw new Error(`unknown preset ${id}`);
    },
    getNotesTemplate: () => notes,
  } as DataRepository;

  return buildDocument(project, repo);
}

describe("buildDocument notes deviations", () => {
  it("prints the whole band template when the project deviates in nothing", () => {
    const vm = build();

    expect(vm.notes.inputs.map((note) => note.id)).toEqual([
      "no_foh_engineer",
      "drum_riser_required",
    ]);
    expect(vm.notes.monitors.map((note) => note.id)).toEqual([
      "console_access",
    ]);
  });

  it("drops a note the project disabled", () => {
    const vm = build({ notes: { disabled: ["drum_riser_required"] } });

    expect(vm.notes.inputs.map((note) => note.id)).toEqual([
      "no_foh_engineer",
    ]);
  });

  it("prints the project text instead of the template text", () => {
    const vm = build({
      notes: { overrides: { drum_riser_required: "Drum riser 2 × 2 m." } },
    });

    expect(
      vm.notes.inputs.find((note) => note.id === "drum_riser_required")?.text,
    ).toBe("Drum riser 2 × 2 m.");
  });

  it("prints a custom note at the end of its own section", () => {
    const vm = build({
      notes: {
        custom: [
          { id: "custom_1", section: "inputs", text: "Naše vstupní věta." },
          { id: "custom_2", section: "monitors", text: "Naše monitorová věta." },
        ],
      },
    });

    expect(vm.notes.inputs.at(-1)).toEqual({
      id: "custom_1",
      text: "Naše vstupní věta.",
    });
    expect(vm.notes.monitors.at(-1)).toEqual({
      id: "custom_2",
      text: "Naše monitorová věta.",
    });
  });
});
```

- [ ] **Step 2: Spusť test a zkontroluj, že padá**

Run: `npx vitest run src/domain/pipeline/buildDocument.notes.test.ts`
Expected: FAIL — odchylky se ignorují.

- [ ] **Step 3: Předej odchylky do `buildPdfNotes`**

V `src/domain/pipeline/buildDocument.ts` přidej do volání `buildPdfNotes` (asi řádek 621) jeden argument:

```ts
  const notes = buildPdfNotes({
    template: repo.getNotesTemplate(notesTemplateId),
    overrides: project.notes,
    monitors: {
```

- [ ] **Step 4: Spusť test a zkontroluj, že prochází**

Run: `npx vitest run src/domain/pipeline/buildDocument.notes.test.ts`
Expected: PASS.

Run: `npm test`
Expected: proti baseline žádný nový pád.

- [ ] **Step 5: Commit**

```bash
git add src/domain/pipeline/buildDocument.ts src/domain/pipeline/buildDocument.notes.test.ts
git commit -m "feat(pipeline): feed project note deviations into the document"
```

---

## Task 7: Persistence nových polí v desktopu (R14)

**Tohle je nejtišší past celé fáze.** `toPersistableProject` je whitelist. Když nová pole nezanese, uložení z kroku `01` nebo `03` je smaže a nikdo nedostane chybu. Přesně to už jednou hrozilo u `stageplan` — komentář na `types.ts:111-114` je o tom.

**Files:**
- Modify: `packages/desktop/src/app/shell/types.ts`
- Test: `packages/desktop/src/app/shell/types.test.ts`

**Interfaces:**
- Consumes: `ProjectNotesOverride` z Tasku 1.
- Produces: `NewProjectPayload.inputOrder`, `NewProjectPayload.notes`. Tasky 10 až 18 na nich staví.

- [ ] **Step 1: Napiš padající test**

Do `packages/desktop/src/app/shell/types.test.ts` přidej:

```ts
describe("toPersistableProject inputs screen persistence", () => {
  const base = {
    id: "p1",
    purpose: "event" as const,
    bandRef: "b1",
    documentDate: "2026-08-22",
    createdAt: "2026-08-01T00:00:00.000Z",
  };

  it("keeps the manual input order", () => {
    const persisted = toPersistableProject({
      ...base,
      inputOrder: ["kick_in", "snare_top"],
    });

    expect(persisted.inputOrder).toEqual(["kick_in", "snare_top"]);
  });

  it("keeps notes deviations", () => {
    const notes = {
      disabled: ["drum_riser_required"],
      overrides: { no_foh_engineer: "Vlastní znění." },
      custom: [
        { id: "custom_1", section: "inputs" as const, text: "Naše věta." },
      ],
    };

    expect(toPersistableProject({ ...base, notes }).notes).toEqual(notes);
  });

  it("omits both keys entirely when there is nothing to store", () => {
    const persisted = toPersistableProject(base);

    expect("inputOrder" in persisted).toBe(false);
    expect("notes" in persisted).toBe(false);
  });

  it("omits an empty manual order rather than storing an empty array", () => {
    const persisted = toPersistableProject({ ...base, inputOrder: [] });

    expect("inputOrder" in persisted).toBe(false);
  });

  /**
   * Tohle je ta past. Krok `01` ani `03` o nových polích nic nevědí, ale
   * ukládají celý projekt — kdyby whitelist pole zapomněl, uložení odjinud
   * by ruční pořadí i poznámky tiše smazalo.
   */
  it("survives a save issued from another screen", () => {
    const loaded = {
      ...base,
      inputOrder: ["kick_in"],
      notes: { disabled: ["x"] },
      stageplan: { powerOverridesByMusician: {} },
    };

    const afterForeignSave = toPersistableProject({
      ...loaded,
      eventVenue: "Jiné místo",
    });

    expect(afterForeignSave.inputOrder).toEqual(["kick_in"]);
    expect(afterForeignSave.notes?.disabled).toEqual(["x"]);
  });
});
```

- [ ] **Step 2: Spusť test a zkontroluj, že padá**

Run: `npx vitest run packages/desktop/src/app/shell/types.test.ts`
Expected: FAIL — pole na `NewProjectPayload` neexistují.

- [ ] **Step 3: Rozšiř typ a whitelist**

V `packages/desktop/src/app/shell/types.ts` přidej do `NewProjectPayload` za `stageplan`:

```ts
  /**
   * Ruční pořadí kanálů z obrazovky `02` (R8). Whitelist v
   * `toPersistableProject` ho musí nést výslovně — jinak by uložení z jiné
   * obrazovky ruční pořadí smazalo, a to bez chyby.
   */
  inputOrder?: readonly string[];

  /** Odchylky poznámek proti šabloně kapely (R11). Platí totéž o whitelistu. */
  notes?: ProjectNotesOverride;
```

Import `ProjectNotesOverride` z `../../../../../src/domain/model/types`.

V `toPersistableProject` přidej `inputOrder` a `notes` do destrukturalizace a do návratového objektu:

```ts
    stageplan,
    inputOrder,
    notes,
  } = project;
```

```ts
    ...(stageplan ? { stageplan } : {}),
    ...(inputOrder && inputOrder.length > 0 ? { inputOrder } : {}),
    ...(notes ? { notes } : {}),
  };
```

- [ ] **Step 4: Spusť test a zkontroluj, že prochází**

Run: `npx vitest run packages/desktop/src/app/shell/types.test.ts`
Expected: PASS, včetně testu na uložení z jiné obrazovky.

Run: `npx tsc -p packages/desktop/tsconfig.json --noEmit`
Expected: proti baseline žádná nová chyba (baseline 10 ve 4 testových souborech).

- [ ] **Step 5: Commit**

```bash
git add packages/desktop/src/app/shell/types.ts packages/desktop/src/app/shell/types.test.ts
git commit -m "feat(shell): persist manual input order and note deviations"
```

---

## Task 8: Routa `/inputs` a procesní stopa

**Files:**
- Modify: `packages/desktop/src/app/shell/routes.ts`
- Modify: `packages/desktop/src/app/shell/chrome/processSteps.ts`
- Test: `packages/desktop/src/app/shell/chrome/processSteps.test.ts`

**Interfaces:**
- Consumes: nic.
- Produces: `matchProjectInputsPath(pathname: string): string | null`, routa s klíčem `project-inputs`, krok `inputs` s `path` `/projects/:id/inputs`. Task 10 na ně navazuje.

- [ ] **Step 1: Napiš padající test**

Do `processSteps.test.ts` přidej:

```ts
  it("makes the inputs step available from other project screens", () => {
    const trail = buildProcessSteps("/projects/p1/setup");
    const inputs = trail?.find((step) => step.id === "inputs");

    expect(inputs?.state).toBe("available");
    expect(inputs?.path).toBe("/projects/p1/inputs");
  });

  it("marks the inputs step as current on its own screen", () => {
    const trail = buildProcessSteps("/projects/p1/inputs");

    expect(trail?.map((step) => step.state)).toEqual([
      "available",
      "current",
      "available",
      "available",
    ]);
  });

  it("has no unavailable step left", () => {
    for (const pathname of [
      "/projects/p1/setup",
      "/projects/p1/inputs",
      "/projects/p1/stageplan",
      "/projects/p1/preview",
    ]) {
      const trail = buildProcessSteps(pathname);
      expect(
        trail?.every((step) => step.state !== "unavailable"),
        pathname,
      ).toBe(true);
    }
  });
```

- [ ] **Step 2: Spusť test a zkontroluj, že padá**

Run: `npx vitest run packages/desktop/src/app/shell/chrome/processSteps.test.ts`
Expected: FAIL — krok `inputs` je `unavailable`, `/projects/p1/inputs` vrací `null`.

- [ ] **Step 3: Přidej matcher a routu**

V `packages/desktop/src/app/shell/routes.ts` přidej funkci:

```ts
export function matchProjectInputsPath(pathname: string): string | null {
  return pathname.match(/^\/projects\/([^/]+)\/inputs$/)?.[1] ?? null;
}
```

a do `SHELL_ROUTES` mezi `project-setup` a `project-stageplan`:

```ts
  {
    key: "project-inputs",
    test: (pathname) => Boolean(matchProjectInputsPath(pathname)),
  },
```

- [ ] **Step 4: Otevři krok ve stopě**

V `processSteps.ts` uprav tři místa. Import:

```ts
import {
  matchProjectInputsPath,
  matchProjectPreviewPath,
  matchProjectSetupPath,
  matchProjectStageplanPath,
} from "../routes";
```

Seznam kroků:

```ts
  { id: "inputs", label: "INPUTS", segment: "inputs" },
```

A rozpoznání aktuálního kroku:

```ts
  const setupProjectId = matchProjectSetupPath(pathname);
  const inputsProjectId = matchProjectInputsPath(pathname);
  const stageplanProjectId = matchProjectStageplanPath(pathname);
  const projectId =
    setupProjectId ??
    inputsProjectId ??
    stageplanProjectId ??
    matchProjectPreviewPath(pathname);
  if (projectId === null) return null;

  const currentId: StepId =
    setupProjectId !== null
      ? "lineup"
      : inputsProjectId !== null
        ? "inputs"
        : stageplanProjectId !== null
          ? "stageplan"
          : "export";
```

Uprav i doc komentář na začátku souboru — tvrzení „One of the four steps has no screen yet" už neplatí. Napiš, že všechny čtyři kroky mají obrazovku a `StepState.unavailable` zůstává v modelu pro budoucí kroky.

- [ ] **Step 5: Spusť testy a zkontroluj, že prochází**

Run: `npx vitest run packages/desktop/src/app/shell/chrome/processSteps.test.ts packages/desktop/src/app/shell/chrome/shellChrome.test.tsx`
Expected: PASS. Kdyby `shellChrome.test.tsx` padal na počtu klikatelných kroků, uprav jeho očekávání — je to zamýšlená změna.

- [ ] **Step 6: Commit**

```bash
git add packages/desktop/src/app/shell/routes.ts packages/desktop/src/app/shell/chrome/processSteps.ts packages/desktop/src/app/shell/chrome/processSteps.test.ts
git commit -m "feat(shell): open the inputs step in the process trail"
```

---

## Task 9: Extrakce sdíleného setup stavu (R16)

**Nejrizikovější task fáze.** `ProjectSetupPage.tsx` nemá vlastní test, takže jediná pojistka je, že vytažená logika bude čistá a otestovaná **před** tím, než se na ni napojí UI.

Dobrá zpráva: `resolveMusicianDefaultPreset` a `resolveSlotSetup` (dnes `useCallback` na řádcích 1265-1300) **žádný React nepotřebují** — jen se uzavírají nad `setupData` a `presetCatalog`. Extrakce je tedy mechanická.

**Files:**
- Create: `packages/desktop/src/app/domain/setup/resolveSetupForSlot.ts`
- Create: `packages/desktop/src/app/domain/setup/resolveSetupForSlot.test.ts`
- Create: `packages/desktop/src/app/domain/setup/useSetupOverrides.ts`
- Modify: `packages/desktop/src/app/pages/ProjectSetupPage.tsx:1265-1300`

**Interfaces:**
- Consumes: `resolveMusicianDefaultSetupForRole`, `getGroupDefaultPreset` ze `../../pages/shared/setupConstants`; `resolveEffectiveMusicianSetup` z domény.
- Produces:
  - `resolveMusicianDefaultPreset(args: { role: Group; musicianId: string; setupData: BandSetupData | null; presetCatalog: Record<string, PresetEntity> }): MusicianSetupPreset`
  - `resolveSetupForSlot(args: { role: Group; musicianId: string; patch?: PresetOverridePatch; setupData: BandSetupData | null; presetCatalog: Record<string, PresetEntity> }): { resolved: EffectiveMusicianSetup; effective: MusicianSetupPreset }`
  - `useSetupOverrides(args: { setupData; presetCatalog }): { resolveMusicianDefaultPreset(role, musicianId); resolveSetupForSlot(role, musicianId, patch?) }`
  - Tasky 11 až 16 používají `useSetupOverrides`.

- [ ] **Step 1: Přečti současný kód**

Přečti `packages/desktop/src/app/pages/ProjectSetupPage.tsx:1265-1300`. Zachovej **beze zbytku** chování včetně klíčů `${musicianId}:${role}` pro role-scoped defaults. Přesný typ návratu `resolveEffectiveMusicianSetup` si dohledej v doméně — v plánu je pojmenovaný `EffectiveMusicianSetup`, použij skutečný název z kódu.

- [ ] **Step 2: Napiš padající test čistých funkcí**

Vytvoř `resolveSetupForSlot.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  resolveMusicianDefaultPreset,
  resolveSetupForSlot,
} from "./resolveSetupForSlot";

const EMPTY_CATALOG = {};

describe("resolveMusicianDefaultPreset", () => {
  it("falls back to the band default when there is no setup data", () => {
    const preset = resolveMusicianDefaultPreset({
      role: "bass",
      musicianId: "m1",
      setupData: null,
      presetCatalog: EMPTY_CATALOG,
    });

    expect(preset.inputs).toBeInstanceOf(Array);
    expect(preset.monitoring).toBeDefined();
  });

  it("prefers role scoped defaults over generic ones", () => {
    const setupData = {
      musicianDefaults: {
        "m1:bass": { inputs: [{ key: "role_scoped", label: "Role scoped" }] },
        m1: { inputs: [{ key: "generic", label: "Generic" }] },
      },
    };

    const preset = resolveMusicianDefaultPreset({
      role: "bass",
      musicianId: "m1",
      setupData: setupData as never,
      presetCatalog: EMPTY_CATALOG,
    });

    expect(preset.inputs.map((input) => input.key)).toContain("role_scoped");
  });
});

describe("resolveSetupForSlot", () => {
  it("returns the default setup when there is no patch", () => {
    const { effective } = resolveSetupForSlot({
      role: "bass",
      musicianId: "m1",
      setupData: null,
      presetCatalog: EMPTY_CATALOG,
    });

    expect(effective.inputs).toBeInstanceOf(Array);
  });

  it("applies a remove patch to the effective inputs", () => {
    const setupData = {
      musicianDefaults: {
        "m1:bass": {
          inputs: [
            { key: "el_bass_di", label: "Bass DI" },
            { key: "el_bass_mic", label: "Bass mic" },
          ],
        },
      },
    };

    const { effective } = resolveSetupForSlot({
      role: "bass",
      musicianId: "m1",
      patch: { inputs: { remove: ["el_bass_mic"] } },
      setupData: setupData as never,
      presetCatalog: EMPTY_CATALOG,
    });

    expect(effective.inputs.map((input) => input.key)).not.toContain(
      "el_bass_mic",
    );
  });

  it("applies a label update patch to the effective inputs", () => {
    const setupData = {
      musicianDefaults: {
        "m1:bass": { inputs: [{ key: "el_bass_di", label: "Bass DI" }] },
      },
    };

    const { effective } = resolveSetupForSlot({
      role: "bass",
      musicianId: "m1",
      patch: {
        inputs: { update: [{ key: "el_bass_di", label: "Matěj bass" }] },
      },
      setupData: setupData as never,
      presetCatalog: EMPTY_CATALOG,
    });

    expect(
      effective.inputs.find((input) => input.key === "el_bass_di")?.label,
    ).toBe("Matěj bass");
  });
});
```

**Poznámka:** kdyby skutečný tvar `BandSetupData.musicianDefaults` fixtuře nesedl, uprav fixturu podle typu, ne test podle fixtury. Tvar si přečti v `packages/desktop/src/app/shell/types.ts`.

- [ ] **Step 3: Spusť test a zkontroluj, že padá**

Run: `npx vitest run packages/desktop/src/app/domain/setup/resolveSetupForSlot.test.ts`
Expected: FAIL — modul neexistuje.

- [ ] **Step 4: Napiš čisté funkce**

Vytvoř `resolveSetupForSlot.ts`. Tělo přenes z `ProjectSetupPage.tsx:1265-1300`, jen `setupData` a `presetCatalog` přijmi parametrem místo uzávěru:

```ts
/**
 * Co? Rozlišení výchozího a efektivního setupu jednoho slotu lineupu.
 *
 * Proč tady? Obrazovky `01` a `02` obě potřebují totéž — `01` kvůli validaci
 * lineupu, `02` kvůli editaci kanálů. Logika je čistá, takže nesedí v žádné
 * z těch dvou komponent, a hlavně: `ProjectSetupPage.tsx` nemá vlastní test,
 * takže tohle je jediné místo, kde se dá tato logika hlídat (R16).
 */
export function resolveMusicianDefaultPreset(args: {
  role: Group;
  musicianId: string;
  setupData: BandSetupData | null;
  presetCatalog: Record<string, PresetEntity>;
}): MusicianSetupPreset {
  const { role, musicianId, setupData, presetCatalog } = args;
  return resolveMusicianDefaultSetupForRole({
    role,
    musicianDefaults: setupData?.musicianDefaults?.[musicianId],
    roleScopedDefaults: setupData?.musicianDefaults?.[`${musicianId}:${role}`],
    presetItems: setupData?.musicianPresetsById?.[musicianId],
    presetCatalog,
    bandDefaults: getGroupDefaultPreset(role),
  });
}

export function resolveSetupForSlot(args: {
  role: Group;
  musicianId: string;
  patch?: PresetOverridePatch;
  setupData: BandSetupData | null;
  presetCatalog: Record<string, PresetEntity>;
}) {
  const { role, musicianId, patch, setupData, presetCatalog } = args;
  const musicianDefaults = resolveMusicianDefaultPreset({
    role,
    musicianId,
    setupData,
    presetCatalog,
  });
  const resolved = resolveEffectiveMusicianSetup({
    musicianDefaults,
    bandDefaults: getGroupDefaultPreset(role),
    eventOverride: patch,
    group: role,
  });

  return {
    resolved,
    effective: {
      inputs: resolved.effectiveInputs,
      monitoring: resolved.effectiveMonitoring,
    },
  };
}
```

- [ ] **Step 5: Spusť test a zkontroluj, že prochází**

Run: `npx vitest run packages/desktop/src/app/domain/setup/resolveSetupForSlot.test.ts`
Expected: PASS.

- [ ] **Step 6: Napiš React obal**

Vytvoř `useSetupOverrides.ts`:

```ts
import { useCallback } from "react";
import type { Group } from "../../../../../../src/domain/model/groups";
import type {
  PresetEntity,
  PresetOverridePatch,
} from "../../../../../../src/domain/model/types";
import type { BandSetupData } from "../../shell/types";
import {
  resolveMusicianDefaultPreset,
  resolveSetupForSlot,
} from "./resolveSetupForSlot";

/**
 * Tenký obal nad čistými funkcemi — drží jen memoizaci. Veškerá logika je
 * v `resolveSetupForSlot.ts`, aby byla testovatelná bez Reactu (R16).
 */
export function useSetupOverrides(args: {
  setupData: BandSetupData | null;
  presetCatalog: Record<string, PresetEntity>;
}) {
  const { setupData, presetCatalog } = args;

  const defaultPresetFor = useCallback(
    (role: Group, musicianId: string) =>
      resolveMusicianDefaultPreset({
        role,
        musicianId,
        setupData,
        presetCatalog,
      }),
    [setupData, presetCatalog],
  );

  const setupForSlot = useCallback(
    (role: Group, musicianId: string, patch?: PresetOverridePatch) =>
      resolveSetupForSlot({
        role,
        musicianId,
        patch,
        setupData,
        presetCatalog,
      }),
    [setupData, presetCatalog],
  );

  return { defaultPresetFor, setupForSlot };
}
```

Ověř skutečnou hloubku relativní cesty k `src/domain` — musí odpovídat umístění souboru.

- [ ] **Step 7: Napoj `ProjectSetupPage` na hook**

V `ProjectSetupPage.tsx` nahraď `useCallback` bloky `resolveMusicianDefaultPreset` a `resolveSlotSetup` za:

```ts
  const { defaultPresetFor, setupForSlot } = useSetupOverrides({
    setupData,
    presetCatalog,
  });
```

a přejmenuj volání v celém souboru: `resolveMusicianDefaultPreset(role, id)` → `defaultPresetFor(role, id)`, `resolveSlotSetup(role, id, patch)` → `setupForSlot(role, id, patch)`. **Nic jiného v této komponentě neměň** — to je Task 19.

- [ ] **Step 8: Ověř, že se `01` nezměnil**

Run: `npm test`
Expected: proti baseline žádný nový pád.

Run: `npx tsc -p packages/desktop/tsconfig.json --noEmit`
Expected: proti baseline žádná nová chyba.

Run: `npm run dev` a projdi krok `01`: otevři setup modál u bubeníka a u basáka, odeber kanál, vrať ho, zavři modál. Chování musí být totožné jako před taskem. **Toto je jediná pojistka proti regresi, jinou nemáme.**

- [ ] **Step 9: Commit**

```bash
git add packages/desktop/src/app/domain/setup packages/desktop/src/app/pages/ProjectSetupPage.tsx
git commit -m "refactor(setup): extract slot setup resolution into testable pure functions"
```

---

## Task 10: `ProjectInputsPage` — načtení, uložení, navigační pojistka (R15)

Skelet obrazovky. Po tomto tasku je krok `02` průchodný, jen prázdný.

**Files:**
- Create: `packages/desktop/src/app/pages/ProjectInputsPage.tsx`
- Modify: `packages/desktop/src/app/pages/index.ts`
- Modify: `packages/desktop/src/app/shell/ShellRouter.tsx`
- Test: `packages/desktop/src/app/pages/ProjectInputsPage.test.tsx`

**Interfaces:**
- Consumes: `matchProjectInputsPath` z Tasku 8; `NewProjectPayload.inputOrder` a `.notes` z Tasku 7; `useSetupOverrides` z Tasku 9.
- Produces: `ProjectInputsPage({ id, navigate, registerNavigationGuard }: ProjectRouteProps)` a **čistá** funkce `isInputsDirty(initial, current)`. Tasky 11 až 18 do stránky vkládají sekce.

- [ ] **Step 1: Přečti vzor**

Přečti `packages/desktop/src/app/pages/StagePlanEditorPage.tsx:44-120`. Použij **stejný** `LoadState` union, stejné použití `readProject` / `parseProjectPayload` / `saveProjectPayload` a stejné napojení `registerNavigationGuard`. Nevymýšlej vlastní.

- [ ] **Step 2: Napiš padající test čisté logiky**

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { isInputsDirty } from "./ProjectInputsPage";

describe("isInputsDirty", () => {
  const empty = { inputOrder: undefined, notes: undefined, lineup: {} };

  it("is clean when nothing changed", () => {
    expect(isInputsDirty(empty, empty)).toBe(false);
  });

  it("is dirty once a manual order appears", () => {
    expect(
      isInputsDirty(empty, { ...empty, inputOrder: ["kick_in"] }),
    ).toBe(true);
  });

  it("is dirty once notes deviate", () => {
    expect(
      isInputsDirty(empty, { ...empty, notes: { disabled: ["x"] } }),
    ).toBe(true);
  });

  it("is dirty when a slot patch changed", () => {
    expect(
      isInputsDirty(empty, {
        ...empty,
        lineup: { bass: [{ musicianId: "m1", presetOverride: { inputs: { remove: ["x"] } } }] },
      }),
    ).toBe(true);
  });

  it("ignores key order inside notes deviations", () => {
    expect(
      isInputsDirty(
        { ...empty, notes: { disabled: ["a", "b"] } },
        { ...empty, notes: { disabled: ["a", "b"] } },
      ),
    ).toBe(false);
  });
});
```

- [ ] **Step 3: Spusť test a zkontroluj, že padá**

Run: `npx vitest run packages/desktop/src/app/pages/ProjectInputsPage.test.tsx`
Expected: FAIL — modul neexistuje.

- [ ] **Step 4: Napiš stránku**

```tsx
export type InputsEditorSnapshot = {
  inputOrder: readonly string[] | undefined;
  notes: ProjectNotesOverride | undefined;
  lineup: LineupMap;
};

/**
 * Dirty stav obrazovky `02`. Srovnává jen to, co obrazovka edituje —
 * ruční pořadí, odchylky poznámek a patche na slotech lineupu.
 *
 * Porovnání přes serializaci je tady záměrné: struktura je malá, plochá
 * a ukládá se do JSONu, takže hlubší srovnání by jen opakovalo, co dělá
 * `JSON.stringify`, a snadněji by se rozešlo s tím, co se opravdu zapíše.
 */
export function isInputsDirty(
  initial: InputsEditorSnapshot,
  current: InputsEditorSnapshot,
): boolean {
  return JSON.stringify(initial) !== JSON.stringify(current);
}
```

Dál komponenta podle vzoru z Stepu 1: `LoadState` union (`loading` / `error` / `ready`), načtení v `useEffect`, `initialSnapshot` v `useRef`, `registerNavigationGuard` napojený na `isInputsDirty`, a JSX se třemi prázdnými sekcemi:

```tsx
      <section className="inputsSection" aria-label="Input list">
        <h2 className="inputsSectionTitle">INPUT LIST</h2>
      </section>
      <section className="inputsSection" aria-label="Monitors">
        <h2 className="inputsSectionTitle">MONITORS</h2>
      </section>
      <section className="inputsSection" aria-label="Notes">
        <h2 className="inputsSectionTitle">NOTES</h2>
      </section>
```

Patička s `Save & Continue` mířícím na `/projects/${id}/stageplan` (chování dodá Task 18; teď stačí tlačítko, které ukládá a naviguje).

- [ ] **Step 5: Zapoj do routeru**

Do `packages/desktop/src/app/pages/index.ts` přidej export. V `ShellRouter.tsx` přidej vedle `project-stageplan` větev pro `project-inputs`, která renderuje `ProjectInputsPage` se stejnými propsy jako `StagePlanEditorPage`.

- [ ] **Step 6: Přidej statický render test**

```tsx
describe("ProjectInputsPage", () => {
  it("renders the three document sections", () => {
    const html = renderToStaticMarkup(
      <ProjectInputsPage
        id="p1"
        navigate={() => undefined}
        registerNavigationGuard={() => () => undefined}
      />,
    );

    expect(html).toContain("INPUT LIST");
    expect(html).toContain("MONITORS");
    expect(html).toContain("NOTES");
  });
});
```

Kdyby komponenta při serverovém renderu potřebovala provider (jako `ProjectPreviewPage` potřebuje `ToastProvider`), obal ji stejně jako to dělá `ProjectPreviewPage.test.tsx`.

- [ ] **Step 7: Ověř**

Run: `npx vitest run packages/desktop/src/app/pages/ProjectInputsPage.test.tsx`
Expected: PASS.

Run: `npm run dev` — klikni krok `02` ve stopě. Obrazovka se otevře, tři prázdné sekce, `Save & Continue` vede na `03`.

- [ ] **Step 8: Commit**

```bash
git add packages/desktop/src/app/pages/ProjectInputsPage.tsx packages/desktop/src/app/pages/ProjectInputsPage.test.tsx packages/desktop/src/app/pages/index.ts packages/desktop/src/app/shell/ShellRouter.tsx
git commit -m "feat(inputs): add the inputs screen shell with dirty tracking"
```

---

## Task 11: Model řádků a tabulka kanálů (R1, R2, R3)

**Files:**
- Create: `packages/desktop/src/app/domain/inputs/buildInputEditorRows.ts`
- Create: `packages/desktop/src/app/domain/inputs/buildInputEditorRows.test.ts`
- Create: `packages/desktop/src/app/components/inputs/InputTable.tsx`
- Modify: `packages/desktop/src/app/pages/ProjectInputsPage.tsx`

**Interfaces:**
- Consumes: `useSetupOverrides` z Tasku 9; `applyManualInputOrder` z Tasků 2 a 3; `assignPdfChannels` z `src/domain/pipeline/pdf/assignPdfChannels.js`.
- Produces:
  - `InputEditorRow = { key: string; ch: number | null; label: string; note: string; group: Group; ownerRole: Group; ownerMusicianId: string; slotKey: string; state: "active" | "removed" | "filler" }`
  - `buildInputEditorRows(args: { lineup: LineupMap; roleOrder: readonly Group[]; inputOrder: readonly string[] | undefined; setupForSlot: SetupForSlot }): InputEditorRow[]`
  - Tasky 12 až 14 na řádcích staví.

**Rozhodnutí, které spec nepředvídal — čísluje doména, ne editor.** `assignPdfChannels` vkládá výplňový kanál `spare_ch_N` (label `---`), aby stereo pár začínal na nepatrném čísle. Kdyby si editor čísloval sám od jedničky, jeho čísla by se od PDF rozešla přesně u projektů se stereo párem, a obrazovka má být zrcadlo dokumentu (R1). Editor proto volá **tutéž funkci** a výplňové kanály zobrazuje jako řádky se stavem `filler`, které nejde editovat ani táhnout. Je to upřesnění R3, ne odchylka: R3 mluví o vypnutých řádcích, tohle je třetí druh řádku.

- [ ] **Step 1: Napiš padající test**

```ts
import { describe, expect, it } from "vitest";
import { buildInputEditorRows } from "./buildInputEditorRows";

const DEFAULTS = [
  { key: "el_bass_di", label: "Bass DI", note: "DI box", group: "bass" },
  { key: "el_bass_mic", label: "Bass mic", group: "bass" },
];

/**
 * Stub `setupForSlot`: `defaultPreset` je vždy celý katalog slotu,
 * `effective` jen klíče, které mají po aplikaci patche zůstat.
 */
function stubSetup(effectiveKeys: string[], extra: typeof DEFAULTS = []) {
  return () =>
    ({
      resolved: { defaultPreset: { inputs: DEFAULTS, monitoring: {} } },
      effective: {
        inputs: [
          ...DEFAULTS.filter((input) => effectiveKeys.includes(input.key)),
          ...extra,
        ],
        monitoring: {},
      },
    }) as never;
}

const LINEUP = { bass: [{ musicianId: "m1" }] };
const ROLES = ["bass"] as const;

describe("buildInputEditorRows", () => {
  it("numbers active rows from one", () => {
    const rows = buildInputEditorRows({
      lineup: LINEUP,
      roleOrder: ROLES,
      inputOrder: undefined,
      setupForSlot: stubSetup(["el_bass_di", "el_bass_mic"]),
    });

    expect(rows.map((row) => [row.key, row.ch])).toEqual([
      ["el_bass_di", 1],
      ["el_bass_mic", 2],
    ]);
  });

  it("keeps a removed channel in the list without a number (R3)", () => {
    const rows = buildInputEditorRows({
      lineup: LINEUP,
      roleOrder: ROLES,
      inputOrder: undefined,
      setupForSlot: stubSetup(["el_bass_di"]),
    });

    expect(rows).toHaveLength(2);
    const removed = rows.find((row) => row.key === "el_bass_mic");
    expect(removed?.state).toBe("removed");
    expect(removed?.ch).toBeNull();
  });

  it("does not let a removed row consume a channel number", () => {
    const rows = buildInputEditorRows({
      lineup: LINEUP,
      roleOrder: ROLES,
      inputOrder: undefined,
      setupForSlot: stubSetup(["el_bass_mic"]),
    });

    expect(rows.find((row) => row.key === "el_bass_mic")?.ch).toBe(1);
  });

  it("treats a channel the project added as active", () => {
    const rows = buildInputEditorRows({
      lineup: LINEUP,
      roleOrder: ROLES,
      inputOrder: undefined,
      setupForSlot: stubSetup(["el_bass_di"], [
        { key: "extra", label: "Extra", group: "bass" },
      ]),
    });

    expect(rows.find((row) => row.key === "extra")?.state).toBe("active");
  });

  it("carries the owner so the inspector can show it (R2)", () => {
    const rows = buildInputEditorRows({
      lineup: LINEUP,
      roleOrder: ROLES,
      inputOrder: undefined,
      setupForSlot: stubSetup(["el_bass_di"]),
    });

    expect(rows[0].ownerMusicianId).toBe("m1");
    expect(rows[0].ownerRole).toBe("bass");
    expect(rows[0].slotKey).toBe("bass:0");
  });

  it("follows the manual order", () => {
    const rows = buildInputEditorRows({
      lineup: LINEUP,
      roleOrder: ROLES,
      inputOrder: ["el_bass_mic", "el_bass_di"],
      setupForSlot: stubSetup(["el_bass_di", "el_bass_mic"]),
    });

    expect(rows.map((row) => row.key)).toEqual([
      "el_bass_mic",
      "el_bass_di",
    ]);
  });

  it("skips a slot with no musician", () => {
    const rows = buildInputEditorRows({
      lineup: { bass: [{ musicianId: "" }] },
      roleOrder: ROLES,
      inputOrder: undefined,
      setupForSlot: stubSetup(["el_bass_di"]),
    });

    expect(rows).toEqual([]);
  });

  it("shows a stereo filler channel the way the document prints it", () => {
    const stereo = [
      { key: "keys_l", label: "Keys L", group: "keys" },
      { key: "keys_r", label: "Keys R", group: "keys" },
    ];

    const rows = buildInputEditorRows({
      lineup: { keys: [{ musicianId: "m2" }] },
      roleOrder: ["keys"],
      // Mono kanál před párem posune pár na sudé číslo, takže `assignPdfChannels`
      // musí vložit výplň — editor ji zobrazí, protože se tiskne.
      inputOrder: ["mono", "keys_l", "keys_r"],
      setupForSlot: (() =>
        ({
          resolved: {
            defaultPreset: {
              inputs: [{ key: "mono", label: "Mono", group: "keys" }, ...stereo],
              monitoring: {},
            },
          },
          effective: {
            inputs: [{ key: "mono", label: "Mono", group: "keys" }, ...stereo],
            monitoring: {},
          },
        }) as never),
    });

    const filler = rows.find((row) => row.state === "filler");
    expect(filler?.label).toBe("---");
    expect(rows.find((row) => row.key === "keys_l")?.ch).toBe(3);
    expect(rows.find((row) => row.key === "keys_r")?.ch).toBe(4);
  });
});
```

- [ ] **Step 2: Spusť test a zkontroluj, že padá**

Run: `npx vitest run packages/desktop/src/app/domain/inputs/buildInputEditorRows.test.ts`
Expected: FAIL — modul neexistuje.

- [ ] **Step 3: Napiš model řádků**

```ts
import type { Group } from "../../../../../../src/domain/model/groups";
import type {
  MusicianSetupPreset,
  PresetOverridePatch,
} from "../../../../../../src/domain/model/types";
import { applyManualInputOrder } from "../../../../../../src/domain/pipeline/applyManualInputOrder";
import { assignPdfChannels } from "../../../../../../src/domain/pipeline/pdf/assignPdfChannels";
import type { LineupMap } from "../../../projectRules";

export type InputEditorRow = {
  readonly key: string;
  /** null u vypnutého řádku — číslo spotřebují jen tištěné kanály (R3). */
  readonly ch: number | null;
  readonly label: string;
  readonly note: string;
  readonly group: Group;
  readonly ownerRole: Group;
  readonly ownerMusicianId: string;
  readonly slotKey: string;
  readonly state: "active" | "removed" | "filler";
};

export type SetupForSlot = (
  role: Group,
  musicianId: string,
  patch?: PresetOverridePatch,
) => {
  resolved: { defaultPreset: MusicianSetupPreset };
  effective: MusicianSetupPreset;
};

/**
 * Co? Řádky tabulky kanálů na obrazovce `02`.
 *
 * Proč vypnuté řádky zůstávají? Je to jediné vědomé místo, kde se editor
 * liší od tisku (R3): uživatel vidí, co odškrtl, a vrátí to jedním klikem.
 * Číslo takový řádek nedostane, aby čísla souhlasila s dokumentem.
 *
 * Proč čísluje `assignPdfChannels` a ne tenhle modul? Protože ta funkce
 * vkládá výplňový kanál pro zarovnání stereo páru na nepatrné číslo. Vlastní
 * číslování od jedničky by se od PDF rozešlo přesně tam, kde na tom záleží.
 */
export function buildInputEditorRows(args: {
  lineup: LineupMap;
  roleOrder: readonly Group[];
  inputOrder: readonly string[] | undefined;
  setupForSlot: SetupForSlot;
}): InputEditorRow[] {
  const { lineup, roleOrder, inputOrder, setupForSlot } = args;
  const collected: InputEditorRow[] = [];

  for (const role of roleOrder) {
    const slots = Array.isArray(lineup[role]) ? lineup[role] : [];

    slots.forEach((slot, slotIndex) => {
      const musicianId = slot?.musicianId?.trim();
      if (!musicianId) return;

      const { resolved, effective } = setupForSlot(
        role,
        musicianId,
        slot.presetOverride,
      );
      const slotKey = `${role}:${slotIndex}`;
      const activeKeys = new Set(effective.inputs.map((input) => input.key));

      const toRow = (
        input: { key: string; label: string; note?: string; group?: Group },
        state: "active" | "removed",
      ): InputEditorRow => ({
        key: input.key,
        ch: null,
        label: input.label,
        note: input.note ?? "",
        group: input.group ?? role,
        ownerRole: role,
        ownerMusicianId: musicianId,
        slotKey,
        state,
      });

      for (const input of effective.inputs) collected.push(toRow(input, "active"));

      for (const input of resolved.defaultPreset.inputs) {
        if (activeKeys.has(input.key)) continue;
        collected.push(toRow(input, "removed"));
      }
    });
  }

  const ordered = applyManualInputOrder(collected, inputOrder);

  // Čísla přiřadí doména nad tištěnými řádky; vypnuté se do ní neposílají.
  //
  // Pole `ch` se musí odstranit, ne jen ignorovat: `assignPdfChannels` staví
  // výsledek jako `{ ch: nextCh, ...input }`, takže vlastní `ch: null` na vstupu
  // by přiřazené číslo spreadem přepsalo zpátky na `null`.
  const printable = ordered
    .filter((row) => row.state === "active")
    .map(({ key, label, note, group, ownerRole, ownerMusicianId }) => ({
      key,
      label,
      note,
      group,
      ownerRole,
      ownerMusicianId,
    }));
  const numbered = new Map<string, number>();
  const fillers: InputEditorRow[] = [];

  for (const row of assignPdfChannels(printable)) {
    if (row.key.startsWith("spare_ch_")) {
      fillers.push({
        key: row.key,
        ch: row.ch,
        label: row.label,
        note: row.note ?? "",
        group: row.group,
        ownerRole: row.ownerRole,
        ownerMusicianId: "",
        slotKey: "",
        state: "filler",
      });
      continue;
    }
    numbered.set(row.key, row.ch);
  }

  const withNumbers = ordered.map((row) =>
    row.state === "active" ? { ...row, ch: numbered.get(row.key) ?? null } : row,
  );

  // Výplň patří na své číslo, tedy před řádek, který ho následuje.
  for (const filler of fillers) {
    const at = withNumbers.findIndex(
      (row) => row.ch !== null && row.ch > (filler.ch ?? 0),
    );
    withNumbers.splice(at === -1 ? withNumbers.length : at, 0, filler);
  }

  return withNumbers;
}
```

Ověř skutečnou hloubku relativních cest k `src/domain` — musí odpovídat umístění souboru.

- [ ] **Step 4: Spusť test a zkontroluj, že prochází**

Run: `npx vitest run packages/desktop/src/app/domain/inputs/buildInputEditorRows.test.ts`
Expected: PASS.

- [ ] **Step 5: Napiš `InputTable.tsx`**

Tabulka se třemi sloupci `no.` / `input` / `note` — **bez sloupce vlastníka** (R2). Řádek se stavem `removed` dostane class `inputRow--removed` a v prvním sloupci `——` místo čísla. Vybraný řádek `inputRow--selected`. Props: `rows`, `selectedKey`, `onSelect`.

Popisky anglicky. Typografie podle handoffu: hlavička mono, čísla mono.

- [ ] **Step 6: Zapoj tabulku do stránky a přidej render test**

Do `ProjectInputsPage.test.tsx` přidej test, který přes `renderToStaticMarkup` ověří, že vypnutý řádek nese `inputRow--removed` a nemá číslo.

- [ ] **Step 7: Ověř**

Run: `npx vitest run packages/desktop/src/app/domain/inputs packages/desktop/src/app/pages/ProjectInputsPage.test.tsx`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/desktop/src/app/domain/inputs packages/desktop/src/app/components/inputs/InputTable.tsx packages/desktop/src/app/pages/ProjectInputsPage.tsx packages/desktop/src/app/pages/ProjectInputsPage.test.tsx
git commit -m "feat(inputs): render the channel table with disabled rows in place"
```

---

## Task 12: Panel a editace názvu i poznámky (R2, R6)

**Files:**
- Create: `packages/desktop/src/app/components/inputs/InputRowInspector.tsx`
- Modify: `packages/desktop/src/app/pages/ProjectInputsPage.tsx`
- Test: `packages/desktop/src/app/domain/inputs/updateInputRow.test.ts` (nový, s modulem `updateInputRow.ts`)

**Interfaces:**
- Consumes: `InputEditorRow` z Tasku 11.
- Produces: `updateInputRow(patch: PresetOverridePatch | undefined, change: { key: string; label?: string; note?: string }): PresetOverridePatch` — čistá funkce, která píše do `inputs.update[]`. Task 18 ji používá při resetu.

- [ ] **Step 1: Napiš padající test**

```ts
import { describe, expect, it } from "vitest";
import { updateInputRow } from "./updateInputRow";

describe("updateInputRow", () => {
  it("creates the update list when the patch is empty", () => {
    const patch = updateInputRow(undefined, {
      key: "el_bass_di",
      label: "Matěj bass",
    });

    expect(patch.inputs?.update).toEqual([
      { key: "el_bass_di", label: "Matěj bass" },
    ]);
  });

  it("merges into an existing entry for the same key", () => {
    const first = updateInputRow(undefined, {
      key: "el_bass_di",
      label: "Matěj bass",
    });
    const second = updateInputRow(first, {
      key: "el_bass_di",
      note: "Vlastní DI",
    });

    expect(second.inputs?.update).toEqual([
      { key: "el_bass_di", label: "Matěj bass", note: "Vlastní DI" },
    ]);
  });

  it("keeps entries for other keys", () => {
    const first = updateInputRow(undefined, { key: "a", label: "A" });
    const second = updateInputRow(first, { key: "b", label: "B" });

    expect(second.inputs?.update).toHaveLength(2);
  });

  it("drops an entry that no longer changes anything", () => {
    const first = updateInputRow(undefined, { key: "a", label: "A" });
    const cleared = updateInputRow(first, { key: "a", label: undefined });

    expect(cleared.inputs?.update ?? []).toEqual([]);
  });

  it("preserves unrelated parts of the patch", () => {
    const patch = updateInputRow(
      { inputs: { remove: ["gone"] }, monitoring: { monitorRef: "m1" } },
      { key: "a", label: "A" },
    );

    expect(patch.inputs?.remove).toEqual(["gone"]);
    expect(patch.monitoring).toEqual({ monitorRef: "m1" });
  });

  it("does not mutate the incoming patch", () => {
    const original = { inputs: { update: [{ key: "a", label: "A" }] } };
    updateInputRow(original, { key: "a", label: "B" });

    expect(original.inputs.update).toEqual([{ key: "a", label: "A" }]);
  });
});
```

- [ ] **Step 2: Spusť test a zkontroluj, že padá**

Run: `npx vitest run packages/desktop/src/app/domain/inputs/updateInputRow.test.ts`
Expected: FAIL — modul neexistuje.

- [ ] **Step 3: Napiš `updateInputRow.ts`**

```ts
import type {
  PartialInputUpdate,
  PresetOverridePatch,
} from "../../../../../../src/domain/model/types";

/**
 * Co? Zapíše přejmenování nebo změnu poznámky jednoho kanálu do patche slotu.
 *
 * Proč tak málo kódu? Vrstva `inputs.update[]` v doméně existovala už před
 * touto fází a `applyPresetOverride` ji aplikuje — F5c dodává jen UI (R6).
 *
 * Vlastnost přítomná s hodnotou `undefined` znamená „zruš ji", vlastnost
 * chybějící znamená „nech ji být". Bez toho rozdílu by nešlo vrátit řádek
 * na původní znění, aniž by se smazala i poznámka.
 */
export function updateInputRow(
  patch: PresetOverridePatch | undefined,
  change: { key: string; label?: string; note?: string },
): PresetOverridePatch {
  const existing = patch?.inputs?.update ?? [];
  const current = existing.find((entry) => entry.key === change.key);

  const merged: PartialInputUpdate = { key: change.key };
  const label = "label" in change ? change.label : current?.label;
  const note = "note" in change ? change.note : current?.note;
  if (label !== undefined) merged.label = label;
  if (note !== undefined) merged.note = note;

  const changesSomething = Object.keys(merged).length > 1;
  const update = changesSomething
    ? current
      ? existing.map((entry) => (entry.key === change.key ? merged : entry))
      : [...existing, merged]
    : existing.filter((entry) => entry.key !== change.key);

  const inputs = { ...(patch?.inputs ?? {}) };
  if (update.length > 0) inputs.update = update;
  else delete inputs.update;

  const hasInputs = Object.keys(inputs).length > 0;
  return {
    ...patch,
    ...(hasInputs ? { inputs } : {}),
    ...(hasInputs ? {} : { inputs: undefined }),
  };
}
```

- [ ] **Step 4: Spusť test a zkontroluj, že prochází**

Run: `npx vitest run packages/desktop/src/app/domain/inputs/updateInputRow.test.ts`
Expected: PASS.

- [ ] **Step 5: Napiš `InputRowInspector.tsx`**

Panel vybraného řádku. Obsah shora:

1. `SELECTED CHANNEL` (mono, uppercase) → název řádku.
2. Textové pole `input` (label) a `note`.
3. Oddělovač, pak blok vlastníka: jméno muzikanta a role uppercase mono, počet kanálů, počet odchylek.
4. Akce vlastníka: `Edit kit` (jen pro `drums`, dodá Task 16), `Reset to default`, `Save as musician default`.

Popisky anglicky. Když není vybraný řádek, panel ukáže `NO CHANNEL SELECTED`.

- [ ] **Step 6: Zapoj panel a ověř**

Napoj `onSelect` z tabulky, změny polí veď přes `updateInputRow` do patche daného slotu. Přidej render test na `SELECTED CHANNEL` a na prázdný stav.

Run: `npx vitest run packages/desktop/src/app/domain/inputs packages/desktop/src/app/pages/ProjectInputsPage.test.tsx`
Expected: PASS.

Run: `npm run dev` — vyber řádek, přepiš název i poznámku, ulož, vyexportuj PDF a zkontroluj, že se změna propsala.

- [ ] **Step 7: Commit**

```bash
git add packages/desktop/src/app/domain/inputs packages/desktop/src/app/components/inputs/InputRowInspector.tsx packages/desktop/src/app/pages/ProjectInputsPage.tsx packages/desktop/src/app/pages/ProjectInputsPage.test.tsx
git commit -m "feat(inputs): edit channel label and note from the inspector"
```

---

## Task 13: Vypnutí, vrácení a přidání kanálu (R3, R4)

**Files:**
- Create: `packages/desktop/src/app/domain/inputs/toggleInputRow.ts`
- Create: `packages/desktop/src/app/domain/inputs/toggleInputRow.test.ts`
- Create: `packages/desktop/src/app/components/inputs/AddInputPicker.tsx`
- Modify: `packages/desktop/src/app/components/inputs/InputRowInspector.tsx`
- Modify: `packages/desktop/src/app/pages/ProjectInputsPage.tsx`

**Interfaces:**
- Consumes: `updateInputRow` z Tasku 12; `GROUP_INPUT_LIBRARY` a `buildInputsPatchFromTarget` ze `pages/shared/setupConstants`.
- Produces: `removeInputRow(patch, key)`, `restoreInputRow(patch, key)`, `addInputRow(patch, input)` — všechny čisté, všechny vracejí nový `PresetOverridePatch`.

- [ ] **Step 1: Napiš padající test**

```ts
import { describe, expect, it } from "vitest";
import {
  addInputRow,
  removeInputRow,
  restoreInputRow,
} from "./toggleInputRow";

describe("removeInputRow", () => {
  it("adds the key to the remove list", () => {
    expect(removeInputRow(undefined, "a").inputs?.remove).toEqual(["a"]);
  });

  it("does not add the same key twice", () => {
    const once = removeInputRow(undefined, "a");
    expect(removeInputRow(once, "a").inputs?.remove).toEqual(["a"]);
  });

  it("drops a channel that was added by the project instead of removing it", () => {
    const added = addInputRow(undefined, { key: "extra", label: "Extra" });
    const removed = removeInputRow(added, "extra");

    expect(removed.inputs?.add ?? []).toEqual([]);
    expect(removed.inputs?.remove ?? []).not.toContain("extra");
  });
});

describe("restoreInputRow", () => {
  it("takes the key back off the remove list", () => {
    const removed = removeInputRow(undefined, "a");
    expect(restoreInputRow(removed, "a").inputs?.remove ?? []).toEqual([]);
  });

  it("leaves other removed keys alone", () => {
    const removed = removeInputRow(removeInputRow(undefined, "a"), "b");
    expect(restoreInputRow(removed, "a").inputs?.remove).toEqual(["b"]);
  });
});

describe("addInputRow", () => {
  it("adds the channel to the add list", () => {
    const patch = addInputRow(undefined, { key: "extra", label: "Extra" });
    expect(patch.inputs?.add).toEqual([{ key: "extra", label: "Extra" }]);
  });

  it("refuses a duplicate key", () => {
    const once = addInputRow(undefined, { key: "extra", label: "Extra" });
    expect(addInputRow(once, { key: "extra", label: "Extra" }).inputs?.add)
      .toHaveLength(1);
  });

  it("keeps the rest of the patch", () => {
    const patch = addInputRow(
      { inputs: { remove: ["gone"] } },
      { key: "extra", label: "Extra" },
    );
    expect(patch.inputs?.remove).toEqual(["gone"]);
  });
});
```

- [ ] **Step 2: Spusť test a zkontroluj, že padá**

Run: `npx vitest run packages/desktop/src/app/domain/inputs/toggleInputRow.test.ts`
Expected: FAIL — modul neexistuje.

- [ ] **Step 3: Napiš `toggleInputRow.ts`**

```ts
import type {
  InputChannel,
  PresetOverridePatch,
} from "../../../../../../src/domain/model/types";

/** Prázdné seznamy se z patche vyhazují, aby uložený projekt nenesl šum. */
function withInputs(
  patch: PresetOverridePatch | undefined,
  next: { add?: InputChannel[]; remove?: string[] },
): PresetOverridePatch {
  const inputs = { ...(patch?.inputs ?? {}) };

  for (const field of ["add", "remove"] as const) {
    const value = next[field];
    if (value === undefined) continue;
    if (value.length > 0) inputs[field] = value as never;
    else delete inputs[field];
  }

  const hasInputs = Object.keys(inputs).length > 0;
  return {
    ...patch,
    ...(hasInputs ? { inputs } : {}),
    ...(hasInputs ? {} : { inputs: undefined }),
  };
}

/**
 * Vypnutí kanálu.
 *
 * Kanál, který do projektu přidal uživatel, se **maže ze `add`** a nedává se
 * do `remove`. `remove` je odchylka proti výchozím presetům muzikanta, a kanál,
 * který ve výchozích presetech nikdy nebyl, se odebráním jen vrací do
 * původního stavu — zapsat ho do `remove` by nechalo v projektu odchylku,
 * která nic nemění.
 */
export function removeInputRow(
  patch: PresetOverridePatch | undefined,
  key: string,
): PresetOverridePatch {
  const added = patch?.inputs?.add ?? [];
  if (added.some((input) => input.key === key)) {
    return withInputs(patch, {
      add: added.filter((input) => input.key !== key),
    });
  }

  const remove = patch?.inputs?.remove ?? [];
  if (remove.includes(key)) return patch ?? {};
  return withInputs(patch, { remove: [...remove, key] });
}

export function restoreInputRow(
  patch: PresetOverridePatch | undefined,
  key: string,
): PresetOverridePatch {
  return withInputs(patch, {
    remove: (patch?.inputs?.remove ?? []).filter((entry) => entry !== key),
  });
}

export function addInputRow(
  patch: PresetOverridePatch | undefined,
  input: InputChannel,
): PresetOverridePatch {
  const add = patch?.inputs?.add ?? [];
  if (add.some((entry) => entry.key === input.key)) return patch ?? {};
  return withInputs(patch, { add: [...add, input] });
}
```

- [ ] **Step 4: Spusť test a zkontroluj, že prochází**

Run: `npx vitest run packages/desktop/src/app/domain/inputs/toggleInputRow.test.ts`
Expected: PASS.

- [ ] **Step 5: Napiš `AddInputPicker.tsx`**

Dva kroky (R4). Krok 1 `Owner` — seznam obsazených slotů lineupu, jméno a role. Krok 2 `Channel` — kanály z `GROUP_INPUT_LIBRARY[role]`, které vybraný slot ještě nemá. Tlačítko `Back` z kroku 2 na krok 1, `Cancel` zavře.

Vlastník je povinný — bez něj nejde kanál umístit do boxu stage planu.

- [ ] **Step 6: Doplň akce do panelu a tabulky**

V panelu přidej `Remove channel` u aktivního řádku a `Restore channel` u vypnutého. Pod tabulku `+ Add input`, které otevře picker.

- [ ] **Step 7: Ověř**

Run: `npx vitest run packages/desktop/src/app/domain/inputs`
Expected: PASS.

Run: `npm run dev` — vypni kanál (zůstane šedý bez čísla, čísla pod ním se posunou), vrať ho, přidej nový přes picker a zkontroluj, že v PDF sedí u správného muzikanta.

- [ ] **Step 8: Commit**

```bash
git add packages/desktop/src/app/domain/inputs packages/desktop/src/app/components/inputs packages/desktop/src/app/pages/ProjectInputsPage.tsx
git commit -m "feat(inputs): toggle channels and add new ones from the catalog"
```

---

## Task 14: Ruční pořadí v tabulce (R8, R9)

**Files:**
- Create: `packages/desktop/src/app/domain/inputs/moveInputRow.ts`
- Create: `packages/desktop/src/app/domain/inputs/moveInputRow.test.ts`
- Modify: `packages/desktop/src/app/components/inputs/InputTable.tsx`
- Modify: `packages/desktop/src/app/pages/ProjectInputsPage.tsx`

**Interfaces:**
- Consumes: `InputEditorRow` z Tasku 11.
- Produces: `moveInputRow(keys: readonly string[], fromKey: string, toIndex: number): string[]` — nový seznam klíčů pro `project.inputOrder`.

- [ ] **Step 1: Napiš padající test**

```ts
import { describe, expect, it } from "vitest";
import { moveInputRow } from "./moveInputRow";

describe("moveInputRow", () => {
  it("moves a key down", () => {
    expect(moveInputRow(["a", "b", "c"], "a", 2)).toEqual(["b", "c", "a"]);
  });

  it("moves a key up", () => {
    expect(moveInputRow(["a", "b", "c"], "c", 0)).toEqual(["c", "a", "b"]);
  });

  it("returns the same order when the target is where the key already is", () => {
    expect(moveInputRow(["a", "b", "c"], "b", 1)).toEqual(["a", "b", "c"]);
  });

  it("clamps a target past the end", () => {
    expect(moveInputRow(["a", "b"], "a", 99)).toEqual(["b", "a"]);
  });

  it("clamps a negative target", () => {
    expect(moveInputRow(["a", "b"], "b", -5)).toEqual(["b", "a"]);
  });

  it("returns the input unchanged for an unknown key", () => {
    expect(moveInputRow(["a", "b"], "nonsense", 0)).toEqual(["a", "b"]);
  });

  it("does not mutate the incoming list", () => {
    const keys = ["a", "b", "c"];
    moveInputRow(keys, "a", 2);
    expect(keys).toEqual(["a", "b", "c"]);
  });
});
```

- [ ] **Step 2: Spusť test a zkontroluj, že padá**

Run: `npx vitest run packages/desktop/src/app/domain/inputs/moveInputRow.test.ts`
Expected: FAIL — modul neexistuje.

- [ ] **Step 3: Napiš `moveInputRow.ts`**

```ts
/**
 * Co? Přesune jeden klíč na nový index a vrátí nové pořadí pro
 * `project.inputOrder`.
 *
 * Stereo páry se tady **neřeší**. Adjacency hlídá doména v
 * `applyManualInputOrder` (R9), takže UI může uživatele nechat táhnout cokoli
 * a výsledek se srovná při sestavení dokumentu. Duplikovat to pravidlo tady
 * by znamenalo dvě místa, která se mohou rozejít.
 */
export function moveInputRow(
  keys: readonly string[],
  fromKey: string,
  toIndex: number,
): string[] {
  const from = keys.indexOf(fromKey);
  if (from === -1) return [...keys];

  const next = [...keys];
  next.splice(from, 1);

  const at = Math.min(Math.max(toIndex, 0), next.length);
  next.splice(at, 0, fromKey);
  return next;
}
```

- [ ] **Step 4: Spusť test a zkontroluj, že prochází**

Run: `npx vitest run packages/desktop/src/app/domain/inputs/moveInputRow.test.ts`
Expected: PASS.

- [ ] **Step 5: Přidej tažení do tabulky**

Použij HTML5 drag and drop (`draggable`, `onDragStart`, `onDragOver`, `onDrop`) — vzor je `packages/desktop/src/app/components/stageplan/useBlockDrag.ts`, ale tady stačí jednodušší varianta, protože se táhne po řádcích a ne po ploše.

Po dropu spočítej nové pořadí přes `moveInputRow` **nad všemi klíči v tabulce, včetně vypnutých**, a ulož do stavu jako `inputOrder`.

**Pozor na R8:** `inputOrder` se do stavu zapisuje jen po skutečném tažení. Když s pořadím nikdo nehýbal, pole musí zůstat `undefined`, aby si projekt nezabetonoval dnešní vypočtené pořadí.

- [ ] **Step 6: Ověř**

Run: `npx vitest run packages/desktop/src/app/domain/inputs`
Expected: PASS.

Run: `npm run dev` — přetáhni řádek, ulož, vyexportuj a zkontroluj čísla. Zkus protáhnout jiný kanál mezi stereo pár: doména ho musí vrátit vedle partnera.

- [ ] **Step 7: Commit**

```bash
git add packages/desktop/src/app/domain/inputs packages/desktop/src/app/components/inputs/InputTable.tsx packages/desktop/src/app/pages/ProjectInputsPage.tsx
git commit -m "feat(inputs): reorder channels by dragging table rows"
```

---

## Task 15: Tabulka monitorů (R7)

**Files:**
- Create: `packages/desktop/src/app/components/inputs/MonitorTable.tsx`
- Modify: `packages/desktop/src/app/pages/ProjectInputsPage.tsx`
- Move: `packages/desktop/src/components/setup/MonitoringEditor.tsx` → použít z panelu obrazovky `02`

**Interfaces:**
- Consumes: `useSetupOverrides` z Tasku 9; `MonitoringEditor` a `DEFAULT_MONITOR_MIX_LIMIT`; `validateEffectivePresets` a `summarizeEffectivePresetValidation`.
- Produces: sekce `MONITORS` na obrazovce a editace `presetOverride.monitoring` per slot.

- [ ] **Step 1: Přečti současné použití**

Přečti, jak `ProjectSetupPage.tsx` dnes renderuje `MonitoringEditor` uvnitř `SetupModalShell`, a jak se výsledek zapisuje do `presetOverride.monitoring`. Chování zachovej, jen ho přesuň.

- [ ] **Step 2: Napiš `MonitorTable.tsx`**

Tabulka `no.` / `monitor output` / `note`, tedy stejné sloupce, jaké tiskne `renderMonitorTable`. Řádek na muzikanta s monitorem. Klik na řádek vybere slot a panel vpravo přepne na monitoring toho slotu.

- [ ] **Step 3: Napoj `MonitoringEditor` do panelu**

Když je vybraný řádek monitoru, panel místo polí kanálu ukáže `MonitoringEditor` pro daný slot. Změny jdou do `presetOverride.monitoring`.

Zachovej validaci: `summarizeEffectivePresetValidation` nad všemi sloty, chyby a varování zobraz nad tabulkou.

- [ ] **Step 4: Přidej render test**

Do `ProjectInputsPage.test.tsx` přidej test, že sekce `MONITORS` obsahuje záhlaví `monitor output`.

- [ ] **Step 5: Ověř podmíněné poznámky**

Run: `npm run dev` — přepni muzikantovi monitor z IEM na wedge a sleduj **sekci NOTES na téže obrazovce**: podmíněné poznámky se musí přebrat okamžitě. To je celý důvod, proč monitoring patří sem (R7).

Run: `npm test`
Expected: proti baseline žádný nový pád.

- [ ] **Step 6: Commit**

```bash
git add packages/desktop/src/app/components/inputs/MonitorTable.tsx packages/desktop/src/app/pages/ProjectInputsPage.tsx packages/desktop/src/app/pages/ProjectInputsPage.test.tsx
git commit -m "feat(inputs): edit monitoring from the inputs screen"
```

---

## Task 16: Skladba bicí soupravy v panelu (R5)

**Files:**
- Modify: `packages/desktop/src/app/components/inputs/InputRowInspector.tsx`
- Modify: `packages/desktop/src/app/pages/ProjectInputsPage.tsx`

**Interfaces:**
- Consumes: `DrumsPartsEditor`, `resolveDrumsSetupDefinition`, `ModalOverlay` a `useModalBehavior`.
- Produces: modál `Edit kit` vyvolaný z panelu, zapisující `lineup.drums[i].drumDefinition`.

- [ ] **Step 1: Přečti současné použití**

Přečti, jak `ProjectSetupPage.tsx` dnes staví `drumSetup` přes `resolveDrumsSetupDefinition({ slotDrumDefinition, musicianPresetItems })` a jak `DrumsPartsEditor` ukládá zpět. Chování zachovej.

- [ ] **Step 2: Přidej akci do panelu**

Když vybraný řádek patří vlastníkovi s rolí `drums`, panel ukáže `Edit kit`. Otevře `ModalOverlay` s `DrumsPartsEditor`, zavření přes `useModalBehavior` jako všude jinde v aplikaci.

- [ ] **Step 3: Ověř**

Run: `npm run dev` — otevři `Edit kit`, přidej kotel, zavři. V tabulce musí přibýt kanál a čísla pod ním se posunout. Vyexportuj a zkontroluj v PDF.

Run: `npx tsc -p packages/desktop/tsconfig.json --noEmit`
Expected: proti baseline žádná nová chyba.

- [ ] **Step 4: Commit**

```bash
git add packages/desktop/src/app/components/inputs/InputRowInspector.tsx packages/desktop/src/app/pages/ProjectInputsPage.tsx
git commit -m "feat(inputs): edit the drum kit from the channel inspector"
```

---

## Task 17: Editor poznámek (R11, R12, R13)

**Files:**
- Create: `packages/desktop/src/app/domain/inputs/resolveNotesEditorModel.ts`
- Create: `packages/desktop/src/app/domain/inputs/resolveNotesEditorModel.test.ts`
- Create: `packages/desktop/src/app/components/inputs/NotesEditor.tsx`
- Modify: `packages/desktop/src/app/pages/ProjectInputsPage.tsx`

**Interfaces:**
- Consumes: `ProjectNotesOverride` z Tasku 1; `NotesTemplate` a `MonitorNoteContext`.
- Produces: `NotesEditorLine = { id: string; text: string; source: "template" | "custom"; enabled: boolean; edited: boolean; hidden: boolean; hiddenReason: string | null }` a `resolveNotesEditorModel(args)`. Task 18 model používá při resetu.

- [ ] **Step 1: Napiš padající test**

```ts
import { describe, expect, it } from "vitest";
import { resolveNotesEditorModel } from "./resolveNotesEditorModel";

const template = {
  id: "t",
  lang: "cs" as const,
  inputs: [{ id: "always", text: "Vždy" }],
  monitors: [
    { id: "plain", text: "Bez podmínky" },
    { id: "foh_iem", text: "FOH IEM", when: { monitors: { hasFohSuppliedIem: true } } },
  ],
};

const NOTHING = {
  hasWedge: false,
  hasBandSuppliedIem: false,
  hasFohSuppliedIem: false,
};

describe("resolveNotesEditorModel", () => {
  it("offers every template line, including ones a condition hides", () => {
    const model = resolveNotesEditorModel({
      template,
      monitors: NOTHING,
      overrides: undefined,
    });

    expect(model.monitors.map((line) => line.id)).toEqual([
      "plain",
      "foh_iem",
    ]);
  });

  it("marks a condition-hidden line with a reason (R13)", () => {
    const model = resolveNotesEditorModel({
      template,
      monitors: NOTHING,
      overrides: undefined,
    });
    const hidden = model.monitors.find((line) => line.id === "foh_iem");

    expect(hidden?.hidden).toBe(true);
    expect(hidden?.hiddenReason).toBe("Hidden: band has no FOH-supplied IEM");
  });

  it("stops marking the line as hidden once the condition holds", () => {
    const model = resolveNotesEditorModel({
      template,
      monitors: { ...NOTHING, hasFohSuppliedIem: true },
      overrides: undefined,
    });

    expect(model.monitors.find((line) => line.id === "foh_iem")?.hidden).toBe(
      false,
    );
  });

  it("reports a disabled line as not enabled but still listed", () => {
    const model = resolveNotesEditorModel({
      template,
      monitors: NOTHING,
      overrides: { disabled: ["always"] },
    });

    expect(model.inputs[0].enabled).toBe(false);
    expect(model.inputs).toHaveLength(1);
  });

  it("shows the overridden text and flags it as edited (R12)", () => {
    const model = resolveNotesEditorModel({
      template,
      monitors: NOTHING,
      overrides: { overrides: { always: "Jiné znění." } },
    });

    expect(model.inputs[0].text).toBe("Jiné znění.");
    expect(model.inputs[0].edited).toBe(true);
  });

  it("does not flag an untouched line as edited", () => {
    const model = resolveNotesEditorModel({
      template,
      monitors: NOTHING,
      overrides: undefined,
    });

    expect(model.inputs[0].edited).toBe(false);
  });

  it("lists custom lines last in their own section", () => {
    const model = resolveNotesEditorModel({
      template,
      monitors: NOTHING,
      overrides: {
        custom: [{ id: "custom_1", section: "inputs", text: "Naše." }],
      },
    });

    expect(model.inputs.map((line) => [line.id, line.source])).toEqual([
      ["always", "template"],
      ["custom_1", "custom"],
    ]);
  });
});
```

- [ ] **Step 2: Spusť test a zkontroluj, že padá**

Run: `npx vitest run packages/desktop/src/app/domain/inputs/resolveNotesEditorModel.test.ts`
Expected: FAIL — modul neexistuje.

- [ ] **Step 3: Napiš model editoru**

```ts
import type {
  NoteLine,
  NotesTemplate,
  ProjectNotesOverride,
} from "../../../../../../src/domain/model/types";
import type { MonitorNoteContext } from "../../../../../../src/domain/pipeline/pdf/buildPdfNotes";

export type NotesEditorLine = {
  readonly id: string;
  readonly text: string;
  readonly source: "template" | "custom";
  readonly enabled: boolean;
  readonly edited: boolean;
  readonly hidden: boolean;
  readonly hiddenReason: string | null;
};

/**
 * Pořadí je stejné, v jakém podmínky testuje `matchesCondition`, aby editor
 * hlásil tu podmínku, na které by řádek doopravdy padl.
 */
const HIDDEN_REASON: readonly [keyof MonitorNoteContext, string][] = [
  ["hasWedge", "Hidden: band uses no wedges"],
  ["hasBandSuppliedIem", "Hidden: band brings no IEM"],
  ["hasFohSuppliedIem", "Hidden: band has no FOH-supplied IEM"],
];

function hiddenReasonFor(
  note: NoteLine,
  monitors: MonitorNoteContext,
): string | null {
  const required = note.when?.monitors;
  if (!required) return null;

  for (const [flag, reason] of HIDDEN_REASON) {
    if (required[flag] === true && !monitors[flag]) return reason;
  }
  return null;
}

function resolveSection(
  lines: readonly NoteLine[],
  section: "inputs" | "monitors",
  monitors: MonitorNoteContext,
  overrides: ProjectNotesOverride | undefined,
): NotesEditorLine[] {
  const disabled = new Set(overrides?.disabled ?? []);
  const texts = overrides?.overrides ?? {};

  const fromTemplate = lines.map((note) => {
    const reason = hiddenReasonFor(note, monitors);
    const override = texts[note.id];

    return {
      id: note.id,
      text: typeof override === "string" ? override : note.text,
      source: "template" as const,
      enabled: !disabled.has(note.id),
      edited: typeof override === "string",
      hidden: reason !== null,
      hiddenReason: reason,
    };
  });

  const custom = (overrides?.custom ?? [])
    .filter((entry) => entry.section === section)
    .map((entry) => ({
      id: entry.id,
      text: entry.text,
      source: "custom" as const,
      enabled: !disabled.has(entry.id),
      edited: false,
      hidden: false,
      hiddenReason: null,
    }));

  return [...fromTemplate, ...custom];
}

/**
 * Co? Model editoru poznámek.
 *
 * Proč se liší od `buildPdfNotes`? Editor ukazuje **všechny** řádky šablony,
 * i ty, které podmínka skrývá, a u skrytých říká proč (R13). `buildPdfNotes`
 * je naopak zahodí — do dokumentu nepatří. Bez toho rozdílu by uživatel psal
 * text do řádku, který se nikdy nevytiskne, a nedozvěděl by se to.
 */
export function resolveNotesEditorModel(args: {
  template: NotesTemplate;
  monitors: MonitorNoteContext;
  overrides: ProjectNotesOverride | undefined;
}): { inputs: NotesEditorLine[]; monitors: NotesEditorLine[] } {
  const { template, monitors, overrides } = args;

  return {
    inputs: resolveSection(template.inputs ?? [], "inputs", monitors, overrides),
    monitors: resolveSection(
      template.monitors ?? [],
      "monitors",
      monitors,
      overrides,
    ),
  };
}
```

**Pozor:** `MonitorNoteContext` je dnes exportovaný typ z `buildPdfNotes.ts`. Kdyby import z `src/` do desktopu narazil na hranici vrstev, přesuň typ do `src/domain/model/types.ts` a v `buildPdfNotes.ts` ho jen re-exportuj — obojí je čistá doména, takže tím žádné pravidlo nepadne.

- [ ] **Step 4: Spusť test a zkontroluj, že prochází**

Run: `npx vitest run packages/desktop/src/app/domain/inputs/resolveNotesEditorModel.test.ts`
Expected: PASS.

- [ ] **Step 5: Napiš `NotesEditor.tsx`**

Dvě podsekce, `NOTES · INPUTS` a `NOTES · MONITORS`. Každý řádek: zaškrtávátko (`enabled`), text, u přepsaného štítek `edited` a tlačítko `Revert to template`. Řádek s `hidden` je šedý a nese `hiddenReason`. Pod každou sekcí `+ Add note`.

Text poznámky se edituje **česky** — je to obsah dokumentu. Popisky a štítky anglicky.

Nová vlastní poznámka dostane id `custom_<n>`, kde `n` je nejnižší volné číslo v projektu (R11) — smazání prostředního řádku tak nepřečísluje ostatní.

- [ ] **Step 6: Ověř**

Run: `npx vitest run packages/desktop/src/app/domain/inputs`
Expected: PASS.

Run: `npm run dev` — vypni poznámku, přepiš jinou, vrať ji na šablonu, přidej vlastní do každé sekce. Vyexportuj a zkontroluj pořadí v PDF: šablonové řádky, pak vlastní, sekce inputů před sekcí monitorů.

- [ ] **Step 7: Commit**

```bash
git add packages/desktop/src/app/domain/inputs packages/desktop/src/app/components/inputs/NotesEditor.tsx packages/desktop/src/app/pages/ProjectInputsPage.tsx
git commit -m "feat(inputs): edit notes as project deviations over the template"
```

---

## Task 18: Reset a protnutí toku (R15)

**Files:**
- Create: `packages/desktop/src/app/domain/inputs/resetInputsScreen.ts`
- Create: `packages/desktop/src/app/domain/inputs/resetInputsScreen.test.ts`
- Modify: `packages/desktop/src/app/pages/ProjectInputsPage.tsx`

**Interfaces:**
- Consumes: `NewProjectPayload` z Tasku 7.
- Produces: `resetInputsScreen(payload: NewProjectPayload): NewProjectPayload`.

- [ ] **Step 1: Napiš padající test**

```ts
import { describe, expect, it } from "vitest";
import { resetInputsScreen } from "./resetInputsScreen";

const payload = {
  id: "p1",
  purpose: "event" as const,
  bandRef: "b1",
  documentDate: "2026-08-22",
  createdAt: "2026-08-01T00:00:00.000Z",
  inputOrder: ["kick_in"],
  notes: { disabled: ["x"] },
  lineup: {
    drums: [
      {
        musicianId: "m1",
        presetOverride: {
          inputs: { remove: ["a"], update: [{ key: "b", label: "B" }] },
          monitoring: { monitorRef: "iem" },
        },
        drumDefinition: { toms: 3 },
      },
    ],
  },
};

describe("resetInputsScreen", () => {
  it("drops the manual input order", () => {
    expect(resetInputsScreen(payload as never).inputOrder).toBeUndefined();
  });

  it("drops notes deviations", () => {
    expect(resetInputsScreen(payload as never).notes).toBeUndefined();
  });

  it("drops slot preset overrides including monitoring", () => {
    const slot = resetInputsScreen(payload as never).lineup?.drums?.[0];

    expect(slot?.presetOverride).toBeUndefined();
  });

  it("drops the drum definition, because it is a deviation too", () => {
    const slot = resetInputsScreen(payload as never).lineup?.drums?.[0];

    expect(slot?.drumDefinition).toBeUndefined();
  });

  it("keeps the musician in the slot", () => {
    const slot = resetInputsScreen(payload as never).lineup?.drums?.[0];

    expect(slot?.musicianId).toBe("m1");
  });

  it("keeps everything outside the screen untouched", () => {
    const reset = resetInputsScreen({
      ...payload,
      eventVenue: "Zámek Bon Repos",
      stageplan: { layout: { blocks: [] } },
    } as never);

    expect(reset.eventVenue).toBe("Zámek Bon Repos");
    expect(reset.stageplan).toEqual({ layout: { blocks: [] } });
  });

  it("does not mutate the incoming payload", () => {
    const original = structuredClone(payload);
    resetInputsScreen(payload as never);

    expect(payload).toEqual(original);
  });
});
```

- [ ] **Step 2: Spusť test a zkontroluj, že padá**

Run: `npx vitest run packages/desktop/src/app/domain/inputs/resetInputsScreen.test.ts`
Expected: FAIL — modul neexistuje.

- [ ] **Step 3: Napiš `resetInputsScreen.ts`**

```ts
import type { NewProjectPayload } from "../../shell/types";

/**
 * Co? Zahodí všech pět vrstev, které obrazovka `02` edituje (R15).
 *
 * Pravidlo, které to drží pohromadě: reset maže vše, co je na projektu
 * **odchylkou od výchozího stavu muzikanta nebo kapely**. Proto do něj patří
 * i `drumDefinition` — `resolveDrumsSetupDefinition` ho staví nad
 * `musicianPresetItems`, takže je to odchylka jako každá jiná, jen uložená
 * vedle patche a ne v něm.
 *
 * Co reset nemaže: obsazení lineupu, stage plan a údaje o akci. Ty na téhle
 * obrazovce nevznikly.
 */
export function resetInputsScreen(
  payload: NewProjectPayload,
): NewProjectPayload {
  const lineup = payload.lineup
    ? Object.fromEntries(
        Object.entries(payload.lineup).map(([role, slots]) => [
          role,
          Array.isArray(slots)
            ? slots.map((slot) => ({ musicianId: slot?.musicianId ?? "" }))
            : slots,
        ]),
      )
    : undefined;

  const next = { ...payload };
  delete next.inputOrder;
  delete next.notes;

  return {
    ...next,
    ...(lineup ? { lineup: lineup as NewProjectPayload["lineup"] } : {}),
  };
}
```

**Pozor:** slot může nést i jiná pole než `musicianId`, `presetOverride` a `drumDefinition`. Než tohle napíšeš, zkontroluj `LineupSlot` v `src/domain/model/types.ts` a `LineupMap` v `packages/desktop/src/projectRules.ts`. Kdyby na slotu bylo něco, co obrazovka `02` needituje, **musí to reset zachovat** — přepiš pak mapování na výčet toho, co se maže, místo výčtu toho, co zůstává.

- [ ] **Step 4: Spusť test a zkontroluj, že prochází**

Run: `npx vitest run packages/desktop/src/app/domain/inputs/resetInputsScreen.test.ts`
Expected: PASS.

- [ ] **Step 5: Zapoj do hlavičky karty a doplň patičku**

Do hlavičky přidej čip `N INPUTS · M IEM` (mono, rámeček, jak popisuje handoff) a tlačítko `Reset to defaults`, které volá `resetInputsScreen` na aktuální stav. Reset je destruktivní, takže ho potvrď stejným `ModalOverlay` vzorem, jaký používá `showResetConfirmation` v `ProjectSetupPage`.

Patička: vlevo `Back`, vpravo `Save & Continue` / `Continue` podle `isInputsDirty`, cíl `/projects/${id}/stageplan`.

- [ ] **Step 6: Ověř**

Run: `npm run dev` — nasyp odchylky do všech pěti vrstev (pořadí, patch kanálu, monitoring, bicí, poznámky), pak `Reset to defaults`. Všech pět musí zmizet, lineup a stage plan zůstat.

- [ ] **Step 7: Commit**

```bash
git add packages/desktop/src/app/domain/inputs packages/desktop/src/app/pages/ProjectInputsPage.tsx
git commit -m "feat(inputs): reset every document deviation from the screen header"
```

---

## Task 19: Odebrání setup modálu z `ProjectSetupPage` (R16)

Teprve teď, když nová obrazovka umí všechno, se stará cesta zavře. Dřív by uživatel přišel o funkci.

**Files:**
- Modify: `packages/desktop/src/app/pages/ProjectSetupPage.tsx`

**Interfaces:**
- Consumes: hotová obrazovka `02` z Tasků 10 až 18.
- Produces: `ProjectSetupPage` bez setup modálu; `Continue` míří na `/projects/:id/inputs`.

- [ ] **Step 1: Přesměruj `Continue`**

Na řádku ~1798 změň cíl z `/projects/${id}/stageplan` na `/projects/${id}/inputs`. Tím se tok protne na `01 → 02 → 03 → 04` (R15).

- [ ] **Step 2: Ověř, že tok funguje, než začneš mazat**

Run: `npm run dev` — `Continue` z `01` musí vést na `02`.

- [ ] **Step 3: Odeber modál a jeho stav**

Smaž `ModalOverlay` s `editingSetup` (řádky ~1953-2384) a k němu patřící stav: `editingSetup`, `setupDraftBySlot`, `selectedSetupSlotKey`, `setupEditorRef`, `setupMusicians` a pomocníky, které nikdo jiný nepoužívá (`getExistingSlotOverride`, `resolveDraftOverride`, `resolveInputsForCapabilitySection`, `areSetupsEqual` a spol.).

Nech `effectiveSlotPresets` a `overrideValidation` — validaci lineupu krok `01` potřebuje dál. Nech i `updateMusicianDefaultsModal`, pokud ho volá něco mimo smazaný modál; když ne, smaž ho taky.

Karta muzikanta, která dnes modál otevírá, místo toho naviguje na `/projects/${id}/inputs`.

**Postupuj po malých krocích a po každém spusť `npx tsc -p packages/desktop/tsconfig.json --noEmit`.** Kompilátor je tady jediná pojistka — tahle stránka test nemá.

- [ ] **Step 4: Ověř, že nic nezůstalo osiřelé**

Run: `npx tsc -p packages/desktop/tsconfig.json --noEmit`
Expected: proti baseline žádná nová chyba.

Run: `npx biome check packages/desktop/src/app/pages/ProjectSetupPage.tsx`
Expected: kromě CRLF nic. Zejména žádný nepoužitý import ani proměnná.

Run: `npm test`
Expected: proti baseline žádný nový pád.

- [ ] **Step 5: Zaznamenej, o kolik stránka spadla**

Run: `npx wc -l packages/desktop/src/app/pages/ProjectSetupPage.tsx`

Číslo si zapiš — půjde do sekce „Stav implementace" ve specu.

- [ ] **Step 6: Ruční průchod kroku `01`**

Run: `npm run dev` — projdi celý krok `01`: přidej a odeber muzikanta, změň lead a back vokály, přepni vlastníka talkbacku, ulož. Nic z toho se v této fázi nemělo změnit.

- [ ] **Step 7: Commit**

```bash
git add packages/desktop/src/app/pages/ProjectSetupPage.tsx
git commit -m "refactor(setup): move channel editing out of the lineup page"
```

---

## Task 20: Smoke kontroly a závěrečná verifikace

**Files:**
- Modify: `docs/superpowers/specs/2026-08-17-inputs-screen-design.md` (sekce „Stav implementace")
- Modify: `docs/design/rebranding-roadmap.md`

- [ ] **Step 1: Spusť plnou sadu**

Run: `npm test`
Expected: proti baseline žádný nový pád (baseline `assetsPaths`, `repoAssets`).

Run: `npx tsc -p packages/desktop/tsconfig.json --noEmit`
Expected: proti baseline žádná nová chyba (baseline 10 ve 4 testových souborech).

Run: `npx biome check` na všech souborech dotčených fází.
Expected: kromě CRLF nic.

- [ ] **Step 2: Spusť tiskové smoke kontroly**

Run: `npm run smoke:stageplan-print`
Expected: PASS. Přeřazení a přejmenování mění text v boxech, takže tohle je ta kontrola, která zachytí přetečení boxu.

Kdyby některý projekt selhal na kolizní pojistce, **není to vada této fáze** — je to pojistka fungující podle návrhu a bloky je potřeba přerovnat v editoru. Zapiš který projekt a proč.

- [ ] **Step 3: Projdi ručně patnáct bodů verifikace ze specu**

Sekce „Verifikace" ve specu `docs/superpowers/specs/2026-08-17-inputs-screen-design.md` má patnáct bodů. Projdi je v `npm run dev` a u každého zapiš výsledek. Bod 15 (starý projekt bez nových polí) ověř na skutečném projektu z `%APPDATA%/StagePilot`, ne na fixtuře.

- [ ] **Step 4: Dopiš do specu sekci „Stav implementace"**

Podle precedentu F5b, F6 a F7: která rozhodnutí platí beze změny, která se za běhu odchýlila a proč, co zůstalo neověřené. Uveď i o kolik řádků spadl `ProjectSetupPage.tsx` (Task 19, Step 5).

- [ ] **Step 5: Aktualizuj roadmapu**

V `docs/design/rebranding-roadmap.md` přepiš stav F5c na hotovo, doplň rozsah commitů a v sekci F5c zapiš, co fáze skutečně přinesla a co zbývá na člověku.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-08-17-inputs-screen-design.md docs/design/rebranding-roadmap.md
git commit -m "docs(spec): close out the F5c spec with its implementation deviations"
```

---

## Závěrečná verifikace

Fáze je hotová, když:

1. `npm test` nemá proti baseline nový pád.
2. `npx tsc -p packages/desktop/tsconfig.json --noEmit` nemá proti baseline novou chybu.
3. `npm run smoke:stageplan-print` prochází, nebo je zapsáno, který projekt selhal na kolizní pojistce a proč to není vada fáze.
4. Patnáct bodů verifikace ze specu je projdeno a výsledek zapsán.
5. Spec má sekci „Stav implementace" a roadmapa ukazuje F5c jako hotovou.

**Co plán vědomě nedodává:** interakční testy. Vitest běží bez jsdom, takže tažení řádků, klikání a otevírání modálů se automaticky ověřit nedá. Proto je v každém UI tasku ruční krok a proto je logika v čistých modulech, kde ji test dosáhne.
