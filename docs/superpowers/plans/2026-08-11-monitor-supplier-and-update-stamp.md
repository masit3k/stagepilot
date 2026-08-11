# Razítko změny obsahu a dodavatel odposlechů — implementační plán

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hlavička PDF bude ukazovat datum poslední změny obsahu rideru a katalog odposlechů rozliší, zda vybavení dodává kapela nebo pořadatel.

**Architecture:** Čtyři nezávislé fáze. Fáze A rozděluje dnešní `updatedAt` na razítko obsahu (`contentUpdatedAt`, čte hlavička PDF) a razítko libovolné akce (`updatedAt`, řadí seznam projektů), a zavádí jediné hrdlo pro zápis projektu. Fáze B povyšuje `mode`/`wireless` z mrtvých polí JSONu na rozlišený svaz a přidává osu `supplier`. Fáze C napojuje dodavatele na poznámky pod tabulkou a řeší doplnění šablony u existujících instalací. Fáze D rozděluje výběr odposlechu v UI na dvě nezávislé osy.

**Tech Stack:** TypeScript (ESM, strict), React + Vite, Tauri/Rust, Vitest, Biome.

**Zdrojová specifikace:** [`docs/superpowers/specs/2026-08-11-monitor-presets-and-update-stamp-design.md`](../specs/2026-08-11-monitor-presets-and-update-stamp-design.md)

## Global Constraints

- **Commit zpráva musí být jednořádková** ve tvaru `type: description` nebo `type(scope): description`. Žádné tělo, žádná patička — commit hook víceřádkové zprávy odmítá.
- Testy: `npx vitest run <cesta>` pro jeden soubor, `npm test` pro celou sadu.
- Rust testy: `cd packages/desktop/src-tauri && cargo test`.
- Lint: `npm run lint` (Biome, **nikoli** ESLint/Prettier). Formátování `npm run format`.
- Importy uvnitř `src/` používají ESM příponu `.js` (`from "../model/types.js"`). Importy uvnitř `packages/desktop/src/` příponu **nepoužívají** (`from "../../../../../src/domain/model/types"`). Dodržet podle umístění souboru.
- `src/domain/` je čistá logika — žádné I/O, žádné side effecty, žádné `new Date()`. Čas se vždy předává parametrem.
- Žádné `any`. Rozlišené svazy místo volitelných polí. `readonly` u doménových vlastností tam, kde to okolní kód už dělá.
- UI testy běží přes `renderToStaticMarkup` z `react-dom/server` v Node prostředí **bez jsdom**. Interakci (klik, změna hodnoty) proto otestovat nelze — veškerá rozhodovací logika komponent musí být v čistých funkcích testovaných zvlášť.
- Po každém tasku spustit `npm test && npm run lint`.

---

## Fáze A — razítko změny obsahu

Nezávislá na fázích B–D. Po dokončení fáze A hlavička PDF ukazuje správné datum.

### Task 1: Pole `contentUpdatedAt` a razítkovací funkce

**Files:**
- Modify: `src/domain/model/types.ts:68` (rozhraní `Project`), `src/domain/model/types.ts:116` (rozhraní `ProjectJsonV2`)
- Modify: `packages/desktop/src/app/shell/types.ts:90` (typ `NewProjectPayload`), `packages/desktop/src/app/shell/types.ts:116-164` (funkce `toPersistableProject`)
- Create: `packages/desktop/src/app/domain/project/stampProjectUpdate.ts`
- Test: `packages/desktop/src/app/domain/project/stampProjectUpdate.test.ts`

**Interfaces:**
- Produces: `SaveIntent = "content" | "lifecycle" | "system"`, `stampProjectUpdate(payload: NewProjectPayload, intent: SaveIntent, nowIso: string): NewProjectPayload`

- [ ] **Step 1: Write the failing test**

Vytvoř `packages/desktop/src/app/domain/project/stampProjectUpdate.test.ts`:

```tsx
import { describe, expect, it } from "vitest";
import type { NewProjectPayload } from "../../shell/types";
import { stampProjectUpdate } from "./stampProjectUpdate";

const NOW = "2026-08-11T10:00:00.000Z";

const basePayload: NewProjectPayload = {
  id: "p-1",
  purpose: "event",
  bandRef: "band-1",
  documentDate: "2026-01-01",
  createdAt: "2026-01-01T08:00:00.000Z",
  updatedAt: "2026-02-01T08:00:00.000Z",
  contentUpdatedAt: "2026-02-01T08:00:00.000Z",
};

describe("stampProjectUpdate", () => {
  it("stamps both fields for a content change", () => {
    const result = stampProjectUpdate(basePayload, "content", NOW);
    expect(result.contentUpdatedAt).toBe(NOW);
    expect(result.updatedAt).toBe(NOW);
  });

  it("stamps only updatedAt for a lifecycle change", () => {
    const result = stampProjectUpdate(basePayload, "lifecycle", NOW);
    expect(result.contentUpdatedAt).toBe("2026-02-01T08:00:00.000Z");
    expect(result.updatedAt).toBe(NOW);
  });

  it("stamps nothing for a system write", () => {
    const result = stampProjectUpdate(basePayload, "system", NOW);
    expect(result.contentUpdatedAt).toBe("2026-02-01T08:00:00.000Z");
    expect(result.updatedAt).toBe("2026-02-01T08:00:00.000Z");
  });

  it("does not mutate the input payload", () => {
    stampProjectUpdate(basePayload, "content", NOW);
    expect(basePayload.updatedAt).toBe("2026-02-01T08:00:00.000Z");
  });

  it("stamps a payload that has no previous stamps", () => {
    const { updatedAt: _u, contentUpdatedAt: _c, ...withoutStamps } = basePayload;
    const result = stampProjectUpdate(withoutStamps, "content", NOW);
    expect(result.contentUpdatedAt).toBe(NOW);
    expect(result.updatedAt).toBe(NOW);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/desktop/src/app/domain/project/stampProjectUpdate.test.ts`
Expected: FAIL — modul `./stampProjectUpdate` neexistuje.

- [ ] **Step 3: Add the field to the domain types**

V `src/domain/model/types.ts` doplň do rozhraní `Project` hned za řádek `updatedAt?: string;` (řádek 68):

```ts
  /** Poslední změna obsahu rideru. Čte ji hlavička PDF. */
  contentUpdatedAt?: string;
```

Totéž doplň do rozhraní `ProjectJsonV2` za řádek 116.

- [ ] **Step 4: Add the field to the desktop payload type**

V `packages/desktop/src/app/shell/types.ts` doplň do typu `NewProjectPayload` za `updatedAt?: string;` (řádek 90):

```ts
  contentUpdatedAt?: string;
```

Ve funkci `toPersistableProject` přidej `contentUpdatedAt` do destrukturalizace (za `updatedAt` na řádku 129) a do návratového objektu za řádek `...(updatedAt ? { updatedAt } : {}),`:

```ts
    ...(contentUpdatedAt ? { contentUpdatedAt } : {}),
```

- [ ] **Step 5: Write the implementation**

Vytvoř `packages/desktop/src/app/domain/project/stampProjectUpdate.ts`:

```ts
import type { NewProjectPayload } from "../../shell/types";

/**
 * Co? Orazítkuje projekt časem podle záměru zápisu.
 * Proč? `contentUpdatedAt` jde do hlavičky PDF, `updatedAt` řadí seznam projektů.
 * Lifecycle akce (archivace, koš) nemají posouvat datum rideru.
 */
export type SaveIntent = "content" | "lifecycle" | "system";

export function stampProjectUpdate(
  payload: NewProjectPayload,
  intent: SaveIntent,
  nowIso: string,
): NewProjectPayload {
  if (intent === "system") return payload;
  if (intent === "lifecycle") return { ...payload, updatedAt: nowIso };
  return { ...payload, updatedAt: nowIso, contentUpdatedAt: nowIso };
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run packages/desktop/src/app/domain/project/stampProjectUpdate.test.ts`
Expected: PASS, 5 testů.

- [ ] **Step 7: Run the full suite and lint**

Run: `npm test && npm run lint`
Expected: PASS. Pokud `toPersistableProject` má vlastní test, který porovnává celý objekt, doplň v něm `contentUpdatedAt`.

- [ ] **Step 8: Commit**

```bash
git add src/domain/model/types.ts packages/desktop/src/app/shell/types.ts packages/desktop/src/app/domain/project/stampProjectUpdate.ts packages/desktop/src/app/domain/project/stampProjectUpdate.test.ts
git commit -m "feat: add contentUpdatedAt stamp with save intent"
```

---

### Task 2: Jediné hrdlo pro zápis projektu

