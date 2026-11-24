# Editor kapely v Library — implementační plán

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uživatel založí a upraví kapelu (název, zkratka, sestava, kapelník, lead vokály, kontakt) ve formuláři v `/library`, aniž by sáhl do JSON, a staré mrtvé lešení Library zmizí z TypeScriptu i z Rustu.

**Architecture:** Pravidla kapely žijí v čisté doméně `src/domain/band/` (+ `src/domain/ids/slug.ts`) a vrací diskriminovanou unii místo výjimek. Rust dostane šest tenkých příkazů, které čtou a atomicky zapisují JSON a hlídají jen parsovatelnost a bezpečné jméno souboru. Desktop volá příkazy výhradně přes `packages/desktop/src/app/services/bandsApi.ts`; stav formuláře je čistá funkce v `packages/desktop/src/app/domain/band/bandFormModel.ts`, stránky jsou tenké. Staré lešení se maže až poté, co nové stránky existují: nejdřív TypeScript (Task 12), pak Rust (Task 13).

**Tech Stack:** TypeScript (ESM, strict), React 19 + Vite, Vitest (`environment: "node"`, bez jsdom), Biome 1.9, Tauri 2 (Rust, `serde_json`).

**Spec:** `docs/superpowers/specs/2026-10-06-band-editor-design.md` — závazný, rozhodnutí R1–R15. Plán z něj argumentuje; kde spec mlčí nebo se rozchází s repem, rozhoduje sekce *Rulings* níže.

---

## Global Constraints

Platí pro **každý** task. Neopakují se v tělech tasků, ale jejich požadavky je implicitně obsahují.

### Vrstvy (z `CLAUDE.md`, nesmí se překročit)

- `src/domain/` — čistá logika, nula I/O, nula vedlejších efektů. Sem jde `src/domain/ids/slug.ts` a celé `src/domain/band/`.
- `src/app/usecases/` — orchestrace domény a infrastruktury (Task 3 tu jen mění import typu).
- `packages/desktop/src-tauri/src/lib.rs` — jen souborový systém: čtení, sanitace id, atomický zápis. **Žádné serde typy entit** (R3). Pravidla kapely v Rustu nejsou.
- `packages/desktop/` — UI. Tauri příkazy **jen** přes `packages/desktop/src/app/services/tauriCommands.ts` a `bandsApi.ts` (R11). Stránka nikdy nevolá `invoke`.
- `packages/desktop/src/app/domain/**` — čisté funkce desktopu, bez Reactu. Netriviální rozhodnutí formuláře patří sem, ne do komponenty, protože komponenty bez jsdom testovat nejde.

### Importy a cesty

- Uvnitř `src/domain/**` se píše přípona `.js` (`from "../model/types.js"`) — stejně jako `src/domain/model/bandLineup.ts:1-3`. Testy v `src/domain/**` importují bez přípony (`from "./bandLineup"`, viz `bandLineup.test.ts:7`).
- Desktop importuje doménu **bez přípony**. Hloubka (ověřeno na existujících souborech):
  - z `packages/desktop/src/app/services/` a `packages/desktop/src/app/pages/` → `../../../../../src/domain/...` (5×, vzor `projectsApi.ts:6`, `ProjectSetupPage.tsx:9`);
  - z `packages/desktop/src/app/domain/band/` a `packages/desktop/src/app/components/band/` → `../../../../../../src/domain/...` (6×, vzor `app/domain/roles/applyDerivedVocalOverlays.ts:1-6`);
  - z `packages/desktop/src/app/pages/components/library/` → 7× (`../../../../../../../src/domain/...`), jen v Tasku 1.
- `packages/desktop/tsconfig.json` má `lib: ES2020` a `noUnusedLocals`/`noUnusedParameters`, a protože desktop doménu importuje, **typově kontroluje i nové soubory v `src/domain/band/`**. Nepoužívej `Array.prototype.at`, `String.prototype.replaceAll` ani `Object.hasOwn` — v ES2020 nejsou (regex `\p{M}` s příznakem `u` je ES2018 a projde, ověřeno) (existující chyba `resolveStagePositionOrder.ts(54,30)` je přesně tenhle případ).

### Testy

- Vitest, jediný `vitest.config.ts` v rootu, `environment: "node"`. **jsdom se nezavádí.** UI se ověřuje ručním průchodem na konci plánu.
- Mock Tauri: `vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }))` (vzor mockování modulu: `packages/desktop/src/app/services/projectMaintenance.test.ts:4-15`). Pořadí odpovědí se řídí přes `mockResolvedValueOnce`, ne přes `mockImplementation` — generická signatura `invoke<T>` by jinak vyžadovala `as`.
- Rust testy pracují nad temp adresářem podle vzoru `temp_test_dir` v `packages/desktop/src-tauri/src/storage_paths.rs:653-659`.

### Baseline — měř deltu, nikdy úspěch podle absolutní nuly

Změřeno **2026-10-06 na `feat/band-editor`, commit `6b67c25`** (BASE pro všechna porovnání):

| Kontrola | Baseline |
|---|---|
| `npm test` | **168 souborů, 1267 testů: 1265 zelených, 2 trvale padající** — `src/infra/fs/assetsPaths.test.ts` („resolves canonical drums setup blueprint path") a `src/infra/fs/repoAssets.test.ts` („loads notes template from AppData even when data root has no notes assets") |
| `npx tsc --noEmit` (root, `tsconfig.json` → `src` + `tests`) | **0 chyb** |
| `npx tsc -p packages/desktop/tsconfig.json --noEmit` | **14 chyb v 7 souborech**, viz seznam níže |
| `cargo test` v `packages/desktop/src-tauri` | **16 passed, 0 failed, 0 warnings** |
| `npx vite build` v `packages/desktop` | **projde** (`✓ built`) |
| `npm run lint` (agregát) | 1535 errors — **NEPOUŽÍVAT jako signál** |

Desktop tsc baseline (porovnávej **soubor + text chyby**, ne číslo řádku — Task 9 posune řádky v `ProjectSetupPage.tsx`):

```
app/components/setup/fields/BassFieldRendering.test.tsx      2× TS2322 ToggleFieldDef | ToggleWithStepperFieldDef
app/components/setup/instruments/bass/buildBassFields.test.ts 3× TS2345/TS2322 EventSetupEditState / MusicianSetupPreset
app/components/setup/instruments/keys/buildKeysFields.test.ts 3× TS2339 Property 'setCount'
app/domain/roles/applyDerivedVocalOverlays.test.ts            2× TS2352 Conversion ... to type 'PresetEntity'
app/pages/ProjectSetupPage.tsx                                1× TS2322 Record<string, PresetEntity> | undefined   (dnes řádek 667)
app/services/projectMaintenance.test.ts                       2× TS2353 'documentDate' does not exist in type 'ProjectSummary'
src/domain/stageplan/resolveStagePositionOrder.ts             1× TS2550 Property 'at' does not exist
```

**`npm run lint` je nedeterministický a 99 % nálezů jsou CRLF konce řádků** (`git config core.autocrlf` = `true`, Biome čeká LF). Jediná platná metoda pro **upravený** soubor je LF-normalizovaná kopie, na HEAD i na BASE:

```bash
# $SCRATCH = scratchpad session. biome.json MUSÍ ležet v kořeni scratch stromu.
S="$SCRATCH/lintcheck"; F=packages/desktop/src/app/pages/shared/projectHubUtils.ts
mkdir -p "$S/head/$(dirname $F)" "$S/base/$(dirname $F)"
cp biome.json "$S/head/"; cp biome.json "$S/base/"
tr -d '\r' < "$F" > "$S/head/$F"
git show 6b67c25:"$F" | tr -d '\r' > "$S/base/$F"
npx biome check "$S/head/$F" 2>&1 | grep -E "lint/|format|organizeImports|Found"
npx biome check "$S/base/$F" 2>&1 | grep -E "lint/|format|organizeImports|Found"
```

Recept ověřen 2026-10-06 (`projectHubUtils.ts` na BASE: `Found 1 error.` — pre-existing format). Delta = nálezy na HEAD, které na BASE nejsou. **Nové soubory** se kontrolují přímo: `npx biome check --write <nový soubor>` (jen bezpečné opravy: formát + řazení importů) a pak `npx biome check <nový soubor>` → `No fixes applied`, 0 chyb. Formatter Biome 1.9 není u řetězení `.mockResolvedValueOnce(…).mockRejectedValueOnce(…)` idempotentní — když druhá kontrola hlásí `format`, pusť `--write` ještě jednou (ověřeno na `bandsApi.test.ts`: druhý průchod je stabilní). **Nikdy** `biome format --write .` ani `npm run format` nad celým repem.

Nesouvisející pre-existing selhání (testy, tsc, lint) se **neopravují**. Když na něco narazíš, napiš to do reportu tasku.

### Rozhraní a texty

- Jazyk UI je **angličtina** (R12, F6). Chybové zprávy domény jsou anglicky, protože je formulář zobrazuje u polí.
- Toasty: `useToast()` z `packages/desktop/src/components/ui/toast/useToast.ts`, API `notify(kind: "success" | "error" | "info", message: string)` (`ToastProvider.tsx:21-23`).
- Navigační guard: `registerNavigationGuard({ isDirty, save, discard? })` (`app/shell/types.ts:137-141`). `saveAndExit` (`useAppNavigation.ts:95-106`) zůstane na stránce, **jen když `save()` vyhodí** — `save` proto při neúspěchu musí rejectnout.
- Prázdné stavy: `EmptyState({ icon, title, description?, action? })` z `packages/desktop/src/components/ui/EmptyState.tsx`. Ikony jen z `packages/desktop/src/components/ui/icons.tsx` (k dispozici mj. `Inbox`, `Info`, `ChevronDown`; **`Users` neexistuje**).
- Žádné inline styly v nových souborech (CLAUDE.md). Existující `style={{…}}` v `AddMusiciansMultiSelect` se v Tasku 9 jen přesouvá beze změny.

### Commit

- **Jednořádková zpráva bez těla a patičky** — hook obojí odmítne.
- Formát `<typ>(<scope>): <co>`, anglicky, bez tečky. Scope: `band`, `library`, `tauri`, `roles`, `pdf`.
- Každý task končí explicitním krokem „Commit". Plán sám nic necommituje.

### AGENTS.md

- `AGENTS.md` odkazuje na `docs/project-guidelines/ARCHITECTURE.md`, `PROJECT_GUIDELINES.md` a `REFACTORING_RULES.md` — **v repu neexistují** (k `6b67c25` je v `docs/project-guidelines/` jen `STAGEPILOT_PROJECT_INSTRUCTIONS.md`; starší verze leží jako `project_guidelines/*.txt`). Závazné jsou tedy `CLAUDE.md`, spec a tento plán.
- „Do not silently change persisted project JSON shape“: plán **nemění tvar projektu**. Mění tvar *souboru kapely* jen tam, kde to spec výslovně říká (R7: `bandLeader` i `bandLeaderId`; R8: `backVocals` přepočítané) — není to tiché.
- „Do not create commits unless explicitly requested“: kroky „Commit“ se provádí, jen když člověk spuštění plánu výslovně schválil (workflow z `CLAUDE.md`, fáze Implement).

### Měř, nepředpokládej

Předchozí plány selhávaly na tvrzeních psaných proti typům místo proti repu. Každá cesta, symbol a číslo řádku v tomto plánu je ověřené grepem nebo čtením k `6b67c25`. **Než se o cestu opřeš, ověř, že pořád existuje** (předchozí task ji mohl posunout). Kde task stojí na tvrzení o datech v `%APPDATA%/StagePilot/`, obsahuje krok, který ho ověří čtením — skripty piš do souboru v `$SCRATCH`, ne do heredocu (Windows cesty a české znaky).

---

## Review Focus

Pět vstupů, které spec implikuje, ale výslovně je neřeší, seřazeno podle pravděpodobnosti, že kousnou uživatele. Každý má test v tasku, který vlastní kód.

1. **Nová kapela, jejíž slug se rovná zkratce existující kapely** (název „BK", když existuje Blanická kapela s `code: "BK"`). `catalogRepository` mapuje id i `code.toLowerCase()` do **jedné** mapy (`src/infra/storage/catalogRepository.ts:29-35`), takže by `bandRef: "bk"` vedl na jinou kapelu. Očekávání: chyba u názvu. → Task 4, test „rejects an id that equals another band's code alias"; zrcadlově zkratka = id jiné kapely → Task 4, test „rejects a code that equals another band's id".
2. **Kapela pojmenovaná „New"** → id `new` koliduje s routou `/library/bands/new` (`routes.ts:83-85` matchuje i `new`). Očekávání: chyba u názvu, kapela nevznikne. → Task 4, test „rejects a reserved id"; Task 5, test „carries reserved ids in lower case".
3. **Přejmenování existující kapely** nesmí změnit id, nesmí přepočítat ručně danou zkratku a nesmí ztratit pole, která formulář nespravuje (`notesTemplateRef`, `logoFile`). → Task 4, testy „keeps existingId…" a „preserves notesTemplateRef and logoFile…"; Task 8, test „bandFormFromBand treats the stored code as manual".
4. **Kontaktní osoba odebraná ze sestavy.** Formulář nesmí tiše zapsat kontakt na nečlena ani tiše zahodit vyplněný telefon. Očekávání: telefon/e-mail zůstanou, uložení skončí chybou u kontaktu. → Task 8, testy „removeMember of the contact keeps phone and e-mail" a „a draft with a removed contact fails in the domain".
5. **Rozbitý soubor muzikanta.** Formulář se nesmí otevřít s částečným katalogem. Očekávání: chyba s cestou k souboru. → Task 6, test `list_catalog_musicians_fails_with_the_path_of_a_broken_file`.

---

## Rulings

Rozhodnutí, která spec nechal na plánu, nebo kde se spec rozchází s repem. Formát: *co — proč — co to stojí, když je to špatně*.

**Ruling 1 — `toIdSlug` při přesunu do domény získá odstranění diakritiky a druhé oříznutí `_` po řezu na 50 znaků.** Spec R4 říká „bez diakritiky", ale dnešní `toIdSlug` (`packages/desktop/src/app/pages/shared/projectHubUtils.ts:17-24`) diakritiku neodstraňuje — z „Blanická kapela" by udělal `blanick_kapela`, ne reálné id `blanicka_kapela`. Jediný konzument (`LibraryPages.tsx:155,553`) je mrtvé lešení, které Task 12 smaže. — Cena při chybě: žádná existující data se nemění; jen nová id.

**Ruling 2 — id a zkratka se kontrolují proti oběma jmenným prostorům.** Spec R4 hlídá id proti id, R5 zkratku proti zkratkám. `catalogRepository.ts:30-34` ale ukládá id i `code.toLowerCase()` do stejné mapy `bandRefs`, takže kolize napříč by tiše přesměrovala `bandRef`. Doména proto odmítne id rovné cizí zkratce i zkratku rovnou cizímu id. — Cena: o něco přísnější validace u vzácných krátkých názvů.

**Ruling 3 — rezervované id `new`.** `matchLibraryBandDetailPath` (`routes.ts:83-85`) matchuje i `/library/bands/new`. `BandDraftContext` dostane volitelné `reservedIds`, desktop do nich dá `NEW_BAND_ROUTE_SEGMENT`. — Cena: jedno volitelné pole navíc v kontextu ze specu R9.

**Ruling 4 — kontext R9 dostane volitelné `existingBand`; při úpravě se zachovají jen `notesTemplateRef` a `logoFile`.** Spec R14 říká, že je formulář nenabízí; kdyby je úprava zahodila, kapele by se tiše změnila šablona poznámek v PDF. Ostatní neznámé klíče se zahazují — ověřeno, že žádná ze 4 kapel v APPDATA jiné klíče nemá (`type,id,code,name,bandLeaderId,defaultContactId,defaultTalkbackOwnerId,defaultLineup,defaultOverlays`). — Cena: ručně přidaný neznámý klíč by úprava ve formuláři smazala.

**Ruling 5 — `defaultTalkbackOwnerId` při úpravě.** Spec R7: „formulář nenabízí; normalizace doplní kapelníkem". `normalizeBandToCanonicalShape` (`bandLineup.ts:156`) ale dosadí kapelníka jen když pole chybí. Uložená hodnota se proto převezme, **jen pokud je dotyčný pořád v sestavě**; jinak se vynechá a normalizace dosadí kapelníka. — Cena: ručně nastavený talkback na nečlena se při úpravě přepíše na kapelníka (správně, nečlen talkback mít nemůže).

**Ruling 6 — doména vynucuje R6 i u neznámého muzikanta a u cizí skupiny.** Spec R6 říká, že výběr nabízí jen muzikanty dané skupiny; R13 mezi chybami vyjmenovává jen „muzikant ve dvou skupinách". Doména navíc odmítne id, které není v katalogu, a muzikanta s `group` jinou než skupina sestavy. Ověřeno, že všechny 4 kapely v APPDATA tuto podmínku splňují (sestava ↔ `musician.group` bez odchylky). — Cena: kapelu se smazaným muzikantem nejde uložit, dokud ho uživatel ze sestavy neodebere (formulář ho ukáže pod jeho id).

**Ruling 7 — seznam kapel bere počet členů a štítek z `read_band` pro každou kapelu.** Spec R12 chce v seznamu počet členů a štítek „neúplná", ale `list_bands` vrací jen `{ id, name, code }` (`lib.rs:43-47`) a podle specu („Co se nemění") se nemění. `listBandSummaries` proto zavolá `list_bands` a pak `read_band` pro každou položku. — Cena: N+1 lokálních čtení souboru; u desítek kapel zanedbatelné.

**Ruling 8 — `read_band`/`write_band` adresují soubor `catalog/bands/<id>.json`; nečitelná kapela je chybový řádek seznamu, ne pád celého seznamu (rozhodnutí uživatele 2026-10-06).** `get_band_setup_data` kapelu hledá skenem podle `id` (`lib.rs:891-950`), ale pipeline čte kontakt podle jména souboru (`exportPdf.ts:85-90`) a zápis potřebuje jednoznačnou cestu. Ověřeno: u všech 4 kapel v APPDATA je jméno souboru rovno id. Když `read_band` pro kapelu ze seznamu vrátí `null` (soubor `<id>.json` chybí, typicky ručně přejmenovaný soubor) nebo selže (nečitelný soubor, neplatný JSON — zpráva z Rustu nese cestu), `listBandSummaries` vrátí pro tuto kapelu položku `{ kind: "error", id, name, message }` s `id` a `name` z `list_bands`; ostatní kapely zůstanou `kind: "ok"` a použitelné. `LibraryBandsPage` ji vykreslí jako chybový řádek se zprávou (cestou) a bez odkazu na úpravu, a jedním toastem ohlásí počet nečitelných kapel — nic se tiše nepolyká. **Hranice:** `list_bands` sám (`lib.rs:799-855`) parsuje každý soubor v `catalog/bands/` a při neplatném JSON selže celý (`lib.rs:819-824`); spec („Co se nemění“) ho zakazuje měnit. Soubor s neplatným JSON proto dál shodí celý seznam (zpráva bez cesty, Ruling 17) — per-item větev pokryje neplatný JSON jen tehdy, když ho potká až `read_band`. Pokrýt i tento případ by znamenalo změnit `list_bands`, což je rozhodnutí nad rámec specu. — Cena: ručně přejmenovaný soubor kapely jde v seznamu vidět, ale upravit až po vrácení názvu na `<id>.json`.

**Ruling 9 — `write_band`/`write_contact` přijímají JSON jako **string**, ne `Value`.** Spec R10: „ověří jen parsovatelnost". `serde_json` bez `preserve_order` (`Cargo.toml`) by při zápisu `Value` seřadil klíče abecedně; string se zapíše přesně tak, jak ho postavila doména (`JSON.stringify(band, null, 2)`). Stejný vzor má `save_project` (`lib.rs:1237-1262`, `json: String`). — Cena: žádná.

