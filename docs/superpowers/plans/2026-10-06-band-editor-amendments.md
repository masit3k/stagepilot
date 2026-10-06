# Editor kapely — dodatek (vokály v sestavě, mazání kapely, layout) — implementační plán

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Editor kapely má LEAD VOCS (= skupina `vocs`) a ruční BACK VOCS přímo v sestavě, kapelu jde smazat (blokováno projekty, které ji používají) a řádky sestavy s rozbalovacím výběrem se nelámou ani neořezávají.

**Architecture:** Pravidla vokálů zůstávají v čisté doméně `src/domain/band/buildBandFromDraft.ts` (lead se bere ze sestavy, back z draftu); předvyplnění BACK VOCS a jeho „dirty" zastavení je čistá funkce v `packages/desktop/src/app/domain/band/bandFormModel.ts`. Mazání je jeden nový Rust příkaz `delete_band` nad čistou funkcí `delete_band_at(bands_dir, projects_dir, band_id)`, který kontroluje projekty a maže v jednom kroku; desktop ho volá jen přes `bandsApi.ts`. Layout se opravuje čistou funkcí pozice panelu v `AddMusiciansMultiSelect` a CSS omezeným na `.band-form`, takže `ProjectSetupPage` si drží svůj layout.

**Tech Stack:** TypeScript (ESM, strict), React 19 + Vite, Vitest (`environment: "node"`, bez jsdom; komponenty přes `renderToStaticMarkup`), Biome 1.9, Tauri 2 (Rust, `serde_json`).

**Spec:** `docs/superpowers/specs/2026-10-06-band-editor-amendments-design.md` — dodatek A1–A4, **závazný a zdroj pravdy tohoto plánu**. Kontext: původní spec `docs/superpowers/specs/2026-10-06-band-editor-design.md` (R1–R15); co dodatek nemění, platí podle něj. Kde dodatek mlčí nebo nechává volbu, rozhoduje sekce *Rulings* níže.

---

## Global Constraints

Platí pro **každý** task. Neopakují se v tělech tasků, ale jejich požadavky je implicitně obsahují.

### Vrstvy (z `CLAUDE.md`, nesmí se překročit)

- `src/domain/` — čistá logika, nula I/O, nula vedlejších efektů. Tady se mění jen `src/domain/band/buildBandFromDraft.ts` (+ testy).
- `packages/desktop/src-tauri/src/lib.rs` — jen souborový systém: sanitace id, čtení JSON, kontrola `bandRef` v projektech, smazání souboru. **Žádné serde typy entit** (původní spec R3): projekt i kapela se čtou jako `serde_json::Value`.
- `packages/desktop/` — UI. Tauri příkazy **jen** přes `packages/desktop/src/app/services/bandsApi.ts` (+ jména v `tauriCommands.ts`) (R11). Stránka ani komponenta nikdy nevolá `invoke`.
- `packages/desktop/src/app/domain/**` — čisté funkce desktopu, bez Reactu a bez importu ze `services/`. Směr závislosti je `services → app/domain → src/domain`.

### Importy a cesty (ověřeno na existujících souborech k `b6b531c`)

- Uvnitř `src/domain/**` se píše přípona `.js` (`from "../lineup/lineupAssignments.js"`, vzor `buildBandFromDraft.ts:1-17`). Testy v `src/domain/**` importují bez přípony (`buildBandFromDraft.test.ts:2-9`).
- Desktop importuje doménu **bez přípony**. Hloubka:
  - z `packages/desktop/src/app/services/` a `app/pages/` → `../../../../../src/domain/...` (5×, vzor `bandsApi.ts:2-14`, `LibraryBandFormPage.tsx:2-6`);
  - z `packages/desktop/src/app/domain/band/` a `app/components/band/` → `../../../../../../src/domain/...` (6×, vzor `bandFormModel.ts:1-12`, `BandLineupSection.tsx:2-7`).
- UI primitiva z `app/components/band/` a `app/components/roles/`: `../../../components/ui/...` (vzor `BandLineupSection.tsx:8-9`, `AddMusiciansMultiSelect.tsx:3`).
- `packages/desktop/tsconfig.json` má `lib: ES2020` a `noUnusedLocals`/`noUnusedParameters` a typově kontroluje i `src/domain/band/`, protože ho desktop importuje. **Nepoužívej** `Array.prototype.at`, `String.prototype.replaceAll`, `Object.hasOwn`.

### Testy

- Vitest, jediný `vitest.config.ts` v rootu, `environment: "node"`. **jsdom se nezavádí.** Komponenty se testují přes `renderToStaticMarkup` z `react-dom/server` (vzor `packages/desktop/src/app/components/roles/BackVocsBlock.test.tsx:1-17`). `ModalOverlay` při `open={true}` volá `createPortal(…, document.body)` a v Node spadne — dialogy se proto testují jen zavřené, obsah dialogu přes exportovanou podkomponentu.
- Mock Tauri: `vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }))`, odpovědi přes `mockResolvedValueOnce` / `mockRejectedValueOnce` (vzor `bandsApi.test.ts:1-63`).
- Rust testy nad temp adresářem přes `temp_test_dir` v `packages/desktop/src-tauri/src/lib.rs` (modul `tests` od ř. 1873, funkce ř. 1884-1892).
- **Každý task končí plným `npm test`** (ne jen jedním souborem) a Rust task navíc `cargo test` v `packages/desktop/src-tauri`.

### Baseline — měř deltu, nikdy úspěch podle absolutní nuly

Změřeno **2026-10-06 na `feat/band-editor`, commit `b6b531c`** (BASE pro všechna porovnání; čísla v tabulce byla při psaní plánu znovu spuštěna a sedí):

| Kontrola | Baseline |
|---|---|
| `npm test` | **176 souborů, 1347 testů: 1345 zelených, 2 trvale padající** — `src/infra/fs/assetsPaths.test.ts` („resolves canonical drums setup blueprint path") a `src/infra/fs/repoAssets.test.ts` („loads notes template from AppData even when data root has no notes assets") |
| `npx tsc --noEmit` (root) | **0 chyb** |
| `npx tsc -p packages/desktop/tsconfig.json --noEmit` | **14 chyb v 7 souborech**, seznam níže |
| `cargo test` v `packages/desktop/src-tauri` | **28 passed, 0 failed** |
| `npx vite build` v `packages/desktop` | **projde** (`✓ built`) |
| `npm run lint` (agregát) | ~1535 errors — **NEPOUŽÍVAT jako signál**, měřit po dotčených souborech (recept níže) |

Desktop tsc baseline (porovnávej **soubor + text chyby**, ne číslo řádku):

```
app/components/setup/fields/BassFieldRendering.test.tsx       2× TS2322 ToggleFieldDef | ToggleWithStepperFieldDef
app/components/setup/instruments/bass/buildBassFields.test.ts 3× TS2345/TS2322
app/components/setup/instruments/keys/buildKeysFields.test.ts 3× TS2339 Property 'setCount'
app/domain/roles/applyDerivedVocalOverlays.test.ts            2× TS2352 Conversion ... to type 'PresetEntity'
app/pages/ProjectSetupPage.tsx                                1× TS2322 Record<string, PresetEntity> | undefined
app/services/projectMaintenance.test.ts                       2× TS2353 'documentDate'
src/domain/stageplan/resolveStagePositionOrder.ts             1× TS2550 Property 'at'
```

**Očekávané počty po taskech** (kumulativně; když se liší, rozhoduje delta proti BASE, ne tahle tabulka — a rozdíl patří do reportu tasku):

| Po tasku | Testové soubory | Zelené testy | Padající | `cargo test` |
|---|---|---|---|---|
| BASE | 176 | 1345 | 2 (baseline) | 28 |
| 1 | 177 | 1351 | 2 | 28 |
| 2 | 179 | 1355 | 2 | 28 |
| 3 | 179 | 1366 | 2 | 28 |
| 4 | 179 | 1369 | 2 | 28 |
| 5 | 179 | 1369 | 2 | 37 |
| 6 | 180 | 1377 | 2 | 37 |
| 7 | 181 | 1381 | 2 | 37 |

**Lint — `npm run lint` je nedeterministický a 99 % nálezů jsou CRLF** (`core.autocrlf=true`, Biome čeká LF). Pro **upravený** soubor jediná platná metoda je LF-normalizovaná kopie na HEAD i na BASE:

```bash
# $SCRATCH = scratchpad session. biome.json MUSÍ ležet v kořeni scratch stromu.
S="$SCRATCH/lintcheck"; F=packages/desktop/src/app/domain/band/bandFormModel.ts
mkdir -p "$S/head/$(dirname $F)" "$S/base/$(dirname $F)"
cp biome.json "$S/head/"; cp biome.json "$S/base/"
tr -d '\r' < "$F" > "$S/head/$F"
git show b6b531c:"$F" | tr -d '\r' > "$S/base/$F"
npx biome check "$S/head/$F" 2>&1 | grep -E "lint/|format|organizeImports|Found"
npx biome check "$S/base/$F" 2>&1 | grep -E "lint/|format|organizeImports|Found"
```

Delta = nálezy na HEAD, které na BASE nejsou. Recept platí pro `.ts`, `.tsx` i `.css` (Biome 1.9 kontroluje i CSS). Rust Biome nekontroluje — tam je signálem `cargo test` bez nových warningů. **Nové soubory** se kontrolují přímo: `npx biome check --write <soubor>` (jen bezpečné opravy) a pak `npx biome check <soubor>` → 0 chyb; když druhá kontrola hlásí `format`, pusť `--write` ještě jednou. **Nikdy** `biome format --write .` ani `npm run format` nad celým repem.

Nesouvisející pre-existing selhání (testy, tsc, lint) se **neopravují**. Narazíš-li na ně, napiš je do reportu tasku i s nabídkou, zda je má člověk chtít opravit.

### Rozhraní a texty

- Jazyk UI je **angličtina**. Chybové zprávy domény anglicky (formulář je ukazuje u polí).
- Toasty: `useToast()` → `notify(kind, message)` (`LibraryBandFormPage.tsx:53`, typ `Notify` na ř. 44).
- Navigační guard: `registerNavigationGuard({ isDirty, save })` (`LibraryBandFormPage.tsx:76-87`). `navigate` při `isDirty() === true` místo přechodu otevře dialog neuložených změn (`app/shell/navigation/useAppNavigation.ts:50-60`).
- Dialogy: `ModalOverlay`, `useModalBehavior`, `ModalHeader`, `ModalFooter` z `packages/desktop/src/components/ui/Modal.tsx`; vzor celého dialogu `app/modals/UnsavedChangesModal.tsx`. Ikona zavření `Close` z `components/ui/icons.tsx:56`.
- Destruktivní tlačítko: třída `button-danger` (`styles/components.css:80-90`); tichá akce `button-ghost` (`components.css:93`).
- Žádné inline styly v nových souborech. Existující `style={{…}}` v `AddMusiciansMultiSelect.tsx:142-147` (dynamická pozice panelu) zůstává.

### Commit

- **Jednořádková zpráva bez těla a patičky** — hook obojí odmítne.
- Formát `<typ>(<scope>): <co>`, anglicky, bez tečky. Scope: `band`, `library`, `roles`, `tauri`.
- Každý task končí krokem „Commit". Commity se provádí, jen když člověk spuštění plánu výslovně schválil.

### Měř, nepředpokládej

Každá cesta, symbol a číslo řádku v plánu je ověřené k `b6b531c`. **Než se o číslo řádku opřeš, ověř ho** — předchozí task mohl soubor posunout; rozhoduje symbol, ne řádek. Tvrzení o datech v `%APPDATA%/StagePilot/` ověřuj čtením (skripty do souboru v `$SCRATCH`, ne do heredocu).

---

## Review Focus

Pět vstupů, které dodatek implikuje, ale výslovně je neřeší, seřazeno podle pravděpodobnosti, že kousnou uživatele. Každý má test v tasku, který vlastní kód.

1. **Projekt odkazuje na kapelu zkratkou nebo id v jiném case** (`"bandRef": "bk"` nebo `"BLANICKA_KAPELA"`). `catalogRepository.getBand` takový odkaz rozřeší (`src/infra/storage/catalogRepository.ts:29-35` mapuje i `code.toLowerCase()`, ř. 46 zkouší i `id.trim().toLowerCase()`), takže smazání by projekt osiřelo. Očekávání: smazání zablokované. → Task 5, test `delete_band_is_blocked_by_a_project_that_names_the_band_by_its_code`.
2. **Čerstvá instalace bez složky `projects/`.** Očekávání: kapela se smaže, ne chyba „nelze číst projekty". → Task 5, test `delete_band_succeeds_without_a_projects_folder`.
3. **Zbytkový ne-JSON soubor v `projects/`** (např. `*.tmp` po přerušeném atomickém zápisu, `atomic_write_bytes` píše přes dočasný soubor). Očekávání: ignoruje se, neblokuje. → Task 5, test `delete_band_ignores_files_that_are_not_json`.
4. **Smazání kapely s neuloženými změnami ve formuláři.** Návrat na seznam po smazání nesmí otevřít dialog „Unsaved changes" (guard by chtěl uložit smazanou kapelu). Očekávání: po smazání formulář není „dirty". → Task 7, test „isBandFormDirty is false without a baseline".
5. **Uložení existující kapely beze změny** (spec, ruční bod 3). Načtení → draft → doména musí vrátit přesně uložené `defaultOverlays`, ne přepočet. → Task 3, test „an unchanged existing band rebuilds its stored overlays".

---

## Rulings

Rozhodnutí, která dodatek nechal na plánu, nebo kde se dodatek dotýká kódu, o kterém nic neříká. Formát: *co — proč — co to stojí, když je to špatně*.

**Ruling 1 — pořadí `defaultOverlays.leadVocals` dokument ovlivňuje, ale jen u nově zakládaných projektů a u „Reset to defaults"; platí pořadí skupiny `vocs` (A1).** Řetěz v kódu:
- pipeline čte vokály **jen z projektu**, ne z kapely: `resolveCanonicalOverlayAssignments` bere `project.overlays[role]` a zachová jeho pořadí (`src/domain/project/resolveProjectAudioAssignments.ts:73-82`);
- pořadí určuje číslo slotu: `slot: index + 1` (`src/domain/pipeline/buildDocument.ts:119`), z něj klíč vstupu `voc_lead_${slot}` (`buildDocument.ts:155`, `:170`) a mapa `leadVocsSlotByMusicianId` pro řádky monitorů a popisky (`buildDocument.ts:716-717`, předaná do `buildPdfMonitorRows` na `:733-739`; spotřebitel `src/domain/formatters/vocalPdfLabels.ts:68-79`);
- kapela vstupuje do projektu jen při založení: `buildCanonicalOverlaysFromDefaults` kopíruje `defaultOverlays.leadVocals` v uloženém pořadí (`packages/desktop/src/app/shell/canonicalProject.ts:27-35`), volané z `buildCanonicalProjectBaseFromBandDefaults` (`canonicalProject.ts:98`) z `NewEventProjectPage.tsx:159` a `NewGenericProjectPage.tsx:142`; a při „Reset to defaults" na `01 LINEUP` (`ProjectSetupPage.tsx:579` `defaultLeadVocalIds`, `:1343` `setLeadVocalIds(defaultLeadVocalIds)`).

Existující projekty mají vlastní `overlays.leadVocals` a změna kapely je nezasáhne — ověřeno čtením obou projektů Blanické kapely v `%APPDATA%/StagePilot/projects/`: Konopiště `["krecmerova_eliska", "holoubek_lukas"]`, Praha `["holoubek_lukas", "krecmerova_eliska"]`. **Důsledek pro Blanickou kapelu:** po uložení v editoru bude `leadVocals = ["holoubek_lukas", "krecmerova_eliska"]` (pořadí `vocs`), takže **nový** projekt Blanické kapely dostane jako `Lead vocal 1` Holoubka místo Krečmerové. Zmíněno v ručním ověření (bod 7). — Cena při chybě: u nového projektu prohozené sloty lead vokálů; uživatel je přerovná pořadím ve skupině LEAD VOCS (odebrat a znovu přidat), nebo v projektu.

**Ruling 2 — tvar draftu po A1: `BandDraft.leadVocalIds` mizí bez náhrady, přibývá povinné `backVocalIds: readonly string[]`.** Lead vokály jsou `lineup.vocs` po `normalizeLineupAssignments` (trim, bez duplicit, `src/domain/lineup/lineupAssignments.ts:31-53`), takže samostatné pole by jen nabízelo rozpor. `BandDraftField` nahradí `"leadVocals"` za `"backVocals"`; `collectRoleErrors` (`buildBandFromDraft.ts:212-238`) se rozdělí na `collectLeaderErrors` (kapelník, beze změny) a `collectBackVocalErrors` (back vokalista mimo sestavu → chyba, back vokalista ve `vocs` → chyba). `backVocalIds` se před validací jen ořízne a zbaví duplicit (`dedupeLineupIds`, `lineupAssignments.ts:17-27`) a pak se uloží v pořadí draftu — žádný přepočet přes `canSing`. `BandDraftContext.canSing` zůstává, protože ho formulář potřebuje pro předvyplnění (Ruling 3). — Cena: žádná; draft je interní typ mezi formulářem a doménou.

**Ruling 3 — „dirty" BACK VOCS žije ve stavu formuláře jako `backVocalsTouched: boolean`, zrcadlo `codeTouched` (`bandFormModel.ts:31-32`).** Nová kapela začíná `false` a `addMembersToGroup` při `false` přepočítá BACK VOCS přes `deriveVocalOverlaysFromLineup` (`src/domain/project/deriveVocalOverlaysFromLineup.ts:36-62`, lead = `lineup.vocs`). Ruční `addBackVocals`/`removeBackVocal` nastaví `true`. `bandFormFromBand` nastaví `true` (A2: „existující kapela … nic se nepřepočítává"). `addMembersToGroup` proto dostane čtvrtý parametr `canSing: CanSing`; `removeMember` ho nepotřebuje — odvození je po členech nezávislé a zachovává pořadí sestavy, takže u nedotčeného stavu je „odfiltruj odebraného" totéž co přepočet. — Cena: jedno pole ve stavu a jeden parametr navíc; `serializeBandForm` (otisk guardu) ho automaticky zahrne.

**Ruling 4 — tlačítko „Remove" sedí u jména a má stejný viditelný text; jméno nese `aria-label`.** A4.2 chce tlačítka „Remove …" a „Add …" v jednom sloupci napříč řádky. Dnes jsou všechna Remove v `lineup-row__actions` s textem `Remove <jméno>` (`BandLineupSection.tsx:73-84`), takže šířka akcí roste s počtem a délkou jmen a řádek se přelévá. `LineupRowName` (`LineupRow.tsx:4-7`) dostane volitelné `action?: ReactNode`, které `LineupRow` vykreslí na řádku jména (`.lineup-row__name-line`). Viditelný text je `Remove`, přístupné jméno `aria-label="Remove <jméno>"`. Bez `action` je markup `LineupRow` **beze změny**, takže `ProjectSetupPage` a `BackVocsBlock` (jeho test `BackVocsBlock.test.tsx:40` porovnává přesný markup) se nedotknou. — Cena: kdo spoléhal na viditelné jméno v tlačítku, ho uvidí jen o sloupec vedle; čtečka obrazovky ho čte dál.

**Ruling 5 — příčina oříznutého dropdownu (A4.1) je šířka panelu, ne `overflow` předků.** Panel je v portálu do `document.body` s `position: fixed` (`AddMusiciansMultiSelect.tsx:137-147`, `lineup.css:270-272`), takže ho žádný předek oříznout nemůže. Šířka panelu je ale **šířka spouštěče** (`AddMusiciansMultiSelect.tsx:63`), v řádku kapely jen ~120 px, a panel má `overflow: hidden` (`lineup.css:275`) — odtud „Nývlt Jakul…" a „A… sele…". Oprava: čistá funkce `computeMultiSelectPanelPosition` dá panelu šířku `max(šířka spouštěče, 260 px)`, zarovná ho k **pravému** okraji spouštěče a ořízne do viewportu (okraj 8 px). Svislá logika (otevřít nad/pod) se přenáší beze změny. V `ProjectSetupPage` je spouštěč v dialogu přes celou šířku (`ProjectSetupPage.tsx:1580-1582`, `.lineup-assignment-editor__add`), takže tam vyjde `left` i `width` stejně jako dnes. Je to závěr ze čtení kódu, ne z běžící aplikace — potvrzuje ho ruční bod 6. — Cena: když je příčina jinde, panel bude širší, ale ořez zůstane; ruční bod 6 to odhalí.