**Files:**
- Modify: `packages/desktop/src/app/services/projectsApi.ts`
- Modify: `packages/desktop/src/app/pages/ProjectSetupPage.tsx:664-700`, `:1100-1106`
- Modify: `packages/desktop/src/app/services/projectMaintenance.ts:71-90`
- Modify: `packages/desktop/src/app/pages/hub/useProjectsHubData.ts:40-122`
- Modify: `packages/desktop/src/app/pages/NewEventProjectPage.tsx:137`, `packages/desktop/src/app/pages/NewGenericProjectPage.tsx:120`

**Interfaces:**
- Consumes: `stampProjectUpdate`, `SaveIntent` z Tasku 1
- Produces: `saveProjectPayload(args: { projectId: string; legacyProjectId?: string; payload: NewProjectPayload; intent: SaveIntent }): Promise<void>`

- [ ] **Step 1: Write the wrapper**

V `packages/desktop/src/app/services/projectsApi.ts` doplň importy a novou funkci. Stávající `saveProject` ponech beze změny — zůstává nízkoúrovňovým invoke:

```ts
import { toPersistableProject } from "../shell/types";
import { type SaveIntent, stampProjectUpdate } from "../domain/project/stampProjectUpdate";
import type { NewProjectPayload } from "../shell/types";

/**
 * Co? Jediná cesta, kterou se projekt zapisuje na disk.
 * Proč? Razítko se nesmí dát obejít ani zapomenout.
 */
export function saveProjectPayload(args: {
  projectId: string;
  legacyProjectId?: string;
  payload: NewProjectPayload;
  intent: SaveIntent;
}) {
  const stamped = stampProjectUpdate(args.payload, args.intent, new Date().toISOString());
  return saveProject({
    projectId: args.projectId,
    ...(args.legacyProjectId ? { legacyProjectId: args.legacyProjectId } : {}),
    json: JSON.stringify(toPersistableProject(stamped), null, 2),
  });
}
```

- [ ] **Step 2: Repoint ProjectSetupPage**

V `packages/desktop/src/app/pages/ProjectSetupPage.tsx`:

Ve funkci `persistProject` (řádek 1100) nahraď tělo:

```tsx
  async function persistProject(next?: Partial<NewProjectPayload>) {
    if (!canonicalProjectDraft) return;
    const payload: NewProjectPayload = { ...canonicalProjectDraft, ...next };
    await projectsApi.saveProjectPayload({
      projectId: id,
      payload,
      intent: "content",
    });
```

Zbytek funkce (od řádku 1107 dál) ponech.

V inicializaci lineupu (řádek 664) odstraň řádek `updatedAt: new Date().toISOString(),` z objektu `updatedProject` a nahraď volání:

```tsx
        await projectsApi.saveProjectPayload({
          projectId: id,
          payload: updatedProject,
          intent: "system",
        });
```

V migraci formátu lineupu (řádek 685) odstraň `updatedAt: new Date().toISOString(),` z objektu `migratedProject` a nahraď volání:

```tsx
          await projectsApi.saveProjectPayload({
            projectId: id,
            payload: migratedProject,
            intent: "system",
          });
```

- [ ] **Step 3: Repoint projectMaintenance**

V `packages/desktop/src/app/services/projectMaintenance.ts` odstraň z objektu `migrated` (řádek 80) řádek:

```ts
      updatedAt: needsMaintenance ? nowIso : project.updatedAt,
```

a nahraď zápis (řádky 84-88):

```ts
      await projectsApi.saveProjectPayload({
        projectId: nextId,
        legacyProjectId: legacyId,
        payload: migrated,
        intent: "system",
      });
```

Řádek 102 (`updatedAt: migrated.updatedAt ?? summary.updatedAt`) ponech — `migrated` už razítko nenese, takže se použije hodnota ze souhrnu.

- [ ] **Step 4: Repoint hub lifecycle operations**

V `packages/desktop/src/app/pages/hub/useProjectsHubData.ts` uvnitř `updateProjectLifecycle` (řádek 46) nahraď zápis:

```ts
      await projectsApi.saveProjectPayload({
        projectId,
        payload: updatedProject,
        intent: "lifecycle",
      });
```

Z objektů vracených v `archiveProject`, `unarchiveProject`, `moveProjectToTrash` a `restoreProject` odstraň řádky `updatedAt: now.toISOString(),`. Ostatní razítka (`archivedAt`, `trashedAt`, `purgeAt`) ponech — ta popisují lifecycle stav, ne čas zápisu.

- [ ] **Step 5: Set both stamps when creating a project**

V `packages/desktop/src/app/pages/NewEventProjectPage.tsx` (řádek 137) a `packages/desktop/src/app/pages/NewGenericProjectPage.tsx` (řádek 120) doplň vedle stávajícího `updatedAt: nowIso,`:

```tsx
        contentUpdatedAt: nowIso,
```

Volání `saveProject` na těchto stránkách ponech beze změny — zakládaný projekt už razítka nese a `intent` by je jen přepsal stejnou hodnotou.

- [ ] **Step 6: Verify no caller bypasses the funnel**

Run: `npx grep -rn "projectsApi.saveProject(" packages/desktop/src` — nebo použij editor. 
Expected: pouze zakládací stránky (`NewEventProjectPage`, `NewGenericProjectPage`). Jakýkoli jiný výskyt je chyba — přepoj ho na `saveProjectPayload` s odpovídajícím intentem podle pravidla: mění-li pole, které jde do PDF (lineup, přesety, `eventDate`, `eventVenue`, `documentDate`, `note`, `bandLeaderId`, `bandRef`, talkback), je to `content`; mění-li jen stav projektu v aplikaci, je to `lifecycle`; vynutila-li si zápis aplikace bez uživatelského zásahu, je to `system`.

- [ ] **Step 7: Run the suite and lint**

Run: `npm test && npm run lint`
Expected: PASS. Testy `projectMaintenance.test.ts` budou pravděpodobně potřebovat úpravu — mock `projectsApi` nyní dostává `saveProjectPayload` místo `saveProject`.

- [ ] **Step 8: Commit**

```bash
git add packages/desktop/src
git commit -m "refactor: route project writes through a single stamping funnel"
```

---

### Task 3: Čtení razítka v pipeline

**Files:**
- Modify: `src/domain/formatters/meta.ts:11-24`, `:32-45`
- Modify: `src/domain/pipeline/buildDocument.ts:59`, `:638`
- Modify: `src/app/usecases/normalizeProject.ts:206-210`, `:253`, `:271`, `:296`
- Test: `src/domain/formatters/meta.test.ts`, `src/app/usecases/pdfHeader.integration.test.ts`

**Interfaces:**
- Consumes: pole `contentUpdatedAt` z Tasku 1
- Produces: `formatProjectMetaLine` přijímá navíc `contentUpdatedAt?: string`

- [ ] **Step 1: Write the failing tests**

Do `src/domain/formatters/meta.test.ts` přidej:

```ts
  it("prefers contentUpdatedAt over updatedAt for the event template", () => {
    const line = formatProjectMetaLine({
      purpose: "event",
      eventDate: "2026-08-22",
      eventVenue: "Zámek Bon Repos",
      documentDate: "2026-01-01",
      updatedAt: "2026-07-30T09:45:00.000Z",
      contentUpdatedAt: "2026-07-15T09:45:00.000Z",
    });
    expect(line.value).toContain("datum aktualizace: 15. 7. 2026");
  });

  it("falls back to updatedAt when contentUpdatedAt is missing", () => {
    const line = formatProjectMetaLine({
      purpose: "event",
      eventDate: "2026-08-22",
      eventVenue: "Zámek Bon Repos",
      documentDate: "2026-01-01",
      updatedAt: "2026-07-30T09:45:00.000Z",
    });
    expect(line.value).toContain("datum aktualizace: 30. 7. 2026");
  });

  it("falls back to documentDate when both stamps are invalid", () => {
    const line = formatProjectMetaLine({
      purpose: "event",
      eventDate: "2026-08-22",
      eventVenue: "Zámek Bon Repos",
      documentDate: "2026-01-01",
      updatedAt: "RRRR-01-01",
      contentUpdatedAt: "RRRR-02-02",
    });
    expect(line.value).toContain("datum aktualizace: 1. 1. 2026");
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/domain/formatters/meta.test.ts`
Expected: FAIL — první test vrátí `30. 7. 2026`, protože `contentUpdatedAt` se ignoruje.

- [ ] **Step 3: Implement the fallback chain**

V `src/domain/formatters/meta.ts` nahraď `resolveUpdatedDateIso` a doplň parametr:

```ts
function toIsoDatePart(value?: string): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "";
  const isoDate = trimmed.includes("T") ? trimmed.slice(0, 10) : trimmed;
  return formatDocumentDate(isoDate) ? isoDate : "";
}

function resolveUpdatedDateIso(args: {
  contentUpdatedAt?: string;
  updatedAt?: string;
  documentDate: string;
}): string {
  return (
    toIsoDatePart(args.contentUpdatedAt) ||
    toIsoDatePart(args.updatedAt) ||
    args.documentDate
  );
}
```