**Ruling 10 — po uložení se obnoví seznam kapel v shellu.** `useProjectsHubData` načte kapely jen při startu (`useProjectsHubData.ts:129-133`). Bez obnovy by ruční krok 6 specu („Založení projektu nabídne novou kapelu") selhal. Hook začne vracet `refreshBands` a formulář ho zavolá přes `onBandSaved`. — Cena: jeden prop navíc v `ShellRouter`.

**Ruling 11 — `/library/bands` zůstává jako alias seznamu.** Spec R15 maže čtyři routy a `library-bands` mezi nimi není; cestu `/library/bands` používají testy chrome (`processSteps.test.ts:20`, `windowChrome.test.ts:19`, `shellChrome.test.tsx:39`). Obě cesty vykreslí `LibraryBandsPage`. — Cena: žádná.

**Ruling 12 — `AddMusiciansMultiSelect` rozhraním prošel a vytáhne se beze změny do vlastního souboru.** Spec R12 to podmiňuje. Rozhraní (`ProjectSetupPage.tsx:175-182`: `id, options: MemberOption[], selectedIds, placeholder, onSelectionChange, onAddSelected`) pokrývá výběr muzikantů skupiny přesně. Komponenta není exportovaná, proto Task 9 ji přesune do `packages/desktop/src/app/components/roles/AddMusiciansMultiSelect.tsx` (vedle `LineupRow.tsx`). — Cena: `ProjectSetupPage.tsx` nemá test; přesun ověří tsc a ruční krok.

**Ruling 13 — u existující kapely se zkratka považuje za ručně zadanou** (`codeTouched: true`). Spec R5 mluví o živém dopočtu „dokud uživatel pole needituje"; u uložené kapely by dopočet při přejmenování tiše změnil `BNB` v názvu PDF. — Cena: kdo přejmenuje kapelu a chce novou zkratku, přepíše ji ručně.

**Ruling 14 — „předvyplněno skupinou `vocs`" (R8) = přidání muzikanta do skupiny `vocs` ho zaškrtne jako lead vokál.** U úpravy je zdrojem uložené `leadVocals`. — Cena: uživatel, který nechce vokalistu jako lead, ho odškrtne.

**Ruling 15 — CSS.** `.library-table`/`.library-row` (`styles/features/library.css`) a `.lineup-card` (`lineup.css:43-51`) **zůstávají**, protože je nové stránky znovu použijí. Mažou se jen pravidla, která po Tasku 12 nemají uživatele (ověřeno grepem přesného tokenu přes `packages/desktop/src/**/*.{ts,tsx}`): `.lineup-grid` (`lineup.css:5-8`) a selektory `.project-actions` (`hub.css:70`, `:87`, `:92-96`). `.form-grid` má dál uživatele (`NewEventProjectPage.tsx:257`, `NewGenericProjectPage.tsx:226`) a zůstává. — Cena: žádná.

**Ruling 16 — štítek „neúplná" je v UI anglicky `Incomplete`** (R12, poslední odrážka: jazyk rozhraní anglicky).

**Ruling 17 — rozpor specu s repem, který plán neopravuje:** `list_bands` hlásí rozbitý soubor kapely bez cesty (`lib.rs:819-824`, `"Invalid band JSON: {}"`). R13 chce cestu v toastu u *formuláře* — ten čte přes `read_band`, který cestu nese. Seznam kapel ji při rozbitém souboru mít nebude, protože spec `list_bands` zakazuje měnit. Stejně tak `get_band_setup_data` dál čte legacy pole `members` (`lib.rs:1047-1085`); mimo rozsah.

**Ruling 18 — souběh u `expectNew` je check-then-write.** `write_band` zkontroluje existenci a pak zapíše přes `atomic_write_bytes`, jehož `fs::rename` cíl přepíše (`storage_paths.rs:1314-1320`). Okno mezi kontrolou a zápisem je v řádu milisekund a týká se dvou oken téže aplikace. — Cena: teoretický přepis při současném uložení stejného názvu ve dvou oknech.

**Ruling 19 — jméno muzikanta v UI i v chybách domény je `Příjmení Jméno`**, stejně jako `MemberOption` z Rustu (`resolve_musician_display_name`, `lib.rs:489-507`) na obrazovce `01 LINEUP`.

---

## Pořadí tasků a proč

| Krok | Tasky | Co | Proč tady |
|---|---|---|---|
| **A — doména** | 1–5 | slug, zkratka, typ `Contact`, `buildBandFromDraft`, kontext a souhrn | čistá logika pod vitestem; všechno další na ní stojí |
| **B — Rust** | 6 | šest nových příkazů, sdílený loader presetů | aditivní; staré příkazy zatím žijí |
| **C — desktop služby** | 7–9 | `bandsApi.ts`, model formuláře, vytažení multiselectu | testovatelné bez UI; Task 9 je čistý přesun |
| **D — stránky** | 10–11 | `LibraryBandsPage`, `LibraryBandFormPage` + komponenty | zatím nezaroutované a neexportované z `pages/index.ts`, takže nekolidují se jménem starého `LibraryBandsPage` |
| **E — přepnutí a úklid** | 12–13 | router na nové stránky + smazání TS lešení; pak smazání Rust lešení | TS první: mezi Taskem 12 a 13 jsou staré příkazy v Rustu jen neregistrovaný mrtvý kód z pohledu UI, ne visící importy |

**Mezistav každého commitu drží baseline:** žádný task nemaže symbol, který jiný soubor v témže stavu ještě importuje. Task 12 maže `components/library/`, `ShellPages.tsx` a typy `Library*` **v jednom commitu** s přepnutím routeru, protože jsou navzájem provázané importy.

## Seznam tasků

| # | Název | Jednou větou |
|---|---|---|
| 1 | `toIdSlug` do `src/domain/ids/slug.ts` + `deriveBandId` | Přesun pravidla id do domény, s odstraněním diakritiky (Ruling 1). |
| 2 | `bandCode.ts` — odvození, normalizace a validace zkratky | R5 jako tři čisté funkce. |
| 3 | Typ `Contact` zvednutý z `exportPdf.ts` do `types.ts` | Jediná změna `types.ts`, kterou spec dovoluje. |
| 4 | `buildBandFromDraft` — draft → kanonická kapela + kontakt, nebo chyby polí | Jádro R9/R13, diskriminovaná unie, žádné výjimky. |
| 5 | `buildBandDraftContext` + `summarizeBand` | Kontext z katalogových seznamů (vč. `canSing`) a štítek „neúplná". |
| 6 | Rust: `list_catalog_musicians`, `list_presets`, `read_band`, `read_contact`, `write_band`, `write_contact` | R10 nad čistými `*_at(dir)` funkcemi s cargo testy; loader presetů sdílený s `get_band_setup_data`. |
| 7 | `tauriCommands.ts` + `bandsApi.ts` (`saveBandDraft`, `loadBandFormData`, `listBandSummaries`) | R11: pořadí kontakt → kapela, chyba domény nezapíše nic. |
| 8 | `bandFormModel.ts` — přechody stavu formuláře | Dopočet zkratky, přidání/odebrání člena, kontakt, převod na `BandDraft`. |
| 9 | Vytažení `AddMusiciansMultiSelect` do `app/components/roles/` | Čistý přesun beze změny chování (Ruling 12). |
| 10 | `LibraryBandsPage.tsx` — seznam kapel | Název, zkratka, počet členů, štítek, prázdný stav. |
| 11 | `LibraryBandFormPage.tsx` + `components/band/*` | Formulář o čtyřech blocích, guard, toasty, přesměrování po založení. |
| 12 | Přepnutí routeru a smazání TS lešení Library — **jeden commit** | Routy, `ShellPages.tsx`, `components/library/`, typy `Library*`, `refreshBands`, osiřelé CSS. |
| 13 | Rust: smazání 17 příkazů `*_library_*` a jejich struktur | `update_musician_defaults` s `load_library_map`/`save_library_map` zůstává. |

Po Tasku 13: **Ruční ověření** (sekce na konci plánu) — dělá člověk.

---

## Tasky

## KROK A — doména

### Task 1: `toIdSlug` do `src/domain/ids/slug.ts` + `deriveBandId`

**Files:**
- Create: `src/domain/ids/slug.ts`
- Create: `src/domain/ids/slug.test.ts`
- Create: `src/domain/band/bandId.ts`
- Create: `src/domain/band/bandId.test.ts`
- Modify: `packages/desktop/src/app/pages/shared/projectHubUtils.ts:17-24` (smazat `toIdSlug`)
- Modify: `packages/desktop/src/app/pages/components/library/LibraryPages.tsx:4` (import z domény)

**Interfaces:**
- Consumes: nic.
- Produces:
  - `stripDiacritics(value: string): string` — `src/domain/ids/slug.ts`. Task 2 na ní staví.
  - `toIdSlug(value: string): string` — `src/domain/ids/slug.ts`.
  - `ID_SLUG_MAX_LENGTH = 50` — `src/domain/ids/slug.ts`.
  - `deriveBandId(name: string): string` — `src/domain/band/bandId.ts`. Task 4 na ní staví.

**Kontext, který nesmíš přehlédnout**

Dnešní implementace (`projectHubUtils.ts:17-24`):

```ts
export function toIdSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50);
}
```

Diakritiku neodstraňuje (`"Blanická kapela"` → `"blanick_kapela"`), ale reálný soubor se jmenuje `blanicka_kapela.json`. Spec R4 chce „bez diakritiky" — Ruling 1. Jediný konzument je `LibraryPages.tsx` (řádky 4, 155, 553), který Task 12 smaže; do té doby se jen přepojí import.

- [ ] **Krok 1: Ověř, že `toIdSlug` nemá jiného konzumenta**

```bash
cd /c/Users/mkrecmer/dev/stagepilot
grep -rn "toIdSlug" --include=*.ts --include=*.tsx src packages | grep -v node_modules
```

Expected: přesně 4 řádky — `LibraryPages.tsx:4`, `:155`, `:553` a `projectHubUtils.ts:17`. Jiný výsledek → zastav se a eskaluj.

- [ ] **Krok 2: Napiš padající testy**

`src/domain/ids/slug.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ID_SLUG_MAX_LENGTH, stripDiacritics, toIdSlug } from "./slug";

describe("stripDiacritics", () => {
  it("removes Czech diacritics and keeps the base letters", () => {
    expect(stripDiacritics("Žluťoučký kůň úpěl ďábelské ódy")).toBe(
      "Zlutoucky kun upel dabelske ody",
    );
  });
});

describe("toIdSlug", () => {
  it("lowercases and joins words with underscores", () => {
    expect(toIdSlug("Big Night Band")).toBe("big_night_band");
  });

  it("strips diacritics so the id matches the real catalog file name", () => {
    expect(toIdSlug("Blanická kapela")).toBe("blanicka_kapela");
  });

  it("collapses runs of separators and trims them at both ends", () => {
    expect(toIdSlug("  --Party   Leaders!!  ")).toBe("party_leaders");
  });

  it("keeps digits", () => {
    expect(toIdSlug("4 Seasons 2026")).toBe("4_seasons_2026");
  });

  it("returns an empty string when nothing alphanumeric is left", () => {
    expect(toIdSlug("!!! ---")).toBe("");
  });

  it("caps the id at 50 characters", () => {
    expect(toIdSlug("a".repeat(80))).toHaveLength(ID_SLUG_MAX_LENGTH);
  });

  it("never ends with an underscore after the 50-character cut", () => {
    expect(toIdSlug(`${"a".repeat(49)} band`)).toBe("a".repeat(49));
  });
});
```

`src/domain/band/bandId.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { deriveBandId } from "./bandId";

describe("deriveBandId", () => {
  it("derives the ids of the existing catalog bands from their names", () => {
    expect(deriveBandId("Big Night Band")).toBe("big_night_band");
    expect(deriveBandId("Blanická kapela")).toBe("blanicka_kapela");
    expect(deriveBandId("Couple of Sounds")).toBe("couple_of_sounds");
  });

  it("returns an empty id for a name without letters or digits", () => {
    expect(deriveBandId("   ")).toBe("");
  });
});
```

- [ ] **Krok 3: Spusť testy a ověř, že padají**

Run: `npx vitest run src/domain/ids/slug.test.ts src/domain/band/bandId.test.ts`
Expected: FAIL — `Failed to resolve import "./slug"` a `"./bandId"`.

- [ ] **Krok 4: Implementuj**

`src/domain/ids/slug.ts`:

```ts
// Co? Pravidlo pro id odvozené z lidského názvu (R4 specu editoru kapely).
// Proč v doméně? Id vzniká v UI, ale musí sedět s tím, co čte pipeline
// (`catalogRepository`) a co Rust pustí do jména souboru
// (`sanitize_id_to_filename`). Jedno pravidlo, jedno místo.

// `\p{M}` = všechny kombinující znaky. Rozsah `[\u0300-\u036f]` by Biome
// odmítl pravidlem `lint/suspicious/noMisleadingCharacterClass` (ověřeno).
const COMBINING_MARKS = /\p{M}/gu;

export const ID_SLUG_MAX_LENGTH = 50;

/** `Blanická` → `Blanicka`: rozklad na NFD a zahození kombinující diakritiky. */
export function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(COMBINING_MARKS, "");
}

/**
 * Malá písmena, bez diakritiky, běhy nealfanumerických znaků na `_`,
 * oříznutá podtržítka, nejvýš 50 znaků. Podtržítko, které vznikne řezem
 * na 50 znaků, se ořízne taky, aby id nekončilo `_`.
 */
export function toIdSlug(value: string): string {
  return stripDiacritics(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, ID_SLUG_MAX_LENGTH)
    .replace(/_+$/g, "");
}
```

`src/domain/band/bandId.ts`:

```ts
import { toIdSlug } from "../ids/slug.js";

/**
 * R4: id kapely je slug jejího názvu. Vzniká jednou při založení a dál se
 * nemění ani při přejmenování, protože projekty na kapelu odkazují přes
 * `bandRef`.
 */
export function deriveBandId(name: string): string {
  return toIdSlug(name);
}
```

- [ ] **Krok 5: Přepoj jediného konzumenta a smaž starou kopii**

V `packages/desktop/src/app/pages/shared/projectHubUtils.ts` smaž celou funkci `toIdSlug` (řádky 17-24) i prázdný řádek před ní. Zbytek souboru (`formatProjectDate`, `getProjectPurposeLabel`) se nemění.

V `packages/desktop/src/app/pages/components/library/LibraryPages.tsx` nahraď řádek 4:

```ts
import { toIdSlug } from "../../shared/projectHubUtils";
```

řádkem:

```ts
import { toIdSlug } from "../../../../../../../src/domain/ids/slug";
```

(7× nahoru: `library → components → pages → app → src → desktop → packages`.)

- [ ] **Krok 6: Spusť testy a ověř, že prošly**

Run: `npx vitest run src/domain/ids/slug.test.ts src/domain/band/bandId.test.ts`
Expected: PASS — 10 testů (8 + 2).

- [ ] **Krok 7: Ověř, že se nic jiného nerozbilo**

```bash
npm test 2>&1 | tail -6
npx tsc --noEmit 2>&1 | grep -c "error TS"
npx tsc -p packages/desktop/tsconfig.json --noEmit 2>&1 | grep -c "error TS"
grep -rn "toIdSlug" --include=*.ts --include=*.tsx src packages | grep -v node_modules
```

Expected:
- `Test Files  2 failed | 168 passed (170)`, `Tests  2 failed | 1275 passed (1277)` — baseline + 10, tytéž dvě padající.
- root tsc: `0`; desktop tsc: `14` (tytéž soubory a texty jako v baseline).
- grep: `slug.ts` (definice), `slug.test.ts`, `bandId.ts`, `LibraryPages.tsx` ×3. Žádný výskyt v `projectHubUtils.ts`.

- [ ] **Krok 8: Lint**

Nové soubory: `npx biome check --write src/domain/ids/slug.ts src/domain/ids/slug.test.ts src/domain/band/bandId.ts src/domain/band/bandId.test.ts`, pak totéž bez `--write` → 0 chyb. Upravené `projectHubUtils.ts` a `LibraryPages.tsx`: recept z Global Constraints, HEAD vs BASE → delta 0.

- [ ] **Krok 9: Commit**

```bash
git add src/domain/ids/slug.ts src/domain/ids/slug.test.ts src/domain/band/bandId.ts src/domain/band/bandId.test.ts packages/desktop/src/app/pages/shared/projectHubUtils.ts packages/desktop/src/app/pages/components/library/LibraryPages.tsx
git commit -m "refactor(band): move toIdSlug into the domain and strip diacritics from band ids"
```

---

### Task 2: `bandCode.ts` — odvození, normalizace a validace zkratky

**Files:**
- Create: `src/domain/band/bandCode.ts`
- Create: `src/domain/band/bandCode.test.ts`

**Interfaces:**
- Consumes: `stripDiacritics(value: string): string` z Tasku 1.
- Produces (vše z `src/domain/band/bandCode.ts`):
  - `BAND_CODE_MAX_LENGTH = 6`
  - `deriveBandCode(name: string): string` — Task 8 (živý dopočet ve formuláři).
  - `normalizeBandCode(raw: string): string` — Task 4.
  - `isValidBandCode(code: string): boolean` — Task 4.

**Kontext**

R5: víceslovný název → iniciály velkými písmeny bez diakritiky, nejvýš 6; jednoslovný → první tři písmena; po normalizaci (velká písmena, bez diakritiky, bez mezer) musí platit `[A-Z0-9]{2,6}`. Zkratka jde do názvu PDF (`src/domain/projectNaming.ts`, `formatProjectSlug`), proto jen ASCII alfanumerika. Odvozená zkratka nemusí být platná (název „A" → `A`) — to je správně, validace ji odmítne a uživatel ji přepíše.

- [ ] **Krok 1: Napiš padající testy**

`src/domain/band/bandCode.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  BAND_CODE_MAX_LENGTH,
  deriveBandCode,
  isValidBandCode,
  normalizeBandCode,
} from "./bandCode";

describe("deriveBandCode", () => {
  it("takes the initials of a multi-word name without diacritics", () => {
    expect(deriveBandCode("Big Night Band")).toBe("BNB");
    expect(deriveBandCode("Blanická kapela")).toBe("BK");
    expect(deriveBandCode("Žluťoučký kůň")).toBe("ZK");
  });

  it("takes the first three letters of a one-word name", () => {
    expect(deriveBandCode("Metallica")).toBe("MET");
    expect(deriveBandCode("U2")).toBe("U2");
  });

  it("keeps digits as initials", () => {
    expect(deriveBandCode("4 Seasons Band")).toBe("4SB");
  });

  it("caps the initials at six characters", () => {
    const code = deriveBandCode("One Two Three Four Five Six Seven");
    expect(code).toBe("OTTFFS");
    expect(code).toHaveLength(BAND_CODE_MAX_LENGTH);
  });

  it("splits words on hyphens and punctuation", () => {
    expect(deriveBandCode("Rock-n-Roll Band")).toBe("RNRB");
  });

  it("returns an empty code for a name without letters or digits", () => {
    expect(deriveBandCode("  !!  ")).toBe("");
  });
});

describe("normalizeBandCode", () => {
  it("uppercases, strips diacritics and removes whitespace", () => {
    expect(normalizeBandCode(" bnb ")).toBe("BNB");
    expect(normalizeBandCode("b n b")).toBe("BNB");
    expect(normalizeBandCode("čk")).toBe("CK");
  });
});

describe("isValidBandCode", () => {
  it("accepts two to six upper-case letters or digits", () => {
    expect(isValidBandCode("BNB")).toBe(true);
    expect(isValidBandCode("B2")).toBe(true);
    expect(isValidBandCode("ABCDEF")).toBe(true);
  });

  it("rejects too short, too long, lower-case and punctuated codes", () => {
    expect(isValidBandCode("B")).toBe(false);
    expect(isValidBandCode("ABCDEFG")).toBe(false);
    expect(isValidBandCode("bnb")).toBe(false);
    expect(isValidBandCode("BN-B")).toBe(false);
    expect(isValidBandCode(deriveBandCode("A"))).toBe(false);
  });
});
```

- [ ] **Krok 2: Spusť a ověř pád**

Run: `npx vitest run src/domain/band/bandCode.test.ts`
Expected: FAIL — `Failed to resolve import "./bandCode"`.

- [ ] **Krok 3: Implementuj**

`src/domain/band/bandCode.ts`:

```ts
import { stripDiacritics } from "../ids/slug.js";

// Co? Zkratka kapely (R5 specu editoru kapely).
// Proč tak přísně? Zkratka jde do názvu PDF (`formatProjectSlug`) a
// `catalogRepository` ji mapuje jako alias odkazu na kapelu
// (`code.toLowerCase()`), takže musí být krátká, ASCII a jednoznačná.

export const BAND_CODE_MAX_LENGTH = 6;

const SINGLE_WORD_CODE_LENGTH = 3;
const BAND_CODE_PATTERN = /^[A-Z0-9]{2,6}$/;

/**
 * Víceslovný název → iniciály (nejvýš 6), jednoslovný → první tři znaky.
 * Výsledek nemusí být platný (název „A" dá `A`); o tom rozhoduje
 * `isValidBandCode` až při uložení.
 */
export function deriveBandCode(name: string): string {
  const words = stripDiacritics(name)
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter((word) => word.length > 0);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, SINGLE_WORD_CODE_LENGTH);
  return words
    .map((word) => word[0])
    .join("")
    .slice(0, BAND_CODE_MAX_LENGTH);
}

/** Ruční vstup → tvar, který se ukládá: velká písmena, bez diakritiky a mezer. */
export function normalizeBandCode(raw: string): string {
  return stripDiacritics(raw).toUpperCase().replace(/\s+/g, "");
}

export function isValidBandCode(code: string): boolean {
  return BAND_CODE_PATTERN.test(code);
}
```

- [ ] **Krok 4: Spusť a ověř průchod**

Run: `npx vitest run src/domain/band/bandCode.test.ts`
Expected: PASS — 9 testů.

- [ ] **Krok 5: Celá sada**

```bash
npm test 2>&1 | tail -6
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: `Tests  2 failed | 1284 passed (1286)`, `Test Files  2 failed | 169 passed (171)`; root tsc `0`.

- [ ] **Krok 6: Lint**

`npx biome check --write src/domain/band/bandCode.ts src/domain/band/bandCode.test.ts`, pak bez `--write` → 0 chyb.

- [ ] **Krok 7: Commit**

```bash
git add src/domain/band/bandCode.ts src/domain/band/bandCode.test.ts
git commit -m "feat(band): derive, normalise and validate band codes in the domain"
```

---

### Task 3: Typ `Contact` zvednutý z `exportPdf.ts` do `types.ts`

**Files:**
- Modify: `src/domain/model/types.ts` (za interface `Band`, který končí na řádku 233)
- Modify: `src/app/usecases/exportPdf.ts:4` (import), `:33-39` (smazat `ContactEntity`), `:56`, `:90`
- Test: beze změny — `src/app/usecases/formatContactLine.test.ts` a `src/app/usecases/exportPdfContactLine.test.ts` musí zůstat zelené.

**Interfaces:**
- Consumes: nic.
- Produces: `Contact` z `src/domain/model/types.ts`:
  ```ts
  export interface Contact {
    readonly id: string;
    readonly firstName: string;
    readonly lastName: string;
    readonly phone?: string;
    readonly email?: string;
  }
  ```
  Task 4 ho vrací, Task 7 ho zapisuje, Task 8 z něj předvyplňuje formulář.

**Kontext**

Spec („Co se nemění"): do `types.ts` nic nového kromě zvednutí typu `Contact` z `exportPdf.ts`. Dnešní lokální typ (`exportPdf.ts:33-39`):

```ts
type ContactEntity = {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
};
```

Je použitý na `:56` (`formatContactLine(args: { contact: ContactEntity })`) a `:90` (`loadJsonFile<ContactEntity>(contactPath)`). V `types.ts` žádné jméno `Contact` zatím není (ověřeno grepem); v desktopu existuje jen `LibraryContact`, který zmizí v Tasku 12.

- [ ] **Krok 1: Přidej typ do `types.ts`**

Za uzavírací `}` interface `Band` (`src/domain/model/types.ts:233`, řádek po `logoFile?: string;`) vlož:

```ts

/**
 * Kontaktní osoba kapely: `catalog/contacts/<id>.json`. Id je id muzikanta
 * ze sestavy (R2 specu editoru kapely); jméno se přebírá z muzikanta.
 * Soubor nemá vlastníka — sdílí ho každá kapela, která na něj ukazuje
 * přes `defaultContactId`.
 */
export interface Contact {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly phone?: string;
  readonly email?: string;
}
```

- [ ] **Krok 2: Přepoj `exportPdf.ts`**

Řádek 4:

```ts
import type { Project, ProjectJson } from "../../domain/model/types.js";
```

nahraď:

```ts
import type { Contact, Project, ProjectJson } from "../../domain/model/types.js";
```

Smaž blok `type ContactEntity = { … };` (řádky 33-39) včetně prázdného řádku za ním. Na řádku s `contact: ContactEntity;` (dnes 56) a v `loadJsonFile<ContactEntity>(contactPath)` (dnes 90) nahraď `ContactEntity` → `Contact`.

- [ ] **Krok 3: Ověř, že `ContactEntity` zmizel a nic se nerozbilo**

```bash
grep -rn "ContactEntity" src packages --include=*.ts --include=*.tsx | grep -v node_modules
npx vitest run src/app/usecases/formatContactLine.test.ts src/app/usecases/exportPdfContactLine.test.ts
npm test 2>&1 | tail -6
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: grep prázdný; oba soubory PASS; `Tests  2 failed | 1284 passed (1286)` (beze změny proti Tasku 2); root tsc `0`.

- [ ] **Krok 4: Lint**

Recept z Global Constraints pro `src/domain/model/types.ts` a `src/app/usecases/exportPdf.ts`, HEAD vs BASE → delta 0.

- [ ] **Krok 5: Commit**

```bash
git add src/domain/model/types.ts src/app/usecases/exportPdf.ts
git commit -m "refactor(pdf): lift the Contact type from exportPdf into the domain model"
```

---
### Task 4: `buildBandFromDraft` — draft → kanonická kapela + kontakt, nebo chyby polí

**Files:**
- Create: `src/domain/band/buildBandFromDraft.ts`
- Create: `src/domain/band/buildBandFromDraft.test.ts`

**Interfaces:**
- Consumes:
  - `deriveBandId(name: string): string` (Task 1)
  - `normalizeBandCode(raw: string): string`, `isValidBandCode(code: string): boolean` (Task 2)
  - `Contact` (Task 3)
  - existující, ověřené signatury:
    - `normalizeBandToCanonicalShape(band: Band): Band` — `src/domain/model/bandLineup.ts:135`
    - `validateCanonicalBandModel(band: Band): void` (vyhazuje) — `bandLineup.ts:161`
    - `getAllLineupMemberIds(lineup: DefaultLineup): string[]` — `bandLineup.ts:12` (pořadí `GROUP_ORDER`, deduplikované)
    - `normalizeLineupAssignments(value: unknown): LineupAssignments`, `LINEUP_ASSIGNMENT_ROLES`, `type LineupAssignments`, `type LineupRole` — `src/domain/lineup/lineupAssignments.ts:1-53` (jen pět rolí bez `talkback`, trim + deduplikace uvnitř skupiny)
    - `deriveVocalOverlaysFromLineup(args: { lineupMusicianIds: readonly string[]; leadVocalIds: readonly string[]; backVocalIds?: readonly string[]; canSing: (musicianId: string) => boolean }): DerivedVocalOverlays` — `src/domain/project/deriveVocalOverlaysFromLineup.ts:35`
- Produces (vše z `src/domain/band/buildBandFromDraft.ts`):
  ```ts
  export type BandDraftField = "name" | "code" | "lineup" | "bandLeader" | "leadVocals" | "contact";
  export type BandDraftError = { readonly field: BandDraftField; readonly message: string };
  export type BandDraftContact = { readonly musicianId: string; readonly phone?: string; readonly email?: string };
  export type BandDraft = {
    readonly name: string;
    readonly code: string;
    readonly bandLeaderId?: string;
    readonly lineup: Partial<Record<Group, readonly string[]>>;
    readonly leadVocalIds: readonly string[];
    readonly contact?: BandDraftContact;
    readonly existingId?: string;
  };
  export type BandDraftContext = {
    readonly existingBandIds: ReadonlySet<string>;   // ostatní kapely, lowercase
    readonly existingCodes: ReadonlySet<string>;     // ostatní kapely, lowercase
    readonly musiciansById: Readonly<Record<string, Musician | undefined>>;
    readonly canSing: (musicianId: string) => boolean;
    readonly reservedIds?: ReadonlySet<string>;      // Ruling 3
    readonly existingBand?: Band;                    // Ruling 4
  };
  export type BuildBandResult =
    | { readonly ok: true; readonly band: Band; readonly contact?: Contact }
    | { readonly ok: false; readonly errors: readonly BandDraftError[] };
  export function buildBandFromDraft(draft: BandDraft, context: BandDraftContext): BuildBandResult;
  ```
  Tasky 5, 7, 8 a 11 na těchto jménech staví.

**Kontext, který nesmíš přehlédnout**

1. **Funkce nevyhazuje** (R9). Výjimky z `normalizeBandToCanonicalShape`/`validateCanonicalBandModel` se chytí a převedou na chybu pole. Pravidla z R13 se ale kontrolují **explicitně před nimi**, aby zprávy byly lidské a aby se sesbíraly všechny najednou.
2. **Lead vokál mimo sestavu musí být chyba**, ne tichý zahoz: `deriveVocalOverlaysFromLineup` (`:44-46`) lead vokály se sestavou jen protne. Proto kontrola v `collectRoleErrors` běží dřív.
3. **`backVocals` se nečtou z draftu** (R8): vždy `deriveVocalOverlaysFromLineup` s `canSing`. Pořadí = pořadí sestavy (`GROUP_ORDER`), tedy u Big Night Band `plasil_pavel, krecmer_matej, zidek_jakub` — přesně jako reálný soubor.
4. **Duplicita uvnitř skupiny se tiše srovná** (`normalizeLineupAssignments` deduplikuje), duplicita **napříč skupinami** je chyba pole `lineup` (R13).
5. **Kolize id a zkratky napříč jmennými prostory** (Ruling 2), **rezervované id** (Ruling 3), **zachování `notesTemplateRef`/`logoFile`** (Ruling 4), **talkback owner** (Ruling 5), **neznámý muzikant a cizí skupina** (Ruling 6).
6. Kapela bez sestavy: `bandLeader`, `bandLeaderId` i `defaultTalkbackOwnerId` vyjdou z normalizace jako `""`. Je to tvar, který `normalizeBandToCanonicalShape` produkuje sám (`bandLineup.ts:146-157`); `catalogRepository` takovou kapelu načte a kapelníka vynutí až `validateBandLeader` při stavbě dokumentu (R1).
7. Jméno muzikanta ve zprávách je `Příjmení Jméno` (Ruling 19).

- [ ] **Krok 1: Ověř tvar reálné kapely, proti které je fixtura**

Ulož do `$SCRATCH/verify-bnb.mjs`:

```js
import { readFileSync } from "node:fs";
import { join } from "node:path";

const file = join(process.env.APPDATA, "StagePilot", "catalog", "bands", "big_night_band.json");
const band = JSON.parse(readFileSync(file, "utf8"));
console.log(
  JSON.stringify(
    {
      keys: Object.keys(band).sort(),
      leader: band.bandLeaderId,
      lineup: band.defaultLineup,
      overlays: band.defaultOverlays,
    },
    null,
    2,
  ),
);
```

Run: `node "$SCRATCH/verify-bnb.mjs"`

Expected (změřeno 2026-10-06): klíče `code, defaultContactId, defaultLineup, defaultOverlays, defaultTalkbackOwnerId, bandLeaderId, id, name, type` (bez `bandLeader`); `leader: "krecmer_matej"`; lineup `drums: [plasil_pavel], bass: [krecmer_matej], guitar: [pisa_karel], keys: [zidek_jakub], vocs: [krecmerova_eliska]`; overlays `leadVocals: [krecmerova_eliska], backVocals: [plasil_pavel, krecmer_matej, zidek_jakub]`. **Pokud se liší, fixturu v testu uprav podle reálného souboru a odchylku nahlas v reportu** — fixtura má odpovídat skutečnosti, ne tomuto plánu.

- [ ] **Krok 2: Napiš padající testy**

`src/domain/band/buildBandFromDraft.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Group } from "../model/groups";
import type { Band, Contact, Musician } from "../model/types";
import {
  type BandDraft,
  type BandDraftContext,
  type BuildBandResult,
  buildBandFromDraft,
} from "./buildBandFromDraft";

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
  musician("pisa_karel", "guitar", "Karel", "Píša"),
  musician("fuchs_tomas", "guitar", "Tomáš", "Fuchs"),
  musician("zidek_jakub", "keys", "Jakub", "Žídek"),
  musician("krecmerova_eliska", "vocs", "Eliška", "Krečmerová"),
  musician("holoubek_lukas", "vocs", "Lukáš", "Holoubek"),
];

const SINGERS = new Set([
  "plasil_pavel",
  "krecmer_matej",
  "zidek_jakub",
  "krecmerova_eliska",
  "holoubek_lukas",
]);

function context(overrides: Partial<BandDraftContext> = {}): BandDraftContext {
  return {
    existingBandIds: new Set(["blanicka_kapela"]),
    existingCodes: new Set(["bk"]),
    reservedIds: new Set(["new"]),
    musiciansById: Object.fromEntries(MUSICIANS.map((item) => [item.id, item])),
    canSing: (musicianId) => SINGERS.has(musicianId),
    ...overrides,
  };
}

const BNB_LINEUP = {
  drums: ["plasil_pavel"],
  bass: ["krecmer_matej"],
  guitar: ["pisa_karel"],
  keys: ["zidek_jakub"],
  vocs: ["krecmerova_eliska"],
};

function bnbDraft(overrides: Partial<BandDraft> = {}): BandDraft {
  return {
    name: "Big Night Band",
    code: "BNB",
    bandLeaderId: "krecmer_matej",
    lineup: BNB_LINEUP,
    leadVocalIds: ["krecmerova_eliska"],
    contact: {
      musicianId: "krecmer_matej",
      phone: "+420731247870",
      email: "matej@krecmer.eu",
    },
    ...overrides,
  };
}

function emptyDraft(overrides: Partial<BandDraft> = {}): BandDraft {
  return { name: "Nová kapela", code: "NK", lineup: {}, leadVocalIds: [], ...overrides };
}

const EXISTING_BNB: Band = {
  type: "band",
  id: "big_night_band",
  code: "BNB",
  name: "Big Night Band",
  bandLeader: "krecmer_matej",
  bandLeaderId: "krecmer_matej",
  defaultContactId: "krecmer_matej",
  defaultTalkbackOwnerId: "krecmer_matej",
  defaultLineup: BNB_LINEUP,
  defaultOverlays: {
    leadVocals: ["krecmerova_eliska"],
    backVocals: ["plasil_pavel", "krecmer_matej", "zidek_jakub"],
  },
};

function expectOk(result: BuildBandResult): { band: Band; contact?: Contact } {
  if (!result.ok) {
    throw new Error(`expected ok, got ${JSON.stringify(result.errors)}`);
  }
  return result;
}

function fieldsOf(result: BuildBandResult): string[] {
  return result.ok ? [] : result.errors.map((error) => error.field);
}

function messagesOf(result: BuildBandResult): string[] {
  return result.ok ? [] : result.errors.map((error) => error.message);
}

describe("buildBandFromDraft — valid drafts", () => {
  it("builds the canonical shape of big_night_band.json", () => {
    const { band } = expectOk(buildBandFromDraft(bnbDraft(), context()));

    expect(band).toEqual({
      type: "band",
      id: "big_night_band",
      code: "BNB",
      name: "Big Night Band",
      bandLeader: "krecmer_matej",
      bandLeaderId: "krecmer_matej",
      defaultTalkbackOwnerId: "krecmer_matej",
      defaultContactId: "krecmer_matej",
      defaultLineup: BNB_LINEUP,
      defaultOverlays: {
        leadVocals: ["krecmerova_eliska"],
        backVocals: ["plasil_pavel", "krecmer_matej", "zidek_jakub"],
      },
    });
  });

  it("builds the contact from the musician's name", () => {
    const { contact } = expectOk(buildBandFromDraft(bnbDraft(), context()));

    expect(contact).toEqual({
      id: "krecmer_matej",
      firstName: "Matěj",
      lastName: "Krečmer",
      phone: "+420731247870",
      email: "matej@krecmer.eu",
    });
  });

  it("trims the contact and omits an empty e-mail", () => {
    const { contact } = expectOk(
      buildBandFromDraft(
        bnbDraft({ contact: { musicianId: "krecmer_matej", phone: " +420 1 ", email: "  " } }),
        context(),
      ),
    );

    expect(contact).toEqual({
      id: "krecmer_matej",
      firstName: "Matěj",
      lastName: "Krečmer",
      phone: "+420 1",
    });
    expect(contact !== undefined && "email" in contact).toBe(false);
  });

  it("saves a band with only a name and a code", () => {
    const result = expectOk(buildBandFromDraft(emptyDraft(), context()));

    expect(result.band).toEqual({
      type: "band",
      id: "nova_kapela",
      code: "NK",
      name: "Nová kapela",
      bandLeader: "",
      bandLeaderId: "",
      defaultTalkbackOwnerId: "",
      defaultLineup: { drums: [], bass: [], guitar: [], keys: [], vocs: [] },
      defaultOverlays: { leadVocals: [], backVocals: [] },
    });
    expect(result.contact).toBeUndefined();
  });

  it("derives back vocals from canSing, not from the draft", () => {
    const { band } = expectOk(
      buildBandFromDraft(
        bnbDraft({
          lineup: { ...BNB_LINEUP, vocs: ["krecmerova_eliska", "holoubek_lukas"] },
        }),
        context(),
      ),
    );

    expect(band.defaultOverlays).toEqual({
      leadVocals: ["krecmerova_eliska"],
      backVocals: ["plasil_pavel", "krecmer_matej", "zidek_jakub", "holoubek_lukas"],
    });
  });

  it("normalises the code to upper case", () => {
    const { band } = expectOk(buildBandFromDraft(bnbDraft({ code: " bnb " }), context()));

    expect(band.code).toBe("BNB");
  });

  it("silently drops a duplicate inside one group", () => {
    const { band } = expectOk(
      buildBandFromDraft(
        bnbDraft({ lineup: { ...BNB_LINEUP, drums: ["plasil_pavel", "plasil_pavel"] } }),
        context(),
      ),
    );

    expect(band.defaultLineup.drums).toEqual(["plasil_pavel"]);
  });

  it("keeps existingId when a band is renamed", () => {
    const { band } = expectOk(
      buildBandFromDraft(
        bnbDraft({ name: "Big Night Orchestra", existingId: "big_night_band" }),
        context({ existingBand: EXISTING_BNB }),
      ),
    );

    expect(band.id).toBe("big_night_band");
    expect(band.name).toBe("Big Night Orchestra");
  });

  it("preserves notesTemplateRef and logoFile of the edited band", () => {
    const { band } = expectOk(
      buildBandFromDraft(
        bnbDraft({ existingId: "big_night_band" }),
        context({
          existingBand: { ...EXISTING_BNB, notesTemplateRef: "notes_custom", logoFile: "logo.png" },
        }),
      ),
    );

    expect(band.notesTemplateRef).toBe("notes_custom");
    expect(band.logoFile).toBe("logo.png");
  });

  it("keeps the edited band's talkback owner while they stay in the lineup", () => {
    const { band } = expectOk(
      buildBandFromDraft(
        bnbDraft({ existingId: "big_night_band" }),
        context({ existingBand: { ...EXISTING_BNB, defaultTalkbackOwnerId: "plasil_pavel" } }),
      ),
    );

    expect(band.defaultTalkbackOwnerId).toBe("plasil_pavel");
  });

  it("falls back to the band leader when the talkback owner left the lineup", () => {
    const { band } = expectOk(
      buildBandFromDraft(
        bnbDraft({ existingId: "big_night_band" }),
        context({ existingBand: { ...EXISTING_BNB, defaultTalkbackOwnerId: "nyvlt_jakub" } }),
      ),
    );

    expect(band.defaultTalkbackOwnerId).toBe("krecmer_matej");
  });

  it("drops defaultContactId when the contact is switched off", () => {
    const { band } = expectOk(
      buildBandFromDraft(
        bnbDraft({ existingId: "big_night_band", contact: undefined }),
        context({ existingBand: EXISTING_BNB }),
      ),
    );

    expect("defaultContactId" in band).toBe(false);
  });
});

describe("buildBandFromDraft — identity errors", () => {
  it("rejects an empty name", () => {
    expect(fieldsOf(buildBandFromDraft(emptyDraft({ name: "  " }), context()))).toEqual(["name"]);
  });

  it("rejects a name without letters or digits", () => {
    expect(fieldsOf(buildBandFromDraft(emptyDraft({ name: "!!!" }), context()))).toEqual(["name"]);
  });

  it("rejects a new band whose id already exists", () => {
    const result = buildBandFromDraft(
      emptyDraft({ name: "Blanická kapela", code: "BLK" }),
      context(),
    );

    expect(fieldsOf(result)).toEqual(["name"]);
    expect(messagesOf(result)).toEqual(["A band with this name already exists."]);
  });

  it("rejects an id that equals another band's code alias", () => {
    expect(fieldsOf(buildBandFromDraft(emptyDraft({ name: "BK", code: "BKX" }), context()))).toEqual([
      "name",
    ]);
  });

  it("rejects a reserved id", () => {
    expect(fieldsOf(buildBandFromDraft(emptyDraft({ name: "New", code: "NEW" }), context()))).toEqual([
      "name",
    ]);
  });

  it("rejects codes outside [A-Z0-9]{2,6}", () => {
    for (const code of ["B", "ABCDEFG", "B-1", ""]) {
      expect(fieldsOf(buildBandFromDraft(emptyDraft({ code }), context())), code).toEqual(["code"]);
    }
  });

  it("rejects a code another band uses, regardless of case", () => {
    expect(fieldsOf(buildBandFromDraft(emptyDraft({ code: "bk" }), context()))).toEqual(["code"]);
  });

  it("rejects a code that equals another band's id", () => {
    expect(
      fieldsOf(
        buildBandFromDraft(emptyDraft({ code: "PL2" }), context({ existingBandIds: new Set(["pl2"]) })),
      ),
    ).toEqual(["code"]);
  });
});

describe("buildBandFromDraft — lineup and role errors", () => {
  it("requires a band leader once the lineup is not empty", () => {
    expect(fieldsOf(buildBandFromDraft(bnbDraft({ bandLeaderId: undefined }), context()))).toEqual([
      "bandLeader",
    ]);
  });

  it("requires the band leader to be in the lineup", () => {
    expect(fieldsOf(buildBandFromDraft(bnbDraft({ bandLeaderId: "fuchs_tomas" }), context()))).toEqual([
      "bandLeader",
    ]);
  });

  it("rejects a lead vocalist outside the lineup instead of dropping them", () => {
    const result = buildBandFromDraft(
      bnbDraft({ leadVocalIds: ["krecmerova_eliska", "holoubek_lukas"] }),
      context(),
    );

    expect(fieldsOf(result)).toEqual(["leadVocals"]);
    expect(messagesOf(result)).toEqual(["Holoubek Lukáš is not in the lineup."]);
  });

  it("rejects a contact outside the lineup", () => {
    expect(
      fieldsOf(buildBandFromDraft(bnbDraft({ contact: { musicianId: "fuchs_tomas", phone: "1" } }), context())),
    ).toEqual(["contact"]);
  });

  it("rejects a contact without phone and e-mail", () => {
    expect(
      fieldsOf(
        buildBandFromDraft(
          bnbDraft({ contact: { musicianId: "krecmer_matej", phone: " ", email: "" } }),
          context(),
        ),
      ),
    ).toEqual(["contact"]);
  });

  it("rejects a musician placed in two groups", () => {
    const result = buildBandFromDraft(
      bnbDraft({ lineup: { ...BNB_LINEUP, vocs: ["krecmerova_eliska", "krecmer_matej"] } }),
      context(),
    );

    expect(fieldsOf(result)).toEqual(["lineup", "lineup"]);
    expect(messagesOf(result)).toContain("Krečmer Matěj is in both bass and vocs.");
  });

  it("rejects a musician from another group", () => {
    const result = buildBandFromDraft(
      bnbDraft({ lineup: { ...BNB_LINEUP, drums: ["pisa_karel"], guitar: [] } }),
      context(),
    );

    expect(fieldsOf(result)).toEqual(["lineup"]);
    expect(messagesOf(result)).toEqual(["Píša Karel plays guitar, not drums."]);
  });

  it("rejects a musician who is not in the library", () => {
    const result = buildBandFromDraft(
      bnbDraft({ lineup: { ...BNB_LINEUP, drums: ["ghost_drummer"] } }),
      context(),
    );

    expect(fieldsOf(result)).toEqual(["lineup"]);
    expect(messagesOf(result)).toEqual(["Musician 'ghost_drummer' is not in your library."]);
  });

  it("collects every error at once", () => {
    const fields = fieldsOf(
      buildBandFromDraft(
        emptyDraft({ name: "", code: "X", lineup: { bass: ["krecmer_matej"] } }),
        context(),
      ),
    );

    expect(fields).toEqual(expect.arrayContaining(["name", "code", "bandLeader"]));
  });
});
```

Počet: 12 (valid) + 8 (identity) + 9 (lineup/role) = **29 testů**.

Poznámka k testu „rejects codes outside…": `emptyDraft({ code })` má název „Nová kapela", takže jediná chyba je u zkratky. Prázdný kód `""` je zahrnutý záměrně — uživatel, který smaže dopočtenou zkratku, musí dostat chybu u pole.

- [ ] **Krok 3: Spusť a ověř pád**

Run: `npx vitest run src/domain/band/buildBandFromDraft.test.ts`
Expected: FAIL — `Failed to resolve import "./buildBandFromDraft"`.

- [ ] **Krok 4: Implementuj**

`src/domain/band/buildBandFromDraft.ts`:

```ts
import {
  LINEUP_ASSIGNMENT_ROLES,
  type LineupAssignments,
  type LineupRole,
  normalizeLineupAssignments,
} from "../lineup/lineupAssignments.js";
import {
  getAllLineupMemberIds,
  normalizeBandToCanonicalShape,
  validateCanonicalBandModel,
} from "../model/bandLineup.js";
import type { Group } from "../model/groups.js";
import type { Band, Contact, Musician } from "../model/types.js";
import { deriveVocalOverlaysFromLineup } from "../project/deriveVocalOverlaysFromLineup.js";
import { isValidBandCode, normalizeBandCode } from "./bandCode.js";
import { deriveBandId } from "./bandId.js";

export type BandDraftField =
  | "name"
  | "code"
  | "lineup"
  | "bandLeader"
  | "leadVocals"
  | "contact";

export type BandDraftError = {
  readonly field: BandDraftField;
  readonly message: string;
};

export type BandDraftContact = {
  readonly musicianId: string;
  readonly phone?: string;
  readonly email?: string;
};

export type BandDraft = {
  readonly name: string;
  readonly code: string;
  readonly bandLeaderId?: string;
  readonly lineup: Partial<Record<Group, readonly string[]>>;
  readonly leadVocalIds: readonly string[];
  readonly contact?: BandDraftContact;
  /** Id upravované kapely. Bez něj se kapela zakládá a id se odvodí z názvu (R4). */
  readonly existingId?: string;
};

export type BandDraftContext = {
  /** Id ostatních kapel malými písmeny — upravovaná kapela v nich není. */
  readonly existingBandIds: ReadonlySet<string>;
  /** Zkratky ostatních kapel malými písmeny — upravovaná kapela v nich není. */
  readonly existingCodes: ReadonlySet<string>;
  readonly musiciansById: Readonly<Record<string, Musician | undefined>>;
  readonly canSing: (musicianId: string) => boolean;
  /** Id, která nesmí vzniknout, protože kolidují s routou (`new`). */
  readonly reservedIds?: ReadonlySet<string>;
  /** Upravovaná kapela, jak leží na disku: zdroj polí, která formulář nespravuje. */
  readonly existingBand?: Band;
};

export type BuildBandResult =
  | { readonly ok: true; readonly band: Band; readonly contact?: Contact }
  | { readonly ok: false; readonly errors: readonly BandDraftError[] };

/**
 * Co? Jediný vstupní bod domény editoru kapely (R9): z draftu formuláře
 * postaví kanonickou kapelu a případný kontakt, nebo vrátí chyby polí.
 *
 * Proč unie a ne `throw`? Formulář chyby zobrazuje u polí a potřebuje je
 * všechny najednou. Výjimky z `normalizeBandToCanonicalShape` a
 * `validateCanonicalBandModel` se proto převádí na chybu pole; pravidla
 * z R13 se kontrolují explicitně dřív, aby zprávy byly čitelné.
 *
 * `backVocals` se nikdy nečtou z draftu: vždy se odvodí ze sestavy přes
 * `canSing` (R8), takže soubor má stejný tvar jako existující kapely.
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
  const memberIds = getAllLineupMemberIds(lineup);
  const members = new Set(memberIds);
  const bandLeaderId = (draft.bandLeaderId ?? "").trim();
  errors.push(...collectRoleErrors(bandLeaderId, draft.leadVocalIds, members, context));
  const contact = resolveContact(draft.contact, members, context, errors);
  if (errors.length > 0) return { ok: false, errors };

  const overlays = deriveVocalOverlaysFromLineup({
    lineupMusicianIds: memberIds,
    leadVocalIds: draft.leadVocalIds,
    canSing: context.canSing,
  });
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
        leadVocals: [...overlays.leadVocalIds],
        backVocals: [...overlays.backVocalIds],
      },
      ...pickUnmanagedFields(context.existingBand),
    },
    contact,
  );
}

function resolveBandId(
  draft: BandDraft,
  name: string,
  context: BandDraftContext,
  errors: BandDraftError[],
): string {
  if (!name) errors.push({ field: "name", message: "Enter the band name." });
  if (draft.existingId) return draft.existingId;
  if (!name) return "";
  const id = deriveBandId(name);
  if (!id) {
    errors.push({ field: "name", message: "The name needs at least one letter or digit." });
  } else if (context.reservedIds?.has(id)) {
    errors.push({ field: "name", message: "This name is reserved. Choose another one." });
  } else if (context.existingBandIds.has(id) || context.existingCodes.has(id)) {
    // Ruling 2: catalogRepository mapuje id i code.toLowerCase() do jedné mapy.
    errors.push({ field: "name", message: "A band with this name already exists." });
  }
  return id;
}

function resolveBandCode(
  raw: string,
  context: BandDraftContext,
  errors: BandDraftError[],
): string {
  const code = normalizeBandCode(raw);
  if (!isValidBandCode(code)) {
    errors.push({ field: "code", message: "The code must be 2–6 letters or digits." });
    return code;
  }
  const alias = code.toLowerCase();
  if (context.existingCodes.has(alias) || context.existingBandIds.has(alias)) {
    errors.push({ field: "code", message: "Another band already uses this code." });
  }
  return code;
}

function collectLineupErrors(
  lineup: LineupAssignments,
  context: BandDraftContext,
): BandDraftError[] {
  const errors: BandDraftError[] = [];
  const groupById = new Map<string, LineupRole>();
  for (const role of LINEUP_ASSIGNMENT_ROLES) {
    for (const musicianId of lineup[role]) {
      const musician = context.musiciansById[musicianId];
      if (!musician) {
        errors.push({ field: "lineup", message: `Musician '${musicianId}' is not in your library.` });
        continue;
      }
      const label = musicianLabel(musician);
      if (musician.group !== role) {
        errors.push({ field: "lineup", message: `${label} plays ${musician.group}, not ${role}.` });
      }
      const previous = groupById.get(musicianId);
      if (previous) {
        errors.push({ field: "lineup", message: `${label} is in both ${previous} and ${role}.` });
      } else {
        groupById.set(musicianId, role);
      }
    }
  }
  return errors;
}

function collectRoleErrors(
  bandLeaderId: string,
  leadVocalIds: readonly string[],
  members: ReadonlySet<string>,
  context: BandDraftContext,
): BandDraftError[] {
  const errors: BandDraftError[] = [];
  if (!bandLeaderId && members.size > 0) {
    errors.push({ field: "bandLeader", message: "Choose the band leader." });
  }
  if (bandLeaderId && !members.has(bandLeaderId)) {
    errors.push({ field: "bandLeader", message: "The band leader must be in the lineup." });
  }
  for (const musicianId of leadVocalIds) {
    if (!members.has(musicianId.trim())) {
      errors.push({
        field: "leadVocals",
        message: `${labelFor(musicianId, context)} is not in the lineup.`,
      });
    }
  }
  return errors;
}

function resolveContact(
  draftContact: BandDraftContact | undefined,
  members: ReadonlySet<string>,
  context: BandDraftContext,
  errors: BandDraftError[],
): Contact | undefined {
  if (!draftContact) return undefined;
  const musicianId = draftContact.musicianId.trim();
  const musician = context.musiciansById[musicianId];
  if (!musician || !members.has(musicianId)) {
    errors.push({ field: "contact", message: "The contact must be a member of the lineup." });
    return undefined;
  }
  const phone = draftContact.phone?.trim() ?? "";
  const email = draftContact.email?.trim() ?? "";
  if (!phone && !email) {
    errors.push({ field: "contact", message: "Enter a phone number or an e-mail address." });
    return undefined;
  }
  return {
    id: musicianId,
    firstName: (musician.firstName ?? "").trim(),
    lastName: (musician.lastName ?? "").trim(),
    ...(phone ? { phone } : {}),
    ...(email ? { email } : {}),
  };
}

/** Ruling 5: uložený talkback owner přežije, jen když je pořád v sestavě. */
function resolveTalkbackOwner(
  existingBand: Band | undefined,
  members: ReadonlySet<string>,
): Pick<Band, "defaultTalkbackOwnerId"> {
  const previous = existingBand?.defaultTalkbackOwnerId?.trim() ?? "";
  return previous && members.has(previous) ? { defaultTalkbackOwnerId: previous } : {};
}

/** Ruling 4: pole, která formulář nenabízí (R14), se při úpravě nesmí ztratit. */
function pickUnmanagedFields(
  existingBand: Band | undefined,
): Pick<Band, "notesTemplateRef" | "logoFile"> {
  if (!existingBand) return {};
  return {
    ...(existingBand.notesTemplateRef ? { notesTemplateRef: existingBand.notesTemplateRef } : {}),
    ...(existingBand.logoFile ? { logoFile: existingBand.logoFile } : {}),
  };
}

function finalizeBand(candidate: Band, contact: Contact | undefined): BuildBandResult {
  try {
    const band = normalizeBandToCanonicalShape(candidate);
    validateCanonicalBandModel(band);
    return contact ? { ok: true, band, contact } : { ok: true, band };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      errors: [{ field: message.includes("leadVocals") ? "leadVocals" : "lineup", message }],
    };
  }
}

/** Ruling 19: stejné pořadí jako `MemberOption` z Rustu na `01 LINEUP`. */
function musicianLabel(musician: Musician): string {
  const label = `${musician.lastName ?? ""} ${musician.firstName ?? ""}`.trim();
  return label || musician.id;
}

function labelFor(musicianId: string, context: BandDraftContext): string {
  const musician = context.musiciansById[musicianId.trim()];
  return musician ? musicianLabel(musician) : musicianId;
}
```

Poznámky k implementaci:
- `lineup` je typu `LineupAssignments = Record<LineupRole, string[]>`; je přiřaditelný do `Band.defaultLineup: Partial<Record<Group, string[]>>`.
- `normalizeLineupAssignments` bere `unknown`, takže `readonly` pole z draftu projdou (`Array.isArray`).
- `musician.firstName ?? ""` drží funkci totální i nad muzikantem, kterému v souboru jméno chybí (data z APPDATA nejsou typově zaručená, viz memory `reference_appdata_gotchas`).
- Kdyby Biome hlásil `noUselessElse` nebo podobné styl. pravidlo v nových souborech, oprav podle něj; logiku neměň.

- [ ] **Krok 5: Spusť a ověř průchod**

Run: `npx vitest run src/domain/band/buildBandFromDraft.test.ts`
Expected: PASS — 29 testů.

Kdyby padl jen test „rejects a musician placed in two groups" na pořadí/počtu zpráv: oba nálezy jsou správně (Krečmer je basák ve `vocs` → „plays bass, not vocs" + „is in both bass and vocs"). Oprav implementaci, ne očekávání.

- [ ] **Krok 6: Celá sada a typová kontrola**

```bash
npm test 2>&1 | tail -6
npx tsc --noEmit 2>&1 | grep -c "error TS"
npx tsc -p packages/desktop/tsconfig.json --noEmit 2>&1 | grep -c "error TS"
```

Expected: `Tests  2 failed | 1313 passed (1315)`, `Test Files  2 failed | 170 passed (172)`; root tsc `0`; desktop tsc `14` (doména zatím z desktopu importovaná není, číslo se nesmí změnit).

- [ ] **Krok 7: Lint**

`npx biome check --write src/domain/band/buildBandFromDraft.ts src/domain/band/buildBandFromDraft.test.ts`, pak bez `--write` → 0 chyb.

- [ ] **Krok 8: Commit**

```bash
git add src/domain/band/buildBandFromDraft.ts src/domain/band/buildBandFromDraft.test.ts
git commit -m "feat(band): build a canonical band and contact from a form draft with field errors"
```

---

### Task 5: `buildBandDraftContext` + `summarizeBand`

**Files:**
- Create: `src/domain/band/buildBandDraftContext.ts`
- Create: `src/domain/band/buildBandDraftContext.test.ts`
- Create: `src/domain/band/summarizeBand.ts`
- Create: `src/domain/band/summarizeBand.test.ts`

**Interfaces:**
- Consumes:
  - `BandDraftContext`, `buildBandFromDraft` (Task 4)
  - `resolveMusicianHasVocalCapability(musician: Musician, presetCatalog: Record<string, PresetEntity | undefined>): boolean` — `src/domain/project/resolveMusicianHasVocalCapability.ts:21`
  - `getAllLineupMemberIds` (`bandLineup.ts:12`), `normalizeLineupAssignments` (`lineupAssignments.ts:35`)
- Produces:
  - `src/domain/band/buildBandDraftContext.ts`:
    ```ts
    export type BandRefSummary = { readonly id: string; readonly code?: string | null };
    export function buildBandDraftContext(args: {
      readonly musicians: readonly Musician[];
      readonly presets: readonly PresetEntity[];
      readonly bands: readonly BandRefSummary[];
      readonly existingBand?: Band;
      readonly reservedIds?: readonly string[];
    }): BandDraftContext;
    ```
    `BandOption` z desktopu (`{ id: string; name: string; code?: string | null }`, `app/shell/types.ts:31`) je do `BandRefSummary` přiřaditelný. Tasky 7 a 11.
  - `src/domain/band/summarizeBand.ts`:
    ```ts
    export type BandSummary = { readonly memberCount: number; readonly isIncomplete: boolean };
    export function summarizeBand(band: {
      readonly defaultLineup?: unknown;
      readonly bandLeader?: string;
      readonly bandLeaderId?: string;
    }): BandSummary;
    ```
    Task 7 (`listBandSummaries`).

**Kontext**

- `canSing` je stejné složení jako v `packages/desktop/src/app/domain/roles/applyDerivedVocalOverlays.ts:43-48`: muzikant → `resolveMusicianHasVocalCapability(musician, presetCatalog)`, neznámý → `false`. Tady se katalog presetů skládá z pole (`list_presets` vrací `Value[]`), proto `Object.fromEntries` podle `id`. Všechny varianty `PresetEntity` (`Preset`, `TalkbackType`, `Monitor`) nesou `id` (`types.ts:287-400`).
- Upravovaná kapela se z kolizí vyřazuje podle id (lowercase), jinak by vlastní zkratka kolidovala sama se sebou.
- Štítek „neúplná" (R12) = bez sestavy nebo bez kapelníka. **Reálné soubory nesou jen `bandLeaderId`** (ověřeno v Tasku 4, krok 1), proto `summarizeBand` čte obě pole. Parametr je záměrně volný (`defaultLineup?: unknown`), protože do něj teče syrový obsah souboru z `read_band`; `Pick<Band, …>` by vyžadoval povinné `bandLeader`.

- [ ] **Krok 1: Napiš padající testy**

`src/domain/band/buildBandDraftContext.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Band, Musician, PresetEntity } from "../model/types";
import { buildBandDraftContext } from "./buildBandDraftContext";
import { buildBandFromDraft } from "./buildBandFromDraft";

const BANDS = [
  { id: "big_night_band", code: "BNB" },
  { id: "blanicka_kapela", code: "BK" },
];

const EXISTING_BNB: Band = {
  type: "band",
  id: "big_night_band",
  code: "BNB",
  name: "Big Night Band",
  bandLeader: "",
  defaultLineup: {},
};

const VOCAL_WIRED: PresetEntity = {
  type: "preset",
  id: "vocal_wired",
  label: "Vocal (wired)",
  group: "vocs",
  capabilities: ["vocal"],
  inputs: [{ key: "voc_input", label: "Vocal" }],
};

const BASS_DI: PresetEntity = {
  type: "preset",
  id: "el_bass_di",
  label: "Bass DI",
  group: "bass",
  inputs: [{ key: "el_bass_di", label: "Bass" }],
};

const SINGER: Musician = {
  id: "singer",
  firstName: "Anna",
  lastName: "Zpěvačka",
  group: "vocs",
  presets: [{ kind: "preset", ref: "vocal_wired" }],
};

const BASSIST: Musician = {
  id: "bassist",
  firstName: "Petr",
  lastName: "Basák",
  group: "bass",
  presets: [{ kind: "preset", ref: "el_bass_di" }],
};

describe("buildBandDraftContext", () => {
  it("excludes the edited band from id and code collisions", () => {
    const context = buildBandDraftContext({
      musicians: [],
      presets: [],
      bands: BANDS,
      existingBand: EXISTING_BNB,
    });

    expect([...context.existingBandIds]).toEqual(["blanicka_kapela"]);
    expect([...context.existingCodes]).toEqual(["bk"]);
    expect(context.existingBand).toBe(EXISTING_BNB);
  });

  it("lowercases codes and skips bands without one", () => {
    const context = buildBandDraftContext({
      musicians: [],
      presets: [],
      bands: [
        { id: "a_band", code: " XY " },
        { id: "b_band", code: null },
      ],
    });

    expect([...context.existingBandIds]).toEqual(["a_band", "b_band"]);
    expect([...context.existingCodes]).toEqual(["xy"]);
  });

  it("answers canSing from the vocal capability in the preset catalog", () => {
    const context = buildBandDraftContext({
      musicians: [SINGER, BASSIST],
      presets: [VOCAL_WIRED, BASS_DI],
      bands: [],
    });

    expect(context.canSing("singer")).toBe(true);
    expect(context.canSing("bassist")).toBe(false);
    expect(context.canSing("nobody")).toBe(false);
    expect(context.musiciansById.singer).toBe(SINGER);
  });

  it("carries reserved ids in lower case", () => {
    const context = buildBandDraftContext({
      musicians: [],
      presets: [],
      bands: [],
      reservedIds: ["New"],
    });

    expect(context.reservedIds?.has("new")).toBe(true);
  });

  it("lets the domain reject a new band that reuses an existing code", () => {
    const context = buildBandDraftContext({ musicians: [], presets: [], bands: BANDS });

    const result = buildBandFromDraft(
      { name: "Big Night Orchestra", code: "bnb", lineup: {}, leadVocalIds: [] },
      context,
    );

    expect(result.ok ? [] : result.errors.map((error) => error.field)).toEqual(["code"]);
  });
});
```

`src/domain/band/summarizeBand.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { summarizeBand } from "./summarizeBand";

describe("summarizeBand", () => {
  it("counts members of a real band file that carries only bandLeaderId", () => {
    expect(
      summarizeBand({
        bandLeaderId: "krecmer_matej",
        defaultLineup: {
          drums: ["plasil_pavel"],
          bass: ["krecmer_matej"],
          guitar: ["pisa_karel"],
          keys: ["zidek_jakub"],
          vocs: ["krecmerova_eliska"],
        },
      }),
    ).toEqual({ memberCount: 5, isIncomplete: false });
  });

  it("marks a band without a lineup as incomplete", () => {
    expect(summarizeBand({ bandLeader: "", bandLeaderId: "", defaultLineup: {} })).toEqual({
      memberCount: 0,
      isIncomplete: true,
    });
  });

  it("marks a band with members but no leader as incomplete", () => {
    expect(summarizeBand({ bandLeader: "", defaultLineup: { bass: ["krecmer_matej"] } })).toEqual({
      memberCount: 1,
      isIncomplete: true,
    });
  });
});
```

- [ ] **Krok 2: Spusť a ověř pád**

Run: `npx vitest run src/domain/band/buildBandDraftContext.test.ts src/domain/band/summarizeBand.test.ts`
Expected: FAIL — nerozřešené importy `./buildBandDraftContext` a `./summarizeBand`.

- [ ] **Krok 3: Implementuj**

`src/domain/band/buildBandDraftContext.ts`:

```ts
import type { Band, Musician, PresetEntity } from "../model/types.js";
import { resolveMusicianHasVocalCapability } from "../project/resolveMusicianHasVocalCapability.js";
import type { BandDraftContext } from "./buildBandFromDraft.js";

/** Co z kapely potřebuje kontrola kolizí: `BandOption` z desktopu tomu vyhoví. */
export type BandRefSummary = {
  readonly id: string;
  readonly code?: string | null;
};

/**
 * Co? Složí `BandDraftContext` ze tří katalogových seznamů, které desktop
 * načte přes Tauri (muzikanti, presety, kapely).
 *
 * Proč v doméně? Predikát `canSing` musí být stejný jako na `01 LINEUP`
 * (`applyDerivedVocalOverlays`), jinak by kapela a projekt odvodily jiné
 * back vokály. A vyřazení upravované kapely z kolizí je pravidlo, ne UI.
 */
export function buildBandDraftContext(args: {
  readonly musicians: readonly Musician[];
  readonly presets: readonly PresetEntity[];
  readonly bands: readonly BandRefSummary[];
  readonly existingBand?: Band;
  readonly reservedIds?: readonly string[];
}): BandDraftContext {
  const editingId = args.existingBand?.id.trim().toLowerCase();
  const otherBands = args.bands.filter((band) => band.id.trim().toLowerCase() !== editingId);
  const musiciansById: Record<string, Musician> = Object.fromEntries(
    args.musicians.map((musician) => [musician.id, musician]),
  );
  const presetCatalog: Record<string, PresetEntity> = Object.fromEntries(
    args.presets.map((preset) => [preset.id, preset]),
  );
  return {
    existingBandIds: new Set(otherBands.map((band) => band.id.trim().toLowerCase())),
    existingCodes: new Set(
      otherBands.flatMap((band) => {
        const code = band.code?.trim();
        return code ? [code.toLowerCase()] : [];
      }),
    ),
    musiciansById,
    canSing: (musicianId) => {
      const musician = musiciansById[musicianId];
      return musician ? resolveMusicianHasVocalCapability(musician, presetCatalog) : false;
    },
    reservedIds: new Set((args.reservedIds ?? []).map((id) => id.toLowerCase())),
    ...(args.existingBand ? { existingBand: args.existingBand } : {}),
  };
}
```

`src/domain/band/summarizeBand.ts`:

```ts
import { normalizeLineupAssignments } from "../lineup/lineupAssignments.js";
import { getAllLineupMemberIds } from "../model/bandLineup.js";

export type BandSummary = {
  readonly memberCount: number;
  readonly isIncomplete: boolean;
};

/**
 * R12: seznam kapel ukazuje počet členů a štítek „neúplná" (bez sestavy
 * nebo bez kapelníka). Vstup je syrový obsah souboru kapely: reálné
 * soubory nesou jen `bandLeaderId`, nové z editoru obě pole.
 */
export function summarizeBand(band: {
  readonly defaultLineup?: unknown;
  readonly bandLeader?: string;
  readonly bandLeaderId?: string;
}): BandSummary {
  const memberCount = getAllLineupMemberIds(
    normalizeLineupAssignments(band.defaultLineup),
  ).length;
  const leader = (band.bandLeader ?? "").trim() || (band.bandLeaderId ?? "").trim();
  return { memberCount, isIncomplete: memberCount === 0 || !leader };
}
```

- [ ] **Krok 4: Spusť a ověř průchod**

Run: `npx vitest run src/domain/band/buildBandDraftContext.test.ts src/domain/band/summarizeBand.test.ts`
Expected: PASS — 8 testů (5 + 3).

- [ ] **Krok 5: Celá sada**

```bash
npm test 2>&1 | tail -6
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: `Tests  2 failed | 1321 passed (1323)`, `Test Files  2 failed | 172 passed (174)`; root tsc `0`.

- [ ] **Krok 6: Lint**

`npx biome check --write` na čtyři nové soubory, pak bez `--write` → 0 chyb.

- [ ] **Krok 7: Commit**

```bash
git add src/domain/band/buildBandDraftContext.ts src/domain/band/buildBandDraftContext.test.ts src/domain/band/summarizeBand.ts src/domain/band/summarizeBand.test.ts
git commit -m "feat(band): build the draft context from catalog lists and summarise bands for the list"
```

---
## KROK B — Rust

### Task 6: Rust — šest příkazů z R10 nad čistými funkcemi `*_at`

**Files:**
- Modify: `packages/desktop/src-tauri/src/lib.rs`
  - za `map_io_error` (končí na řádku 334): nové pomocné funkce
  - `get_band_setup_data`, řádky 1112-1137: smyčku presetů nahradit voláním `load_preset_catalog_at`
  - za `get_band_setup_data` (končí na řádku 1217, před `#[tauri::command] fn read_project` na 1219-1220): šest příkazů
  - `run()`, `generate_handler!` (řádky 2080-2117): registrace
  - `mod tests` (řádky 2122-2141): nové testy
- Test: `packages/desktop/src-tauri/src/lib.rs` (`mod tests`)

**Interfaces:**
- Consumes: z `storage_paths.rs` (už importované v `lib.rs:12-17`): `sanitize_id_to_filename(project_id: &str) -> String` (`storage_paths.rs:1292`), `atomic_write_bytes(path: &Path, bytes: &[u8]) -> Result<(), StorageError>` (`:1314`); z `lib.rs`: `ApiError` (`:21-26`), `map_io_error` (`:327`), `map_storage_error` (`:304`), `catalog_entity_dir(app, entity) -> Result<PathBuf, ApiError>` (`:481`), `resolve_workspace_root() -> PathBuf` (`:280`).
- Produces — Tauri příkazy (TS volá camelCase argumenty, Tauri 2 je převede; vzor `getBandSetupData` → `{ bandId }`):

  | Příkaz | Argumenty z TS | Návrat | Kódy chyb |
  |---|---|---|---|
  | `list_catalog_musicians` | — | `Value[]` | `MUSICIAN_LIST_FAILED` |
  | `list_presets` | — | `Value[]` | `PRESET_LIST_FAILED` |
  | `read_band` | `{ bandId: string }` | `Value \| null` | `BAND_READ_FAILED` |
  | `read_contact` | `{ contactId: string }` | `Value \| null` | `CONTACT_READ_FAILED` |
  | `write_band` | `{ bandId: string; json: string; expectNew: boolean }` | `null` | `BAND_WRITE_FAILED`, `BAND_EXISTS` |
  | `write_contact` | `{ contactId: string; json: string }` | `null` | `CONTACT_WRITE_FAILED` |

  `json` je **string** (Ruling 9). Chyby jsou `ApiError { code, message, export_pdf_path, version_pdf_path }` — TS čte `code` a `message`.

**Kontext, který nesmíš přehlédnout**

1. **Žádné serde typy entit** (R3). Všechno je `serde_json::Value` nebo `&str`.
2. Tauri příkazy berou `AppHandle`, takže se testovat nedají. Logika proto žije v `*_at(dir: &Path, …)` funkcích a příkaz je jednořádkový obal. Testy jedou nad temp adresářem podle `temp_test_dir` (`storage_paths.rs:653-659`).
3. **`get_band_setup_data` se nesmí změnit chováním.** Smyčka presetů se jen nahradí sdíleným loaderem (spec R10: `list_presets` „stejným loaderem jako `get_band_setup_data`"). Kód chyby zůstává `BAND_SETUP_LOAD_FAILED`; mění se jen text zprávy u rozbitého souboru (nově s cestou — dnešní `"Failed to read preset file (err)"` cestu nemá).
4. `list_json_files_recursive` (`:287-302`) **zůstává**, používá ho `load_library_list` (`:539`). Smaže ho Task 13. Nový loader používá novou `collect_json_files`, která vrací `io::Result` a nechává mapování na volajícím.
5. `list_presets` dědí známý defekt zabalené aplikace (`resolve_workspace_root` z `CARGO_MANIFEST_DIR`). Spec ho výslovně neřeší — **neopravuj**.
6. Baseline `cargo test`: 16 passed, **0 warnings**. Nové funkce musí mít uživatele (příkaz nebo test), jinak `dead_code` warning rozbije čistotu.

- [ ] **Krok 1: Napiš padající testy**

V `lib.rs` nahraď hlavičku `mod tests` (dnes řádky 2122-2124):

```rust
#[cfg(test)]
mod tests {
    use super::parse_node_export_response;
```

tímto (oba existující testy `parses_clean_success_response` a `rejects_prefixed_stdout_as_contract_error` zůstávají pod ní beze změny):

```rust
#[cfg(test)]
mod tests {
    use super::{
        list_catalog_musicians_at, load_preset_catalog_at, parse_node_export_response,
        read_catalog_entity_at, resolve_workspace_root, write_band_at, write_contact_at,
    };
    use std::{
        fs,
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    fn temp_test_dir(name: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or_default();
        let dir = std::env::temp_dir().join(format!("stagepilot-lib-tests-{name}-{nanos}"));
        fs::create_dir_all(&dir).expect("create temp dir");
        dir
    }

    const BNB_JSON: &str = "{\n  \"type\": \"band\",\n  \"id\": \"big_night_band\",\n  \"name\": \"Big Night Band\",\n  \"code\": \"BNB\"\n}\n";
```

Na konec modulu (před uzavírací `}` modulu `tests`) přidej:

```rust
    #[test]
    fn write_band_writes_the_given_text_to_a_file_named_after_the_id() {
        let dir = temp_test_dir("write-band");
        write_band_at(&dir, "big_night_band", BNB_JSON, true).expect("write");
        let path = dir.join("big_night_band.json");
        assert_eq!(fs::read_to_string(&path).expect("read back"), BNB_JSON);
        assert!(!dir.join("big_night_band.tmp").exists());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn write_band_rejects_ids_that_are_not_safe_file_names() {
        let dir = temp_test_dir("unsafe-id");
        for id in ["Big Night", "../evil", "", ".hidden"] {
            let json = format!("{{\"id\":\"{}\"}}", id);
            let err = write_band_at(&dir, id, &json, true).expect_err(id);
            assert_eq!(err.code, "BAND_WRITE_FAILED", "{}", id);
        }
        assert_eq!(fs::read_dir(&dir).expect("list").count(), 0);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn write_band_rejects_json_whose_id_differs_or_is_not_json() {
        let dir = temp_test_dir("id-mismatch");
        let err = write_band_at(&dir, "other_band", BNB_JSON, true).expect_err("mismatch");
        assert_eq!(err.code, "BAND_WRITE_FAILED");
        let err = write_band_at(&dir, "big_night_band", "{not json", true).expect_err("broken");
        assert_eq!(err.code, "BAND_WRITE_FAILED");
        assert!(!dir.join("other_band.json").exists());
        assert!(!dir.join("big_night_band.json").exists());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn write_band_with_expect_new_refuses_to_overwrite_an_existing_file() {
        let dir = temp_test_dir("expect-new");
        let path = dir.join("big_night_band.json");
        fs::write(&path, "{\"id\":\"big_night_band\",\"name\":\"Original\"}").expect("seed");
        let err = write_band_at(&dir, "big_night_band", BNB_JSON, true).expect_err("exists");
        assert_eq!(err.code, "BAND_EXISTS");
        assert!(fs::read_to_string(&path).expect("read").contains("Original"));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn write_band_without_expect_new_overwrites_an_existing_file() {
        let dir = temp_test_dir("overwrite");
        let path = dir.join("big_night_band.json");
        fs::write(&path, "{\"id\":\"big_night_band\",\"name\":\"Original\"}").expect("seed");
        write_band_at(&dir, "big_night_band", BNB_JSON, false).expect("overwrite");
        assert_eq!(fs::read_to_string(&path).expect("read"), BNB_JSON);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn write_contact_checks_the_id_and_writes_the_file() {
        let dir = temp_test_dir("contact");
        let json = "{\"id\":\"krecmer_matej\",\"firstName\":\"Matěj\",\"lastName\":\"Krečmer\"}";
        let err = write_contact_at(&dir, "zidek_jakub", json).expect_err("mismatch");
        assert_eq!(err.code, "CONTACT_WRITE_FAILED");
        write_contact_at(&dir, "krecmer_matej", json).expect("write");
        assert_eq!(
            fs::read_to_string(dir.join("krecmer_matej.json")).expect("read"),
            json
        );
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn read_catalog_entity_returns_none_for_a_missing_file() {
        let dir = temp_test_dir("read-missing");
        let value = read_catalog_entity_at(&dir, "nobody", "BAND_READ_FAILED").expect("read");
        assert!(value.is_none());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn read_catalog_entity_reports_the_path_of_broken_json() {
        let dir = temp_test_dir("read-broken");
        fs::write(dir.join("broken.json"), "{oops").expect("seed");
        let err = read_catalog_entity_at(&dir, "broken", "BAND_READ_FAILED").expect_err("broken");
        assert_eq!(err.code, "BAND_READ_FAILED");
        assert!(err.message.contains("broken.json"), "{}", err.message);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn list_catalog_musicians_reads_every_role_folder() {
        let dir = temp_test_dir("musicians");
        fs::create_dir_all(dir.join("bass")).expect("bass dir");
        fs::create_dir_all(dir.join("vocs")).expect("vocs dir");
        fs::write(dir.join("bass/krecmer_matej.json"), "{\"id\":\"krecmer_matej\",\"group\":\"bass\"}").expect("seed bass");
        fs::write(dir.join("vocs/krecmerova_eliska.json"), "{\"id\":\"krecmerova_eliska\",\"group\":\"vocs\"}").expect("seed vocs");
        fs::write(dir.join("vocs/readme.txt"), "not json").expect("seed txt");
        let musicians = list_catalog_musicians_at(&dir).expect("list");
        let mut ids: Vec<&str> = musicians
            .iter()
            .filter_map(|m| m.get("id").and_then(|v| v.as_str()))
            .collect();
        ids.sort();
        assert_eq!(ids, vec!["krecmer_matej", "krecmerova_eliska"]);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn list_catalog_musicians_fails_with_the_path_of_a_broken_file() {
        let dir = temp_test_dir("musicians-broken");
        fs::create_dir_all(dir.join("keys")).expect("keys dir");
        fs::write(dir.join("keys/zidek_jakub.json"), "{\"id\":").expect("seed");
        let err = list_catalog_musicians_at(&dir).expect_err("broken");
        assert_eq!(err.code, "MUSICIAN_LIST_FAILED");
        assert!(err.message.contains("zidek_jakub.json"), "{}", err.message);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn list_catalog_musicians_returns_nothing_for_a_missing_folder() {
        let dir = temp_test_dir("musicians-missing").join("does-not-exist");
        assert!(list_catalog_musicians_at(&dir).expect("list").is_empty());
    }

    #[test]
    fn load_preset_catalog_reads_the_bundled_assets() {
        let presets = load_preset_catalog_at(&resolve_workspace_root(), "PRESET_LIST_FAILED")
            .expect("bundled presets");
        let vocal = presets
            .iter()
            .find(|p| p.get("id").and_then(|v| v.as_str()) == Some("vocal_wired"))
            .expect("vocal_wired is bundled");
        assert_eq!(vocal["capabilities"][0], "vocal");
    }
```

12 nových testů.

- [ ] **Krok 2: Spusť a ověř, že se nepřeloží**

```bash
cd /c/Users/mkrecmer/dev/stagepilot/packages/desktop/src-tauri
cargo test 2>&1 | tail -15
```

Expected: chyba překladu `unresolved imports` / `cannot find function` pro `list_catalog_musicians_at`, `load_preset_catalog_at`, `read_catalog_entity_at`, `write_band_at`, `write_contact_at`.

- [ ] **Krok 3: Přidej pomocné funkce**

Za funkci `map_io_error` (končí na řádku 334, před `fn parse_node_export_response`) vlož:

```rust
fn api_error(code: &str, message: String) -> ApiError {
    ApiError {
        code: code.into(),
        message,
        export_pdf_path: None,
        version_pdf_path: None,
    }
}

/// Recursively lists `*.json` files below `root`, sorted so callers see a
/// stable order. Mapping the I/O error to an `ApiError` is the caller's job,
/// because each command reports under its own code.
fn collect_json_files(root: &Path) -> std::io::Result<Vec<PathBuf>> {
    let mut files = Vec::new();
    for entry in fs::read_dir(root)? {
        let path = entry?.path();
        if path.is_dir() {
            files.extend(collect_json_files(&path)?);
        } else if path.extension().and_then(|s| s.to_str()) == Some("json") {
            files.push(path);
        }
    }
    files.sort();
    Ok(files)
}

fn read_json_file(path: &Path, code: &str) -> Result<Value, ApiError> {
    let content = fs::read_to_string(path)
        .map_err(|err| api_error(code, format!("Failed to read {} ({})", path.display(), err)))?;
    serde_json::from_str(&content)
        .map_err(|err| api_error(code, format!("Invalid JSON in {} ({})", path.display(), err)))
}

/// Every musician file under `catalog/musicians/<role>/`. One broken file
/// fails the whole list with its path: the band form must not offer a
/// partial catalog (spec R13).
fn list_catalog_musicians_at(musicians_dir: &Path) -> Result<Vec<Value>, ApiError> {
    if !musicians_dir.exists() {
        return Ok(Vec::new());
    }
    let files = collect_json_files(musicians_dir).map_err(|err| {
        api_error(
            "MUSICIAN_LIST_FAILED",
            format!("Failed to list musicians in {} ({})", musicians_dir.display(), err),
        )
    })?;
    files
        .iter()
        .map(|path| read_json_file(path, "MUSICIAN_LIST_FAILED"))
        .collect()
}

/// Bundled group and monitor presets. Shared by `get_band_setup_data` and
/// `list_presets` so both read the catalog the same way (spec R10); `code`
/// keeps each command's own error code.
fn load_preset_catalog_at(workspace_root: &Path, code: &str) -> Result<Vec<Value>, ApiError> {
    let mut presets = Vec::new();
    for preset_dir in [
        workspace_root.join("data/assets/presets/groups"),
        workspace_root.join("data/assets/presets/monitors"),
    ] {
        if !preset_dir.exists() {
            continue;
        }
        let files = collect_json_files(&preset_dir).map_err(|err| {
            api_error(
                code,
                format!("Failed to list presets in {} ({})", preset_dir.display(), err),
            )
        })?;
        for path in files {
            presets.push(read_json_file(&path, code)?);
        }
    }
    Ok(presets)
}

/// A catalog id must already be a safe file name: the domain derives it, Rust
/// only refuses to "fix" it, because a silently changed id would point
/// `bandRef` or `defaultContactId` at a file that does not exist.
fn ensure_safe_entity_id(id: &str, code: &str) -> Result<(), ApiError> {
    if id.is_empty() || sanitize_id_to_filename(id) != id {
        return Err(api_error(code, format!("'{}' is not a safe catalog id.", id)));
    }
    Ok(())
}

/// Parses `json` only to check that it is JSON and names `id`. The caller
/// writes the original text, so the key order chosen by the domain survives.
fn ensure_json_matches_id(id: &str, json: &str, code: &str) -> Result<(), ApiError> {
    let value: Value = serde_json::from_str(json)
        .map_err(|err| api_error(code, format!("JSON for '{}' is not valid ({})", id, err)))?;
    match value.get("id").and_then(|v| v.as_str()) {
        Some(json_id) if json_id == id => Ok(()),
        other => Err(api_error(
            code,
            format!("JSON id {:?} does not match '{}'.", other, id),
        )),
    }
}

fn read_catalog_entity_at(dir: &Path, id: &str, code: &str) -> Result<Option<Value>, ApiError> {
    ensure_safe_entity_id(id, code)?;
    let path = dir.join(format!("{}.json", id));
    if !path.exists() {
        return Ok(None);
    }
    read_json_file(&path, code).map(Some)
}

fn write_catalog_json(dir: &Path, path: &Path, json: &str, code: &str) -> Result<(), ApiError> {
    fs::create_dir_all(dir)
        .map_err(|err| map_io_error(err, code, "Failed to create catalog directory"))?;
    atomic_write_bytes(path, json.as_bytes())
        .map_err(|err| map_storage_error(err, code, "Failed to write catalog file"))
}

fn write_band_at(bands_dir: &Path, band_id: &str, json: &str, expect_new: bool) -> Result<(), ApiError> {
    ensure_safe_entity_id(band_id, "BAND_WRITE_FAILED")?;
    ensure_json_matches_id(band_id, json, "BAND_WRITE_FAILED")?;
    let path = bands_dir.join(format!("{}.json", band_id));
    if expect_new && path.exists() {
        return Err(api_error(
            "BAND_EXISTS",
            format!("A band already exists at {}.", path.display()),
        ));
    }
    write_catalog_json(bands_dir, &path, json, "BAND_WRITE_FAILED")
}

fn write_contact_at(contacts_dir: &Path, contact_id: &str, json: &str) -> Result<(), ApiError> {
    ensure_safe_entity_id(contact_id, "CONTACT_WRITE_FAILED")?;
    ensure_json_matches_id(contact_id, json, "CONTACT_WRITE_FAILED")?;
    let path = contacts_dir.join(format!("{}.json", contact_id));
    write_catalog_json(contacts_dir, &path, json, "CONTACT_WRITE_FAILED")
}
```

- [ ] **Krok 4: Přepoj `get_band_setup_data` na sdílený loader**

Najdi blok, který dnes začíná `let mut preset_catalog: HashMap<String, Value> = HashMap::new();` (řádek 1112) a končí uzavírací `}` vnější smyčky `for preset_dir in [...]` (řádek 1137, těsně před prázdným řádkem a `let musician_default_overrides =`). Celý blok včetně komentáře „Presets exposed to setup UI are built-in application assets…" nahraď:

```rust
    // Presets exposed to setup UI are built-in application assets. Runtime
    // AppData catalog storage remains limited to user entities and notes.
    let mut preset_catalog: HashMap<String, Value> = HashMap::new();
    for preset in load_preset_catalog_at(&resolve_workspace_root(), "BAND_SETUP_LOAD_FAILED")? {
        let Some(id) = preset.get("id").and_then(|v| v.as_str()).map(str::to_string) else {
            continue;
        };
        preset_catalog.insert(id, preset);
    }
```

Lokální `workspace_root` tím z funkce zmizí; ověř, že ho `get_band_setup_data` jinde nepoužívá:

```bash
sed -n '/^fn get_band_setup_data/,/^fn read_project/p' src/lib.rs | grep -n "workspace_root"
```

Expected: jediný výskyt — v nově vloženém `resolve_workspace_root()`.

- [ ] **Krok 5: Přidej šest příkazů**

Za konec `get_band_setup_data` (uzavírací `}` po `Ok(BandSetupData { … })`, před `#[tauri::command]` funkce `read_project`) vlož:

```rust
#[tauri::command]
fn list_catalog_musicians(app: tauri::AppHandle) -> Result<Vec<Value>, ApiError> {
    list_catalog_musicians_at(&catalog_entity_dir(&app, "musicians")?)
}

#[tauri::command]
fn list_presets() -> Result<Vec<Value>, ApiError> {
    load_preset_catalog_at(&resolve_workspace_root(), "PRESET_LIST_FAILED")
}

#[tauri::command]
fn read_band(app: tauri::AppHandle, band_id: String) -> Result<Option<Value>, ApiError> {
    read_catalog_entity_at(&catalog_entity_dir(&app, "bands")?, &band_id, "BAND_READ_FAILED")
}

#[tauri::command]
fn read_contact(app: tauri::AppHandle, contact_id: String) -> Result<Option<Value>, ApiError> {
    read_catalog_entity_at(
        &catalog_entity_dir(&app, "contacts")?,
        &contact_id,
        "CONTACT_READ_FAILED",
    )
}

#[tauri::command]
fn write_band(
    app: tauri::AppHandle,
    band_id: String,
    json: String,
    expect_new: bool,
) -> Result<(), ApiError> {
    write_band_at(&catalog_entity_dir(&app, "bands")?, &band_id, &json, expect_new)
}

#[tauri::command]
fn write_contact(app: tauri::AppHandle, contact_id: String, json: String) -> Result<(), ApiError> {
    write_contact_at(&catalog_entity_dir(&app, "contacts")?, &contact_id, &json)
}
```

V `run()` v `tauri::generate_handler![ … ]` přidej za řádek `get_band_setup_data,`:

```rust
            list_catalog_musicians,
            list_presets,
            read_band,
            read_contact,
            write_band,
            write_contact,
```

- [ ] **Krok 6: Spusť cargo testy**

```bash
cd /c/Users/mkrecmer/dev/stagepilot/packages/desktop/src-tauri
cargo test 2>&1 | grep -E "^test result|^warning|^error" 
cargo test 2>&1 | grep -c "^warning"
```

Expected: `test result: ok. 28 passed; 0 failed` (16 + 12) pro `src\lib.rs`; dvě další `test result: ok. 0 passed` (main, doc); počet warningů `0`.

Kdyby padl `load_preset_catalog_reads_the_bundled_assets`: ověř `ls ../../../data/assets/presets/groups/vocs/` — test stojí na tom, že repo obsahuje `vocal_wired.json` s `"capabilities": ["vocal"]` (ověřeno 2026-10-06).

- [ ] **Krok 7: Ověř, že TS strana se nezměnila**

```bash
cd /c/Users/mkrecmer/dev/stagepilot
npm test 2>&1 | tail -6
```

Expected: `Tests  2 failed | 1321 passed (1323)` — beze změny proti Tasku 5.

- [ ] **Krok 8: Formát Rustu**

`cargo fmt --check` repo nepoužívá jako bránu (není v `package.json` ani v `CLAUDE.md`) — **nespouštěj `cargo fmt` nad celým souborem**, přeformátoval by nesouvisející kód. Drž odsazení 4 mezery jako okolní kód.

- [ ] **Krok 9: Commit**

```bash
git add packages/desktop/src-tauri/src/lib.rs
git commit -m "feat(tauri): add catalog commands to list musicians and presets and read or write bands and contacts"
```

---
## KROK C — desktop služby

### Task 7: `tauriCommands.ts` + `bandsApi.ts`

**Files:**
- Modify: `packages/desktop/src/app/services/tauriCommands.ts` (dnes 10 řádků, objekt `TAURI_COMMANDS`)
- Create: `packages/desktop/src/app/services/bandsApi.ts`
- Create: `packages/desktop/src/app/services/bandsApi.test.ts`

**Interfaces:**
- Consumes:
  - Tauri příkazy z Tasku 6 (tabulka argumentů tam).
  - `buildBandFromDraft`, `BandDraft`, `BandDraftContext`, `BandDraftError` (Task 4); `buildBandDraftContext` (Task 5, jen v testu); `summarizeBand` (Task 5); `Band`, `Contact`, `Musician`, `PresetEntity` (`src/domain/model/types.ts`).
  - `listBands(): Promise<BandOption[]>` — `packages/desktop/src/app/services/projectsApi.ts:8-10` (volá `list_bands`).
  - `BandOption = { id: string; name: string; code?: string | null }` — `app/shell/types.ts:31`.
- Produces (z `packages/desktop/src/app/services/bandsApi.ts`):
  ```ts
  export function listCatalogMusicians(): Promise<Musician[]>;
  export function listPresets(): Promise<PresetEntity[]>;
  export function readBand(bandId: string): Promise<Band | null>;
  export function readContact(contactId: string): Promise<Contact | null>;
  export function describeApiError(error: unknown): { readonly code: string | null; readonly message: string };
  export type BandListItem =
    | { readonly kind: "ok"; readonly id: string; readonly name: string; readonly code: string | null; readonly memberCount: number; readonly isIncomplete: boolean }
    | { readonly kind: "error"; readonly id: string; readonly name: string; readonly message: string };
  export function listBandSummaries(): Promise<BandListItem[]>; // rejectne jen při selhání samotného list_bands
  export type BandFormData = { readonly musicians: readonly Musician[]; readonly presets: readonly PresetEntity[]; readonly bands: readonly BandOption[]; readonly band: Band | null; readonly contact: Contact | null };
  export function loadBandFormData(bandId: string | null): Promise<BandFormData>;
  export type SaveBandDraftResult =
    | { readonly ok: true; readonly bandId: string }
    | { readonly ok: false; readonly kind: "invalid"; readonly errors: readonly BandDraftError[] }
    | { readonly ok: false; readonly kind: "bandExists"; readonly errors: readonly BandDraftError[]; readonly contactWritten: boolean }
    | { readonly ok: false; readonly kind: "writeFailed"; readonly message: string; readonly contactWritten: boolean };
  export function saveBandDraft(draft: BandDraft, context: BandDraftContext): Promise<SaveBandDraftResult>;
  ```
  Tasky 10 a 11 na nich staví. `writeBand`/`writeContact` jsou **neexportované** — jediná cesta k zápisu je `saveBandDraft` (R11).

**Kontext**

- R11: doména postaví entitu; při chybách se nezapíše nic; jinak **nejdřív kontakt, potom kapela**, aby kapela nikdy neukazovala na kontakt, který na disku není.
- R13: `BAND_EXISTS` (souběh dvou oken) → chyba zpět do formuláře; když kontakt prošel a kapela ne, kontakt zůstane a UI to musí říct → `contactWritten`.
- Zápis jde jako text: `JSON.stringify(entity, null, 2)` + koncový `\n` (Ruling 9). Existující kapely mají odsazení 2 mezery.
- `saveBandDraft` **nikdy nerejectne** kvůli zápisu: chyby `invoke` převádí na výsledek. Proto ho guard i tlačítko můžou volat bez `try`.
- `listBandSummaries` — Ruling 7 a 8: `list_bands` + `read_band` pro každou kapelu. Chybějící, nečitelný nebo neplatný soubor jedné kapely dá **položku `kind: "error"`** (id a název z `list_bands`, zpráva s cestou), ne pád celého seznamu. Rejectne jen tehdy, když selže samotné `list_bands`.
- Tauri 2 posílá `ApiError` jako objekt `{ code, message, … }`; samotné Tauri chyby (neznámý příkaz) jako string. `describeApiError` zvládne obojí i `Error`.

- [ ] **Krok 1: Přidej konstanty příkazů**

`packages/desktop/src/app/services/tauriCommands.ts` — do objektu za `UPDATE_MUSICIAN_DEFAULTS: "update_musician_defaults",` přidej:

```ts
  LIST_CATALOG_MUSICIANS: "list_catalog_musicians",
  LIST_PRESETS: "list_presets",
  READ_BAND: "read_band",
  READ_CONTACT: "read_contact",
  WRITE_BAND: "write_band",
  WRITE_CONTACT: "write_contact",
```

- [ ] **Krok 2: Napiš padající testy**

`packages/desktop/src/app/services/bandsApi.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

import { invoke } from "@tauri-apps/api/core";
import { buildBandDraftContext } from "../../../../../src/domain/band/buildBandDraftContext";
import type { BandDraft } from "../../../../../src/domain/band/buildBandFromDraft";
import type { Musician } from "../../../../../src/domain/model/types";
import {
  describeApiError,
  listBandSummaries,
  loadBandFormData,
  saveBandDraft,
} from "./bandsApi";

const invokeMock = vi.mocked(invoke);

const BASSIST: Musician = {
  id: "krecmer_matej",
  firstName: "Matěj",
  lastName: "Krečmer",
  group: "bass",
  presets: [],
};

const CONTEXT = buildBandDraftContext({ musicians: [BASSIST], presets: [], bands: [] });

function draft(overrides: Partial<BandDraft> = {}): BandDraft {
  return {
    name: "Duo Band",
    code: "DB",
    bandLeaderId: "krecmer_matej",
    lineup: { bass: ["krecmer_matej"] },
    leadVocalIds: [],
    contact: { musicianId: "krecmer_matej", phone: "+420731247870" },
    ...overrides,
  };
}

function commandsCalled(): string[] {
  return invokeMock.mock.calls.map((call) => call[0]);
}

function argsOf(callIndex: number): Record<string, unknown> {
  const args = invokeMock.mock.calls[callIndex]?.[1];
  if (!args || Array.isArray(args) || args instanceof ArrayBuffer || args instanceof Uint8Array) {
    throw new Error(`invoke call ${callIndex} has no object arguments`);
  }
  return args;
}

beforeEach(() => {
  invokeMock.mockReset();
});

describe("saveBandDraft", () => {
  it("writes the contact before the band", async () => {
    invokeMock.mockResolvedValue(undefined);

    const result = await saveBandDraft(draft(), CONTEXT);

    expect(result).toEqual({ ok: true, bandId: "duo_band" });
    expect(commandsCalled()).toEqual(["write_contact", "write_band"]);
    expect(argsOf(0).contactId).toBe("krecmer_matej");
    expect(argsOf(1)).toMatchObject({ bandId: "duo_band", expectNew: true });
    expect(JSON.parse(String(argsOf(1).json))).toMatchObject({
      id: "duo_band",
      bandLeader: "krecmer_matej",
      bandLeaderId: "krecmer_matej",
      defaultContactId: "krecmer_matej",
    });
  });

  it("writes nothing when the domain rejects the draft", async () => {
    const result = await saveBandDraft(draft({ name: "" }), CONTEXT);

    expect(result.ok ? null : result.kind).toBe("invalid");
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("writes only the band when there is no contact", async () => {
    invokeMock.mockResolvedValue(undefined);

    await saveBandDraft(draft({ contact: undefined }), CONTEXT);

    expect(commandsCalled()).toEqual(["write_band"]);
  });

  it("updates an existing band without expectNew", async () => {
    invokeMock.mockResolvedValue(undefined);

    await saveBandDraft(draft({ existingId: "duo_band", contact: undefined }), CONTEXT);

    expect(argsOf(0)).toMatchObject({ bandId: "duo_band", expectNew: false });
  });

  it("turns BAND_EXISTS into a name error and reports the written contact", async () => {
    invokeMock
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce({ code: "BAND_EXISTS", message: "A band already exists at x." });

    const result = await saveBandDraft(draft(), CONTEXT);

    expect(result).toEqual({
      ok: false,
      kind: "bandExists",
      contactWritten: true,
      errors: [{ field: "name", message: "A band with this name already exists." }],
    });
  });

  it("does not write the band when the contact write fails", async () => {
    invokeMock.mockRejectedValueOnce({ code: "CONTACT_WRITE_FAILED", message: "disk full" });

    const result = await saveBandDraft(draft(), CONTEXT);

    expect(result).toEqual({
      ok: false,
      kind: "writeFailed",
      message: "disk full",
      contactWritten: false,
    });
    expect(commandsCalled()).toEqual(["write_contact"]);
  });

  it("reports a band write failure after the contact was written", async () => {
    invokeMock
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce({ code: "BAND_WRITE_FAILED", message: "locked" });

    const result = await saveBandDraft(draft(), CONTEXT);

    expect(result).toEqual({
      ok: false,
      kind: "writeFailed",
      message: "locked",
      contactWritten: true,
    });
  });
});

describe("describeApiError", () => {
  it("reads code and message from an ApiError, a string and an Error", () => {
    expect(describeApiError({ code: "BAND_READ_FAILED", message: "Invalid JSON in x.json" })).toEqual({
      code: "BAND_READ_FAILED",
      message: "Invalid JSON in x.json",
    });
    expect(describeApiError("plain")).toEqual({ code: null, message: "plain" });
    expect(describeApiError(new Error("boom"))).toEqual({ code: null, message: "boom" });
  });
});

describe("listBandSummaries", () => {
  it("combines list_bands with the lineup from each band file", async () => {
    invokeMock
      .mockResolvedValueOnce([{ id: "duo_band", name: "Duo Band", code: "DB" }])
      .mockResolvedValueOnce({
        id: "duo_band",
        bandLeaderId: "krecmer_matej",
        defaultLineup: { bass: ["krecmer_matej"] },
      });

    await expect(listBandSummaries()).resolves.toEqual([
      {
        kind: "ok",
        id: "duo_band",
        name: "Duo Band",
        code: "DB",
        memberCount: 1,
        isIncomplete: false,
      },
    ]);
    expect(commandsCalled()).toEqual(["list_bands", "read_band"]);
  });

  it("turns a missing or broken band file into an error item and keeps the others", async () => {
    invokeMock
      .mockResolvedValueOnce([
        { id: "duo_band", name: "Duo Band", code: "DB" },
        { id: "lost_band", name: "Lost Band", code: "LB" },
        { id: "broken_band", name: "Broken Band", code: "BB" },
      ])
      .mockResolvedValueOnce({
        id: "duo_band",
        bandLeaderId: "krecmer_matej",
        defaultLineup: { bass: ["krecmer_matej"] },
      })
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce({
        code: "BAND_READ_FAILED",
        message: "Invalid JSON in C:/StagePilot/catalog/bands/broken_band.json (EOF)",
      });

    const items = await listBandSummaries();

    expect(items.map((item) => item.kind)).toEqual(["ok", "error", "error"]);
    expect(items[1]).toMatchObject({ kind: "error", id: "lost_band", name: "Lost Band" });
    expect(items[1]?.kind === "error" ? items[1].message : "").toContain(
      "catalog/bands/lost_band.json",
    );
    expect(items[2]).toEqual({
      kind: "error",
      id: "broken_band",
      name: "Broken Band",
      message: "Invalid JSON in C:/StagePilot/catalog/bands/broken_band.json (EOF)",
    });
  });
});

describe("loadBandFormData", () => {
  it("reads the default contact of the edited band", async () => {
    invokeMock
      .mockResolvedValueOnce([BASSIST])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ id: "duo_band", defaultContactId: "krecmer_matej" })
      .mockResolvedValueOnce({
        id: "krecmer_matej",
        firstName: "Matěj",
        lastName: "Krečmer",
        phone: "1",
      });

    const data = await loadBandFormData("duo_band");

    expect(commandsCalled()).toEqual([
      "list_catalog_musicians",
      "list_presets",
      "list_bands",
      "read_band",
      "read_contact",
    ]);
    expect(argsOf(4)).toEqual({ contactId: "krecmer_matej" });
    expect(data.contact?.phone).toBe("1");
  });
});
```

11 testů (test chybových položek pokrývá chybějící i nečitelný soubor najednou, aby počty v dalších taskách platily). Pořadí `mockResolvedValueOnce` odpovídá pořadí volání: `Promise.all([...])` i `options.map(async …)` volají `invoke` synchronně v pořadí pole.

- [ ] **Krok 3: Spusť a ověř pád**

Run: `npx vitest run packages/desktop/src/app/services/bandsApi.test.ts`
Expected: FAIL — `Failed to resolve import "./bandsApi"`.

- [ ] **Krok 4: Implementuj**

`packages/desktop/src/app/services/bandsApi.ts`:

```ts
import { invoke } from "@tauri-apps/api/core";
import {
  type BandDraft,
  type BandDraftContext,
  type BandDraftError,
  buildBandFromDraft,
} from "../../../../../src/domain/band/buildBandFromDraft";
import { summarizeBand } from "../../../../../src/domain/band/summarizeBand";
import type { Band, Contact, Musician, PresetEntity } from "../../../../../src/domain/model/types";
import type { BandOption } from "../shell/types";
import { listBands } from "./projectsApi";
import { TAURI_COMMANDS } from "./tauriCommands";

// Co? Jediná cesta desktopu ke kapelám a kontaktům v katalogu (R11).
// Proč? Stránky nesmí volat `invoke` přímo a zápis musí jít přes doménu,
// aby se na disk nikdy nedostala kapela, kterou `buildBandFromDraft` odmítl.

export function listCatalogMusicians() {
  return invoke<Musician[]>(TAURI_COMMANDS.LIST_CATALOG_MUSICIANS);
}

export function listPresets() {
  return invoke<PresetEntity[]>(TAURI_COMMANDS.LIST_PRESETS);
}

export function readBand(bandId: string) {
  return invoke<Band | null>(TAURI_COMMANDS.READ_BAND, { bandId });
}

export function readContact(contactId: string) {
  return invoke<Contact | null>(TAURI_COMMANDS.READ_CONTACT, { contactId });
}

function writeBand(args: { bandId: string; json: string; expectNew: boolean }) {
  return invoke<void>(TAURI_COMMANDS.WRITE_BAND, args);
}

function writeContact(args: { contactId: string; json: string }) {
  return invoke<void>(TAURI_COMMANDS.WRITE_CONTACT, args);
}

/** Rust vrací `ApiError { code, message }`; samotné Tauri chyby chodí jako string. */
export function describeApiError(error: unknown): {
  readonly code: string | null;
  readonly message: string;
} {
  if (typeof error === "string") return { code: null, message: error };
  if (typeof error === "object" && error !== null) {
    const code = "code" in error && typeof error.code === "string" ? error.code : null;
    const message =
      "message" in error && typeof error.message === "string" ? error.message : String(error);
    return { code, message };
  }
  return { code: null, message: String(error) };
}

/** Ruling 8: kapela, jejíž soubor nejde přečíst, je chybová položka, ne pád seznamu. */
export type BandListItem =
  | {
      readonly kind: "ok";
      readonly id: string;
      readonly name: string;
      readonly code: string | null;
      readonly memberCount: number;
      readonly isIncomplete: boolean;
    }
  | {
      readonly kind: "error";
      readonly id: string;
      readonly name: string;
      readonly message: string;
    };

/**
 * Ruling 7: `list_bands` nenese sestavu, proto se ke každé kapele dočte její
 * soubor. Rejectne jen při selhání samotného `list_bands`; chyba jednoho
 * souboru se vrací jako položka `kind: "error"` se zprávou (cestou).
 */
export async function listBandSummaries(): Promise<BandListItem[]> {
  const options = await listBands();
  return Promise.all(options.map(summarizeListedBand));
}

async function summarizeListedBand(option: BandOption): Promise<BandListItem> {
  try {
    const band = await readBand(option.id);
    if (!band) {
      return {
        kind: "error",
        id: option.id,
        name: option.name,
        message: `File catalog/bands/${option.id}.json was not found — the file name must match the band id.`,
      };
    }
    return {
      kind: "ok",
      id: option.id,
      name: option.name,
      code: option.code ?? null,
      ...summarizeBand(band),
    };
  } catch (error) {
    return { kind: "error", id: option.id, name: option.name, message: describeApiError(error).message };
  }
}

export type BandFormData = {
  readonly musicians: readonly Musician[];
  readonly presets: readonly PresetEntity[];
  readonly bands: readonly BandOption[];
  readonly band: Band | null;
  readonly contact: Contact | null;
};

/** Všechno, co formulář potřebuje; rozbitý soubor shodí celé načtení (R13). */
export async function loadBandFormData(bandId: string | null): Promise<BandFormData> {
  const [musicians, presets, bands, band] = await Promise.all([
    listCatalogMusicians(),
    listPresets(),
    listBands(),
    bandId ? readBand(bandId) : Promise.resolve(null),
  ]);
  const contactId = band?.defaultContactId?.trim();
  const contact = contactId ? await readContact(contactId) : null;
  return { musicians, presets, bands, band, contact };
}

export type SaveBandDraftResult =
  | { readonly ok: true; readonly bandId: string }
  | { readonly ok: false; readonly kind: "invalid"; readonly errors: readonly BandDraftError[] }
  | {
      readonly ok: false;
      readonly kind: "bandExists";
      readonly errors: readonly BandDraftError[];
      readonly contactWritten: boolean;
    }
  | {
      readonly ok: false;
      readonly kind: "writeFailed";
      readonly message: string;
      readonly contactWritten: boolean;
    };

/**
 * R11: doména postaví kapelu a kontakt; při chybách se nezapíše nic. Jinak
 * nejdřív kontakt, potom kapela — kapela tak nikdy neukazuje na kontakt,
 * který na disku není. Chyby zápisu se vrací jako výsledek, nerejectuje se.
 */
export async function saveBandDraft(
  draft: BandDraft,
  context: BandDraftContext,
): Promise<SaveBandDraftResult> {
  const built = buildBandFromDraft(draft, context);
  if (!built.ok) return { ok: false, kind: "invalid", errors: built.errors };
  const { band, contact } = built;
  if (contact) {
    try {
      await writeContact({ contactId: contact.id, json: toJsonFile(contact) });
    } catch (error) {
      return { ok: false, kind: "writeFailed", message: describeApiError(error).message, contactWritten: false };
    }
  }
  try {
    await writeBand({ bandId: band.id, json: toJsonFile(band), expectNew: !draft.existingId });
    return { ok: true, bandId: band.id };
  } catch (error) {
    const { code, message } = describeApiError(error);
    const contactWritten = Boolean(contact);
    if (code === "BAND_EXISTS") {
      return {
        ok: false,
        kind: "bandExists",
        contactWritten,
        errors: [{ field: "name", message: "A band with this name already exists." }],
      };
    }
    return { ok: false, kind: "writeFailed", message, contactWritten };
  }
}

function toJsonFile(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
```

- [ ] **Krok 5: Spusť a ověř průchod**

Run: `npx vitest run packages/desktop/src/app/services/bandsApi.test.ts`
Expected: PASS — 11 testů.

- [ ] **Krok 6: Celá sada a desktop tsc**

```bash
npm test 2>&1 | tail -6
npx tsc --noEmit 2>&1 | grep -c "error TS"
npx tsc -p packages/desktop/tsconfig.json --noEmit 2>&1 | grep "error TS" | grep -v -E "BassFieldRendering|buildBassFields|buildKeysFields|applyDerivedVocalOverlays.test|ProjectSetupPage|projectMaintenance.test|resolveStagePositionOrder"
npx tsc -p packages/desktop/tsconfig.json --noEmit 2>&1 | grep -c "error TS"
```

Expected: `Tests  2 failed | 1332 passed (1334)`, `Test Files  2 failed | 173 passed (175)`; root tsc `0`; filtrovaný grep **prázdný** (žádná nová chyba — desktop tsc teď poprvé typově kontroluje `src/domain/band/*` pod `lib: ES2020`); desktop tsc `14`.

- [ ] **Krok 7: Lint**

Nové soubory: `npx biome check --write packages/desktop/src/app/services/bandsApi.ts packages/desktop/src/app/services/bandsApi.test.ts`, pak bez `--write` → 0 chyb. `tauriCommands.ts`: recept HEAD vs BASE → delta 0.

- [ ] **Krok 8: Commit**

```bash
git add packages/desktop/src/app/services/tauriCommands.ts packages/desktop/src/app/services/bandsApi.ts packages/desktop/src/app/services/bandsApi.test.ts
git commit -m "feat(library): add bandsApi that saves the contact before the band through the domain"
```

---

### Task 8: `bandFormModel.ts` — přechody stavu formuláře

**Files:**
- Create: `packages/desktop/src/app/domain/band/bandFormModel.ts`
- Create: `packages/desktop/src/app/domain/band/bandFormModel.test.ts`

**Interfaces:**
- Consumes:
  - `deriveBandCode(name: string): string` (Task 2)
  - `BandDraft` (Task 4); v testu `buildBandFromDraft` (Task 4) a `buildBandDraftContext` (Task 5)
  - `LINEUP_ASSIGNMENT_ROLES`, `type LineupRole`, `normalizeLineupAssignments` — `src/domain/lineup/lineupAssignments.ts`
  - `resolveMusicianDisplayName(args: { musicianId: string; preferredName?: string | null }): string` — `packages/desktop/src/app/domain/ui/musicianDisplayName.ts`
- Produces (z `packages/desktop/src/app/domain/band/bandFormModel.ts`):
  ```ts
  export type BandFormContact =
    | { readonly mode: "none" }
    | { readonly mode: "member"; readonly musicianId: string; readonly phone: string; readonly email: string };
  export type BandFormState = {
    readonly name: string;
    readonly code: string;
    readonly codeTouched: boolean;
    readonly lineup: Readonly<Record<LineupRole, readonly string[]>>;
    readonly bandLeaderId: string;
    readonly leadVocalIds: readonly string[];
    readonly contact: BandFormContact;
  };
  export type BandFormUpdate = (update: (state: BandFormState) => BandFormState) => void;
  export function createEmptyBandForm(): BandFormState;
  export function bandFormFromBand(band: Band, contact: Contact | null): BandFormState;
  export function serializeBandForm(state: BandFormState): string;
  export function lineupMemberIds(state: BandFormState): string[];
  export function musicianLabel(musician: Musician): string;
  export function availableMusiciansForGroup(musicians: readonly Musician[], role: LineupRole, state: BandFormState): Musician[];
  export function setBandName(state: BandFormState, name: string): BandFormState;
  export function setBandCode(state: BandFormState, code: string): BandFormState;
  export function addMembersToGroup(state: BandFormState, role: LineupRole, musicianIds: readonly string[]): BandFormState;
  export function removeMember(state: BandFormState, musicianId: string): BandFormState;
  export function setBandLeader(state: BandFormState, musicianId: string): BandFormState;
  export function toggleLeadVocal(state: BandFormState, musicianId: string): BandFormState;
  export function defaultContactMemberId(state: BandFormState): string;
  export function disableContact(state: BandFormState): BandFormState;
  export function setContactMember(state: BandFormState, musicianId: string, existing: Contact | null): BandFormState;
  export function setContactField(state: BandFormState, field: "phone" | "email", value: string): BandFormState;
  export function toBandDraft(state: BandFormState, existingId: string | null): BandDraft;
  ```
  Task 11 na nich staví celé UI formuláře.

**Kontext**

Repo nemá jsdom, komponenty se interakcí testovat nedají. Každé rozhodnutí formuláře je proto čistá funkce tady. Pravidla:
- R5 + Ruling 13: zkratka se dopočítává z názvu, dokud `codeTouched` je `false`; u uložené kapely startuje `true`.
- R12 blok 3: člen odebraný ze sestavy mizí z kapelníka i lead vokálů.
- Ruling 14: přidání do skupiny `vocs` zaškrtne lead vokál.
- Review Focus 4 / Ruling: odebraný kontakt nechá telefon a e-mail, vyprázdní jen `musicianId` — doména pak vrátí chybu u kontaktu.
- R2: výchozí kontaktní osoba je kapelník (když je v sestavě), jinak první člen.
- Načtená kapela může nést jen `bandLeaderId` (reálné soubory, Task 4 krok 1).
- Stav je diskriminovaná unie u kontaktu (CLAUDE.md: unie místo volitelných polí).

- [ ] **Krok 1: Napiš padající testy**

`packages/desktop/src/app/domain/band/bandFormModel.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildBandDraftContext } from "../../../../../../src/domain/band/buildBandDraftContext";
import { buildBandFromDraft } from "../../../../../../src/domain/band/buildBandFromDraft";
import type { Band, Musician } from "../../../../../../src/domain/model/types";
import {
  type BandFormState,
  addMembersToGroup,
  availableMusiciansForGroup,
  bandFormFromBand,
  createEmptyBandForm,
  defaultContactMemberId,
  disableContact,
  removeMember,
  setBandCode,
  setBandLeader,
  setBandName,
  setContactField,
  setContactMember,
  toBandDraft,
  toggleLeadVocal,
} from "./bandFormModel";

const MUSICIANS: Musician[] = [
  { id: "plasil_pavel", firstName: "Pavel", lastName: "Plašil", group: "drums", presets: [] },
  { id: "nyvlt_jakub", firstName: "Jakub", lastName: "Nývlt", group: "drums", presets: [] },
  { id: "ernst_filip", firstName: "Filip", lastName: "Ernst", group: "drums", presets: [] },
  { id: "krecmer_matej", firstName: "Matěj", lastName: "Krečmer", group: "bass", presets: [] },
  { id: "krecmerova_eliska", firstName: "Eliška", lastName: "Krečmerová", group: "vocs", presets: [] },
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
  defaultOverlays: { leadVocals: ["krecmerova_eliska"], backVocals: ["plasil_pavel"] },
};

function withLineup(): BandFormState {
  let state = createEmptyBandForm();
  state = addMembersToGroup(state, "drums", ["plasil_pavel"]);
  state = addMembersToGroup(state, "bass", ["krecmer_matej"]);
  return addMembersToGroup(state, "vocs", ["krecmerova_eliska"]);
}

describe("bandFormModel", () => {
  it("derives the code from the name until the user edits it", () => {
    const named = setBandName(createEmptyBandForm(), "Big Night Band");
    expect(named.code).toBe("BNB");
    expect(named.codeTouched).toBe(false);

    const edited = setBandCode(named, "BIG");
    expect(setBandName(edited, "Big Night Orchestra").code).toBe("BIG");
  });

  it("bandFormFromBand treats the stored code as manual and reads bandLeaderId", () => {
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
    expect(state.leadVocalIds).toEqual(["krecmerova_eliska"]);
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
    ).toEqual({ mode: "member", musicianId: "krecmer_matej", phone: "+420", email: "m@example.com" });
    expect(bandFormFromBand({ ...BAND_FILE, defaultContactId: undefined }, null).contact).toEqual({
      mode: "none",
    });
  });

  it("pre-checks an added vocalist as lead vocals and toggles them", () => {
    const state = withLineup();

    expect(state.leadVocalIds).toEqual(["krecmerova_eliska"]);
    expect(toggleLeadVocal(state, "krecmerova_eliska").leadVocalIds).toEqual([]);
    expect(toggleLeadVocal(state, "krecmer_matej").leadVocalIds).toEqual([
      "krecmerova_eliska",
      "krecmer_matej",
    ]);
  });

  it("ignores musicians who are already in the lineup", () => {
    const state = addMembersToGroup(withLineup(), "drums", [
      "plasil_pavel",
      "krecmer_matej",
      "nyvlt_jakub",
      "nyvlt_jakub",
    ]);

    expect(state.lineup.drums).toEqual(["plasil_pavel", "nyvlt_jakub"]);
    expect(state.lineup.bass).toEqual(["krecmer_matej"]);
  });

  it("removeMember clears the member from the lineup, the leader and lead vocals", () => {
    const state = removeMember(setBandLeader(withLineup(), "krecmerova_eliska"), "krecmerova_eliska");

    expect(state.lineup.vocs).toEqual([]);
    expect(state.bandLeaderId).toBe("");
    expect(state.leadVocalIds).toEqual([]);
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
    expect(defaultContactMemberId(setBandLeader(withLineup(), "krecmer_matej"))).toBe("krecmer_matej");
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
    expect(disableContact(setContactMember(withLineup(), "krecmer_matej", null)).contact).toEqual({
      mode: "none",
    });
  });

  it("toBandDraft maps the state and omits a switched-off contact", () => {
    const state = setBandLeader(setBandName(withLineup(), "Duo"), "krecmer_matej");

    expect(toBandDraft(state, null)).toEqual({
      name: "Duo",
      code: "DUO",
      bandLeaderId: "krecmer_matej",
      lineup: state.lineup,
      leadVocalIds: ["krecmerova_eliska"],
    });
    expect(toBandDraft(state, "duo")).toMatchObject({ existingId: "duo" });
  });

  it("a draft with a removed contact fails in the domain instead of writing it", () => {
    let state = setBandLeader(setBandName(withLineup(), "Duo"), "plasil_pavel");
    state = setContactField(setContactMember(state, "krecmer_matej", null), "phone", "+420731247870");
    state = removeMember(state, "krecmer_matej");

    const result = buildBandFromDraft(
      toBandDraft(state, null),
      buildBandDraftContext({ musicians: MUSICIANS, presets: [], bands: [] }),
    );

    expect(result.ok ? [] : result.errors.map((error) => error.field)).toEqual(["contact"]);
  });

  it("availableMusiciansForGroup offers the group's musicians outside the lineup, by name", () => {
    const state = withLineup();

    expect(availableMusiciansForGroup(MUSICIANS, "drums", state).map((item) => item.id)).toEqual([
      "ernst_filip",
      "nyvlt_jakub",
    ]);
    expect(availableMusiciansForGroup(MUSICIANS, "bass", state)).toEqual([]);
  });
});
```

13 testů.

- [ ] **Krok 2: Spusť a ověř pád**

Run: `npx vitest run packages/desktop/src/app/domain/band/bandFormModel.test.ts`
Expected: FAIL — `Failed to resolve import "./bandFormModel"`.

- [ ] **Krok 3: Implementuj**

`packages/desktop/src/app/domain/band/bandFormModel.ts`:

```ts
import { deriveBandCode } from "../../../../../../src/domain/band/bandCode";
import type { BandDraft } from "../../../../../../src/domain/band/buildBandFromDraft";
import {
  LINEUP_ASSIGNMENT_ROLES,
  type LineupRole,
  normalizeLineupAssignments,
} from "../../../../../../src/domain/lineup/lineupAssignments";
import type { Band, Contact, Musician } from "../../../../../../src/domain/model/types";
import { resolveMusicianDisplayName } from "../ui/musicianDisplayName";

// Co? Stav formuláře kapely a jeho přechody jako čisté funkce.
// Proč tady? Repo nemá jsdom; každé rozhodnutí formuláře (dopočet zkratky,
// odebrání člena, výchozí kontakt) musí být testovatelné bez Reactu.

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
  readonly lineup: Readonly<Record<LineupRole, readonly string[]>>;
  readonly bandLeaderId: string;
  readonly leadVocalIds: readonly string[];
  readonly contact: BandFormContact;
};

export type BandFormUpdate = (update: (state: BandFormState) => BandFormState) => void;

const EMPTY_LINEUP: Readonly<Record<LineupRole, readonly string[]>> = {
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
    leadVocalIds: [],
    contact: { mode: "none" },
  };
}

/** Ruling 13: uložená zkratka se bere jako ruční. Reálné soubory nesou jen `bandLeaderId`. */
export function bandFormFromBand(band: Band, contact: Contact | null): BandFormState {
  const contactId = band.defaultContactId?.trim() ?? "";
  return {
    name: band.name,
    code: band.code ?? "",
    codeTouched: true,
    lineup: normalizeLineupAssignments(band.defaultLineup),
    bandLeaderId: (band.bandLeader ?? "").trim() || (band.bandLeaderId ?? "").trim(),
    leadVocalIds: [...(band.defaultOverlays?.leadVocals ?? [])],
    contact: contactId
      ? { mode: "member", musicianId: contactId, phone: contact?.phone ?? "", email: contact?.email ?? "" }
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
    .sort((left, right) => musicianLabel(left).localeCompare(musicianLabel(right)));
}

export function setBandName(state: BandFormState, name: string): BandFormState {
  return { ...state, name, code: state.codeTouched ? state.code : deriveBandCode(name) };
}

export function setBandCode(state: BandFormState, code: string): BandFormState {
  return { ...state, code, codeTouched: true };
}

/** Ruling 14: kdo přibude do `vocs`, je předvyplněný jako lead vokál. */
export function addMembersToGroup(
  state: BandFormState,
  role: LineupRole,
  musicianIds: readonly string[],
): BandFormState {
  const present = new Set(lineupMemberIds(state));
  const added = [...new Set(musicianIds)].filter((musicianId) => !present.has(musicianId));
  if (added.length === 0) return state;
  return {
    ...state,
    lineup: { ...state.lineup, [role]: [...state.lineup[role], ...added] },
    leadVocalIds: role === "vocs" ? [...state.leadVocalIds, ...added] : state.leadVocalIds,
  };
}

/** R12: odebraný člen mizí z kapelníka i lead vokálů; kontakt si nechá telefon a e-mail. */
export function removeMember(state: BandFormState, musicianId: string): BandFormState {
  const without = (ids: readonly string[]) => ids.filter((id) => id !== musicianId);
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
    leadVocalIds: without(state.leadVocalIds),
    contact:
      contact.mode === "member" && contact.musicianId === musicianId
        ? { ...contact, musicianId: "" }
        : contact,
  };
}

export function setBandLeader(state: BandFormState, musicianId: string): BandFormState {
  return { ...state, bandLeaderId: musicianId };
}

export function toggleLeadVocal(state: BandFormState, musicianId: string): BandFormState {
  const isLead = state.leadVocalIds.includes(musicianId);
  return {
    ...state,
    leadVocalIds: isLead
      ? state.leadVocalIds.filter((id) => id !== musicianId)
      : [...state.leadVocalIds, musicianId],
  };
}

/** R2: výchozí kontaktní osoba je kapelník, pokud je v sestavě; jinak první člen. */
export function defaultContactMemberId(state: BandFormState): string {
  const members = lineupMemberIds(state);
  if (state.bandLeaderId && members.includes(state.bandLeaderId)) return state.bandLeaderId;
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
    contact: field === "phone" ? { ...contact, phone: value } : { ...contact, email: value },
  };
}

export function toBandDraft(state: BandFormState, existingId: string | null): BandDraft {
  const contact = state.contact;
  return {
    name: state.name,
    code: state.code,
    ...(state.bandLeaderId ? { bandLeaderId: state.bandLeaderId } : {}),
    lineup: state.lineup,
    leadVocalIds: state.leadVocalIds,
    ...(contact.mode === "member"
      ? { contact: { musicianId: contact.musicianId, phone: contact.phone, email: contact.email } }
      : {}),
    ...(existingId ? { existingId } : {}),
  };
}
```

Pozn.: `[...new Set(musicianIds)]` i spread `Set` jsou pod `target: ES2020` v desktopu v pořádku. Kdyby TS u `lineup: { ...state.lineup, [role]: … }` hlásil, že typ nesedí na `Readonly<Record<LineupRole, …>>`, rozepiš ho stejně jako v `removeMember` (pět klíčů s podmínkou `role === "drums" ? … : …`) — **ne** přes `as`.

- [ ] **Krok 4: Spusť a ověř průchod**

Run: `npx vitest run packages/desktop/src/app/domain/band/bandFormModel.test.ts`
Expected: PASS — 13 testů.

- [ ] **Krok 5: Celá sada a desktop tsc**

```bash
npm test 2>&1 | tail -6
npx tsc -p packages/desktop/tsconfig.json --noEmit 2>&1 | grep -c "error TS"
```

Expected: `Tests  2 failed | 1345 passed (1347)`, `Test Files  2 failed | 174 passed (176)`; desktop tsc `14` (stejné soubory a texty jako baseline).

- [ ] **Krok 6: Lint**

`npx biome check --write` na oba nové soubory, pak bez `--write` → 0 chyb.

- [ ] **Krok 7: Commit**

```bash
git add packages/desktop/src/app/domain/band/bandFormModel.ts packages/desktop/src/app/domain/band/bandFormModel.test.ts
git commit -m "feat(library): add the band form state model with lineup, roles and contact transitions"
```

---

### Task 9: Vytažení `AddMusiciansMultiSelect` do `app/components/roles/`

**Files:**
- Create: `packages/desktop/src/app/components/roles/AddMusiciansMultiSelect.tsx`
- Modify: `packages/desktop/src/app/pages/ProjectSetupPage.tsx` — řádek 3 (`createPortal` import), řádek 23 (`ChevronDown,` v importu ikon), řádky 175-370 (typ + funkce), import nové komponenty

**Interfaces:**
- Consumes: nic z předchozích tasků.
- Produces: `packages/desktop/src/app/components/roles/AddMusiciansMultiSelect.tsx`:
  ```ts
  export type AddMusiciansMultiSelectProps = {
    id: string;
    options: MemberOption[];
    selectedIds: string[];
    placeholder: string;
    onSelectionChange: (nextSelectedIds: string[]) => void;
    onAddSelected: (selectedIds: string[]) => void;
  };
  export function AddMusiciansMultiSelect(props: AddMusiciansMultiSelectProps): JSX.Element;
  ```
  Task 11 (`BandLineupSection`) ji použije.

**Kontext**

Ruling 12. **Čistý přesun beze změny chování** — žádné úpravy logiky, tříd ani existujícího inline `style` (pre-existing; jeho odstranění by byl jiný refaktoring). Ověřeno na `6b67c25`:
- blok začíná řádkem 175 `type AddMusiciansMultiSelectProps = {` a končí řádkem 370 `}` (předchází mu `  );`), za ním prázdný řádek 371 a `export function ProjectSetupPage({` na 372;
- blok používá jen `useCallback, useEffect, useMemo, useRef, useState`, `createPortal`, `ChevronDown` a typ `MemberOption`;
- mimo blok `ProjectSetupPage.tsx` **nepoužívá** `createPortal` ani `ChevronDown` (jediný další výskyt je import) → oba importy po přesunu musí zmizet, jinak `noUnusedLocals`; `useRef` a ostatní hooky se mimo blok používají dál a zůstávají;
- soubor má CRLF (autocrlf) — skript zachová konce řádků.

- [ ] **Krok 1: Ověř hranice bloku**

```bash
cd /c/Users/mkrecmer/dev/stagepilot
grep -n "type AddMusiciansMultiSelectProps\|^function AddMusiciansMultiSelect\|^export function ProjectSetupPage\|createPortal\|ChevronDown" packages/desktop/src/app/pages/ProjectSetupPage.tsx
```

Expected: `3:import { createPortal }`, `23:  ChevronDown,`, `175:type AddMusiciansMultiSelectProps`, `184:function AddMusiciansMultiSelect`, `299:          <ChevronDown size={14} />`, `303:        ? createPortal(`, `372:export function ProjectSetupPage`. Jiné číslo → skript níže hledá podle obsahu, ne podle čísel, ale **zastav se, pokud se liší obsah řádků**.

- [ ] **Krok 2: Přesuň blok skriptem**

Ulož do `$SCRATCH/extract_multiselect.py`:

```python
import io

PAGE = "packages/desktop/src/app/pages/ProjectSetupPage.tsx"
TARGET = "packages/desktop/src/app/components/roles/AddMusiciansMultiSelect.tsx"

with io.open(PAGE, encoding="utf-8", newline="") as handle:
    text = handle.read()
eol = "\r\n" if "\r\n" in text else "\n"
lines = text.split(eol)

start = lines.index("type AddMusiciansMultiSelectProps = {")
end = next(
    index
    for index in range(start + 1, len(lines))
    if lines[index] == "}" and lines[index - 1] == "  );"
)
assert lines[end + 1] == "", repr(lines[end + 1])
assert lines[end + 2].startswith("export function ProjectSetupPage("), lines[end + 2]
block = lines[start : end + 1]
assert sum(1 for line in block if line.startswith("function AddMusiciansMultiSelect(")) == 1
del lines[start : end + 2]

assert lines.count('import { createPortal } from "react-dom";') == 1
lines.remove('import { createPortal } from "react-dom";')
assert lines.count("  ChevronDown,") == 1
lines.remove("  ChevronDown,")

anchor = 'import { BackVocsBlock } from "../components/roles/BackVocsBlock";'
assert lines.count(anchor) == 1
lines.insert(
    lines.index(anchor),
    'import { AddMusiciansMultiSelect } from "../components/roles/AddMusiciansMultiSelect";',
)

with io.open(PAGE, "w", encoding="utf-8", newline="") as handle:
    handle.write(eol.join(lines))

block[0] = block[0].replace("type AddMusiciansMultiSelectProps", "export type AddMusiciansMultiSelectProps", 1)
fn_index = next(i for i, line in enumerate(block) if line.startswith("function AddMusiciansMultiSelect("))
block[fn_index] = "export " + block[fn_index]
header = [
    'import { useCallback, useEffect, useMemo, useRef, useState } from "react";',
    'import { createPortal } from "react-dom";',
    'import { ChevronDown } from "../../../components/ui/icons";',
    'import type { MemberOption } from "../../shell/types";',
    "",
    "/**",
    " * Popover for adding several musicians at once. Moved verbatim out of",
    " * ProjectSetupPage so the band form can reuse it (band editor spec R12).",
    " */",
]
with io.open(TARGET, "w", encoding="utf-8", newline="\n") as handle:
    handle.write("\n".join(header + block) + "\n")

print("moved", len(block), "lines")
```

Run (z kořene repa): `python "$SCRATCH/extract_multiselect.py"`
Expected: `moved 196 lines`. Jakákoli `AssertionError` → soubor se nezapsal (asserty jsou před zápisem stránky); zastav se a eskaluj.

- [ ] **Krok 3: Ověř přesun**

```bash
grep -rn "function AddMusiciansMultiSelect\|type AddMusiciansMultiSelectProps" packages/desktop/src
grep -n "createPortal\|ChevronDown\|AddMusiciansMultiSelect" packages/desktop/src/app/pages/ProjectSetupPage.tsx
npx tsc -p packages/desktop/tsconfig.json --noEmit 2>&1 | grep "error TS"
```

Expected:
- definice jen v `app/components/roles/AddMusiciansMultiSelect.tsx` (2 řádky);
- v `ProjectSetupPage.tsx` jen nový import a použití `<AddMusiciansMultiSelect` (dnes kolem řádku 1784, po přesunu o ~196 výš); žádné `createPortal` ani `ChevronDown`;
- desktop tsc: **14 chyb, tytéž soubory a texty**; chyba `ProjectSetupPage.tsx … Record<string, PresetEntity> | undefined` je teď na řádku 469 místo 667 (ověřeno nanečisto).

- [ ] **Krok 4: Build a testy**

```bash
(cd packages/desktop && npx vite build 2>&1 | tail -2)
npm test 2>&1 | tail -6
```

Expected: `✓ built in …`; `Tests  2 failed | 1345 passed (1347)` (beze změny).

- [ ] **Krok 5: Lint**

Nový soubor: `npx biome check --write packages/desktop/src/app/components/roles/AddMusiciansMultiSelect.tsx`, pak bez `--write`. Povolený nález: případné pravidlo na inline `style` nebo a11y u přesunutého kódu — **zapiš ho do reportu, neopravuj** (stejný kód má na BASE v `ProjectSetupPage.tsx` stejný nález; ověř receptem na BASE verzi `ProjectSetupPage.tsx`). `ProjectSetupPage.tsx`: recept HEAD vs BASE — počet nálezů nesmí vzrůst.

- [ ] **Krok 6: Commit**

```bash
git add packages/desktop/src/app/components/roles/AddMusiciansMultiSelect.tsx packages/desktop/src/app/pages/ProjectSetupPage.tsx
git commit -m "refactor(roles): move AddMusiciansMultiSelect out of ProjectSetupPage for reuse"
```

---
## KROK D — stránky

Stránky z Tasků 10 a 11 vznikají **nezaroutované a neexportované z `pages/index.ts`**. Důvod: starý `LibraryPages.tsx` exportuje komponentu se stejným jménem `LibraryBandsPage` a `pages/index.ts:10` ho re-exportuje — dvojí `export *` se stejným jménem by `ShellRoutedPages` rozbil. Přepnutí udělá Task 12 jedním commitem. Do té doby se nové stránky ověřují jen typovou kontrolou a buildem; ruční průchod je až po Tasku 12.

### Task 10: `LibraryBandsPage.tsx` — seznam kapel

**Files:**
- Create: `packages/desktop/src/app/pages/LibraryBandsPage.tsx`

**Interfaces:**
- Consumes: `listBandSummaries(): Promise<BandListItem[]>`, `BandListItem`, `describeApiError` (Task 7); `LibraryPageProps = { navigate: (path: string) => void; registerNavigationGuard: (guard: NavigationGuard | null) => void }` (`app/pages/shared/pageTypes.ts:20-23`); `EmptyState` (`components/ui/EmptyState.tsx:11`); `Inbox` (`components/ui/icons.tsx`); `useToast` (`components/ui/toast/useToast.ts`).
- Produces: `export function LibraryBandsPage(props: LibraryPageProps): JSX.Element` — Task 12 ji zaroutuje na `/library` i `/library/bands`.

**Kontext**

R12: `/library` = seznam kapel; název, zkratka, počet členů, štítek „neúplná" (Ruling 16: `Incomplete`); prázdný stav přes `EmptyState` („No bands yet" + akce „New band"); tlačítko „New band" v hlavičce. R13: rozbitý soubor → chyba v toastu, žádné tiché polykání (starý `LibraryPages.tsx:21-23` měl `.catch(() => undefined)`). Ruling 8: položka `kind: "error"` z `listBandSummaries` je **chybový řádek** — název, zpráva s cestou, štítek `Unreadable`, **bez tlačítka Edit** — a ostatní kapely zůstanou použitelné; jeden toast ohlásí počet nečitelných kapel. Celostránková chyba zůstává jen pro selhání `list_bands`.

Třídy se znovu používají (Ruling 15): `.library-table` a `.library-row` (`styles/features/library.css` — mřížka přesně o 5 sloupcích: název, zkratka, členové, štítek, akce), `.setup-badge.setup-badge--override` (`lineup.css:387-402`), `.panel`, `.panel__header`, `.status`, `.status--error`, `.button-primary`, `.button-secondary`.

- [ ] **Krok 1: Napiš stránku**

`packages/desktop/src/app/pages/LibraryBandsPage.tsx`:

```tsx
import { useEffect, useState } from "react";
import { EmptyState } from "../../components/ui/EmptyState";
import { Inbox } from "../../components/ui/icons";
import { useToast } from "../../components/ui/toast/useToast";
import { type BandListItem, describeApiError, listBandSummaries } from "../services/bandsApi";
import type { LibraryPageProps } from "./shared/pageTypes";

type BandListState =
  | { readonly kind: "loading" }
  | { readonly kind: "ready"; readonly items: readonly BandListItem[] }
  | { readonly kind: "error"; readonly message: string };

/**
 * `/library` (R12): s jedinou entitou nemá rozcestník smysl, Library je
 * rovnou seznam kapel. Muzikanti si při svém specu přidají vlastní záložku.
 */
export function LibraryBandsPage({ navigate, registerNavigationGuard }: LibraryPageProps) {
  const { notify } = useToast();
  const [state, setState] = useState<BandListState>({ kind: "loading" });

  useEffect(() => {
    registerNavigationGuard(null);
    let active = true;
    listBandSummaries()
      .then((items) => {
        if (!active) return;
        setState({ kind: "ready", items });
        const unreadable = items.filter((item) => item.kind === "error").length;
        if (unreadable > 0) {
          notify(
            "error",
            unreadable === 1
              ? "1 band file could not be read. See the list for the file path."
              : `${unreadable} band files could not be read. See the list for the file paths.`,
          );
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        const { message } = describeApiError(error);
        setState({ kind: "error", message });
        notify("error", `Bands could not be loaded: ${message}`);
      });
    return () => {
      active = false;
      registerNavigationGuard(null);
    };
  }, [notify, registerNavigationGuard]);

  const openNewBand = () => navigate("/library/bands/new");

  return (
    <section className="panel">
      <div className="panel__header">
        <h2>Bands</h2>
        <button type="button" className="button-primary" onClick={openNewBand}>
          New band
        </button>
      </div>
      <div aria-live="polite">
        <BandListBody state={state} navigate={navigate} onNewBand={openNewBand} />
      </div>
    </section>
  );
}

function BandListBody({
  state,
  navigate,
  onNewBand,
}: {
  state: BandListState;
  navigate: (path: string) => void;
  onNewBand: () => void;
}) {
  if (state.kind === "loading") return <p className="status">Loading bands…</p>;
  if (state.kind === "error") {
    return (
      <p className="status status--error" role="alert">
        {state.message}
      </p>
    );
  }
  if (state.items.length === 0) {
    return (
      <EmptyState
        icon={<Inbox size={22} />}
        title="No bands yet"
        description="A band holds the lineup, the band leader and the contact that a new project starts from."
        action={
          <button type="button" className="button-primary" onClick={onNewBand}>
            New band
          </button>
        }
      />
    );
  }
  return (
    <div className="library-table">
      {state.items.map((item) =>
        item.kind === "error" ? (
          <div key={item.id} className="library-row">
            <span>{item.name}</span>
            <span className="field-error">{item.message}</span>
            <span />
            <span>
              <span className="setup-badge setup-badge--override">Unreadable</span>
            </span>
            <span />
          </div>
        ) : (
          <div key={item.id} className="library-row">
            <span>{item.name}</span>
            <span>{item.code ?? "—"}</span>
            <span>{formatMemberCount(item.memberCount)}</span>
            <span>
              {item.isIncomplete ? (
                <span className="setup-badge setup-badge--override">Incomplete</span>
              ) : null}
            </span>
            <button
              type="button"
              className="button-secondary"
              onClick={() => navigate(`/library/bands/${encodeURIComponent(item.id)}`)}
            >
              Edit
            </button>
          </div>
        ),
      )}
    </div>
  );
}

function formatMemberCount(count: number): string {
  return count === 1 ? "1 member" : `${count} members`;
}
```

- [ ] **Krok 2: Typová kontrola, build, testy**

```bash
npx tsc -p packages/desktop/tsconfig.json --noEmit 2>&1 | grep -c "error TS"
npx tsc -p packages/desktop/tsconfig.json --noEmit 2>&1 | grep "LibraryBandsPage"
(cd packages/desktop && npx vite build 2>&1 | tail -2)
npm test 2>&1 | tail -6
grep -n "invoke" packages/desktop/src/app/pages/LibraryBandsPage.tsx
```

Expected: desktop tsc `14`; grep na `LibraryBandsPage` prázdný (soubor je v `include: ["src"]`, takže se kontroluje, i když ho nikdo neimportuje); build `✓ built`; `Tests  2 failed | 1345 passed (1347)`; grep `invoke` prázdný.

- [ ] **Krok 3: Lint**

`npx biome check --write packages/desktop/src/app/pages/LibraryBandsPage.tsx`, pak bez `--write` → 0 chyb.

- [ ] **Krok 4: Commit**

```bash
git add packages/desktop/src/app/pages/LibraryBandsPage.tsx
git commit -m "feat(library): add the band list page with member count and incomplete badge"
```

---

### Task 11: `LibraryBandFormPage.tsx` + komponenty formuláře

**Files:**
- Create: `packages/desktop/src/app/components/band/FieldErrors.tsx`
- Create: `packages/desktop/src/app/components/band/BandIdentitySection.tsx`
- Create: `packages/desktop/src/app/components/band/BandLineupSection.tsx`
- Create: `packages/desktop/src/app/components/band/BandRolesSection.tsx`
- Create: `packages/desktop/src/app/components/band/BandContactSection.tsx`
- Create: `packages/desktop/src/app/pages/LibraryBandFormPage.tsx`
- Modify: `packages/desktop/src/app/shell/routes.ts` (za `matchLibraryBandDetailPath`, dnes řádky 83-85: nová konstanta)
- Modify: `packages/desktop/src/styles/features/library.css` (na konec: tři třídy)

**Interfaces:**
- Consumes:
  - Task 4: `BandDraftError`, `BandDraftField`, `BandDraftContext`
  - Task 5: `buildBandDraftContext`
  - Task 7: `loadBandFormData`, `readContact`, `saveBandDraft`, `describeApiError`, `BandFormData`, `SaveBandDraftResult`
  - Task 8: všechno z `bandFormModel.ts` (seznam v Tasku 8)
  - Task 9: `AddMusiciansMultiSelect`
  - existující: `LineupRow({ roleLabel, names, emptyLabel?, hint?, meta?, actions? })` (`app/components/roles/LineupRow.tsx:22-41`); `getRoleDisplayName(role: string): string` (`packages/desktop/src/projectRules.ts:419`, vrací `DRUMS`, `BASS`, `GUITAR`, `KEYS`, `VOCS`); `LINEUP_ASSIGNMENT_ROLES`, `LineupRole`; `EmptyState`; `Info` ikona; `useToast`.
- Produces:
  - `export const NEW_BAND_ROUTE_SEGMENT = "new";` — `app/shell/routes.ts`. Task 12 ho použije v routeru.
  - `export type LibraryBandFormPageProps = LibraryPageProps & { readonly bandId: string | null; readonly onBandSaved: () => Promise<void> };`
  - `export function LibraryBandFormPage(props: LibraryBandFormPageProps): JSX.Element` — Task 12 ji zaroutuje na `/library/bands/new` (`bandId: null`) a `/library/bands/:id`.

**Kontext, který nesmíš přehlédnout**

- **R12 bloky shora dolů:** Identita (název; zkratka s nápovědou „Derived from name", která zmizí po ručním zásahu; u existující kapely id jen zobrazené) → Sestava (pět řádků ve stylu `01 LINEUP` přes `LineupRow` uvnitř `.lineup-rows`; odebrání; „Add" přes `AddMusiciansMultiSelect`; bez muzikantů `EmptyState` „No musicians in your library yet" bez akce) → Role (kapelník jako select, lead vokály jako zaškrtávátka nad členy) → Kontakt (přepínač „No contact / Band member"; select člena, výchozí kapelník; phone, email; výběr člena načte existující kontakt).
- **Uložení:** chyby u polí; po úspěchu toast „Band saved."; u nové kapely přesměrování na `/library/bands/:id`.
- **Guard:** `isDirty` porovnává otisk aktuálního formuláře s otiskem posledního načtení/uložení přes **refy**, ne přes zachycený stav — po uložení nové kapely se hned volá `navigate` a guard musí vidět „čisto" ještě před překreslením. `save` při neúspěchu **musí vyhodit**, jinak `saveAndExit` odejde i s chybou (`useAppNavigation.ts:95-106`).
- **Ruling 10:** po úspěšném uložení `onBandSaved()` (obnova kapel v shellu). Jeho selhání nesmí shodit uložení — jen toast.
- **Ruling 3:** kontext dostane `reservedIds: [NEW_BAND_ROUTE_SEGMENT]`.
- Remount mezi `/library/bands/new` a `/library/bands/:id` zajistí `key` v routeru (Task 12) — stránka sama nic resetovat nemusí.
- Žádné inline styly; nové třídy jen v `library.css`. Žádné `invoke`.
- Komponenty dostávají `onChange: BandFormUpdate` (= `setForm` z Reactu, ten updater funkci přijme).

- [ ] **Krok 1: Konstanta routy a CSS**

`packages/desktop/src/app/shell/routes.ts` — za funkci `matchLibraryBandDetailPath` (končí řádkem 85) vlož:

```ts

/** Segment routy nové kapely. `matchLibraryBandDetailPath` ho matchuje taky, proto id `new` nesmí vzniknout. */
export const NEW_BAND_ROUTE_SEGMENT = "new";
```

Na konec `packages/desktop/src/styles/features/library.css` přidej:

```css

/* --------------------------------------------------------------------------
   Band form — four blocks stacked, each a .lineup-card (band editor spec R12)
   -------------------------------------------------------------------------- */
.band-form {
  display: grid;
  gap: var(--sp-7);
}

.band-form__checks {
  display: grid;
  gap: var(--sp-3);
  margin: 0;
  padding: 0;
  border: 0;
}

.band-form__errors {
  display: grid;
  gap: var(--sp-1);
}
```

- [ ] **Krok 2: `FieldErrors.tsx`**

`packages/desktop/src/app/components/band/FieldErrors.tsx`:

```tsx
import type {
  BandDraftError,
  BandDraftField,
} from "../../../../../../src/domain/band/buildBandFromDraft";

export function hasFieldError(errors: readonly BandDraftError[], field: BandDraftField): boolean {
  return errors.some((error) => error.field === field);
}

/** R9: chyby domény se ukazují u pole, ke kterému patří. */
export function FieldErrors({
  errors,
  field,
}: {
  errors: readonly BandDraftError[];
  field: BandDraftField;
}) {
  const messages = [
    ...new Set(errors.filter((error) => error.field === field).map((error) => error.message)),
  ];
  if (messages.length === 0) return null;
  return (
    <span className="band-form__errors">
      {messages.map((message) => (
        <span key={message} className="field-error" role="alert">
          {message}
        </span>
      ))}
    </span>
  );
}
```

`span` místo `p`/`div`, protože se vykresluje uvnitř `<label>` (povolený je jen frázový obsah); `.band-form__errors` z něj dělá mřížku, takže zprávy jsou pod sebou.

- [ ] **Krok 3: `BandIdentitySection.tsx`**

`packages/desktop/src/app/components/band/BandIdentitySection.tsx`:

```tsx
import type { BandDraftError } from "../../../../../../src/domain/band/buildBandFromDraft";
import {
  type BandFormState,
  type BandFormUpdate,
  setBandCode,
  setBandName,
} from "../../domain/band/bandFormModel";
import { FieldErrors, hasFieldError } from "./FieldErrors";

export function BandIdentitySection({
  form,
  bandId,
  errors,
  onChange,
}: {
  form: BandFormState;
  bandId: string | null;
  errors: readonly BandDraftError[];
  onChange: BandFormUpdate;
}) {
  return (
    <section className="lineup-card" aria-labelledby="band-identity-heading">
      <h3 id="band-identity-heading">Identity</h3>
      <div className="form-grid">
        <label>
          Name *
          <input
            type="text"
            value={form.name}
            aria-invalid={hasFieldError(errors, "name")}
            onChange={(event) => {
              const value = event.target.value;
              onChange((state) => setBandName(state, value));
            }}
          />
          <FieldErrors errors={errors} field="name" />
        </label>
        <label>
          Code *
          <input
            type="text"
            value={form.code}
            aria-invalid={hasFieldError(errors, "code")}
            onChange={(event) => {
              const value = event.target.value;
              onChange((state) => setBandCode(state, value));
            }}
          />
          {form.codeTouched ? null : <span className="subtle">Derived from name</span>}
          <FieldErrors errors={errors} field="code" />
        </label>
        {bandId ? <p className="subtle">ID: {bandId}</p> : null}
      </div>
    </section>
  );
}
```

- [ ] **Krok 4: `BandLineupSection.tsx`**

`packages/desktop/src/app/components/band/BandLineupSection.tsx`:

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
import { LineupRow } from "../roles/LineupRow";
import { FieldErrors } from "./FieldErrors";

const NO_PENDING: Record<LineupRole, string[]> = {
  drums: [],
  bass: [],
  guitar: [],
  keys: [],
  vocs: [],
};

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
  const [pending, setPending] = useState<Record<LineupRole, string[]>>(NO_PENDING);
  const byId = new Map(musicians.map((musician) => [musician.id, musician]));
  const labelOf = (musicianId: string) => {
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
            <LineupRow
              key={role}
              roleLabel={getRoleDisplayName(role)}
              names={form.lineup[role].map((musicianId) => ({
                key: musicianId,
                label: labelOf(musicianId),
              }))}
              emptyLabel="No musicians"
              actions={
                <>
                  {form.lineup[role].map((musicianId) => (
                    <button
                      key={musicianId}
                      type="button"
                      className="button-ghost"
                      onClick={() => onChange((state) => removeMember(state, musicianId))}
                    >
                      Remove {labelOf(musicianId)}
                    </button>
                  ))}
                  <AddMusiciansMultiSelect
                    id={`band-add-${role}`}
                    options={availableMusiciansForGroup(musicians, role, form).map((musician) => ({
                      id: musician.id,
                      name: musicianLabel(musician),
                    }))}
                    selectedIds={pending[role]}
                    placeholder={`Add ${getRoleDisplayName(role).toLowerCase()}`}
                    onSelectionChange={(ids) =>
                      setPending((current) => ({ ...current, [role]: ids }))
                    }
                    onAddSelected={(ids) =>
                      onChange((state) => addMembersToGroup(state, role, ids))
                    }
                  />
                </>
              }
            />
          ))}
        </div>
      )}
      <FieldErrors errors={errors} field="lineup" />
    </section>
  );
}
```

Muzikant ze sestavy, který v katalogu chybí (Ruling 6), se ukáže pod svým id a jde odebrat.

- [ ] **Krok 5: `BandRolesSection.tsx`**

`packages/desktop/src/app/components/band/BandRolesSection.tsx`:

```tsx
import type { BandDraftError } from "../../../../../../src/domain/band/buildBandFromDraft";
import type { Musician } from "../../../../../../src/domain/model/types";
import {
  type BandFormState,
  type BandFormUpdate,
  lineupMemberIds,
  musicianLabel,
  setBandLeader,
  toggleLeadVocal,
} from "../../domain/band/bandFormModel";
import { FieldErrors, hasFieldError } from "./FieldErrors";

