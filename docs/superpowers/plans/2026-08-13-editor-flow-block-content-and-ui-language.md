# F6 — tok, obsah bloků, úchyty a jazyk rozhraní: implementační plán

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Editor je přirozený krok po lineupu, kreslí kartu bloku v rozměru tištěného boxu s plným tiskovým výpisem, umí měnit velikost zóny úchyty s minimem 0,8 m; tisk nikoho nezvýhodňuje barvou a kapelníka označuje hvězdičkou s českou vysvětlivkou; rozhraní mluví anglicky.

**Architecture:** Doména dostane jednu novou operaci (`resizeBlockTo`) a jedno nové pole na tiskovém boxu (`hasBandLeaderMark`). Tiskový model se přestane po IPC redukovat na dvě čísla a poteče do editoru celý, takže editor i renderer počítají řádky **stejnou** doménovou funkcí. Editor pak kartu kreslí v rozměru, který vrací `computePrintFootprintMm` — tedy v rozměru tištěného boxu — a zóna se v ní kreslí jako obrys, který nesou úchyty.

**Tech Stack:** TypeScript ESM, React + Vite, Tauri (Rust), Vitest (node, bez jsdom), Biome, tsx pro skripty.

**Spec:** [2026-08-13-editor-flow-block-content-and-ui-language-design.md](../specs/2026-08-13-editor-flow-block-content-and-ui-language-design.md) — rozhodnutí `R1`–`R15`.

## Global Constraints

- **Vrstvy:** `src/domain/` bez I/O a **bez PDF konstant**; `src/infra/` veškeré I/O; `packages/desktop/` jen UI a **nesmí importovat z `src/infra`** ani typy odtud. Z `src/domain` importovat smí.
- **Jazyk:** rozhraní aplikace **anglicky**, PDF **česky** (`DOWNSTAGE · PUBLIKUM`, `PÓDIUM … m`, `* KAPELNÍK`). Komentáře v kódu zůstávají česky, jsou psané jako dosud.
- **Commit message je jednořádkový.** Hook odmítne tělo i patičku. Formát jako v historii: `feat(scope): …`, `fix(scope): …`, `docs(design): …`, `refactor(scope): …`, `test(scope): …`.
- **Baseline repa je trvale červený. Měř rozdíl, ne absolutní čísla:** 2 padající testy (`assetsPaths`, `repoAssets`), ~1400 CRLF lint chyb, 10 typových chyb ve 4 testovacích souborech `packages/desktop`.
- **Lintovat jen dotčené soubory:** `npx biome check <cesty>`, ne `npm run lint` na celý repo.
- Testy se pouští `npx vitest run <cesta>` pro jeden soubor, `npm test` pro celek.
- **Nikdy nezapisovat mimo `%APPDATA%/StagePilot`** a nikdy neměnit `data/assets/` za běhu.
- Rotace: v CSS `rotate(θ)` s osou y dolů otáčí **po směru hodinových ručiček**. Lokální → světové: `x = lx·cos − ly·sin`, `y = lx·sin + ly·cos`. Světové → lokální je otočení o `−θ`.

---

## File Structure

| Soubor | Odpovědnost | Akce |
|---|---|---|
| `src/domain/stageplan/layout/blockOps.ts` | operace nad zónou: posun, rotace, **nově změna velikosti** | modify |
| `src/domain/stageplan/layout/blockOps.test.ts` | testy těchto operací | modify |
| `src/domain/formatters/stageplan.ts` | formátování hlavičky boxu a monitorových odrážek | modify |
| `src/domain/formatters/formatStageplanBoxHeader.test.ts` | testy formátování | modify |
| `src/domain/pipeline/pdf/buildPdfStageplanPrintModel.ts` | tiskový model boxů z view modelu | modify |
| `src/domain/pipeline/pdf/buildPdfStageplanPrintModel.test.ts` | testy modelu | modify |
| `src/domain/pipeline/pdf/buildStageplanPrintMetrics.ts` + test | redukce boxů na dvě čísla | **delete** |
| `src/domain/stageplan/print/printMetrics.ts` | kontrakt mezi tiskem a editorem | modify |
| `src/infra/pdf/sections/stageplan.ts` | rozpočet výšky, plán, kresba sekce | modify |
| `src/infra/pdf/sections/stageplan.test.ts` | testy kresby a pojistek | modify |
| `src/infra/pdf/styles.ts` | CSS dokumentu | modify |
| `src/infra/pdf/styles.test.ts` | testy CSS | modify |
| `scripts/stageplan_print_metrics.ts` | příkaz metrik pro okno | modify |
| `packages/desktop/src/app/components/stageplan/blockFont.ts` | velikost písma karty z tiskové proporce | **create** |
| `packages/desktop/src/app/components/stageplan/blockFont.test.ts` | testy velikosti písma | **create** |
| `packages/desktop/src/app/components/stageplan/blockPrint.ts` | jediné místo, které v editoru počítá tiskovou stopu bloku | **create** |
| `packages/desktop/src/app/components/stageplan/blockContent.ts` | popisky, formátování metrů a měřítka, nejužší zóna | modify |
| `packages/desktop/src/app/components/stageplan/blockContent.test.ts` | testy formátování a nejužší zóny | **create** |
| `packages/desktop/src/app/components/stageplan/StageBlock.tsx` | kresba jedné karty a jejích úchytů | modify |
| `packages/desktop/src/app/components/stageplan/StageCanvas.tsx` | plocha, měřítko, rozdání boxů kartám | modify |
| `packages/desktop/src/app/components/stageplan/useBlockDrag.ts` | geometrie gest: posun, rotace, **nově resize** | modify |
| `packages/desktop/src/app/components/stageplan/BlockInspector.tsx` | panel vybraného bloku | modify |
| `packages/desktop/src/app/components/stageplan/EditorToolbar.tsx` | toolbar: taby, snap, rozměr pódia, **nově měřítko** | modify |
| `packages/desktop/src/app/components/stageplan/EditorFooter.tsx` | akční lišta editoru | modify |
| `packages/desktop/src/app/components/stageplan/StageSizeFields.tsx` | pole rozměru pódia | modify |
| `packages/desktop/src/styles/features/stageplan-editor.css` | vzhled plochy a karet | modify |
| `packages/desktop/src/app/pages/StagePlanEditorPage.tsx` | stav editoru a jeho akce | modify |
| `packages/desktop/src/app/pages/ProjectSetupPage.tsx` | cíl `Continue` | modify |

---

## Task 1: `resizeBlockTo` v doméně

**Files:**
- Modify: `src/domain/stageplan/layout/blockOps.ts`
- Test: `src/domain/stageplan/layout/blockOps.test.ts`

**Interfaces:**
- Consumes: `clampToArea`, `snapM`, `roundM` — vše už v `blockOps.ts`
- Produces:
  - `export const MIN_ZONE_M = 0.8`
  - `export type ZoneHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw"`
  - `export function resizeBlockTo(block: StageplanBlock, handle: ZoneHandle, deltaM: { readonly xM: number; readonly yM: number }, options: { readonly area: StageplanStageSize; readonly snap: boolean }): StageplanBlock`
  - `deltaM` je posun kurzoru **v metrech ve souřadnicích pódia** od začátku gesta, ne přírůstek mezi dvěma pohyby. Task 10 na tom staví.

- [ ] **Step 1: Napiš padající testy**

Přidej na konec `src/domain/stageplan/layout/blockOps.test.ts` a doplň importy `MIN_ZONE_M`, `resizeBlockTo` k dosavadním z `./blockOps.js`.

```ts
describe("resizeBlockTo", () => {
  const zone: StageplanBlock = {
    slot: "drums",
    centerXM: 6,
    centerYM: 4,
    widthM: 2.8,
    depthM: 1.6,
    rotationDeg: 0,
  };
  const area: StageplanStageSize = { widthM: 12, depthM: 8 };

  it("grows the east edge and leaves the west edge standing", () => {
    const next = resizeBlockTo(zone, "e", { xM: 1, yM: 0 }, { area, snap: false });

    expect(next.widthM).toBe(3.8);
    expect(next.depthM).toBe(1.6);
    // Západní hrana stála: 6 − 2,8/2 = 4,6 = 6,5 − 3,8/2.
    expect(next.centerXM).toBe(6.5);
    expect(next.centerYM).toBe(4);
  });

  it("grows the west edge to the left and leaves the east edge standing", () => {
    const next = resizeBlockTo(zone, "w", { xM: -1, yM: 0 }, { area, snap: false });

    expect(next.widthM).toBe(3.8);
    expect(next.centerXM).toBe(5.5);
  });

  it("resizes both axes from a corner handle", () => {
    const next = resizeBlockTo(zone, "se", { xM: 0.4, yM: 0.4 }, { area, snap: false });

    expect(next.widthM).toBe(3.2);
    expect(next.depthM).toBe(2);
    expect(next.centerXM).toBe(6.2);
    expect(next.centerYM).toBe(4.2);
  });

  it("stops at the minimum zone and moves the centre only by what it allowed", () => {
    const next = resizeBlockTo(zone, "e", { xM: -5, yM: 0 }, { area, snap: false });

    expect(next.widthM).toBe(MIN_ZONE_M);
    // Povolený úbytek je 2,8 − 0,8 = 2, střed jde o polovinu: 6 − 1 = 5.
    expect(next.centerXM).toBe(5);
  });

  it("reads the drag in the zone's own axes when it is rotated", () => {
    const rotated = { ...zone, rotationDeg: 90 };
    // Při 90° leží šířková osa zóny svisle, takže vodorovný tah šířku nemění.
    const sideways = resizeBlockTo(rotated, "e", { xM: 1, yM: 0 }, { area, snap: false });
    expect(sideways.widthM).toBe(2.8);

    // Svislý tah ji naopak mění a střed jde svisle.
    const along = resizeBlockTo(rotated, "e", { xM: 0, yM: 1 }, { area, snap: false });
    expect(along.widthM).toBe(3.8);
    expect(along.centerXM).toBe(6);
    expect(along.centerYM).toBe(4.5);
  });

  it("snaps the resulting size to the grid when snap is on", () => {
    const next = resizeBlockTo(zone, "e", { xM: 0.23, yM: 0 }, { area, snap: true });

    expect(next.widthM).toBe(3);
  });

  it("clamps the grown zone back onto the stage", () => {
    const atEdge = { ...zone, centerXM: 11 };
    const next = resizeBlockTo(atEdge, "e", { xM: 2, yM: 0 }, { area, snap: false });

    expect(next.widthM).toBe(4.8);
    // clampAxis: max = 12 − 2,4 + 0,2 = 9,8.
    expect(next.centerXM).toBe(9.8);
  });
});
```