V signatuře `formatProjectMetaLine` doplň `contentUpdatedAt?: string;` vedle `updatedAt?: string;` a předej ho do `resolveUpdatedDateIso`:

```ts
  const updatedDate = formatDocumentDate(
    resolveUpdatedDateIso({
      contentUpdatedAt: args.contentUpdatedAt,
      updatedAt: args.updatedAt,
      documentDate: args.documentDate,
    }),
  );
```

- [ ] **Step 4: Pass the field through the pipeline**

V `src/domain/pipeline/buildDocument.ts` doplň na řádcích 59 a 638 vedle `updatedAt: project.updatedAt,`:

```ts
      contentUpdatedAt: project.contentUpdatedAt,
```

V `src/app/usecases/normalizeProject.ts` doplň vedle stávajícího čtení `updatedAt` (řádky 206-210) obdobné čtení:

```ts
  const contentUpdatedAt =
    "contentUpdatedAt" in input &&
    typeof input.contentUpdatedAt === "string" &&
    input.contentUpdatedAt.trim().length > 0
      ? input.contentUpdatedAt.trim()
      : undefined;
```

a přidej `contentUpdatedAt,` do všech tří vracených objektů (u řádků 253, 271, 296), vedle stávajícího `updatedAt,`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/domain/formatters/meta.test.ts src/app/usecases/pdfHeader.integration.test.ts`
Expected: PASS.

- [ ] **Step 6: Add an integration test for the header**

Do `src/app/usecases/pdfHeader.integration.test.ts` přidej případ, kde projekt nese obě razítka s různými daty a hlavička musí vzít `contentUpdatedAt`. Použij existující `makeRepo` helper ze souboru a nastav v projektu:

```ts
      updatedAt: "2026-07-30T09:45:00.000Z",
      contentUpdatedAt: "2026-07-15T09:45:00.000Z",
```

Očekávaný řetězec v meta řádku: `datum aktualizace: 15. 7. 2026`.

- [ ] **Step 7: Run the suite and lint**

Run: `npm test && npm run lint`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/domain src/app
git commit -m "feat: read contentUpdatedAt in the pdf header"
```

---

## Fáze B — model monitor presetů

Fáze B musí být hotová před fázemi C a D, které na typu `Monitor` staví.

### Task 4: Rozlišený svaz `Monitor`, katalog deseti presetů a odstranění hádání druhu z názvu

Typ, katalog i oprava všech volajících patří do jednoho tasku: jakmile se `Monitor` stane rozlišeným svazem, přestanou se překládat volající, kteří druh odposlechu odvozují z `id`. Commit je proto až na konci, se zelenou sadou testů.

**Files:**
- Modify: `src/domain/model/types.ts:296-301`
- Modify: `src/domain/model/presetAliases.ts`
- Create: 10 souborů v `data/assets/presets/monitors/`
- Delete: `data/assets/presets/monitors/iem_mono_wired.json`, `iem_mono_wireless.json`, `iem_stereo_wired.json`, `iem_stereo_wireless.json`, `wedge.json`
- Modify: `src/domain/pipeline/buildDocument.ts:454-461`
- Modify: `src/domain/rules/presetOverride.ts:116-119`, `:193-201`, `:212-215`
- Modify: `packages/desktop/src/app/pages/ProjectSetupPage.tsx:1325`, `:2048`
- Test: `src/domain/model/presetAliases.test.ts` (nový), `src/domain/rules/presetOverride.test.ts`, `src/domain/pipeline/buildDocument.pdfRegression.test.ts`

**Interfaces:**
- Produces: `MonitorSupplier = "band" | "foh"`, `Monitor` jako rozlišený svaz podle `kind`, `validateEffectivePresets(effectivePresets, monitorsById)` a `summarizeEffectivePresetValidation(effectivePresets, monitorsById)`, kde `monitorsById: Record<string, Monitor>`

- [ ] **Step 1: Write the failing test**

Vytvoř `src/domain/model/presetAliases.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { resolvePresetIdAlias } from "./presetAliases.js";

describe("monitor preset aliases", () => {
  it("maps every legacy monitor id to its foh variant", () => {
    expect(resolvePresetIdAlias("iem_mono_wired")).toBe("iem_mono_wired_foh");
    expect(resolvePresetIdAlias("iem_mono_wireless")).toBe("iem_mono_wireless_foh");
    expect(resolvePresetIdAlias("iem_stereo_wired")).toBe("iem_stereo_wired_foh");
    expect(resolvePresetIdAlias("iem_stereo_wireless")).toBe("iem_stereo_wireless_foh");
    expect(resolvePresetIdAlias("wedge")).toBe("wedge_foh");
  });

  it("leaves new monitor ids untouched", () => {
    expect(resolvePresetIdAlias("iem_stereo_wired_own")).toBe("iem_stereo_wired_own");
    expect(resolvePresetIdAlias("wedge_own")).toBe("wedge_own");
  });

  it("keeps the pre-existing group preset aliases", () => {
    expect(resolvePresetIdAlias("el_bass_xlr")).toBe("el_bass_xlr_amp");
    expect(resolvePresetIdAlias("keys_jack")).toBe("keys_stereo_jack");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/model/presetAliases.test.ts`
Expected: FAIL — `resolvePresetIdAlias("wedge")` vrací `"wedge"`.

- [ ] **Step 3: Extend the alias map**

V `src/domain/model/presetAliases.ts` doplň do `PRESET_ID_ALIASES`:

```ts
  iem_mono_wired: "iem_mono_wired_foh",
  iem_mono_wireless: "iem_mono_wireless_foh",
  iem_stereo_wired: "iem_stereo_wired_foh",
  iem_stereo_wireless: "iem_stereo_wireless_foh",
  wedge: "wedge_foh",
```

- [ ] **Step 4: Redefine the Monitor type**

V `src/domain/model/types.ts` nahraď rozhraní `Monitor` (řádky 296-301):

```ts
/** Kdo odposlech na místě dodává. */
export type MonitorSupplier = "band" | "foh";

/** Monitor mix typ (zatím se nepromítá do FOH input listu). */
export type Monitor =
  | {
      type: "monitor";
      id: string;
      label: string;
      kind: "iem";
      supplier: MonitorSupplier;
      mode: "mono" | "stereo";
      wireless: boolean;
    }
  | {
      type: "monitor";
      id: string;
      label: string;
      kind: "wedge";
      supplier: MonitorSupplier;
    };
```

- [ ] **Step 5: Write the ten catalog files**

Smaž pět původních souborů v `data/assets/presets/monitors/` a vytvoř deset nových. Formát odpovídá stávajícím souborům (čtyřmezerové odsazení). Osm IEM souborů podle vzoru — `iem_mono_wired_foh.json`:

```json
{
    "type": "monitor",
    "id": "iem_mono_wired_foh",
    "label": "IEM MONO wired (provided by FOH)",
    "kind": "iem",
    "supplier": "foh",
    "mode": "mono",
    "wireless": false
}
```

Zbývajících sedm IEM souborů se liší jen hodnotami podle této tabulky (název souboru = `id` + `.json`):

| id | label | supplier | mode | wireless |
|---|---|---|---|---|
| `iem_mono_wired_own` | IEM MONO wired (own) | band | mono | false |
| `iem_mono_wireless_foh` | IEM MONO wireless (provided by FOH) | foh | mono | true |
| `iem_mono_wireless_own` | IEM MONO wireless (own) | band | mono | true |
| `iem_stereo_wired_foh` | IEM STEREO wired (provided by FOH) | foh | stereo | false |
| `iem_stereo_wired_own` | IEM STEREO wired (own) | band | stereo | false |
| `iem_stereo_wireless_foh` | IEM STEREO wireless (provided by FOH) | foh | stereo | true |
| `iem_stereo_wireless_own` | IEM STEREO wireless (own) | band | stereo | true |

Dva wedge soubory — `wedge_foh.json`:

```json
{
    "type": "monitor",
    "id": "wedge_foh",
    "label": "Wedge monitor (provided by FOH)",
    "kind": "wedge",
    "supplier": "foh"
}
```

a `wedge_own.json` s `"id": "wedge_own"`, `"label": "Wedge monitor (own)"`, `"supplier": "band"`.

- [ ] **Step 6: Run the alias test to verify it passes**

Run: `npx vitest run src/domain/model/presetAliases.test.ts`
Expected: PASS.

V tuto chvíli sada jako celek ještě neprojde — `presetOverride.test.ts` a `buildDocument.pdfRegression.test.ts` odkazují na stará ID a na `Monitor` bez `kind`. Opravují je následující kroky téhož tasku. Necommituj dřív, než bude `npm test` zelené.

- [ ] **Step 7: Write the failing validation test**