**Ruling 6 — layout řádků sestavy (A4.2, A4.3) jen pod `.band-form`, mřížkou s pevnými sloupci.** `.band-form .lineup-row` dostane `grid-template-columns: 150px minmax(0, 1fr) 240px` (role / jména s Remove / Add), takže šířka sloupců nezávisí na obsahu. Úzké okno řeší container query na `.band-form .lineup-rows` (`container: band-lineup / inline-size`): pod 720 px šířky sestavy je řádek jeden sloupec a Add se zalomí **pod** jména. Container query je na `.lineup-rows`, ne na panelu, protože `.panel` je flex kontejner (`components.css:106-112`) a inline-size containment na něm by mohl změnit jeho šířku. Specifičnost `.band-form .lineup-row` (0,2,0) přebije `.lineup-row` z `lineup.css` i přesto, že `library.css` se importuje dřív (`styles/app.css:16` vs `:19`); u popisku role je potřeba (0,3,0), protože `.lineup-row--stacked .lineup-row__role` (`lineup.css:98`) má (0,2,0) a je později. `ProjectSetupPage` (`.lineup-rows` bez `.band-form`) zůstává na flexu z `lineup.css:58-169`. Tauri na Windows běží ve WebView2 (Chromium), container queries podporuje. — Cena: dvě sady pravidel pro tutéž komponentu; kdo později změní `LineupRow`, musí zkontrolovat obě obrazovky.

**Ruling 7 — cesta k `projects/` v Rustu: `storage_projects_dir(&app)`** (import `projects_dir as storage_projects_dir` v `lib.rs:14`, definice `storage_paths.rs:1267-1270`, stejně jako `list_projects` na `lib.rs:673`). Logika je v čisté funkci `delete_band_at(bands_dir: &Path, projects_dir: &Path, band_id: &str)`, testované nad temp adresáři; příkaz `delete_band` jen rozřeší dvě cesty. Projekty se čtou **plochým** `read_dir` jen pro `*.json` soubory (stejně jako `list_project_json_paths`, `lib.rs:423-436`); chybějící složka `projects/` = žádné projekty. — Cena: projekt uložený v podsložce by se nezapočítal; dnes žádný kód do podsložek `projects/` nepíše.

**Ruling 8 — chyba `delete_band` je vlastní `DeleteBandError { code, message, projects }`, ne rozšíření `ApiError`.** A3 chce „chybu s kódem `BAND_IN_USE` a seznamem projektů". `ApiError` (`lib.rs:20-26`) se staví struct literálem na **34 místech** (`grep -c "ApiError {"`), nové pole by je všechna změnilo. `DeleteBandError` serializuje `{ code, message, projects }`; `describeApiError` (`bandsApi.ts:48-63`) z něj čte `code` a `message` beze změny, `projects` přečte nová čistá funkce `parseBandUsages`. `impl From<ApiError> for DeleteBandError` dovolí v `delete_band_at` použít `?` nad `ensure_safe_entity_id` a `read_json_file`. — Cena: druhý chybový typ v `lib.rs`.

**Ruling 9 — blokuje každý projekt, jehož `bandRef` kapelu rozřeší: id i zkratka, bez ohledu na velikost písmen.** A3 říká „`bandRef` rovným id kapely". `catalogRepository.getBand` ale rozřeší i zkratku a id v jiném case (Review Focus 1), takže porovnání jen na přesné id by smazání pustilo a projekt osiřel. Zkratku Rust přečte z mazaného souboru kapely (`code`, jako `Value`, ne jako typ entity). — Cena: o něco přísnější blokace; falešně pozitivní by byla jen u projektu, který náhodou nese cizí zkratku jako `bandRef` — ten by ale pipeline stejně rozřešil na tuto kapelu.

**Ruling 10 — blokují i archivované a smazané (koš) projekty; dialog u nich uvede stav.** Soubor v koši leží v `projects/` se `status: "trashed"` do `purgeAt` (`app/pages/StartPage.tsx:92`, `app/services/projectMaintenance.ts:26`) a jde obnovit — po obnovení by odkazoval na smazanou kapelu. `BandUsage` proto nese `status` a popisek přidá „(archived)" / „(in trash)". Ověřeno, že oba projekty Blanické kapely jsou `"status": "archived"` — bez popisku by uživatel nechápal, co ho blokuje (ruční bod 4). — Cena: uživatel musí koš nejdřív vysypat.

**Ruling 11 — pořadí v UI: potvrzení → `delete_band` (kontrola + smazání v jednom příkazu) → při `BAND_IN_USE` dialog přepne na seznam projektů.** A3 popisuje „zjistí projekty → zablokuje, jinak potvrzení", ale zároveň chce kontrolu **uvnitř** `delete_band`, „aby mezi kontrolou a smazáním nebyla mezera". Kontrola před potvrzením by potřebovala druhý příkaz nebo parametr `dryRun`, který A3 ve signatuře `delete_band(bandId)` nemá. — Cena: u zablokované kapely uživatel jednou klikne na „Delete band" v potvrzení, než uvidí seznam. **Otevřené pro uživatele:** pokud má blokace přijít před potvrzením, přibude `dryRun: bool` (Task 5 + 6, ~1 test navíc v každém).

**Ruling 12 — uložené `backVocals`, která odporují A1 (back vokalista ve `vocs` nebo mimo sestavu), se při načtení nečistí; doména je při uložení odmítne u pole BACK VOCS.** Tiché odfiltrování by změnilo data bez vědomí uživatele. Ověřeno čtením všech 5 souborů v `catalog/bands/`: žádný takový konflikt dnes není (BNB, COS, PL mají `vocs = leadVocals = [krecmerova_eliska]` a back vokalisty jen z nástrojů; Blanická `backVocals: []`; `test_band` `vocs: []`). — Cena: u ručně rozbitého souboru uživatel uvidí chybu a back vokalistu odebere sám.

**Ruling 13 — typ `BandUsage`, jeho parsování a popisek žijí v čistém `packages/desktop/src/app/domain/band/bandDeletion.ts`; `bandsApi.ts` je importuje.** Komponenta dialogu i služba potřebují stejný typ a `app/domain` nesmí importovat ze `services/`. — Cena: žádná.

**Ruling 14 — tlačítko „Delete band" je v samostatném bloku `lineup-card` jako poslední blok formuláře, nad lepicí lištou `setup-action-bar`.** A3: „dole na stránce úpravy kapely". Lišta je `position: sticky; bottom: 0` (`styles/features/setup.css:5-18`), blok pod ní by se schovával. Blok se vykreslí jen při úpravě (`bandId !== null`). — Cena: žádná.

**Ruling 15 — po smazání se `baselineRef.current = null` a guard pak hlásí „není dirty"; seznam kapel v shellu obnoví stávající `onBandSaved` (= `refreshBands`, `ShellRouter.tsx:179`).** Jinak by `navigate("/library")` otevřel dialog neuložených změn (`useAppNavigation.ts:54-56`) a „Save & Exit" by zkusil zapsat smazanou kapelu. Logika „dirty" se vytáhne do čisté `isBandFormDirty(baseline, state)` kvůli testu. `refreshAfterSave` se zobecní na `refreshBandList(onBandSaved, notify, outcome)`. — Cena: prop `onBandSaved` se volá i po smazání; název je o něco užší než význam, přejmenování by sahalo do `ShellRouter.tsx`.

**Ruling 16 — `BandLineupSection` dostane `canSing` jako prop z `LibraryBandFormPage`, z už spočteného `BandDraftContext` (`useDraftContext`, `LibraryBandFormPage.tsx:208-223`).** Predikát musí být týž jako na `01 LINEUP` (`buildBandDraftContext.ts:47-52`). Kontext je typově `null`, dokud se data nenačtou; stránka v té chvíli formulář nevykresluje, fallback `cannotSing` je jen pro typ. — Cena: žádná.

**Ruling 17 — rozbalovací seznam „Add lead vocs" a „Add back vocs": stejná komponenta `AddMusiciansMultiSelect` s per-řádkovým stavem výběru.** Dnes je stav všech skupin v jednom `Record` (`BandLineupSection.tsx:23-29`, `:43-44`); s šestým řádkem, který není `LineupRole`, se rozpadne na podkomponenty `GroupRow` a `BackVocsRow`, každá s vlastním `useState<string[]>`. Zároveň to drží funkce pod ~40 řádky (CLAUDE.md). — Cena: žádná; rozpracovaný výběr se ztrácel i dřív po přidání.

---

## Pořadí tasků a proč

| Krok | Tasky | Co | Proč tady |
|---|---|---|---|
| **A — layout** | 1–2 | pozice panelu multiselectu; `LineupRow` s akcí u jména + mřížka `.band-form` | Nezávislé na datech. Task 4 pak staví řádky LEAD/BACK VOCS rovnou v novém tvaru, takže se `BandLineupSection` nepřepisuje dvakrát. |
| **B — vokály** | 3–4 | doména + model formuláře + nutné úpravy konzumentů; pak řádky LEAD VOCS / BACK VOCS | Task 3 mění typ `BandDraft` a stav formuláře — všechny jejich konzumenty (testy, `BandRolesSection`, `BandLineupSection`, stránka) musí být v **témže** commitu, jinak desktop tsc odskočí od baseline. Task 4 je čisté UI nad hotovým modelem. |
| **C — mazání** | 5–7 | Rust `delete_band`; `bandsApi.deleteBand` + `bandDeletion.ts`; tlačítko a dialog | Zdola nahoru: příkaz existuje dřív, než ho volá služba, a služba dřív, než ji volá stránka. |

**Mezistav každého commitu drží baseline** (testy, oba tsc, cargo): žádný task nemění signaturu, jejíž konzument zůstane neupravený do dalšího commitu. Mezi Taskem 3 a 4 formulář BACK VOCS předvyplní a uloží, jen je ještě neukazuje — to je funkčně neúplný, ale konzistentní stav.

## Seznam tasků

| # | Název | Jednou větou |
|---|---|---|
| 1 | `computeMultiSelectPanelPosition` + `AddMusiciansMultiSelect` | A4.1: panel aspoň 260 px, zarovnaný doprava ke spouštěči, oříznutý do viewportu (Ruling 5). |
| 2 | `LineupRow` s akcí u jména + mřížka řádků `.band-form` | A4.2/A4.3: Remove u jména, Add v pevném sloupci, úzké okno zalomí (Rulings 4, 6, 17). |
| 3 | A1/A2 v doméně a modelu formuláře | Lead = `vocs`, back = draft; `backVocalIds` + `backVocalsTouched`; Roles bez zaškrtávátek (Rulings 2, 3, 12, 16). |
| 4 | Řádky LEAD VOCS a BACK VOCS v `BandLineupSection` | Popisek LEAD VOCS, řádek BACK VOCS s Remove a „Add back vocs". |
| 5 | Rust `delete_band` | Kontrola projektů (id, zkratka, nečitelný soubor) a smazání v jednom příkazu (Rulings 7–10). |
| 6 | `bandsApi.deleteBand` + `bandDeletion.ts` | Typovaný výsledek `ok / inUse / failed`, parsování a popisek projektů (Ruling 13). |
| 7 | Tlačítko a dialog „Delete band" | Potvrzení, seznam blokujících projektů, návrat na seznam s toastem (Rulings 11, 14, 15). |

Po Tasku 7: **Ruční ověření** (sekce na konci plánu) — dělá člověk.

---

## Tasky

## KROK A — layout

### Task 1: `computeMultiSelectPanelPosition` + `AddMusiciansMultiSelect`

Dodatek A4.1, Ruling 5. Komponentu sdílí formulář kapely (`BandLineupSection.tsx`) i dialog přiřazení na `01 LINEUP` (`ProjectSetupPage.tsx:1582`) — oprava nesmí změnit pozici panelu tam, kde je spouštěč široký.

**Files:**
- Create: `packages/desktop/src/app/components/roles/utils/multiSelectPanelPosition.ts`
- Create: `packages/desktop/src/app/components/roles/utils/multiSelectPanelPosition.test.ts`
- Modify: `packages/desktop/src/app/components/roles/AddMusiciansMultiSelect.tsx:1-66` (importy, komentář, typ stavu `panelPosition`, tělo `updatePanelPosition`)

**Interfaces:**
- Consumes: nic z jiných tasků.
- Produces: `computeMultiSelectPanelPosition(trigger: TriggerRect, viewport: ViewportSize): PanelPosition`, `MIN_PANEL_WIDTH = 260`, typy `TriggerRect { left, right, top, bottom, width }`, `ViewportSize { width, height }`, `PanelPosition { left, top, width, maxHeight }` (vše `readonly number`). Props `AddMusiciansMultiSelect` se **nemění**.

- [ ] **Step 1: Napiš padající test**

`packages/desktop/src/app/components/roles/utils/multiSelectPanelPosition.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  MIN_PANEL_WIDTH,
  computeMultiSelectPanelPosition,
} from "./multiSelectPanelPosition";

const VIEWPORT = { width: 1200, height: 800 };

function trigger(left: number, width: number, top = 100, height = 36) {
  return { left, right: left + width, top, bottom: top + height, width };
}

describe("computeMultiSelectPanelPosition", () => {
  it("keeps the left edge and width of a trigger that is wide enough", () => {
    expect(
      computeMultiSelectPanelPosition(trigger(100, 500), VIEWPORT),
    ).toEqual({ left: 100, top: 142, width: 500, maxHeight: 260 });
  });

  it("widens a narrow trigger's panel and aligns it to the trigger's right edge", () => {
    expect(
      computeMultiSelectPanelPosition(trigger(900, 120), VIEWPORT),
    ).toMatchObject({ left: 760, width: MIN_PANEL_WIDTH });
  });

  it("keeps the panel inside the viewport on the left", () => {
    expect(
      computeMultiSelectPanelPosition(trigger(10, 100), VIEWPORT),
    ).toMatchObject({ left: 8, width: MIN_PANEL_WIDTH });
  });

  it("keeps the panel inside the viewport on the right", () => {
    expect(
      computeMultiSelectPanelPosition(trigger(1180, 40), VIEWPORT),
    ).toMatchObject({ left: 932, width: MIN_PANEL_WIDTH });
  });

  it("never gets wider than the viewport", () => {
    expect(
      computeMultiSelectPanelPosition(trigger(20, 120), {
        width: 200,
        height: 800,
      }),
    ).toMatchObject({ left: 8, width: 184 });
  });

  it("opens above the trigger when there is no room below", () => {
    expect(
      computeMultiSelectPanelPosition(trigger(100, 500, 660), VIEWPORT),
    ).toMatchObject({ top: 394, maxHeight: 260 });
  });
});
```

Kontrola čísel (ať je exekutor nemusí luštit): viewport 800 → `preferredMaxHeight = min(260, round(800 × 0.42) = 336) = 260`. Spouštěč `top 100, height 36` → `bottom 136`, místo pod = 800 − 136 − 6 − 8 = 650 → otevře se pod, `top = 136 + 6 = 142`. Úzký spouštěč `900 + 120` → `right 1020`, `left = 1020 − 260 = 760`. Pravý okraj: `right 1220` → `1220 − 260 = 960`, strop `1200 − 8 − 260 = 932`. Viewport 200 → `width = min(260, 200 − 16) = 184`, `left = max(140 − 184, 8) = 8`. Spouštěč na `top 660` → `bottom 696`, pod = 90 < 260, nad = 646 → otevře se nad, `top = 660 − 260 − 6 = 394`.

- [ ] **Step 2: Spusť test — musí selhat**

Run: `npx vitest run packages/desktop/src/app/components/roles/utils/multiSelectPanelPosition.test.ts`
Expected: FAIL — `Failed to resolve import "./multiSelectPanelPosition"`.

- [ ] **Step 3: Napiš implementaci**

`packages/desktop/src/app/components/roles/utils/multiSelectPanelPosition.ts`:

```ts
export type TriggerRect = {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
  readonly width: number;
};

export type ViewportSize = {
  readonly width: number;
  readonly height: number;
};

export type PanelPosition = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly maxHeight: number;
};

export const MIN_PANEL_WIDTH = 260;
const VIEWPORT_MARGIN = 8;
const TRIGGER_GAP = 6;
const MIN_PANEL_HEIGHT = 120;
const MAX_PANEL_HEIGHT = 260;

/**
 * Co? Pozice rozbalovacího panelu `AddMusiciansMultiSelect` z obdélníku
 * spouštěče a velikosti viewportu.
 *
 * Proč ne šířka spouštěče? V řádku sestavy kapely je spouštěč úzký a panel
 * s `overflow: hidden` pak ořízl jména i „Add selected" (dodatek A4.1).
 * Panel je proto aspoň `MIN_PANEL_WIDTH` široký, zarovnaný k pravému okraji
 * spouštěče (ten sedí u pravého okraje karty) a nikdy nevyjede z viewportu.
 * Široký spouštěč (dialog na `01 LINEUP`) dostane přesně svou šířku a levý
 * okraj, jako dřív. Svislá logika je převzatá beze změny.
 *
 * Čistá funkce, aby šla testovat bez DOM (repo nemá jsdom).
 */
export function computeMultiSelectPanelPosition(
  trigger: TriggerRect,
  viewport: ViewportSize,
): PanelPosition {
  const preferredMaxHeight = Math.min(
    MAX_PANEL_HEIGHT,
    Math.round(viewport.height * 0.42),
  );
  const spaceBelow =
    viewport.height - trigger.bottom - TRIGGER_GAP - VIEWPORT_MARGIN;
  const spaceAbove = trigger.top - TRIGGER_GAP - VIEWPORT_MARGIN;
  const opensAbove = spaceBelow < preferredMaxHeight && spaceAbove > spaceBelow;
  const maxHeight = Math.max(
    MIN_PANEL_HEIGHT,
    Math.min(preferredMaxHeight, opensAbove ? spaceAbove : spaceBelow),
  );
  const width = Math.min(
    Math.max(trigger.width, MIN_PANEL_WIDTH),
    viewport.width - 2 * VIEWPORT_MARGIN,
  );
  const left = Math.min(
    Math.max(trigger.right - width, VIEWPORT_MARGIN),
    viewport.width - VIEWPORT_MARGIN - width,
  );
  return {
    left,
    top: opensAbove
      ? Math.max(VIEWPORT_MARGIN, trigger.top - maxHeight - TRIGGER_GAP)
      : trigger.bottom + TRIGGER_GAP,
    width,
    maxHeight,
  };
}
```

- [ ] **Step 4: Spusť test — musí projít**

Run: `npx vitest run packages/desktop/src/app/components/roles/utils/multiSelectPanelPosition.test.ts`
Expected: PASS, 6 testů.

- [ ] **Step 5: Zapoj funkci do komponenty**

V `packages/desktop/src/app/components/roles/AddMusiciansMultiSelect.tsx` nahraď ř. 1-17 (importy a komentář) tímto:

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "../../../components/ui/icons";
import type { MemberOption } from "../../shell/types";
import {
  type PanelPosition,
  computeMultiSelectPanelPosition,
} from "./utils/multiSelectPanelPosition";

/**
 * Popover for adding several musicians at once. Shared by the band form and
 * the assignment dialog of 01 LINEUP (band editor spec R12). The panel
 * position is a pure function, so it is tested without a DOM (amendment A4.1).
 */
export type AddMusiciansMultiSelectProps = {
  id: string;
  options: MemberOption[];
  selectedIds: string[];
  placeholder: string;
  onSelectionChange: (nextSelectedIds: string[]) => void;
  onAddSelected: (selectedIds: string[]) => void;
};
```

Pak nahraď deklaraci stavu (ř. 30-35):

```tsx
  const [panelPosition, setPanelPosition] = useState<{
    left: number;
    top: number;
    width: number;
    maxHeight: number;
  } | null>(null);
```

za:

```tsx
  const [panelPosition, setPanelPosition] = useState<PanelPosition | null>(
    null,
  );
```

a celé `updatePanelPosition` (ř. 41-66) za:

```tsx
  const updatePanelPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    setPanelPosition(
      computeMultiSelectPanelPosition(trigger.getBoundingClientRect(), {
        width: document.documentElement.clientWidth,
        height: window.innerHeight,
      }),
    );
  }, []);