- [ ] **Step 2: Pusť je a potvrď, že padají**

Run: `npx vitest run src/domain/stageplan/layout/blockOps.test.ts`
Expected: FAIL — `resizeBlockTo is not a function` / `MIN_ZONE_M` není exportovaná.

- [ ] **Step 3: Implementuj**

Přidej do `src/domain/stageplan/layout/blockOps.ts` pod `OVERHANG_TOLERANCE_M`:

```ts
/** Nejmenší rozumná lidská zóna — stojan s mikrofonem. Ne tisková mez (R7). */
export const MIN_ZONE_M = 0.8;

export type ZoneHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
```

A na konec souboru:

```ts
/** Kterou hranu úchyt táhne: +1 doprava/dolů, −1 doleva/nahoru, 0 vůbec. */
function handleSigns(handle: ZoneHandle): { signX: number; signY: number } {
  return {
    signX: handle.includes("e") ? 1 : handle.includes("w") ? -1 : 0,
    signY: handle.includes("s") ? 1 : handle.includes("n") ? -1 : 0,
  };
}

function resizedExtent(
  current: number,
  growth: number,
  snap: boolean,
): number {
  const target = current + growth;
  return Math.max(MIN_ZONE_M, snap ? snapM(target) : roundM(target));
}

/**
 * Táhne se jedna hrana (nebo dvě u rohu) a **protilehlá stojí**, takže se mění
 * i střed zóny. `deltaM` je posun kurzoru od začátku gesta v souřadnicích
 * pódia; u otočené zóny se nejdřív promítne do jejích vlastních os, tam se
 * spočítá nový rozměr, a posun středu se otočí zpátky. Bez té projekce by
 * úchyt na otočeném bloku táhl podél osy pódia a hrana by ujížděla do strany (R8).
 *
 * Pořadí je snap → podlaha → clamp, stejně jako `moveBlockTo` dělá
 * snap → clamp: mřížka ustupuje hraně pódia, ne naopak.
 */
export function resizeBlockTo(
  block: StageplanBlock,
  handle: ZoneHandle,
  deltaM: { readonly xM: number; readonly yM: number },
  options: { readonly area: StageplanStageSize; readonly snap: boolean },
): StageplanBlock {
  const radians = (block.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const { signX, signY } = handleSigns(handle);

  const localXM = deltaM.xM * cos + deltaM.yM * sin;
  const localYM = -deltaM.xM * sin + deltaM.yM * cos;

  const widthM = resizedExtent(block.widthM, signX * localXM, options.snap);
  const depthM = resizedExtent(block.depthM, signY * localYM, options.snap);

  // Střed jde o polovinu skutečného přírůstku ve směru tažené hrany.
  const shiftXM = (signX * (widthM - block.widthM)) / 2;
  const shiftYM = (signY * (depthM - block.depthM)) / 2;

  return clampToArea(
    {
      ...block,
      widthM,
      depthM,
      centerXM: roundM(block.centerXM + shiftXM * cos - shiftYM * sin),
      centerYM: roundM(block.centerYM + shiftXM * sin + shiftYM * cos),
    },
    options.area,
  );
}
```

- [ ] **Step 4: Pusť testy a potvrď, že prochází**

Run: `npx vitest run src/domain/stageplan/layout/blockOps.test.ts`
Expected: PASS, včetně dosavadních testů posunu a rotace.

- [ ] **Step 5: Nedělej to, co se tady nabízí (R9)**

`MIN_ZONE_M` **nepatří** do `normalizeStageplanLayout`. Podlaha je omezení gesta, ne invariant dat:
ručně editovaný JSON se musí dát otevřít, což je celý smysl normalizace, a tisk zvládne jakoukoli
šířku, protože `computePrintFootprintMm` vezme `max(zóna, minBoxWidthMm)`. Ověř, že se
`src/domain/stageplan/layout/normalizeLayout.ts` v tomhle tasku **nezměnil**:

Run: `git diff --name-only`
Expected: `normalizeLayout.ts` v seznamu **není**.

- [ ] **Step 6: Lint a commit**

```bash
npx biome check --write src/domain/stageplan/layout/blockOps.ts src/domain/stageplan/layout/blockOps.test.ts
git add src/domain/stageplan/layout/blockOps.ts src/domain/stageplan/layout/blockOps.test.ts
git commit -m "feat(stageplan-layout): add resizeBlockTo with a 0.8 m zone floor"
```

---

## Task 2: Hvězdička místo `(band leader)`

**Files:**
- Modify: `src/domain/formatters/stageplan.ts:21`
- Test: `src/domain/formatters/formatStageplanBoxHeader.test.ts`

**Interfaces:**
- Produces: `formatStageplanBoxHeader` vrací hlavičku s příponou `"*"` místo `" (band leader)"`. Task 5 na hvězdičce staví text vysvětlivky.

- [ ] **Step 1: Přepiš test na hvězdičku**

V `src/domain/formatters/formatStageplanBoxHeader.test.ts` vymění se test `"adds band leader suffix when requested"` za dva:

```ts
  it("marks the band leader with a footnote asterisk and no space", () => {
    const label = formatStageplanBoxHeader({
      instrumentLabel: "Bass",
      firstName: "Matěj",
      isBandLeader: true,
    });

    expect(label).toBe("BASS – MATĚJ*");
  });

  it("keeps the asterisk when musician names are hidden", () => {
    // DRUMS* je pořád pravdivá informace o tom, kdo je kapelník (R12).
    const label = formatStageplanBoxHeader({
      instrumentLabel: "Drums",
      firstName: "Matěj",
      isBandLeader: true,
      hideMusicianNames: true,
    });

    expect(label).toBe("DRUMS*");
  });
```

- [ ] **Step 2: Pusť a potvrď pád**

Run: `npx vitest run src/domain/formatters/formatStageplanBoxHeader.test.ts`
Expected: FAIL — dostane `BASS – MATĚJ (band leader)`.

- [ ] **Step 3: Implementuj**

V `src/domain/formatters/stageplan.ts` nahraď řádek s příponou:

```ts
  // Hvězdička je značka poznámky pod čarou, ta se ke slovu tiskne bez mezery.
  // Vysvětlivku pod plánem sází renderer (R12, R13).
  const suffix = isBandLeader ? "*" : "";
```

- [ ] **Step 4: Pusť testy**

Run: `npx vitest run src/domain/formatters/`
Expected: PASS.

- [ ] **Step 5: Najdi zbylé výskyty `(band leader)` a pusť celek**

Run: `npx vitest run src/domain src/infra`
Expected: PASS. Pokud padne test v `buildPdfStageplanPrintModel.test.ts` nebo `sections/stageplan.test.ts` na řetězec `(band leader)`, uprav v něm očekávanou hodnotu na `*` — je to tentýž záměr, ne jiné chování.

- [ ] **Step 6: Lint a commit**

```bash
npx biome check --write src/domain/formatters/stageplan.ts src/domain/formatters/formatStageplanBoxHeader.test.ts
git add src/domain/formatters/ src/domain/pipeline/pdf/ src/infra/pdf/
git commit -m "feat(stageplan): mark the band leader with an asterisk instead of a text suffix"
```

---

## Task 3: `hasBandLeaderMark` na tiskovém boxu

**Files:**
- Modify: `src/domain/pipeline/pdf/buildPdfStageplanPrintModel.ts:23-32` (typ) a `:310-324` (sestavení)
- Test: `src/domain/pipeline/pdf/buildPdfStageplanPrintModel.test.ts`

**Interfaces:**
- Produces: `StageplanPrintBox.hasBandLeaderMark: boolean`. Task 5 z něj rozhoduje o vysvětlivce, Task 7 ho veze do editoru.

- [ ] **Step 1: Napiš padající test**

Přidej do `src/domain/pipeline/pdf/buildPdfStageplanPrintModel.test.ts` nový `it` do existujícího `describe`:

```ts
  it("flags the band leader on the box instead of leaving it in the header text (R13)", () => {
    const model = buildPdfStageplanPrintModel({
      inputs: [],
      monitorOutputs: [],
      powerByRole: {},
      lineupByRole: {
        bass: { firstName: "Matěj", isBandLeader: true },
        drums: { firstName: "Pavel", isBandLeader: false },
      },
      leadVocals: [],
      layout: { stage: null, blocks: [] },
    } as unknown as DocumentViewModel["stageplan"]);

    expect(model.boxesBySlot.bass.hasBandLeaderMark).toBe(true);
    expect(model.boxesBySlot.drums.hasBandLeaderMark).toBe(false);
  });
```

- [ ] **Step 2: Pusť a potvrď pád**

Run: `npx vitest run src/domain/pipeline/pdf/buildPdfStageplanPrintModel.test.ts`
Expected: FAIL — `hasBandLeaderMark` je `undefined`.

- [ ] **Step 3: Implementuj**

Do typu `StageplanPrintBox` přidej pole:

```ts
export type StageplanPrintBox = {
  slot: StageplanPrintSlot;
  instrument: StageplanInstrument;
  header: string;
  /** Zda hlavička nese hvězdičku. Vysvětlivka pod plánem se rozhoduje podle
   *  tohohle pole, ne hledáním `*` v textu hlavičky (R13). */
  hasBandLeaderMark: boolean;
  inputBullets: string[];
  monitorBullets: string[];
  extraBullets: string[];
  hasPowerBadge: boolean;
  powerBadgeText: string;
};
```

A v `buildPdfStageplanPrintModel` do objektu `boxesBySlot[slot]` hned za `header`:

```ts
      hasBandLeaderMark: roleData.isBandLeader,
```

- [ ] **Step 4: Pusť testy**

Run: `npx vitest run src/domain/pipeline/pdf/ src/infra/pdf/`
Expected: PASS.

- [ ] **Step 5: Lint a commit**

```bash
npx biome check --write src/domain/pipeline/pdf/buildPdfStageplanPrintModel.ts src/domain/pipeline/pdf/buildPdfStageplanPrintModel.test.ts
git add src/domain/pipeline/pdf/
git commit -m "feat(pdf-stageplan): carry the band leader flag on the print box"
```

---

## Task 4: Inverzní lead vokál v tisku končí

**Files:**
- Modify: `src/infra/pdf/styles.ts:359-363`, `src/infra/pdf/sections/stageplan.ts:118-126` a `:301-313`, `:355-356`
- Test: `src/infra/pdf/styles.test.ts:47-64`, `src/infra/pdf/sections/stageplan.test.ts:253`

**Interfaces:**
- Produces: `StageplanBoxPlan` **bez** pole `isLeadVocal`. Task 5 pracuje s týmž typem.

- [ ] **Step 1: Přepiš testy z požadavku na zákaz**