/** R7 + R8: kapelník a lead vokály jen ze sestavy; back vokály dopočítá doména. */
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
        <p className="subtle">Add musicians to the lineup to choose the band leader and lead vocals.</p>
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
          <fieldset className="band-form__checks">
            <legend>Lead vocals</legend>
            {members.map((musicianId) => (
              <label key={musicianId}>
                <input
                  type="checkbox"
                  checked={form.leadVocalIds.includes(musicianId)}
                  onChange={() => onChange((state) => toggleLeadVocal(state, musicianId))}
                />
                {labelOf(musicianId)}
              </label>
            ))}
            <FieldErrors errors={errors} field="leadVocals" />
          </fieldset>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Krok 6: `BandContactSection.tsx`**

`packages/desktop/src/app/components/band/BandContactSection.tsx`:

```tsx
import type { BandDraftError } from "../../../../../../src/domain/band/buildBandFromDraft";
import type { Musician } from "../../../../../../src/domain/model/types";
import {
  type BandFormState,
  type BandFormUpdate,
  defaultContactMemberId,
  disableContact,
  lineupMemberIds,
  musicianLabel,
  setContactField,
} from "../../domain/band/bandFormModel";
import { FieldErrors, hasFieldError } from "./FieldErrors";

/**
 * R2 + R12 blok 4: kontakt je člen sestavy plus telefon a e-mail. Výběr
 * člena jde přes `onSelectMember`, protože stránka musí načíst existující
 * `contacts/<id>.json` a předvyplnit z něj pole.
 */
export function BandContactSection({
  form,
  musicians,
  errors,
  onChange,
  onSelectMember,
}: {
  form: BandFormState;
  musicians: readonly Musician[];
  errors: readonly BandDraftError[];
  onChange: BandFormUpdate;
  onSelectMember: (musicianId: string) => void;
}) {
  const members = lineupMemberIds(form);
  const byId = new Map(musicians.map((musician) => [musician.id, musician]));
  const labelOf = (musicianId: string) => {
    const musician = byId.get(musicianId);
    return musician ? musicianLabel(musician) : musicianId;
  };
  const contact = form.contact;

  return (
    <section className="lineup-card" aria-labelledby="band-contact-heading">
      <h3 id="band-contact-heading">Contact</h3>
      <fieldset className="band-form__checks">
        <legend>Contact person</legend>
        <label>
          <input
            type="radio"
            name="band-contact-mode"
            checked={contact.mode === "none"}
            onChange={() => onChange(disableContact)}
          />
          No contact
        </label>
        <label>
          <input
            type="radio"
            name="band-contact-mode"
            checked={contact.mode === "member"}
            disabled={members.length === 0}
            onChange={() => onSelectMember(defaultContactMemberId(form))}
          />
          Band member
        </label>
      </fieldset>
      {contact.mode === "member" ? (
        <div className="form-grid">
          <label>
            Member *
            <select
              value={contact.musicianId}
              aria-invalid={hasFieldError(errors, "contact")}
              onChange={(event) => onSelectMember(event.target.value)}
            >
              <option value="">Select member</option>
              {members.map((musicianId) => (
                <option key={musicianId} value={musicianId}>
                  {labelOf(musicianId)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Phone
            <input
              type="tel"
              value={contact.phone}
              onChange={(event) => {
                const value = event.target.value;
                onChange((state) => setContactField(state, "phone", value));
              }}
            />
          </label>
          <label>
            E-mail
            <input
              type="email"
              value={contact.email}
              onChange={(event) => {
                const value = event.target.value;
                onChange((state) => setContactField(state, "email", value));
              }}
            />
          </label>
        </div>
      ) : null}
      <FieldErrors errors={errors} field="contact" />
    </section>
  );
}
```