```

Zbytek souboru (efekty, výběr, JSX včetně `style={{ left, top, width, maxHeight }}` na ř. 142-147) zůstává beze změny. `DOMRect` strukturálně splňuje `TriggerRect`. Šířka viewportu se bere z `clientWidth`, ne `innerWidth`, aby panel nezajel pod svislý posuvník.

- [ ] **Step 6: Typová kontrola a build**

Run: `npx tsc -p packages/desktop/tsconfig.json --noEmit 2>&1 | grep "error TS"`
Expected: přesně 14 baseline chyb (soubor + text), žádná v `AddMusiciansMultiSelect.tsx` ani v `multiSelectPanelPosition*`.

Run: `npx tsc --noEmit`
Expected: 0 chyb.

Run (v `packages/desktop`): `npx vite build`
Expected: `✓ built`.

- [ ] **Step 7: Plná sada**

Run: `npm test`
Expected: 177 souborů, **1351 zelených**, 2 padající = přesně ty dva baseline (`assetsPaths.test.ts`, `repoAssets.test.ts`).

- [ ] **Step 8: Lint dotčených souborů**

Nové soubory: `npx biome check --write packages/desktop/src/app/components/roles/utils/multiSelectPanelPosition.ts packages/desktop/src/app/components/roles/utils/multiSelectPanelPosition.test.ts`, pak totéž bez `--write` → 0 chyb (CRLF v pracovní kopii: když hlásí jen formát kvůli `\r`, ověř LF kopií podle receptu v Global Constraints).
Upravený `AddMusiciansMultiSelect.tsx`: recept LF kopie HEAD vs BASE `b6b531c` → žádný nový nález.

- [ ] **Step 9: Commit**

```bash
git add packages/desktop/src/app/components/roles/utils/multiSelectPanelPosition.ts packages/desktop/src/app/components/roles/utils/multiSelectPanelPosition.test.ts packages/desktop/src/app/components/roles/AddMusiciansMultiSelect.tsx
git commit -m "fix(roles): widen the add-musicians panel and keep it inside the viewport"
```

---

### Task 2: `LineupRow` s akcí u jména + mřížka řádků `.band-form`

Dodatek A4.2 a A4.3, Rulings 4, 6, 17. `LineupRow` sdílí `ProjectSetupPage` (`:1075`, `:1098`, `:1170`, `:1201`), `LeadVocsBlock` a `BackVocsBlock` — bez `action` musí být markup **beze změny** (test `BackVocsBlock.test.tsx` to hlídá přesným řetězcem).

**Files:**
- Modify: `packages/desktop/src/app/components/roles/LineupRow.tsx:1-7` (typ `LineupRowName`), `:53-66` (vykreslení jmen)
- Create: `packages/desktop/src/app/components/roles/LineupRow.test.tsx`
- Modify: `packages/desktop/src/app/components/band/BandLineupSection.tsx` (celý soubor, 113 ř.)
- Create: `packages/desktop/src/app/components/band/BandLineupSection.test.tsx`
- Modify: `packages/desktop/src/styles/features/lineup.css` — vložit za `.lineup-row__actions .button-secondary { … }` (ř. 146-149), před `.section-divider` (ř. 151)
- Modify: `packages/desktop/src/styles/features/library.css` — připojit na konec (za ř. 53)

**Interfaces:**
- Consumes: nic z Tasku 1 (multiselect se používá přes nezměněné props).
- Produces: `LineupRowName = { readonly key: string; readonly label: string; readonly action?: ReactNode }`; CSS třída `.lineup-row__name-line`. `BandLineupSection` props **beze změny** v tomto tasku (`form, musicians, errors, onChange`); Task 3 přidá `canSing`. Interní `GroupRow` a `removableNames` (nevyexportované) používá Task 4.

- [ ] **Step 1: Napiš padající test `LineupRow`**

`packages/desktop/src/app/components/roles/LineupRow.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LineupRow } from "./LineupRow";

describe("LineupRow", () => {
  it("renders plain names without a name line when no name has an action", () => {
    const html = renderToStaticMarkup(
      <LineupRow
        roleLabel="DRUMS"
        names={[
          { key: "a", label: "One" },
          { key: "b", label: "Two" },
        ]}
      />,
    );

    expect(html).not.toContain("lineup-row__name-line");
    expect(html).toContain(
      '<div class="lineup-row__name"><span class="lineup-list__name">1. One</span><span class="lineup-list__name">2. Two</span></div>',
    );
  });

  it("puts a name's action on the same line as that name", () => {
    const html = renderToStaticMarkup(
      <LineupRow
        roleLabel="DRUMS"
        names={[
          {
            key: "a",
            label: "One",
            action: <button type="button">Remove</button>,
          },
        ]}
      />,
    );

    expect(html).toContain(
      '<div class="lineup-row__name-line"><span class="lineup-list__name">One</span><button type="button">Remove</button></div>',
    );
  });
});
```

- [ ] **Step 2: Spusť — druhý test musí selhat**

Run: `npx vitest run packages/desktop/src/app/components/roles/LineupRow.test.tsx`
Expected: 1 pass („renders plain names…" — dnešní chování), 1 FAIL („puts a name's action…": markup `lineup-row__name-line` chybí). Desktop tsc by v tuhle chvíli hlásil neznámou vlastnost `action` — to je očekávané a zmizí ve Step 3.

- [ ] **Step 3: Implementuj akci u jména v `LineupRow`**

V `packages/desktop/src/app/components/roles/LineupRow.tsx` nahraď typ (ř. 1-7):

```tsx
import type { ReactNode } from "react";

/** A name with a caller-supplied stable key, so the row never keys on an index. */
export type LineupRowName = {
  readonly key: string;
  readonly label: string;
};
```

za:

```tsx
import type { ReactNode } from "react";

/**
 * A name with a caller-supplied stable key, so the row never keys on an index.
 * `action` sits on the name's own line (the band form's Remove, amendment
 * A4.2); without it the markup is exactly what it was before.
 */
export type LineupRowName = {
  readonly key: string;
  readonly label: string;
  readonly action?: ReactNode;
};
```

a blok jmen (ř. 53-66):

```tsx
      <div className="lineup-row__name">
        {shown.map((name, index) => (
          <span
            key={name.key}
            // Muted, so an unassigned position does not read like a real name.
            className={
              isEmpty ? "lineup-list__name is-placeholder" : "lineup-list__name"
            }
          >
            {isStacked ? `${index + 1}. ` : ""}
            {name.label}
          </span>
        ))}
      </div>
```

za:

```tsx
      <div className="lineup-row__name">
        {shown.map((name, index) => {
          const text = (
            <span
              key={name.key}
              // Muted, so an unassigned position does not read like a real name.
              className={
                isEmpty
                  ? "lineup-list__name is-placeholder"
                  : "lineup-list__name"
              }
            >
              {isStacked ? `${index + 1}. ` : ""}
              {name.label}
            </span>
          );
          return name.action ? (
            <div key={name.key} className="lineup-row__name-line">
              {text}
              {name.action}
            </div>
          ) : (
            text
          );
        })}
      </div>
```

Run: `npx vitest run packages/desktop/src/app/components/roles/LineupRow.test.tsx packages/desktop/src/app/components/roles/BackVocsBlock.test.tsx`
Expected: PASS (2 + 3 testy) — `BackVocsBlock` dokazuje, že markup bez akce se nezměnil.

- [ ] **Step 4: Napiš padající test `BandLineupSection`**

`packages/desktop/src/app/components/band/BandLineupSection.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Group } from "../../../../../../src/domain/model/groups";
import type { Musician } from "../../../../../../src/domain/model/types";
import {
  type BandFormState,
  addMembersToGroup,
  createEmptyBandForm,
} from "../../domain/band/bandFormModel";
import { BandLineupSection } from "./BandLineupSection";

function musician(
  id: string,
  group: Group,
  firstName: string,
  lastName: string,
): Musician {
  return { id, firstName, lastName, group, presets: [] };
}

const MUSICIANS: readonly Musician[] = [
  musician("plasil_pavel", "drums", "Pavel", "Plašil"),
  musician("krecmer_matej", "bass", "Matěj", "Krečmer"),
  musician("krecmerova_eliska", "vocs", "Eliška", "Krečmerová"),
  musician("holoubek_lukas", "vocs", "Lukáš", "Holoubek"),
];

function lineupForm(): BandFormState {
  let state = createEmptyBandForm();
  state = addMembersToGroup(state, "drums", ["plasil_pavel"]);
  state = addMembersToGroup(state, "bass", ["krecmer_matej"]);
  return addMembersToGroup(state, "vocs", ["krecmerova_eliska"]);
}

function renderSection(form: BandFormState): string {
  return renderToStaticMarkup(
    <BandLineupSection
      form={form}
      musicians={MUSICIANS}
      errors={[]}
      onChange={vi.fn()}
    />,
  );
}

function actionColumns(html: string): string[] {
  return html.split('<div class="lineup-row__actions">').slice(1);
}

describe("BandLineupSection", () => {
  it("puts each member's Remove button on the member's own name line", () => {
    const html = renderSection(lineupForm());

    expect(html).toContain(
      '<div class="lineup-row__name-line"><span class="lineup-list__name">Plašil Pavel</span><button type="button" class="button-ghost" aria-label="Remove Plašil Pavel">Remove</button></div>',
    );
    expect(html.match(/>Remove</g)?.length).toBe(3);
  });

  it("keeps only the add control in the actions column of every row", () => {
    const columns = actionColumns(renderSection(lineupForm()));

    expect(columns).toHaveLength(5);
    for (const column of columns) {
      expect(column.startsWith('<div class="lineup-multiselect">')).toBe(true);
    }
  });
});
```

Run: `npx vitest run packages/desktop/src/app/components/band/BandLineupSection.test.tsx`
Expected: FAIL — dnes jsou Remove v `lineup-row__actions` s textem `Remove Plašil Pavel`.

- [ ] **Step 5: Přepiš `BandLineupSection.tsx`**

Celý soubor `packages/desktop/src/app/components/band/BandLineupSection.tsx`:

```tsx
import { useState } from "react";
import type { BandDraftError } from "../../../../../../src/domain/band/buildBandFromDraft";
import {
  LINEUP_ASSIGNMENT_ROLES,
  type LineupRole,
} from "../../../../../../src/domain/lineup/lineupAssignments";
import type { Musician } from "../../../../../../src/domain/model/types";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Info } from "../../../components/ui/icons";
import { getRoleDisplayName } from "../../../projectRules";
import {
  type BandFormState,
  type BandFormUpdate,
  addMembersToGroup,
  availableMusiciansForGroup,
  musicianLabel,
  removeMember,
} from "../../domain/band/bandFormModel";
import { AddMusiciansMultiSelect } from "../roles/AddMusiciansMultiSelect";
import { LineupRow, type LineupRowName } from "../roles/LineupRow";
import { FieldErrors } from "./FieldErrors";

type LabelOf = (musicianId: string) => string;

/**
 * A4.2: Remove sedí u jména a má u všech stejný viditelný text, takže
 * tlačítka tvoří jeden sloupec; jméno nese `aria-label` (Ruling 4).
 */
function removableNames(
  musicianIds: readonly string[],
  labelOf: LabelOf,
  onRemove: (musicianId: string) => void,
): LineupRowName[] {
  return musicianIds.map((musicianId) => ({
    key: musicianId,
    label: labelOf(musicianId),
    action: (
      <button
        type="button"
        className="button-ghost"
        aria-label={`Remove ${labelOf(musicianId)}`}
        onClick={() => onRemove(musicianId)}
      >
        Remove
      </button>
    ),
  }));
}

/** R6 + R12 blok 2: pět skupin bez talkbacku, výběr jen z muzikantů dané skupiny. */
export function BandLineupSection({
  form,
  musicians,
  errors,
  onChange,
}: {
  form: BandFormState;
  musicians: readonly Musician[];
  errors: readonly BandDraftError[];
  onChange: BandFormUpdate;
}) {
  const byId = new Map(musicians.map((musician) => [musician.id, musician]));
  const labelOf: LabelOf = (musicianId) => {
    const musician = byId.get(musicianId);
    return musician ? musicianLabel(musician) : musicianId;
  };

  return (
    <section className="lineup-card" aria-labelledby="band-lineup-heading">
      <h3 id="band-lineup-heading">Lineup</h3>
      {musicians.length === 0 ? (
        <EmptyState
          icon={<Info size={22} />}
          title="No musicians in your library yet"
          description="A band can be saved with just its name and code. The lineup is filled in once the library has musicians."
        />
      ) : (
        <div className="lineup-rows">
          {LINEUP_ASSIGNMENT_ROLES.map((role) => (
            <GroupRow
              key={role}
              role={role}
              form={form}
              musicians={musicians}
              labelOf={labelOf}
              onChange={onChange}
            />
          ))}
        </div>
      )}
      <FieldErrors errors={errors} field="lineup" />
    </section>
  );
}

/** Ruling 17: každý řádek drží vlastní rozpracovaný výběr. */
function GroupRow({
  role,
  form,
  musicians,
  labelOf,
  onChange,
}: {
  role: LineupRole;
  form: BandFormState;
  musicians: readonly Musician[];
  labelOf: LabelOf;
  onChange: BandFormUpdate;
}) {
  const [pending, setPending] = useState<string[]>([]);
  const label = getRoleDisplayName(role);
  return (
    <LineupRow
      roleLabel={label}
      names={removableNames(form.lineup[role], labelOf, (musicianId) =>
        onChange((state) => removeMember(state, musicianId)),
      )}
      emptyLabel="No musicians"
      actions={
        <AddMusiciansMultiSelect
          id={`band-add-${role}`}
          options={availableMusiciansForGroup(musicians, role, form).map(
            (musician) => ({ id: musician.id, name: musicianLabel(musician) }),
          )}
          selectedIds={pending}
          placeholder={`Add ${label.toLowerCase()}`}
          onSelectionChange={setPending}
          onAddSelected={(ids) =>
            onChange((state) => addMembersToGroup(state, role, ids))
          }
        />
      }
    />
  );
}
```

Odpadá konstanta `NO_PENDING` a `useState<Record<LineupRole, string[]>>` (dnešní ř. 23-29 a 43-44).

Run: `npx vitest run packages/desktop/src/app/components/band/BandLineupSection.test.tsx`
Expected: PASS, 2 testy.

- [ ] **Step 6: CSS — řádek jména s akcí (`lineup.css`)**

V `packages/desktop/src/styles/features/lineup.css` vlož mezi konec bloku `.lineup-row__actions .button-secondary { … }` (ř. 146-149) a `.section-divider` (ř. 151):

```css
/* A name with its own action — the band form's Remove (amendment A4.2). The
   action column is `auto` and every Remove has the same text, so the buttons
   line up down the rows. Without an action LineupRow renders no name line. */
.lineup-row__name-line {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--sp-5);
}

.lineup-row__name-line .lineup-list__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

- [ ] **Step 7: CSS — pevné sloupce řádků formuláře kapely (`library.css`)**

Na konec `packages/desktop/src/styles/features/library.css` připoj:

```css
/* --------------------------------------------------------------------------
   Band form lineup rows — fixed columns (amendment A4.2, A4.3)

   Scoped to .band-form: the 01 LINEUP rows of the project setup keep their
   flex layout from lineup.css. Columns come from the template, not from the
   content, so a long name cannot push the buttons around. Below 720px of
   lineup width a row becomes one column and the add control drops under the
   names instead of overflowing the clipped .lineup-rows box.
   -------------------------------------------------------------------------- */
.band-form .lineup-rows {
  container: band-lineup / inline-size;
}

.band-form .lineup-row {
  display: grid;
  grid-template-columns: 150px minmax(0, 1fr) 240px;
  align-items: start;
  gap: var(--sp-3) var(--sp-10);
}

/* (0,3,0): must beat `.lineup-row--stacked .lineup-row__role`, which
   lineup.css declares later with the same (0,2,0) weight. */
.band-form .lineup-row .lineup-row__role {
  padding-top: var(--sp-3);
}

.band-form .lineup-row__name {
  gap: var(--sp-2);
}

.band-form .lineup-row__actions {
  display: grid;
  margin-left: 0;
  min-width: 0;
}

@container band-lineup (max-width: 720px) {
  .band-form .lineup-row {
    grid-template-columns: minmax(0, 1fr);
  }
}
```

Proč tyhle specifičnosti a proč container query na `.lineup-rows`: Ruling 6.

- [ ] **Step 8: Typová kontrola a build**

Run: `npx tsc -p packages/desktop/tsconfig.json --noEmit 2>&1 | grep "error TS"`
Expected: přesně 14 baseline chyb.

Run: `npx tsc --noEmit` → 0 chyb.

Run (v `packages/desktop`): `npx vite build` → `✓ built` (ověří, že PostCSS/Vite přijme `@container`).

- [ ] **Step 9: Plná sada**

Run: `npm test`
Expected: 179 souborů, **1355 zelených**, 2 baseline padající.

- [ ] **Step 10: Lint dotčených souborů**

Nové: `LineupRow.test.tsx`, `BandLineupSection.test.tsx` → `npx biome check --write …`, pak bez `--write` → 0 chyb.
Upravené: `LineupRow.tsx`, `BandLineupSection.tsx`, `lineup.css`, `library.css` → recept LF kopie HEAD vs BASE `b6b531c` → žádný nový nález.

- [ ] **Step 11: Commit**

```bash
git add packages/desktop/src/app/components/roles/LineupRow.tsx packages/desktop/src/app/components/roles/LineupRow.test.tsx packages/desktop/src/app/components/band/BandLineupSection.tsx packages/desktop/src/app/components/band/BandLineupSection.test.tsx packages/desktop/src/styles/features/lineup.css packages/desktop/src/styles/features/library.css
git commit -m "fix(library): line up the band lineup buttons and let narrow rows wrap"
```

---

## KROK B — vokály

### Task 3: A1/A2 v doméně a modelu formuláře

Dodatek A1 (lead = skupina `vocs`, zaškrtávátka mizí) a A2 (BACK VOCS ruční, předvyplněné u nové kapely). Rulings 2, 3, 12, 16. Typ `BandDraft` a stav `BandFormState` se mění, proto jsou v tomto tasku **všichni** jejich konzumenti — jinak by desktop tsc v mezistavu odskočil od baseline (14 chyb).

**Files:**
- Modify: `src/domain/band/buildBandFromDraft.ts` (importy ř. 1-16, typy ř. 18-59, `buildBandFromDraft` ř. 76-120, `collectRoleErrors` ř. 212-238, `finalizeBand` ř. 297-317)
- Modify: `src/domain/band/buildBandFromDraft.test.ts` (fixtures ř. 57-81, test ř. 187-209, test ř. 394-404, testy ř. 430-466)
- Modify: `src/domain/band/buildBandDraftContext.test.ts:117`
- Modify: `packages/desktop/src/app/domain/band/bandFormModel.ts` (celý soubor)
- Modify: `packages/desktop/src/app/domain/band/bandFormModel.test.ts` (celý soubor)
- Modify: `packages/desktop/src/app/components/band/BandRolesSection.tsx` (celý soubor)
- Modify: `packages/desktop/src/app/components/band/BandLineupSection.tsx` (prop `canSing`)
- Modify: `packages/desktop/src/app/components/band/BandLineupSection.test.tsx` (předání `canSing`)
- Modify: `packages/desktop/src/app/pages/LibraryBandFormPage.tsx` (předání `canSing`, ř. 12-19 a 132-137)
- Modify: `packages/desktop/src/app/services/bandsApi.test.ts:38`

**Interfaces:**
- Consumes: z Tasku 2 `BandLineupSection` s podkomponentou `GroupRow` a `removableNames`.
- Produces:
  - `BandDraft = { name; code; bandLeaderId?; lineup; backVocalIds: readonly string[]; contact?; existingId? }` — **bez** `leadVocalIds`.
  - `BandDraftField = "name" | "code" | "lineup" | "bandLeader" | "backVocals" | "contact"` — **bez** `"leadVocals"`.
  - `bandFormModel.ts`: `type CanSing = (musicianId: string) => boolean`; `BandFormState` s `backVocalIds: readonly string[]` a `backVocalsTouched: boolean` (bez `leadVocalIds`); `addMembersToGroup(state, role, musicianIds, canSing: CanSing)`; `backVocalCandidates(state): string[]`; `addBackVocals(state, musicianIds): BandFormState`; `removeBackVocal(state, musicianId): BandFormState`. `toggleLeadVocal` **zaniká**.
  - `BandLineupSection` props: `{ form, musicians, errors, canSing: CanSing, onChange }`.