V `src/infra/pdf/styles.test.ts` vymění se test `"draws stageplan blocks in the F5b identity"` za:

```ts
  it("draws every stageplan block the same, with no inverted lead vocal (F6 R11)", () => {
    // R11 mění R5 z F5b: inverze dělala z lead vokálu nejvýraznější prvek
    // stránky, ačkoli jsou všechny bloky rovnocenné pozice na pódiu.
    expect(pdfStyles).toMatch(
      new RegExp(
        `\\.stageplanBox\\s*\\{[^}]*border:\\s*1px solid ${escapeRegExp(pdfTokens.ink)}`,
      ),
    );
    expect(pdfStyles).toMatch(/\.stageplanBox\s*\{[^}]*background:\s*#fff/i);
    expect(pdfStyles).not.toContain("stageplanBox--lead");
    expect(pdfStyles).toMatch(/\.stageplanPower\s*\{[^}]*color:\s*#ff5b1f/i);
    expect(pdfStyles).not.toContain("#F7E65A");
    expect(pdfStyles).not.toContain(".stageplanPowerGap");
  });
```

V `src/infra/pdf/sections/stageplan.test.ts` vymění se řádek `expect(html).toContain("stageplanBox--lead");` za:

```ts
    expect(html).not.toContain("stageplanBox--lead");
```

- [ ] **Step 2: Pusť a potvrď pád**

Run: `npx vitest run src/infra/pdf/styles.test.ts src/infra/pdf/sections/stageplan.test.ts`
Expected: FAIL — `stageplanBox--lead` v CSS i v HTML pořád je.

- [ ] **Step 3: Odstraň CSS pravidlo**

V `src/infra/pdf/styles.ts` smaž celý blok včetně komentáře nad ním:

```css
/* Lead vokál je jediný plný blok — handoff řádek 125. */
.stageplanBox--lead {
  background: ${pdfTokens.ink};
  color: #fff;
}
```

- [ ] **Step 4: Odstraň příznak z plánu a z kresby**

V `src/infra/pdf/sections/stageplan.ts`:

1. z typu `StageplanBoxPlan` smaž řádek `readonly isLeadVocal: boolean;`
2. v `buildStageplanPlan` v `boxes: rects.map(...)` smaž celou položku `isLeadVocal: …`
3. v `renderBox` smaž `const leadClass = …` a v šabloně nahraď `class="stageplanBox${leadClass}"` za `class="stageplanBox"`

- [ ] **Step 5: Pusť testy**

Run: `npx vitest run src/infra/pdf/`
Expected: PASS. `tsc` musí projít bez chyby na nepoužitém `isLeadVocal`:

Run: `npx tsc --noEmit`
Expected: 0 chyb.

- [ ] **Step 6: Lint a commit**

```bash
npx biome check --write src/infra/pdf/styles.ts src/infra/pdf/styles.test.ts src/infra/pdf/sections/stageplan.ts src/infra/pdf/sections/stageplan.test.ts
git add src/infra/pdf/
git commit -m "feat(pdf-stageplan): drop the inverted lead vocal so every block prints the same"
```

---

## Task 5: Vysvětlivka `* KAPELNÍK` pod plánem

**Files:**
- Modify: `src/infra/pdf/sections/stageplan.ts` (rozpočet výšky, `StageplanPlan`, `buildStageplanPlan`, `renderStageplanSection`), `src/infra/pdf/styles.ts`
- Test: `src/infra/pdf/sections/stageplan.test.ts`, `src/infra/pdf/styles.test.ts`

**Interfaces:**
- Consumes: `StageplanPrintBox.hasBandLeaderMark` (Task 3)
- Produces: `StageplanPlan.legend: string | null`; `stageplanLayout.legendSize`, `stageplanLayout.legendGap`

- [ ] **Step 1: Napiš padající testy**

Do `src/infra/pdf/sections/stageplan.test.ts` přidej nový `describe`. Doplň si importy `resolvePrintScale`, `buildDefaultLayout`, `STAGEPLAN_BLOCK_SLOTS`, `OVERHANG_TOLERANCE_M` a `stageplanPrintGeometry`.

```ts
describe("stageplan legend (R13)", () => {
  function vmWith(args: {
    leaderSlot: "bass" | null;
  }): DocumentViewModel["stageplan"] {
    return {
      inputs: [],
      monitorOutputs: [],
      powerByRole: {},
      leadVocals: [],
      lineupByRole: {
        bass: { firstName: "Matěj", isBandLeader: args.leaderSlot === "bass" },
      },
      layout: {
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
      },
    } as unknown as DocumentViewModel["stageplan"];
  }

  it("prints the legend when a printed block carries the mark", () => {
    const plan = buildStageplanPlan(vmWith({ leaderSlot: "bass" }));
    expect(plan.legend).toBe("* KAPELNÍK");
  });

  it("leaves the legend out when no printed block carries the mark", () => {
    const plan = buildStageplanPlan(vmWith({ leaderSlot: null }));
    expect(plan.legend).toBeNull();
  });

  it("keeps the plan geometry identical with and without the legend", () => {
    // Výška vysvětlivky se rezervuje vždy, jinak by měřítko plánu záviselo na
    // tom, jestli je někdo označený jako kapelník (R13, po vzoru R6 z F5b).
    const withLeader = buildStageplanPlan(vmWith({ leaderSlot: "bass" }));
    const withoutLeader = buildStageplanPlan(vmWith({ leaderSlot: null }));

    expect(withoutLeader.stage.widthMm).toBe(withLeader.stage.widthMm);
    expect(withoutLeader.stage.heightMm).toBe(withLeader.stage.heightMm);
    expect(withoutLeader.container).toEqual(withLeader.container);
  });

  it("keeps the print scale width-bound, so the reservation cannot shrink the plan", () => {
    // Tvrzení, na kterém rezerva stojí: měřítko je min(šířková, výšková) mez a
    // váže ho šířka. Kdyby to přestalo platit, ubraná výška by plán zmenšila.
    const nominalDepthM = 8;
    const blocks = buildDefaultLayout({
      slots: STAGEPLAN_BLOCK_SLOTS,
      stage: null,
    }).blocks;
    const scale = resolvePrintScale({
      stage: null,
      blocks,
      area: stageplanPrintGeometry.area,
      minBoxWidthMm: stageplanPrintGeometry.typography.minBoxWidthMm,
    });
    const heightBound =
      stageplanPrintGeometry.area.heightMm /
      (nominalDepthM + 2 * OVERHANG_TOLERANCE_M);

    expect(scale.mmPerM).toBeLessThan(heightBound);
  });

  it("keeps the min-box-width reservation active for the default zones", () => {
    // Nejužší výchozí zóna je 2,6 m a tisková mez ~2,81 m, takže rezerva
    // měřítko snižuje už u výchozího rozmístění. Není to hraniční případ.
    const blocks = buildDefaultLayout({
      slots: STAGEPLAN_BLOCK_SLOTS,
      stage: null,
    }).blocks;
    const narrowestM = Math.min(...blocks.map((block) => block.widthM));
    const scale = resolvePrintScale({
      stage: null,
      blocks,
      area: stageplanPrintGeometry.area,
      minBoxWidthMm: stageplanPrintGeometry.typography.minBoxWidthMm,
    });

    expect(narrowestM * scale.mmPerM).toBeLessThan(
      stageplanPrintGeometry.typography.minBoxWidthMm,
    );
  });
});
```

Do `src/infra/pdf/styles.test.ts` přidej do `describe("pdf stageplan identity")`:

```ts
  it("pins the legend's height budget so it cannot drift from the renderer (R13)", () => {
    expect(pdfStyles).toMatch(
      new RegExp(
        `\\.stageplanLegend\\s*\\{[^}]*height:\\s*${escapeRegExp(stageplanLayout.legendSize)}`,
      ),
    );
    expect(pdfStyles).toMatch(/\.stageplanLegend\s*\{[^}]*line-height:\s*1\b/);
    expect(pdfStyles).toMatch(
      new RegExp(
        `\\.stageplanLegend\\s*\\{[^}]*margin-top:\\s*${escapeRegExp(stageplanLayout.legendGap)}`,
      ),
    );
  });
```

- [ ] **Step 2: Pusť a potvrď pád**

Run: `npx vitest run src/infra/pdf/sections/stageplan.test.ts src/infra/pdf/styles.test.ts`
Expected: FAIL — `plan.legend` neexistuje, `stageplanLayout.legendSize` neexistuje.

- [ ] **Step 3: Rezervuj výšku v rozpočtu**

V `src/infra/pdf/sections/stageplan.ts` přidej pod `captionHeightPt`:

```ts
/**
 * Vysvětlivka ke kapelníkovi. Výška se rezervuje **vždy**, i když v lineupu
 * kapelník není — jinak by měřítko plánu záviselo na datech, přesně jak to
 * zakazuje R6 u popisku pódia (R13).
 */
const legendGapPt = 4;
const legendHeightPt =
  parsePt(pdfLayout.typography.tableHead.size) *
    pdfLayout.typography.tableHead.lineHeight +
  legendGapPt;
```

A do `areaHeightMm` přidej poslední odečet:

```ts
const areaHeightMm =
  availableHeightMm -
  ptToMm(containerMarginTopPt) -
  2 * ptToMm(containerPadPt) -
  2 * pxToMm(containerBorderPx) -
  ptToMm(captionHeightPt) -
  ptToMm(legendHeightPt);
```

- [ ] **Step 4: Vystav konstanty pro CSS a text do plánu**

Do `stageplanLayout` přidej za `captionTracking`:

```ts
  legendSize: pdfLayout.typography.tableHead.size,
  legendGap: `${legendGapPt}pt`,
```

Do typu `StageplanPlan` přidej:

```ts
  /** Text vysvětlivky, nebo null když se žádný tištěný blok kapelníkem nechlubí. */
  readonly legend: string | null;
```

Nad `buildStageplanPlan` přidej konstantu a v `return` ji použij. Rozhoduje se podle boxů, které se **opravdu tisknou**, ne podle všech šesti slotů:

```ts
/** Česky, protože PDF je česky — na rozdíl od rozhraní (R13, R14). */
const BAND_LEADER_LEGEND = "* KAPELNÍK";
```

V `return` objektu `buildStageplanPlan` přidej vedle `container` a `stage`:

```ts
    legend: rects.some(
      (rect) => printModel.boxesBySlot[rect.slot].hasBandLeaderMark,
    )
      ? BAND_LEADER_LEGEND
      : null,
```

- [ ] **Step 5: Vykresli ji a nastyluj**

V `renderStageplanSection` přidej za `</div>` kontejneru řádek s vysvětlivkou. Element je v toku **vždy**, aby držel rezervovanou výšku; prázdný je, když `legend` chybí — přesně jako `.stageplanCaption`:

```ts
  return `
<section class="stageplanSection">\n  <div class="stageplanCaption">${plan.stage.caption ?? ""}</div>\n  <div class="stageplanContainer">\n    <div class="stageplanPlanArea" style="width:${plan.container.widthMm}mm; height:${plan.container.heightMm}mm;">\n      <div class="stageplanStage" style="left:${plan.stage.xMm}mm; top:${plan.stage.yMm}mm; width:${plan.stage.widthMm}mm; height:${plan.stage.heightMm}mm;">\n        <div class="stageplanDownstage">DOWNSTAGE · PUBLIKUM</div>\n      </div>\n      ${boxesHtml}\n    </div>\n  </div>\n  <div class="stageplanLegend">${plan.legend ?? ""}</div>\n</section>`.trim();
```

Do `src/infra/pdf/styles.ts` přidej za pravidlo `.stageplanCaption`:

```css
.stageplanLegend {
  /* Zrcadlo popisku nad plánem: výška jednoho řádku vždy, i když je prázdný,
     protože rozpočet výšky s ní počítá (R13). */
  height: ${stageplanLayout.legendSize};
  line-height: 1;
  margin-top: ${stageplanLayout.legendGap};
  font-family: '${pdfLayout.typography.monoFamily}', Consolas, monospace;
  font-size: ${stageplanLayout.legendSize};
  letter-spacing: ${stageplanLayout.captionTracking};
  color: ${pdfTokens.steel};
  text-align: center;
}
```

- [ ] **Step 6: Pusť testy včetně skutečného tisku**

Run: `npx vitest run src/infra/pdf/`
Expected: PASS — včetně `pdf.test.ts`, který vykresluje skutečné PDF přes systémový Chromium a hlídá počet stran. Pokud tenhle test spadne na přetečení, rezerva výšky je špatně spočítaná; **neobcházej pojistku**, oprav rozpočet.

- [ ] **Step 7: Lint a commit**

```bash
npx biome check --write src/infra/pdf/sections/stageplan.ts src/infra/pdf/sections/stageplan.test.ts src/infra/pdf/styles.ts src/infra/pdf/styles.test.ts
git add src/infra/pdf/
git commit -m "feat(pdf-stageplan): print the band leader legend and reserve its height unconditionally"
```

---

## Task 6: Chybové hlášky tisku anglicky

**Files:**
- Modify: `src/infra/pdf/sections/stageplan.ts:250-255` a `:274-289`
- Test: `src/infra/pdf/sections/stageplan.test.ts`

**Interfaces:** žádné nové. Mění se jen text vyhozených chyb.

**Kontext pro implementátora:** tyhle dvě hlášky **nejsou jen logy**. `ExportResultModal.tsx:67` renderuje `state.technical`, který `mapExportError` bere z `message`, a `export_pdf` v `lib.rs` message z odpovědi skriptu propouští. Při exportu je uživatel vidí.

- [ ] **Step 1: Přituž dvě existující asserce**

Dvě pojistky už testy mají a **budou dál procházet**, protože obě matchují anglickou předponu, která
se nemění: `toThrow(/overflow/)` na řádku 101 a `toThrow(/collision: drums × bass/)` na řádku 171.
Právě proto sem musí přijít asserce na tu část, která česky je — jinak by se překlad neověřil.

Rozšiř obě existující volání, žádná nová data nevymýšlej:

`src/infra/pdf/sections/stageplan.test.ts`, test `"refuses to print a block that pushes the container past the mirror"` (řádek 84) — nahraď `.toThrow(/overflow/)` za:

```ts
    ).toThrow(
      /overflow[\s\S]*extends? past the area — move .* closer to the centre of the stage in the editor\./,
    );
```

Test `"refuses to print blocks whose boxes overlap even though their zones do not"` (řádek 142) — nahraď `.toThrow(/collision: drums × bass/)` za:

```ts
    ).toThrow(
      /collision: drums × bass\. Blocks overlap on paper — rearrange them in the editor\./,
    );
```

- [ ] **Step 2: Pusť a potvrď pád**

Run: `npx vitest run src/infra/pdf/sections/stageplan.test.ts`
Expected: FAIL — hlášky jsou česky.

- [ ] **Step 3: Přelož obě hlášky**

Kolize:

```ts
    throw new Error(
      `Stageplan print collision: ${pairs}. Blocks overlap on paper — rearrange them in the editor.`,
    );
```

Přetečení — zachovej jmenování viníka i množné číslo:

```ts
    const blockNote =
      culprits.length > 0
        ? ` Block${culprits.length > 1 ? "s" : ""} ${culprits.join(", ")} extend${culprits.length > 1 ? "" : "s"} past the area — move ${culprits.length > 1 ? "them" : "it"} closer to the centre of the stage in the editor.`
        : "";
```

- [ ] **Step 4: Pusť testy**

Run: `npx vitest run src/infra/pdf/`
Expected: PASS.

- [ ] **Step 5: Lint a commit**

```bash
npx biome check --write src/infra/pdf/sections/stageplan.ts src/infra/pdf/sections/stageplan.test.ts
git add src/infra/pdf/
git commit -m "fix(pdf-stageplan): put the collision and overflow messages in English"
```

---

## Task 7: Příkaz metrik veze celý tiskový box

**Files:**
- Modify: `src/domain/stageplan/print/printMetrics.ts`
- Delete: `src/domain/pipeline/pdf/buildStageplanPrintMetrics.ts`, `src/domain/pipeline/pdf/buildStageplanPrintMetrics.test.ts`
- Modify: `scripts/stageplan_print_metrics.ts:9` a `:64-71`
- Modify: `packages/desktop/src/app/components/stageplan/StageCanvas.tsx:59-84`

**Interfaces:**
- Consumes: `StageplanPrintBox` (Task 3 do něj přidal `hasBandLeaderMark`), `countStageplanBoxLines`
- Produces: `StageplanPrintGeometry.blocks: readonly StageplanPrintBox[]`. Task 9 a Task 11 z toho čtou obsah karty a čísla.

**Proč to takhle:** odvozené číslo přenášené po IPC je právě to místo, kde se editor s tiskem může rozejít — dá se změnit počítání řádků v rendereru a zapomenout na skript. Po tomhle tasku se přenáší jen vstup a počítá se na obou stranách stejnou funkcí (R4).

- [ ] **Step 1: Přepiš kontrakt**

`src/domain/stageplan/print/printMetrics.ts` celý:

```ts
import type { StageplanPrintBox } from "../../pipeline/pdf/buildPdfStageplanPrintModel.js";
import type { PrintTypography } from "./printFootprint.js";
import type { PrintArea } from "./printScale.js";

/**
 * Co editor potřebuje, aby si tiskovou stopu i obsah karty spočítal stejnými
 * funkcemi jako tisk. Plocha a typografie jdou v odpovědi s sebou, aby okno
 * nemuselo importovat konstanty z infra vrstvy (R12 z F5b).
 *
 * `blocks` nese **celé tiskové boxy**, ne odvozená čísla: počet řádků si obě
 * strany dopočítají `countStageplanBoxLines`, takže se nemají čím rozejít (R4).
 */
export type StageplanPrintGeometry = {
  readonly area: PrintArea;
  readonly typography: PrintTypography;
  readonly blocks: readonly StageplanPrintBox[];
};
```

Import je `import type`, takže mezi `stageplan/print/` a `pipeline/pdf/` nevzniká runtime hrana.

- [ ] **Step 2: Smaž redukci**

```bash
git rm src/domain/pipeline/pdf/buildStageplanPrintMetrics.ts src/domain/pipeline/pdf/buildStageplanPrintMetrics.test.ts
```

Mrtvá nepřímost je horší než o funkci méně — skript si boxy vybere sám.

- [ ] **Step 3: Uprav skript**

V `scripts/stageplan_print_metrics.ts` vymění se import `buildStageplanPrintMetrics` za `buildPdfStageplanPrintModel`:

```ts
import { buildPdfStageplanPrintModel } from "../src/domain/pipeline/pdf/buildPdfStageplanPrintModel.js";
```

A `return` v `run`:

```ts
  // Metriky pokrývají právě bloky z layoutu — editor kreslí karty jen k nim.
  // hideMusicianNames se nepředává: je to stav obrazovky Preview, ne vlastnost
  // projektu, takže editor jména ukazuje vždy (R4).
  const printModel = buildPdfStageplanPrintModel(vm.stageplan);

  return {
    ok: true,
    result: {
      area: stageplanPrintGeometry.area,
      typography: stageplanPrintGeometry.typography,
      blocks: vm.stageplan.layout.blocks.map(
        (block) => printModel.boxesBySlot[block.slot],
      ),
    },
  };
```

- [ ] **Step 4: Uprav konzumenta v editoru, chování zachovej**

V `packages/desktop/src/app/components/stageplan/StageCanvas.tsx` přidej import

```ts
import { countStageplanBoxLines } from "../../../../../../src/domain/pipeline/pdf/countStageplanBoxLines";
```

a v `footprintFor` vymění se hledání metriky za hledání boxu:

```ts
  const footprintFor = (block: StageplanBlock) => {
    if (!printGeometry || !printScale) return null;
    const box = printGeometry.blocks.find((entry) => entry.slot === block.slot);
    if (!box) return null;
    const footprint = computePrintFootprintMm({
      // Počet řádků se nepřenáší, počítá se tou samou funkcí jako v rendereru (R4).
      lineCount: countStageplanBoxLines(box),
      hasPower: box.hasPowerBadge,
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

Zůstává to tady na místě jen do Tasku 9, který výpočet přesune do vlastního modulu, protože ho bude
potřebovat i panel. Neinvestuj do téhle podoby víc, než je potřeba, aby task prošel.

- [ ] **Step 5: Ověř typy a testy**

Run: `npx tsc --noEmit`
Expected: 0 chyb v kořeni.

Run: `npx vitest run src/ packages/desktop/src/`
Expected: PASS proti baseline (2 známé pády `assetsPaths` a `repoAssets` zůstávají).

Run: `cd packages/desktop && npx tsc --noEmit; cd ../..`
Expected: stejných 10 chyb ve 4 testovacích souborech jako v baseline, ani jedna nová.

- [ ] **Step 6: Lint a commit**

```bash
npx biome check --write src/domain/stageplan/print/printMetrics.ts scripts/stageplan_print_metrics.ts packages/desktop/src/app/components/stageplan/StageCanvas.tsx
git add -A src/domain scripts packages/desktop/src/app/components/stageplan
git commit -m "refactor(stageplan-print): send whole print boxes to the editor instead of derived counts"
```

---

## Task 8: Velikost písma karty

**Files:**
- Create: `packages/desktop/src/app/components/stageplan/blockFont.ts`
- Test: `packages/desktop/src/app/components/stageplan/blockFont.test.ts`

**Interfaces:**
- Produces: `resolveBlockFontPx(args: { fontSizePt: number; pxPerM: number; mmPerM: number }): number | null`. `null` znamená „písmo by bylo nečitelné, ukaž jen hlavičku". Task 9 to konzumuje.

- [ ] **Step 1: Napiš padající test**

`packages/desktop/src/app/components/stageplan/blockFont.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  BLOCK_FONT_MAX_PX,
  BLOCK_FONT_MIN_PX,
  resolveBlockFontPx,
} from "./blockFont";