- [ ] **Krok 7: `LibraryBandFormPage.tsx`**

`packages/desktop/src/app/pages/LibraryBandFormPage.tsx`:

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildBandDraftContext } from "../../../../../src/domain/band/buildBandDraftContext";
import type {
  BandDraftContext,
  BandDraftError,
} from "../../../../../src/domain/band/buildBandFromDraft";
import { useToast } from "../../components/ui/toast/useToast";
import { BandContactSection } from "../components/band/BandContactSection";
import { BandIdentitySection } from "../components/band/BandIdentitySection";
import { BandLineupSection } from "../components/band/BandLineupSection";
import { BandRolesSection } from "../components/band/BandRolesSection";
import {
  type BandFormState,
  bandFormFromBand,
  createEmptyBandForm,
  serializeBandForm,
  setContactMember,
  toBandDraft,
} from "../domain/band/bandFormModel";
import {
  type BandFormData,
  type SaveBandDraftResult,
  describeApiError,
  loadBandFormData,
  readContact,
  saveBandDraft,
} from "../services/bandsApi";
import { NEW_BAND_ROUTE_SEGMENT } from "../shell/routes";
import type { LibraryPageProps } from "./shared/pageTypes";

export type LibraryBandFormPageProps = LibraryPageProps & {
  /** `null` = zakládá se nová kapela (`/library/bands/new`). */
  readonly bandId: string | null;
  /** Ruling 10: obnoví kapely v shellu, aby novou kapelu nabídlo založení projektu. */
  readonly onBandSaved: () => Promise<void>;
};