- [ ] **Step 1: Uprav doménové testy (padající)**

V `src/domain/band/buildBandFromDraft.test.ts`:

1. Ve `bnbDraft` (ř. 57-71) nahraď `leadVocalIds: ["krecmerova_eliska"],` za:

```ts
    backVocalIds: ["plasil_pavel", "krecmer_matej", "zidek_jakub"],
```

2. V `emptyDraft` (ř. 73-81) nahraď `leadVocalIds: [],` za `backVocalIds: [],`.

3. Celý test `it("derives back vocals from canSing, not from the draft", …)` (ř. 187-209) nahraď čtyřmi testy:

```ts
  it("writes leadVocals as defaultLineup.vocs in the same order", () => {
    const { band } = expectOk(
      buildBandFromDraft(
        bnbDraft({
          lineup: {
            ...BNB_LINEUP,
            vocs: ["holoubek_lukas", "krecmerova_eliska"],
          },
        }),
        context(),
      ),
    );

    expect(band.defaultLineup.vocs).toEqual([
      "holoubek_lukas",
      "krecmerova_eliska",
    ]);
    expect(band.defaultOverlays?.leadVocals).toEqual([
      "holoubek_lukas",
      "krecmerova_eliska",
    ]);
  });

  it("saves exactly the drafted back vocals instead of deriving them", () => {
    const { band } = expectOk(
      buildBandFromDraft(bnbDraft({ backVocalIds: ["zidek_jakub"] }), context()),
    );

    expect(band.defaultOverlays?.backVocals).toEqual(["zidek_jakub"]);
  });

  it("keeps empty back vocals empty", () => {
    const { band } = expectOk(
      buildBandFromDraft(bnbDraft({ backVocalIds: [] }), context()),
    );

    expect(band.defaultOverlays?.backVocals).toEqual([]);
  });

  it("trims and de-duplicates back vocal ids", () => {
    const { band } = expectOk(
      buildBandFromDraft(
        bnbDraft({ backVocalIds: [" zidek_jakub ", "zidek_jakub"] }),
        context(),
      ),
    );

    expect(band.defaultOverlays?.backVocals).toEqual(["zidek_jakub"]);
  });
```

4. Celý test `it("rejects a lead vocalist outside the lineup instead of dropping them", …)` (ř. 394-404) nahraď dvěma:

```ts
  it("rejects a back vocalist outside the lineup", () => {
    const result = buildBandFromDraft(
      bnbDraft({ backVocalIds: ["fuchs_tomas"] }),
      context(),
    );

    expect(fieldsOf(result)).toEqual(["backVocals"]);
    expect(messagesOf(result)).toEqual(["Fuchs Tomáš is not in the lineup."]);
  });

  it("rejects a back vocalist who is a lead vocalist", () => {
    const result = buildBandFromDraft(
      bnbDraft({ backVocalIds: ["krecmerova_eliska"] }),
      context(),
    );

    expect(fieldsOf(result)).toEqual(["backVocals"]);
    expect(messagesOf(result)).toEqual([
      "Krečmerová Eliška is a lead vocalist.",
    ]);
  });
```

5. Ve třech testech, které mění sestavu BNB — „rejects a musician placed in two groups" (ř. 430-442), „rejects a musician from another group" (ř. 444-454), „rejects a musician who is not in the library" (ř. 456-466) — přidej do přepisu `bnbDraft({ … })` řádek `backVocalIds: [],`. Proč: výchozí back vokalisté BNB by v upravené sestavě byli mimo sestavu (Plašil) nebo ve `vocs` (Krečmer), a test očekává jen chyby `lineup`. Příklad pro první z nich:

```ts
    const result = buildBandFromDraft(
      bnbDraft({
        lineup: { ...BNB_LINEUP, vocs: ["krecmerova_eliska", "krecmer_matej"] },
        backVocalIds: [],
      }),
      context(),
    );
```

V `src/domain/band/buildBandDraftContext.test.ts:117` nahraď `leadVocalIds: [],` za `backVocalIds: [],`.

- [ ] **Step 2: Spusť doménové testy — musí selhat**

Run: `npx vitest run src/domain/band/buildBandFromDraft.test.ts`
Expected: FAIL nejméně u „saves exactly the drafted back vocals…" (doména dnes odvodí `plasil_pavel, krecmer_matej, zidek_jakub`), „keeps empty back vocals empty", „rejects a back vocalist outside the lineup" a „…who is a lead vocalist" (doména dnes `backVocalIds` nečte).

- [ ] **Step 3: Implementuj A1/A2 v `buildBandFromDraft.ts`**

Importy (ř. 1-16) nahraď za (přibývá `dedupeLineupIds`, mizí `deriveVocalOverlaysFromLineup`):

```ts
import {
  LINEUP_ASSIGNMENT_ROLES,
  type LineupAssignments,
  type LineupRole,
  dedupeLineupIds,
  normalizeLineupAssignments,
} from "../lineup/lineupAssignments.js";
import {
  getAllLineupMemberIds,
  normalizeBandToCanonicalShape,
  validateCanonicalBandModel,
} from "../model/bandLineup.js";
import type { Group } from "../model/groups.js";
import type { Band, Contact, Musician } from "../model/types.js";
import { isValidBandCode, normalizeBandCode } from "./bandCode.js";
import { deriveBandId } from "./bandId.js";
```

`BandDraftField` (ř. 18-24):

```ts
export type BandDraftField =
  | "name"
  | "code"
  | "lineup"
  | "bandLeader"
  | "backVocals"
  | "contact";
```

`BandDraft` (ř. 37-46):

```ts
export type BandDraft = {
  readonly name: string;
  readonly code: string;
  readonly bandLeaderId?: string;
  /** Skupina `vocs` jsou lead vokály (dodatek A1): `leadVocals` se z ní odvodí. */
  readonly lineup: Partial<Record<Group, readonly string[]>>;
  /** Dodatek A2: ruční výběr BACK VOCS; uloží se přesně (oříznutý, bez duplicit). */
  readonly backVocalIds: readonly string[];
  readonly contact?: BandDraftContact;
  /** Id upravované kapely. Bez něj se kapela zakládá a id se odvodí z názvu (R4). */
  readonly existingId?: string;
};
```

V `BandDraftContext` (ř. 48-59, řádek 54) nahraď řádek `readonly canSing: (musicianId: string) => boolean;` za:

```ts
  /** Kdo umí zpívat. Doména ho nečte; formulář z něj předvyplní BACK VOCS nové kapely (A2). */
  readonly canSing: (musicianId: string) => boolean;
```

Dokumentační komentář a tělo `buildBandFromDraft` (ř. 65-120) nahraď za:

```ts
/**
 * Co? Jediný vstupní bod domény editoru kapely (R9): z draftu formuláře
 * postaví kanonickou kapelu a případný kontakt, nebo vrátí chyby polí.
 *
 * Proč unie a ne `throw`? Formulář chyby zobrazuje u polí a potřebuje je
 * všechny najednou. Výjimky z `normalizeBandToCanonicalShape` a
 * `validateCanonicalBandModel` se proto převádí na chybu pole; pravidla
 * z R13 se kontrolují explicitně dřív, aby zprávy byly čitelné.
 *
 * Vokály (dodatek A1/A2): `leadVocals` je přesně `defaultLineup.vocs` ve
 * stejném pořadí, `backVocals` přesně výběr z draftu. Doména nic
 * nepřepočítává — předvyplnění BACK VOCS je věc formuláře (`bandFormModel`).
 */
export function buildBandFromDraft(
  draft: BandDraft,
  context: BandDraftContext,
): BuildBandResult {
  const errors: BandDraftError[] = [];
  const name = draft.name.trim();
  const id = resolveBandId(draft, name, context, errors);
  const code = resolveBandCode(draft.code, context, errors);
  const lineup = normalizeLineupAssignments(draft.lineup);
  errors.push(...collectLineupErrors(lineup, context));
  const members = new Set(getAllLineupMemberIds(lineup));
  const bandLeaderId = (draft.bandLeaderId ?? "").trim();
  errors.push(...collectLeaderErrors(bandLeaderId, members));
  const backVocalIds = dedupeLineupIds(draft.backVocalIds);
  errors.push(
    ...collectBackVocalErrors(backVocalIds, lineup, members, context),
  );
  const contact = resolveContact(draft.contact, members, context, errors);
  if (errors.length > 0) return { ok: false, errors };

  return finalizeBand(
    {
      type: "band",
      id,
      code,
      name,
      bandLeader: bandLeaderId,
      bandLeaderId,
      ...resolveTalkbackOwner(context.existingBand, members),
      ...(contact ? { defaultContactId: contact.id } : {}),
      defaultLineup: lineup,
      defaultOverlays: {
        leadVocals: [...lineup.vocs],
        backVocals: backVocalIds,
      },
      ...pickUnmanagedFields(context.existingBand),
    },
    contact,
  );
}
```

Celou funkci `collectRoleErrors` (ř. 212-238) nahraď dvěma:

```ts
function collectLeaderErrors(
  bandLeaderId: string,
  members: ReadonlySet<string>,
): BandDraftError[] {
  if (!bandLeaderId) {
    return members.size > 0
      ? [{ field: "bandLeader", message: "Choose the band leader." }]
      : [];
  }
  return members.has(bandLeaderId)
    ? []
    : [
        {
          field: "bandLeader",
          message: "The band leader must be in the lineup.",
        },
      ];
}

/** A2: back vokalista musí být v sestavě a nesmí být lead (= člen `vocs`, A1). */
function collectBackVocalErrors(
  backVocalIds: readonly string[],
  lineup: LineupAssignments,
  members: ReadonlySet<string>,
  context: BandDraftContext,
): BandDraftError[] {
  const leads = new Set(lineup.vocs);
  return backVocalIds.flatMap((musicianId): BandDraftError[] => {
    if (!members.has(musicianId)) {
      return [
        {
          field: "backVocals",
          message: `${labelFor(musicianId, context)} is not in the lineup.`,
        },
      ];
    }
    if (leads.has(musicianId)) {
      return [
        {
          field: "backVocals",
          message: `${labelFor(musicianId, context)} is a lead vocalist.`,
        },
      ];
    }
    return [];
  });
}
```

Ve `finalizeBand` nahraď řádek

```ts
          field: message.includes("leadVocals") ? "leadVocals" : "lineup",
```

za

```ts
          field: message.includes("defaultOverlays") ? "backVocals" : "lineup",
```

(Všechny zprávy `validateDefaultVocals` obsahují `defaultOverlays.` — `src/domain/model/bandLineup.ts:103-130`; po A1 může selhat jen část back vokálů.)

- [ ] **Step 4: Doménové testy projdou**

Run: `npx vitest run src/domain/band/`
Expected: PASS všech souborů v `src/domain/band/` (`buildBandFromDraft.test.ts` má o 4 testy víc než na BASE).

- [ ] **Step 5: Přepiš testy modelu formuláře (padající)**

Celý `packages/desktop/src/app/domain/band/bandFormModel.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildBandDraftContext } from "../../../../../../src/domain/band/buildBandDraftContext";
import { buildBandFromDraft } from "../../../../../../src/domain/band/buildBandFromDraft";
import type { Band, Musician } from "../../../../../../src/domain/model/types";
import {
  type BandFormState,
  type CanSing,
  addBackVocals,
  addMembersToGroup,
  availableMusiciansForGroup,
  backVocalCandidates,
  bandFormFromBand,
  createEmptyBandForm,
  defaultContactMemberId,
  disableContact,
  removeBackVocal,
  removeMember,
  setBandCode,
  setBandLeader,
  setBandName,
  setContactField,
  setContactMember,
  toBandDraft,
} from "./bandFormModel";

const MUSICIANS: Musician[] = [
  {
    id: "plasil_pavel",
    firstName: "Pavel",
    lastName: "Plašil",
    group: "drums",
    presets: [],
  },
  {
    id: "nyvlt_jakub",
    firstName: "Jakub",
    lastName: "Nývlt",
    group: "drums",
    presets: [],
  },
  {
    id: "ernst_filip",
    firstName: "Filip",
    lastName: "Ernst",
    group: "drums",
    presets: [],
  },
  {
    id: "krecmer_matej",
    firstName: "Matěj",
    lastName: "Krečmer",
    group: "bass",
    presets: [],
  },
  {
    id: "krecmerova_eliska",
    firstName: "Eliška",
    lastName: "Krečmerová",
    group: "vocs",
    presets: [],
  },
];

const BAND_FILE: Band = {
  type: "band",
  id: "big_night_band",
  code: "BNB",
  name: "Big Night Band",
  bandLeader: "",
  bandLeaderId: "krecmer_matej",
  defaultContactId: "krecmer_matej",
  defaultLineup: {
    drums: ["plasil_pavel"],
    bass: ["krecmer_matej"],
    vocs: ["krecmerova_eliska"],
  },
  defaultOverlays: {
    leadVocals: ["krecmerova_eliska"],
    backVocals: ["plasil_pavel"],
  },
};

const SINGERS = new Set([
  "plasil_pavel",
  "nyvlt_jakub",
  "ernst_filip",
  "krecmer_matej",
  "krecmerova_eliska",
]);
const canSing: CanSing = (musicianId) => SINGERS.has(musicianId);
const nobodySings: CanSing = () => false;

function withLineup(): BandFormState {
  let state = createEmptyBandForm();
  state = addMembersToGroup(state, "drums", ["plasil_pavel"], canSing);
  state = addMembersToGroup(state, "bass", ["krecmer_matej"], canSing);
  return addMembersToGroup(state, "vocs", ["krecmerova_eliska"], canSing);
}

/** Bubeník, který nezpívá, a zpěvačka: BACK VOCS zůstanou prázdné. */
function silentDrummerAndSinger(): BandFormState {
  const state = addMembersToGroup(
    createEmptyBandForm(),
    "drums",
    ["nyvlt_jakub"],
    nobodySings,
  );
  return addMembersToGroup(state, "vocs", ["krecmerova_eliska"], nobodySings);
}

describe("bandFormModel", () => {
  it("derives the code from the name until the user edits it", () => {
    const named = setBandName(createEmptyBandForm(), "Big Night Band");
    expect(named.code).toBe("BNB");
    expect(named.codeTouched).toBe(false);

    const edited = setBandCode(named, "BIG");
    expect(setBandName(edited, "Big Night Orchestra").code).toBe("BIG");
  });

  it("bandFormFromBand treats the stored code and BACK VOCS as manual and reads bandLeaderId", () => {
    const state = bandFormFromBand(BAND_FILE, null);

    expect(state.codeTouched).toBe(true);
    expect(setBandName(state, "Big Night Orchestra").code).toBe("BNB");
    expect(state.bandLeaderId).toBe("krecmer_matej");
    expect(state.lineup).toEqual({
      drums: ["plasil_pavel"],
      bass: ["krecmer_matej"],
      guitar: [],
      keys: [],
      vocs: ["krecmerova_eliska"],
    });
    expect(state.backVocalIds).toEqual(["plasil_pavel"]);
    expect(state.backVocalsTouched).toBe(true);
  });

  it("bandFormFromBand loads the stored contact or starts without one", () => {
    expect(
      bandFormFromBand(BAND_FILE, {
        id: "krecmer_matej",
        firstName: "Matěj",
        lastName: "Krečmer",
        phone: "+420",
        email: "m@example.com",
      }).contact,
    ).toEqual({
      mode: "member",
      musicianId: "krecmer_matej",
      phone: "+420",
      email: "m@example.com",
    });
    expect(
      bandFormFromBand({ ...BAND_FILE, defaultContactId: undefined }, null)
        .contact,
    ).toEqual({
      mode: "none",
    });
  });

  it("ignores musicians who are already in the lineup", () => {
    const state = addMembersToGroup(
      withLineup(),
      "drums",
      ["plasil_pavel", "krecmer_matej", "nyvlt_jakub", "nyvlt_jakub"],
      canSing,
    );

    expect(state.lineup.drums).toEqual(["plasil_pavel", "nyvlt_jakub"]);
    expect(state.lineup.bass).toEqual(["krecmer_matej"]);
  });

  it("prefills BACK VOCS of a new band with the singers outside vocs, in lineup order", () => {
    const state = withLineup();

    expect(state.backVocalIds).toEqual(["plasil_pavel", "krecmer_matej"]);
    expect(state.backVocalsTouched).toBe(false);
  });

  it("re-derives BACK VOCS on every lineup change until the user edits them", () => {
    const state = addMembersToGroup(
      withLineup(),
      "drums",
      ["ernst_filip"],
      canSing,
    );

    expect(state.backVocalIds).toEqual([
      "plasil_pavel",
      "ernst_filip",
      "krecmer_matej",
    ]);
  });

  it("stops deriving BACK VOCS after a manual change", () => {
    const edited = removeBackVocal(withLineup(), "plasil_pavel");
    expect(edited.backVocalsTouched).toBe(true);

    const state = addMembersToGroup(edited, "drums", ["nyvlt_jakub"], canSing);

    expect(state.backVocalIds).toEqual(["krecmer_matej"]);
  });

  it("an existing band keeps its stored BACK VOCS when the lineup changes", () => {
    const state = addMembersToGroup(
      bandFormFromBand(BAND_FILE, null),
      "drums",
      ["nyvlt_jakub"],
      canSing,
    );

    expect(state.backVocalIds).toEqual(["plasil_pavel"]);
  });

  it("backVocalCandidates offers instrumentalists outside BACK VOCS, singing or not, never lead vocals", () => {
    const state = silentDrummerAndSinger();

    expect(state.backVocalIds).toEqual([]);
    expect(backVocalCandidates(state)).toEqual(["nyvlt_jakub"]);
  });

  it("addBackVocals adds only candidates and marks BACK VOCS as edited", () => {
    const state = addBackVocals(silentDrummerAndSinger(), [
      "nyvlt_jakub",
      "krecmerova_eliska",
      "ghost",
    ]);

    expect(state.backVocalIds).toEqual(["nyvlt_jakub"]);
    expect(state.backVocalsTouched).toBe(true);
    expect(backVocalCandidates(state)).toEqual([]);
  });

  it("removeMember clears the member from the lineup, the leader and BACK VOCS", () => {
    const state = removeMember(
      setBandLeader(withLineup(), "plasil_pavel"),
      "plasil_pavel",
    );

    expect(state.lineup.drums).toEqual([]);
    expect(state.bandLeaderId).toBe("");
    expect(state.backVocalIds).toEqual(["krecmer_matej"]);
  });

  it("removeMember drops the member from BACK VOCS even after a manual change", () => {
    const state = removeMember(
      removeBackVocal(withLineup(), "plasil_pavel"),
      "krecmer_matej",
    );

    expect(state.backVocalIds).toEqual([]);
  });

  it("removeMember of the contact keeps phone and e-mail but clears the member", () => {
    let state = setContactMember(withLineup(), "krecmer_matej", null);
    state = setContactField(state, "phone", "+420731247870");
    state = removeMember(state, "krecmer_matej");

    expect(state.contact).toEqual({
      mode: "member",
      musicianId: "",
      phone: "+420731247870",
      email: "",
    });
  });

  it("defaultContactMemberId prefers the leader, then the first member", () => {
    expect(defaultContactMemberId(createEmptyBandForm())).toBe("");
    expect(defaultContactMemberId(withLineup())).toBe("plasil_pavel");
    expect(
      defaultContactMemberId(setBandLeader(withLineup(), "krecmer_matej")),
    ).toBe("krecmer_matej");
  });

  it("setContactMember pre-fills from the stored contact and blanks without one", () => {
    const filled = setContactMember(withLineup(), "krecmer_matej", {
      id: "krecmer_matej",
      firstName: "Matěj",
      lastName: "Krečmer",
      email: "m@example.com",
    });

    expect(filled.contact).toEqual({
      mode: "member",
      musicianId: "krecmer_matej",
      phone: "",
      email: "m@example.com",
    });
    expect(setContactMember(filled, "plasil_pavel", null).contact).toEqual({
      mode: "member",
      musicianId: "plasil_pavel",
      phone: "",
      email: "",
    });
  });

  it("setContactField does nothing without a contact; disableContact switches it off", () => {
    const none = createEmptyBandForm();

    expect(setContactField(none, "phone", "1")).toBe(none);
    expect(
      disableContact(setContactMember(withLineup(), "krecmer_matej", null))
        .contact,
    ).toEqual({
      mode: "none",
    });
  });

  it("toBandDraft maps the state and omits a switched-off contact", () => {
    const state = setBandLeader(
      setBandName(withLineup(), "Duo"),
      "krecmer_matej",
    );

    expect(toBandDraft(state, null)).toEqual({
      name: "Duo",
      code: "DUO",
      bandLeaderId: "krecmer_matej",
      lineup: state.lineup,
      backVocalIds: ["plasil_pavel", "krecmer_matej"],
    });
    expect(toBandDraft(state, "duo")).toMatchObject({ existingId: "duo" });
  });

  it("a draft with a removed contact fails in the domain instead of writing it", () => {
    let state = setBandLeader(setBandName(withLineup(), "Duo"), "plasil_pavel");
    state = setContactField(
      setContactMember(state, "krecmer_matej", null),
      "phone",
      "+420731247870",
    );
    state = removeMember(state, "krecmer_matej");

    const result = buildBandFromDraft(
      toBandDraft(state, null),
      buildBandDraftContext({ musicians: MUSICIANS, presets: [], bands: [] }),
    );

    expect(result.ok ? [] : result.errors.map((error) => error.field)).toEqual([
      "contact",
    ]);
  });

  it("an unchanged existing band rebuilds its stored overlays", () => {
    const stored: Band = { ...BAND_FILE, defaultContactId: undefined };

    const result = buildBandFromDraft(
      toBandDraft(bandFormFromBand(stored, null), stored.id),
      buildBandDraftContext({
        musicians: MUSICIANS,
        presets: [],
        bands: [],
        existingBand: stored,
      }),
    );

    expect(result.ok ? result.band.defaultOverlays : result.errors).toEqual(
      BAND_FILE.defaultOverlays,
    );
  });

  it("availableMusiciansForGroup offers the group's musicians outside the lineup, by name", () => {
    const state = withLineup();

    expect(
      availableMusiciansForGroup(MUSICIANS, "drums", state).map(
        (item) => item.id,
      ),
    ).toEqual(["ernst_filip", "nyvlt_jakub"]);
    expect(availableMusiciansForGroup(MUSICIANS, "bass", state)).toEqual([]);
  });
});
```