/** Tiskové písmo boxu je 8 pt a měřítko výchozího plánu ~12,885 mm/m. */
const PRINT = { fontSizePt: 8, mmPerM: 12.885 };

describe("resolveBlockFontPx", () => {
  it("caps at the readable maximum on a large canvas", () => {
    // 75 px/m → 5,82 px na mm papíru → proporce ~16,4 px, tedy nad stropem.
    expect(resolveBlockFontPx({ ...PRINT, pxPerM: 75 })).toBe(BLOCK_FONT_MAX_PX);
  });

  it("follows the print proportion once it drops below the maximum", () => {
    // 35 px/m → 2,716 px na mm papíru → proporce ~7,67 px.
    const fontPx = resolveBlockFontPx({ ...PRINT, pxPerM: 35 });

    expect(fontPx).not.toBeNull();
    expect(fontPx as number).toBeGreaterThan(BLOCK_FONT_MIN_PX);
    expect(fontPx as number).toBeLessThan(BLOCK_FONT_MAX_PX);
  });

  it("gives up below the legibility floor so only the header stays", () => {
    // 30 px/m → proporce ~6,57 px. Nečitelný text je horší než žádný (R5).
    expect(resolveBlockFontPx({ ...PRINT, pxPerM: 30 })).toBeNull();
  });
});
```

- [ ] **Step 2: Pusť a potvrď pád**

Run: `npx vitest run packages/desktop/src/app/components/stageplan/blockFont.test.ts`
Expected: FAIL — modul neexistuje.

- [ ] **Step 3: Implementuj**

`packages/desktop/src/app/components/stageplan/blockFont.ts`:

```ts
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
```

- [ ] **Step 4: Pusť test**

Run: `npx vitest run packages/desktop/src/app/components/stageplan/blockFont.test.ts`
Expected: PASS.

- [ ] **Step 5: Lint a commit**

```bash
npx biome check --write packages/desktop/src/app/components/stageplan/blockFont.ts packages/desktop/src/app/components/stageplan/blockFont.test.ts
git add packages/desktop/src/app/components/stageplan/
git commit -m "feat(stageplan-editor): resolve block font size from the print proportion"
```

---

## Task 9: Karta je tištěný box s plným výpisem

**Files:**
- Create: `packages/desktop/src/app/components/stageplan/blockPrint.ts`
- Modify: `packages/desktop/src/app/components/stageplan/StageBlock.tsx`
- Modify: `packages/desktop/src/app/components/stageplan/StageCanvas.tsx`
- Modify: `packages/desktop/src/app/pages/StagePlanEditorPage.tsx`
- Modify: `packages/desktop/src/styles/features/stageplan-editor.css`

**Interfaces:**
- Consumes: `StageplanPrintGeometry.blocks` (Task 7), `resolveBlockFontPx` (Task 8), `countStageplanBoxLines`, `computePrintFootprintMm`, `resolvePrintScale`
- Produces:
  - `blockPrint.ts`: `type BlockPrint = { box: StageplanPrintBox; footprint: { widthM: number; depthM: number }; isBelowPrintFloor: boolean }` a `resolveBlockPrint(args: { block: StageplanBlock; geometry: StageplanPrintGeometry | null; scale: PrintScale | null }): BlockPrint | null`
  - `StageBlock` bere `print: BlockPrint | null` a `fontPx: number | null`
  - `StageCanvas` bere navíc `printScale: PrintScale | null`
- Task 10 přidává do `StageBlock` úchyty, Task 11 volá `resolveBlockPrint` znovu pro inspektor.

**Chování:** karta se kreslí v rozměru **tištěné stopy**, hranatě, bez radiusu. Zóna je čárkovaný obrys uvnitř. Když `print` chybí (příkaz metrik neodpověděl, nebo pro slot není box), karta padne na dnešní kresbu — rozměr zóny a `LABEL_BY_SLOT` (R6).

**Proč `blockPrint.ts` a proč `printScale` výš:** stopu i měřítko potřebuje plocha (karty) i stránka (inspektor a toolbar v Tasku 11). Dvě kopie téhož výpočtu by se rozešly stejně snadno jako přenášený `lineCount`, který ruší Task 7. Měřítko se proto počítá **jednou ve stránce** a stopa jednou funkcí.

- [ ] **Step 1: Vytvoř `blockPrint.ts`**

`packages/desktop/src/app/components/stageplan/blockPrint.ts`:

```ts
import type { StageplanBlock } from "../../../../../../src/domain/model/types";
import type { StageplanPrintBox } from "../../../../../../src/domain/pipeline/pdf/buildPdfStageplanPrintModel";
import { countStageplanBoxLines } from "../../../../../../src/domain/pipeline/pdf/countStageplanBoxLines";
import { computePrintFootprintMm } from "../../../../../../src/domain/stageplan/print/printFootprint";
import type { StageplanPrintGeometry } from "../../../../../../src/domain/stageplan/print/printMetrics";
import type { PrintScale } from "../../../../../../src/domain/stageplan/print/printScale";

export type BlockPrint = {
  readonly box: StageplanPrintBox;
  /** Rozměr tištěného boxu v metrech — karta se kreslí v něm (R3). */
  readonly footprint: { readonly widthM: number; readonly depthM: number };
  /** Zóna je užší, než tisk umí nakreslit; na papíře bude box širší (R10). */
  readonly isBelowPrintFloor: boolean;
};

/**
 * Co se o bloku dá říct z tiskového modelu. Jediné místo, které tiskovou stopu
 * v editoru počítá — plocha i panel čtou odsud, aby si nemohly odpovídat jinak.
 *
 * Počet řádků se nepřenáší po IPC, dopočítá se `countStageplanBoxLines`, tedy
 * tou samou funkcí, jakou používá renderer (R4).
 */
export function resolveBlockPrint(args: {
  readonly block: StageplanBlock;
  readonly geometry: StageplanPrintGeometry | null;
  readonly scale: PrintScale | null;
}): BlockPrint | null {
  const { block, geometry, scale } = args;
  if (!geometry || !scale) return null;
  const box = geometry.blocks.find((entry) => entry.slot === block.slot);
  if (!box) return null;

  const footprint = computePrintFootprintMm({
    lineCount: countStageplanBoxLines(box),
    hasPower: box.hasPowerBadge,
    zone: block,
    mmPerM: scale.mmPerM,
    typography: geometry.typography,
  });

  return {
    box,
    footprint: {
      widthM: scale.toM(footprint.widthMm),
      depthM: scale.toM(footprint.heightMm),
    },
    isBelowPrintFloor:
      block.widthM * scale.mmPerM < geometry.typography.minBoxWidthMm,
  };
}
```

- [ ] **Step 2: Zvedni měřítko do stránky**

V `StagePlanEditorPage.tsx` přidej za `const area = state.layout.stage ?? NOMINAL_STAGE;`:

```ts
  // Jedno měřítko pro plochu i pro čísla v panelu. Stejná funkce jako renderer (R10).
  const printScale = printGeometry
    ? resolvePrintScale({
        stage: area,
        blocks: state.layout.blocks,
        area: printGeometry.area,
        minBoxWidthMm: printGeometry.typography.minBoxWidthMm,
      })
    : null;
```

Doplň import `resolvePrintScale` z `../../../../../src/domain/stageplan/print/printScale` a předej do plochy `printScale={printScale}`.

- [ ] **Step 3: Přeber měřítko v `StageCanvas` a rozdej kartám tiskový balík**

V `StageCanvas.tsx` přidej `printScale: PrintScale | null` do props, **smaž** vlastní volání `resolvePrintScale` i importy, které tím osiří (`resolvePrintScale`, `computePrintFootprintMm`), a nahraď `footprintFor` tímto:

```ts
  const fontPx = printGeometry && printScale
    ? resolveBlockFontPx({
        fontSizePt: printGeometry.typography.fontSizePt,
        pxPerM: scale.pxPerM,
        mmPerM: printScale.mmPerM,
      })
    : null;
```

a v `blocks.map` vymění se `printFootprint={footprintFor(block)}` za:

```tsx
            print={resolveBlockPrint({
              block,
              geometry: printGeometry,
              scale: printScale,
            })}
            fontPx={fontPx}
```

Doplň importy `resolveBlockFontPx` z `./blockFont`, `resolveBlockPrint` z `./blockPrint` a typ `PrintScale`.

- [ ] **Step 4: Přepiš `StageBlock`**

Celý `packages/desktop/src/app/components/stageplan/StageBlock.tsx`:

```tsx
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import type { StageplanBlock } from "../../../../../../src/domain/model/types";
import type { StageScale } from "../../../../../../src/domain/stageplan/layout/scale";
import { LABEL_BY_SLOT } from "./blockContent";
import type { BlockPrint } from "./blockPrint";

type StageBlockProps = {
  block: StageplanBlock;
  scale: StageScale;
  isSelected: boolean;
  print: BlockPrint | null;
  /** null = písmo by bylo nečitelné, ukaž jen hlavičku (R5). */
  fontPx: number | null;
  onSelect: (slot: StageplanBlock["slot"]) => void;
  onStartMove: (event: ReactPointerEvent, block: StageplanBlock) => void;
  onStartRotate: (event: ReactPointerEvent, block: StageplanBlock) => void;
};

function BulletGroup({ bullets }: { bullets: readonly string[] }) {
  return (
    <>
      {bullets.map((bullet) => (
        <div key={bullet} className="stage-block__line">
          {bullet}
        </div>
      ))}
    </>
  );
}

/**
 * Karta je tištěný box, zóna je obrys uvnitř (R3). Plný výpis se do karty
 * vejde vždy, protože tištěná stopa je `max(zóna, text)` — proto se sází do
 * karty, a ne do zóny.
 *
 * Geometrie jde do `style` jako CSS proměnné, ne jako hotové deklarace —
 * vzhled zůstává v CSS, v komponentě je jen spočítané umístění.
 */