type LoadState =
  | { readonly kind: "loading" }
  | { readonly kind: "error"; readonly message: string }
  | { readonly kind: "notFound" }
  | { readonly kind: "ready"; readonly data: BandFormData };

type Notify = (kind: "success" | "error", message: string) => void;

/** `/library/bands/new` a `/library/bands/:id` (R12): jeden formulář pro založení i úpravu. */
export function LibraryBandFormPage({
  bandId,
  navigate,
  registerNavigationGuard,
  onBandSaved,
}: LibraryBandFormPageProps) {
  const { notify } = useToast();
  const [form, setForm] = useState<BandFormState>(createEmptyBandForm);
  const formRef = useRef(form);
  formRef.current = form;
  const baselineRef = useRef<string | null>(null);

  const load = useBandFormData(bandId, notify, (data) => {
    const initial = data.band ? bandFormFromBand(data.band, data.contact) : createEmptyBandForm();
    baselineRef.current = serializeBandForm(initial);
    setForm(initial);
  });
  const context = useDraftContext(load);
  const { persist, errors, isSaving } = useBandPersistence({
    bandId,
    context,
    formRef,
    baselineRef,
    notify,
    onBandSaved,
  });

  useEffect(() => {
    registerNavigationGuard({
      isDirty: () =>
        baselineRef.current !== null && serializeBandForm(formRef.current) !== baselineRef.current,
      save: async () => {
        const result = await persist();
        if (!result?.ok) throw new Error("The band was not saved.");
      },
    });
    return () => registerNavigationGuard(null);
  }, [persist, registerNavigationGuard]);

  const selectContactMember = useCallback(
    (musicianId: string) => {
      if (!musicianId) {
        setForm((state) => setContactMember(state, "", null));
        return;
      }
      readContact(musicianId)
        .then((existing) => setForm((state) => setContactMember(state, musicianId, existing)))
        .catch((error: unknown) =>
          notify("error", `The contact could not be loaded: ${describeApiError(error).message}`),
        );
    },
    [notify],
  );

  if (load.kind !== "ready") {
    return <BandFormStatus load={load} bandId={bandId} navigate={navigate} />;
  }

  const handleSave = () => {
    void persist().then((result) => {
      if (result?.ok && !bandId) navigate(`/library/bands/${encodeURIComponent(result.bandId)}`);
    });
  };
  const { musicians } = load.data;

  return (
    <section className="panel band-form">
      <div className="panel__header">
        <h2>{bandId ? `Edit band: ${form.name || bandId}` : "New band"}</h2>
      </div>
      <BandIdentitySection form={form} bandId={bandId} errors={errors} onChange={setForm} />
      <BandLineupSection form={form} musicians={musicians} errors={errors} onChange={setForm} />
      <BandRolesSection form={form} musicians={musicians} errors={errors} onChange={setForm} />
      <BandContactSection
        form={form}
        musicians={musicians}
        errors={errors}
        onChange={setForm}
        onSelectMember={selectContactMember}
      />
      <div className="setup-action-bar setup-action-bar--equal">
        <button type="button" className="button-secondary" onClick={() => navigate("/library")}>
          Back to bands
        </button>
        <button type="button" className="button-primary" disabled={isSaving} onClick={handleSave}>
          {isSaving ? "Saving…" : "Save band"}
        </button>
      </div>
    </section>
  );
}