Proti BASE: zmizel test „pre-checks an added vocalist as lead vocals and toggles them" (A1 ruší zaškrtávátka), přibylo osm testů (předvyplnění, přepočet, zastavení, existující kapela, kandidáti, `addBackVocals`, `removeMember` po ruční změně, kulatý průchod z Review Focus 5); tři testy se upravily (`bandFormFromBand…`, `removeMember clears…`, `toBandDraft…`). 20 testů, o 7 víc.

Run: `npx vitest run packages/desktop/src/app/domain/band/bandFormModel.test.ts`
Expected: FAIL (`backVocalCandidates`, `addBackVocals`, `removeBackVocal` neexistují; `backVocalIds` je `undefined`).

- [ ] **Step 6: Přepiš `bandFormModel.ts`**

Celý `packages/desktop/src/app/domain/band/bandFormModel.ts`:

```ts
import { deriveBandCode } from "../../../../../../src/domain/band/bandCode";
import type { BandDraft } from "../../../../../../src/domain/band/buildBandFromDraft";
import {
  LINEUP_ASSIGNMENT_ROLES,
  type LineupRole,
  normalizeLineupAssignments,
} from "../../../../../../src/domain/lineup/lineupAssignments";
import type {
  Band,
  Contact,
  Musician,
} from "../../../../../../src/domain/model/types";
import { deriveVocalOverlaysFromLineup } from "../../../../../../src/domain/project/deriveVocalOverlaysFromLineup";
import { resolveMusicianDisplayName } from "../ui/musicianDisplayName";

// Co? Stav formuláře kapely a jeho přechody jako čisté funkce.
// Proč tady? Repo nemá jsdom; každé rozhodnutí formuláře (dopočet zkratky,
// předvyplnění BACK VOCS, odebrání člena, výchozí kontakt) musí být
// testovatelné bez Reactu.

export type BandFormContact =
  | { readonly mode: "none" }
  | {
      readonly mode: "member";
      readonly musicianId: string;
      readonly phone: string;
      readonly email: string;
    };

export type BandFormState = {
  readonly name: string;
  readonly code: string;
  /** `false` = zkratka se dopočítává z názvu (R5). */
  readonly codeTouched: boolean;
  /** Skupina `vocs` je LEAD VOCS (dodatek A1). */
  readonly lineup: Readonly<Record<LineupRole, readonly string[]>>;
  readonly bandLeaderId: string;
  /** BACK VOCS (dodatek A2): instrumentalisté sestavy, ne skupina. */
  readonly backVocalIds: readonly string[];
  /** `false` = BACK VOCS se dopočítávají ze sestavy přes `canSing` (A2, Ruling 3). */
  readonly backVocalsTouched: boolean;
  readonly contact: BandFormContact;
};

export type BandFormUpdate = (
  update: (state: BandFormState) => BandFormState,
) => void;

/** Kdo umí zpívat; stránka ho bere z `BandDraftContext.canSing` (Ruling 16). */
export type CanSing = (musicianId: string) => boolean;

type FormLineup = BandFormState["lineup"];

/** A2: BACK VOCS nabízí jen instrumentalisty; `vocs` jsou LEAD VOCS (A1). */
const BACK_VOCAL_ROLES: readonly LineupRole[] = [
  "drums",
  "bass",
  "guitar",
  "keys",
];

const EMPTY_LINEUP: FormLineup = {
  drums: [],
  bass: [],
  guitar: [],
  keys: [],
  vocs: [],
};

export function createEmptyBandForm(): BandFormState {
  return {
    name: "",
    code: "",
    codeTouched: false,
    lineup: EMPTY_LINEUP,
    bandLeaderId: "",
    backVocalIds: [],
    backVocalsTouched: false,
    contact: { mode: "none" },
  };
}

/**
 * Ruling 13 + dodatek A2: uložená zkratka i BACK VOCS se berou jako ruční,
 * nic se nepřepočítává. Reálné soubory nesou jen `bandLeaderId`.
 */
export function bandFormFromBand(
  band: Band,
  contact: Contact | null,
): BandFormState {
  const contactId = band.defaultContactId?.trim() ?? "";
  return {
    name: band.name,
    code: band.code ?? "",
    codeTouched: true,
    lineup: normalizeLineupAssignments(band.defaultLineup),
    bandLeaderId:
      (band.bandLeader ?? "").trim() || (band.bandLeaderId ?? "").trim(),
    backVocalIds: [...(band.defaultOverlays?.backVocals ?? [])],
    backVocalsTouched: true,
    contact: contactId
      ? {
          mode: "member",
          musicianId: contactId,
          phone: contact?.phone ?? "",
          email: contact?.email ?? "",
        }
      : { mode: "none" },
  };
}

/** Porovnávací otisk pro navigační guard (neuložené změny). */
export function serializeBandForm(state: BandFormState): string {
  return JSON.stringify(state);
}

export function lineupMemberIds(state: BandFormState): string[] {
  return LINEUP_ASSIGNMENT_ROLES.flatMap((role) => [...state.lineup[role]]);
}

/** Ruling 19: `Příjmení Jméno`, jako `MemberOption` z Rustu na `01 LINEUP`. */
export function musicianLabel(musician: Musician): string {
  return resolveMusicianDisplayName({
    musicianId: musician.id,
    preferredName: `${musician.lastName ?? ""} ${musician.firstName ?? ""}`,
  });
}

/** R6: nabízí jen muzikanty dané skupiny, kteří ještě nejsou v sestavě. */
export function availableMusiciansForGroup(
  musicians: readonly Musician[],
  role: LineupRole,
  state: BandFormState,
): Musician[] {
  const present = new Set(lineupMemberIds(state));
  return musicians
    .filter((musician) => musician.group === role && !present.has(musician.id))
    .sort((left, right) =>
      musicianLabel(left).localeCompare(musicianLabel(right)),
    );
}

export function setBandName(state: BandFormState, name: string): BandFormState {
  return {
    ...state,
    name,
    code: state.codeTouched ? state.code : deriveBandCode(name),
  };
}

export function setBandCode(state: BandFormState, code: string): BandFormState {
  return { ...state, code, codeTouched: true };
}

/** A2: předvyplnění BACK VOCS — zpívající členové mimo `vocs`, v pořadí sestavy. */
function deriveBackVocals(lineup: FormLineup, canSing: CanSing): string[] {
  const { backVocalIds } = deriveVocalOverlaysFromLineup({
    lineupMusicianIds: LINEUP_ASSIGNMENT_ROLES.flatMap((role) => [
      ...lineup[role],
    ]),
    leadVocalIds: lineup.vocs,
    canSing,
  });
  return [...backVocalIds];
}

/** Ruling 3: dokud uživatel BACK VOCS nezměnil, přepočítají se z nové sestavy. */
export function addMembersToGroup(
  state: BandFormState,
  role: LineupRole,
  musicianIds: readonly string[],
  canSing: CanSing,
): BandFormState {
  const present = new Set(lineupMemberIds(state));
  const added = [...new Set(musicianIds)].filter(
    (musicianId) => !present.has(musicianId),
  );
  if (added.length === 0) return state;
  const lineup: FormLineup = {
    ...state.lineup,
    [role]: [...state.lineup[role], ...added],
  };
  return {
    ...state,
    lineup,
    backVocalIds: state.backVocalsTouched
      ? state.backVocalIds
      : deriveBackVocals(lineup, canSing),
  };
}

/**
 * R12 + A2: odebraný člen mizí z kapelníka i BACK VOCS; kontakt si nechá
 * telefon a e-mail. Bez `canSing`: u nedotčených BACK VOCS je odfiltrování
 * totéž co přepočet (Ruling 3).
 */
export function removeMember(
  state: BandFormState,
  musicianId: string,
): BandFormState {
  const without = (ids: readonly string[]) =>
    ids.filter((id) => id !== musicianId);
  const contact = state.contact;
  return {
    ...state,
    lineup: {
      drums: without(state.lineup.drums),
      bass: without(state.lineup.bass),
      guitar: without(state.lineup.guitar),
      keys: without(state.lineup.keys),
      vocs: without(state.lineup.vocs),
    },
    bandLeaderId: state.bandLeaderId === musicianId ? "" : state.bandLeaderId,
    backVocalIds: without(state.backVocalIds),
    contact:
      contact.mode === "member" && contact.musicianId === musicianId
        ? { ...contact, musicianId: "" }
        : contact,
  };
}

/** A2: kandidáti BACK VOCS — členové `drums | bass | guitar | keys` mimo BACK VOCS. */
export function backVocalCandidates(state: BandFormState): string[] {
  const selected = new Set(state.backVocalIds);
  return BACK_VOCAL_ROLES.flatMap((role) =>
    state.lineup[role].filter((musicianId) => !selected.has(musicianId)),
  );
}

/** A2: ruční přidání; bere jen kandidáty a zastaví předvyplňování. */
export function addBackVocals(
  state: BandFormState,
  musicianIds: readonly string[],
): BandFormState {
  const candidates = new Set(backVocalCandidates(state));
  const added = [...new Set(musicianIds)].filter((musicianId) =>
    candidates.has(musicianId),
  );
  return {
    ...state,
    backVocalIds: [...state.backVocalIds, ...added],
    backVocalsTouched: true,
  };
}

/** A2: ruční odebrání; zastaví předvyplňování. */
export function removeBackVocal(
  state: BandFormState,
  musicianId: string,
): BandFormState {
  return {
    ...state,
    backVocalIds: state.backVocalIds.filter((id) => id !== musicianId),
    backVocalsTouched: true,
  };
}

export function setBandLeader(
  state: BandFormState,
  musicianId: string,
): BandFormState {
  return { ...state, bandLeaderId: musicianId };
}

/** R2: výchozí kontaktní osoba je kapelník, pokud je v sestavě; jinak první člen. */
export function defaultContactMemberId(state: BandFormState): string {
  const members = lineupMemberIds(state);
  if (state.bandLeaderId && members.includes(state.bandLeaderId))
    return state.bandLeaderId;
  return members[0] ?? "";
}

export function disableContact(state: BandFormState): BandFormState {
  return { ...state, contact: { mode: "none" } };
}

/** R12 blok 4: výběr člena předvyplní existující `contacts/<id>.json`, pokud je. */
export function setContactMember(
  state: BandFormState,
  musicianId: string,
  existing: Contact | null,
): BandFormState {
  return {
    ...state,
    contact: {
      mode: "member",
      musicianId,
      phone: existing?.phone ?? "",
      email: existing?.email ?? "",
    },
  };
}

export function setContactField(
  state: BandFormState,
  field: "phone" | "email",
  value: string,
): BandFormState {
  const contact = state.contact;
  if (contact.mode !== "member") return state;
  return {
    ...state,
    contact:
      field === "phone"
        ? { ...contact, phone: value }
        : { ...contact, email: value },
  };
}

export function toBandDraft(
  state: BandFormState,
  existingId: string | null,
): BandDraft {
  const contact = state.contact;
  return {
    name: state.name,
    code: state.code,
    ...(state.bandLeaderId ? { bandLeaderId: state.bandLeaderId } : {}),
    lineup: state.lineup,
    backVocalIds: state.backVocalIds,
    ...(contact.mode === "member"
      ? {
          contact: {
            musicianId: contact.musicianId,
            phone: contact.phone,
            email: contact.email,
          },
        }
      : {}),
    ...(existingId ? { existingId } : {}),
  };
}
```

Proti BASE: stav má `backVocalIds` + `backVocalsTouched` místo `leadVocalIds`; `addMembersToGroup` má parametr `canSing` a nepřidává do lead; `removeMember` filtruje BACK VOCS; přibyly `CanSing`, `backVocalCandidates`, `addBackVocals`, `removeBackVocal`; `toggleLeadVocal` zanikl; `toBandDraft` posílá `backVocalIds`.

Run: `npx vitest run packages/desktop/src/app/domain/band/bandFormModel.test.ts`
Expected: PASS, 20 testů.

- [ ] **Step 7: Roles bez zaškrtávátek (A1)**

Celý `packages/desktop/src/app/components/band/BandRolesSection.tsx`:

```tsx
import type { BandDraftError } from "../../../../../../src/domain/band/buildBandFromDraft";
import type { Musician } from "../../../../../../src/domain/model/types";
import {
  type BandFormState,
  type BandFormUpdate,
  lineupMemberIds,
  musicianLabel,
  setBandLeader,
} from "../../domain/band/bandFormModel";
import { FieldErrors, hasFieldError } from "./FieldErrors";

/**
 * R7: kapelník jen ze sestavy. Vokály tu nejsou — LEAD VOCS a BACK VOCS jsou
 * řádky sestavy (dodatek A1, A2).
 */
export function BandRolesSection({
  form,
  musicians,
  errors,
  onChange,
}: {
  form: BandFormState;
  musicians: readonly Musician[];
  errors: readonly BandDraftError[];
  onChange: BandFormUpdate;
}) {
  const members = lineupMemberIds(form);
  const byId = new Map(musicians.map((musician) => [musician.id, musician]));
  const labelOf = (musicianId: string) => {
    const musician = byId.get(musicianId);
    return musician ? musicianLabel(musician) : musicianId;
  };

  return (
    <section className="lineup-card" aria-labelledby="band-roles-heading">
      <h3 id="band-roles-heading">Roles</h3>
      {members.length === 0 ? (
        <p className="subtle">
          Add musicians to the lineup to choose the band leader.
        </p>
      ) : (
        <div className="form-grid">
          <label>
            Band leader *
            <select
              value={form.bandLeaderId}
              aria-invalid={hasFieldError(errors, "bandLeader")}
              onChange={(event) => {
                const value = event.target.value;
                onChange((state) => setBandLeader(state, value));
              }}
            >
              <option value="">Select band leader</option>
              {members.map((musicianId) => (
                <option key={musicianId} value={musicianId}>
                  {labelOf(musicianId)}
                </option>
              ))}
            </select>
            <FieldErrors errors={errors} field="bandLeader" />
          </label>
        </div>
      )}
    </section>
  );
}
```

Třída `.band-form__checks` (`library.css:42-48`) **zůstává** — dál ji používá `BandContactSection.tsx:43`.

- [ ] **Step 8: `canSing` do `BandLineupSection` a ze stránky**

V `packages/desktop/src/app/components/band/BandLineupSection.tsx`:

1. V importu z `../../domain/band/bandFormModel` přidej `type CanSing,` za `type BandFormUpdate,`.
2. `BandLineupSection` — destrukturace a typ props:

```tsx
export function BandLineupSection({
  form,
  musicians,
  errors,
  canSing,
  onChange,
}: {
  form: BandFormState;
  musicians: readonly Musician[];
  errors: readonly BandDraftError[];
  canSing: CanSing;
  onChange: BandFormUpdate;
}) {
```

3. V `<GroupRow … />` přidej prop `canSing={canSing}` (za `labelOf={labelOf}`).
4. `GroupRow` — přidej `canSing` do destrukturace i typu (`canSing: CanSing;`) a `onAddSelected` změň na:

```tsx
          onAddSelected={(ids) =>
            onChange((state) => addMembersToGroup(state, role, ids, canSing))
          }
```

V `packages/desktop/src/app/components/band/BandLineupSection.test.tsx`:

1. Import z `../../domain/band/bandFormModel` rozšiř o `type CanSing,`.
2. Pod `MUSICIANS` přidej:

```tsx
/** Zpívá jen bubeník: BACK VOCS nové kapely = [Plašil]. */
const canSing: CanSing = (musicianId) => musicianId === "plasil_pavel";
```

3. V `lineupForm()` přidej `canSing` jako čtvrtý argument všem třem voláním `addMembersToGroup`.
4. V `renderSection` přidej prop `canSing={canSing}` k `<BandLineupSection … />`.

V `packages/desktop/src/app/pages/LibraryBandFormPage.tsx`:

1. Import z `../domain/band/bandFormModel` (ř. 12-19) rozšiř o `type CanSing,` (za `type BandFormState,`).
2. Pod `type Notify = …` (ř. 44) přidej:

```tsx
/** Ruling 16: jen pro typ — formulář se bez načteného kontextu nevykresluje. */
const cannotSing: CanSing = () => false;
```

3. `<BandLineupSection … />` (ř. 132-137) dostane prop:

```tsx
        canSing={context ? context.canSing : cannotSing}
```

V `packages/desktop/src/app/services/bandsApi.test.ts:38` nahraď `leadVocalIds: [],` za `backVocalIds: [],`.

- [ ] **Step 9: Ověř, že po `leadVocalIds` nezůstala stopa**

Run: `grep -rn "leadVocalIds\|toggleLeadVocal\|\"leadVocals\"" src/domain/band packages/desktop/src/app/domain/band packages/desktop/src/app/components/band packages/desktop/src/app/pages/LibraryBandFormPage.tsx packages/desktop/src/app/services/bandsApi.ts packages/desktop/src/app/services/bandsApi.test.ts`
Expected: žádný výstup. (`leadVocalIds` jinde v repu — `applyDerivedVocalOverlays.ts`, `ProjectSetupPage.tsx`, `deriveVocalOverlaysFromLineup.ts` — patří projektům a zůstává.)

- [ ] **Step 10: Typová kontrola a build**

Run: `npx tsc -p packages/desktop/tsconfig.json --noEmit 2>&1 | grep "error TS"`
Expected: přesně 14 baseline chyb.

Run: `npx tsc --noEmit` → 0 chyb.

Run (v `packages/desktop`): `npx vite build` → `✓ built`.

- [ ] **Step 11: Plná sada**

Run: `npm test`
Expected: 179 souborů, **1366 zelených**, 2 baseline padající.

- [ ] **Step 12: Lint dotčených souborů**

Recept LF kopie HEAD vs BASE `b6b531c` pro všech deset upravených souborů z hlavičky tasku → žádný nový nález. (`BandLineupSection.test.tsx` je od Tasku 2 nový; porovnej ho s jeho stavem po Tasku 2: `git show HEAD:<soubor>` místo `b6b531c`.)