Do `src/domain/rules/presetOverride.test.ts` přidej nahoru vedle stávajícího `basePreset` katalog a testy. Stávající `monitorRef: "iem_stereo_wired"` v `basePreset` (řádek 19) změň na `"iem_stereo_wired_foh"` a `"wedge"` na `"wedge_foh"` ve všech testech souboru:

```ts
import type { Monitor } from "../model/types.js";

const MONITORS_BY_ID: Record<string, Monitor> = {
  iem_stereo_wired_foh: {
    type: "monitor",
    id: "iem_stereo_wired_foh",
    label: "IEM STEREO wired (provided by FOH)",
    kind: "iem",
    supplier: "foh",
    mode: "stereo",
    wireless: false,
  },
  iem_mono_wireless_own: {
    type: "monitor",
    id: "iem_mono_wireless_own",
    label: "IEM MONO wireless (own)",
    kind: "iem",
    supplier: "band",
    mode: "mono",
    wireless: true,
  },
  wedge_foh: {
    type: "monitor",
    id: "wedge_foh",
    label: "Wedge monitor (provided by FOH)",
    kind: "wedge",
    supplier: "foh",
  },
  wedge_own: {
    type: "monitor",
    id: "wedge_own",
    label: "Wedge monitor (own)",
    kind: "wedge",
    supplier: "band",
  },
};

describe("monitor mix counting", () => {
  it("counts no aux send for either wedge variant", () => {
    const slots = [
      { group: "guitar", preset: { inputs: [], monitoring: { monitorRef: "wedge_foh" } } },
      { group: "keys", preset: { inputs: [], monitoring: { monitorRef: "wedge_own" } } },
    ];
    expect(summarizeEffectivePresetValidation(slots, MONITORS_BY_ID).totals.monitorMixes).toBe(0);
  });

  it("counts one aux send per iem regardless of supplier", () => {
    const slots = [
      { group: "guitar", preset: { inputs: [], monitoring: { monitorRef: "iem_stereo_wired_foh" } } },
      { group: "keys", preset: { inputs: [], monitoring: { monitorRef: "iem_mono_wireless_own" } } },
    ];
    expect(summarizeEffectivePresetValidation(slots, MONITORS_BY_ID).totals.monitorMixes).toBe(2);
  });

  it("resolves legacy monitor ids through the alias map", () => {
    const slots = [{ group: "guitar", preset: { inputs: [], monitoring: { monitorRef: "wedge" } } }];
    expect(summarizeEffectivePresetValidation(slots, MONITORS_BY_ID).totals.monitorMixes).toBe(0);
  });

  it("counts an unknown monitor ref as one aux send", () => {
    const slots = [{ group: "guitar", preset: { inputs: [], monitoring: { monitorRef: "nonsense" } } }];
    expect(summarizeEffectivePresetValidation(slots, MONITORS_BY_ID).totals.monitorMixes).toBe(1);
  });
});
```

- [ ] **Step 8: Run the validation test to verify it fails**

Run: `npx vitest run src/domain/rules/presetOverride.test.ts`
Expected: FAIL — `summarizeEffectivePresetValidation` bere jeden argument.

- [ ] **Step 9: Change the validation signatures**

V `src/domain/rules/presetOverride.ts` doplň import a přepiš tři funkce:

```ts
import type { Monitor } from "../model/types.js";
import { resolvePresetIdAlias } from "../model/presetAliases.js";

function getRequiredMonitorMixCount(
  preset: MusicianSetupPreset,
  monitorsById: Record<string, Monitor>,
): number {
  const monitor = monitorsById[resolvePresetIdAlias(preset.monitoring.monitorRef)];
  return monitor?.kind === "wedge" ? 0 : 1;
}

export function validateEffectivePresets(
  effectivePresets: Array<{ group: string; preset: MusicianSetupPreset }>,
  monitorsById: Record<string, Monitor>,
): string[] {
  return summarizeEffectivePresetValidation(effectivePresets, monitorsById).errors;
}

export function summarizeEffectivePresetValidation(
  effectivePresets: Array<{ group: string; preset: MusicianSetupPreset }>,
  monitorsById: Record<string, Monitor>,
): EffectivePresetValidation {
```

a uvnitř `summarizeEffectivePresetValidation` uprav součet (řádky 212-215):

```ts
  const monitorMixTotal = effectivePresets.reduce(
    (sum, slot) => sum + getRequiredMonitorMixCount(slot.preset, monitorsById),
    0,
  );
```

Neznámý `monitorRef` se počítá jako jeden mix — bezpečnější odhad než nula, protože chybějící preset nesmí tiše snížit počet požadovaných aux sendů.

- [ ] **Step 10: Read the kind from the catalog in buildDocument**

V `src/domain/pipeline/buildDocument.ts` nahraď řádek 460:

```ts
        kind: monitorEntity.kind,
```

Ověř, že `monitorEntity` je v tomto místě typován jako `Monitor`. Pokud je typován jako `PresetEntity`, zužuj přes `monitorEntity.type === "monitor"` dřív, než se k `kind` přistoupí.

- [ ] **Step 11: Pass the catalog from the setup page**

V `packages/desktop/src/app/pages/ProjectSetupPage.tsx` vytvoř vedle `monitorOptions` (řádek 794) index a předej ho oběma volajícím:

```tsx
  const monitorsById = useMemo(
    () =>
      Object.fromEntries(
        Object.values(presetCatalog)
          .filter(
            (preset): preset is Extract<PresetEntity, { type: "monitor" }> =>
              preset.type === "monitor",
          )
          .map((preset) => [preset.id, preset]),
      ),
    [presetCatalog],
  );
```

Na řádku 1325 změň volání na `summarizeEffectivePresetValidation(<stávající argument>, monitorsById)` a na řádku 2048 na `validateEffectivePresets(<stávající argument>, monitorsById)`. Doplň `monitorsById` do pole závislostí obklopujícího `useMemo`/`useCallback`, pokud tam volání leží.

- [ ] **Step 12: Update the regression fixture**

V `src/domain/pipeline/buildDocument.pdfRegression.test.ts` přepiš stará monitor ID na nová (`"wedge"` → `"wedge_foh"`, `"iem_stereo_wireless"` → `"iem_stereo_wireless_foh"`) a v očekávaných labelech doplň příponu podle katalogu ze Stepu 5 — například na řádku 502 `"IEM STEREO wireless"` → `"IEM STEREO wireless (provided by FOH)"`. Testovací repozitář v tomto souboru musí monitor entity vracet i s poli `kind` a `supplier`.

Totéž zkontroluj v `src/infra/pdf/pdfRendererFixture.ts`, pokud definuje monitor presety.

- [ ] **Step 13: Run the suite and lint**

Run: `npm test && npm run lint`
Expected: PASS. Zbylá selhání znamenají nedohledaný odkaz na staré ID — oprav ho. Teprve teď je task hotový k commitu.

- [ ] **Step 14: Commit**

```bash
git add src packages/desktop/src data/assets/presets/monitors
git commit -m "feat: model monitor supplier and derive kind from the catalog"
```

---

## Fáze C — poznámky podle dodavatele

### Task 5: Vyhodnocení podmínek poznámek

**Files:**
- Modify: `src/domain/model/types.ts:312` (`NoteCondition`), `:416-420` (`DocumentViewModel.monitors`)
- Modify: `src/domain/pipeline/pdf/buildPdfNotes.ts`
- Modify: `src/domain/pipeline/buildDocument.ts:454-461`, `:619-623`
- Test: `src/domain/pipeline/pdf/buildPdfNotes.test.ts`

**Interfaces:**
- Consumes: `MonitorSupplier` z Tasku 4
- Produces: `MonitorNoteContext`, `buildPdfNotes(args: { template: NotesTemplate; monitors: MonitorNoteContext })`

- [ ] **Step 1: Write the failing test**

Vytvoř nebo rozšiř `src/domain/pipeline/pdf/buildPdfNotes.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { NotesTemplate } from "../../model/types.js";
import { buildPdfNotes } from "./buildPdfNotes.js";

const template: NotesTemplate = {
  id: "t",
  lang: "cs",
  inputs: [{ id: "always", text: "Vždy" }],
  monitors: [
    { id: "unconditional", text: "Bez podmínky" },
    { id: "wedge_only", text: "Wedge", when: { monitors: { hasWedge: true } } },
    { id: "band_iem", text: "Vlastní IEM", when: { monitors: { hasBandSuppliedIem: true } } },
    { id: "foh_iem", text: "FOH IEM", when: { monitors: { hasFohSuppliedIem: true } } },
  ],
};

const NOTHING = { hasWedge: false, hasBandSuppliedIem: false, hasFohSuppliedIem: false };
const ids = (notes: { id: string }[]) => notes.map((n) => n.id);

describe("buildPdfNotes", () => {
  it("always keeps notes without a condition", () => {
    expect(ids(buildPdfNotes({ template, monitors: NOTHING }).monitors)).toEqual(["unconditional"]);
  });

  it("keeps the band iem note only for band supplied iem", () => {
    const notes = buildPdfNotes({ template, monitors: { ...NOTHING, hasBandSuppliedIem: true } });
    expect(ids(notes.monitors)).toEqual(["unconditional", "band_iem"]);
  });

  it("keeps both iem notes for a mixed lineup", () => {
    const notes = buildPdfNotes({
      template,
      monitors: { hasWedge: false, hasBandSuppliedIem: true, hasFohSuppliedIem: true },
    });
    expect(ids(notes.monitors)).toEqual(["unconditional", "band_iem", "foh_iem"]);
  });

  it("keeps the wedge note only when a wedge is present", () => {
    const notes = buildPdfNotes({ template, monitors: { ...NOTHING, hasWedge: true } });
    expect(ids(notes.monitors)).toEqual(["unconditional", "wedge_only"]);
  });

  it("passes input notes through untouched", () => {
    expect(ids(buildPdfNotes({ template, monitors: NOTHING }).inputs)).toEqual(["always"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/pipeline/pdf/buildPdfNotes.test.ts`