/** R13: rozbitý soubor přeruší načtení a toast nese cestu (zprávu z Rustu). */
function useBandFormData(
  bandId: string | null,
  notify: Notify,
  onLoaded: (data: BandFormData) => void,
): LoadState {
  const [load, setLoad] = useState<LoadState>({ kind: "loading" });
  const onLoadedRef = useRef(onLoaded);
  onLoadedRef.current = onLoaded;

  useEffect(() => {
    let active = true;
    loadBandFormData(bandId)
      .then((data) => {
        if (!active) return;
        if (bandId && !data.band) {
          setLoad({ kind: "notFound" });
          return;
        }
        onLoadedRef.current(data);
        setLoad({ kind: "ready", data });
      })
      .catch((error: unknown) => {
        if (!active) return;
        const { message } = describeApiError(error);
        setLoad({ kind: "error", message });
        notify("error", `The band could not be loaded: ${message}`);
      });
    return () => {
      active = false;
    };
  }, [bandId, notify]);

  return load;
}

function useDraftContext(load: LoadState): BandDraftContext | null {
  const data = load.kind === "ready" ? load.data : null;
  return useMemo(
    () =>
      data
        ? buildBandDraftContext({
            musicians: data.musicians,
            presets: data.presets,
            bands: data.bands,
            reservedIds: [NEW_BAND_ROUTE_SEGMENT],
            ...(data.band ? { existingBand: data.band } : {}),
          })
        : null,
    [data],
  );
}