- [ ] **Step 13: Commit**

```bash
git add src/domain/band/buildBandFromDraft.ts src/domain/band/buildBandFromDraft.test.ts src/domain/band/buildBandDraftContext.test.ts packages/desktop/src/app/domain/band/bandFormModel.ts packages/desktop/src/app/domain/band/bandFormModel.test.ts packages/desktop/src/app/components/band/BandRolesSection.tsx packages/desktop/src/app/components/band/BandLineupSection.tsx packages/desktop/src/app/components/band/BandLineupSection.test.tsx packages/desktop/src/app/pages/LibraryBandFormPage.tsx packages/desktop/src/app/services/bandsApi.test.ts
git commit -m "feat(band): take lead vocals from the vocs group and keep back vocals as chosen"
```

---

### Task 4: Řádky LEAD VOCS a BACK VOCS v `BandLineupSection`

Dodatek A1 (řádek `vocs` se jmenuje LEAD VOCS) a A2 (řádek BACK VOCS pod ním, ovládání jako u skupin). Rulings 4, 17.

**Files:**
- Modify: `packages/desktop/src/app/components/band/BandLineupSection.tsx`
- Modify: `packages/desktop/src/app/components/band/BandLineupSection.test.tsx`

**Interfaces:**
- Consumes: z Tasku 2 `GroupRow`, `removableNames`, `LabelOf`; z Tasku 3 `CanSing`, `backVocalCandidates(state): string[]`, `addBackVocals(state, ids)`, `removeBackVocal(state, id)`, `BandDraftField` `"backVocals"`.
- Produces: nic nového navenek; props `BandLineupSection` beze změny proti Tasku 3.

- [ ] **Step 1: Napiš padající testy**

V `packages/desktop/src/app/components/band/BandLineupSection.test.tsx`:

1. V testu „puts each member's Remove button on the member's own name line" změň očekávaný počet `>Remove<` z `3` na `4` (Plašil je i v BACK VOCS).
2. V testu „keeps only the add control in the actions column of every row" změň `toHaveLength(5)` na `toHaveLength(6)` (šestý řádek BACK VOCS).
3. Na konec `describe` přidej:

```tsx
  it("labels the vocs group LEAD VOCS and offers Add lead vocs", () => {
    const html = renderSection(lineupForm());

    expect(html).toContain('<span class="lineup-row__role">LEAD VOCS</span>');
    expect(html).toContain("<span>Add lead vocs</span>");
    expect(html).not.toContain('<span class="lineup-row__role">VOCS</span>');
  });

  it("shows BACK VOCS right below LEAD VOCS with Remove next to each back vocalist", () => {
    const html = renderSection(lineupForm());

    expect(html.indexOf(">BACK VOCS<")).toBeGreaterThan(
      html.indexOf(">LEAD VOCS<"),
    );
    expect(html.match(/aria-label="Remove Plašil Pavel"/g)?.length).toBe(2);
    expect(html).toContain('id="band-add-back-vocs"');
    expect(html).toContain("<span>Add back vocs</span>");
  });

  it("shows an empty BACK VOCS row when nobody in the lineup sings", () => {
    const state = addMembersToGroup(
      createEmptyBandForm(),
      "bass",
      ["krecmer_matej"],
      () => false,
    );

    expect(renderSection(state)).toContain("No back vocals");
  });
```

Proč tato data: `canSing` v testu pustí jen Plašila, takže BACK VOCS nové kapely = `[plasil_pavel]` a kandidát zbývá Krečmer → spouštěč ukáže placeholder „Add back vocs" (bez kandidátů by ukázal „All musicians assigned", `AddMusiciansMultiSelect.tsx:131`). Holoubek ve `MUSICIANS` drží neprázdnou nabídku pro „Add lead vocs".

Run: `npx vitest run packages/desktop/src/app/components/band/BandLineupSection.test.tsx`
Expected: FAIL u všech 5 testů — dnes chybí řádek BACK VOCS (proto 3 Remove a 5 sloupců místo 4 a 6) i popisek LEAD VOCS.

- [ ] **Step 2: Implementuj řádky**

V `packages/desktop/src/app/components/band/BandLineupSection.tsx`:

1. Import z `../../domain/band/bandFormModel` doplň na:

```tsx
import {
  type BandFormState,
  type BandFormUpdate,
  type CanSing,
  addBackVocals,
  addMembersToGroup,
  availableMusiciansForGroup,
  backVocalCandidates,
  musicianLabel,
  removeBackVocal,
  removeMember,
} from "../../domain/band/bandFormModel";
```

2. Pod `type LabelOf = …` přidej:

```tsx
/** A1: skupina `vocs` je v editoru kapely LEAD VOCS. */
function groupLabel(role: LineupRole): string {
  return role === "vocs" ? "LEAD VOCS" : getRoleDisplayName(role);
}
```

3. V `GroupRow` nahraď `const label = getRoleDisplayName(role);` za `const label = groupLabel(role);`.

4. V `BandLineupSection` doplň za mapu `GroupRow` uvnitř `<div className="lineup-rows">` řádek BACK VOCS a pod chyby sestavy chyby BACK VOCS — výsledný blok:

```tsx
        <div className="lineup-rows">
          {LINEUP_ASSIGNMENT_ROLES.map((role) => (
            <GroupRow
              key={role}
              role={role}
              form={form}
              musicians={musicians}
              labelOf={labelOf}
              canSing={canSing}
              onChange={onChange}
            />
          ))}
          <BackVocsRow form={form} labelOf={labelOf} onChange={onChange} />
        </div>
      )}
      <FieldErrors errors={errors} field="lineup" />
      <FieldErrors errors={errors} field="backVocals" />
```

`LINEUP_ASSIGNMENT_ROLES` končí `vocs` (`src/domain/lineup/lineupAssignments.ts:1-7`), takže BACK VOCS je hned pod LEAD VOCS.

5. Na konec souboru přidej:

```tsx
/**
 * A2: BACK VOCS nejsou skupina sestavy — výběr nad instrumentalisty sestavy.
 * Ruční přidání i odebrání zastaví předvyplňování (Ruling 3).
 */
function BackVocsRow({
  form,
  labelOf,
  onChange,
}: {
  form: BandFormState;
  labelOf: LabelOf;
  onChange: BandFormUpdate;
}) {
  const [pending, setPending] = useState<string[]>([]);
  return (
    <LineupRow
      roleLabel="BACK VOCS"
      names={removableNames(form.backVocalIds, labelOf, (musicianId) =>
        onChange((state) => removeBackVocal(state, musicianId)),
      )}
      emptyLabel="No back vocals"
      actions={
        <AddMusiciansMultiSelect
          id="band-add-back-vocs"
          options={backVocalCandidates(form).map((musicianId) => ({
            id: musicianId,
            name: labelOf(musicianId),
          }))}
          selectedIds={pending}
          placeholder="Add back vocs"
          onSelectionChange={setPending}
          onAddSelected={(ids) =>
            onChange((state) => addBackVocals(state, ids))
          }
        />
      }
    />
  );
}
```

Run: `npx vitest run packages/desktop/src/app/components/band/BandLineupSection.test.tsx`
Expected: PASS, 5 testů.

- [ ] **Step 3: Typová kontrola a build**

Run: `npx tsc -p packages/desktop/tsconfig.json --noEmit 2>&1 | grep "error TS"` → přesně 14 baseline chyb.
Run: `npx tsc --noEmit` → 0 chyb.
Run (v `packages/desktop`): `npx vite build` → `✓ built`.

- [ ] **Step 4: Plná sada**

Run: `npm test`
Expected: 179 souborů, **1369 zelených**, 2 baseline padající.

- [ ] **Step 5: Lint**

Recept LF kopie pro oba soubory, porovnej proti `git show HEAD:<soubor>` (stav po Tasku 3) → žádný nový nález.

- [ ] **Step 6: Commit**

```bash
git add packages/desktop/src/app/components/band/BandLineupSection.tsx packages/desktop/src/app/components/band/BandLineupSection.test.tsx
git commit -m "feat(library): show LEAD VOCS and BACK VOCS rows in the band lineup"
```

---

## KROK C — mazání kapely

### Task 5: Rust `delete_band`

Dodatek A3 (Rust strana), Rulings 7–10. Čistá funkce `delete_band_at` nad dvěma adresáři + tenký příkaz.

**Files:**
- Modify: `packages/desktop/src-tauri/src/lib.rs`
  - za `write_contact_at` (ř. 393-398): typy `BandUsage`, `DeleteBandError` a funkce `band_ref_matches`, `file_label`, `project_json_files`, `find_band_usages_at`, `delete_band_at`
  - za příkaz `write_contact` (ř. 1199-1202): příkaz `delete_band`
  - `tauri::generate_handler![…]` (ř. 1840-1867): `delete_band` za `write_contact`
  - modul `tests` (ř. 1872-2044): import a 9 testů

**Interfaces:**
- Consumes: `ensure_safe_entity_id` (`lib.rs:343-349`), `read_json_file` (`:289-294`), `catalog_entity_dir` (`:545-547`), `storage_projects_dir` (`:14`), `map_storage_error` (`:231-252`), `ApiError` (`:20-26`).
- Produces: Tauri příkaz `delete_band(bandId: string)`; při chybě JSON `{ code, message, projects }`, kde `code ∈ { "BAND_IN_USE", "BAND_DELETE_FAILED" }` (a výjimečně kód z `catalog_entity_dir` převedený na `BAND_DELETE_FAILED`) a `projects` je pole `{ kind: "usesBand", file, displayName: string | null, status: string | null }` nebo `{ kind: "unreadable", file, message }`. Tenhle tvar čte Task 6.

- [ ] **Step 1: Napiš padající testy**

V `packages/desktop/src-tauri/src/lib.rs`, modul `tests`, rozšiř import `use super::{ … }` (ř. 1874-1877) na:

```rust
    use super::{
        delete_band_at, list_catalog_musicians_at, load_preset_catalog_at,
        parse_node_export_response, read_catalog_entity_at, resolve_workspace_root,
        write_band_at, write_contact_at, BandUsage,
    };
```

a na konec modulu (před závěrečnou `}`) přidej:

```rust
    const BLANICKA_JSON: &str =
        "{\"id\":\"blanicka_kapela\",\"code\":\"BK\",\"name\":\"Blanická kapela\"}";

    /// `bands/` with Blanická kapela and an empty `projects/` under one temp root.
    fn band_storage(name: &str) -> (PathBuf, PathBuf, PathBuf) {
        let root = temp_test_dir(name);
        let bands = root.join("bands");
        let projects = root.join("projects");
        fs::create_dir_all(&bands).expect("bands dir");
        fs::create_dir_all(&projects).expect("projects dir");
        fs::write(bands.join("blanicka_kapela.json"), BLANICKA_JSON).expect("seed band");
        (root, bands, projects)
    }

    #[test]
    fn delete_band_removes_the_file_when_no_project_uses_it() {
        let (root, bands, projects) = band_storage("delete-free");
        fs::write(bands.join("big_night_band.json"), BNB_JSON).expect("seed other band");
        fs::write(
            projects.join("BNB_Bon_Repos.json"),
            "{\"id\":\"p1\",\"bandRef\":\"big_night_band\"}",
        )
        .expect("seed project");
        delete_band_at(&bands, &projects, "blanicka_kapela").expect("delete");
        assert!(!bands.join("blanicka_kapela.json").exists());
        assert!(bands.join("big_night_band.json").exists());
        assert!(projects.join("BNB_Bon_Repos.json").exists());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn delete_band_is_blocked_by_a_project_and_keeps_the_file() {
        let (root, bands, projects) = band_storage("delete-in-use");
        fs::write(
            projects.join("BK_Konopiste.json"),
            "{\"id\":\"p1\",\"displayName\":\"Blanická kapela – Konopiště\",\"status\":\"archived\",\"bandRef\":\"blanicka_kapela\"}",
        )
        .expect("seed project");
        let err = delete_band_at(&bands, &projects, "blanicka_kapela").expect_err("in use");
        assert_eq!(err.code, "BAND_IN_USE");
        assert_eq!(
            err.projects,
            vec![BandUsage::UsesBand {
                file: "BK_Konopiste.json".into(),
                display_name: Some("Blanická kapela – Konopiště".into()),
                status: Some("archived".into()),
            }]
        );
        assert!(bands.join("blanicka_kapela.json").exists());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn delete_band_is_blocked_by_a_project_that_names_the_band_by_its_code() {
        let (root, bands, projects) = band_storage("delete-by-code");
        fs::write(projects.join("by_code.json"), "{\"id\":\"p1\",\"bandRef\":\"bk\"}")
            .expect("seed code ref");
        fs::write(
            projects.join("by_upper_id.json"),
            "{\"id\":\"p2\",\"bandRef\":\"BLANICKA_KAPELA\"}",
        )
        .expect("seed upper-case ref");
        let err = delete_band_at(&bands, &projects, "blanicka_kapela").expect_err("in use");
        assert_eq!(err.code, "BAND_IN_USE");
        assert_eq!(err.projects.len(), 2, "{:?}", err.projects);
        assert!(bands.join("blanicka_kapela.json").exists());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn delete_band_is_blocked_by_an_unreadable_project_file() {
        let (root, bands, projects) = band_storage("delete-unreadable");
        fs::write(projects.join("broken.json"), "{oops").expect("seed broken");
        let err = delete_band_at(&bands, &projects, "blanicka_kapela").expect_err("unverifiable");
        assert_eq!(err.code, "BAND_IN_USE");
        assert!(
            matches!(&err.projects[..], [BandUsage::Unreadable { file, .. }] if file == "broken.json"),
            "{:?}",
            err.projects
        );
        assert!(bands.join("blanicka_kapela.json").exists());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn delete_band_rejects_ids_that_are_not_safe_file_names() {
        let (root, bands, projects) = band_storage("delete-unsafe");
        for id in ["Big Night", "../evil", "", ".hidden"] {
            let err = delete_band_at(&bands, &projects, id).expect_err(id);
            assert_eq!(err.code, "BAND_DELETE_FAILED", "{}", id);
        }
        assert!(bands.join("blanicka_kapela.json").exists());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn delete_band_succeeds_without_a_projects_folder() {
        let (root, bands, projects) = band_storage("delete-no-projects");
        fs::remove_dir_all(&projects).expect("drop projects dir");
        delete_band_at(&bands, &projects, "blanicka_kapela").expect("delete");
        assert!(!bands.join("blanicka_kapela.json").exists());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn delete_band_ignores_files_that_are_not_json() {
        let (root, bands, projects) = band_storage("delete-not-json");
        fs::write(
            projects.join("BK_Konopiste.tmp"),
            "{\"bandRef\":\"blanicka_kapela\"}",
        )
        .expect("seed tmp");
        delete_band_at(&bands, &projects, "blanicka_kapela").expect("delete");
        assert!(!bands.join("blanicka_kapela.json").exists());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn delete_band_reports_a_missing_band_file() {
        let (root, bands, projects) = band_storage("delete-missing");
        let err = delete_band_at(&bands, &projects, "big_night_band").expect_err("missing");
        assert_eq!(err.code, "BAND_DELETE_FAILED");
        assert!(err.message.contains("big_night_band.json"), "{}", err.message);
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn band_usage_serializes_in_the_shape_bands_api_reads() {
        let uses = serde_json::to_value(BandUsage::UsesBand {
            file: "a.json".into(),
            display_name: Some("A".into()),
            status: None,
        })
        .expect("serialize");
        assert_eq!(
            uses,
            serde_json::json!({ "kind": "usesBand", "file": "a.json", "displayName": "A", "status": null })
        );
        let unreadable = serde_json::to_value(BandUsage::Unreadable {
            file: "b.json".into(),
            message: "bad".into(),
        })
        .expect("serialize");
        assert_eq!(
            unreadable,
            serde_json::json!({ "kind": "unreadable", "file": "b.json", "message": "bad" })
        );
    }
```

- [ ] **Step 2: Spusť — musí selhat překlad**

Run (v `packages/desktop/src-tauri`): `cargo test delete_band`
Expected: chyba překladu `unresolved imports super::delete_band_at, super::BandUsage`.

- [ ] **Step 3: Implementuj typy a čistou funkci**

V `packages/desktop/src-tauri/src/lib.rs` vlož hned za funkci `write_contact_at` (končí na ř. 398):

```rust
/// One project that keeps a band from being deleted (band editor amendment A3).
/// `kind` and the camelCase keys are the contract `bandDeletion.ts` parses.
#[derive(Debug, PartialEq, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
enum BandUsage {
    #[serde(rename_all = "camelCase")]
    UsesBand {
        file: String,
        display_name: Option<String>,
        status: Option<String>,
    },
    /// A project file that cannot be read or parsed cannot be checked, so it blocks.
    #[serde(rename_all = "camelCase")]
    Unreadable { file: String, message: String },
}

/// `delete_band` error: the `ApiError` code and message plus the projects that
/// block the deletion. Its own type, because `ApiError` is built as a struct
/// literal in dozens of places.
#[derive(Debug, Serialize)]
struct DeleteBandError {
    code: String,
    message: String,
    projects: Vec<BandUsage>,
}

impl DeleteBandError {
    fn failed(message: String) -> Self {
        DeleteBandError {
            code: "BAND_DELETE_FAILED".into(),
            message,
            projects: Vec::new(),
        }
    }
}

impl From<ApiError> for DeleteBandError {
    fn from(err: ApiError) -> Self {
        DeleteBandError {
            code: err.code,
            message: err.message,
            projects: Vec::new(),
        }
    }
}

/// `catalogRepository.getBand` resolves a `bandRef` by id and by lower-cased
/// id or code, so a project uses the band under any of them.
fn band_ref_matches(band_ref: &str, band_id: &str, band_code: Option<&str>) -> bool {
    let band_ref = band_ref.trim();
    if band_ref.is_empty() {
        return false;
    }
    band_ref.eq_ignore_ascii_case(band_id)
        || matches!(band_code, Some(code) if !code.is_empty() && band_ref.eq_ignore_ascii_case(code))
}

fn file_label(path: &Path) -> String {
    path.file_name()
        .and_then(|name| name.to_str())
        .unwrap_or_default()
        .to_string()
}

/// `*.json` files directly in `projects/`, sorted. A missing folder means no
/// projects yet (fresh install), not an error.
fn project_json_files(projects_dir: &Path) -> Result<Vec<PathBuf>, DeleteBandError> {
    if !projects_dir.exists() {
        return Ok(Vec::new());
    }
    let list_failed = |err: std::io::Error| {
        DeleteBandError::failed(format!(
            "Failed to list projects in {} ({})",
            projects_dir.display(),
            err
        ))
    };
    let mut files = Vec::new();
    for entry in fs::read_dir(projects_dir).map_err(list_failed)? {
        let path = entry.map_err(list_failed)?.path();
        if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("json") {
            files.push(path);
        }
    }
    files.sort();
    Ok(files)
}

/// Projects whose `bandRef` resolves to the band. A file that cannot be read
/// or parsed is reported as `Unreadable` and blocks (amendment A3).
fn find_band_usages_at(
    projects_dir: &Path,
    band_id: &str,
    band_code: Option<&str>,
) -> Result<Vec<BandUsage>, DeleteBandError> {
    let mut usages = Vec::new();
    for path in project_json_files(projects_dir)? {
        let file = file_label(&path);
        let parsed = fs::read_to_string(&path)
            .map_err(|err| err.to_string())
            .and_then(|text| serde_json::from_str::<Value>(&text).map_err(|err| err.to_string()));
        let project = match parsed {
            Ok(project) => project,
            Err(message) => {
                usages.push(BandUsage::Unreadable { file, message });
                continue;
            }
        };
        let band_ref = project
            .get("bandRef")
            .and_then(|v| v.as_str())
            .unwrap_or_default();
        if band_ref_matches(band_ref, band_id, band_code) {
            let text_of = |key: &str| {
                project
                    .get(key)
                    .and_then(|v| v.as_str())
                    .map(str::to_string)
            };
            usages.push(BandUsage::UsesBand {
                file,
                display_name: text_of("displayName"),
                status: text_of("status"),
            });
        }
    }
    Ok(usages)
}

/// Amendment A3: deletes `bands/<id>.json` unless a project still uses the
/// band. Check and delete run in one call, so no UI round trip sits between
/// them. Contact files are never touched — they belong to the musician and
/// other bands share them.
fn delete_band_at(
    bands_dir: &Path,
    projects_dir: &Path,
    band_id: &str,
) -> Result<(), DeleteBandError> {
    ensure_safe_entity_id(band_id, "BAND_DELETE_FAILED")?;
    let path = bands_dir.join(format!("{}.json", band_id));
    if !path.exists() {
        return Err(DeleteBandError::failed(format!(
            "Band file {} was not found.",
            path.display()
        )));
    }
    let band = read_json_file(&path, "BAND_DELETE_FAILED")?;
    let code = band.get("code").and_then(|v| v.as_str()).map(str::trim);
    let usages = find_band_usages_at(projects_dir, band_id, code)?;
    if !usages.is_empty() {
        return Err(DeleteBandError {
            code: "BAND_IN_USE".into(),
            message: format!("{} project(s) still use band '{}'.", usages.len(), band_id),
            projects: usages,
        });
    }
    fs::remove_file(&path).map_err(|err| {
        DeleteBandError::failed(format!("Failed to delete {} ({})", path.display(), err))
    })
}
```