export function StageBlock({
  block,
  scale,
  isSelected,
  print,
  fontPx,
  onSelect,
  onStartMove,
  onStartRotate,
}: StageBlockProps) {
  const cardWidthM = print?.footprint.widthM ?? block.widthM;
  const cardDepthM = print?.footprint.depthM ?? block.depthM;
  const geometry = {
    "--card-w": `${scale.toPx(cardWidthM)}px`,
    "--card-h": `${scale.toPx(cardDepthM)}px`,
    "--card-x": `${scale.toPx(block.centerXM - cardWidthM / 2)}px`,
    "--card-y": `${scale.toPx(block.centerYM - cardDepthM / 2)}px`,
    "--block-rot": `${block.rotationDeg}deg`,
    "--zone-w": `${scale.toPx(block.widthM)}px`,
    "--zone-h": `${scale.toPx(block.depthM)}px`,
    "--block-font": fontPx === null ? undefined : `${fontPx}px`,
  } as CSSProperties;

  const box = print?.box ?? null;
  const showBullets = box !== null && fontPx !== null;

  return (
    <div
      className={`stage-block${isSelected ? " stage-block--selected" : ""}`}
      style={geometry}
      onPointerDown={(event) => {
        onSelect(block.slot);
        onStartMove(event, block);
      }}
    >
      <div className="stage-block__zone" />
      <div className="stage-block__label">
        {box ? box.header : LABEL_BY_SLOT[block.slot]}
      </div>
      {showBullets && box ? (
        <div className="stage-block__body">
          <BulletGroup bullets={box.inputBullets} />
          {box.monitorBullets.length > 0 && box.inputBullets.length > 0 ? (
            <div className="stage-block__gap" />
          ) : null}
          <BulletGroup bullets={box.monitorBullets} />
          {box.extraBullets.length > 0 &&
          (box.monitorBullets.length > 0 || box.inputBullets.length > 0) ? (
            <div className="stage-block__gap" />
          ) : null}
          <BulletGroup bullets={box.extraBullets} />
          {box.hasPowerBadge ? (
            <div className="stage-block__power">{box.powerBadgeText}</div>
          ) : null}
        </div>
      ) : null}
      <div className="stage-block__rotation">{block.rotationDeg}°</div>
      {isSelected ? (
        <button
          type="button"
          className="stage-block__rotate"
          aria-label="Rotate block"
          onPointerDown={(event) => onStartRotate(event, block)}
        >
          ↻
        </button>
      ) : null}
    </div>
  );
}
```

Mezery mezi skupinami odrážek stojí ve stejném pořadí a za stejných podmínek jako v `renderBox` v `src/infra/pdf/sections/stageplan.ts` — když se to tam změní, musí se to změnit i tady.

- [ ] **Step 5: Přepiš CSS karty**

V `packages/desktop/src/styles/features/stageplan-editor.css` nahraď pravidla `.stage-block`, `.stage-block__print-footprint` a `.stage-block__label` za:

```css
.stage-block {
  position: absolute;
  left: var(--card-x);
  top: var(--card-y);
  width: var(--card-w);
  height: var(--card-h);
  transform: rotate(var(--block-rot));
  transform-origin: center;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 8px;
  border: 1px solid var(--color-stage-border);
  /* Bez radiusu: karta je tištěný box a ten je podle R5 z F5b hranatý (R3). */
  background: var(--color-stage-block);
  box-shadow: var(--elevation-block);
  cursor: grab;
  user-select: none;
  font-size: var(--block-font, 11px);
  line-height: 1.35;
  /* Pozice bez transition — jinak tažení drhne. Barvy ano. */
  transition:
    background-color 120ms ease-out,
    border-color 120ms ease-out;
}

/* Zóna z F5a uvnitř tištěné karty. Je to cíl úchytů, ne dekorace (R3). */
.stage-block__zone {
  position: absolute;
  left: 50%;
  top: 50%;
  width: var(--zone-w);
  height: var(--zone-h);
  transform: translate(-50%, -50%);
  border: 1px dashed var(--color-stage-text-dim);
  pointer-events: none;
}

.stage-block__label {
  font-weight: 700;
  letter-spacing: 0.04em;
  text-align: center;
  color: var(--color-stage-text);
}

.stage-block__body {
  text-align: center;
  color: var(--color-stage-text-mid);
  overflow: hidden;
}

.stage-block__line {
  white-space: nowrap;
}

.stage-block__gap {
  height: 1em;
}

.stage-block__power {
  font-weight: 600;
  color: var(--color-primary);
  white-space: nowrap;
}
```

- [ ] **Step 6: Ověř typy a testy**

Run: `npx tsc --noEmit && npx vitest run packages/desktop/src/`
Expected: 0 chyb v kořeni, testy PASS.

Run: `cd packages/desktop && npx vite build; cd ../..`
Expected: build projde (`tsc` v `npm run build` padá i v baseline, `vite build` ne).

- [ ] **Step 7: Lint a commit**

```bash
npx biome check --write packages/desktop/src/app/components/stageplan/ packages/desktop/src/app/pages/StagePlanEditorPage.tsx packages/desktop/src/styles/features/stageplan-editor.css
git add packages/desktop/src/
git commit -m "feat(stageplan-editor): draw the block card as the printed box with its full content"
```

---

## Task 10: Úchyty pro změnu velikosti

**Files:**
- Modify: `packages/desktop/src/app/components/stageplan/useBlockDrag.ts`
- Modify: `packages/desktop/src/app/components/stageplan/StageBlock.tsx`
- Modify: `packages/desktop/src/app/components/stageplan/StageCanvas.tsx`
- Modify: `packages/desktop/src/styles/features/stageplan-editor.css`

**Interfaces:**
- Consumes: `resizeBlockTo`, `ZoneHandle`, `MIN_ZONE_M` (Task 1); `BlockPrint` (Task 9)
- Produces: `useBlockDrag` vrací navíc `startResize(event: ReactPointerEvent, block: StageplanBlock, handle: ZoneHandle): void`; `StageBlock` bere navíc `onStartResize` téhož podpisu

- [ ] **Step 1: Přidej gesto do `useBlockDrag`**

Do typu `Gesture` přidej variantu:

```ts
  | {
      kind: "resize";
      block: StageplanBlock;
      handle: ZoneHandle;
      startXPx: number;
      startYPx: number;
    };
```

Do `onPointerMove` přidej před rotační větev:

```ts
      if (gesture.kind === "resize") {
        current.onChange(
          gesture.block.slot,
          resizeBlockTo(
            gesture.block,
            gesture.handle,
            {
              // Posun od začátku gesta, ne přírůstek — resizeBlockTo počítá
              // rozměr z výchozího bloku, který si gesto drží.
              xM: current.scale.toM(event.clientX - gesture.startXPx),
              yM: current.scale.toM(event.clientY - gesture.startYPx),
            },
            { area: current.area, snap: current.snap },
          ),
        );
        return;
      }
```

A nový starter vedle `startMove` a `startRotate`:

```ts
  const startResize = useCallback(
    (event: ReactPointerEvent, block: StageplanBlock, handle: ZoneHandle) => {
      // stopPropagation je tu nutnost, ne zdvořilost: úchyt leží uvnitř karty,
      // na které visí tažení, takže bez něj by gesto rozjelo posun (R8).
      event.preventDefault();
      event.stopPropagation();
      gestureRef.current = {
        kind: "resize",
        block,
        handle,
        startXPx: event.clientX,
        startYPx: event.clientY,
      };
      argsRef.current.onGestureStart();
      bindWindow();
    },
    [bindWindow],
  );
```

Vrať ho: `return { startMove, startRotate, startResize };`

Doplň importy `resizeBlockTo` a typ `ZoneHandle` z `blockOps`.

- [ ] **Step 2: Vykresli úchyty na obrysu zóny**

Do `StageBlock.tsx` přidej konstantu a prop:

```ts
const ZONE_HANDLES: readonly ZoneHandle[] = [
  "n",
  "s",
  "e",
  "w",
  "ne",
  "nw",
  "se",
  "sw",
];
```

Přidej prop `onStartResize: (event: ReactPointerEvent, block: StageplanBlock, handle: ZoneHandle) => void;`.

Úchyty patří **na obrys zóny**, ne na hranu karty, protože karta není to, co se mění. Nedávej je tedy vedle knoflíku rotace, ale dovnitř `.stage-block__zone` — ten už má přesně geometrii zóny, takže se úchyty umístí samy. Nahraď `<div className="stage-block__zone" />` z Tasku 9 za:

```tsx
      <div className="stage-block__zone">
        {isSelected
          ? ZONE_HANDLES.map((handle) => (
              <button
                key={handle}
                type="button"
                className={`stage-block__handle stage-block__handle--${handle}`}
                aria-label={`Resize zone (${handle})`}
                onPointerDown={(event) => onStartResize(event, block, handle)}
              />
            ))
          : null}
      </div>
```

`.stage-block__zone` si `pointer-events: none` z Tasku 9 **nechává** — rám zóny nesmí krást tažení karty. Úchyty si ho vrátí samy přes `pointer-events: auto`, viz Step 4.

- [ ] **Step 3: Propoj to v `StageCanvas`**

```ts
  const { startMove, startRotate, startResize } = useBlockDrag({ … });
```

a do `<StageBlock … onStartResize={startResize} />`.

- [ ] **Step 4: Nastyluj úchyty**

V `packages/desktop/src/styles/features/stageplan-editor.css` **nech `.stage-block__zone` jak je** a přidej za něj úchyty:

```css
/* Rám zóny nechytá, aby nekradl tažení karty — úchyty si to vrátí samy (R8). */
.stage-block__handle {
  position: absolute;
  width: 10px;
  height: 10px;
  padding: 0;
  border: 1px solid var(--color-stage-canvas);
  border-radius: 2px;
  background: var(--color-primary);
  cursor: nwse-resize;
  pointer-events: auto;
}

.stage-block__handle--n,
.stage-block__handle--s {
  left: 50%;
  margin-left: -5px;
  cursor: ns-resize;
}

.stage-block__handle--e,
.stage-block__handle--w {
  top: 50%;
  margin-top: -5px;
  cursor: ew-resize;
}