function useBandPersistence(args: {
  readonly bandId: string | null;
  readonly context: BandDraftContext | null;
  readonly formRef: { readonly current: BandFormState };
  readonly baselineRef: { current: string | null };
  readonly notify: Notify;
  readonly onBandSaved: () => Promise<void>;
}) {
  const { bandId, context, formRef, baselineRef, notify, onBandSaved } = args;
  const [errors, setErrors] = useState<readonly BandDraftError[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const persist = useCallback(async (): Promise<SaveBandDraftResult | null> => {
    if (!context) return null;
    const submitted = formRef.current;
    setIsSaving(true);
    try {
      const result = await saveBandDraft(toBandDraft(submitted, bandId), context);
      setErrors(result.ok || result.kind === "writeFailed" ? [] : result.errors);
      reportSaveResult(result, notify);
      if (result.ok) {
        baselineRef.current = serializeBandForm(submitted);
        await refreshAfterSave(onBandSaved, notify);
      }
      return result;
    } finally {
      setIsSaving(false);
    }
  }, [bandId, context, formRef, baselineRef, notify, onBandSaved]);

  return { persist, errors, isSaving };
}

/** R13: `contactWritten` = kontakt na disku zůstal, i když kapela ne; uživatel to musí vědět. */
function reportSaveResult(result: SaveBandDraftResult, notify: Notify): void {
  if (result.ok) {
    notify("success", "Band saved.");
    return;
  }
  if (result.kind === "invalid") return;
  if (result.kind === "bandExists") {
    if (result.contactWritten) {
      notify("error", "The contact was saved, but the band was not: a band with this name already exists.");
    }
    return;
  }
  notify(
    "error",
    result.contactWritten
      ? `The contact was saved, but the band was not: ${result.message}`
      : `The band could not be saved: ${result.message}`,
  );
}

async function refreshAfterSave(onBandSaved: () => Promise<void>, notify: Notify): Promise<void> {
  try {
    await onBandSaved();
  } catch (error) {
    notify(
      "error",
      `The band was saved, but the band list could not be refreshed: ${describeApiError(error).message}`,
    );
  }
}

function BandFormStatus({
  load,
  bandId,
  navigate,
}: {
  load: Exclude<LoadState, { kind: "ready" }>;
  bandId: string | null;
  navigate: (path: string) => void;
}) {
  const message =
    load.kind === "loading"
      ? null
      : load.kind === "notFound"
        ? `Band '${bandId ?? ""}' was not found in your library.`
        : load.message;
  return (
    <section className="panel">
      {message === null ? (
        <p className="status">Loading band…</p>
      ) : (
        <p className="status status--error" role="alert">
          {message}
        </p>
      )}
      <div className="setup-action-bar">
        <button type="button" className="button-secondary" onClick={() => navigate("/library")}>
          Back to bands
        </button>
      </div>
    </section>
  );
}
```

Pozn. k typům: `notify` z `useToast()` má typ `(kind: ToastKind, message: string) => void`, kde `ToastKind = "success" | "error" | "info"` — je přiřaditelný do užšího `Notify`. `setForm` (`Dispatch<SetStateAction<BandFormState>>`) je přiřaditelný do `BandFormUpdate`. Kdyby Biome hlásil `noNestedTernary` v `BandFormStatus`, přepiš na `if`/`return` — chování stejné.

- [ ] **Krok 8: Typová kontrola, build, testy, zákaz `invoke`**

```bash
npx tsc -p packages/desktop/tsconfig.json --noEmit 2>&1 | grep -c "error TS"
npx tsc -p packages/desktop/tsconfig.json --noEmit 2>&1 | grep -E "components/band|LibraryBandFormPage|routes.ts"
(cd packages/desktop && npx vite build 2>&1 | tail -2)
npm test 2>&1 | tail -6
grep -rn "invoke" packages/desktop/src/app/pages/LibraryBandFormPage.tsx packages/desktop/src/app/components/band/
```

Expected: desktop tsc `14`; druhý grep prázdný; build `✓ built`; `Tests  2 failed | 1345 passed (1347)`; grep `invoke` prázdný.

- [ ] **Krok 9: Lint**

Nové soubory (6 `.tsx`): `npx biome check --write <soubory>`, pak bez `--write` → 0 chyb. Případný a11y nález (např. `useSemanticElements`, `noLabelWithoutControl`) oprav ve **svém** novém souboru, ne v cizím. `routes.ts`: recept HEAD vs BASE → delta 0. `library.css`: Biome CSS kontroluje (ověřeno: `Checked 1 file … No fixes applied` na LF kopii BASE) → recept HEAD vs BASE, delta 0.

- [ ] **Krok 10: Commit**

```bash
git add packages/desktop/src/app/components/band/ packages/desktop/src/app/pages/LibraryBandFormPage.tsx packages/desktop/src/app/shell/routes.ts packages/desktop/src/styles/features/library.css
git commit -m "feat(library): add the band form page for creating and editing a band"
```

---
## KROK E — přepnutí a úklid

### Task 12: Přepnutí routeru a smazání TS lešení Library — **jeden commit**

**Files:**
- Modify: `packages/desktop/src/app/shell/routes.ts:47-62` (smazat čtyři routy)
- Modify: `packages/desktop/src/app/shell/ShellRouter.tsx` (importy `:1-28`, props `:32-47`, destrukturace `:49-58`, routy `:170-194`)
- Modify: `packages/desktop/src/app/shell/AppShell.tsx:23-24`, `:40-49`
- Modify: `packages/desktop/src/app/pages/hub/useProjectsHubData.ts:135-147` (vrátit `refreshBands`)
- Modify: `packages/desktop/src/app/pages/index.ts:10`
- Modify: `packages/desktop/src/app/shell/types.ts:33-64` (smazat typy `Library*`)
- Modify: `packages/desktop/src/styles/features/lineup.css:5-8` a komentář `:36-42`
- Modify: `packages/desktop/src/styles/features/hub.css:70`, `:86-87`, `:92-96`
- Delete: `packages/desktop/src/pages/ShellPages.tsx` (jediný obsah: `LibraryHomePage`)
- Delete: `packages/desktop/src/app/pages/components/library/LibraryPages.tsx`, `LibraryEntityCrud.tsx`, `LibrarySimpleEntityPage.tsx`

**Interfaces:**
- Consumes: `LibraryBandsPage` (Task 10), `LibraryBandFormPage`, `NEW_BAND_ROUTE_SEGMENT` (Task 11).
- Produces: `useProjectsHubData(...)` navíc vrací `refreshBands: () => Promise<void>`; `ShellRouter` má nový povinný prop `refreshBands: () => Promise<void>`.

**Kontext, který nesmíš přehlédnout**

- **Proč jeden commit:** `ShellRouter.tsx` importuje `LibraryHomePage` z `ShellPages.tsx` a šest `Library*Page` přes `pages/index.ts` → `components/library/LibraryPages.tsx`, který importuje typy `LibraryBand`/`LibraryMusician` z `shell/types.ts`. Smazat kterýkoli článek bez ostatních = visící import a rozbitý tsc. Nový `LibraryBandsPage` nelze exportovat z `index.ts`, dokud tam je starý (stejné jméno).
- **R15 seznam ověřen grepem** k `6b67c25`: typy `LibraryBand`, `LibraryBandMember`, `LibraryContact`, `LibraryMessage`, `LibraryMusician` mají uživatele jen v `components/library/` (TS typ `LibraryInstrument` neexistuje, je jen v Rustu). `SHELL_ROUTES` (`routes.ts:6`) nemá žádného konzumenta mimo vlastní definici, takže smazání čtyř položek nic nerozbije. `LibraryPageProps` (`pageTypes.ts:20-23`) **zůstává** — používají ho nové stránky.
- **Ruling 11:** `/library` i `/library/bands` vykreslí `LibraryBandsPage`; routy `library`, `library-bands`, `library-band-detail` zůstávají.
- **Ruling 10:** `refreshBands` už v `useProjectsHubData.ts:32-34` existuje, jen se nevrací.
- **Ruling 15 (CSS):** maže se jen `.lineup-grid` a selektory `.project-actions`; `.library-table`, `.library-row`, `.lineup-card`, `.form-grid` mají dál uživatele.
- `bandId` z URL se nepředává přes `decodeURIComponent`: id jsou slugy `[a-z0-9_]` (Task 1), takže `encodeURIComponent` je na nich identita, a dekódování by na poškozené URL vyhodilo `URIError`.
- Rust příkazy `*_library_*` po tomto tasku žádné UI nevolá; mažou se v Tasku 13.

- [ ] **Krok 1: Ověř, že lešení nemá jiné konzumenty**

```bash
cd /c/Users/mkrecmer/dev/stagepilot
grep -rnE "LibraryHomePage|ShellPages|components/library|LibraryBand\b|LibraryBandMember|LibraryContact\b|LibraryMessage\b|LibraryMusician\b|LibraryBandDetailPage|LibraryMusiciansPage|LibraryInstrumentsPage|LibraryContactsPage|LibraryMessagesPage" packages/desktop/src --include=*.ts --include=*.tsx | grep -v "app/pages/components/library/"
```

Expected — přesně tyto řádky a žádné jiné:
- `app/shell/ShellRouter.tsx:1` (`LibraryHomePage` z `../../pages/ShellPages`) a `:4-9` (šest `Library*Page`), `:170-193` (použití)
- `app/pages/index.ts:10` (`./components/library/LibraryPages`)
- `app/shell/types.ts:33-64` (definice typů)
- `pages/ShellPages.tsx:5` (definice `LibraryHomePage`)

Cokoli navíc → zastav se a eskaluj (spec R15: „Plán si konečný výčet ověří grepem proti repu").

- [ ] **Krok 2: Routy**

V `packages/desktop/src/app/shell/routes.ts` smaž čtyři položky pole `SHELL_ROUTES` (řádky 47-62):

```ts
  {
    key: "library-musicians",
    test: (pathname) => pathname === "/library/musicians",
  },
  {
    key: "library-instruments",
    test: (pathname) => pathname === "/library/instruments",
  },
  {
    key: "library-contacts",
    test: (pathname) => pathname === "/library/contacts",
  },
  {
    key: "library-messages",
    test: (pathname) => pathname === "/library/messages",
  },
```

Za `library-band-detail` tak přímo následuje `{ key: "settings", … }`.

- [ ] **Krok 3: `ShellRouter.tsx`**

Importy (řádky 1-28) nahraď:

```tsx
import {
  ChooseProjectTypePage,
  LibraryBandFormPage,
  LibraryBandsPage,
  NewEventProjectPage,
  NewGenericProjectPage,
  ProjectInputsPage,
  ProjectPreviewPage,
  ProjectSetupPage,
  SettingsPage,
  StagePlanEditorPage,
  StartPage,
} from "../pages/ShellRoutedPages";
import type { BandOption, NavigationGuard, ProjectSummary } from "./types";
import {
  NEW_BAND_ROUTE_SEGMENT,
  matchLibraryBandDetailPath,
  matchProjectEventPath,
  matchProjectGenericPath,
  matchProjectInputsPath,
  matchProjectPreviewPath,
  matchProjectSetupPath,
  matchProjectStageplanPath,
} from "./routes";
```

Do typu `ShellRouterProps` za `refreshProjects: () => Promise<void>;` přidej:

```tsx
  refreshBands: () => Promise<void>;
```

Do destrukturace parametrů `ShellRouter({ … })` za `refreshProjects,` přidej `refreshBands,`.

Blok rout Library (řádky 170-194, od `if (pathname === "/library") return <LibraryHomePage …` po konec větve `/library/messages`) nahraď:

```tsx
  if (pathname === "/library" || pathname === "/library/bands") {
    return <LibraryBandsPage navigate={navigate} registerNavigationGuard={registerNavigationGuard} />;
  }
  if (libraryBandDetailId) {
    const bandId = libraryBandDetailId === NEW_BAND_ROUTE_SEGMENT ? null : libraryBandDetailId;
    return (
      <LibraryBandFormPage
        key={libraryBandDetailId}
        bandId={bandId}
        navigate={navigate}
        registerNavigationGuard={registerNavigationGuard}
        onBandSaved={refreshBands}
      />
    );
  }
```

Řádek `if (pathname === "/settings") return <SettingsPage />;` a `return null;` zůstávají.

- [ ] **Krok 4: `refreshBands` do shellu**

`packages/desktop/src/app/pages/hub/useProjectsHubData.ts` — v návratovém objektu (řádky 135-147) za `refreshProjects,` přidej `refreshBands,`.

`packages/desktop/src/app/shell/AppShell.tsx` — řádky 23-24:

```tsx
  const { projects, bands, status, refreshProjects, actions } =
    useProjectsHubData(navigateImmediate);
```

nahraď:

```tsx
  const { projects, bands, status, refreshProjects, refreshBands, actions } =
    useProjectsHubData(navigateImmediate);
```

a do `<ShellRouter … />` za `refreshProjects={refreshProjects}` přidej `refreshBands={refreshBands}`.

- [ ] **Krok 5: Exporty stránek**

`packages/desktop/src/app/pages/index.ts` — řádek 10:

```ts
export * from "./components/library/LibraryPages";
```

nahraď:

```ts
export * from "./LibraryBandsPage";
export * from "./LibraryBandFormPage";
```

- [ ] **Krok 6: Smaž lešení a typy**

```bash
git rm packages/desktop/src/pages/ShellPages.tsx
git rm packages/desktop/src/app/pages/components/library/LibraryPages.tsx packages/desktop/src/app/pages/components/library/LibraryEntityCrud.tsx packages/desktop/src/app/pages/components/library/LibrarySimpleEntityPage.tsx
```

V `packages/desktop/src/app/shell/types.ts` smaž řádky 33-64 — od `export type LibraryBandMember = {` po uzavírací `};` typu `LibraryMusician` (řádek 64, těsně před `export type BandSetupData = {`). Import `LineupMap` (řádek 1) **zůstává**, používá ho dál `BandSetupData.defaultLineup` (`:72`) a `NewProjectPayload.lineup` (`:105`).

- [ ] **Krok 7: Osiřelé CSS**

Před mazáním ověř, že třídy nemají uživatele (přesný token):

```bash
for c in lineup-grid project-actions; do echo "== $c"; grep -rnE --include=*.tsx --include=*.ts "[\"' \`]$c[\"' \`]" packages/desktop/src; done
```

Expected: oba výpisy prázdné. Pokud ne, třídu nemaž a zapiš to do reportu.

`packages/desktop/src/styles/features/lineup.css` — smaž pravidlo `.lineup-grid { display: grid; gap: var(--sp-7); }` (řádky 5-8) i prázdný řádek za ním. Komentář nad `.lineup-card` (řádky 36-42) přepiš na:

```css
/* --------------------------------------------------------------------------
   Bordered block

   Positions no longer use this — they are rows now. It stays as a generic
   bordered block for the four blocks of the band form, and the assignment
   editor uses __add.
   -------------------------------------------------------------------------- */
```

`packages/desktop/src/styles/features/hub.css`:
- řádky 70-71 `.project-actions,\n.view-toggle {` → `.view-toggle {`
- řádky 86-87 `.view-toggle__icon,\n.project-actions .button-secondary {` → `.view-toggle__icon {`
- smaž celé pravidlo `.project-actions .button-secondary { display: inline-flex; align-items: center; gap: var(--sp-2); }` (řádky 92-96) a prázdný řádek za ním.

- [ ] **Krok 8: Grep brána a ověření**

```bash
grep -rnE "LibraryHomePage|ShellPages|components/library|LibraryBand\b|LibraryBandMember|LibraryContact\b|LibraryMessage\b|LibraryMusician\b|LibraryBandDetailPage|LibraryMusiciansPage|LibraryInstrumentsPage|LibraryContactsPage|LibraryMessagesPage|_library_|library-musicians|library-instruments|library-contacts|library-messages|lineup-grid|project-actions" packages/desktop/src
ls packages/desktop/src/pages 2>&1
npx tsc -p packages/desktop/tsconfig.json --noEmit 2>&1 | grep -c "error TS"
npx tsc --noEmit 2>&1 | grep -c "error TS"
(cd packages/desktop && npx vite build 2>&1 | tail -2)
npm test 2>&1 | tail -6
```

Expected:
- grep **prázdný** (`LibraryPageProps` regex nechytí — `LibraryBand\b` ani jiný vzor na něj nesedí);
- `ls`: `No such file or directory` (adresář `src/pages` zmizel s jediným souborem; pokud v něm git nechal prázdný adresář, smaž ho);
- desktop tsc `14`, root tsc `0`;
- build `✓ built`;
- `Tests  2 failed | 1345 passed (1347)` — testy chrome (`navItems.test.ts`, `processSteps.test.ts`, `windowChrome.test.ts`, `shellChrome.test.tsx`) s cestami `/library` a `/library/bands` musí zůstat zelené.

- [ ] **Krok 9: Lint**

Recept HEAD vs BASE pro upravené soubory: `routes.ts`, `ShellRouter.tsx`, `AppShell.tsx`, `useProjectsHubData.ts`, `pages/index.ts`, `shell/types.ts`, `lineup.css`, `hub.css` → delta 0.

- [ ] **Krok 10: Commit**

```bash
git add -A packages/desktop/src
git status --short
```

Před commitem zkontroluj, že `git status --short` ukazuje **jen** soubory z tohoto tasku (8 upravených, 4 smazané). Pak:

```bash
git commit -m "feat(library): route Library to the band editor and remove the old Library scaffolding"
```

---

### Task 13: Rust — smazání 17 příkazů `*_library_*` a jejich struktur

**Files:**
- Modify: `packages/desktop/src-tauri/src/lib.rs`

**Interfaces:**
- Consumes: nic. Předpoklad: po Tasku 12 žádný TS soubor nevolá `*_library_*` (grep v Tasku 12, krok 8).
- Produces: nic nového. **Zůstává:** `update_musician_defaults` (registrovaný příkaz), `load_library_map`, `save_library_map`, `entity_name`, `catalog_dir`, `catalog_entity_dir`, `list_projects`.

**Kontext**

Spec R15: v `lib.rs` všech sedmnáct příkazů `*_library_*`, struktury `Library*` a pomocné `load_library_list`, `save_library_list`, `entity_name`, „pokud po smazání nemají jiného uživatele". Ověřeno na `6b67c25`:
- `entity_name` (`:485`) **má jiného uživatele** — `load_library_map` (`:568`) a `save_library_map` (`:604`), které drží `update_musician_defaults` → **zůstává**.
- `list_json_files_recursive` (`:287`) po Tasku 6 používá už jen `load_library_list` → **maže se** (jinak `dead_code` warning).
- `delete_library_band` volá `list_projects` (`:1806`) — ten je samostatný registrovaný příkaz a zůstává.
- 17 příkazů v `generate_handler!` (`:2099-2116`, mezi nimi `update_musician_defaults` na `:2106`, který zůstává). Poslední položka seznamu je dnes `delete_library_message` **bez čárky**; po smazání bude poslední `update_musician_defaults,` — skript čárku odstraní, aby se tvar seznamu nezměnil.
- Struktury: `LibraryBand`, `LibraryBandMember`, `LibraryMusician`, `LibraryInstrument`, `LibraryContact`, `LibraryMessage` (`:49-104`), každá s `#[derive(...)]` nad sebou.

Čísla řádků se po Tasku 6 posunula; skript proto hledá podle obsahu.

- [ ] **Krok 1: Ověř výchozí stav**

```bash
cd /c/Users/mkrecmer/dev/stagepilot
grep -c "_library_" packages/desktop/src-tauri/src/lib.rs
grep -n "^fn list_json_files_recursive\|list_json_files_recursive(" packages/desktop/src-tauri/src/lib.rs
grep -rn "_library_" packages/desktop/src --include=*.ts --include=*.tsx
```

Expected: první číslo > 17 (definice + registrace + volání `load/save_library_*`); `list_json_files_recursive` jen definice, rekurzivní volání v ní a jedno volání v `load_library_list`; TS grep prázdný.

- [ ] **Krok 2: Smaž skriptem**

Ulož do `$SCRATCH/remove_library_rust.py`:

```python
import io

PATH = "packages/desktop/src-tauri/src/lib.rs"
with io.open(PATH, encoding="utf-8", newline="") as handle:
    text = handle.read()
eol = "\r\n" if "\r\n" in text else "\n"
lines = text.split(eol)

COMMANDS = [
    "list_library_bands", "read_library_band", "upsert_library_band", "delete_library_band",
    "duplicate_library_band", "list_library_musicians", "upsert_library_musician",
    "delete_library_musician", "list_library_instruments", "upsert_library_instrument",
    "delete_library_instrument", "list_library_contacts", "upsert_library_contact",
    "delete_library_contact", "list_library_messages", "upsert_library_message",
    "delete_library_message",
]
HELPERS = ["list_json_files_recursive", "load_library_list", "save_library_list"]


def delete_fn(name):
    matches = [i for i, line in enumerate(lines) if line.startswith(f"fn {name}(") or line.startswith(f"fn {name}<")]
    assert len(matches) == 1, (name, matches)
    index = matches[0]
    start = index - 1 if lines[index - 1] == "#[tauri::command]" else index
    assert lines[start - 1] in ("", "}"), (name, lines[start - 1])
    end = next(i for i in range(index, len(lines)) if lines[i] == "}")
    if lines[end + 1] == "":
        end += 1
    del lines[start : end + 1]


for name in COMMANDS + HELPERS:
    delete_fn(name)

first = lines.index("struct LibraryBand {") - 1
last = lines.index("struct BandSetupData {")
while not lines[last].startswith("#[derive"):
    last -= 1
assert lines[first].startswith("#[derive"), lines[first]
removed = lines[first:last]
assert all("Library" in line or not line.startswith("struct ") for line in removed)
del lines[first:last]

handler_entries = {f"            {name}," for name in COMMANDS} | {"            delete_library_message"}
before = len(lines)
lines = [line for line in lines if line not in handler_entries]
assert before - len(lines) == 17, before - len(lines)
close = lines.index("        ])")
if lines[close - 1].endswith(","):
    lines[close - 1] = lines[close - 1][:-1]

with io.open(PATH, "w", encoding="utf-8", newline="") as handle:
    handle.write(eol.join(lines))
print("removed", len(COMMANDS), "commands,", len(HELPERS), "helpers and the Library structs")
```

Run (z kořene repa): `python "$SCRATCH/remove_library_rust.py"`
Expected: `removed 17 commands, 3 helpers and the Library structs`. `AssertionError` → soubor se nezapsal (zápis je až na konci); zastav se a eskaluj.

- [ ] **Krok 3: Ověř, co zůstalo**

```bash
grep -n "Library\|_library_\|list_json_files_recursive" packages/desktop/src-tauri/src/lib.rs
sed -n '/generate_handler!\[/,/\])/p' packages/desktop/src-tauri/src/lib.rs
```

Expected: první grep vrátí jen `fn load_library_map`, `fn save_library_map` a jejich volání v `get_band_setup_data` a `update_musician_defaults` (žádné `struct Library*`, žádné `*_library_*` příkazy, žádné `list_json_files_recursive`). Seznam handlerů: `get_user_data_dir … get_band_setup_data, list_catalog_musicians, list_presets, read_band, read_contact, write_band, write_contact, read_project, … reveal_in_explorer, update_musician_defaults` — bez koncové čárky.

- [ ] **Krok 4: Cargo testy a warningy**

```bash
cd /c/Users/mkrecmer/dev/stagepilot/packages/desktop/src-tauri
cargo test 2>&1 | grep -E "^test result|^warning|^error"
cargo test 2>&1 | grep -c "^warning"
```

Expected: `test result: ok. 28 passed; 0 failed`; warningů `0`. Warning `function … is never used` = helper, který skript měl smazat a nesmazal, nebo naopak smazal něco živého — oprav podle hlášky a zapiš do reportu.

- [ ] **Krok 5: TS strana beze změny**

```bash
cd /c/Users/mkrecmer/dev/stagepilot
npm test 2>&1 | tail -6
```

Expected: `Tests  2 failed | 1345 passed (1347)`.

- [ ] **Krok 6: Commit**

```bash
git add packages/desktop/src-tauri/src/lib.rs
git commit -m "chore(tauri): remove the dead Library commands and their serde types"
```

---

## Ruční ověření (dělá člověk)

Repo nemá jsdom; stránky se ověřují ručně v `npm run dev` (spec, sekce „Ruční průchod"). Předpoklad: Tasky 1-13 hotové, `cargo test` 28/0, `npm test` 1345 zelených + 2 baseline selhání.

Před průchodem: **záloha katalogu mimo scratchpad**, protože průchod zapisuje do `%APPDATA%/StagePilot/catalog/` (scratchpad není záloha):

```bash
cp -r "$APPDATA/StagePilot/catalog" "$HOME/stagepilot-catalog-backup-$(date +%Y%m%d)"
```

Spusť `npm run dev`. Pozor na známou past: port 1420 obsazený jiným procesem zablokuje `tauri dev` (`--strictPort`).

1. **`/library`** s kapelami → seznam 4 existujících kapel (Big Night Band, Blanická kapela, Couple of Sounds, Party Leaders) s počtem členů, bez štítku `Incomplete`. Prázdný stav (`No bands yet` + `New band`) se dá ověřit na čisté instalaci nebo dočasným přejmenováním složky `catalog/bands`; po ověření ji vrať.
   **Nečitelná kapela (Ruling 8):** vytvoř `catalog/bands/orphan.json` s obsahem `{ "id": "orphan_band", "name": "Orphan Band" }` (jméno souboru ≠ id, takže `read_band("orphan_band")` vrátí `null`). `/library` ukáže řádek „Orphan Band“ se zprávou `File catalog/bands/orphan_band.json was not found…`, štítkem `Unreadable` a **bez** tlačítka Edit; ostatní 4 kapely jdou dál upravit; jeden chybový toast. Pak soubor smaž. (Soubor s **neplatným JSON** v `catalog/bands/` dál shodí celý seznam přes `list_bands` — viz hranice v Rulingu 8; to je očekávané.)
2. **Nová kapela** (`New band`): psaní názvu „Test Band" dopočítá `TB`; po ruční změně zkratky na `TBX` další změna názvu zkratku nemění; nápověda „Derived from name" zmizí.
3. **Sestava:** v řádku `DRUMS` nabídne `Add drums` jen bubeníky; přidání a `Remove …` fungují; odebraný muzikant zmizí z výběru kapelníka i z lead vokálů. Přidání zpěvačky do `VOCS` ji rovnou zaškrtne jako lead vokál.
4. **Kontakt:** `Band member` vybere kapelníka; u muzikanta s existujícím `contacts/<id>.json` (Krečmer Matěj, Žídek Jakub) se předvyplní telefon a e-mail. Smazání obou polí a uložení → chyba u kontaktu „Enter a phone number or an e-mail address."
5. **Uložení nové kapely** → toast „Band saved.", URL `/library/bands/test_band`. Soubor `catalog/bands/test_band.json` má `type, id, code, name, bandLeader, bandLeaderId, defaultTalkbackOwnerId, defaultContactId?, defaultLineup` (pět skupin) a `defaultOverlays` s `leadVocals` i `backVocals`; odsazení 2 mezery.
6. **Založení projektu** (`/projects/new/event` nebo `generic`) nabídne „Test Band" **bez restartu aplikace** (Ruling 10) a `01 LINEUP` ji předvyplní sestavou, kapelníkem a vokály.
7. **Neuložené změny:** změna názvu a klik na `Projects` v navigaci → dialog neuložených změn; `Save and exit` s chybou validace (např. smazaný název) **zůstane** na formuláři.
8. **Kolize a rezervované jméno:** nová kapela „BK" → chyba u názvu (Ruling 2); „New" → chyba u názvu (Ruling 3); zkratka `bnb` → „Another band already uses this code."
9. **Úprava existující kapely** (Blanická kapela): přejmenování nezmění id ani zkratku `BK`; po uložení soubor nese i `bandLeader`. **Očekávaný rozdíl:** `backVocals` se přepočítají z `canSing` (R8) — u Blanické kapely z `[]` na zpívající členy mimo lead vokály; to je snímek podle specu, ne chyba.
10. **Smoke Node pipeline** (spec, Testy → Smoke): projekt z bodu 6 ulož a spusť `npm run cli:dev -- --project <id projektu>` → vypíše `DocumentViewModel` JSON bez výjimky (kapela z editoru prošla `catalogRepository` i `validateBandLeader`).

Po průchodu: smaž testovací kapelu `catalog/bands/test_band.json` a testovací projekt ručně (mazání kapel není v rozsahu, R14), případně obnov katalog ze zálohy.

---

## Ověření plánu nanečisto (provedeno při psaní, 2026-10-06)

Plán se nepsal jen proti typům. Kód z tasků byl aplikován na **kopii** stromu ve scratchpadu (repo zůstalo nedotčené) a prohnán kontrolami:

- **TypeScript (Tasky 1-5, 7-12 aplikované do kopie `src/` + `packages/desktop/src`, `node_modules` přes junction):** 8 nových testových souborů, **80/80 testů zelených napoprvé**; celá sada v kopii `2 failed | 1340 passed` — kopie neobsahovala `scripts/desktop_preview.test.ts` (1 soubor, 5 testů), v repu tedy **1345**. Root `tsc --noEmit` **0**; desktop tsc **přesně 14 baseline chyb** (posun `ProjectSetupPage.tsx` na řádek 469); `npx vite build` **projde**. Skript z Tasku 9 přesunul 196 řádků.
- **Biome na nových souborech:** jediný lint nález byl regex v `slug.ts` (`noMisleadingCharacterClass`) — v plánu opraveno na `/\p{M}/gu` a ověřeno, že projde Biome, oba tsc i testy. Formát se srovná `--write` (u `bandsApi.test.ts` dvakrát).
- **Rust (Task 6 aplikovaný skriptem na kopii crate):** `cargo test` **28 passed, 0 warnings**. Následně Task 13 na téže kopii: **28 passed, 0 warnings**, v `generate_handler!` zůstalo 26 příkazů, poslední `update_musician_defaults` bez čárky.

Změna Rulingu 8 (per-item chyby v `listBandSummaries` a chybový řádek v `LibraryBandsPage`) byla do Tasků 7 a 10 doplněna po rozhodnutí uživatele a ověřena v téže kopii: `bandsApi.test.ts` 11/11, desktop tsc 14 baseline chyb bez nové, Biome na třech dotčených souborech čistý (po dvou `--write`), `vite build` projde. Co nanečisto ověřit nešlo: chování stránek v běžící aplikaci (jsdom není) — to pokrývá sekce Ruční ověření.

## Self-review (provedeno při psaní plánu)

**Pokrytí specu:**

| Spec | Task |
|---|---|
| R1 kapela jen z existujících muzikantů, uložení bez sestavy | 4 (test „saves a band with only a name and a code"), 11 (`EmptyState` bez akce) |
| R2 kontakt = člen + telefon/e-mail, sdílený záznam | 3, 4, 7 (pořadí zápisu), 8 (předvyplnění), 11 |
| R3 doména v TS, Rust jen FS | 1-5, 6 |
| R4 id ze slugu, neměnné, kolize | 1, 4 |
| R5 zkratka | 2, 4, 8 |
| R6 pět skupin, jen ze své skupiny | 4, 8 (`availableMusiciansForGroup`), 11 |
| R7 kapelník povinný při neprázdné sestavě, `bandLeader` + `bandLeaderId` | 4, 5 (`summarizeBand`) |
| R8 lead ručně, back odvozené | 4, 5 (`canSing`), 8 |
| R9 `buildBandFromDraft` + unie | 4 |
| R10 šest příkazů | 6 |
| R11 `bandsApi.ts`, `saveBandDraft`, kontakt → kapela | 7 |
| R12 obrazovky | 10, 11, 12 |
| R13 chybové stavy | 4, 6, 7, 11 |
| R14 bez mazání, bez `notesTemplateRef`/`logoFile` ve formuláři | 4 (zachování, Ruling 4) |
| R15 smazání lešení | 12, 13 |
| Testy: doména, `saveBandDraft`, Rust `write_band`, smoke CLI | 1-5, 7, 6, ruční bod 10 |

**Typová konzistence:** jména `BandDraft`, `BandDraftContext`, `BandDraftError`, `BandDraftField`, `BuildBandResult`, `buildBandDraftContext`, `summarizeBand`, `SaveBandDraftResult` (`invalid | bandExists | writeFailed`), `BandFormState`, `BandFormUpdate`, `NEW_BAND_ROUTE_SEGMENT` jsou v Tasku, který je produkuje, i ve všech konzumentech stejná.

**Počty testů (kumulativně):** baseline 1265 → T1 +10 → T2 +9 → T4 +29 → T5 +8 → T7 +11 → T8 +13 = **1345 zelených, 2 baseline selhání, 1347 celkem, 176 souborů**. Cargo: 16 → T6 +12 = **28**.