Poznámky k Rustu: closure `list_failed` zachytává jen `&Path`, je proto `Copy` a smí se předat dvakrát. `unwrap_or_default()` na `Option<&str>` dává `""`. Projekt i kapela se čtou jako `serde_json::Value` (R3 — žádné serde typy entit).

- [ ] **Step 4: Testy projdou**

Run (v `packages/desktop/src-tauri`): `cargo test delete_band`
Expected: 8 passed (`delete_band_*`). Pak `cargo test band_usage` → 1 passed.

- [ ] **Step 5: Příkaz a registrace**

Za příkaz `write_contact` (ř. 1199-1202) vlož:

```rust
#[tauri::command]
fn delete_band(app: tauri::AppHandle, band_id: String) -> Result<(), DeleteBandError> {
    let bands_dir = catalog_entity_dir(&app, "bands")
        .map_err(|err| DeleteBandError::failed(err.message))?;
    let projects_dir = storage_projects_dir(&app).map_err(|err| {
        DeleteBandError::failed(
            map_storage_error(err, "BAND_DELETE_FAILED", "Failed to resolve projects dir")
                .message,
        )
    })?;
    delete_band_at(&bands_dir, &projects_dir, &band_id)
}
```

V `tauri::generate_handler![…]` přidej `delete_band,` na samostatný řádek hned za `write_contact,`.

- [ ] **Step 6: Celá Rust sada bez nových warningů**

Run (v `packages/desktop/src-tauri`): `cargo test 2>&1 | grep -E "^warning|test result"`
Expected: `test result: ok. 37 passed; 0 failed` (28 + 9) a **žádný** řádek `warning` (BASE je bez warningů).

- [ ] **Step 7: Plná TS sada (beze změny)**

Run: `npm test`
Expected: 179 souborů, **1369 zelených**, 2 baseline padající.

- [ ] **Step 8: Commit**

```bash
git add packages/desktop/src-tauri/src/lib.rs
git commit -m "feat(tauri): add delete_band that refuses bands still used by projects"
```

---

### Task 6: `bandsApi.deleteBand` + `bandDeletion.ts`

Dodatek A3 (desktopová služba), R11, Ruling 13. Spec, sekce Testy → Desktop: „`bandsApi.deleteBand` mapuje `BAND_IN_USE` na typovaný výsledek se seznamem projektů (mock `invoke`)".

**Files:**
- Create: `packages/desktop/src/app/domain/band/bandDeletion.ts`
- Create: `packages/desktop/src/app/domain/band/bandDeletion.test.ts`
- Modify: `packages/desktop/src/app/services/tauriCommands.ts:15` (nový klíč)
- Modify: `packages/desktop/src/app/services/bandsApi.ts` (import, nový typ a funkce na konec souboru)
- Modify: `packages/desktop/src/app/services/bandsApi.test.ts` (import ř. 9-14, nový `describe` na konec)

**Interfaces:**
- Consumes: z Tasku 5 chybový JSON `{ code: "BAND_IN_USE" | "BAND_DELETE_FAILED", message, projects: [{ kind: "usesBand", file, displayName, status } | { kind: "unreadable", file, message }] }`.
- Produces:
  - `bandDeletion.ts`: `type BandUsage = { kind: "usesBand"; file: string; displayName: string | null; status: string | null } | { kind: "unreadable"; file: string; message: string }` (vše `readonly`); `parseBandUsages(value: unknown): BandUsage[]`; `describeBandUsage(usage: BandUsage): string`.
  - `bandsApi.ts`: `type DeleteBandResult = { ok: true } | { ok: false; kind: "inUse"; projects: readonly BandUsage[] } | { ok: false; kind: "failed"; message: string }`; `deleteBand(bandId: string): Promise<DeleteBandResult>` — **nikdy nerejectuje**.
  - `TAURI_COMMANDS.DELETE_BAND = "delete_band"`.

- [ ] **Step 1: Napiš padající test `bandDeletion`**

`packages/desktop/src/app/domain/band/bandDeletion.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { describeBandUsage, parseBandUsages } from "./bandDeletion";

describe("parseBandUsages", () => {
  it("reads both kinds of blocking project", () => {
    const projects = [
      {
        kind: "usesBand",
        file: "BK_Konopiste.json",
        displayName: "Blanická kapela – 30/05/2026 – Konopiště",
        status: "archived",
      },
      { kind: "unreadable", file: "broken.json", message: "Invalid JSON" },
    ];

    expect(parseBandUsages(projects)).toEqual(projects);
  });

  it("drops entries without a file and ignores a value that is not a list", () => {
    expect(
      parseBandUsages([
        null,
        "x",
        { kind: "usesBand" },
        { kind: "usesBand", file: "a.json" },
      ]),
    ).toEqual([
      { kind: "usesBand", file: "a.json", displayName: null, status: null },
    ]);
    expect(parseBandUsages(undefined)).toEqual([]);
  });
});

describe("describeBandUsage", () => {
  it("shows the project name with its archived state", () => {
    expect(
      describeBandUsage({
        kind: "usesBand",
        file: "a.json",
        displayName: "Konopiště",
        status: "archived",
      }),
    ).toBe("Konopiště (archived)");
    expect(
      describeBandUsage({
        kind: "usesBand",
        file: "a.json",
        displayName: "Praha",
        status: "active",
      }),
    ).toBe("Praha");
  });

  it("falls back to the file name and labels a project in the trash", () => {
    expect(
      describeBandUsage({
        kind: "usesBand",
        file: "a.json",
        displayName: null,
        status: "trashed",
      }),
    ).toBe("a.json (in trash)");
  });

  it("names an unreadable file and why it could not be checked", () => {
    expect(
      describeBandUsage({
        kind: "unreadable",
        file: "broken.json",
        message: "Invalid JSON",
      }),
    ).toBe("broken.json — could not be checked (Invalid JSON)");
  });
});
```

Run: `npx vitest run packages/desktop/src/app/domain/band/bandDeletion.test.ts`
Expected: FAIL — `Failed to resolve import "./bandDeletion"`.

- [ ] **Step 2: Implementuj `bandDeletion.ts`**

`packages/desktop/src/app/domain/band/bandDeletion.ts`:

```ts
// Co? Projekty, které brání smazání kapely (dodatek A3), v podobě, jakou vrací
// Rust příkaz `delete_band` v poli `projects` chyby `BAND_IN_USE`.
// Proč tady? Typ sdílí služba (`bandsApi.ts`) i dialog, a `app/domain` nesmí
// importovat ze `services/` (Ruling 13).

export type BandUsage =
  | {
      readonly kind: "usesBand";
      readonly file: string;
      readonly displayName: string | null;
      readonly status: string | null;
    }
  | {
      readonly kind: "unreadable";
      readonly file: string;
      readonly message: string;
    };

/** Přečte `projects` z chyby `delete_band`; položku bez jména souboru vynechá. */
export function parseBandUsages(value: unknown): BandUsage[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry: unknown) => {
    const usage = toBandUsage(entry);
    return usage ? [usage] : [];
  });
}

function readText(entry: object, key: string): string | null {
  const value: unknown = Reflect.get(entry, key);
  return typeof value === "string" ? value : null;
}

/** Neznámý `kind` se bere jako „projekt kapelu používá" — blokovat je bezpečnější. */
function toBandUsage(entry: unknown): BandUsage | null {
  if (typeof entry !== "object" || entry === null) return null;
  const file = readText(entry, "file");
  if (!file) return null;
  if (readText(entry, "kind") === "unreadable") {
    return {
      kind: "unreadable",
      file,
      message: readText(entry, "message") ?? "",
    };
  }
  return {
    kind: "usesBand",
    file,
    displayName: readText(entry, "displayName"),
    status: readText(entry, "status"),
  };
}

const STATUS_SUFFIX: Readonly<Record<string, string>> = {
  archived: " (archived)",
  trashed: " (in trash)",
};

/**
 * Ruling 10: řádek dialogu — název projektu (nebo jméno souboru) a stav,
 * protože archivovaný nebo smazaný projekt na úvodní obrazovce nevidět.
 */
export function describeBandUsage(usage: BandUsage): string {
  if (usage.kind === "unreadable") {
    return `${usage.file} — could not be checked (${usage.message})`;
  }
  const name = usage.displayName?.trim() || usage.file;
  const suffix = usage.status ? (STATUS_SUFFIX[usage.status] ?? "") : "";
  return `${name}${suffix}`;
}
```

`Reflect.get` místo indexace `entry[key]` — bez type assertion (`as`) a v ES2020. 

Run: `npx vitest run packages/desktop/src/app/domain/band/bandDeletion.test.ts`
Expected: PASS, 5 testů.

- [ ] **Step 3: Napiš padající testy `deleteBand`**

V `packages/desktop/src/app/services/bandsApi.test.ts` rozšiř import z `./bandsApi` (ř. 9-14) o `deleteBand`:

```ts
import {
  deleteBand,
  describeApiError,
  listBandSummaries,
  loadBandFormData,
  saveBandDraft,
} from "./bandsApi";
```

a na konec souboru přidej:

```ts
describe("deleteBand", () => {
  it("calls delete_band with the band id and reports success", async () => {
    invokeMock.mockResolvedValueOnce(undefined);

    const result = await deleteBand("test_band");

    expect(result).toEqual({ ok: true });
    expect(commandsCalled()).toEqual(["delete_band"]);
    expect(argsOf(0)).toEqual({ bandId: "test_band" });
  });

  it("turns BAND_IN_USE into the list of blocking projects", async () => {
    const projects = [
      {
        kind: "usesBand",
        file: "BK_Konopiste.json",
        displayName: "Blanická kapela – 30/05/2026 – Konopiště",
        status: "archived",
      },
      { kind: "unreadable", file: "broken.json", message: "Invalid JSON" },
    ];
    invokeMock.mockRejectedValueOnce({
      code: "BAND_IN_USE",
      message: "2 project(s) still use band 'blanicka_kapela'.",
      projects,
    });

    const result = await deleteBand("blanicka_kapela");

    expect(result).toEqual({ ok: false, kind: "inUse", projects });
  });

  it("reports any other failure with its message", async () => {
    invokeMock.mockRejectedValueOnce({
      code: "BAND_DELETE_FAILED",
      message: "Band file x/big_night_band.json was not found.",
      projects: [],
    });

    const result = await deleteBand("big_night_band");

    expect(result).toEqual({
      ok: false,
      kind: "failed",
      message: "Band file x/big_night_band.json was not found.",
    });
  });
});
```

Run: `npx vitest run packages/desktop/src/app/services/bandsApi.test.ts`
Expected: FAIL u tří nových testů (`deleteBand is not a function`); ostatní projdou.

- [ ] **Step 4: Implementuj `deleteBand`**

`packages/desktop/src/app/services/tauriCommands.ts` — za `WRITE_CONTACT: "write_contact",` (ř. 15) přidej:

```ts
  DELETE_BAND: "delete_band",
```

`packages/desktop/src/app/services/bandsApi.ts`:

1. Mezi import typů z `src/domain/model/types` (ř. 9-14) a `import type { BandOption } from "../shell/types";` (ř. 15) vlož:

```ts
import {
  type BandUsage,
  parseBandUsages,
} from "../domain/band/bandDeletion";
```

2. Na konec souboru (za `toJsonFile`) přidej:

```ts
export type DeleteBandResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly kind: "inUse";
      readonly projects: readonly BandUsage[];
    }
  | { readonly ok: false; readonly kind: "failed"; readonly message: string };

/**
 * Dodatek A3: kontrola projektů i smazání běží v Rustu v jednom příkazu.
 * `BAND_IN_USE` je očekávaný výsledek, ne výjimka — vrací se se seznamem
 * projektů; ostatní selhání se zprávou. Nerejectuje.
 */
export async function deleteBand(bandId: string): Promise<DeleteBandResult> {
  try {
    await invoke<void>(TAURI_COMMANDS.DELETE_BAND, { bandId });
    return { ok: true };
  } catch (error) {
    const { code, message } = describeApiError(error);
    if (code !== "BAND_IN_USE") return { ok: false, kind: "failed", message };
    const projects =
      typeof error === "object" && error !== null && "projects" in error
        ? parseBandUsages(error.projects)
        : [];
    return { ok: false, kind: "inUse", projects };
  }
}
```

Run: `npx vitest run packages/desktop/src/app/services/bandsApi.test.ts packages/desktop/src/app/domain/band/bandDeletion.test.ts`
Expected: PASS.

- [ ] **Step 5: Typová kontrola a build**

Run: `npx tsc -p packages/desktop/tsconfig.json --noEmit 2>&1 | grep "error TS"` → přesně 14 baseline chyb.
Run: `npx tsc --noEmit` → 0 chyb.
Run (v `packages/desktop`): `npx vite build` → `✓ built`.

- [ ] **Step 6: Plná sada**

Run: `npm test`
Expected: 180 souborů, **1377 zelených**, 2 baseline padající.

- [ ] **Step 7: Lint**

Nové `bandDeletion.ts`, `bandDeletion.test.ts` → `npx biome check --write`, pak bez `--write` → 0 chyb.
Upravené `tauriCommands.ts`, `bandsApi.ts`, `bandsApi.test.ts` → recept LF kopie HEAD vs `git show HEAD:<soubor>` → žádný nový nález.

- [ ] **Step 8: Commit**

```bash
git add packages/desktop/src/app/domain/band/bandDeletion.ts packages/desktop/src/app/domain/band/bandDeletion.test.ts packages/desktop/src/app/services/tauriCommands.ts packages/desktop/src/app/services/bandsApi.ts packages/desktop/src/app/services/bandsApi.test.ts
git commit -m "feat(band): add deleteBand to bandsApi with the projects that block it"
```

---

### Task 7: Tlačítko a dialog „Delete band"

Dodatek A3 (UI), Rulings 11, 14, 15; Review Focus 4.

**Files:**
- Create: `packages/desktop/src/app/components/band/BandDeleteSection.tsx`
- Create: `packages/desktop/src/app/components/band/BandDeleteSection.test.tsx`
- Modify: `packages/desktop/src/app/domain/band/bandFormModel.ts` (nová funkce `isBandFormDirty` za `serializeBandForm`)
- Modify: `packages/desktop/src/app/domain/band/bandFormModel.test.ts` (import, jeden test)
- Modify: `packages/desktop/src/app/pages/LibraryBandFormPage.tsx` (importy, guard, `handleDeleted`, vykreslení sekce, `refreshAfterSave` → `refreshBandList`)
- Modify: `packages/desktop/src/styles/features/library.css` (dvě třídy na konec)

**Interfaces:**
- Consumes: z Tasku 6 `deleteBand(bandId): Promise<DeleteBandResult>`, `BandUsage`, `describeBandUsage`; z Tasku 3 `serializeBandForm` a `BandFormState`.
- Produces: `isBandFormDirty(baseline: string | null, state: BandFormState): boolean`; komponenty `BandDeleteSection({ bandName, onDelete, onDeleted, onFailed })` a `BandUsageList({ projects })`.

- [ ] **Step 1: Napiš padající test `isBandFormDirty`**

V `packages/desktop/src/app/domain/band/bandFormModel.test.ts` přidej do importu z `./bandFormModel` jména `isBandFormDirty` a `serializeBandForm` (abecedně: `isBandFormDirty` za `disableContact`, `serializeBandForm` za `removeMember`) a na konec `describe` test:

```ts
  it("isBandFormDirty compares with the baseline and is false without one", () => {
    const state = withLineup();
    const baseline = serializeBandForm(state);
    const changed = setBandName(state, "Changed");

    expect(isBandFormDirty(baseline, state)).toBe(false);
    expect(isBandFormDirty(baseline, changed)).toBe(true);
    expect(isBandFormDirty(null, changed)).toBe(false);
  });
```

Run: `npx vitest run packages/desktop/src/app/domain/band/bandFormModel.test.ts`
Expected: FAIL — `isBandFormDirty is not a function`.

- [ ] **Step 2: Implementuj `isBandFormDirty`**

V `packages/desktop/src/app/domain/band/bandFormModel.ts` hned za funkci `serializeBandForm` přidej:

```ts
/**
 * Ruling 15: bez otisku (`null` — formulář ještě nenačten, nebo kapela právě
 * smazaná) formulář nikdy není „dirty", aby guard nezastavil návrat na seznam.
 */
export function isBandFormDirty(
  baseline: string | null,
  state: BandFormState,
): boolean {
  return baseline !== null && serializeBandForm(state) !== baseline;
}
```

Run: `npx vitest run packages/desktop/src/app/domain/band/bandFormModel.test.ts`
Expected: PASS, 21 testů.

- [ ] **Step 3: Napiš padající test komponenty**

`packages/desktop/src/app/components/band/BandDeleteSection.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BandDeleteSection, BandUsageList } from "./BandDeleteSection";

describe("BandUsageList", () => {
  it("lists every blocking project with its label", () => {
    const html = renderToStaticMarkup(
      <BandUsageList
        projects={[
          {
            kind: "usesBand",
            file: "BK_Konopiste.json",
            displayName: "Konopiště",
            status: "archived",
          },
          { kind: "unreadable", file: "broken.json", message: "Invalid JSON" },
        ]}
      />,
    );

    expect(html).toContain("<li>Konopiště (archived)</li>");
    expect(html).toContain(
      "<li>broken.json — could not be checked (Invalid JSON)</li>",
    );
  });

  it("still explains the block when the list could not be read", () => {
    const html = renderToStaticMarkup(<BandUsageList projects={[]} />);

    expect(html).toContain("could not be listed");
    expect(html).not.toContain("<li>");
  });
});

describe("BandDeleteSection", () => {
  it("offers a destructive Delete band button and keeps the dialog closed", () => {
    const html = renderToStaticMarkup(
      <BandDeleteSection
        bandName="Test Band"
        onDelete={vi.fn()}
        onDeleted={vi.fn()}
        onFailed={vi.fn()}
      />,
    );

    expect(html).toContain(
      '<button type="button" class="button-danger">Delete band</button>',
    );
    expect(html).not.toContain("alertdialog");
  });
});
```

Zavřený `ModalOverlay` vrací `null` před `createPortal` (`components/ui/modal/Modal.tsx:15`), takže render v Node projde; otevřený dialog se v Node testovat nedá (Global Constraints → Testy) — pokrývá ho ruční ověření bod 4 a 5.

Run: `npx vitest run packages/desktop/src/app/components/band/BandDeleteSection.test.tsx`
Expected: FAIL — `Failed to resolve import "./BandDeleteSection"`.

- [ ] **Step 4: Implementuj `BandDeleteSection.tsx`**

`packages/desktop/src/app/components/band/BandDeleteSection.tsx`:

```tsx
import { useState } from "react";
import {
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  useModalBehavior,
} from "../../../components/ui/Modal";
import { Close } from "../../../components/ui/icons";
import {
  type BandUsage,
  describeBandUsage,
} from "../../domain/band/bandDeletion";
import type { DeleteBandResult } from "../../services/bandsApi";

type DeleteDialog =
  | { readonly kind: "closed" }
  | { readonly kind: "confirm"; readonly isDeleting: boolean }
  | { readonly kind: "blocked"; readonly projects: readonly BandUsage[] };

/**
 * Dodatek A3: mazání kapely z její stránky úprav. Kontrola projektů běží
 * v Rustu uvnitř `delete_band`, proto se nejdřív potvrzuje a teprve výsledek
 * ukáže blokující projekty (Ruling 11).
 */
export function BandDeleteSection({
  bandName,
  onDelete,
  onDeleted,
  onFailed,
}: {
  bandName: string;
  onDelete: () => Promise<DeleteBandResult>;
  onDeleted: () => void;
  onFailed: (message: string) => void;
}) {
  const [dialog, setDialog] = useState<DeleteDialog>({ kind: "closed" });
  const close = () => setDialog({ kind: "closed" });
  const dialogRef = useModalBehavior(dialog.kind !== "closed", close);

  const confirm = () => {
    setDialog({ kind: "confirm", isDeleting: true });
    void onDelete().then((result) => {
      if (result.ok) {
        onDeleted();
        return;
      }
      if (result.kind === "inUse") {
        setDialog({ kind: "blocked", projects: result.projects });
        return;
      }
      close();
      onFailed(result.message);
    });
  };

  return (
    <section
      className="lineup-card band-form__danger"
      aria-labelledby="band-delete-heading"
    >
      <h3 id="band-delete-heading">Delete band</h3>
      <p className="subtle">
        Removes the band from your library. Musicians and their contacts stay. A
        band that projects still use cannot be deleted.
      </p>
      <button
        type="button"
        className="button-danger"
        onClick={() => setDialog({ kind: "confirm", isDeleting: false })}
      >
        Delete band
      </button>
      <ModalOverlay open={dialog.kind !== "closed"} onClose={close}>
        <div
          className="selector-dialog"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="band-delete-title"
          ref={dialogRef}
        >
          <button
            type="button"
            className="modal-close"
            onClick={close}
            aria-label="Close"
          >
            <Close />
          </button>
          {dialog.kind === "blocked" ? (
            <BlockedBody projects={dialog.projects} onClose={close} />
          ) : (
            <ConfirmBody
              bandName={bandName}
              isDeleting={dialog.kind === "confirm" && dialog.isDeleting}
              onCancel={close}
              onConfirm={confirm}
            />
          )}
        </div>
      </ModalOverlay>
    </section>
  );
}

function ConfirmBody({
  bandName,
  isDeleting,
  onCancel,
  onConfirm,
}: {
  bandName: string;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <>
      <ModalHeader>
        <h3 id="band-delete-title">Delete band {bandName}?</h3>
        <p>
          The band file is removed from your library. Musicians and their
          contacts stay.
        </p>
      </ModalHeader>
      <ModalFooter>
        <button type="button" className="button-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="button-danger"
          disabled={isDeleting}
          onClick={onConfirm}
        >
          {isDeleting ? "Deleting…" : "Delete band"}
        </button>
      </ModalFooter>
    </>
  );
}

/** A3: zablokované smazání nabízí jen zavření. */
function BlockedBody({
  projects,
  onClose,
}: {
  projects: readonly BandUsage[];
  onClose: () => void;
}) {
  return (
    <>
      <ModalHeader>
        <h3 id="band-delete-title">This band is still in use</h3>
        <p>
          Delete these projects first, including archived ones and those in the
          trash. Then you can delete the band.
        </p>
      </ModalHeader>
      <BandUsageList projects={projects} />
      <ModalFooter>
        <button type="button" className="button-primary" onClick={onClose}>
          Close
        </button>
      </ModalFooter>
    </>
  );
}

export function BandUsageList({
  projects,
}: {
  projects: readonly BandUsage[];
}) {
  if (projects.length === 0) {
    return (
      <p className="status status--error">
        The projects that use this band could not be listed.
      </p>
    );
  }
  return (
    <ul className="band-form__usages">
      {projects.map((usage) => (
        <li key={usage.file}>{describeBandUsage(usage)}</li>
      ))}
    </ul>
  );
}
```

Pozn.: `onDelete` (= `deleteBand`) nikdy nerejectuje (Task 6), takže `.then` bez `.catch` nic nepolyká. Nadpis potvrzení je doslova „Delete band <název>?" podle A3.

Run: `npx vitest run packages/desktop/src/app/components/band/BandDeleteSection.test.tsx`
Expected: PASS, 3 testy.

- [ ] **Step 5: CSS**

Na konec `packages/desktop/src/styles/features/library.css` připoj:

```css
/* Delete band (amendment A3): the last block of the edit form, above the
   sticky action bar, so the bar never covers it. */
.band-form__danger {
  justify-items: start;
}

.band-form__usages {
  margin: 0;
  padding-left: var(--sp-7);
  display: grid;
  gap: var(--sp-2);
}
```

- [ ] **Step 6: Zapoj sekci do `LibraryBandFormPage.tsx`**

V `packages/desktop/src/app/pages/LibraryBandFormPage.tsx`:

1. Importy: pod `import { BandContactSection } …` přidej

```tsx
import { BandDeleteSection } from "../components/band/BandDeleteSection";
```

do importu z `../domain/band/bandFormModel` přidej `isBandFormDirty,` (za `createEmptyBandForm,`) a do importu z `../services/bandsApi` přidej `deleteBand,` (za `type SaveBandDraftResult,`).

2. Guard (dnes ř. 78-80):

```tsx
      isDirty: () =>
        baselineRef.current !== null &&
        serializeBandForm(formRef.current) !== baselineRef.current,
```

nahraď za

```tsx
      isDirty: () => isBandFormDirty(baselineRef.current, formRef.current),
```

(`serializeBandForm` zůstává v importu — používá ho `useBandFormData` callback i `useBandPersistence`.)

3. Za `const handleSave = () => { … };` přidej

```tsx
  /** Ruling 15: smazaná kapela nemá neuložené změny; guard nesmí zastavit návrat na seznam. */
  const handleDeleted = () => {
    baselineRef.current = null;
    notify("success", "Band deleted.");
    void refreshBandList(onBandSaved, notify, "deleted");
    navigate("/library");
  };
```

a řádek `const { musicians } = load.data;` změň na `const { musicians, band } = load.data;`.

4. Před `<div className="setup-action-bar setup-action-bar--equal">` vlož:

```tsx
      {bandId ? (
        <BandDeleteSection
          bandName={band?.name ?? bandId}
          onDelete={() => deleteBand(bandId)}
          onDeleted={handleDeleted}
          onFailed={(message) =>
            notify("error", `The band could not be deleted: ${message}`)
          }
        />
      ) : null}
```

5. Funkci `refreshAfterSave` (dnes ř. 287-299) nahraď za

```tsx
async function refreshBandList(
  onBandSaved: () => Promise<void>,
  notify: Notify,
  outcome: "saved" | "deleted",
): Promise<void> {
  try {
    await onBandSaved();
  } catch (error) {
    notify(
      "error",
      `The band was ${outcome}, but the band list could not be refreshed: ${describeApiError(error).message}`,
    );
  }
}
```

a v `useBandPersistence` volání `await refreshAfterSave(onBandSaved, notify);` za `await refreshBandList(onBandSaved, notify, "saved");`.

`refreshBandList` chybu nepolyká — hlásí ji toastem — a nerejectuje, proto `void` v `handleDeleted`.

- [ ] **Step 7: Ověř, že ve stránce nezůstal starý název**

Run: `grep -n "refreshAfterSave" packages/desktop/src/app/pages/LibraryBandFormPage.tsx`
Expected: žádný výstup.

- [ ] **Step 8: Typová kontrola a build**

Run: `npx tsc -p packages/desktop/tsconfig.json --noEmit 2>&1 | grep "error TS"` → přesně 14 baseline chyb.
Run: `npx tsc --noEmit` → 0 chyb.
Run (v `packages/desktop`): `npx vite build` → `✓ built`.

- [ ] **Step 9: Plná sada (TS i Rust)**

Run: `npm test`
Expected: 181 souborů, **1381 zelených**, 2 baseline padající.

Run (v `packages/desktop/src-tauri`): `cargo test 2>&1 | grep -E "^warning|test result"`
Expected: `37 passed; 0 failed`, žádný warning.

- [ ] **Step 10: Lint**

Nové `BandDeleteSection.tsx`, `BandDeleteSection.test.tsx` → `npx biome check --write`, pak bez `--write` → 0 chyb.
Upravené `bandFormModel.ts`, `bandFormModel.test.ts`, `LibraryBandFormPage.tsx`, `library.css` → recept LF kopie proti `git show HEAD:<soubor>` → žádný nový nález.

- [ ] **Step 11: Commit**

```bash
git add packages/desktop/src/app/components/band/BandDeleteSection.tsx packages/desktop/src/app/components/band/BandDeleteSection.test.tsx packages/desktop/src/app/domain/band/bandFormModel.ts packages/desktop/src/app/domain/band/bandFormModel.test.ts packages/desktop/src/app/pages/LibraryBandFormPage.tsx packages/desktop/src/styles/features/library.css
git commit -m "feat(library): delete a band from its edit page unless projects use it"
```

---

## Ruční ověření (dělá člověk)

Repo nemá jsdom; stránky a dialogy se ověřují ručně v `npm run dev`. Převzato z dodatku (sekce „Ruční průchod (doplnění)", body 1–6), doplněno o body 7–9 z Rulings. Předpoklad: Tasky 1–7 hotové, `npm test` 1381 zelených + 2 baseline selhání, `cargo test` 37/0.

**Před průchodem: záloha katalogu mimo scratchpad.** Průchod zapisuje do `%APPDATA%/StagePilot/catalog/` a bod 5 maže soubor kapely; scratchpad není záloha.

```bash
cp -r "$APPDATA/StagePilot/catalog" "$HOME/stagepilot-catalog-backup-$(date +%Y%m%d)"
```

Spusť `npm run dev`. Známá past: port 1420 obsazený jiným procesem zablokuje `tauri dev` (`--strictPort`).

1. **Nová kapela** (`/library` → `New band`): přidání bubeníka, který zpívá (např. Plašil Pavel), předvyplní BACK VOCS. Ruční odebrání z BACK VOCS a další změna sestavy (přidání dalšího zpívajícího bubeníka) už BACK VOCS nepřepíše. Sekce Roles obsahuje jen select „Band leader".
2. **Blanická kapela:** otevřít a uložit bez změn → `backVocals` zůstane `[]`. Očekávaný rozdíl proti záloze: `leadVocals` je přerovnané podle `vocs` na `["holoubek_lukas", "krecmerova_eliska"]` (A1, Ruling 1). Porovnej: `diff "$HOME/stagepilot-catalog-backup-<datum>/bands/blanicka_kapela.json" "$APPDATA/StagePilot/catalog/bands/blanicka_kapela.json"`.
3. **Big Night Band:** BACK VOCS ukazuje Plašil, Krečmer, Žídek; uložení beze změny nemění soubor (kromě formátování) — stejný `diff` proti záloze.
4. **Smazání Blanické kapely je zablokované:** `Delete band` → potvrzení → dialog „This band is still in use" se dvěma projekty (`bandRef: blanicka_kapela`), oba se štítkem „(archived)" (Ruling 10); nabízí jen `Close`. Soubor `catalog/bands/blanicka_kapela.json` zůstal.
5. **Smazání `test_band` projde:** nejdřív změň název (formulář je „dirty"), pak `Delete band` → potvrzení → návrat na `/library` **bez** dialogu neuložených změn (Review Focus 4), toast „Band deleted.", kapela zmizela ze seznamu i z výběru kapel při zakládání projektu. `catalog/contacts/` beze změny: `diff -r "$HOME/stagepilot-catalog-backup-<datum>/contacts" "$APPDATA/StagePilot/catalog/contacts"` → žádný rozdíl.
6. **Layout:** dropdown „Add drums" je celý viditelný (jména i „Add selected"), zarovnaný k pravému okraji spouštěče (Ruling 5); tlačítka `Remove` a spouštěče `Add …` jsou ve všech řádcích, včetně LEAD VOCS a BACK VOCS, ve stejném sloupci; zúžení okna nezahodí tlačítka — `Add …` se zalomí pod jména (Ruling 6).
7. **Pořadí lead vokálů v novém projektu (Ruling 1):** po bodu 2 založ projekt Blanické kapely → na `02 INPUTS` je `Lead vocal 1` Holoubek Lukáš. Je-li to nežádoucí, v LEAD VOCS kapely odeber a znovu přidej Holoubka (posune se za Krečmerovou) a ulož. Existující projekty Blanické kapely se nemění.
8. **`01 LINEUP` projektu beze změny (Ruling 4, 5, 6):** otevři libovolný projekt → `01 LINEUP`: řádky mají dosavadní flex layout (role, jméno, `Change`/`Setup` vpravo), LEAD VOCS / BACK VOCS bloky tam vypadají jako dřív. `Change` u DRUMS → v dialogu je panel „Add …" stejně široký jako spouštěč a pod ním.
9. **Nová kapela bez muzikantů v knihovně** (volitelné, čistá instalace): prázdný stav sestavy se nezměnil a sekce „Delete band" se u nové kapely nezobrazuje.

Po průchodu: chceš-li vrátit `test_band` nebo původní pořadí Blanické kapely, obnov soubory ze zálohy (`cp "$HOME/stagepilot-catalog-backup-<datum>/bands/<soubor>" "$APPDATA/StagePilot/catalog/bands/"`).

---

## Mimo rozsah a k rozhodnutí

- **Mimo rozsah (dodatek):** mazání muzikantů a kontaktů; mazání rozbité kapely z chybového řádku seznamu; hromadné přepojení projektů; změna `list_bands`.
- **Pravděpodobně stejná layoutová vada jinde (neověřeno v běžící aplikaci, odhad ze CSS):** přepínač „No contact / Band member" v `BandContactSection.tsx:43-60` používá tutéž `fieldset.band-form__checks` s `<label><input …/>text</label>` jako zrušená zaškrtávátka, a globální `label { display: grid; }` (`styles/base.css:90-93`) staví text pod radio. Dodatek ho neřeší; plán ho nemění. Rozhodne uživatel.
- **Ruling 11** (potvrzení před kontrolou) — pokud má blokace přijít před potvrzením, přibude `dryRun`.

---

## Ověření plánu nanečisto (provedeno při psaní, 2026-10-06)

Repo zůstalo nedotčené; všechno běželo nad kopiemi ve scratchpadu.

- **Baseline** znovu změřen na `b6b531c`: `npm test` 176 souborů, 1345 zelených + 2 baseline selhání; root `tsc` 0; desktop `tsc` 14 chyb (seznam v Global Constraints sedí); `cargo test` 28 passed.
- **Rust (Task 5):** bloky kódu z plánu vloženy skriptem do kopie `packages/desktop/src-tauri` (import testů, typy + funkce za `write_contact_at`, příkaz za `write_contact`, registrace, 9 testů) → `cargo test`: **37 passed, 0 failed, 0 warnings**.
- **Biome (Tasky 1, 2, 3, 6, 7):** všechny nové soubory a celé přepisy (`multiSelectPanelPosition*.ts`, `LineupRow.test.tsx`, `BandLineupSection*.tsx` ve stavu po Tasku 2, `bandFormModel*.ts`, `BandRolesSection.tsx`, `bandDeletion*.ts`, `BandDeleteSection*.tsx`) a `lineup.css` / `library.css` s vloženými bloky → 0 lint nálezů; dva formátovací rozdíly byly v plánu opraveny a druhý běh je čistý.
- **Markup v testech komponent:** řetězce, na které testy Tasků 2, 4 a 7 spoléhají (pořadí atributů `type` → `class` → `aria-label`, prázdný textový uzel bez komentáře, `1. One` bez oddělovače, `<li>` s pomlčkou), ověřeny přes `renderToStaticMarkup` z `packages/desktop/node_modules` (react-dom **19.2.4**).
- **Neověřeno nanečisto:** typová kontrola a běh vitestu nad TS změnami Tasků 1–4, 6, 7 — kopie stromu s `node_modules` ve scratchpadu nebyla k dispozici. Proto má každý task explicitní kroky `tsc` (obě konfigurace), `vite build` a plný `npm test` s očekávanými počty; odchylka od tabulky v Global Constraints patří do reportu tasku.

## Self-review (provedeno při psaní plánu)

**Pokrytí dodatku:**

| Dodatek | Task |
|---|---|
| A1 LEAD VOCS = `vocs`, `leadVocals = defaultLineup.vocs` (pořadí) | 3 (doména, test „writes leadVocals as defaultLineup.vocs…"), 4 (popisek) |
| A1 zaškrtávátka v Roles mizí, Roles jen „Band leader" | 3 (Step 7) |
| A1 `leadVocalIds` + `collectRoleErrors` upravit | 3 (Ruling 2) |
| A1 existující kapela s odlišným pořadím se srovná | 3 (doména bere `vocs`), ruční bod 2 |
| A1 otevřená otázka — vliv pořadí na dokument | Ruling 1 (s citacemi), ruční bod 7 |
| A2 řádek BACK VOCS, Remove + „Add back vocs" | 4 |
| A2 nabídka `drums/bass/guitar/keys` mimo BACK VOCS | 3 (`backVocalCandidates` + test) |
| A2 předvyplnění nové kapely, zastavení po ruční změně | 3 (4 testy), ruční bod 1 |
| A2 existující kapela: uložené `backVocals`, bez přepočtu | 3 (`bandFormFromBand`, testy), ruční bod 2–3 |
| A2 odebraný člen zmizí z BACK VOCS | 3 (2 testy) |
| A2 uloží se přesně výběr, `validateDefaultVocals` projde | 3 (doména, 4 testy + Review Focus 5) |
| A3 tlačítko dole na úpravě, ne v seznamu, ne u nové | 7 (Ruling 14), ruční bod 9 |
| A3 blokace projekty s dialogem názvů | 5, 6, 7, ruční bod 4 |
| A3 potvrzení „Delete band <název>?", návrat + toast | 7, ruční bod 5 |
| A3 kontakty se nemažou | 5 (`delete_band_at` sahá jen na `bands/<id>.json`), ruční bod 5 |
| A3 `delete_band` v Rustu, kontrola uvnitř, `BAND_IN_USE` / `BAND_DELETE_FAILED`, sanitace jako `read_band` | 5 |
| A3 neplatný JSON projektu blokuje s uvedením souboru | 5 (test), 6 (`unreadable`), 7 (`BandUsageList`) |
| A3 jen přes `bandsApi.ts` | 6 |
| A4.1 dropdown celý viditelný | 1 |
| A4.2 jeden sloupec tlačítek, šířka nezávislá na jménu | 2 |
| A4.3 úzké okno zalomí | 2 (container query), ruční bod 6 |
| A4 nesmí rozbít `ProjectSetupPage` | 1 (široký spouštěč beze změny, test), 2 (markup bez akce beze změny, `BackVocsBlock.test`), ruční bod 8 |
| Testy — doména / Rust / desktop podle dodatku | 3 / 5 / 6 |

**Placeholder scan:** žádné „TBD", „doplň", „obdobně jako Task N"; každý krok s kódem kód obsahuje. Kroky, které se odkazují na řádky, uvádějí i symbol (řádky se mezi tasky posouvají).

**Typová konzistence:** `BandDraft.backVocalIds`, `BandDraftField "backVocals"`, `BandFormState.backVocalIds/backVocalsTouched`, `CanSing`, `addMembersToGroup(state, role, ids, canSing)`, `backVocalCandidates`, `addBackVocals`, `removeBackVocal`, `isBandFormDirty`, `BandUsage` (`usesBand`/`unreadable`, `file`, `displayName`, `status`, `message`), `DeleteBandResult` (`inUse`/`failed`), `TAURI_COMMANDS.DELETE_BAND`, Rust `BandUsage::UsesBand { file, display_name, status }` → JSON `displayName` (test `band_usage_serializes_in_the_shape_bands_api_reads`) — stejná jména v produkujícím tasku i ve všech konzumentech.

**Počty testů (kumulativně, BASE 1345 zelených / 176 souborů / cargo 28):** T1 +6 (nový soubor) → 1351 / 177; T2 +4 (2 nové soubory) → 1355 / 179; T3 +4 doména +7 model → 1366; T4 +3 → 1369; T5 cargo +9 → 37; T6 +5 +3 (1 nový soubor) → 1377 / 180; T7 +1 +3 (1 nový soubor) → **1381 zelených, 2 baseline selhání, 1383 celkem, 181 souborů; cargo 37**.

**Review Focus:** pět vstupů, každý s testem ve vlastnícím tasku (5, 5, 5, 7, 3).