Expected: FAIL — `buildPdfNotes` očekává `hasWedge: boolean`, ne objekt `monitors`.

- [ ] **Step 3: Widen the condition type**

V `src/domain/model/types.ts` nahraď řádek 312:

```ts
export type NoteCondition = {
  monitors: {
    hasWedge?: true;
    hasBandSuppliedIem?: true;
    hasFohSuppliedIem?: true;
  };
};
```

a doplň `supplier` do položek `DocumentViewModel.monitors` (řádky 416-420):

```ts
  monitors: Array<{
    id: string;
    label: string;
    kind: "iem" | "wedge";
    supplier: MonitorSupplier;
  }>;
```

- [ ] **Step 4: Rewrite the filter**

Nahraď obsah `src/domain/pipeline/pdf/buildPdfNotes.ts`:

```ts
import type {
  DocumentViewModel,
  NoteLine,
  NotesTemplate,
} from "../../model/types.js";

/**
 * Co? Stav odposlechů kapely, proti kterému se vyhodnocují podmínky poznámek.
 * Proč? Poznámka pod tabulkou musí odpovídat tomu, co kapela veze a co požaduje.
 */
export type MonitorNoteContext = {
  hasWedge: boolean;
  hasBandSuppliedIem: boolean;
  hasFohSuppliedIem: boolean;
};

function matchesCondition(note: NoteLine, monitors: MonitorNoteContext): boolean {
  if (!note.when) return true;
  const required = note.when.monitors;
  if (required.hasWedge === true && !monitors.hasWedge) return false;
  if (required.hasBandSuppliedIem === true && !monitors.hasBandSuppliedIem) return false;
  if (required.hasFohSuppliedIem === true && !monitors.hasFohSuppliedIem) return false;
  return true;
}

export function buildPdfNotes(args: {
  template: NotesTemplate;
  monitors: MonitorNoteContext;
}): DocumentViewModel["notes"] {
  const { template, monitors } = args;
  return {
    inputs: template.inputs ?? [],
    monitors: (template.monitors ?? []).filter((note) => matchesCondition(note, monitors)),
  };
}
```

Oproti původní podobě propouští poznámku bez `when` a vyhodnocuje konjunkci všech uvedených příznaků. Původní implementace končila větví `return false`, takže by novou podmínku tiše skryla.

- [ ] **Step 5: Build the context in buildDocument**

V `src/domain/pipeline/buildDocument.ts` doplň `supplier` do objektu vkládaného do `monitors` (kolem řádku 457):

```ts
      monitors.push({
        id: `${musician.id}:${monitorEntity.id}`,
        label: monitorEntity.label,
        kind: monitorEntity.kind,
        supplier: monitorEntity.supplier,
      });
```

a nahraď výpočet `hasWedge` (řádky 619-623):

```ts
  const notes = buildPdfNotes({
    template: repo.getNotesTemplate(notesTemplateId),
    monitors: {
      hasWedge: monitors.some((m) => m.kind === "wedge"),
      hasBandSuppliedIem: monitors.some((m) => m.kind === "iem" && m.supplier === "band"),
      hasFohSuppliedIem: monitors.some((m) => m.kind === "iem" && m.supplier === "foh"),
    },
  });
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/domain/pipeline/pdf/buildPdfNotes.test.ts`
Expected: PASS, 5 testů.

- [ ] **Step 7: Run the suite and lint**

Run: `npm test && npm run lint`
Expected: PASS. `buildDocument.pdfRegression.test.ts` může potřebovat doplnit `supplier` do očekávaných položek `monitors`.

- [ ] **Step 8: Commit**

```bash
git add src/domain
git commit -m "feat: evaluate monitor notes by supplier"
```

---

### Task 6: Verzování a doplnění šablony poznámek

**Files:**
- Modify: `src/infra/storage/defaultNotesTemplate.notes_default_cs.json`
- Modify: `src/domain/model/types.ts` (rozhraní `NotesTemplate` a `NoteLine`)
- Modify: `packages/desktop/src-tauri/src/storage_paths.rs:209-230`
- Test: `packages/desktop/src-tauri/src/storage_paths.rs` (modul `tests` na řádku 524)

**Interfaces:**
- Consumes: `NoteCondition` z Tasku 5
- Produces: šablona s poli `version` (na úrovni dokumentu) a `since` (na úrovni položky)

- [ ] **Step 1: Add version metadata to the template type**

V `src/domain/model/types.ts` doplň do rozhraní `NoteLine` pole:

```ts
  /** Verze šablony, ve které položka přibyla. Chybí-li, platí 0. */
  since?: number;
```

a do rozhraní `NotesTemplate`:

```ts
  /** Verze výchozí šablony, ze které soubor pochází. Chybí-li, platí 0. */
  version?: number;
```

- [ ] **Step 2: Update the default template**

V `src/infra/storage/defaultNotesTemplate.notes_default_cs.json` přidej `"version": 1` hned za `"lang": "cs",`, doplň `"since": 0` ke všem čtyřem stávajícím položkám a přidej dvě nové poznámky do pole `monitors`:

```json
    {
      "id": "band_supplied_iem",
      "since": 1,
      "text": "Členové kapely používající vlastní IEM požadují pouze monitorový send z pultu; sluchátka a vysílače/přijímače si zajišťuje kapela.",
      "when": { "monitors": { "hasBandSuppliedIem": true } }
    },
    {
      "id": "foh_supplied_iem",
      "since": 1,
      "text": "Pro členy kapely bez vlastního IEM požadujeme zajištění kompletní IEM sady ze strany pořadatele.",
      "when": { "monitors": { "hasFohSuppliedIem": true } }
    }
```

- [ ] **Step 3: Write the failing Rust test**

Do modulu `tests` v `packages/desktop/src-tauri/src/storage_paths.rs` přidej:

```rust
    #[test]
    fn merges_new_template_entries_without_touching_existing_text() {
        let root = temp_test_dir("notes-merge");
        let notes_dir = root.join("catalog/templates/notes");
        fs::create_dir_all(&notes_dir).unwrap();
        let target = notes_dir.join("notes_default_cs.json");

        // Instalace z doby před verzí 1, s ručně upraveným textem.
        fs::write(
            &target,
            br#"{"id":"notes_default_cs","lang":"cs","inputs":[{"id":"no_foh_engineer","text":"UPRAVENO"}],"monitors":[]}"#,
        )
        .unwrap();

        ensure_default_notes_template(&root).unwrap();

        let merged: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(&target).unwrap()).unwrap();
        let monitors = merged.get("monitors").unwrap().as_array().unwrap();
        let monitor_ids: Vec<&str> = monitors
            .iter()
            .filter_map(|m| m.get("id").and_then(|v| v.as_str()))
            .collect();

        assert!(monitor_ids.contains(&"band_supplied_iem"));
        assert!(monitor_ids.contains(&"foh_supplied_iem"));
        assert_eq!(merged.get("version").unwrap().as_i64().unwrap(), 1);

        let inputs = merged.get("inputs").unwrap().as_array().unwrap();
        let kept = inputs
            .iter()
            .find(|i| i.get("id").and_then(|v| v.as_str()) == Some("no_foh_engineer"))
            .unwrap();
        assert_eq!(kept.get("text").unwrap().as_str().unwrap(), "UPRAVENO");

        fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn does_not_restore_entries_the_user_deleted() {
        let root = temp_test_dir("notes-deleted");
        let notes_dir = root.join("catalog/templates/notes");
        fs::create_dir_all(&notes_dir).unwrap();
        let target = notes_dir.join("notes_default_cs.json");

        // Soubor už je na verzi 1, uživatel jednu novinku smazal.
        fs::write(
            &target,
            br#"{"id":"notes_default_cs","lang":"cs","version":1,"inputs":[],"monitors":[]}"#,
        )
        .unwrap();

        ensure_default_notes_template(&root).unwrap();

        let merged: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(&target).unwrap()).unwrap();
        assert!(merged.get("monitors").unwrap().as_array().unwrap().is_empty());

        fs::remove_dir_all(&root).ok();
    }
```