.stage-block__handle--n { top: -5px; }
.stage-block__handle--s { bottom: -5px; }
.stage-block__handle--e { right: -5px; }
.stage-block__handle--w { left: -5px; }
.stage-block__handle--ne { top: -5px; right: -5px; cursor: nesw-resize; }
.stage-block__handle--nw { top: -5px; left: -5px; }
.stage-block__handle--se { bottom: -5px; right: -5px; }
.stage-block__handle--sw { bottom: -5px; left: -5px; cursor: nesw-resize; }
```

- [ ] **Step 5: Ověř typy a build**

Run: `npx tsc --noEmit && npx vitest run packages/desktop/src/`
Expected: 0 chyb v kořeni, testy PASS.

Run: `cd packages/desktop && npx vite build; cd ../..`
Expected: projde.

- [ ] **Step 6: Lint a commit**

```bash
npx biome check --write packages/desktop/src/app/components/stageplan/ packages/desktop/src/styles/features/stageplan-editor.css
git add packages/desktop/src/
git commit -m "feat(stageplan-editor): add eight resize handles on the zone outline"
```

---

## Task 11: Čísla o tiskové mezi a měřítku

**Files:**
- Modify: `packages/desktop/src/app/components/stageplan/blockContent.ts`
- Modify: `packages/desktop/src/app/components/stageplan/BlockInspector.tsx`
- Modify: `packages/desktop/src/app/components/stageplan/EditorToolbar.tsx`
- Modify: `packages/desktop/src/app/pages/StagePlanEditorPage.tsx`
- Test: `packages/desktop/src/app/components/stageplan/blockContent.test.ts` (create)

**Interfaces:**
- Consumes: `StageplanPrintGeometry`, `resolvePrintScale`, `computePrintFootprintMm`
- Produces:
  - `formatScale(mmPerM: number): string` → `"12.9 mm/m"`
  - `narrowestZoneSlot(blocks: readonly StageplanBlock[]): StageplanBlockSlot | null`
  - `BlockInspector` bere navíc `printedZone: BlockPrint | null` (typ z Tasku 9)
  - `EditorToolbar` bere navíc `scaleNote: string | null`

**Pozor na jazyk čísel:** rozhraní je anglicky, takže desetinná tečka, ne čárka. `formatMeters` v `blockContent.ts` dnes vrací `"2,8 m"` s čárkou — tady se to překlápí na tečku, ať to Task 12 nemusí dělat podruhé. Tvar `"2.8 m × 1.6 m"` **zůstává** jak je; přerovnávat jednotku na konec je změna, kterou spec neschvaluje.

**Nic se tu nepočítá dvakrát:** `printScale` už do stránky zvedl Task 9 (Step 2) a stopu počítá `resolveBlockPrint` z `blockPrint.ts`. Tenhle task jen přidá dva popisky nad tím, co v stránce už je.

- [ ] **Step 1: Napiš padající testy pomocných funkcí**

`packages/desktop/src/app/components/stageplan/blockContent.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { StageplanBlock } from "../../../../../../src/domain/model/types";
import { formatScale, formatZone, narrowestZoneSlot } from "./blockContent";

function zone(slot: StageplanBlock["slot"], widthM: number): StageplanBlock {
  return {
    slot,
    centerXM: 6,
    centerYM: 4,
    widthM,
    depthM: 1.4,
    rotationDeg: 0,
  };
}

describe("formatZone", () => {
  it("uses a decimal point, because the interface is English (R14)", () => {
    expect(formatZone(2.8, 1.6)).toBe("2.8 m × 1.6 m");
  });
});

describe("formatScale", () => {
  it("rounds the scale to one decimal", () => {
    expect(formatScale(12.885)).toBe("12.9 mm/m");
  });
});

describe("narrowestZoneSlot", () => {
  it("names the zone that drives the print scale down", () => {
    expect(
      narrowestZoneSlot([zone("drums", 2.8), zone("lead_voc_1", 2.6)]),
    ).toBe("lead_voc_1");
  });

  it("returns null without blocks", () => {
    expect(narrowestZoneSlot([])).toBeNull();
  });
});
```

- [ ] **Step 2: Pusť a potvrď pád**

Run: `npx vitest run packages/desktop/src/app/components/stageplan/blockContent.test.ts`
Expected: FAIL — `formatScale` a `narrowestZoneSlot` neexistují, `formatZone` vrací čárky.

- [ ] **Step 3: Implementuj pomocné funkce**

V `packages/desktop/src/app/components/stageplan/blockContent.ts` přepiš formátování a přidej dvě funkce:

```ts
import type {
  StageplanBlock,
  StageplanBlockSlot,
} from "../../../../../../src/domain/model/types";

/** Rozhraní je anglicky, takže desetinná tečka. V PDF se sází čárka (R14). */
export function formatMeters(value: number): string {
  return `${value.toFixed(1)} m`;
}

export function formatZone(widthM: number, depthM: number): string {
  return `${formatMeters(widthM)} × ${formatMeters(depthM)}`;
}

export function formatScale(mmPerM: number): string {
  return `${mmPerM.toFixed(1)} mm/m`;
}

/**
 * Nejužší zóna určuje tiskové měřítko přes rezervu v `resolvePrintScale`, takže
 * když se měřítko změní, tenhle blok za tím stojí. Bez pojmenování je číslo
 * měřítka k ničemu (R10).
 */
export function narrowestZoneSlot(
  blocks: readonly StageplanBlock[],
): StageplanBlockSlot | null {
  let narrowest: StageplanBlock | null = null;
  for (const block of blocks) {
    if (!narrowest || block.widthM < narrowest.widthM) narrowest = block;
  }
  return narrowest?.slot ?? null;
}
```

- [ ] **Step 4: Pusť testy pomocných funkcí**

Run: `npx vitest run packages/desktop/src/app/components/stageplan/blockContent.test.ts`
Expected: PASS.

- [ ] **Step 5: Sestav oba popisky ve stránce a předej je dolů**

V `StagePlanEditorPage.tsx` přidej pod `printScale` z Tasku 9:

```ts
  const narrowestSlot = narrowestZoneSlot(state.layout.blocks);
  const scaleNote =
    printScale && narrowestSlot
      ? `SCALE ${formatScale(printScale.mmPerM)} · NARROWEST: ${LABEL_BY_SLOT[narrowestSlot]}`
      : null;

  const selectedBlock =
    state.layout.blocks.find((block) => block.slot === selectedSlot) ?? null;
  // Stejná funkce, jakou plocha kreslí karty — jiný zdroj by lhal (R10).
  const printedZone = selectedBlock
    ? resolveBlockPrint({
        block: selectedBlock,
        geometry: printGeometry,
        scale: printScale,
      })
    : null;
```

Doplň importy `LABEL_BY_SLOT`, `formatScale`, `narrowestZoneSlot` z `../components/stageplan/blockContent` a `resolveBlockPrint` z `../components/stageplan/blockPrint`.

Předej `scaleNote={scaleNote}` do `<EditorToolbar>` a `printedZone={printedZone}` do `<BlockInspector>`.

- [ ] **Step 6: Ukaž je**

V `EditorToolbar.tsx` přidej prop `scaleNote: string | null` a do `.stage-toolbar__meta` před `<StageSizeFields>`:

```tsx
        {scaleNote ? (
          <span className="stage-toolbar__scale">{scaleNote}</span>
        ) : null}
```

V `BlockInspector.tsx` přidej prop `printedZone` a řádek `ROZMĚR` rozděl na dva:

```tsx
          <div className="stage-inspector__row">
            <span className="stage-inspector__label">ZONE</span>
            <span className="stage-inspector__value">
              {formatZone(selected.widthM, selected.depthM)}
            </span>
          </div>
          {printedZone ? (
            <div className="stage-inspector__row">
              <span className="stage-inspector__label">PRINTED</span>
              <span
                className={`stage-inspector__value${
                  printedZone.isBelowPrintFloor
                    ? " stage-inspector__value--flagged"
                    : ""
                }`}
              >
                {formatZone(
                  printedZone.footprint.widthM,
                  printedZone.footprint.depthM,
                )}
              </span>
            </div>
          ) : null}
```

Do CSS přidej:

```css
.stage-toolbar__scale {
  margin-right: var(--sp-4);
  font: var(--sp-mono-xs);
  letter-spacing: 0.1em;
  color: var(--color-stage-text-dim);
}

/* Zóna je pod tiskovou mezí — box na papíře je širší, než uživatel nakreslil. */
.stage-inspector__value--flagged {
  color: var(--color-primary);
}
```

- [ ] **Step 7: Ověř a commit**

Run: `npx tsc --noEmit && npx vitest run packages/desktop/src/ && cd packages/desktop && npx vite build; cd ../..`
Expected: 0 chyb v kořeni, testy PASS, build projde.

```bash
npx biome check --write packages/desktop/src/app/components/stageplan/ packages/desktop/src/app/pages/StagePlanEditorPage.tsx packages/desktop/src/styles/features/stageplan-editor.css
git add packages/desktop/src/
git commit -m "feat(stageplan-editor): show the printed zone size and which zone drives the scale"
```

---

## Task 12: Editor mluví anglicky

**Files:**
- Modify: `packages/desktop/src/app/pages/StagePlanEditorPage.tsx`
- Modify: `packages/desktop/src/app/components/stageplan/BlockInspector.tsx`
- Modify: `packages/desktop/src/app/components/stageplan/EditorFooter.tsx`
- Modify: `packages/desktop/src/app/components/stageplan/StageSizeFields.tsx`
- Modify: `packages/desktop/src/app/components/stageplan/StageCanvas.tsx`

**Interfaces:** žádné. Mění se jen texty.

- [ ] **Step 1: Přelož podle tabulky**

| Soubor | dnes | po |
|---|---|---|
| `StagePlanEditorPage.tsx` | `"Projekt se nepodařilo načíst."` | `"Project could not be loaded."` |
| `StagePlanEditorPage.tsx` | `Načítám…` | `Loading…` |
| `StagePlanEditorPage.tsx` | `Projekt nemá obsazený lineup, takže na pódiu není co rozmístit.` | `This project has no lineup, so there is nothing to arrange on stage.` |
| `StagePlanEditorPage.tsx` | `Otevřít Lineup Setup` | `Open Lineup Setup` |
| `StagePlanEditorPage.tsx` | `"Rozmístění uloženo."` | `"Arrangement saved."` |
| `BlockInspector.tsx` | `VYBRANÝ BLOK` | `SELECTED BLOCK` |
| `BlockInspector.tsx` | `ROTACE` | `ROTATION` |
| `BlockInspector.tsx` | `BLOKY NA PÓDIU` | `BLOCKS ON STAGE` |
| `BlockInspector.tsx` | `Reset rozmístění` | `Reset arrangement` |
| `BlockInspector.tsx` | `aria-label="Otočit o 15 stupňů vlevo"` | `aria-label="Rotate 15° left"` |
| `BlockInspector.tsx` | `aria-label="Otočit o 15 stupňů vpravo"` | `aria-label="Rotate 15° right"` |
| `EditorFooter.tsx` | `Změny se propíší do PDF exportu` | `Changes are written to the PDF export` |
| `StageSizeFields.tsx` | `PÓDIUM` | `STAGE` |
| `StageSizeFields.tsx` | `"m · NEZADÁNO"` | `"m · NOT SET"` |
| `StageSizeFields.tsx` | `aria-label="Šířka pódia v metrech"` | `aria-label="Stage width in metres"` |
| `StageSizeFields.tsx` | `aria-label="Hloubka pódia v metrech"` | `aria-label="Stage depth in metres"` |
| `StageCanvas.tsx` | `DOWNSTAGE · PUBLIKUM` | `DOWNSTAGE · AUDIENCE` |

`aria-label="Otočit blok"` v `StageBlock.tsx` a popisky úchytů už jsou anglicky z Tasku 9 a 10.

Ke `StageCanvas.tsx` přidej ke pruhu komentář, aby to příště nikdo „nespravil" zpátky:

```tsx
        {/* Anglicky, protože je to značka rozhraní. V PDF stojí česky
            `DOWNSTAGE · PUBLIKUM`, tam je to obsah dokumentu (R14). */}
        <div className="stage-canvas__downstage">DOWNSTAGE · AUDIENCE</div>