- [ ] **Step 4: Run the Rust tests to verify they fail**

Run: `cd packages/desktop/src-tauri && cargo test`
Expected: FAIL — `ensure_default_notes_template` existující soubor nechává beze změny, nové položky nedoplní.

- [ ] **Step 5: Implement the merge**

V `packages/desktop/src-tauri/src/storage_paths.rs` nahraď `ensure_default_notes_template` (řádek 209):

```rust
fn template_version(value: &serde_json::Value) -> i64 {
    value.get("version").and_then(|v| v.as_i64()).unwrap_or(0)
}

fn entry_since(entry: &serde_json::Value) -> i64 {
    entry.get("since").and_then(|v| v.as_i64()).unwrap_or(0)
}

/// Doplní do uživatelské šablony položky přidané ve vyšší verzi.
/// Existující položky se nikdy nepřepisují — ruční úpravy textů zůstávají.
fn merge_notes_section(
    current: &mut serde_json::Value,
    default: &serde_json::Value,
    section: &str,
    installed_version: i64,
) {
    let Some(default_entries) = default.get(section).and_then(|v| v.as_array()) else {
        return;
    };
    let existing_ids: Vec<String> = current
        .get(section)
        .and_then(|v| v.as_array())
        .map(|entries| {
            entries
                .iter()
                .filter_map(|e| e.get("id").and_then(|v| v.as_str()).map(String::from))
                .collect()
        })
        .unwrap_or_default();

    let additions: Vec<serde_json::Value> = default_entries
        .iter()
        .filter(|entry| entry_since(entry) > installed_version)
        .filter(|entry| {
            entry
                .get("id")
                .and_then(|v| v.as_str())
                .map(|id| !existing_ids.iter().any(|existing| existing == id))
                .unwrap_or(false)
        })
        .cloned()
        .collect();

    if additions.is_empty() {
        return;
    }
    let target = current
        .get_mut(section)
        .and_then(|v| v.as_array_mut())
        .expect("notes section must be an array");
    target.extend(additions);
}

fn ensure_default_notes_template(root: &Path) -> Result<(), StorageError> {
    let templates_dir = root.join("catalog/templates/notes");
    fs::create_dir_all(&templates_dir)?;

    let target = templates_dir.join(format!("{}.json", DEFAULT_NOTES_TEMPLATE_ID));
    let parsed: serde_json::Value =
        serde_json::from_str(DEFAULT_NOTES_TEMPLATE_JSON).map_err(|e| {
            StorageError::Resolve(format!("Invalid embedded default notes template JSON: {e}"))
        })?;

    let merged = if target.exists() {
        let existing_raw = fs::read_to_string(&target)?;
        let mut existing: serde_json::Value = serde_json::from_str(&existing_raw).map_err(|e| {
            StorageError::Resolve(format!("Invalid user notes template JSON: {e}"))
        })?;
        let installed = template_version(&existing);
        let latest = template_version(&parsed);
        if installed >= latest {
            return Ok(());
        }
        for section in ["inputs", "monitors"] {
            if existing.get(section).and_then(|v| v.as_array()).is_none() {
                existing[section] = serde_json::Value::Array(Vec::new());
            }
            merge_notes_section(&mut existing, &parsed, section, installed);
        }
        existing["version"] = serde_json::Value::from(latest);
        existing
    } else {
        parsed
    };

    let bytes = serde_json::to_vec_pretty(&merged).map_err(|e| {
        StorageError::Resolve(format!(
            "Failed to serialize default notes template: {e}"
        ))
    })?;
    fs::write(&target, bytes)?;
    Ok(())
}
```

Pokud stávající tělo funkce za řádkem 225 obsahuje další kroky (například zápis s koncovým novým řádkem), zachovej je — nahrazuje se rozhodovací logika, ne způsob zápisu.

- [ ] **Step 6: Run the Rust tests to verify they pass**

Run: `cd packages/desktop/src-tauri && cargo test`
Expected: PASS. Stávající test `seed_catalog_ensures_default_notes_template_idempotently` musí projít beze změny — soubor bez `version` má verzi 0, doplní se položky se `since: 1` a `version` se zvedne na 1; druhé spuštění už neudělá nic.

- [ ] **Step 7: Refresh your own APPDATA template**

Spusť aplikaci (`npm run tauri:dev`) nebo smaž `%APPDATA%/StagePilot/catalog/templates/notes/notes_default_cs.json` a nech ji vytvořit znovu. Ověř, že soubor obsahuje `band_supplied_iem` i `foh_supplied_iem` a že `version` je 1.

- [ ] **Step 8: Run the suite and lint**

Run: `npm test && npm run lint`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/infra/storage src/domain/model/types.ts packages/desktop/src-tauri/src/storage_paths.rs
git commit -m "feat: merge new notes template entries by version"
```

---

## Fáze D — výběr odposlechu ve dvou osách

### Task 7: Čistá logika dvou os

**Files:**
- Create: `packages/desktop/src/components/setup/monitorAxes.ts`
- Test: `packages/desktop/src/components/setup/monitorAxes.test.ts`

**Interfaces:**
- Consumes: `Monitor`, `MonitorSupplier` z Tasku 4
- Produces: `MonitorTypeOption`, `MonitorAxes`, `buildMonitorAxes(monitors: Monitor[]): MonitorAxes`, `resolveMonitorSelection(axes: MonitorAxes, monitorRef: string): { typeKey: string; supplier: MonitorSupplier } | undefined`, `resolveMonitorRef(axes: MonitorAxes, typeKey: string, supplier: MonitorSupplier): string | undefined`

- [ ] **Step 1: Write the failing test**

Vytvoř `packages/desktop/src/components/setup/monitorAxes.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Monitor } from "../../../../../src/domain/model/types";
import {
  buildMonitorAxes,
  resolveMonitorRef,
  resolveMonitorSelection,
} from "./monitorAxes";

const iem = (
  id: string,
  label: string,
  supplier: "band" | "foh",
  mode: "mono" | "stereo",
  wireless: boolean,
): Monitor => ({ type: "monitor", id, label, kind: "iem", supplier, mode, wireless });

const wedge = (id: string, label: string, supplier: "band" | "foh"): Monitor => ({
  type: "monitor",
  id,
  label,
  kind: "wedge",
  supplier,
});

const CATALOG: Monitor[] = [
  iem("iem_stereo_wired_foh", "IEM STEREO wired (provided by FOH)", "foh", "stereo", false),
  iem("iem_stereo_wired_own", "IEM STEREO wired (own)", "band", "stereo", false),
  iem("iem_mono_wireless_foh", "IEM MONO wireless (provided by FOH)", "foh", "mono", true),
  iem("iem_mono_wireless_own", "IEM MONO wireless (own)", "band", "mono", true),
  wedge("wedge_foh", "Wedge monitor (provided by FOH)", "foh"),
  wedge("wedge_own", "Wedge monitor (own)", "band"),
];

describe("buildMonitorAxes", () => {
  it("collapses supplier variants into one option per type", () => {
    const axes = buildMonitorAxes(CATALOG);
    expect(axes.types.map((t) => t.key)).toEqual([
      "iem:mono:wireless",
      "iem:stereo:wired",
      "wedge",
    ]);
  });

  it("strips the supplier suffix from type labels", () => {
    const axes = buildMonitorAxes(CATALOG);
    expect(axes.types.map((t) => t.label)).toEqual([
      "IEM MONO wireless",
      "IEM STEREO wired",
      "Wedge monitor",
    ]);
  });
});

describe("resolveMonitorSelection", () => {
  it("maps a monitor ref onto both axes", () => {
    const axes = buildMonitorAxes(CATALOG);
    expect(resolveMonitorSelection(axes, "iem_stereo_wired_own")).toEqual({
      typeKey: "iem:stereo:wired",
      supplier: "band",
    });
  });

  it("resolves a legacy monitor ref through the alias map", () => {
    const axes = buildMonitorAxes(CATALOG);
    expect(resolveMonitorSelection(axes, "wedge")).toEqual({
      typeKey: "wedge",
      supplier: "foh",
    });
  });

  it("returns undefined for an unknown ref", () => {
    const axes = buildMonitorAxes(CATALOG);
    expect(resolveMonitorSelection(axes, "nonsense")).toBeUndefined();
  });
});