```

- [ ] **Step 2: Ověř, že v `packages/desktop` nezůstal český text rozhraní**

Run:
```bash
npx biome check packages/desktop/src/app/components/stageplan packages/desktop/src/app/pages/StagePlanEditorPage.tsx
```

Pak projdi výskyty diakritiky a potvrď, že každý zbylý je komentář, testovací dato, nebo jméno v `AboutModal`:

```bash
git grep -n '[ěščřžýáíéůúňťďĚŠČŘŽÝÁÍÉŮÚŇŤĎ]' -- 'packages/desktop/src/**/*.tsx' 'packages/desktop/src/**/*.ts'
```

Expected: žádný zásah v JSX textu ani v řetězci předávaném do `notify`, `aria-label` nebo `placeholder`.

- [ ] **Step 3: Ověř typy, testy a build**

Run: `npx tsc --noEmit && npx vitest run packages/desktop/src/ && cd packages/desktop && npx vite build; cd ../..`
Expected: 0 chyb v kořeni, PASS, build projde.

- [ ] **Step 4: Commit**

```bash
git add packages/desktop/src/
git commit -m "feat(stageplan-editor): put every interface string in English"
```

---

## Task 13: Tok na editor a jeho akční lišta

**Files:**
- Modify: `packages/desktop/src/app/pages/ProjectSetupPage.tsx:1786`
- Modify: `packages/desktop/src/app/components/stageplan/EditorFooter.tsx`
- Modify: `packages/desktop/src/app/components/stageplan/EditorToolbar.tsx`
- Modify: `packages/desktop/src/app/pages/StagePlanEditorPage.tsx`
- Modify: `packages/desktop/src/styles/features/stageplan-editor.css`

**Interfaces:**
- Produces: `EditorFooter` bere `{ isSaving: boolean; isDirty: boolean; onBack: () => void; onBackToHub: () => void; onContinue: () => void }`; `EditorToolbar` **ztrácí** prop `onOpenPreview`

- [ ] **Step 1: Přesměruj `Continue` na setupu**

V `ProjectSetupPage.tsx` nahraď cíl:

```ts
            // Editor rozmístění je krok 03, tedy přirozený krok po lineupu (R1).
            navigate(`/projects/${id}/stageplan`);
```

`withFrom` se tu nepoužívá: obrazovka editoru `?from=` nečte, byl by to mrtvý parametr. Pokud po odstranění zůstane `withFrom` v souboru nepoužitý, smaž i import — `tsc` na to upozorní.

- [ ] **Step 2: Přepiš patičku editoru**

Celý `packages/desktop/src/app/components/stageplan/EditorFooter.tsx`:

```tsx
type EditorFooterProps = {
  isSaving: boolean;
  isDirty: boolean;
  onBack: () => void;
  onBackToHub: () => void;
  onContinue: () => void;
};

/**
 * Stejná semantika jako lišty setupu a preview: vlevo návraty, vpravo
 * dirty-aware primary. `Generate PDF` odsud zmizelo, protože žádné PDF
 * negenerovalo — uložilo layout a přešlo na Preview (R1).
 */
export function EditorFooter({
  isSaving,
  isDirty,
  onBack,
  onBackToHub,
  onContinue,
}: EditorFooterProps) {
  return (
    <div className="stage-footer">
      <button type="button" className="stage-footer__ghost" onClick={onBack}>
        Back to Lineup
      </button>
      <button
        type="button"
        className="stage-footer__ghost"
        onClick={onBackToHub}
      >
        Back to Hub
      </button>
      <span className="stage-footer__note">
        Changes are written to the PDF export
      </span>
      <button
        type="button"
        className="stage-footer__primary"
        onClick={onContinue}
        disabled={isSaving}
      >
        {isDirty ? "Save & Continue" : "Continue"}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Zruš tab `PDF PREVIEW`**

V `EditorToolbar.tsx` smaž prop `onOpenPreview` z typu i z destrukturalizace a smaž celý `<button …>PDF PREVIEW</button>`. Zůstávají dva `<span>` taby. Uprav komentář nad komponentou:

```tsx
/**
 * Nástrojové čtverce z prototypu tu nejsou: tažení i rotace fungují přímo, tak
 * by to byly ovladače bez funkce — stejný důvod, proč vypadl popisek ZOOM.
 * Tab `PDF PREVIEW` vypadl v F6: dělal totéž co primary v patičce, jen bez
 * uložení, takže vedly na stejné místo dvě cesty s jinou semantikou (R2).
 */
```

- [ ] **Step 4: Propoj to ve stránce**

V `StagePlanEditorPage.tsx`:

1. z `<EditorToolbar>` smaž `onOpenPreview={…}`
2. `<EditorFooter>` nahraď:

```tsx
      <EditorFooter
        isSaving={isSaving}
        isDirty={isStageplanLayoutDirty(initialLayoutRef.current, state.layout)}
        onBack={() => navigate(`/projects/${encodeURIComponent(id)}/setup`)}
        onBackToHub={() => navigate("/")}
        onContinue={async () => {
          if (state.kind !== "ready") return;
          if (isStageplanLayoutDirty(initialLayoutRef.current, state.layout)) {
            await saveLayout(state.layout, state.project);
            notify("success", "Arrangement saved.");
          }
          navigate(`/projects/${encodeURIComponent(id)}/preview`);
        }}
      />
```

Uložení jen když je co uložit: dnešní patička ukládala vždy a hlásila „uloženo" i tehdy, kdy uživatel nic nezměnil.

- [ ] **Step 5: Doplň druhý ghost do CSS lišty**

V `stageplan-editor.css` najdi `.stage-footer` a ověř, že `.stage-footer__note` má `margin-left: auto` (nebo ho přidej), aby primary zůstal vpravo i s druhým tlačítkem vlevo:

```css
.stage-footer__note {
  margin-left: auto;
}
```

- [ ] **Step 6: Ověř typy, testy a build**

Run: `npx tsc --noEmit && npx vitest run packages/desktop/src/ && cd packages/desktop && npx vite build; cd ../..`
Expected: 0 chyb v kořeni, PASS, build projde. Pokud `processSteps.test.ts` nebo `shellChrome.test.tsx` na cíl `Continue` sahá, uprav očekávanou routu.

- [ ] **Step 7: Commit**

```bash
npx biome check --write packages/desktop/src/app/pages/ProjectSetupPage.tsx packages/desktop/src/app/pages/StagePlanEditorPage.tsx packages/desktop/src/app/components/stageplan/ packages/desktop/src/styles/features/stageplan-editor.css
git add packages/desktop/src/
git commit -m "feat(stageplan-editor): route Continue through the stage plan and align its action bar"
```

---

## Task 14: Dokumentace stavu

**Files:**
- Modify: `docs/superpowers/specs/2026-08-13-pdf-reads-stageplan-layout-design.md` (R5)
- Modify: `docs/superpowers/specs/2026-08-13-editor-flow-block-content-and-ui-language-design.md` (sekce „Stav implementace")
- Modify: `docs/design/rebranding-roadmap.md` (stav F6)
- Modify: `docs/architecture/pdf-rendering-pipeline.md`, pokud zmiňuje `buildStageplanPrintMetrics` nebo inverzní lead vokál

- [ ] **Step 1: Oprav R5 ve specu F5b**

V tabulce R5 nahraď řádek lead vokálu a přidej pod tabulku poznámku:

```markdown
| lead vokál | jako ostatní | jako ostatní — **opraveno v F6, R11** |
```

```markdown
> **Změněno v F6 (R11).** Inverzní lead vokál se zrušil: dělal z jedné pozice nejvýraznější prvek
> stránky, ačkoli jsou všechny bloky rovnocenné pozice na pódiu. Je to vědomá odchylka od handoffu,
> řádek 125. Viz [spec F6](2026-08-13-editor-flow-block-content-and-ui-language-design.md).
```

- [ ] **Step 2: Zkontroluj architektonickou dokumentaci**

Run: `git grep -n "buildStageplanPrintMetrics\|stageplanBox--lead\|band leader" -- docs/architecture`
Expected: pokud něco vyjde, uprav to na nový stav. Nedotčené nechej.

- [ ] **Step 3: Napiš „Stav implementace" do specu F6**

Podle precedentu F5b: co vzniklo, které rozhodnutí se za běhu opravilo a proč, co ověřeno **není**
(body 4–13 z Verifikace vyžadují `npm run dev`), a co se předává dál. Piš skutečné odchylky, ne
souhrn plánu — sekce má cenu jen tím, co se lišilo.

- [ ] **Step 4: Aktualizuj roadmapu**

V tabulce přepiš řádek F6 na `hotovo, čeká na ruční kontrolu` a doplň rozsah commitů.

- [ ] **Step 5: Commit**

```bash
git add docs/
git commit -m "docs(design): record the F6 implementation state and amend R5 of F5b"
```

---

## Verifikace celku

Po Tasku 14 pusť celek a porovnej **s baseline**, ne s nulou:

```bash
npm test
npx tsc --noEmit
cd packages/desktop && npx tsc --noEmit; npx vite build; cd ../..
cargo check --manifest-path packages/desktop/src-tauri/Cargo.toml
```

Očekávaný stav: `npm test` má stejné dva pády (`assetsPaths`, `repoAssets`) jako baseline a nic
navíc; `tsc` v kořeni 0 chyb; `tsc` v `packages/desktop` stejných 10 chyb ve 4 testovacích
souborech; `vite build` projde; `cargo check` projde (`lib.rs` se v tomhle plánu nemění, takže
Rust je jen pojistka).

Zbytek — body 4 až 13 ze sekce Verifikace ve specu — je **ruční kontrola v `npm run dev`**. Před
spuštěním zkontroluj port 1420 (`netstat -ano | grep :1420`); `tauri dev` má `--strictPort`, takže
obsazený port ho shodí.