describe("resolveMonitorRef", () => {
  it("keeps the supplier when the type changes", () => {
    const axes = buildMonitorAxes(CATALOG);
    expect(resolveMonitorRef(axes, "wedge", "band")).toBe("wedge_own");
  });

  it("keeps the type when the supplier changes", () => {
    const axes = buildMonitorAxes(CATALOG);
    expect(resolveMonitorRef(axes, "iem:stereo:wired", "foh")).toBe("iem_stereo_wired_foh");
  });

  it("falls back to the other supplier when the combination is missing", () => {
    const partial = buildMonitorAxes([
      iem("iem_stereo_wired_foh", "IEM STEREO wired (provided by FOH)", "foh", "stereo", false),
    ]);
    expect(resolveMonitorRef(partial, "iem:stereo:wired", "band")).toBe("iem_stereo_wired_foh");
  });

  it("returns undefined for an unknown type key", () => {
    const axes = buildMonitorAxes(CATALOG);
    expect(resolveMonitorRef(axes, "nonsense", "band")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/desktop/src/components/setup/monitorAxes.test.ts`
Expected: FAIL — modul `./monitorAxes` neexistuje.

- [ ] **Step 3: Write the implementation**

Vytvoř `packages/desktop/src/components/setup/monitorAxes.ts`:

```ts
import { resolvePresetIdAlias } from "../../../../../src/domain/model/presetAliases";
import type { Monitor, MonitorSupplier } from "../../../../../src/domain/model/types";

/**
 * Co? Projekce katalogu odposlechů na dvě nezávislé osy — typ a dodavatel.
 * Proč? Deset presetů v jednom seznamu se špatně čte; ID se přitom nikdy
 * neskládá spojováním řetězců, vždy se hledá existující preset.
 */
export type MonitorTypeOption = {
  key: string;
  label: string;
  bySupplier: Partial<Record<MonitorSupplier, string>>;
};

export type MonitorAxes = {
  types: MonitorTypeOption[];
  supplierByRef: Record<string, MonitorSupplier>;
  typeKeyByRef: Record<string, string>;
};

function typeKeyOf(monitor: Monitor): string {
  return monitor.kind === "wedge"
    ? "wedge"
    : `iem:${monitor.mode}:${monitor.wireless ? "wireless" : "wired"}`;
}

function typeLabelOf(monitor: Monitor): string {
  return monitor.label.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

export function buildMonitorAxes(monitors: Monitor[]): MonitorAxes {
  const byKey = new Map<string, MonitorTypeOption>();
  const supplierByRef: Record<string, MonitorSupplier> = {};
  const typeKeyByRef: Record<string, string> = {};

  for (const monitor of monitors) {
    const key = typeKeyOf(monitor);
    const option = byKey.get(key) ?? { key, label: typeLabelOf(monitor), bySupplier: {} };
    option.bySupplier[monitor.supplier] = monitor.id;
    byKey.set(key, option);
    supplierByRef[monitor.id] = monitor.supplier;
    typeKeyByRef[monitor.id] = key;
  }

  return {
    types: Array.from(byKey.values()).sort((a, b) => a.label.localeCompare(b.label)),
    supplierByRef,
    typeKeyByRef,
  };
}

export function resolveMonitorSelection(
  axes: MonitorAxes,
  monitorRef: string,
): { typeKey: string; supplier: MonitorSupplier } | undefined {
  const resolved = resolvePresetIdAlias(monitorRef);
  const typeKey = axes.typeKeyByRef[resolved];
  const supplier = axes.supplierByRef[resolved];
  if (!typeKey || !supplier) return undefined;
  return { typeKey, supplier };
}

/**
 * Najde preset odpovídající kombinaci obou os. Chybí-li požadovaný dodavatel,
 * vrátí druhou variantu téhož typu — uživatel nikdy neztratí zvolený typ.
 */
export function resolveMonitorRef(
  axes: MonitorAxes,
  typeKey: string,
  supplier: MonitorSupplier,
): string | undefined {
  const option = axes.types.find((candidate) => candidate.key === typeKey);
  if (!option) return undefined;
  const other: MonitorSupplier = supplier === "band" ? "foh" : "band";
  return option.bySupplier[supplier] ?? option.bySupplier[other];
}
```

Změna typu i změna dodavatele vedou na tutéž funkci — obě jen dosazují novou hodnotu do jedné osy a druhou nechávají beze změny.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/desktop/src/components/setup/monitorAxes.test.ts`
Expected: PASS, 10 testů.

- [ ] **Step 5: Run the suite and lint**

Run: `npm test && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/desktop/src/components/setup/monitorAxes.ts packages/desktop/src/components/setup/monitorAxes.test.ts
git commit -m "feat: project monitor catalog onto type and supplier axes"
```

---

### Task 8: Přepínač dodavatele v MonitoringEditor

**Files:**
- Modify: `packages/desktop/src/components/setup/MonitoringEditor.tsx`
- Modify: `packages/desktop/src/components/setup/MonitoringEditor.test.tsx`
- Modify: `packages/desktop/src/app/pages/ProjectSetupPage.tsx:794-804`, `:2234-2246`
- Modify: `packages/desktop/src/styles` — soubor s třídami `setup-*` (najdi podle `setup-toggle-grid`)

**Interfaces:**
- Consumes: `buildMonitorAxes`, `resolveMonitorSelection`, `resolveMonitorRef` z Tasku 7
- Produces: `MonitoringEditor` s propem `monitors: Monitor[]` místo `monitorOptions: MonitoringOption[]`

- [ ] **Step 1: Write the failing test**

Nahraď v `packages/desktop/src/components/setup/MonitoringEditor.test.tsx` konstanty a testy vázané na `monitorOptions`. Nový základ souboru:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Monitor } from "../../../../../src/domain/model/types";
import type { SetupDiffMeta } from "../../../../../src/domain/setup/computeSetupDiff";
import {
  MAX_ADDITIONAL_WEDGE_COUNT,
  MIN_ADDITIONAL_WEDGE_COUNT,
  MonitoringEditor,
  clampAdditionalWedgeCount,
  isAdditionalWedgeEnabled,
  isMonitoringFieldModified,
} from "./MonitoringEditor";

const MONITORS: Monitor[] = [
  {
    type: "monitor",
    id: "iem_stereo_wired_foh",
    label: "IEM STEREO wired (provided by FOH)",
    kind: "iem",
    supplier: "foh",
    mode: "stereo",
    wireless: false,
  },
  {
    type: "monitor",
    id: "iem_stereo_wired_own",
    label: "IEM STEREO wired (own)",
    kind: "iem",
    supplier: "band",
    mode: "stereo",
    wireless: false,
  },
  { type: "monitor", id: "wedge_foh", label: "Wedge monitor (provided by FOH)", kind: "wedge", supplier: "foh" },
  { type: "monitor", id: "wedge_own", label: "Wedge monitor (own)", kind: "wedge", supplier: "band" },
];

const baseMonitoring = { monitorRef: "wedge_foh" };

const baseDiffMeta: SetupDiffMeta = {
  inputs: [],
  monitoring: {
    monitorRef: { origin: "default", changeType: "unchanged" },
    additionalWedgeCount: { origin: "default", changeType: "unchanged" },
  },
};

describe("MonitoringEditor", () => {
  it("renders one dropdown entry per monitor type, without supplier suffixes", () => {
    const html = renderToStaticMarkup(
      <MonitoringEditor
        monitors={MONITORS}
        effectiveMonitoring={baseMonitoring}
        diffMeta={baseDiffMeta}
        onChangePatch={() => {}}
      />,
    );

    expect(html).toContain('value="iem:stereo:wired"');
    expect(html).toContain(">IEM STEREO wired<");
    expect(html).toContain('value="wedge"');
    expect(html).not.toContain("(provided by FOH)");
  });

  it("renders the supplier switch with the effective supplier selected", () => {
    const html = renderToStaticMarkup(
      <MonitoringEditor
        monitors={MONITORS}
        effectiveMonitoring={{ monitorRef: "iem_stereo_wired_own" }}
        diffMeta={baseDiffMeta}
        onChangePatch={() => {}}
      />,
    );

    expect(html).toContain('aria-label="Dodavatel odposlechu"');
    expect(html).toContain("Vlastní");
    expect(html).toContain("Pořadatel");
    expect(html).toContain('aria-pressed="true"');
  });

  it("resolves a legacy monitor ref instead of showing an empty selection", () => {
    const html = renderToStaticMarkup(
      <MonitoringEditor
        monitors={MONITORS}
        effectiveMonitoring={{ monitorRef: "wedge" }}
        diffMeta={baseDiffMeta}
        onChangePatch={() => {}}
      />,
    );

    expect(html).toContain('value="wedge" selected=""');
    expect(html).not.toContain("No monitor selected");
  });

  it("shows an empty selection when the ref is unknown", () => {
    const html = renderToStaticMarkup(
      <MonitoringEditor
        monitors={MONITORS}
        effectiveMonitoring={{ monitorRef: "missing_monitor" }}
        diffMeta={baseDiffMeta}
        onChangePatch={() => {}}
      />,
    );

    expect(html).toContain("No monitor selected");
  });

  it("keeps the additional wedge toggle and stepper", () => {
    const html = renderToStaticMarkup(
      <MonitoringEditor
        monitors={MONITORS}
        effectiveMonitoring={{ ...baseMonitoring, additionalWedgeCount: 2 }}
        diffMeta={baseDiffMeta}
        onChangePatch={() => {}}
      />,
    );

    expect(html).toContain(
      '<span class="setup-toggle-row__text">Additional wedge monitor</span>',
    );
    expect(html).toContain("setup-stepper__btn");
    expect(html).toContain('aria-label="Decrease Additional wedges"');
  });

  it("adds the shared modified field class when the monitor origin is override", () => {
    const html = renderToStaticMarkup(
      <MonitoringEditor
        monitors={MONITORS}
        effectiveMonitoring={baseMonitoring}
        diffMeta={{
          ...baseDiffMeta,
          monitoring: {
            ...baseDiffMeta.monitoring,
            monitorRef: { origin: "override", changeType: "added" },
          },
        }}
        onChangePatch={() => {}}
      />,
    );

    expect(html).toContain("setup-field-block setup-field-block--modified");
  });
});

describe("monitoring helper rules", () => {
  it("normalizes additional wedge enabled state", () => {
    expect(isAdditionalWedgeEnabled(undefined)).toBe(false);
    expect(isAdditionalWedgeEnabled(0)).toBe(false);
    expect(isAdditionalWedgeEnabled(1)).toBe(true);
  });

  it("clamps additional wedge count to configured limits", () => {
    expect(clampAdditionalWedgeCount(0)).toBe(MIN_ADDITIONAL_WEDGE_COUNT);
    expect(clampAdditionalWedgeCount(3)).toBe(3);
    expect(clampAdditionalWedgeCount(8)).toBe(MAX_ADDITIONAL_WEDGE_COUNT);
  });

  it("uses override origin as the canonical field-modified signal", () => {
    expect(isMonitoringFieldModified("default")).toBe(false);
    expect(isMonitoringFieldModified("override")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/desktop/src/components/setup/MonitoringEditor.test.tsx`
Expected: FAIL — komponenta nezná prop `monitors`.

- [ ] **Step 3: Rewrite the component**

V `packages/desktop/src/components/setup/MonitoringEditor.tsx` nahraď typ propů a část s výběrem monitoru. Helpery `clampAdditionalWedgeCount`, `isAdditionalWedgeEnabled`, `isMonitoringFieldModified` a celý blok s doplňkovým wedgem ponech beze změny.

Nové importy:

```tsx
import type { Monitor, MonitorSupplier } from "../../../../../src/domain/model/types";
import {
  buildMonitorAxes,
  resolveMonitorRef,
  resolveMonitorSelection,
} from "./monitorAxes";
```

Nový typ propů (nahrazuje `MonitoringOption` a `monitorOptions`):

```tsx
type MonitoringEditorProps = {
  monitors: Monitor[];
  effectiveMonitoring: MusicianSetupPreset["monitoring"];
  patch?: PresetOverridePatch;
  diffMeta: SetupDiffMeta;
  onChangePatch: (next: PresetOverridePatch) => void;
};
```

Uvnitř komponenty nahraď výpočet `normalizedMonitorRef` (řádky 48-53):

```tsx
  const axes = buildMonitorAxes(monitors);
  const currentMonitorRef =
    patch?.monitoring?.monitorRef ?? effectiveMonitoring.monitorRef ?? "";
  const selection = resolveMonitorSelection(axes, currentMonitorRef);

  const commitMonitorRef = (nextRef: string | undefined) => {
    onChangePatch({
      ...patch,
      monitoring: { ...patch?.monitoring, monitorRef: nextRef ?? "" },
    });
  };
```

a nahraď blok `<label>` s `<select>` (řádky 85-111):

```tsx
      <label
        className={`setup-field-block ${monitorModified ? "setup-field-block--modified" : ""}`}
      >
        <div className="setup-field-row">
          <select
            className="setup-field-control"
            aria-label="Monitoring"
            value={selection?.typeKey ?? ""}
            onChange={(e) =>
              commitMonitorRef(
                resolveMonitorRef(axes, e.target.value, selection?.supplier ?? "foh"),
              )
            }
          >
            {axes.types.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
            <option value="">No monitor selected</option>
          </select>
        </div>
      </label>

      <div className="setup-field-row setup-supplier-switch" role="group" aria-label="Dodavatel odposlechu">
        {(["band", "foh"] as MonitorSupplier[]).map((supplier) => (
          <button
            key={supplier}
            type="button"
            className={`setup-supplier-switch__option ${
              selection?.supplier === supplier ? "setup-supplier-switch__option--active" : ""
            }`}
            aria-pressed={selection?.supplier === supplier}
            disabled={!selection}
            onClick={() =>
              commitMonitorRef(resolveMonitorRef(axes, selection?.typeKey ?? "", supplier))
            }
          >
            {supplier === "band" ? "Vlastní" : "Pořadatel"}
          </button>
        ))}
      </div>
```

- [ ] **Step 4: Add the switch styles**

Najdi soubor se stylem `setup-toggle-grid` (`npx grep -rn "setup-toggle-grid" packages/desktop/src --include=*.css`) a doplň do něj:

```css
.setup-supplier-switch {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
}

.setup-supplier-switch__option {
  border: 1px solid var(--setup-field-border, #c9ccd2);
  background: transparent;
  padding: 0.4rem 0.75rem;
  cursor: pointer;
  font: inherit;
}

.setup-supplier-switch__option:first-child {
  border-radius: 4px 0 0 4px;
}

.setup-supplier-switch__option:last-child {
  border-radius: 0 4px 4px 0;
  border-left-width: 0;
}

.setup-supplier-switch__option--active {
  background: var(--setup-accent-soft, #e8ecf5);
  font-weight: 600;
}

.setup-supplier-switch__option:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

Použité proměnné (`--setup-field-border`, `--setup-accent-soft`) nahraď těmi, které soubor už definuje — hodnoty za `,` jsou jen záložní.

- [ ] **Step 5: Repoint the setup page**

V `packages/desktop/src/app/pages/ProjectSetupPage.tsx` nahraď `monitorOptions` (řádky 794-804) seznamem entit. Pokud jsi v Tasku 4 přidal `monitorsById`, odvoď obojí z jednoho filtru:

```tsx
  const monitorEntities = useMemo(
    () =>
      Object.values(presetCatalog).filter(
        (preset): preset is Extract<PresetEntity, { type: "monitor" }> =>
          preset.type === "monitor",
      ),
    [presetCatalog],
  );
  const monitorsById = useMemo(
    () => Object.fromEntries(monitorEntities.map((preset) => [preset.id, preset])),
    [monitorEntities],
  );
```

Na řádku 2235 nahraď `monitorOptions={monitorOptions}` za `monitors={monitorEntities}`. Zkontroluj, zda `monitorOptions` nepoužívá ještě jiné místo v souboru; pokud ano, přepoj ho také.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run packages/desktop/src/components/setup/MonitoringEditor.test.tsx`
Expected: PASS.

- [ ] **Step 7: Run the suite and lint**

Run: `npm test && npm run lint`
Expected: PASS.

- [ ] **Step 8: Verify in the running app**

Run: `npm run tauri:dev`
Ověř na projektu: dropdown má pět položek bez závorek, přepínač ukazuje dodavatele, změna typu drží dodavatele, změna dodavatele drží typ. Otevři projekt uložený před touto změnou a ověř, že se odposlech zobrazí správně a ne jako „No monitor selected".

- [ ] **Step 9: Commit**

```bash
git add packages/desktop/src
git commit -m "feat: split monitor selection into type and supplier axes"
```

---

## Závěrečné ověření

- [ ] **Step 1: Full suite**

Run: `npm test && npm run lint && cd packages/desktop/src-tauri && cargo test`
Expected: PASS.

- [ ] **Step 2: PDF smoke test**

Run: `npm run smoke:pdf-preview`
Expected: PASS. Renderer při přetečení A4 vyhazuje výjimku — dvě nové poznámky prodlužují obsah pod tabulkou odposlechů, takže tento krok je hlavní pojistkou proti přetečení.

- [ ] **Step 3: Mixed lineup check**

Nastav v aplikaci kapelu, kde má jeden člen vlastní IEM a druhý IEM od pořadatele, a vyexportuj PDF. Ověř, že hlavička ukazuje dnešní datum, tabulka odposlechů rozlišuje dodavatele a pod tabulkou jsou obě nové poznámky.

- [ ] **Step 4: Update the architecture docs**

Do `docs/architecture/project-model.md` doplň pole `contentUpdatedAt` k popisu projektu a zmínku o rozdílu proti `updatedAt`.

- [ ] **Step 5: Commit**

```bash
git add docs/architecture/project-model.md
git commit -m "docs: document the contentUpdatedAt field"
```
