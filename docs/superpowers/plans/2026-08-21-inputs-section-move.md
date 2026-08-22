# Přesun sekce Inputs na `02` — implementační plán (F5d)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Přesunout sekci Inputs ze setup modálu obrazovky `01` do modálu `Edit inputs` na obrazovce `02`, srovnat to, co doména u jednotlivých řezů skutečně čte, a smazat starý setup modál (Task 19 z F5c).

**Architecture:** Čtyři vynucené kroky A→B→C→D plus oddělitelná vlna 2. Krok A opraví oba podklady, na kterých modál stojí (fallback bez presetů a prefixové rozpoznávání kanálů ve dvou kopiích). Krok B odemkne monitoring bicích. Krok C postaví modál na `02` z existujících katalogů polí a jedním commitem smaže `+ Add input` i `GROUP_INPUT_LIBRARY`. Krok D smaže modál z `01`. Vlna 2 zpřístupní overlays z `02` a opraví osiřelý vokální monitor mix. Veškerá netriviální logika jde do čistých funkcí v `packages/desktop/src/app/domain/`, protože repozitář nemá jsdom a komponenty se interakcí testovat nedají.

**Tech Stack:** TypeScript (ESM, strict), React + Vite, Vitest (`environment: "node"`, žádné DOM), Biome, Tauri.

**Spec:** `docs/superpowers/specs/2026-08-21-inputs-section-move-design.md` — závazný, osm rozhodnutí R1–R8. Předchůdce: `docs/superpowers/specs/2026-08-17-inputs-screen-design.md`. Měření k R1: `.superpowers/sdd/2026-08-21-inputs-section-move/r1-preset-refs-verification.md`.

---

## Global Constraints

Platí pro **každý** task. Neopakují se v tělech tasků, ale jejich požadavky je implicitně obsahují.

### Vrstvy (z `CLAUDE.md`, nesmí se překročit)

- `src/domain/` — čistá logika, nula I/O, nula vedlejších efektů.
- `src/app/usecases/` — orchestrace domény a infrastruktury.
- `src/infra/` — všechno I/O (PDF, FS, storage).
- `packages/desktop/` — UI; Tauri příkazy jen přes `tauriCommands.ts`.
- `packages/desktop/src/app/domain/**` — čisté funkce desktopu, bez Reactu. Netriviální rozhodnutí patří sem, ne do komponenty (precedens: Task 15 a 19a z F5c).
- **Dva stromy komponent, nezaměňovat.** `packages/desktop/src/components/**` je starší strom (`ui/Modal`, `setup/DrumsPartsEditor`, `setup/SetupMonitoringEditor`); `packages/desktop/src/app/components/**` je novější (`inputs/`, `roles/`, `setup/SchemaRenderer`, `setup/SetupSection`, `setup/instruments/`). Nový soubor z kroku C jde do **novějšího**.

### Importy

- ESM. **Přípony v importech se řídí souborem, který upravuješ, ne globálním pravidlem.** `src/domain/setup/`, `src/domain/rules/` a `src/domain/pipeline/**` píší `.js` (`from "../model/groups.js"`); `src/domain/lineup/**` píše bez přípony (`from "../model/types"`). Nenormalizuj, co nesouvisí s tvou změnou.
- Hloubka z `packages/desktop` do domény: z `app/domain/inputs/`, z `app/components/inputs/` i z `app/pages/shared/` je to `../../../../../../src/domain/...` (6 nahoru).

### Testy

- Vitest, `environment: "node"` pro **všech** 153 testových souborů, jediný `vitest.config.ts` v rootu, žádný per-file override. **jsdom se nezavádí** (R8) — není nainstalovaný ani jako závislost projektu.
- Komponentové testy jedou přes `renderToStaticMarkup` / `renderToString` a aserci nad HTML stringem. Handler se tím nezavěsí ani nespustí — interakce se proto netestuje interakcí, ale čistou funkcí pod ní.
- **Kontraktní testy UI ↔ dokument (R8) nejsou dodatek na konci.** Task, který otevírá nebo zavírá bránu, přidává svůj kontraktní test do `packages/desktop/src/app/domain/inputs/uiDocumentContract.test.ts` v témže commitu.
- `src/domain/pipeline/buildDocument.pdfRegression.test.ts` **musí zůstat zelený s nedotčenými očekáváními.** Změřeno, že rozšíření domény na jeho fixtury nesahá (jediný `presetOverride` v nich je `monitoring` na basovém slotu, žádné `inputs.*`). **Task, který ta očekávání upravuje, je chyba v plánu — zastav se a eskaluj.**

### Baseline — měř deltu, nikdy úspěch podle absolutní nuly

| Kontrola | Baseline (změřeno 2026-08-21 na `feat/inputs-screen`) |
|---|---|
| `npm test` | **153 souborů, 1105 testů: 1103 zelených, 2 trvale padající** — `src/infra/fs/assetsPaths.test.ts`, `src/infra/fs/repoAssets.test.ts` |
| `npx tsc -p packages/desktop/tsconfig.json --noEmit` | **10 chyb ve 4 testovacích souborech** — `components/setup/fields/BassFieldRendering.test.tsx`, `components/setup/instruments/bass/buildBassFields.test.ts`, `components/setup/instruments/keys/buildKeysFields.test.ts`, `services/projectMaintenance.test.ts` |
| `npm run lint` (agregát) | **NEPOUŽÍVAT** |

**`npm run lint` je nedeterministický** — nad totožným kódem vrací 1540 / 1541 / 1543. Agregátní číslo se jako signál nepoužívá vůbec. Jediná platná metoda:

```bash
# Ověření dotčeného souboru na LF-normalizované kopii.
# biome.json MUSÍ ležet v kořeni scratch stromu, jinak se konfigurace nepoužije.
S="$SCRATCH/lintcheck"
mkdir -p "$S/packages/desktop/src/app/domain/inputs"
cp biome.json "$S/"
tr -d '\r' < packages/desktop/src/app/domain/inputs/FILE.ts \
  > "$S/packages/desktop/src/app/domain/inputs/FILE.ts"
npx biome check "$S/packages/desktop/src/app/domain/inputs/FILE.ts"
```

Recept je ověřený (`resolveMonitorRowEditability.ts` → `Checked 1 file in 22ms. No fixes applied.`).

**Delta se měří proti BASE, ne proti nule.** Finální review F5c ukázala, že měření jen na HEAD podhodnotilo počet nových nálezů (hlášeno 1, skutečnost 8). U každého dotčeného souboru se stejnou metodou zkontroluje **HEAD i BASE** (`git show <BASE>:<cesta> | tr -d '\r' > "$S/<cesta>"`) a porovnají se seznamy nálezů per pravidlo. Nesouvisející pre-existing nálezy se **neopravují**.

### Commit

- **Jednořádková zpráva bez těla a patičky.** Hook obojí odmítne.
- Formát: `<typ>(<scope>): <co>`, angličtina, bez tečky na konci. Scope podle kroku: `inputs`, `lineup`, `setup`, `pdf`.
- Krok „Commit" je v každém tasku explicitní.

### Měř, nepředpokládej

Plán F5c opakovaně psal kód proti TypeScript typům místo proti uloženým datům a F5d tím vyvrátila tři premisy (`addKeys` v repu neexistuje; `el_guitar_*` jsou ID presetů, ne channel keys; `remove`/`removeKeys` na vokálním klíči je no-op). **Kde task stojí na tvrzení o datech, obsahuje krok ověření nad `data/assets/` nebo `%APPDATA%/StagePilot/`.** Vzory metody: `.superpowers/sdd/2026-08-17-inputs-screen/task-15-domain-verification.md`, `task-17-domain-verification.md`, `drums-vocals-patch-reach-verification.md`.

### Terminologie

Operace `PresetOverridePatch.inputs` jsou `add`, `remove`, `replace`, `removeKeys` (legacy alias pro `remove`) a `update` — `src/domain/model/types.ts:340-350`. **`addKeys` v repu neexistuje**; spec F5c a starší handoffy ho zmiňují chybně.

### Pasti obrazovky `02` z F5c

- Řádek se adresuje přes `row.rawKey`. `row.key` je opaque a **nesmí se parsovat** — u vypnutého řádku má jiný jmenný prostor než u aktivního.
- Tabulka čte řádky z `buildDocument`. **Nic v UI nepřepočítává čísla ani pořadí.**
- Cíle `Continue`/`Back` berou obrazovky z `nextStepPath`/`previousStepPath` v `packages/desktop/src/app/shell/chrome/processSteps.ts`. **Zadrátovaná cesta se do stránek nesmí vracet.**
- `useSetupOverrides` vrací `defaultPresetFor` a `setupForSlot`.
- **Vlastnická akce se neklíčuje podle `row.group`** (Task 16 Ruling z F5c). `Edit kit` zůstal na `row.ownerRole === "drums"`, protože zúžená podmínka by tlačítko schovala u bubeníka s prázdným kitem a ten by se ke kitu už nedostal. `Edit inputs` z kroku C se řídí týmž pravidlem.

---

## Pořadí kroků je vynucené

| Krok | Tasky | Co | Proč právě tady |
|---|---|---|---|
| **A** | 1–3 | fallback z presetů + srovnání obou prefixových kopií (R1) | krok C stěhuje obě kopie do modálu; nesrovnané by se past přestěhovala s nimi a narazilo by na ni víc lidí než dnes |
| **B** | 4–6 | monitoring bicích se odemkne (R3), zúžení `add`/`removeKeys` se potvrzuje (R2) | doména musí ležet v repu dřív než UI, které se o ni opírá, aby se kontraktní testy psaly proti hotové doméně |
| **C** | 7–12 | modál `Edit inputs` na `02` (R4), zrušení `+ Add input` **spolu s** `GROUP_INPUT_LIBRARY` (R5) | potřebuje A |
| **D** | 13 | smazání setup modálu z `01` (R6) | potřebuje C — sekce Inputs je jediná akce starého modálu bez domova na `02` |
| **vlna 2** | 14–16 | overlays z `02`, oprava osiřelého vokálního monitor mixu (R7, Nález 1) | oddělitelný poslední blok; kdyby se fáze krátila, řízne se tady |

**Vlna 2 se dá vypustit celá bez zásahu do tasků 1–13.** Kroky A–D tvoří uzavřenou, dodatelnou fázi.

Task 12 (zrušení pickeru a katalogu) je **jeden commit** — mazat katalog dřív by nechalo picker bez zdroje, rušit picker dřív by přesunulo kus UI práce do kroku A. V intervalu tasků 1–11 picker dál nabízí `gtr_mic`/`gtr_di`; je to dnešní vada s ohraničenou životností, ne nová regrese.

---

## Seznam tasků

### Krok A — fallback z presetů a srovnání obou prefixových kopií (R1)

| # | Název | Jednou větou |
|---|---|---|
| 1 | Kopie 2 — `resolveGroupKey` uzná `group: "guitar"` a holý klíč `keys` | `electric_guitar` dostane fallback na `input.group`, řez `keys` přestane zahazovat klíč `keys` bez podtržítka. |
| 2 | Kopie 1 — `isGroupInputKey` bere celý kanál a fallback na `input.group` | Stejné pravidlo jiným švem: pět řezů dostane fallback, akustika ne, holý klíč `keys` projde. |
| 3 | `getGroupDefaultPreset(group, presetCatalog)` staví fallback z `PRESET_REFS` | Hudebník bez presetů dostane kanály **prvního** refu své role z katalogu, ne ručně psané klíče, které v datech nejsou. |

### Krok B — monitoring bicích a potvrzení zúžení (R2, R3)

| # | Název | Jednou větou |
|---|---|---|
| 4 | `resolveEffectiveProjectSetup` — monitoring bicích se odemkne a nevalidní ref hodí chybu | Bicí slot se u monitoringu srovná s basou; `assertMonitorPresetRef` platí i pro drums (padá, nedegraduje). |
| 5 | Brána `drums-not-supported` v `resolveMonitorRowEditability` padá + kontraktní test 1 | UI přestane monitoring bubeníka zavírat a kontraktní test doloží, že změna dojede až do `buildDocument`. |
| 6 | Kontraktní testy 2 a 3 — brány, které fáze **potvrzuje zavřené** | `add`/`removeKeys` u bicích a `update` na vokálním/talkback klíči jsou v dokumentu no-op a UI to hlásí; jen testy, žádná produkční změna. |

### Krok C — modál `Edit inputs` na `02` (R4, R5)

| # | Název | Jednou větou |
|---|---|---|
| 7 | `resolveInputsEditState` — slot → `EventSetupEditState` | Adaptér, který dnes žije jako netestovaný inline výraz v `ProjectSetupPage.tsx:1929-1961`. |
| 8 | `resolveInputsFieldSections` — role + kanály → sekce s katalogem polí + kontraktní test 7 | Rozdělení na řezy a výběr katalogu jako čistá, testovatelná funkce; klávesista s mono presetem dostane `KEYS_FIELDS`. |
| 9 | `resolveDroppedUserEdits` — co destruktivní přepnutí zahodí + kontraktní test 6 | Kanály nesoucí uživatelské přejmenování nebo poznámku, které by zamýšlený patch odstranil. |
| 10 | `InputsSetupSection.tsx` — obal modálu s potvrzením | `SchemaRenderer` + katalogy polí + stacked `alertdialog`, který dopředu vypíše, co zmizí. |
| 11 | Zapojení do `ProjectInputsPage.tsx` a `InputRowInspector` | Tlačítko `Edit inputs` u vlastníka, stav modálu, zápis patche do `snapshot.lineup`. |
| 12 | Zrušení `+ Add input`, `AddInputPicker`, `addInputRow` a `GROUP_INPUT_LIBRARY` — **jeden commit** | Katalog a jeho poslední konzument padají spolu; grep doloží, že v kódu nezůstal ani v komentářích. |

### Krok D — dokončení Tasku 19 (R6)

| # | Název | Jednou větou |
|---|---|---|
| 13 | Smazání setup modálu z `ProjectSetupPage.tsx`, `Setup` naviguje na `/inputs` | S modálem mizí jeho stav, osiřelé importy, `buildInputsPatchFromTarget` a dvojí bookkeeping bicí soupravy. |

### Vlna 2 — overlays z `02` a osiřelý monitor mix (R7, Nález 1) — **oddělitelná**

| # | Název | Jednou větou |
|---|---|---|
| 14 | `buildPdfMonitorRows` — vokální monitor mix nesmí přežít odebrání z overlay + kontraktní test 5 | Jediná doménová změna vlny 2; opravuje živou vadu, kterou lze vyrobit dnes jedním `Change` na `01`. |
| 15 | `resolveVocalOverlayEditorModel` — složení kandidátů do jedné čisté funkce, `01` na ni přepojen | ~170 řádků odvození z `ProjectSetupPage.tsx:837-957` se skládá z existujících čistých helperů; chování se nemění. |
| 16 | Overlays na `02` — Add/Remove lead, back a talkback + kontraktní test 4 | `InputsEditorSnapshot` dostane `overlays`, inspektor tlačítka; doména se nemění. |

**Celkem 16 tasků:** 3 (A) + 3 (B) + 6 (C) + 1 (D) + 3 (vlna 2).

---

## Otevřené otázky pro člověka

Obojí je změřené, ne odhad. **OQ-1 rozhodl člověk 2026-08-21 — tasky 8 a 11 jsou odblokované.** OQ-2 zůstává otevřená a neblokuje.

### OQ-1 — `Edit inputs` pro roli `vocs` prokazatelně neprojde do dokumentu. **ROZHODNUTO: nenabízet.**

**Spec R4 říká:** „Modál se nabízí pro role `bass`, `guitar`, `keys` a lead vocals — tedy přesně tam, kde katalog polí existuje."

**Měření říká, že u `vocs` je to no-op po celé délce cesty:**

1. `buildLeadVocsFields.setValue` (`app/components/setup/instruments/vocs/buildLeadVocsFields.ts:50`) volá `withInputsTarget(state.defaultPreset.inputs, state.patch, byId[value]?.inputs ?? …)`. Všechny tři vokální presety (`vocal_wireless`, `vocal_wired`, `vocal_no_mic`) nesou **týž klíč `voc_input`** a liší se jen `note` — ověřeno čtením `data/assets/presets/groups/vocs/*.json`. Výsledný patch je proto vždy `{ inputs: { update: [{ key: "voc_input", note: … }] } }`, nikdy `add` ani `remove`.
2. `buildMusicianInstrumentInputs` (`src/domain/pipeline/buildDocument.ts:349-368`) vokální preset **nikdy nepushne do `inputs`** — odloží ho jako `vocalCapability` a `continue`. `voc_input` se do `document.inputs` nedostane vůbec.
3. Větev `eventOverride` (`buildDocument.ts:610-619`) pro `vocs` běží, ale `affected = inputs.filter((input) => input.group === group)` je v tu chvíli **prázdné pole** — patch se aplikuje na nic.
4. Tištěný vokální řádek má klíč `voc_lead_{slot}` a staví ho `resolveOverlayDrivenVocalRows` z `vocalCapability`, tedy z **nepatchovaných** presetů muzikanta: `resolveEffectivePresetsForProject` projekt ignoruje úplně (`src/domain/pipeline/resolveEffectivePresetsForProject.ts:21-25` — čtyři `void args.*` a `return [...musician.presets]`).
5. `applyOwnerScopedUpdateOverrides` propustí `update` jen na klíče, které v řádcích **existují** (`narrowPatchToUpdatesFor`, `buildDocument.ts:216-222`) — `voc_input` mezi nimi není.

**Závěr:** dropdown typu mikrofonu u vokalisty by se v UI-preview projevil (`resolveEffectiveMusicianSetup` aplikuje patch bez ohledu na roli, `src/domain/setup/resolveEffectiveMusicianSetup.ts:35-41`) a v PDF ne. To je **přesně ta past falešného potvrzení, kterou fáze zavírá**, a přímo si odporuje s kontraktním testem 3 z R8.

**Doporučení: `Edit inputs` se pro roli `vocs` v kroku C NENABÍZÍ.** Modál dostanou `bass`, `guitar`, `keys`.

**ROZHODNUTO (člověk, 2026-08-21): platí doporučení — `vocs` modál nedostanou.** Výchozí implementace v Taskách 8 a 11 je tím finální; nic se v nich nemění a kontraktní test 3 zůstává, jak je napsaný.

**Cena doporučení, kterou musí zvážit člověk:** volba typu mikrofonu lead vokalisty přijde po kroku D o jediné UI a nastavuje se pak už jen presety muzikanta v katalogu. Třetí cesta — zapsat volbu do preset items muzikanta místo do `presetOverride` — je nová doménová schopnost, kterou spec vylučuje z rozsahu.

Plán je napsaný tak, aby odpověď byla **jedna větev v `resolveInputsFieldSections` (Task 8) a jeden predikát v `InputRowInspector` (Task 11)**. Výchozí implementace v obou taskách je doporučená varianta; opačná odpověď znamená smazat jednu podmínku a jeden test.

### OQ-2 — shim `{ key: "vocs", label: "" }` u role bez jediného rozpoznaného kanálu

`ProjectSetupPage.tsx:1955-1964` má shim: když `resolveEffectiveInstrumentGroups(sectionInputs)` vrátí prázdno, použije se `{ key: "vocs", label: "" }` a mapa řez → katalog (`:2280-2287`) podá `LEAD_VOCS_FIELDS`. To je místo, kam přistála M4: klávesista s `keys_mono_xlr` dnes dostane vokální pole.

Krok A tu konkrétní cestu zavře (holý klíč `keys` se rozpozná). **Zbytek shimu ale plán stěhuje beze změny**, protože spec mapu popisuje doslovně a mění jen její vstup. Zůstává reziduum: kytarista, který přišel o všechny kytarové kanály, dostane v modálu vokální pole místo kytarového dropdownu `Connection`, kterým by se vrátil zpět.

**Není to blokující** — platí to i dnes a krok A to nezhoršuje. Návrh na navazující fázi: klíčovat shim podle role (`guitar` → `GUITAR_FIELDS`, `keys` → `KEYS_FIELDS`, `vocs` → `LEAD_VOCS_FIELDS`), tři řádky. Zapsáno jako otevřená otázka, ne jako tichá odchylka.

---

## Rozhodnutí plánu (Rulings)

Věci, které spec nechal na plánu, nebo kde plán upřesňuje jeho literu.

**Ruling 1 — potvrzení u destruktivního přepnutí `Connection` je stacked `alertdialog`, ne inline pruh.** — Spec ukládá jen „musí se ukázat dopředu a vypsat, co zmizí". Volím druhý `ModalOverlay` s `role="alertdialog"` nad modálem `Edit inputs`, který drží zamýšlený patch nerozbalený, dokud uživatel nepotvrdí. Důvody: (1) obrazovka `02` má pro destruktivní akci **už dva** přesně takové dialogy — `Reset to defaults?` (`ProjectInputsPage.tsx:1618-1666`) a potvrzení `Save as musician default` — a třetí idiom by byl bezdůvodný; (2) „dopředu" je takhle doslova pravda, protože patch se do `snapshot.lineup` nezapíše, dokud dialog nedoběhne, kdežto inline pruh by byl post-hoc oznámení; (3) výpis zahozených kanálů potřebuje místo na label i poznámku, které se do řádku vedle `<select>` nevejdou; (4) `useModalBehavior` už na této stránce zvládá stackované overlaye (`isEditKitModalOpen` a `showResetConfirmation` dnes koexistují). — **Cena při chybě:** jedno kliknutí navíc na vzácné cestě. Alternativa (inline pruh) by znamenala zásah do CSS gridu `setup-schema-fields` a čtvrtý způsob, jak se v aplikaci potvrzuje.

**Ruling 2 — rozdělení na řezy a výběr katalogu je čistá funkce v `app/domain/inputs/`, ne kód uvnitř `InputsSetupSection.tsx`.** — Spec říká, že se to „stěhuje do `InputsSetupSection.tsx`". Kontraktní test 7 z téhož specu ale požaduje aserci „modál dostane `KEYS_FIELDS`, ne `LEAD_VOCS_FIELDS`", a tu bez jsdom nad komponentou napsat nejde (R8). Funkce `resolveInputsFieldSections` je tedy vynucená vlastním testovacím požadavkem specu, ne odchylkou od něj. Zároveň to drží zásah do `ProjectInputsPage.tsx` v pásmu 60–100 řádků z R4. — **Cena při chybě:** jeden soubor navíc v `app/domain/inputs/`.

**Ruling 3 — grep „`GROUP_INPUT_LIBRARY` nesmí v repu zbýt" je omezený na `src/` a `packages/`.** — Spec píše „v kódu, v testech ani v komentářích". Doslovný grep přes celý repozitář ale trefí i `docs/superpowers/specs/**`, `docs/superpowers/plans/2026-08-17-inputs-screen.md`, `.superpowers/sdd/2026-08-17-inputs-screen/**` a `analysis/pdf_rendering_analysis.md` — historické artefakty, které se nepřepisují, protože popisují stav, který tehdy platil. Verifikace Tasku 12 proto běží nad `src/ packages/`. — **Cena při chybě:** zmínka v archivní dokumentaci přežije; kdyby se měla mazat, přepsaly by se tím ledgery hotové fáze.

**Ruling 4 — `resolveInputsEditState` importuje `EventSetupEditState` jako type-only.** — Typ je deklarovaný v `app/components/setup/adapters/eventSetupAdapter.ts`, tedy v komponentové vrstvě, a `app/domain/` by na ni neměl ukazovat. `import type` se ale při buildu maže a runtime závislost nevytváří; duplikovat trojpoložkový typ do domény by naopak zavedlo dvě definice, které se můžou rozejít. — **Cena při chybě:** kdyby se `eventSetupAdapter.ts` někdy rozpadl, jeden `import type` navíc k přepsání.

**Ruling 5 — `Edit inputs` se neschovává za bránu `resolveInputRowEditability`.** — Přímý přenos Rulingu z Tasku 16 F5c pro `Edit kit`: brána z 13b zavírá `Remove`/`Restore` právě proto, že ty cesty dokument nečte; `Edit inputs` je cesta, kterou čte (patch dojede přes `resolveEffectiveProjectSetup` u basy, přes větev `eventOverride` u kytary a kláves — ověřeno v OQ-1, body 2–3). Tlačítko se navíc klíčuje na `row.ownerRole`, ne na `row.group`, aby nezmizelo kytaristovi, který přišel o všechny kanály. — **Cena při chybě:** slepá ulička, ze které by se uživatel po smazání modálu z `01` už nedostal.

**Ruling 6 — `removeInputRow` si nechává sjednocení `remove` + `removeKeys`, i když po Tasku 13 nikdo do `removeKeys` nepíše.** — Zapisovatel mizí, ale uložená data v `%APPDATA%/StagePilot` `removeKeys` nesou dál (M3) a doména obě pole při čtení slučuje. Task 13 přepíše jen **komentář**, který ten merge dnes vysvětluje odkazem na `buildInputsPatchFromTarget`; sama logika zůstává. — **Cena při chybě:** kanál vypnutý ve starším projektu by šel po odstranění merge vypnout podruhé.

---

## Tasky

## KROK A — fallback z presetů a srovnání obou prefixových kopií (R1)

Krok A je jediná část fáze, která sahá i na obrazovku `01`: `isGroupInputKey` mění signaturu a jeden z jeho dvou volajících — `supportsCapabilitySection` — rozhoduje, koho `01` nabídne do které sekce sestavy (`ProjectSetupPage.tsx:1375-1387`). `ProjectSetupPage.tsx` vlastní test nemá, takže ověření visí na doménové vrstvě a na ručním bodě 17 ze specu.

### Task 1: Kopie 2 — `resolveGroupKey` uzná `group: "guitar"` a holý klíč `keys`

**Files:**
- Modify: `src/domain/lineup/effectiveInstrumentGroups.ts:32-44`
- Test: `src/domain/lineup/effectiveInstrumentGroups.test.ts`

**Interfaces:**
- Consumes: nic z předchozích tasků.
- Produces: `resolveEffectiveInstrumentGroups(inputs: InputChannel[]): EffectiveInstrumentGroup[]` — signatura beze změny, mění se jen klasifikace. Task 8 (`resolveInputsFieldSections`) na ni staví.

**Kontext, který nesmíš přehlédnout**

`resolveGroupKey` je **kopie 2** ze dvou nezávislých implementací prefixového rozpoznávání kanálů. `drums`, `bass`, `keys` i `vocs` už fallback `|| group === "…"` mají; řádky pro `electric_guitar` a `acoustic_guitar` jedou čistě na `key.startsWith`. Dnešní podoba (`:32-44`):

```ts
function resolveGroupKey(input: InputChannel): EffectiveInstrumentGroup["key"] | null {
  const key = normalize(input.key);
  const group = normalize(input.group ?? "");
  if (key.startsWith("dr_") || group === "drums") return "drums";
  if (key.startsWith("el_bass") || key.startsWith("bass_") || group === "bass") return "bass";
  if (key.startsWith("el_guitar")) return "electric_guitar";
  if (key.startsWith("ac_guitar")) return "acoustic_guitar";
  if (key.startsWith("keys_") || group === "keys") return "keys";
  if (key.startsWith("voc_lead") || key.startsWith("vocal_lead")) return "lead_voc";
  if (key.startsWith("voc_back") || key.startsWith("vocal_back")) return "back_voc";
  if (key.startsWith("voc_") || key.startsWith("vocal_") || group === "vocs") return "vocs";
  return null;
}
```

Tři věci, které rozhodl spec a **nepřehodnocuj je**:

1. **Fallback `|| group === "guitar"` dostane jen řádek `electric_guitar`.** `preset.group` je u obou kytarových řezů `"guitar"`, takže jedna hodnota nemůže rozhodnout mezi dvěma řezy. Akustika je doplňkový kanál s jediným pevným klíčem, elektrická kytara je to, na čem stojí rozpoznání kytaristy (M2).
2. **Řádky `lead_voc` a `back_voc` fallback NEDOSTANOU.** Klíč s `group: "vocs"` mimo prefixy `voc_lead`/`voc_back` má propadnout na řádek `vocs` — o slotu vokálního řádku rozhoduje overlay, ne klíč (O1).
3. **Řez `keys` musí uznat i holý klíč `keys`.** Preset `keys_mono_xlr` má jediný kanál s klíčem `keys` a ten nezačíná na `keys_`. Fallback na `group` ho nezachrání, protože kanál z presetu pole `group` **nenese** — žádný z 16 souborů v `data/assets/presets/groups/` ho na prvcích `inputs[]` nemá.

Pozor na pořadí podmínek: `key === "keys"` se musí testovat **před** vokální větví, jinak nic nezmění (dnes `keys` propadne až na `return null`).

- [ ] **Krok 1: Ověř data, na kterých task stojí**

```bash
cd /c/Users/mkrecmer/dev/stagepilot
cat data/assets/presets/groups/keys/keys_mono_xlr.json
cat data/assets/presets/groups/keys/keys_mono_jack.json
```

Očekávaný výsledek: oba mají právě jeden prvek `inputs` s `"key": "keys"` a **bez** pole `group`.

Druhá kontrola — žádný kanál v žádném presetu nenese `group`:

```bash
node --input-type=module -e "
import {readdirSync,readFileSync} from 'node:fs';
const root='data/assets/presets/groups';
for (const g of readdirSync(root))
  for (const f of readdirSync(root+'/'+g)) {
    const p=JSON.parse(readFileSync(root+'/'+g+'/'+f,'utf8'));
    const bad=(p.inputs??[]).filter(i=>i.group);
    if (bad.length) console.log(g+'/'+f, bad.map(i=>i.key));
  }
console.log('done');
"
```

Očekávaný výstup: jen `done`. **Pokud vypíše cokoli dalšího, zastav se — premisa R1 neplatí a plán je potřeba přepsat.**

- [ ] **Krok 2: Napiš padající testy**

Na konec `src/domain/lineup/effectiveInstrumentGroups.test.ts` přidej:

```ts
describe("resolveGroupKey fallbacks (F5d R1, copy 2)", () => {
  it("classifies a guitar-group channel outside the el_guitar prefix as electric guitar", () => {
    const groups = resolveEffectiveInstrumentGroups([
      { key: "gtr_whatever", label: "Odd guitar channel", group: "guitar" },
    ]);

    expect(groups.map((item) => item.key)).toEqual(["electric_guitar"]);
  });

  it("never routes a guitar-group channel to acoustic guitar", () => {
    // `preset.group` is "guitar" for both guitar slices, so one value cannot
    // decide between them. Acoustic stays on its single fixed key prefix.
    const groups = resolveEffectiveInstrumentGroups([
      { key: "ac_guitar", label: "Acoustic guitar", group: "guitar" },
      { key: "el_guitar_mic", label: "Electric guitar", group: "guitar" },
    ]);

    expect(groups.map((item) => item.key)).toEqual([
      "electric_guitar",
      "acoustic_guitar",
    ]);
    expect(
      groups
        .find((item) => item.key === "acoustic_guitar")
        ?.inputs.map((input) => input.key),
    ).toEqual(["ac_guitar"]);
  });

  it("classifies the bare `keys` key as keys, not as null", () => {
    // `keys_mono_xlr`/`keys_mono_jack` carry exactly one channel keyed `keys`
    // and preset channels never carry `group`, so the key is the only signal.
    const groups = resolveEffectiveInstrumentGroups([
      { key: "keys", label: "Keys" },
    ]);

    expect(groups.map((item) => item.key)).toEqual(["keys"]);
  });

  it("keeps a vocs-group channel outside the lead/back prefixes on the plain vocs slice", () => {
    // The overlay decides the vocal slot, not the key (O1) — so no fallback
    // on the lead_voc / back_voc rows.
    const groups = resolveEffectiveInstrumentGroups([
      { key: "voc_input", label: "Vocal", group: "vocs" },
    ]);

    expect(groups.map((item) => item.key)).toEqual(["vocs"]);
  });
});
```

- [ ] **Krok 3: Spusť testy a ověř, že padají**

Run: `npx vitest run src/domain/lineup/effectiveInstrumentGroups.test.ts`

Expected: FAIL. První test dostane `[]` místo `["electric_guitar"]`, třetí `[]` místo `["keys"]`. Druhý a čtvrtý projdou už teď — jsou to zámky proti přestřelení, ne nová schopnost.

- [ ] **Krok 4: Uprav `resolveGroupKey`**

V `src/domain/lineup/effectiveInstrumentGroups.ts` nahraď funkci na `:32-44`:

```ts
/**
 * Kopie 2 ze dvou prefixových rozpoznávání (F5d R1). Odpovídá na „do kterého
 * řezu kanál spadá"; kopie 1 (`resolveLineupInstrumentMembership.ts`) na
 * „patří tenhle kanál do téhle sekce". Obě nesou stejné pravidlo, ale
 * neslučují se — viz spec F5d, sekce Navazuje.
 *
 * Fallback `group === "guitar"` má **jen** `electric_guitar`: `preset.group`
 * je u obou kytarových řezů `"guitar"`, takže jedna hodnota nemůže rozhodnout
 * mezi dvěma řezy, a rozpoznání kytaristy stojí na elektrice (M2). `lead_voc`
 * a `back_voc` fallback nedostávají schválně — o slotu vokálního řádku
 * rozhoduje overlay, ne klíč (O1), takže vokální klíč mimo prefix má
 * propadnout na řádek `vocs`.
 *
 * Holý klíč `keys` (presety `keys_mono_xlr`, `keys_mono_jack`) je vyjmenovaný
 * zvlášť: nezačíná na `keys_` a kanál z presetu pole `group` nenese, takže by
 * bez tohohle řádku propadl na `null`.
 */
function resolveGroupKey(input: InputChannel): EffectiveInstrumentGroup["key"] | null {
  const key = normalize(input.key);
  const group = normalize(input.group ?? "");
  if (key.startsWith("dr_") || group === "drums") return "drums";
  if (key.startsWith("el_bass") || key.startsWith("bass_") || group === "bass") return "bass";
  if (key.startsWith("el_guitar")) return "electric_guitar";
  if (key.startsWith("ac_guitar")) return "acoustic_guitar";
  if (group === "guitar") return "electric_guitar";
  if (key === "keys" || key.startsWith("keys_") || group === "keys") return "keys";
  if (key.startsWith("voc_lead") || key.startsWith("vocal_lead")) return "lead_voc";
  if (key.startsWith("voc_back") || key.startsWith("vocal_back")) return "back_voc";
  if (key.startsWith("voc_") || key.startsWith("vocal_") || group === "vocs") return "vocs";
  return null;
}
```

Řádek `if (group === "guitar") return "electric_guitar";` stojí **až za** oběma prefixovými kytarovými řádky, aby `ac_guitar` s `group: "guitar"` skončil v akustice, ne v elektrice.

- [ ] **Krok 5: Spusť testy a ověř, že prošly**

Run: `npx vitest run src/domain/lineup/effectiveInstrumentGroups.test.ts`
Expected: PASS — 4 nové + 2 původní.

- [ ] **Krok 6: Ověř, že se nic jiného nerozbilo**

```bash
npm test 2>&1 | tail -5
npx tsc -p packages/desktop/tsconfig.json --noEmit 2>&1 | grep -c "error TS"
```

Expected: `Tests  2 failed | 1107 passed (1109)` — baseline 1105 + 4 nové, tytéž dvě padající (`assetsPaths`, `repoAssets`). tsc: `10`.

Kdyby padl jiný test, **neupravuj jeho očekávání automaticky.** Spec dovoluje měnit očekávání jen tam, kde je nová hodnota správná odpověď; padne-li něco mimo `effectiveInstrumentGroups`, zapiš to a eskaluj.

- [ ] **Krok 7: Ověř lint na dotčených souborech**

Recept z Global Constraints pro `src/domain/lineup/effectiveInstrumentGroups.ts` a `…test.ts`, na HEAD i BASE. Expected: delta 0.

- [ ] **Krok 8: Commit**

```bash
git add src/domain/lineup/effectiveInstrumentGroups.ts src/domain/lineup/effectiveInstrumentGroups.test.ts
git commit -m "fix(lineup): recognise guitar-group channels and the bare keys key in resolveGroupKey"
```

---
### Task 2: Kopie 1 — `isGroupInputKey` bere celý kanál a fallback na `input.group`

**Files:**
- Modify: `src/domain/lineup/resolveLineupInstrumentMembership.ts:27-37` (`isGroupInputKey`), `:39-48` (`supportsCapabilitySection`), `:50-67` (`detectPresetInstrumentCapabilities`), `:159-170` (`resolveInputsForCapabilitySection`)
- Test: `src/domain/lineup/resolveLineupInstrumentMembership.test.ts`

**Interfaces:**
- Consumes: nic z Tasku 1 — kopie 1 a kopie 2 jsou nezávislé soubory.
- Produces:
  - `supportsCapabilitySection(args: { section: SetupCapabilitySection; inputs: InputChannel[] }): boolean` — signatura beze změny.
  - `resolveInputsForCapabilitySection(args: { section: SetupCapabilitySection; inputs: InputChannel[] }): InputChannel[]` — signatura beze změny. Task 8 na ni staví.
  - `detectPresetInstrumentCapabilities(inputs: InputChannel[]): MusicianInstrumentCapabilities` — signatura beze změny.
  - `isGroupInputKey` **není exportovaná**; její signatura se mění z `(key: string, group)` na `(input: InputChannel, group)`. Změna nikam neteče — oba volající jsou ve stejném souboru a celý `input` už mají.

**Kontext, který nesmíš přehlédnout**

Kopie 1 dnes `group` **vůbec nevidí**: `isGroupInputKey` dostává jen `key: string` a `detectPresetInstrumentCapabilities` sice celý kanál má, ale čte z něj jen `.key`. Rozhodnutí z kopie 2 se sem přenáší se stejnou logikou, ale jiným švem.

**M4 — proč se musí opravit obě kopie, ne jedna.** Modál na `01` (a po kroku C modál na `02`) volá `resolveInputsForCapabilitySection` a **jeho výsledek** předává `resolveEffectiveInstrumentGroups` (`ProjectSetupPage.tsx:1948-1954`). Je to sériové zapojení: co odfiltruje kopie 1, kopie 2 už nikdy neuvidí. Fallback doplněný jen do kopie 2 by se u odfiltrovaného kanálu nikdy neuplatnil.

**Asymetrie u akustiky je povinná, ne kosmetická.** `detectPresetInstrumentCapabilities` dostane fallback `group === "guitar"` **jen pro `hasElectricGuitarCapability`**. Kdyby ho dostaly obě vlastnosti, kanál `ac_guitar` — kterému `group: "guitar"` doplní nový `getGroupDefaultPreset` z Tasku 3 — by kytaristu prohlásil za elektrického i akustického zároveň, `isAcousticOnlyMember` (`:87-94`) by přestal fungovat a sekce `acoustic_guitar` na `01` by zmizela. To je riziko 3 ze specu.

**Řez `acoustic_guitar` řeší oba volající mimo `isGroupInputKey`**, prefixem `ac_guitar` (`:44-46` a `:164-168`); typ parametru ho ani nepřipouští (`Exclude<SetupCapabilitySection, "acoustic_guitar">`). Asymetrie „elektrika dostane fallback, akustika ne" je tím na kopii 1 vynucená strukturou a nemusí se zavádět ručně.

**Holý klíč `keys` musí projít i tady.** Bez toho zůstane klávesista s `keys_mono_xlr` neviditelný pro sekci keys na `01` a v modálu dostane vokální katalog polí.

- [ ] **Krok 1: Napiš padající testy**

Na konec `src/domain/lineup/resolveLineupInstrumentMembership.test.ts` přidej. Importy `supportsCapabilitySection`, `resolveInputsForCapabilitySection`, `detectPresetInstrumentCapabilities`, `isAcousticOnlyMember` doplň do existujícího import bloku nahoře, pokud tam ještě nejsou.

```ts
describe("group fallbacks on capability sections (F5d R1, copy 1)", () => {
  it("accepts a guitar-group channel outside the el_guitar prefix into the guitar section", () => {
    const inputs = [{ key: "gtr_whatever", label: "Odd guitar channel", group: "guitar" as const }];

    expect(supportsCapabilitySection({ section: "guitar", inputs })).toBe(true);
    expect(
      resolveInputsForCapabilitySection({ section: "guitar", inputs }).map((i) => i.key),
    ).toEqual(["gtr_whatever"]);
  });

  it("does not let an ac_guitar channel with group guitar claim electric capability", () => {
    // `getGroupDefaultPreset` (task 3) stamps `group: "guitar"` onto every
    // channel it derives, `ac_guitar` included. If both capabilities took the
    // fallback, `isAcousticOnlyMember` would stop working and the
    // `acoustic_guitar` section on `01` would disappear.
    const capabilities = detectPresetInstrumentCapabilities([
      { key: "ac_guitar", label: "Acoustic guitar", group: "guitar" },
    ]);

    expect(capabilities).toEqual({
      hasElectricGuitarCapability: false,
      hasAcousticGuitarCapability: true,
    });
    expect(isAcousticOnlyMember(capabilities)).toBe(true);
  });

  it("accepts the bare `keys` key into the keys section", () => {
    const inputs = [{ key: "keys", label: "Keys" }];

    expect(supportsCapabilitySection({ section: "keys", inputs })).toBe(true);
    expect(
      resolveInputsForCapabilitySection({ section: "keys", inputs }).map((i) => i.key),
    ).toEqual(["keys"]);
  });

  it("still accepts voc_input into the vocs section", () => {
    const inputs = [{ key: "voc_input", label: "Vocal" }];

    expect(supportsCapabilitySection({ section: "vocs", inputs })).toBe(true);
  });

  it("accepts a keys-group channel with an unrelated key into the keys section", () => {
    const inputs = [{ key: "synth_top", label: "Synth", group: "keys" as const }];

    expect(supportsCapabilitySection({ section: "keys", inputs })).toBe(true);
  });
});
```

- [ ] **Krok 2: Spusť testy a ověř, že padají**

Run: `npx vitest run src/domain/lineup/resolveLineupInstrumentMembership.test.ts`

Expected: FAIL na testech 1, 3 a 5 (`false` místo `true`, `[]` místo klíče). Testy 2 a 4 projdou už teď — jsou to zámky.

- [ ] **Krok 3: Přepiš `isGroupInputKey` a jeho volající**

V `src/domain/lineup/resolveLineupInstrumentMembership.ts` nahraď `:27-48`:

```ts
/**
 * Kopie 1 ze dvou prefixových rozpoznávání (F5d R1). Odpovídá na „patří
 * tenhle kanál do téhle sekce"; kopie 2 (`effectiveInstrumentGroups.ts`) na
 * „do kterého řezu kanál spadá". Obě nesou stejné pravidlo, ale neslučují se
 * — kopie 2 zná `lead_voc`/`back_voc`, kopie 1 ne.
 *
 * Bere celý `InputChannel`, ne jen klíč: kanál z `getGroupDefaultPreset` a z
 * ručního `inputs.add` nese `group`, a bez fallbacku na něj by klíč mimo
 * prefix vypadl ze sekce úplně (M2 — `gtr_mic` odebral kytaristovi kytaru).
 * Kanál odvozený z presetu naopak `group` **nenese** (žádný z 16 souborů v
 * `data/assets/presets/groups/` ho na prvcích `inputs[]` nemá), takže holý
 * klíč `keys` z `keys_mono_*` musí projít prefixovou větví — proto je
 * vyjmenovaný.
 *
 * `acoustic_guitar` se sem nedostane: typ ho vylučuje a oba volající ho řeší
 * prefixem `ac_guitar` mimo tuhle funkci. Asymetrie „elektrika dostane
 * fallback, akustika ne" (kopie 2) je tím vynucená strukturou.
 */
function isGroupInputKey(
  input: InputChannel,
  group: Exclude<SetupCapabilitySection, "acoustic_guitar">,
): boolean {
  const normalized = normalizeKey(input.key);
  const inputGroup = normalizeKey(input.group ?? "");
  if (group === "guitar")
    return normalized.startsWith("el_guitar") || inputGroup === "guitar";
  if (group === "bass")
    return (
      normalized.startsWith("el_bass") ||
      normalized.startsWith("bass_") ||
      inputGroup === "bass"
    );
  if (group === "vocs")
    return (
      normalized.startsWith("voc_") ||
      normalized.startsWith("vocal_") ||
      inputGroup === "vocs"
    );
  if (group === "drums")
    return normalized.startsWith("dr_") || inputGroup === "drums";
  if (group === "keys")
    return (
      normalized === "keys" ||
      normalized.startsWith("keys_") ||
      inputGroup === "keys"
    );
  return normalized.startsWith(`${group}_`) || inputGroup === group;
}

export function supportsCapabilitySection(args: {
  section: SetupCapabilitySection;
  inputs: InputChannel[];
}): boolean {
  const { section, inputs } = args;
  if (section === "acoustic_guitar") {
    return hasAcousticGuitarCapability(inputs);
  }
  return inputs.some((input) => isGroupInputKey(input, section));
}
```

Poslední řádek `return normalized.startsWith(...) || inputGroup === group;` je nedosažitelný pro dnešní hodnoty `SetupCapabilitySection`, ale zůstává jako uzávěr — kdyby přibyl šestý řez, chová se stejně jako pět vyjmenovaných.

Dole v souboru uprav `resolveInputsForCapabilitySection` (`:159-170`), poslední řádek:

```ts
  return inputs.filter((input) => isGroupInputKey(input, section));
```

- [ ] **Krok 4: Doplň fallback do `detectPresetInstrumentCapabilities`**

Nahraď `:50-67`:

```ts
/**
 * Fallback `group === "guitar"` dostává **jen** `hasElectricGuitarCapability`
 * (F5d R1). Kdyby ho dostala i akustika, kanál `ac_guitar` — kterému
 * `group: "guitar"` doplní `getGroupDefaultPreset` — by kytaristu prohlásil
 * za elektrického i akustického zároveň, `isAcousticOnlyMember` by přestal
 * fungovat a sekce `acoustic_guitar` na `01` by zmizela.
 */
export function detectPresetInstrumentCapabilities(
  inputs: InputChannel[],
): MusicianInstrumentCapabilities {
  return inputs.reduce<MusicianInstrumentCapabilities>(
    (capabilities, input) => {
      const key = normalizeKey(input.key);
      const group = normalizeKey(input.group ?? "");
      if (key.startsWith("ac_guitar")) {
        capabilities.hasAcousticGuitarCapability = true;
        return capabilities;
      }
      if (key.startsWith("el_guitar") || group === "guitar")
        capabilities.hasElectricGuitarCapability = true;
      return capabilities;
    },
    {
      hasElectricGuitarCapability: false,
      hasAcousticGuitarCapability: false,
    },
  );
}
```

`ac_guitar` má **předčasný `return`**: jinak by na něm zabral fallback `group === "guitar"` na dalším řádku. Tohle je přesně ten bod, kvůli kterému test 2 z Kroku 1 existuje.

- [ ] **Krok 5: Spusť testy a ověř, že prošly**

```bash
npx vitest run src/domain/lineup/resolveLineupInstrumentMembership.test.ts
npx vitest run src/domain/lineup/
```

Expected: PASS. Zvláštní pozornost sekci `supportsCapabilitySection` na `:184-205` původního souboru — `compositeInputs` obsahuje `ac_guitar`, `voc_lead`, `keys_l` a testuje mimo jiné `section: "bass"` → `false`. Ten musí dál platit: žádný z těch tří kanálů nemá `group`, takže fallback nezabere.

- [ ] **Krok 6: Ověř, že se nic jiného nerozbilo**

```bash
npm test 2>&1 | tail -5
npx tsc -p packages/desktop/tsconfig.json --noEmit 2>&1 | grep -c "error TS"
npx vitest run src/domain/pipeline/buildDocument.pdfRegression.test.ts
```

Expected: `2 failed | 1112 passed (1114)` (1109 po Tasku 1 + 5 nových). tsc `10`. `pdfRegression` zelený s **nedotčenými očekáváními** — pokud padne, zastav se a eskaluj, neupravuj ho.

Zkontroluj taky `packages/desktop/src/app/pages/shared/setupConstants.test.ts` — `buildVisibleLineupSections` volá `getAcousticGuitarMembers` → `resolveMusicianInstrumentCapabilities`, tedy funkci, kterou jsi právě změnil. Sedm testů AC. GUITAR musí zůstat zelených; kdyby padly, doplnil jsi fallback i akustice.

- [ ] **Krok 7: Ověř lint**

Recept z Global Constraints pro `src/domain/lineup/resolveLineupInstrumentMembership.ts` a `…test.ts`, na HEAD i BASE. Expected: delta 0.

- [ ] **Krok 8: Commit**

```bash
git add src/domain/lineup/resolveLineupInstrumentMembership.ts src/domain/lineup/resolveLineupInstrumentMembership.test.ts
git commit -m "fix(lineup): let capability sections fall back to the channel group, electric guitar only"
```

---
### Task 3: `getGroupDefaultPreset(group, presetCatalog)` staví fallback z `PRESET_REFS`

**Files:**
- Modify: `packages/desktop/src/app/pages/shared/setupConstants.ts:248-253` (`getGroupDefaultPreset`), `:72-92` (`PRESET_REFS` — jen export, obsah beze změny)
- Modify: `packages/desktop/src/app/domain/setup/resolveSetupForSlot.ts:39` a `:59` (prodrátování katalogu)
- Test: `packages/desktop/src/app/pages/shared/setupConstants.test.ts`, `packages/desktop/src/app/domain/setup/resolveSetupForSlot.test.ts`

**Interfaces:**
- Consumes: nic z Tasků 1–2.
- Produces: `getGroupDefaultPreset(group: Group, presetCatalog?: Record<string, PresetEntity> | Record<string, Preset>): MusicianSetupPreset`. **Druhý parametr je volitelný a bez něj vrací prázdné `inputs`** pro `bass`/`guitar`/`keys`/`vocs`. Volají ji jen `resolveSetupForSlot.ts:39,59`.

**Kontext, který nesmíš přehlédnout**

Dnešní podoba (`:248-253`) čte ručně psaný katalog:

```ts
export function getGroupDefaultPreset(group: Group): MusicianSetupPreset {
  return {
    inputs: (GROUP_INPUT_LIBRARY[group] ?? []).map((item) => ({ ...item })),
    monitoring: { monitorRef: "wedge_foh" },
  };
}
```

`GROUP_INPUT_LIBRARY` z něj vydává klíče, které v datech **neexistují**: `gtr_mic`, `gtr_di`, `voc_lead`, `voc_back`, `talkback`. Úplný seznam skutečných input keys v `data/assets/` je `ac_guitar`, `bass_synth`, `el_bass_mic`, `el_bass_xlr_amp`, `el_bass_xlr_pedalboard`, `el_guitar_mic`, `el_guitar_xlr`, `el_guitar_xlr_l`, `el_guitar_xlr_r`, `keys`, `keys_l`, `keys_r`, `voc_input`.

Nová podoba bere **první ref role** z `PRESET_REFS` (`:72-92`) — **potvrzeno člověkem, union byl změřen a zamítnut**, protokol `.superpowers/sdd/2026-08-21-inputs-section-move/r1-preset-refs-verification.md`. Union by kytaristovi bez presetu dal mikrofon, DI, stereo pár i akustiku současně a slil by vzájemně se vylučující basové presety, které `selectBassMainPreset` schválně rozlišuje.

| Role | Zdroj | Očekávané klíče |
|---|---|---|
| `bass` | `PRESET_REFS.bass[0]` = `el_bass_xlr_amp` | `el_bass_xlr_amp` |
| `guitar` | `PRESET_REFS.guitar[0]` = `el_guitar_mic` | `el_guitar_mic` |
| `keys` | `PRESET_REFS.keys[0]` = `keys_stereo_xlr` | `keys_l`, `keys_r` |
| `vocs` | `PRESET_REFS.vocs[0]` = `vocal_wireless` | `voc_input` |
| `drums` | `resolveDrumInputs(createDefaultDrumDefinition())` — beze změny, jen se stěhuje z konstanty do funkce | výchozí kit |
| `talkback` | prázdné pole | — |

Čtyři věci, které rozhodl spec:

1. **Pole `group` se doplní z `preset.group`.** Kanály v presetech ho nenesou vůbec, takže bez toho by odvozený kanál spadl do pasti z M2.
2. **`drums` si nechává `resolveDrumInputs(createDefaultDrumDefinition())`** — je to jediný řádek dnešní konstanty, který si klíče nevymýšlí. Bicí kanály staví `drumDefinition` (R2); fallback slouží jen bubeníkovi bez presetu a bez kitu.
3. **`talkback` vrací prázdné pole.** Jeho preset má `type: "talkback_type"` a místo `inputs[]` singulární šablonu `tb_{ownerKey}`, v `PRESET_REFS` ref nemá a řádek staví `buildPdfTalkback` z overlays (O1). Talkback navíc nemá slot v lineupu, takže se `getGroupDefaultPreset("talkback")` v produkci nevolá.
4. **Prázdný katalog dá prázdné `inputs`.** Je to táž hodnota, na kterou dnes padá poslední záchyt `createDefaultMusicianPreset` (`src/domain/rules/presetOverride.ts:278-285`), takže se nezavádí nový režim selhání.

**`monitoring: { monitorRef: "wedge_foh" }` zůstává beze změny.**

**Existující testy, které tenhle task rozbije — a jak je opravit.** `resolveSetupForSlot.test.ts` volá `resolveMusicianDefaultPreset` a `resolveSetupForSlot` s `EMPTY_CATALOG` a očekává `["el_bass_xlr_amp"]` (`:30-49` a `:72-83`). Po změně by dostal `[]`. **Neměň očekávání na `[]`** — smysl testu je „band default pro bass je jediný kanál a fallback nespadl jinam". Správná oprava je dát testu katalog, který ten preset obsahuje; tím zároveň nový mechanismus otestuje. Prázdný katalog dostane vlastní, nový test.

**Testy, kterých se task NEDOTÝKÁ, i když v nich `gtr_mic` je.** `setupConstants.test.ts:79,126,132` předává `gtr_mic` literálem přes `bandDefaults`, ne přes `GROUP_INPUT_LIBRARY`. Totéž `presetOverride.test.ts:107` a `orderInputsForRole.test.ts:41-42`. Při čtení diffu se to snadno zamění — **nesahej na ně**.

- [ ] **Krok 1: Ověř, že první refy dávají očekávané klíče**

```bash
cd /c/Users/mkrecmer/dev/stagepilot
for f in bass/el_bass_xlr_amp guitar/el_guitar_mic keys/keys_stereo_xlr vocs/vocal_wireless; do
  echo "--- $f"
  node -e "const p=require('./data/assets/presets/groups/$f.json');console.log(p.group, p.inputs.map(i=>i.key))"
done
```

Expected: `bass [ 'el_bass_xlr_amp' ]`, `guitar [ 'el_guitar_mic' ]`, `keys [ 'keys_l', 'keys_r' ]`, `vocs [ 'voc_input' ]`. **Kdyby se to lišilo, zastav se — tabulka výše je z toho odvozená.**

- [ ] **Krok 2: Napiš padající testy pro `getGroupDefaultPreset`**

Do `packages/desktop/src/app/pages/shared/setupConstants.test.ts` přidej import `getGroupDefaultPreset` do existujícího bloku a na konec souboru:

```ts
describe("getGroupDefaultPreset (F5d R1)", () => {
  const catalog: Record<string, PresetEntity> = {
    el_bass_xlr_amp: {
      type: "preset",
      id: "el_bass_xlr_amp",
      label: "Electric bass guitar",
      group: "bass",
      inputs: [
        { key: "el_bass_xlr_amp", label: "Electric bass guitar", note: "XLR out from amp" },
      ],
    },
    el_guitar_mic: {
      type: "preset",
      id: "el_guitar_mic",
      label: "Electric guitar (mic)",
      group: "guitar",
      inputs: [{ key: "el_guitar_mic", label: "Electric guitar" }],
    },
    keys_stereo_xlr: {
      type: "preset",
      id: "keys_stereo_xlr",
      label: "Keys stereo XLR",
      group: "keys",
      inputs: [
        { key: "keys_l", label: "Keys L", channel: "L" },
        { key: "keys_r", label: "Keys R", channel: "R" },
      ],
    },
    vocal_wireless: {
      type: "preset",
      id: "vocal_wireless",
      label: "Vocal (wireless)",
      group: "vocs",
      inputs: [{ key: "voc_input", label: "Vocal" }],
    },
  };

  it("takes the first ref of the role, not the union of all of them", () => {
    // Union would hand a guitarist with no preset a mic, a DI, a stereo pair
    // and an acoustic all at once, and would merge mutually exclusive bass
    // presets that `selectBassMainPreset` exists to keep apart.
    expect(getGroupDefaultPreset("bass", catalog).inputs.map((i) => i.key)).toEqual([
      "el_bass_xlr_amp",
    ]);
    expect(getGroupDefaultPreset("guitar", catalog).inputs.map((i) => i.key)).toEqual([
      "el_guitar_mic",
    ]);
    expect(getGroupDefaultPreset("keys", catalog).inputs.map((i) => i.key)).toEqual([
      "keys_l",
      "keys_r",
    ]);
    expect(getGroupDefaultPreset("vocs", catalog).inputs.map((i) => i.key)).toEqual([
      "voc_input",
    ]);
  });

  it("stamps the preset's group onto every derived channel", () => {
    // Preset channels never carry `group` themselves; without this the
    // derived channel falls into the M2 trap on both prefix copies.
    expect(getGroupDefaultPreset("guitar", catalog).inputs.every((i) => i.group === "guitar")).toBe(true);
    expect(getGroupDefaultPreset("keys", catalog).inputs.every((i) => i.group === "keys")).toBe(true);
  });

  it("keeps the default drum kit for drums", () => {
    const inputs = getGroupDefaultPreset("drums", catalog).inputs;

    expect(inputs.length).toBeGreaterThan(0);
    expect(inputs.every((input) => input.key.startsWith("dr_"))).toBe(true);
  });

  it("returns no inputs for talkback", () => {
    // The talkback preset is a `talkback_type` template keyed
    // `tb_{ownerKey}`, has no `PRESET_REFS` entry and no lineup slot; the row
    // is built by `buildPdfTalkback` from overlays.
    expect(getGroupDefaultPreset("talkback", catalog).inputs).toEqual([]);
  });

  it("returns no inputs when the catalog is empty", () => {
    expect(getGroupDefaultPreset("guitar", {}).inputs).toEqual([]);
    expect(getGroupDefaultPreset("bass").inputs).toEqual([]);
  });

  it("keeps wedge_foh as the fallback monitor for every role", () => {
    for (const role of ["drums", "bass", "guitar", "keys", "vocs", "talkback"] as const) {
      expect(getGroupDefaultPreset(role, catalog).monitoring.monitorRef).toBe("wedge_foh");
    }
  });
});
```

- [ ] **Krok 3: Spusť testy a ověř, že padají**

Run: `npx vitest run packages/desktop/src/app/pages/shared/setupConstants.test.ts`
Expected: FAIL — `getGroupDefaultPreset` dnes bere jen jeden argument a vrací `gtr_mic`/`gtr_di`, `voc_lead`/`voc_back`, `talkback`.

- [ ] **Krok 4: Přepiš `getGroupDefaultPreset`**

V `packages/desktop/src/app/pages/shared/setupConstants.ts` nahraď `:248-253`. `GROUP_INPUT_LIBRARY` v tomhle tasku **zůstává** — maže ho až Task 12 spolu s pickerem, jinak by picker neměl z čeho brát.

```ts
/**
 * Výchozí výbava hudebníka, který nemá jediný preset (F5d R1). Bere `inputs`
 * **prvního** refu role z `PRESET_REFS`, ne union: union by kytaristovi dal
 * mikrofon, DI, stereo pár i akustiku současně a u basy by slil dva presety
 * s `presetRole: "primary"`, které `selectBassMainPreset` schválně rozlišuje.
 * `PRESET_REFS` je táž konstanta, ze které čte `buildSetupFieldCatalog`, takže
 * pořadí refů je jedno rozhodnutí pro fallback i pro katalogy polí.
 *
 * `group` se doplňuje z `preset.group` — kanály v presetech ho nenesou vůbec
 * a bez něj by odvozený kanál spadl do pasti M2 na obou prefixových kopiích.
 *
 * `drums` staví výchozí kit (jediná role, jejíž fallback si klíče nevymýšlel).
 * `talkback` vrací prázdno: jeho preset je `talkback_type` se šablonou
 * `tb_{ownerKey}`, v `PRESET_REFS` ref nemá, řádek staví `buildPdfTalkback`
 * z overlays a v lineupu nemá slot, takže se sem v produkci nedojde.
 *
 * Prázdný katalog dá prázdné `inputs` — táž hodnota, na kterou dnes padá
 * `createDefaultMusicianPreset`, ne nový režim selhání.
 */
export function getGroupDefaultPreset(
  group: Group,
  presetCatalog: Record<string, Preset> | Record<string, PresetEntity> = {},
): MusicianSetupPreset {
  const monitoring = { monitorRef: "wedge_foh" };

  if (group === "drums") {
    return {
      inputs: resolveDrumInputs(createDefaultDrumDefinition()).map((item) => ({ ...item })),
      monitoring,
    };
  }

  const refs = PRESET_REFS[group as keyof typeof PRESET_REFS];
  const firstRef = refs?.[0];
  if (!firstRef) return { inputs: [], monitoring };

  const preset = getPresetEntityByRef(presetCatalog, firstRef);
  if (preset?.type !== "preset") return { inputs: [], monitoring };

  return {
    inputs: preset.inputs.map((item) => ({ ...item, group: preset.group })),
    monitoring,
  };
}
```

`getPresetEntityByRef` (`:138-144`) už v souboru je a `resolvePresetIdAlias` uvnitř sebe volá — nepiš rozlišení aliasu znovu. `PRESET_REFS` je dnes `const` bez `export`; nechej ho tak, funkce je ve stejném souboru.

- [ ] **Krok 5: Prodrátuj katalog do obou volajících**

V `packages/desktop/src/app/domain/setup/resolveSetupForSlot.ts` na `:39` a `:59` nahraď `bandDefaults: getGroupDefaultPreset(role)` za `bandDefaults: getGroupDefaultPreset(role, presetCatalog)`. Obě funkce `presetCatalog` v args už mají, takže se jen předá.

- [ ] **Krok 6: Oprav `resolveSetupForSlot.test.ts`**

Nahraď `EMPTY_CATALOG` v testech, které očekávají `el_bass_xlr_amp`, katalogem, který ten preset opravdu obsahuje. Nahoru k `EMPTY_CATALOG` (`:12`) přidej:

```ts
/** The single ref `PRESET_REFS.bass[0]` points at — the band default for bass (F5d R1). */
const BASS_DEFAULT_CATALOG: Record<string, PresetEntity> = {
  el_bass_xlr_amp: {
    type: "preset",
    id: "el_bass_xlr_amp",
    label: "Electric bass guitar",
    group: "bass",
    inputs: [
      { key: "el_bass_xlr_amp", label: "Electric bass guitar", note: "XLR out from amp" },
    ],
  },
};
```

V testu `falls back to the band default when there is no setup data` (`:30-49`) změň `presetCatalog: EMPTY_CATALOG` na `presetCatalog: BASS_DEFAULT_CATALOG` a komentář na `:41-43` přepiš (dnes se odvolává na `GROUP_INPUT_LIBRARY`, které v Tasku 12 zmizí):

```ts
    // Band default pro `bass` je `inputs` prvního refu role z `PRESET_REFS`
    // (`el_bass_xlr_amp`). Kdyby fallback spadl jinam (na prázdný preset nebo
    // na jinou roli), tohle to odhalí — samotné `toBeInstanceOf(Array)` ne.
```

Totéž v testu `returns the default setup when there is no patch` (`:72-83`).

Přidej nový test hned za ten první:

```ts
  it("returns no inputs when the preset catalog has not loaded", () => {
    // Same value `createDefaultMusicianPreset` already falls back to — not a
    // new failure mode (F5d R1).
    const preset = resolveMusicianDefaultPreset({
      role: "bass",
      musicianId: "m1",
      setupData: null,
      presetCatalog: EMPTY_CATALOG,
    });

    expect(preset.inputs).toEqual([]);
    expect(preset.monitoring.monitorRef).toBe("wedge_foh");
  });
```

Zbylé testy v souboru (`prefers role scoped defaults`, `applies a remove patch`, `applies a label update patch`) staví `inputs` přes `setupDataWith`, takže na katalogu nezávisí — **nesahej na ně**.

- [ ] **Krok 7: Spusť testy a ověř, že prošly**

```bash
npx vitest run packages/desktop/src/app/pages/shared/setupConstants.test.ts
npx vitest run packages/desktop/src/app/domain/setup/
```

Expected: PASS.

- [ ] **Krok 8: Ověř, že se nic jiného nerozbilo**

```bash
npm test 2>&1 | tail -5
npx tsc -p packages/desktop/tsconfig.json --noEmit 2>&1 | grep -c "error TS"
npx vitest run src/domain/pipeline/buildDocument.pdfRegression.test.ts
```

Expected: `2 failed | 1119 passed (1121)` (1114 po Tasku 2 + 6 nových v `setupConstants.test.ts` + 1 nový v `resolveSetupForSlot.test.ts`). tsc `10`. `pdfRegression` zelený s nedotčenými očekáváními.

- [ ] **Krok 9: Ověř, že `GROUP_INPUT_LIBRARY` má už jen jednoho konzumenta**

```bash
grep -rn "GROUP_INPUT_LIBRARY" --include=*.ts --include=*.tsx src packages/desktop/src
```

Expected: právě tři výskyty — definice `setupConstants.ts:47`, komentáře a použití v `ProjectInputsPage.tsx:731,756,769`, a komentáře v `resolveInputRowEditability.ts:41` / `resolveInputRowEditability.test.ts:65`. **Žádný výskyt v `setupConstants.ts` mimo samotnou definici** — pokud tam zbyl, `getGroupDefaultPreset` na katalogu pořád stojí a Task 12 by ho nemohl smazat.

- [ ] **Krok 10: Ověř lint**

Recept z Global Constraints pro `setupConstants.ts`, `setupConstants.test.ts`, `resolveSetupForSlot.ts`, `resolveSetupForSlot.test.ts`, na HEAD i BASE. Expected: delta 0.

- [ ] **Krok 11: Commit**

```bash
git add packages/desktop/src/app/pages/shared/setupConstants.ts \
        packages/desktop/src/app/pages/shared/setupConstants.test.ts \
        packages/desktop/src/app/domain/setup/resolveSetupForSlot.ts \
        packages/desktop/src/app/domain/setup/resolveSetupForSlot.test.ts
git commit -m "fix(setup): derive the no-preset fallback from the first PRESET_REFS entry of the role"
```

---
## KROK B — monitoring bicích a potvrzení zúžení (R2, R3)

Jediné skutečné rozšíření domény v této vlně je odemčení monitoringu bicích. `add`/`removeKeys` u bicích se **nerozšiřuje** — potvrzuje se zúžení z fixu Tasku 12c.

### Task 4: `resolveEffectiveProjectSetup` — monitoring bicích se odemkne a nevalidní ref hodí chybu

**Files:**
- Modify: `src/domain/setup/resolveEffectiveProjectSetup.ts:81-95` (bicí větev)
- Test: `src/domain/setup/resolveEffectiveProjectSetup.test.ts:441-489` (existující test se **obrací**) + nové testy

**Interfaces:**
- Consumes: nic z kroku A.
- Produces: `resolveEffectiveProjectSetup(...)` — signatura beze změny. Nově **hází** `Error: Missing monitor preset reference "…" while resolving monitoring override for musician "…" (role: drums).`, když bicí slot nese nevalidní `presetOverride.monitoring.monitorRef`. Task 5 na tom staví kontraktní test.

**Kontext, který nesmíš přehlédnout**

Dnes drums dostávají monitoring natvrdo z `defaultPreset` a `patch.monitoring` se u nich zahazuje. Kód (`:81-95`), včetně komentáře, který se maže:

```ts
        // Monitoring override reverted (fix round 1, Important 3): symmetry
        // with bass/guitar/keys wasn't asked for: no existing screen writes
        // a monitoring override on a drums slot, and `assertMonitorPresetRef`
        // added a throw path that didn't exist before task 12c. A drums
        // slot's monitoring stays exactly what it was: the musician's own
        // default.
        byMusicianId.set(musicianId, {
          inputs: effectiveDrumInputs,
          monitoring: defaultPreset.monitoring,
        });
        continue;
```

**Rozhodnutí R3 je potvrzené člověkem: padá, nedegraduje.** Nevalidní `monitorRef` na bicím slotu hodí stejnou chybu jako na basovém — jedna cesta kódu, ne dvě. Důvody: (1) `CLAUDE.md` — „Errors must be handled explicitly; never silently swallow exceptions"; (2) jediná cesta, jak `monitorRef` vzniká, je select nad katalogem monitorů, takže nevalidní ref znamená ručně editovaná nebo poškozená data, ne uživatelský stav; degradace na výchozí mix by vytiskla monitorovou tabulku, kterou nikdo nenastavil, a nikde by to neřekla; (3) symetrie zjednodušuje bicí větev — po odemčení je rozdíl proti ostatním rolím jen ve zdroji `inputs`.

**Důsledek, který se hlásí jako riziko:** projekt s poškozeným refem na bicím slotu se přestane exportovat. Chyba padá uvnitř `buildDocument`, takže `02` i `04` ji ukážou jako hlášku, ne jako bílou obrazovku (`ProjectInputsPage.tsx:494-518` chybu chytá a nese jako hodnotu).

**Co se NEMĚNÍ.** Zúžení `inputs` na `update` (`:76-80`) zůstává přesně jak je — `add` na klíč z `drumDefinition` by narazil na collision guard `applyPresetOverride` (`src/domain/rules/presetOverride.ts:174-176`) a spadl na `Error: Preset override collision for input key "dr_tom_3"`. To byla Critical 1 z 12c. Chování zůstává tiché ignorování, ne výjimka.

**Vedlejší efekt z Tasku 19a, který se má ověřit:** odznak `• Modified` u monitoringu bicího slotu se mohl zobrazit i u skrytého pole. Odemčením se pole přestane skrývat, takže odznak začne odpovídat skutečnosti. Ověřuje to Task 5, ne tenhle.

- [ ] **Krok 1: Obrať existující test**

V `src/domain/setup/resolveEffectiveProjectSetup.test.ts` nahraď celý test `does not apply a drum slot's monitoring override (fix round 1, Important 3)` (`:441-489`). Fixtury (`band`, `drummer`) zůstávají; mění se projekt, `getPresetByRef` a aserce:

```ts
  it("applies a drum slot's monitoring override, same as bass (F5d R3)", () => {
    const band: Band = {
      id: "band",
      name: "Band",
      bandLeader: "dr-1",
      defaultLineup: { drums: ["dr-1"] },
      defaultOverlays: { leadVocals: [], backVocals: [] },
    };
    const drummer: Musician = {
      id: "dr-1",
      firstName: "Dr",
      lastName: "One",
      group: "drums",
      presets: [{ kind: "monitor", ref: "wedge_foh" }],
    };
    const project: Project = {
      id: "p-drum-monitoring-override",
      bandRef: "band",
      purpose: "event",
      documentDate: "2026-01-01",
      lineup: {
        drums: {
          musicianId: "dr-1",
          presetOverride: {
            monitoring: { monitorRef: "iem_stereo_wired_foh", additionalWedgeCount: 2 },
          },
        },
      },
    };

    const resolved = resolveEffectiveProjectSetup({
      project,
      band,
      bandLeaderId: "dr-1",
      getMusicianById: () => drummer,
      getPresetByRef: (ref) => {
        if (ref === "wedge_foh")
          return { type: "monitor", id: "wedge_foh", label: "Wedge", kind: "wedge", supplier: "foh" };
        if (ref === "iem_stereo_wired_foh")
          return {
            type: "monitor",
            id: "iem_stereo_wired_foh",
            label: "IEM STEREO wired",
            kind: "iem",
            supplier: "foh",
            mode: "stereo",
            wireless: false,
          };
        return undefined;
      },
    });

    const drumSetup = resolved.byMusicianId.get("dr-1");
    expect(drumSetup?.monitoring.monitorRef).toBe("iem_stereo_wired_foh");
    expect(drumSetup?.monitoring.additionalWedgeCount).toBe(2);
    // The inputs stay drum-definition-built; only monitoring opened up.
    expect(drumSetup?.inputs.every((input) => input.key.startsWith("dr_"))).toBe(true);
  });

  it("throws on an invalid monitorRef on a drums slot — falls, does not degrade (F5d R3)", () => {
    // Human-confirmed: the only way a `monitorRef` is written is a select over
    // the monitor catalog, so an invalid one means hand-edited or corrupted
    // data. Degrading to the default mix would print a monitor table nobody
    // configured and say nothing about it.
    const band: Band = {
      id: "band",
      name: "Band",
      bandLeader: "dr-1",
      defaultLineup: { drums: ["dr-1"] },
      defaultOverlays: { leadVocals: [], backVocals: [] },
    };
    const drummer: Musician = {
      id: "dr-1",
      firstName: "Dr",
      lastName: "One",
      group: "drums",
      presets: [{ kind: "monitor", ref: "wedge_foh" }],
    };
    const project: Project = {
      id: "p-drum-monitoring-broken",
      bandRef: "band",
      purpose: "event",
      documentDate: "2026-01-01",
      lineup: {
        drums: {
          musicianId: "dr-1",
          presetOverride: { monitoring: { monitorRef: "does_not_exist" } },
        },
      },
    };

    expect(() =>
      resolveEffectiveProjectSetup({
        project,
        band,
        bandLeaderId: "dr-1",
        getMusicianById: () => drummer,
        getPresetByRef: (ref) =>
          ref === "wedge_foh"
            ? { type: "monitor", id: "wedge_foh", label: "Wedge", kind: "wedge", supplier: "foh" }
            : undefined,
      }),
    ).toThrow(/Missing monitor preset reference "does_not_exist"/);
  });
```

- [ ] **Krok 2: Spusť testy a ověř, že padají**

Run: `npx vitest run src/domain/setup/resolveEffectiveProjectSetup.test.ts`
Expected: FAIL — první nový test dostane `wedge_foh` místo `iem_stereo_wired_foh`, druhý nehodí nic.

- [ ] **Krok 3: Uprav bicí větev**

V `src/domain/setup/resolveEffectiveProjectSetup.ts` nahraď blok `:81-95` (od komentáře `// Monitoring override reverted` po `continue;`):

```ts
        // F5d R3: monitoring bicího slotu se srovnal s basou, kytarou a
        // klávesami. `patch.monitoring` se aplikuje a nevalidní `monitorRef`
        // hodí stejnou chybu jako u ostatních rolí — jedna cesta kódu, ne
        // dvě. Degradace na výchozí mix by vytiskla monitorovou tabulku,
        // kterou nikdo nenastavil, a nikde by to neřekla. `inputs` zůstávají
        // zúžené na `update` (viz komentář výše, R2): jejich zdrojem je
        // `drumDefinition`, ne preset.
        const effectiveDrumMonitoring = drumPatch?.monitoring?.monitorRef
          ? {
              monitorRef: drumPatch.monitoring.monitorRef,
              ...(typeof drumPatch.monitoring.additionalWedgeCount === "number"
                ? { additionalWedgeCount: drumPatch.monitoring.additionalWedgeCount }
                : {}),
            }
          : defaultPreset.monitoring;
        if (drumPatch?.monitoring?.monitorRef) {
          assertMonitorPresetRef({
            ref: drumPatch.monitoring.monitorRef,
            role,
            musicianId,
            getPresetByRef: args.getPresetByRef,
          });
        }
        byMusicianId.set(musicianId, {
          inputs: effectiveDrumInputs,
          monitoring: effectiveDrumMonitoring,
        });
        continue;
```

`drumPatch` je už deklarovaný o pár řádků výš (`const drumPatch = state.presetOverrideByMusicianId.get(musicianId);`) — nedeklaruj ho znovu.

**Nepoužívej `applyPresetOverride` na monitoring bicích.** Ta cesta by přepsala i `inputs`, které jsou tady záměrně sestavené jinak. Skládej `monitoring` ručně, jak je výše — je to týž tvar, jaký normalizuje `resolveMusicianDefaultSetupForRole` (`setupConstants.ts:156-175`).

- [ ] **Krok 4: Spusť testy a ověř, že prošly**

Run: `npx vitest run src/domain/setup/resolveEffectiveProjectSetup.test.ts`
Expected: PASS, včetně testu na `add` bez collision (`:363-440`) — ten musí zůstat zelený, protože `inputs` se nezměnily.

- [ ] **Krok 5: Ověř, že se nic jiného nerozbilo**

```bash
npm test 2>&1 | tail -5
npx tsc -p packages/desktop/tsconfig.json --noEmit 2>&1 | grep -c "error TS"
npx vitest run src/domain/pipeline/buildDocument.pdfRegression.test.ts
```

Expected: `2 failed | 1120 passed (1122)` (1121 po Tasku 3 + 1 nový; existující test se nahradil, ne přidal). tsc `10`. **`pdfRegression` musí být zelený s nedotčenými očekáváními** — jeho fixtury mají `presetOverride.monitoring` jen na basovém slotu, takže se ho odemčení bicích nedotýká. Pokud padne, zastav se a eskaluj.

- [ ] **Krok 6: Ověř nad reálnými daty, že žádný uložený projekt novou throw path netrefí**

Nový throw path může shodit export existujícího projektu. Změř to, nepředpokládej:

```bash
node --input-type=module -e "
import {readdirSync,readFileSync,statSync} from 'node:fs';
const root=process.env.APPDATA+'/StagePilot';
const hits=[];
(function walk(d){for(const e of readdirSync(d)){const p=d+'/'+e;
  if(statSync(p).isDirectory()) walk(p);
  else if(e.endsWith('.json')){
    let j; try{ j=JSON.parse(readFileSync(p,'utf8')); }catch{ return; }
    const drums=j?.lineup?.drums; if(!drums) return;
    for(const s of [drums].flat()){
      const ref=s?.presetOverride?.monitoring?.monitorRef;
      if(ref) hits.push([p,ref]);
    }
  }}})(root);
console.log(hits.length?hits:'no drums monitoring override in stored data');
"
```

Expected podle M3: `no drums monitoring override in stored data`. **Kdyby něco vypsalo, ověř, že vypsaný ref existuje v `data/assets/presets/monitors/` — pokud ne, hlas to jako blokující nález, protože ten projekt se po tomhle tasku přestane exportovat.**

- [ ] **Krok 7: Ověř lint**

Recept z Global Constraints pro `resolveEffectiveProjectSetup.ts` a `…test.ts`, na HEAD i BASE. Expected: delta 0.

- [ ] **Krok 8: Commit**

```bash
git add src/domain/setup/resolveEffectiveProjectSetup.ts src/domain/setup/resolveEffectiveProjectSetup.test.ts
git commit -m "feat(setup): apply monitoring overrides on drums slots and validate the monitor ref"
```

---
### Task 5: Brána `drums-not-supported` v `resolveMonitorRowEditability` padá + kontraktní test 1

**Files:**
- Modify: `packages/desktop/src/app/domain/inputs/resolveMonitorRowEditability.ts`
- Test: `packages/desktop/src/app/domain/inputs/resolveMonitorRowEditability.test.ts`
- Create: `packages/desktop/src/app/domain/inputs/uiDocumentContract.test.ts`

**Interfaces:**
- Consumes: `resolveEffectiveProjectSetup` s odemčeným monitoringem bicích z Tasku 4.
- Produces: `MonitorRowEditability = { canEdit: true } | { canEdit: false; reason: "no-slot" }`. **Varianta `"drums-not-supported"` z typu mizí.** Konzumenti: `MonitorRowInspector.tsx`, `ProjectInputsPage.tsx`.

**Kontext, který nesmíš přehlédnout**

`resolveMonitorRowEditability` (celý soubor, 37 řádků) dnes vrací `drums-not-supported`, protože doména `patch.monitoring` u bicích zahazovala. Task 4 to změnil, takže brána ztratila důvod. Zůstává jen `no-slot`.

**`resolveInputRowEditability` se NEMĚNÍ.** Brána `drums-not-supported` **tam zůstává** (R2) a `overlay-not-supported` taky (R7). Odemyká se výhradně monitorová sestra. Nepleť si ty dva soubory — mají skoro stejná jména a skoro stejný typ.

**Kontraktní test 1** je první položka nové vrstvy z R8. Vzor: `buildInputEditorRows.test.ts:845` („never reports a drums slot's channel as disabled, even with a removeKeys patch the document ignores"). Tenhle soubor bude do konce fáze růst na sedm testů — pojmenuj `describe` bloky podle bran, ne podle tasků.

**Konzument brány, který se musí uklidit.** `MonitorRowInspector.tsx` větví na `reason === "drums-not-supported"` a ukazuje hlášku. Najdi ji a smaž — s ní i případný test v `MonitorRowInspector.test.tsx`, který ji ověřuje. Nesnaž se ji nahradit jinou hláškou; pole je nově prostě editovatelné.

**Zaparkovaný minor z Tasku 19a.** Odznak `• Modified` u monitoringu bicího slotu se mohl zobrazit i u skrytého pole. Odemčením se pole přestane skrývat, takže odznak začne odpovídat skutečnosti. Krok 6 to ověřuje.

- [ ] **Krok 1: Zmapuj konzumenty brány**

```bash
cd /c/Users/mkrecmer/dev/stagepilot
grep -rn "drums-not-supported" --include=*.ts --include=*.tsx src packages/desktop/src
```

Expected: výskyty v `resolveMonitorRowEditability.ts` (+ test), `resolveInputRowEditability.ts` (+ test), `MonitorRowInspector.tsx` (+ případný test), `InputRowInspector.tsx`. **Ruš jen ty, které vedou přes `resolveMonitorRowEditability`.** Zapiš si seznam, ať víš, co v kroku 7 kontrolovat.

- [ ] **Krok 2: Uprav testy `resolveMonitorRowEditability`**

Nahraď v `resolveMonitorRowEditability.test.ts` test `refuses drums even with a valid slot — the document ignores the patch (task 12c fix round 1)`:

```ts
  it("allows a drums slot now that the document reads its monitoring override (F5d R3)", () => {
    expect(
      resolveMonitorRowEditability({ slotKey: "drums:0", ownerRole: "drums" }),
    ).toEqual({ canEdit: true });
  });
```

V prvním testu (`allows editing a bass/guitar/keys/vocs slot`) přidej `"drums"` do pole rolí a přejmenuj ho na `allows editing any slot that exists in the lineup`. Test `reports no-slot when both conditions hold` přejmenuj na `refuses a drums owner with no lineup slot` — `no-slot` u bicích platí dál a je to jediná zbylá podmínka.

- [ ] **Krok 3: Napiš kontraktní test 1**

Vytvoř `packages/desktop/src/app/domain/inputs/uiDocumentContract.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { DataRepository } from "../../../../../../src/infra/fs/repo";
import type {
  Band,
  Musician,
  NotesTemplate,
  PresetEntity,
  Project,
} from "../../../../../../src/domain/model/types";
import { buildDocument } from "../../../../../../src/domain/pipeline/buildDocument";
import { resolveMonitorRowEditability } from "./resolveMonitorRowEditability";

/**
 * Kontraktní vrstva UI ↔ dokument (F5d R8).
 *
 * Vzorec „UI drží stav, který doména nemá" se ve F5c objevil sedmkrát a ani
 * jednou nešlo o rozbité zavěšení handleru — vždy o rozjezd dvou zdrojů
 * pravdy. UI-preview `resolveEffectiveMusicianSetup` aplikuje patch vždy a bez
 * ohledu na roli; doména ho u některých řezů zahodí. Test v jsdom by viděl, že
 * se UI změnilo správně, protože UI se opravdu změní správně. Špatný je
 * dokument, a ten v DOM není.
 *
 * Každý test tady proto tvrdí DVĚ věci nad TÝMIŽ daty: co říká UI (`canEdit`,
 * přeškrtnutý řádek, `DEVIATIONS N`) a co nad nimi skutečně vyprodukuje
 * `buildDocument`. Jeden test na každou bránu, kterou fáze otevírá nebo
 * zavírá. Čistý node test, žádné DOM.
 */

const NOTES: NotesTemplate = { id: "notes_default_cs", lang: "cs", inputs: [], monitors: [] };

const MONITORS: Record<string, PresetEntity> = {
  wedge_foh: { type: "monitor", id: "wedge_foh", label: "Wedge", kind: "wedge", supplier: "foh" },
  iem_stereo_wired_foh: {
    type: "monitor",
    id: "iem_stereo_wired_foh",
    label: "IEM STEREO wired",
    kind: "iem",
    supplier: "foh",
    mode: "stereo",
    wireless: false,
  },
  talkback: {
    type: "talkback_type",
    id: "talkback",
    label: "Talkback",
    group: "talkback",
    input: { key: "tb_{ownerKey}", label: "Talkback ({ownerLabel})" },
  },
};

/** Minimal repo over an explicit preset map — every test states its own catalog. */
function makeRepo(args: {
  band: Band;
  musicians: Record<string, Musician>;
  project: Project;
  presets?: Record<string, PresetEntity>;
}): DataRepository {
  const presets = { ...MONITORS, ...(args.presets ?? {}) };
  return {
    getBand: () => args.band,
    getMusician: (id: string) => {
      const musician = args.musicians[id];
      if (!musician) throw new Error(`unknown musician ${id}`);
      return musician;
    },
    getProject: () => args.project,
    getPreset: (id: string) => {
      const preset = presets[id];
      if (!preset) throw new Error(`unknown preset ${id}`);
      return preset;
    },
    getNotesTemplate: () => NOTES,
  };
}

describe("contract: drums monitoring (F5d R3)", () => {
  it("UI reports canEdit and the document prints that monitor mix", () => {
    const band: Band = {
      id: "band",
      name: "Band",
      bandLeader: "dr-1",
      defaultLineup: { drums: ["dr-1"] },
      defaultOverlays: { leadVocals: [], backVocals: [] },
    };
    const drummer: Musician = {
      id: "dr-1",
      firstName: "Dr",
      lastName: "One",
      group: "drums",
      presets: [{ kind: "monitor", ref: "wedge_foh" }],
    };
    const project: Project = {
      id: "p-drums-monitoring",
      bandRef: "band",
      purpose: "event",
      documentDate: "2026-01-01",
      lineup: {
        drums: {
          musicianId: "dr-1",
          presetOverride: { monitoring: { monitorRef: "iem_stereo_wired_foh" } },
        },
      },
    };

    // What the UI claims.
    expect(
      resolveMonitorRowEditability({ slotKey: "drums:0", ownerRole: "drums" }),
    ).toEqual({ canEdit: true });

    // What the document actually produces over the same data.
    const vm = buildDocument(project, makeRepo({ band, musicians: { "dr-1": drummer }, project }));
    const drumsMonitorRow = vm.monitorTableRows.find((row) => row.ownerMusicianId === "dr-1");
    expect(drumsMonitorRow?.note).toContain("IEM STEREO wired");
  });
});
```

Cestu k `DataRepository` ověř — z `app/domain/inputs/` je to `../../../../../../src/infra/fs/repo`; stejná hloubka jako u `src/domain/model/groups` v sousedních souborech. Kdyby `PresetEntity` nešel použít pro monitor literály, koukni, jak to řeší `buildDocument.setupOverride.test.ts:86-95` (inline objekty bez anotace).

- [ ] **Krok 4: Spusť testy a ověř, že padají**

```bash
npx vitest run packages/desktop/src/app/domain/inputs/resolveMonitorRowEditability.test.ts
npx vitest run packages/desktop/src/app/domain/inputs/uiDocumentContract.test.ts
```

Expected: FAIL v obou — brána dnes vrací `drums-not-supported`.

- [ ] **Krok 5: Odemkni bránu**

V `resolveMonitorRowEditability.ts` nahraď celý soubor:

```ts
import type { Group } from "../../../../../../src/domain/model/groups";

/**
 * Co? Jestli lze editovat monitoring vybraného řádku sekce MONITORS, a pokud
 * ne, proč — panel potřebuje obojí, aby needitovatelný stav vysvětlil (task
 * 12c precedens pro `InputRowInspector`'s `labelIsCanonical`), ne jen tiše
 * zakázal.
 *
 * Zbývá jediný důvod: `no-slot`, tedy vlastník monitoru nemá slot v
 * `project.lineup`, kam by šel patch zapsat (zrcadlí `InputRowInspector`'s
 * `canEditSlot`).
 *
 * Brána `drums-not-supported` padla s F5d R3 — `resolveEffectiveProjectSetup`
 * u role `drums` `presetOverride.monitoring` nově čte a nevalidní `monitorRef`
 * na bicím slotu hodí stejnou chybu jako na basovém. Bicí slot je tím u
 * monitoringu srovnaný s ostatními rolemi a UI nemá co zavírat. Vstupní sestra
 * `resolveInputRowEditability` svoji bránu `drums-not-supported` naopak
 * **drží** (R2): bicí kanály staví `drumDefinition`, ne preset, takže
 * `add`/`removeKeys` do dokumentu dál nedojede.
 */
export type MonitorRowEditability =
  | { canEdit: true }
  | { canEdit: false; reason: "no-slot" };

export function resolveMonitorRowEditability(args: {
  slotKey: string;
  ownerRole: Group;
}): MonitorRowEditability {
  void args.ownerRole;
  if (!args.slotKey) return { canEdit: false, reason: "no-slot" };
  return { canEdit: true };
}
```

`ownerRole` zůstává v signatuře a je zneškodněný přes `void` — volající ho posílají a odebrání parametru by bylo zbytečné rozšíření diffu do `MonitorRowInspector.tsx` i `ProjectInputsPage.tsx`. Kdyby biome hlásil nepoužitý parametr, `void args.ownerRole;` ho umlčí; stejný vzor používá `resolveEffectivePresetsForProject.ts:21-24`.

- [ ] **Krok 6: Ukliď konzumenta hlášky**

V `MonitorRowInspector.tsx` smaž větev na `reason === "drums-not-supported"` a text, který k ní patří. Zkontroluj, že po smazání zbylá větev pokrývá `no-slot` a že se typ zúžení nerozbil (`reason` má nově jedinou hodnotu, takže případný `switch`/ternár se zjednoduší). Smaž i test, který tu hlášku ověřoval, pokud existuje.

Zkontroluj `• Modified` u monitoringu bicího slotu (zaparkovaný minor z Tasku 19a): pole se nově neskrývá, takže odznak má odpovídat skutečnosti. Ověř čtením `MonitorRowInspector.tsx` — jestli se `diffMeta.monitoring.*.origin` vyhodnocuje nezávisle na tom, jestli je pole vidět, je to v pořádku a nic se nemění. Nález zapiš do reportu tasku.

- [ ] **Krok 7: Spusť testy a ověř, že prošly**

```bash
npx vitest run packages/desktop/src/app/domain/inputs/
npx vitest run packages/desktop/src/app/components/inputs/
grep -rn "drums-not-supported" --include=*.ts --include=*.tsx packages/desktop/src
```

Expected: PASS. Grep vrátí **jen** výskyty vedoucí přes `resolveInputRowEditability` (`resolveInputRowEditability.ts`, jeho test, `InputRowInspector.tsx`) — žádný v monitorové cestě.

- [ ] **Krok 8: Ověř, že se nic jiného nerozbilo**

```bash
npm test 2>&1 | tail -5
npx tsc -p packages/desktop/tsconfig.json --noEmit 2>&1 | grep -c "error TS"
npx vitest run src/domain/pipeline/buildDocument.pdfRegression.test.ts
```

Expected: `2 failed | 1121 passed (1123)` plus/minus podle toho, kolik testů `MonitorRowInspector` smazal. **Rozdíl v počtu vysvětli v reportu položku po položce** — „ubyl 1 test, protože hláška, kterou ověřoval, přestala existovat" je platné, „ubyly 3 testy" bez vysvětlení ne. tsc `10`. `pdfRegression` zelený s nedotčenými očekáváními.

- [ ] **Krok 9: Ověř lint**

Recept z Global Constraints pro `resolveMonitorRowEditability.ts`, `…test.ts`, `uiDocumentContract.test.ts`, `MonitorRowInspector.tsx` (+ jeho test), na HEAD i BASE. Expected: delta 0. Nový soubor porovnávej jen na HEAD a hlas absolutní počet nálezů (musí být 0).

- [ ] **Krok 10: Commit**

```bash
git add packages/desktop/src/app/domain/inputs/resolveMonitorRowEditability.ts \
        packages/desktop/src/app/domain/inputs/resolveMonitorRowEditability.test.ts \
        packages/desktop/src/app/domain/inputs/uiDocumentContract.test.ts \
        packages/desktop/src/app/components/inputs/MonitorRowInspector.tsx
git commit -m "feat(inputs): open monitoring editing on drums rows now that the document reads it"
```

---
### Task 6: Kontraktní testy 2 a 3 — brány, které fáze potvrzuje zavřené

**Files:**
- Modify: `packages/desktop/src/app/domain/inputs/uiDocumentContract.test.ts` (z Tasku 5)

**Interfaces:**
- Consumes: `makeRepo`, `NOTES`, `MONITORS` z Tasku 5.
- Produces: nic — task je **jen testy, bez produkční změny**.

**Proč task bez produkční změny existuje**

R2 a O2 jsou rozhodnutí, která fáze **potvrzuje**, ne mění. Zůstávají tím bez jediného zámku: kdyby někdo v navazující fázi zúžení zrušil, nic by nespadlo, dokud by se to neprojevilo v PDF u zákazníka. R8 z toho dělá systematickou vrstvu — brána, kterou fáze vědomě drží zavřenou, dostane kontraktní test stejně jako ta, kterou otevírá.

Task je zároveň nejlevnější způsob, jak před krokem C změřit, že premisy O2 a R2 pořád platí. Kdyby některý z těch dvou testů **prošel hned napoprvé jinak, než plán očekává**, znamená to, že se doména mezitím pohnula a krok C stojí na neplatném podkladu.

**Kontraktní test 2 — bicí `add`/`removeKeys`.** UI nenabízí `Remove channel`/`Restore channel` (`resolveInputRowEditability` vrací `drums-not-supported`) **a** `buildDocument` `add`/`removeKeys` na bicím slotu ignoruje. Bez toho gatu by `Remove channel` řádek přeškrtl, zatímco dokument by ho dál tiskl — aktivní falešné potvrzení úspěchu.

**Kontraktní test 3 — vokální a talkback řádky.** UI hlásí `overlay-not-supported` **a** patch je v dokumentu no-op. Ověřeno na šesti variantách patche (`voc_lead_1`, `voc_back_bass_1`, `tb_bass`, `voc_input`, `remove` i `removeKeys`) — všechny nulový diff. Mechanismus: `narrowPatchToUpdatesFor` (`buildDocument.ts:216-222`) propustí jen `update` a jen na klíče, které v řezu existují.

- [ ] **Krok 1: Napiš kontraktní test 2**

Do `uiDocumentContract.test.ts` přidej import `resolveInputRowEditability` a nový `describe`:

```ts
describe("contract: drums channels stay patch-proof (F5d R2)", () => {
  it("UI refuses remove/restore and the document ignores add and removeKeys", () => {
    const band: Band = {
      id: "band",
      name: "Band",
      bandLeader: "dr-1",
      defaultLineup: { drums: ["dr-1"] },
      defaultOverlays: { leadVocals: [], backVocals: [] },
    };
    const drummer: Musician = {
      id: "dr-1",
      firstName: "Dr",
      lastName: "One",
      group: "drums",
      presets: [{ kind: "monitor", ref: "wedge_foh" }],
    };

    const clean: Project = {
      id: "p-drums-clean",
      bandRef: "band",
      purpose: "event",
      documentDate: "2026-01-01",
      lineup: { drums: { musicianId: "dr-1" } },
    };
    const patched: Project = {
      ...clean,
      id: "p-drums-patched",
      lineup: {
        drums: {
          musicianId: "dr-1",
          presetOverride: {
            inputs: {
              add: [{ key: "dr_tom_3", label: "Tom 3", group: "drums" }],
              removeKeys: ["dr_kick"],
            },
          },
        },
      },
    };

    // What the UI claims: the buttons that would write this patch are closed.
    expect(
      resolveInputRowEditability({ ownerRole: "drums", group: "drums" }),
    ).toEqual({ canEdit: false, reason: "drums-not-supported" });

    // What the document does: nothing. Not a collision error either — the
    // narrowing in `resolveEffectiveProjectSetup` drops add/removeKeys before
    // `applyPresetOverride` can hit its collision guard (Critical 1, task 12c).
    const cleanVm = buildDocument(
      clean,
      makeRepo({ band, musicians: { "dr-1": drummer }, project: clean }),
    );
    const patchedVm = buildDocument(
      patched,
      makeRepo({ band, musicians: { "dr-1": drummer }, project: patched }),
    );

    expect(patchedVm.inputs.map((row) => row.key)).toEqual(
      cleanVm.inputs.map((row) => row.key),
    );
    expect(patchedVm.inputs.some((row) => row.key === "dr_tom_3")).toBe(false);
    expect(patchedVm.inputs.some((row) => row.key === "dr_kick")).toBe(true);
  });
});
```

- [ ] **Krok 2: Napiš kontraktní test 3**

```ts
describe("contract: overlay rows stay patch-proof (F5d R7, O2)", () => {
  it("UI reports overlay-not-supported and the document treats the patch as a no-op", () => {
    const band: Band = {
      id: "band",
      name: "Band",
      bandLeader: "voc-1",
      defaultLineup: { vocs: ["voc-1"] },
      defaultOverlays: { leadVocals: ["voc-1"], backVocals: [] },
    };
    const singer: Musician = {
      id: "voc-1",
      firstName: "Voc",
      lastName: "One",
      group: "vocs",
      gender: "male",
      presets: [
        { kind: "preset", ref: "vocal_wireless" },
        { kind: "monitor", ref: "wedge_foh" },
      ],
    };
    const presets: Record<string, PresetEntity> = {
      vocal_wireless: {
        type: "preset",
        id: "vocal_wireless",
        label: "Vocal (wireless)",
        group: "vocs",
        capabilities: ["vocal"],
        inputs: [{ key: "voc_input", label: "Vocal", note: "Own wireless mic" }],
      },
    };

    const clean: Project = {
      id: "p-voc-clean",
      bandRef: "band",
      purpose: "event",
      documentDate: "2026-01-01",
      lineup: { vocs: [{ musicianId: "voc-1" }] },
      overlays: { leadVocals: ["voc-1"], backVocals: [] },
    };
    const patched: Project = {
      ...clean,
      id: "p-voc-patched",
      lineup: {
        vocs: [
          {
            musicianId: "voc-1",
            presetOverride: {
              inputs: {
                remove: ["voc_input"],
                removeKeys: ["voc_lead_1"],
                add: [{ key: "voc_extra", label: "Second mic", group: "vocs" }],
              },
            },
          },
        ],
      },
    };

    // What the UI claims: every vocal and talkback row is closed, and the
    // criterion is `group`, not `ownerRole` — a bass player's back-vocal row
    // carries `ownerRole: "bass"` but `group: "vocs"`.
    expect(resolveInputRowEditability({ ownerRole: "vocs", group: "vocs" })).toEqual({
      canEdit: false,
      reason: "overlay-not-supported",
    });
    expect(resolveInputRowEditability({ ownerRole: "bass", group: "vocs" })).toEqual({
      canEdit: false,
      reason: "overlay-not-supported",
    });
    expect(resolveInputRowEditability({ ownerRole: "drums", group: "talkback" })).toEqual({
      canEdit: false,
      reason: "overlay-not-supported",
    });

    // What the document does with that patch: nothing.
    const cleanVm = buildDocument(
      clean,
      makeRepo({ band, musicians: { "voc-1": singer }, project: clean, presets }),
    );
    const patchedVm = buildDocument(
      patched,
      makeRepo({ band, musicians: { "voc-1": singer }, project: patched, presets }),
    );

    expect(patchedVm.inputs.map((row) => [row.ch, row.key, row.label])).toEqual(
      cleanVm.inputs.map((row) => [row.ch, row.key, row.label]),
    );
    expect(patchedVm.inputs.some((row) => row.key === "voc_extra")).toBe(false);
  });
});
```

- [ ] **Krok 3: Spusť testy**

Run: `npx vitest run packages/desktop/src/app/domain/inputs/uiDocumentContract.test.ts`

Expected: **PASS napoprvé.** Tenhle task nemá RED fázi — testy zamykají chování, které už platí.

**Kdyby některý padl, je to blokující nález, ne důvod test ohnout.** Zapiš přesně, co dokument vyprodukoval, a eskaluj. Krok C stojí na tom, že tyhle dvě brány drží; kdyby neplatily, R2 a O2 ve specu jsou naměřené špatně.

Jedna očekávaná past: pokud `voc_extra` v `patchedVm.inputs` **přece jen je**, narazil jsi na osiřelý řádek z větve `eventOverride` popsaný v `resolveInputRowEditability.ts:52-62`. Ověř, jestli má `ownerMusicianId: undefined`; pokud ano, není to regrese téhle fáze, ale doklad, že se `add` u vokálů má dál držet zavřený — uprav aserci na `expect(patchedVm.inputs.filter((r) => r.key === "voc_extra")).toHaveLength(…)` podle naměřené skutečnosti a nález **výslovně** zapiš do reportu.

- [ ] **Krok 4: Ověř, že se nic jiného nerozbilo**

```bash
npm test 2>&1 | tail -5
npx tsc -p packages/desktop/tsconfig.json --noEmit 2>&1 | grep -c "error TS"
```

Expected: +2 testy proti Tasku 5, tytéž dvě baseline selhání. tsc `10`.

- [ ] **Krok 5: Ověř lint**

Recept z Global Constraints pro `uiDocumentContract.test.ts`, HEAD i BASE. Expected: delta 0.

- [ ] **Krok 6: Commit**

```bash
git add packages/desktop/src/app/domain/inputs/uiDocumentContract.test.ts
git commit -m "test(inputs): lock the drums and overlay patch gates against the document"
```

---
## KROK C — modál `Edit inputs` na `02` (R4, R5)

Cíl kroku: kanál se přidá a odebere tam, kde vzniká — u svého vlastníka, volbou zapojení nebo doplňku, ne výběrem z paralelního katalogu.

**Proč modál a ne inline v inspektoru:** obojí je destruktivní přepis celé sady kanálů slotu, ne editace jednoho řádku, a úzký postranní panel tu váhu neukáže. Inspektor dál nese operace na řádku (rename, note, remove/restore), modály nesou operace na sadě. Symetrie je čitelná: bubeník má v inspektoru `Edit kit`, kytarista dostane `Edit inputs`.

**Katalogy polí se importují beze změny.** `buildBassFields`, `buildGuitarFields`, `buildKeysFields`, `buildLeadVocsFields` (`app/components/setup/instruments/`, 443 ř. implementace + 336 ř. testů) čtou `EventSetupEditState` a vracejí patch; o obrazovku se nezajímají. **Nepřepisuj je.**

**Zásah do `ProjectInputsPage.tsx` má zůstat u 60–100 řádků.** Soubor má dnes 1669 řádků a je druhý největší v desktopu; přesun nesmí být záminka k jeho dalšímu růstu. Proto Tasky 7–9 vytahují logiku do čistých funkcí dřív, než se cokoli zapojí.

### Task 7: `resolveInputsEditState` — slot → `EventSetupEditState`

**Files:**
- Create: `packages/desktop/src/app/domain/inputs/resolveInputsEditState.ts`
- Create: `packages/desktop/src/app/domain/inputs/resolveInputsEditState.test.ts`

**Interfaces:**
- Consumes: `resolveSetupForSlot` z `../setup/resolveSetupForSlot` (po Tasku 3 už bere `presetCatalog` do `getGroupDefaultPreset`).
- Produces:

```ts
export function resolveInputsEditState(args: {
  role: Group;
  musicianId: string;
  patch: PresetOverridePatch | undefined;
  setupData: BandSetupData | null;
  presetCatalog: Record<string, PresetEntity>;
}): EventSetupEditState;
```

  Tasky 9, 10 a 11 na ni staví. `EventSetupEditState` je `{ defaultPreset: MusicianSetupPreset; effectivePreset: MusicianSetupPreset; patch?: PresetOverridePatch }` z `app/components/setup/adapters/eventSetupAdapter.ts`.

**Kontext, který nesmíš přehlédnout**

Tenhle adaptér dnes existuje jen jako inline výraz uvnitř `ProjectSetupPage.tsx:1929-1961` a **nikdy nebyl testovaný** — což je přesně důvod, proč se stěhuje do `app/domain/`, a ne do komponenty. `ProjectSetupPage.tsx` vlastní test nemá; kdyby logika zůstala v JSX, krok D by ji smazal bez sítě.

Dnešní inline podoba (zkráceně):

```tsx
const { resolved, effective } = setupForSlot(role, musicianId, currentPatch);
// …
state={{ defaultPreset: resolved.defaultPreset, effectivePreset: effective, patch: currentPatch }}
```

`resolveSetupForSlot` vrací `{ resolved, effective }`, kde `resolved.defaultPreset` je **nepatchovaný** default a `effective` je `{ inputs, monitoring }` po aplikaci patche. Nová funkce ten tvar jen převede na `EventSetupEditState` a nic dalšího nepočítá.

**Ruling 4 z hlavičky plánu:** `EventSetupEditState` se importuje jako `import type`. Typ leží v komponentové vrstvě, ale `import type` se při buildu maže a runtime závislost nevytváří; duplikovat trojpoložkový typ do domény by zavedlo dvě definice, které se můžou rozejít.

- [ ] **Krok 1: Napiš padající test**

Vytvoř `packages/desktop/src/app/domain/inputs/resolveInputsEditState.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { PresetEntity } from "../../../../../../src/domain/model/types";
import type { BandSetupData } from "../../shell/types";
import { resolveInputsEditState } from "./resolveInputsEditState";

const CATALOG: Record<string, PresetEntity> = {
  el_guitar_mic: {
    type: "preset",
    id: "el_guitar_mic",
    label: "Electric guitar (mic)",
    group: "guitar",
    inputs: [{ key: "el_guitar_mic", label: "Electric guitar", note: "Mic on cabinet" }],
  },
  wedge_foh: { type: "monitor", id: "wedge_foh", label: "Wedge", kind: "wedge", supplier: "foh" },
};

function setupDataWith(presetRefs: string[]): BandSetupData {
  return {
    id: "band-1",
    name: "Test band",
    members: {},
    musicianPresetsById: { m1: presetRefs.map((ref) => ({ kind: "preset", ref })) },
  } as BandSetupData;
}

describe("resolveInputsEditState", () => {
  it("returns the unpatched default and the patched effective preset side by side", () => {
    const state = resolveInputsEditState({
      role: "guitar",
      musicianId: "m1",
      patch: { inputs: { update: [{ key: "el_guitar_mic", label: "Matej guitar" }] } },
      setupData: setupDataWith(["el_guitar_mic"]),
      presetCatalog: CATALOG,
    });

    expect(state.defaultPreset.inputs.map((i) => i.label)).toEqual(["Electric guitar"]);
    expect(state.effectivePreset.inputs.map((i) => i.label)).toEqual(["Matej guitar"]);
    expect(state.patch).toEqual({
      inputs: { update: [{ key: "el_guitar_mic", label: "Matej guitar" }] },
    });
  });

  it("returns an effective preset equal to the default when there is no patch", () => {
    const state = resolveInputsEditState({
      role: "guitar",
      musicianId: "m1",
      patch: undefined,
      setupData: setupDataWith(["el_guitar_mic"]),
      presetCatalog: CATALOG,
    });

    expect(state.effectivePreset.inputs.map((i) => i.key)).toEqual(
      state.defaultPreset.inputs.map((i) => i.key),
    );
    expect(state.patch).toBeUndefined();
  });

  it("agrees with setupForSlot for every role the modal is offered for", () => {
    // The modal reads this state; the inspector and the table read
    // `setupForSlot`. If the two ever disagree, the modal edits a preset the
    // rest of the screen does not show.
    for (const role of ["bass", "guitar", "keys"] as const) {
      const state = resolveInputsEditState({
        role,
        musicianId: "m1",
        patch: undefined,
        setupData: setupDataWith([]),
        presetCatalog: CATALOG,
      });

      expect(state.effectivePreset.monitoring.monitorRef).toBe("wedge_foh");
      expect(Array.isArray(state.effectivePreset.inputs)).toBe(true);
    }
  });

  it("falls back to an empty preset when there is no setup data at all", () => {
    const state = resolveInputsEditState({
      role: "guitar",
      musicianId: "m1",
      patch: undefined,
      setupData: null,
      presetCatalog: {},
    });

    expect(state.defaultPreset.inputs).toEqual([]);
    expect(state.effectivePreset.inputs).toEqual([]);
  });
});
```

- [ ] **Krok 2: Spusť test a ověř, že padá**

Run: `npx vitest run packages/desktop/src/app/domain/inputs/resolveInputsEditState.test.ts`
Expected: FAIL — `Cannot find module './resolveInputsEditState'`.

- [ ] **Krok 3: Napiš implementaci**

Vytvoř `packages/desktop/src/app/domain/inputs/resolveInputsEditState.ts`:

```ts
import type { Group } from "../../../../../../src/domain/model/groups";
import type {
  PresetEntity,
  PresetOverridePatch,
} from "../../../../../../src/domain/model/types";
import type { EventSetupEditState } from "../../components/setup/adapters/eventSetupAdapter";
import type { BandSetupData } from "../../shell/types";
import { resolveSetupForSlot } from "../setup/resolveSetupForSlot";

/**
 * Co? Vstupní stav pro `SchemaRenderer` a katalogy polí jednoho slotu lineupu
 * — nepatchovaný default vedle efektivního presetu a patch, který je spojuje.
 *
 * Proč tady? Dodnes to byl inline výraz uvnitř JSX modálu na obrazovce `01`
 * (`ProjectSetupPage.tsx:1929-1961`) a nikdy neměl test. Modál se v F5d
 * stěhuje na `02` a v kroku D mizí; kdyby logika zůstala v komponentě, smazal
 * by ji krok D bez sítě. `ProjectSetupPage.tsx` ani `ProjectInputsPage.tsx`
 * vlastní test nemají, takže tohle je jediné místo, kde se dá hlídat.
 *
 * Jediný zdroj pravdy je `resolveSetupForSlot`, tedy totéž, z čeho čte
 * inspektor i tabulka řádků. Kdyby modál počítal default sám, editoval by
 * preset, který zbytek obrazovky neukazuje.
 *
 * `EventSetupEditState` je `import type` z komponentové vrstvy schválně: typ
 * se při buildu maže, runtime závislost `app/domain` → `app/components`
 * nevzniká, a duplikát v doméně by se s originálem časem rozešel.
 */
export function resolveInputsEditState(args: {
  role: Group;
  musicianId: string;
  patch: PresetOverridePatch | undefined;
  setupData: BandSetupData | null;
  presetCatalog: Record<string, PresetEntity>;
}): EventSetupEditState {
  const { resolved, effective } = resolveSetupForSlot({
    role: args.role,
    musicianId: args.musicianId,
    patch: args.patch,
    setupData: args.setupData,
    presetCatalog: args.presetCatalog,
  });

  return {
    defaultPreset: resolved.defaultPreset,
    effectivePreset: effective,
    ...(args.patch ? { patch: args.patch } : {}),
  };
}
```

- [ ] **Krok 4: Spusť test a ověř, že prošel**

Run: `npx vitest run packages/desktop/src/app/domain/inputs/resolveInputsEditState.test.ts`
Expected: PASS, 4 testy.

Kdyby čtvrtý test (`no setup data at all`) padl s neprázdnými `inputs`, znamená to, že Task 3 neprošel — `getGroupDefaultPreset` s prázdným katalogem musí vracet prázdno.

- [ ] **Krok 5: Ověř, že se nic jiného nerozbilo**

```bash
npm test 2>&1 | tail -5
npx tsc -p packages/desktop/tsconfig.json --noEmit 2>&1 | grep -c "error TS"
```

Expected: +4 testy, tytéž dvě baseline selhání, tsc `10`.

- [ ] **Krok 6: Ověř lint**

Recept z Global Constraints pro oba nové soubory. Expected: 0 nálezů (nové soubory, absolutní nula je tu platné kritérium).

- [ ] **Krok 7: Commit**

```bash
git add packages/desktop/src/app/domain/inputs/resolveInputsEditState.ts \
        packages/desktop/src/app/domain/inputs/resolveInputsEditState.test.ts
git commit -m "feat(inputs): extract the slot to EventSetupEditState adapter into a tested pure function"
```

---
### Task 8: `resolveInputsFieldSections` — role + kanály → sekce s katalogem polí + kontraktní test 7

> **Blokováno na OQ-1.** Výchozí implementace níž roli `vocs` **nenabízí**. Kdyby člověk rozhodl opačně, přidej `vocs` do `MODAL_ROLES` a doplň větev, která pro ni vrátí `catalog: "lead_vocs"` — a smaž test `does not offer a section for a vocs slot`.

**Files:**
- Create: `packages/desktop/src/app/domain/inputs/resolveInputsFieldSections.ts`
- Create: `packages/desktop/src/app/domain/inputs/resolveInputsFieldSections.test.ts`
- Modify: `packages/desktop/src/app/domain/inputs/uiDocumentContract.test.ts` (kontraktní test 7)

**Interfaces:**
- Consumes: `resolveInputsForCapabilitySection` a `resolveEffectiveInstrumentGroups` z domény (obojí po Tasku 1 a 2).
- Produces:

```ts
export type InputsFieldCatalogId = "bass" | "guitar" | "keys" | "lead_vocs";

export type InputsFieldSection = {
  /** React key a zároveň řez z `resolveEffectiveInstrumentGroups`. */
  readonly key: string;
  /** Prázdný řetězec = jediná sekce, nadpis je jen „Inputs". */
  readonly label: string;
  readonly catalog: InputsFieldCatalogId;
};

/** Role, kterým se modál `Edit inputs` nabízí (F5d R4 + OQ-1). */
export const INPUTS_MODAL_ROLES: readonly Group[] = ["bass", "guitar", "keys"];

export function supportsInputsModal(role: Group): boolean;

export function resolveInputsFieldSections(args: {
  role: Group;
  effectiveInputs: InputChannel[];
}): InputsFieldSection[];
```

  Tasky 10 a 11 na obojí staví.

**Kontext, který nesmíš přehlédnout**

Dnes je tohle rozdělení inline ve dvou kusech JSX modálu na `01`:

- `ProjectSetupPage.tsx:1944-1964` — `setupSection` (role → `SetupCapabilitySection`), `resolveInputsForCapabilitySection`, `resolveEffectiveInstrumentGroups` a shim `{ key: "vocs", label: "", inputs: effectiveSectionInputs }` pro prázdný výsledek.
- `ProjectSetupPage.tsx:2280-2287` — mapa řez → katalog: `keys` → `KEYS_FIELDS`, `electric_guitar`/`acoustic_guitar` → `GUITAR_FIELDS`, jinak `LEAD_VOCS_FIELDS`.
- `ProjectSetupPage.tsx:2144-2153` — bass jede **mimo** rozdělení, jednou sekcí `Inputs` s `BASS_FIELDS`.

**Ruling 2 z hlavičky plánu:** spec říká, že se to stěhuje do `InputsSetupSection.tsx`. Kontraktní test 7 z téhož specu ale požaduje aserci „modál dostane `KEYS_FIELDS`, ne `LEAD_VOCS_FIELDS`", a tu bez jsdom nad komponentou napsat nejde. Čistá funkce je vynucená testovacím požadavkem specu, ne odchylkou od něj.

**Sériové zapojení obou prefixových kopií (M4).** `resolveInputsForCapabilitySection` (kopie 1) filtruje, `resolveEffectiveInstrumentGroups` (kopie 2) přiřazuje řez. Co odfiltruje kopie 1, kopie 2 už nikdy neuvidí. Krok A obě srovnal — proto smí krok C tohle zapojení přestěhovat.

**Shim zůstává, jak je (OQ-2).** Prázdný výsledek dá `{ key: "vocs", label: "", catalog: "lead_vocs" }`. Krok A zavřel jedinou cestu, po které se tam dnes chodí omylem (holý klíč `keys`); zbytek je otevřená otázka pro navazující fázi, ne tichá odchylka.

**Názvy sekcí.** Jedna sekce → nadpis `Inputs`, `label` prázdný. Víc sekcí → `Input – {label}`, kde `label` je z `resolveEffectiveInstrumentGroups` (`"electric guitar"`, `"acoustic guitar"`, `"keys"`, …). Tenhle rozdíl je dnes v JSX (`inputSectionGroups.length === 1 ? "Input" : \`Input – ${group.label}\``) — funkce vrací jen `label`, nadpis skládá komponenta v Tasku 10.

- [ ] **Krok 1: Napiš padající testy**

Vytvoř `packages/desktop/src/app/domain/inputs/resolveInputsFieldSections.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  INPUTS_MODAL_ROLES,
  resolveInputsFieldSections,
  supportsInputsModal,
} from "./resolveInputsFieldSections";

describe("supportsInputsModal", () => {
  it("offers the modal for bass, guitar and keys", () => {
    expect(INPUTS_MODAL_ROLES).toEqual(["bass", "guitar", "keys"]);
    for (const role of ["bass", "guitar", "keys"] as const) {
      expect(supportsInputsModal(role)).toBe(true);
    }
  });

  it("does not offer the modal for drums — the kit is edited through Edit kit", () => {
    expect(supportsInputsModal("drums")).toBe(false);
  });

  it("does not offer the modal for vocs or talkback — the document never reads that patch", () => {
    // Measured (F5d OQ-1): a vocal preset never reaches `document.inputs` at
    // all — `buildMusicianInstrumentInputs` sets it aside as `vocalCapability`
    // — and the printed row is keyed `voc_lead_{slot}`, built from the
    // musician's unpatched presets. A mic-type dropdown here would change the
    // UI preview and nothing in the PDF.
    expect(supportsInputsModal("vocs")).toBe(false);
    expect(supportsInputsModal("talkback")).toBe(false);
  });
});

describe("resolveInputsFieldSections", () => {
  it("gives bass a single unlabelled section on the bass catalog", () => {
    // Bass bypasses the slice split entirely, exactly as `01` does today.
    expect(
      resolveInputsFieldSections({
        role: "bass",
        effectiveInputs: [{ key: "el_bass_xlr_amp", label: "Electric bass guitar" }],
      }),
    ).toEqual([{ key: "bass", label: "", catalog: "bass" }]);
  });

  it("keeps bass on one section even with no channels left", () => {
    expect(
      resolveInputsFieldSections({ role: "bass", effectiveInputs: [] }),
    ).toEqual([{ key: "bass", label: "", catalog: "bass" }]);
  });

  it("gives a keys player the keys catalog for the bare `keys` key", () => {
    // M4: this is the mono-keys trap. Before F5d step A both prefix copies
    // dropped `keys`, the shim kicked in and the modal handed out
    // LEAD_VOCS_FIELDS.
    expect(
      resolveInputsFieldSections({
        role: "keys",
        effectiveInputs: [{ key: "keys", label: "Keys", note: "XLR out from rack" }],
      }),
    ).toEqual([{ key: "keys", label: "keys", catalog: "keys" }]);
  });

  it("gives a keys player the keys catalog for a stereo pair", () => {
    expect(
      resolveInputsFieldSections({
        role: "keys",
        effectiveInputs: [
          { key: "keys_l", label: "Keys L" },
          { key: "keys_r", label: "Keys R" },
        ],
      }),
    ).toEqual([{ key: "keys", label: "keys", catalog: "keys" }]);
  });

  it("splits a guitarist with an electric and an acoustic into two guitar sections", () => {
    expect(
      resolveInputsFieldSections({
        role: "guitar",
        effectiveInputs: [
          { key: "el_guitar_mic", label: "Electric guitar" },
          { key: "ac_guitar", label: "Acoustic guitar" },
        ],
      }),
    ).toEqual([
      { key: "electric_guitar", label: "electric guitar", catalog: "guitar" },
      { key: "acoustic_guitar", label: "acoustic guitar", catalog: "guitar" },
    ]);
  });

  it("ignores channels that belong to another slice of the same owner", () => {
    // A guitarist who also sings carries a vocal channel; the guitar modal
    // must not grow a vocal section out of it.
    expect(
      resolveInputsFieldSections({
        role: "guitar",
        effectiveInputs: [
          { key: "el_guitar_mic", label: "Electric guitar" },
          { key: "voc_input", label: "Vocal", group: "vocs" },
        ],
      }),
    ).toEqual([{ key: "electric_guitar", label: "electric guitar", catalog: "guitar" }]);
  });

  it("falls back to a single lead-vocs section when no channel is recognised (OQ-2)", () => {
    // Today's shim, carried over unchanged. After step A the only way to get
    // here is having no channels of your own slice at all.
    expect(
      resolveInputsFieldSections({ role: "guitar", effectiveInputs: [] }),
    ).toEqual([{ key: "vocs", label: "", catalog: "lead_vocs" }]);
  });

  it("returns no sections for a role the modal is not offered for", () => {
    expect(resolveInputsFieldSections({ role: "drums", effectiveInputs: [] })).toEqual([]);
    expect(
      resolveInputsFieldSections({
        role: "vocs",
        effectiveInputs: [{ key: "voc_input", label: "Vocal" }],
      }),
    ).toEqual([]);
  });
});
```

- [ ] **Krok 2: Spusť testy a ověř, že padají**

Run: `npx vitest run packages/desktop/src/app/domain/inputs/resolveInputsFieldSections.test.ts`
Expected: FAIL — modul neexistuje.

- [ ] **Krok 3: Napiš implementaci**

Vytvoř `packages/desktop/src/app/domain/inputs/resolveInputsFieldSections.ts`:

```ts
import { resolveEffectiveInstrumentGroups } from "../../../../../../src/domain/lineup/effectiveInstrumentGroups";
import {
  type SetupCapabilitySection,
  resolveInputsForCapabilitySection,
} from "../../../../../../src/domain/lineup/resolveLineupInstrumentMembership";
import type { Group } from "../../../../../../src/domain/model/groups";
import type { InputChannel } from "../../../../../../src/domain/model/types";

export type InputsFieldCatalogId = "bass" | "guitar" | "keys" | "lead_vocs";

export type InputsFieldSection = {
  /** React key; zároveň řez z `resolveEffectiveInstrumentGroups`. */
  readonly key: string;
  /** Prázdný řetězec znamená jedinou sekci — nadpis je pak jen „Inputs". */
  readonly label: string;
  readonly catalog: InputsFieldCatalogId;
};

/**
 * Role, kterým se modál `Edit inputs` nabízí (F5d R4).
 *
 * `drums` chybí: bicí kanály staví `drumDefinition` a mění se přes `Edit kit`.
 * `vocs` a `talkback` chybí taky, a je to měřený závěr, ne opomenutí — vokální
 * preset se do `document.inputs` nikdy nedostane (`buildMusicianInstrumentInputs`
 * ho odloží jako `vocalCapability`), tištěný řádek má klíč `voc_lead_{slot}` a
 * staví se z nepatchovaných presetů muzikanta, takže by dropdown typu
 * mikrofonu změnil UI-preview a v PDF nic. Přidání a odebrání vokálního řádku
 * řídí overlays (R7, vlna 2), ne tenhle modál.
 */
export const INPUTS_MODAL_ROLES: readonly Group[] = ["bass", "guitar", "keys"];

export function supportsInputsModal(role: Group): boolean {
  return INPUTS_MODAL_ROLES.includes(role);
}

function catalogForSliceKey(sliceKey: string): InputsFieldCatalogId {
  if (sliceKey === "keys") return "keys";
  if (sliceKey === "electric_guitar" || sliceKey === "acoustic_guitar") return "guitar";
  return "lead_vocs";
}

/**
 * Co? Na kolik sekcí se modál `Edit inputs` rozpadne a který katalog polí
 * dostane každá z nich.
 *
 * Dvě věci, které to spojuje, dnes leží inline v JSX modálu na obrazovce `01`
 * (`ProjectSetupPage.tsx:1944-1964` a `:2280-2287`) a nikdy neměly test.
 * Kontraktní test 7 z R8 přitom požaduje aserci „klávesista s mono presetem
 * dostane KEYS_FIELDS, ne LEAD_VOCS_FIELDS", a tu nad komponentou bez jsdom
 * napsat nejde.
 *
 * Sériové zapojení obou prefixových kopií (M4): `resolveInputsForCapabilitySection`
 * (kopie 1) filtruje kanály na řez role, `resolveEffectiveInstrumentGroups`
 * (kopie 2) je rozdělí na podřezy. Co odfiltruje první, druhá už neuvidí —
 * proto je krok A srovnal dřív, než se to sem přestěhovalo.
 *
 * Bass jde mimo rozdělení, jednou nedělenou sekcí, přesně jako dnes na `01`:
 * `buildBassFields` si výběr zapojení řeší samo přes `setupGroup`/`presetRole`.
 *
 * Prázdný výsledek dá shim `{ key: "vocs", catalog: "lead_vocs" }` — dnešní
 * chování zachované beze změny. Krok A zavřel jedinou cestu, po které se tam
 * chodilo omylem; zbytek je otevřená otázka OQ-2 pro navazující fázi.
 */
export function resolveInputsFieldSections(args: {
  role: Group;
  effectiveInputs: InputChannel[];
}): InputsFieldSection[] {
  if (!supportsInputsModal(args.role)) return [];
  if (args.role === "bass") return [{ key: "bass", label: "", catalog: "bass" }];

  const section = args.role as SetupCapabilitySection;
  const sectionInputs = resolveInputsForCapabilitySection({
    section,
    inputs: args.effectiveInputs,
  });
  const slices = resolveEffectiveInstrumentGroups(sectionInputs);

  if (slices.length === 0) return [{ key: "vocs", label: "", catalog: "lead_vocs" }];

  return slices.map((slice) => ({
    key: slice.key,
    label: slice.label,
    catalog: catalogForSliceKey(slice.key),
  }));
}
```

Přetypování `args.role as SetupCapabilitySection` je bezpečné, protože `supportsInputsModal` už odfiltroval `drums`, `vocs` i `talkback` a zbylé tři role (`bass`, `guitar`, `keys`) jsou v `SetupCapabilitySection` doslova. `bass` se navíc vrátí o řádek dřív. Do komentáře u toho `as` napiš právě tohle — `CLAUDE.md` `as` bez zdůvodnění zakazuje.

- [ ] **Krok 4: Spusť testy a ověř, že prošly**

Run: `npx vitest run packages/desktop/src/app/domain/inputs/resolveInputsFieldSections.test.ts`
Expected: PASS, 10 testů.

Kdyby test `gives a keys player the keys catalog for the bare keys key` padl, neprošly Tasky 1 nebo 2 — holý klíč `keys` musí projít oběma kopiemi.

- [ ] **Krok 5: Napiš kontraktní test 7**

Do `uiDocumentContract.test.ts` přidej import `resolveInputsFieldSections` a nový `describe`:

```ts
describe("contract: mono keys player (F5d R1, M4)", () => {
  it("both prefix copies route him to keys, the modal gets the keys catalog, and the document prints the channel", () => {
    const band: Band = {
      id: "band",
      name: "Band",
      bandLeader: "k-1",
      defaultLineup: { keys: ["k-1"] },
      defaultOverlays: { leadVocals: [], backVocals: [] },
    };
    const keysPlayer: Musician = {
      id: "k-1",
      firstName: "Keys",
      lastName: "One",
      group: "keys",
      presets: [
        { kind: "preset", ref: "keys_mono_xlr" },
        { kind: "monitor", ref: "wedge_foh" },
      ],
    };
    const presets: Record<string, PresetEntity> = {
      keys_mono_xlr: {
        type: "preset",
        id: "keys_mono_xlr",
        label: "Keys mono XLR",
        group: "keys",
        inputs: [{ key: "keys", label: "Keys", note: "XLR out from rack" }],
      },
    };
    const project: Project = {
      id: "p-keys-mono",
      bandRef: "band",
      purpose: "event",
      documentDate: "2026-01-01",
      lineup: { keys: { musicianId: "k-1" } },
    };

    // What the UI claims: the modal renders the keys catalog, not lead vocals.
    expect(
      resolveInputsFieldSections({
        role: "keys",
        effectiveInputs: [{ key: "keys", label: "Keys", note: "XLR out from rack" }],
      }),
    ).toEqual([{ key: "keys", label: "keys", catalog: "keys" }]);

    // What the document produces over the same data.
    const vm = buildDocument(
      project,
      makeRepo({ band, musicians: { "k-1": keysPlayer }, project, presets }),
    );
    const keysRow = vm.inputs.find((row) => row.key === "keys");
    expect(keysRow).toBeDefined();
    expect(keysRow?.group).toBe("keys");
    expect(keysRow?.ownerMusicianId).toBe("k-1");
  });
});
```

- [ ] **Krok 6: Spusť kontraktní test**

Run: `npx vitest run packages/desktop/src/app/domain/inputs/uiDocumentContract.test.ts`
Expected: PASS.

Kdyby padla část s dokumentem (`keysRow` je `undefined`), zapiš přesně, co `vm.inputs` obsahuje, a eskaluj — znamenalo by to, že mono keys preset do dokumentu nedojede vůbec, a to je jiná vada než M4.

- [ ] **Krok 7: Ověř, že se nic jiného nerozbilo**

```bash
npm test 2>&1 | tail -5
npx tsc -p packages/desktop/tsconfig.json --noEmit 2>&1 | grep -c "error TS"
```

Expected: +11 testů proti Tasku 7, tytéž dvě baseline selhání, tsc `10`.

- [ ] **Krok 8: Ověř lint**

Recept z Global Constraints pro `resolveInputsFieldSections.ts`, `…test.ts` (nové, absolutní 0) a `uiDocumentContract.test.ts` (HEAD i BASE, delta 0).

- [ ] **Krok 9: Commit**

```bash
git add packages/desktop/src/app/domain/inputs/resolveInputsFieldSections.ts \
        packages/desktop/src/app/domain/inputs/resolveInputsFieldSections.test.ts \
        packages/desktop/src/app/domain/inputs/uiDocumentContract.test.ts
git commit -m "feat(inputs): resolve the modal field sections and catalog per role as a pure function"
```

---
### Task 9: `resolveDroppedUserEdits` — co destruktivní přepnutí zahodí + kontraktní test 6

**Files:**
- Create: `packages/desktop/src/app/domain/inputs/resolveDroppedUserEdits.ts`
- Create: `packages/desktop/src/app/domain/inputs/resolveDroppedUserEdits.test.ts`
- Modify: `packages/desktop/src/app/domain/inputs/uiDocumentContract.test.ts` (kontraktní test 6)

**Interfaces:**
- Consumes: `applyPresetOverride` z `src/domain/rules/presetOverride`.
- Produces:

```ts
export type DroppedUserEdit = {
  readonly key: string;
  /** Uživatelův vlastní popisek, ne popisek z presetu — to je to, co pozná. */
  readonly label: string;
  readonly note?: string;
};

export function resolveDroppedUserEdits(args: {
  defaultPreset: MusicianSetupPreset;
  currentPatch: PresetOverridePatch | undefined;
  nextPatch: PresetOverridePatch | undefined;
}): DroppedUserEdit[];
```

  Task 10 na ní staví potvrzovací dialog.

**Kontext, který nesmíš přehlédnout**

**Destruktivita `rebuild` je správná sémantika, ne vada.** `buildGuitarFields.rebuild` (`.../guitar/buildGuitarFields.ts:25-33`) zahazuje všechny kanály s prefixem `el_guitar`/`ac_guitar` a postaví sadu znovu z vybraného presetu. Kytarista, který přepnul z mikrofonu na DI, ten mikrofon na pódiu nemá. Nedestruktivní `rebuild()` byl zvážen a zamítnut — pravidlo „zachovej kanály, které nepocházejí z presetu" by zavedlo do modelu třetí kategorii kanálů, kterou by musela znát doména, `Reset to default`, `countOwnerDeviations`, řazení v PDF i validace.

**Ale destruktivita musí být vidět dopředu, ne až v PDF (R5).** Přepnutí, které by zahodilo kanál nesoucí uživatelskou odchylku — přejmenování nebo poznámku z `presetOverride.inputs.update` — se potvrzuje, s výpisem kanálů, které zmizí, jejich **uživatelskými** popisky.

**Kontrola sedí v obalu z R4, ne v katalozích polí.** Obal dostane z `SchemaRenderer` zamýšlený patch, touhle funkcí spočítá efektivní kanály před a po, vezme rozdíl a proti němu prověří `currentPatch.inputs.update`. Neprázdný průsečík → potvrzení; prázdný → patch se aplikuje bez dotazu. **Katalogy polí se nemění.**

**Co funkce záměrně NEhlásí.** `withInputsTarget` (`eventSetupAdapter.ts:118-150`) přepisuje `update` celé, takže přejmenování může zmizet i u kanálu, který přepnutí **přežije** — `rebuild` skládá `mainInputs` z presetu, ne z efektivních kanálů. To je jiná vada, mimo rozsah F5d. Tahle funkce hlásí výhradně kanály, které z efektivní sady **zmizely**. Kdyby se to mělo rozšířit, je to nový task, ne rozšíření tohohle.

**Nepoužívej `getPatchedInputs` z `eventSetupAdapter`.** Je to sice přesně ten výpočet, ale leží v komponentové vrstvě a `app/domain/` by na ni ukazovat neměl. Volej `applyPresetOverride` přímo — `getPatchedInputs` není nic jiného než jeho obal.

- [ ] **Krok 1: Napiš padající testy**

Vytvoř `packages/desktop/src/app/domain/inputs/resolveDroppedUserEdits.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { MusicianSetupPreset } from "../../../../../../src/domain/model/types";
import { resolveDroppedUserEdits } from "./resolveDroppedUserEdits";

const GUITAR_DEFAULT: MusicianSetupPreset = {
  inputs: [
    { key: "el_guitar_mic", label: "Electric guitar", note: "Mic on cabinet", group: "guitar" },
  ],
  monitoring: { monitorRef: "wedge_foh" },
};

describe("resolveDroppedUserEdits", () => {
  it("reports a renamed channel the switch would drop, under the user's own label", () => {
    const dropped = resolveDroppedUserEdits({
      defaultPreset: GUITAR_DEFAULT,
      currentPatch: {
        inputs: { update: [{ key: "el_guitar_mic", label: "Matej's Tele" }] },
      },
      nextPatch: {
        inputs: {
          remove: ["el_guitar_mic"],
          add: [{ key: "el_guitar_xlr", label: "Electric guitar", group: "guitar" }],
        },
      },
    });

    expect(dropped).toEqual([{ key: "el_guitar_mic", label: "Matej's Tele" }]);
  });

  it("reports a channel that only carries a note", () => {
    const dropped = resolveDroppedUserEdits({
      defaultPreset: GUITAR_DEFAULT,
      currentPatch: {
        inputs: { update: [{ key: "el_guitar_mic", note: "Vintage 57, handle with care" }] },
      },
      nextPatch: { inputs: { remove: ["el_guitar_mic"] } },
    });

    expect(dropped).toEqual([
      {
        key: "el_guitar_mic",
        label: "Electric guitar",
        note: "Vintage 57, handle with care",
      },
    ]);
  });

  it("stays silent when the dropped channel carries no user edit", () => {
    // Switching connection on an untouched channel is the ordinary case and
    // must not ask anything.
    expect(
      resolveDroppedUserEdits({
        defaultPreset: GUITAR_DEFAULT,
        currentPatch: undefined,
        nextPatch: {
          inputs: {
            remove: ["el_guitar_mic"],
            add: [{ key: "el_guitar_xlr", label: "Electric guitar", group: "guitar" }],
          },
        },
      }),
    ).toEqual([]);
  });

  it("stays silent when a rename does not drop anything", () => {
    expect(
      resolveDroppedUserEdits({
        defaultPreset: GUITAR_DEFAULT,
        currentPatch: undefined,
        nextPatch: {
          inputs: { update: [{ key: "el_guitar_mic", label: "Matej's Tele" }] },
        },
      }),
    ).toEqual([]);
  });

  it("stays silent when the edited channel survives the switch", () => {
    const stereoDefault: MusicianSetupPreset = {
      inputs: [
        { key: "el_guitar_mic", label: "Electric guitar", group: "guitar" },
        { key: "ac_guitar", label: "Acoustic guitar", group: "guitar" },
      ],
      monitoring: { monitorRef: "wedge_foh" },
    };

    expect(
      resolveDroppedUserEdits({
        defaultPreset: stereoDefault,
        currentPatch: { inputs: { update: [{ key: "ac_guitar", label: "Martin D-28" }] } },
        nextPatch: {
          inputs: {
            remove: ["el_guitar_mic"],
            update: [{ key: "ac_guitar", label: "Martin D-28" }],
          },
        },
      }),
    ).toEqual([]);
  });

  it("reports every dropped edited channel, in effective order", () => {
    const twoEdits: MusicianSetupPreset = {
      inputs: [
        { key: "el_guitar_mic", label: "Electric guitar", group: "guitar" },
        { key: "ac_guitar", label: "Acoustic guitar", group: "guitar" },
      ],
      monitoring: { monitorRef: "wedge_foh" },
    };

    const dropped = resolveDroppedUserEdits({
      defaultPreset: twoEdits,
      currentPatch: {
        inputs: {
          update: [
            { key: "el_guitar_mic", label: "Tele" },
            { key: "ac_guitar", note: "Capo 2" },
          ],
        },
      },
      nextPatch: { inputs: { remove: ["el_guitar_mic", "ac_guitar"] } },
    });

    expect(dropped.map((item) => item.key)).toEqual(["el_guitar_mic", "ac_guitar"]);
  });

  it("returns nothing when the next patch adds without dropping", () => {
    expect(
      resolveDroppedUserEdits({
        defaultPreset: GUITAR_DEFAULT,
        currentPatch: { inputs: { update: [{ key: "el_guitar_mic", label: "Tele" }] } },
        nextPatch: {
          inputs: {
            update: [{ key: "el_guitar_mic", label: "Tele" }],
            add: [{ key: "ac_guitar", label: "Acoustic guitar", group: "guitar" }],
          },
        },
      }),
    ).toEqual([]);
  });
});
```

- [ ] **Krok 2: Spusť testy a ověř, že padají**

Run: `npx vitest run packages/desktop/src/app/domain/inputs/resolveDroppedUserEdits.test.ts`
Expected: FAIL — modul neexistuje.

- [ ] **Krok 3: Napiš implementaci**

Vytvoř `packages/desktop/src/app/domain/inputs/resolveDroppedUserEdits.ts`:

```ts
import type {
  MusicianSetupPreset,
  PresetOverridePatch,
} from "../../../../../../src/domain/model/types";
import { applyPresetOverride } from "../../../../../../src/domain/rules/presetOverride";

export type DroppedUserEdit = {
  readonly key: string;
  /** Uživatelův vlastní popisek — podle něj kanál v potvrzení pozná. */
  readonly label: string;
  readonly note?: string;
};

/**
 * Co? Kanály nesoucí uživatelskou odchylku (`presetOverride.inputs.update` —
 * přejmenování nebo poznámka), které by zamýšlený patch z efektivní sady
 * odstranil.
 *
 * Proč? Přepnutí `Connection` je destruktivní přepis celé sady kanálů slotu a
 * to je správná sémantika (F5d R5): kytarista, který přepnul z mikrofonu na
 * DI, ten mikrofon na pódiu nemá. Nedestruktivní varianta byla zvážena a
 * zamítnuta — zavedla by do modelu třetí kategorii kanálů, kterou by musela
 * znát doména, `Reset to default`, `countOwnerDeviations`, řazení v PDF i
 * validace. Ale destruktivita musí být vidět **dopředu**, ne až v PDF, a to
 * je jediný účel téhle funkce.
 *
 * Vrací se **efektivní** podoba kanálu, ne ta z presetu: v potvrzení má stát
 * jméno, které tam uživatel napsal, jinak nepozná, o co přichází.
 *
 * Co funkce vědomě NEhlásí: `withInputsTarget` skládá `update` znovu z cílové
 * sady, takže přejmenování může zmizet i u kanálu, který přepnutí přežije
 * (`rebuild` bere `mainInputs` z presetu, ne z efektivních kanálů). To je jiná
 * vada a je mimo rozsah F5d — tady se hlásí výhradně kanály, které z efektivní
 * sady zmizely.
 */
export function resolveDroppedUserEdits(args: {
  defaultPreset: MusicianSetupPreset;
  currentPatch: PresetOverridePatch | undefined;
  nextPatch: PresetOverridePatch | undefined;
}): DroppedUserEdit[] {
  const editedKeys = new Set(
    (args.currentPatch?.inputs?.update ?? []).map((item) => item.key),
  );
  if (editedKeys.size === 0) return [];

  const before = applyPresetOverride(args.defaultPreset, args.currentPatch).inputs;
  const afterKeys = new Set(
    applyPresetOverride(args.defaultPreset, args.nextPatch).inputs.map((item) => item.key),
  );

  return before
    .filter((input) => editedKeys.has(input.key) && !afterKeys.has(input.key))
    .map((input) => ({
      key: input.key,
      label: input.label,
      ...(input.note ? { note: input.note } : {}),
    }));
}
```

Pořadí výstupu je pořadí `before`, tedy pořadí efektivní sady — proto test `reports every dropped edited channel, in effective order`.

- [ ] **Krok 4: Spusť testy a ověř, že prošly**

Run: `npx vitest run packages/desktop/src/app/domain/inputs/resolveDroppedUserEdits.test.ts`
Expected: PASS, 7 testů.

- [ ] **Krok 5: Napiš kontraktní test 6**

Do `uiDocumentContract.test.ts` přidej import `resolveDroppedUserEdits` a nový `describe`. Tenhle test tvrdí obojí: že funkce kanál ohlásí **a** že ho dokument po aplikaci patche opravdu netiskne.

```ts
describe("contract: destructive connection switch (F5d R5)", () => {
  it("the helper reports the annotated channel and the document stops printing it", () => {
    const band: Band = {
      id: "band",
      name: "Band",
      bandLeader: "g-1",
      defaultLineup: { guitar: ["g-1"] },
      defaultOverlays: { leadVocals: [], backVocals: [] },
    };
    const guitarist: Musician = {
      id: "g-1",
      firstName: "Gtr",
      lastName: "One",
      group: "guitar",
      presets: [
        { kind: "preset", ref: "el_guitar_mic" },
        { kind: "monitor", ref: "wedge_foh" },
      ],
    };
    const presets: Record<string, PresetEntity> = {
      el_guitar_mic: {
        type: "preset",
        id: "el_guitar_mic",
        label: "Electric guitar (mic)",
        group: "guitar",
        inputs: [{ key: "el_guitar_mic", label: "Electric guitar", note: "Mic on cabinet" }],
      },
    };

    const defaultPreset = {
      inputs: [
        { key: "el_guitar_mic", label: "Electric guitar", note: "Mic on cabinet", group: "guitar" as const },
      ],
      monitoring: { monitorRef: "wedge_foh" },
    };
    const currentPatch = {
      inputs: { update: [{ key: "el_guitar_mic", note: "Vintage 57, handle with care" }] },
    };
    const nextPatch = {
      inputs: {
        remove: ["el_guitar_mic"],
        add: [{ key: "el_guitar_xlr", label: "Electric guitar", group: "guitar" as const }],
      },
    };

    // What the UI claims: the note is about to be lost.
    expect(
      resolveDroppedUserEdits({ defaultPreset, currentPatch, nextPatch }),
    ).toEqual([
      { key: "el_guitar_mic", label: "Electric guitar", note: "Vintage 57, handle with care" },
    ]);

    // What the document does once the switch is applied.
    const project: Project = {
      id: "p-guitar-switched",
      bandRef: "band",
      purpose: "event",
      documentDate: "2026-01-01",
      lineup: { guitar: { musicianId: "g-1", presetOverride: nextPatch } },
    };
    const vm = buildDocument(
      project,
      makeRepo({ band, musicians: { "g-1": guitarist }, project, presets }),
    );

    expect(vm.inputs.some((row) => row.key === "el_guitar_mic")).toBe(false);
    expect(vm.inputs.some((row) => row.key === "el_guitar_xlr")).toBe(true);
  });
});
```

- [ ] **Krok 6: Spusť kontraktní test**

Run: `npx vitest run packages/desktop/src/app/domain/inputs/uiDocumentContract.test.ts`
Expected: PASS.

- [ ] **Krok 7: Ověř, že se nic jiného nerozbilo**

```bash
npm test 2>&1 | tail -5
npx tsc -p packages/desktop/tsconfig.json --noEmit 2>&1 | grep -c "error TS"
```

Expected: +8 testů proti Tasku 8, tytéž dvě baseline selhání, tsc `10`.

- [ ] **Krok 8: Ověř lint**

Recept z Global Constraints pro `resolveDroppedUserEdits.ts`, `…test.ts` (nové, absolutní 0) a `uiDocumentContract.test.ts` (HEAD i BASE, delta 0).

- [ ] **Krok 9: Commit**

```bash
git add packages/desktop/src/app/domain/inputs/resolveDroppedUserEdits.ts \
        packages/desktop/src/app/domain/inputs/resolveDroppedUserEdits.test.ts \
        packages/desktop/src/app/domain/inputs/uiDocumentContract.test.ts
git commit -m "feat(inputs): report user edits a destructive connection switch would discard"
```

---
### Task 10: `InputsSetupSection.tsx` — obal modálu s potvrzením

> **Blokováno na OQ-1** stejně jako Task 8 — komponenta se řídí `resolveInputsFieldSections`, takže odpověď se do ní propíše sama, ale test na nenabízenou roli je potřeba srovnat s Taskem 8.

**Files:**
- Create: `packages/desktop/src/app/components/inputs/InputsSetupSection.tsx`
- Create: `packages/desktop/src/app/components/inputs/InputsSetupSection.test.tsx`

**Interfaces:**
- Consumes: `resolveInputsFieldSections` a `InputsFieldSection` (Task 8), `resolveDroppedUserEdits` a `DroppedUserEdit` (Task 9), `EventSetupEditState` (Task 7 ho produkuje), `buildSetupFieldCatalog` z `pages/shared/setupConstants`, `SchemaRenderer` a `SetupSection` z `../setup/`, `ModalOverlay`/`useModalBehavior` z `../../../components/ui/Modal`, `normalizeSetupOverridePatch` z `src/domain/rules/presetOverride`.
- Produces:

```ts
export function InputsSetupSection(props: {
  open: boolean;
  title: string;
  role: Group;
  state: EventSetupEditState;
  fieldCatalog: ReturnType<typeof buildSetupFieldCatalog>;
  onPatch: (nextPatch: PresetOverridePatch | undefined) => void;
  onClose: () => void;
}): JSX.Element;
```

  Task 11 ji zapojuje do `ProjectInputsPage.tsx`.

**Kontext, který nesmíš přehlédnout**

**Ruling 1 z hlavičky plánu — podoba potvrzení.** Druhý `ModalOverlay` s `role="alertdialog"` **nad** modálem `Edit inputs`, který drží zamýšlený patch nerozbalený, dokud uživatel nepotvrdí. Obrazovka `02` má pro destruktivní akci už dva přesně takové dialogy (`Reset to defaults?` na `ProjectInputsPage.tsx:1618-1666` a potvrzení `Save as musician default`), takže třetí idiom by byl bezdůvodný. „Dopředu" je takhle doslova pravda: `onPatch` se zavolá až po potvrzení.

**`normalizeSetupOverridePatch` se volá tady, ne ve stránce.** Modál na `01` ho volá u každého `onPatch` (`ProjectSetupPage.tsx:2165`, `:2296`) a je to ta funkce, která z patche udělá `undefined`, když se efektivní preset vrátil na default. Bez ní by v projektu zůstal patch, který nic nemění, a `DEVIATIONS N` by lhal.

**`SetupSection` props:** `{ title: string; description?: string; modified?: boolean; children: ReactNode }`. Odznak `• Modified` renderuje sama, když `modified`.

**Nadpisy sekcí:** jedna sekce → `Inputs`; víc sekcí → `Input – {label}`. Přesně jak to dnes dělá `01` (`ProjectSetupPage.tsx:2269-2273`), jen `bass` tam má nadpis `Inputs` z jiné větve — sjednoceno tím, že `resolveInputsFieldSections` vrací pro bass jedinou sekci s prázdným `label`.

**`modified` se počítá z `state`:** `state.patch?.inputs` neprázdné. Modál na `01` čte `resolved.diffMeta.inputs.some(isDiffOriginOverridden)`, ale `diffMeta` do `EventSetupEditState` nepatří a Task 7 ho nevozí. Neprázdné `inputs` v patchi je tatáž informace o řádek jednodušeji — po `normalizeSetupOverridePatch` je patch `undefined`, jakmile se efektivní preset rovná defaultu.

**Test bez jsdom.** `renderToStaticMarkup` handlery nezavěsí, takže se testuje jen to, co je v HTML: které sekce se vyrenderovaly a jaké `aria-label` mají dropdowny. Potvrzovací dialog se testuje **čistou funkcí `resolveDroppedUserEdits`** (Task 9), ne interakcí — to je vědomě nekryté místo z R8.

- [ ] **Krok 1: Napiš padající test**

Vytvoř `packages/desktop/src/app/components/inputs/InputsSetupSection.test.tsx`. Vzor existujících `.test.tsx` v repu: `renderToStaticMarkup` + aserce nad HTML stringem.

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PresetEntity } from "../../../../../../src/domain/model/types";
import { buildSetupFieldCatalog } from "../../pages/shared/setupConstants";
import { InputsSetupSection } from "./InputsSetupSection";

const CATALOG: Record<string, PresetEntity> = {
  el_guitar_mic: {
    type: "preset",
    id: "el_guitar_mic",
    label: "Electric guitar (mic)",
    group: "guitar",
    inputs: [{ key: "el_guitar_mic", label: "Electric guitar" }],
  },
  el_guitar_xlr_mono: {
    type: "preset",
    id: "el_guitar_xlr_mono",
    label: "Electric guitar (XLR mono)",
    group: "guitar",
    inputs: [{ key: "el_guitar_xlr", label: "Electric guitar" }],
  },
  keys_stereo_xlr: {
    type: "preset",
    id: "keys_stereo_xlr",
    label: "Keys stereo XLR",
    group: "keys",
    inputs: [
      { key: "keys_l", label: "Keys L", channel: "L" },
      { key: "keys_r", label: "Keys R", channel: "R" },
    ],
  },
  keys_mono_xlr: {
    type: "preset",
    id: "keys_mono_xlr",
    label: "Keys mono XLR",
    group: "keys",
    inputs: [{ key: "keys", label: "Keys" }],
  },
};

const FIELDS = buildSetupFieldCatalog(CATALOG);

function render(node: Parameters<typeof renderToStaticMarkup>[0]): string {
  return renderToStaticMarkup(node);
}

describe("InputsSetupSection", () => {
  it("renders nothing while closed", () => {
    const html = render(
      <InputsSetupSection
        open={false}
        title="Edit inputs"
        role="guitar"
        state={{
          defaultPreset: { inputs: [{ key: "el_guitar_mic", label: "Electric guitar" }], monitoring: { monitorRef: "wedge_foh" } },
          effectivePreset: { inputs: [{ key: "el_guitar_mic", label: "Electric guitar" }], monitoring: { monitorRef: "wedge_foh" } },
        }}
        fieldCatalog={FIELDS}
        onPatch={() => {}}
        onClose={() => {}}
      />,
    );

    expect(html).not.toContain("Edit inputs");
  });

  it("renders the guitar connection dropdown for a guitarist", () => {
    const html = render(
      <InputsSetupSection
        open
        title="Edit inputs — Matej"
        role="guitar"
        state={{
          defaultPreset: { inputs: [{ key: "el_guitar_mic", label: "Electric guitar" }], monitoring: { monitorRef: "wedge_foh" } },
          effectivePreset: { inputs: [{ key: "el_guitar_mic", label: "Electric guitar" }], monitoring: { monitorRef: "wedge_foh" } },
        }}
        fieldCatalog={FIELDS}
        onPatch={() => {}}
        onClose={() => {}}
      />,
    );

    expect(html).toContain("Edit inputs — Matej");
    expect(html).toContain('aria-label="Connection"');
    expect(html).toContain("Input – electric guitar");
  });

  it("gives a mono keys player the keys catalog, not the vocal one (M4)", () => {
    const html = render(
      <InputsSetupSection
        open
        title="Edit inputs"
        role="keys"
        state={{
          defaultPreset: { inputs: [{ key: "keys", label: "Keys" }], monitoring: { monitorRef: "wedge_foh" } },
          effectivePreset: { inputs: [{ key: "keys", label: "Keys" }], monitoring: { monitorRef: "wedge_foh" } },
        }}
        fieldCatalog={FIELDS}
        onPatch={() => {}}
        onClose={() => {}}
      />,
    );

    expect(html).toContain("Input – keys");
    expect(html).not.toContain('aria-label="Mic"');
  });

  it("shows a bass slot one undivided Inputs section", () => {
    const html = render(
      <InputsSetupSection
        open
        title="Edit inputs"
        role="bass"
        state={{
          defaultPreset: { inputs: [{ key: "el_bass_xlr_amp", label: "Electric bass guitar" }], monitoring: { monitorRef: "wedge_foh" } },
          effectivePreset: { inputs: [{ key: "el_bass_xlr_amp", label: "Electric bass guitar" }], monitoring: { monitorRef: "wedge_foh" } },
        }}
        fieldCatalog={FIELDS}
        onPatch={() => {}}
        onClose={() => {}}
      />,
    );

    expect(html).toContain(">Inputs");
    expect(html).not.toContain("Input – ");
  });

  it("marks the section modified when the slot carries an input patch", () => {
    const html = render(
      <InputsSetupSection
        open
        title="Edit inputs"
        role="guitar"
        state={{
          defaultPreset: { inputs: [{ key: "el_guitar_mic", label: "Electric guitar" }], monitoring: { monitorRef: "wedge_foh" } },
          effectivePreset: { inputs: [{ key: "el_guitar_mic", label: "Tele" }], monitoring: { monitorRef: "wedge_foh" } },
          patch: { inputs: { update: [{ key: "el_guitar_mic", label: "Tele" }] } },
        }}
        fieldCatalog={FIELDS}
        onPatch={() => {}}
        onClose={() => {}}
      />,
    );

    expect(html).toContain("• Modified");
  });
});
```

- [ ] **Krok 2: Spusť test a ověř, že padá**

Run: `npx vitest run packages/desktop/src/app/components/inputs/InputsSetupSection.test.tsx`
Expected: FAIL — komponenta neexistuje.

- [ ] **Krok 3: Napiš komponentu**

Vytvoř `packages/desktop/src/app/components/inputs/InputsSetupSection.tsx`:

```tsx
import { useState } from "react";
import type { Group } from "../../../../../../src/domain/model/groups";
import type { PresetOverridePatch } from "../../../../../../src/domain/model/types";
import { normalizeSetupOverridePatch } from "../../../../../../src/domain/rules/presetOverride";
import { ModalOverlay, useModalBehavior } from "../../../components/ui/Modal";
import { Close } from "../../../components/ui/icons";
import type { EventSetupEditState } from "../setup/adapters/eventSetupAdapter";
import { SchemaRenderer } from "../setup/SchemaRenderer";
import { SetupSection } from "../setup/SetupSection";
import {
  type DroppedUserEdit,
  resolveDroppedUserEdits,
} from "../../domain/inputs/resolveDroppedUserEdits";
import {
  type InputsFieldCatalogId,
  resolveInputsFieldSections,
} from "../../domain/inputs/resolveInputsFieldSections";
import type { buildSetupFieldCatalog } from "../../pages/shared/setupConstants";

type FieldCatalog = ReturnType<typeof buildSetupFieldCatalog>;

/**
 * Modál `Edit inputs` obrazovky `02` (F5d R4). Sourozenec `Edit kit`: bubeník
 * má v inspektoru `Edit kit`, kytarista, basák a klávesista dostanou tohle.
 *
 * Proč modál a ne inline v inspektoru: obojí je destruktivní přepis celé sady
 * kanálů slotu, ne editace jednoho řádku, a úzký postranní panel tu váhu
 * neukáže. Inspektor nese operace na řádku (rename, note, remove/restore),
 * modály nesou operace na sadě.
 *
 * Rozdělení na sekce a výběr katalogu polí sem nepatří — je to čistá funkce
 * `resolveInputsFieldSections`, protože kontraktní test 7 z R8 potřebuje
 * asertovat „modál dostane KEYS_FIELDS" a repozitář nemá jsdom.
 *
 * Potvrzení destruktivního přepnutí (R5): zamýšlený patch se PARKUJE, dokud
 * uživatel nepotvrdí, takže „dopředu" je doslova pravda. Stejný idiom, jaký na
 * `02` už mají `Reset to defaults?` a `Save as musician default` —
 * `ModalOverlay` s `role="alertdialog"`, `Cancel` a nebezpečná akce.
 */
export function InputsSetupSection({
  open,
  title,
  role,
  state,
  fieldCatalog,
  onPatch,
  onClose,
}: {
  open: boolean;
  title: string;
  role: Group;
  state: EventSetupEditState;
  fieldCatalog: FieldCatalog;
  onPatch: (nextPatch: PresetOverridePatch | undefined) => void;
  onClose: () => void;
}) {
  const [pending, setPending] = useState<{
    patch: PresetOverridePatch | undefined;
    dropped: DroppedUserEdit[];
  } | null>(null);

  const modalRef = useModalBehavior(open, onClose);
  const confirmRef = useModalBehavior(Boolean(pending), () => setPending(null));

  const sections = resolveInputsFieldSections({
    role,
    effectiveInputs: state.effectivePreset.inputs,
  });
  const isModified = Boolean(state.patch?.inputs);

  function fieldsFor(catalog: InputsFieldCatalogId) {
    if (catalog === "bass") return fieldCatalog.bassFields;
    if (catalog === "guitar") return fieldCatalog.guitarFields;
    if (catalog === "keys") return fieldCatalog.keysFields;
    return fieldCatalog.leadVocsFields;
  }

  function handlePatch(rawPatch: PresetOverridePatch | undefined) {
    const nextPatch = normalizeSetupOverridePatch(state.defaultPreset, rawPatch);
    const dropped = resolveDroppedUserEdits({
      defaultPreset: state.defaultPreset,
      currentPatch: state.patch,
      nextPatch,
    });
    if (dropped.length > 0) {
      setPending({ patch: nextPatch, dropped });
      return;
    }
    onPatch(nextPatch);
  }

  return (
    <>
      <ModalOverlay open={open} onClose={onClose}>
        <div
          className="selector-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-inputs-title"
          ref={modalRef}
        >
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <Close />
          </button>
          <div className="panel__header panel__header--stack selector-dialog__title">
            <h3 id="edit-inputs-title">{title}</h3>
            <p className="subtle">
              Changes here apply only to this event. Musician defaults are not modified.
            </p>
          </div>
          <div className="selector-dialog__divider section-divider" />
          <div className="selector-dialog__body setup-editor-stack">
            {sections.map((section) => (
              <SetupSection
                key={section.key}
                title={section.label ? `Input – ${section.label}` : "Inputs"}
                modified={isModified}
              >
                <SchemaRenderer
                  fields={fieldsFor(section.catalog)}
                  state={state}
                  onPatch={handlePatch}
                />
              </SetupSection>
            ))}
          </div>
          <div className="modal-actions">
            <button type="button" className="button-secondary" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </ModalOverlay>

      <ModalOverlay open={Boolean(pending)} onClose={() => setPending(null)}>
        <div
          className="selector-dialog"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="drop-user-edits-title"
          aria-describedby="drop-user-edits-body"
          ref={confirmRef}
        >
          <div className="panel__header panel__header--stack selector-dialog__title">
            <h3 id="drop-user-edits-title">Switch connection?</h3>
            <p id="drop-user-edits-body" className="subtle">
              This removes channels you renamed or annotated. Their names and notes are
              discarded and cannot be restored by switching back.
            </p>
          </div>
          <ul className="selector-dialog__body">
            {(pending?.dropped ?? []).map((item) => (
              <li key={item.key}>
                {item.label}
                {item.note ? ` — ${item.note}` : ""}
              </li>
            ))}
          </ul>
          <div className="modal-actions">
            <button type="button" className="button-secondary" onClick={() => setPending(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="button-danger"
              onClick={() => {
                const confirmed = pending;
                setPending(null);
                if (confirmed) onPatch(confirmed.patch);
              }}
            >
              Switch and discard
            </button>
          </div>
        </div>
      </ModalOverlay>
    </>
  );
}
```

`Close` ikona a třídy `selector-dialog`, `modal-actions`, `button-danger`, `setup-editor-stack` jsou existující — okopírované z `Edit kit` a `Reset to defaults?` na `ProjectInputsPage.tsx:1582-1666`. **Nezaváděj nové CSS třídy.** Kdyby `<ul>` uvnitř `selector-dialog__body` vypadalo špatně, řeš to v ručním průchodu (bod 9 verifikace), ne novým stylem.

- [ ] **Krok 4: Spusť test a ověř, že prošel**

Run: `npx vitest run packages/desktop/src/app/components/inputs/InputsSetupSection.test.tsx`
Expected: PASS, 5 testů.

Pokud test `renders nothing while closed` selže, zkontroluj, jak se `ModalOverlay` chová se `open={false}` — u `Edit kit` se to řeší tak, že se render vůbec nevejde do stromu. Případně obal celou první `ModalOverlay` podmínkou.

- [ ] **Krok 5: Ověř, že se nic jiného nerozbilo**

```bash
npm test 2>&1 | tail -5
npx tsc -p packages/desktop/tsconfig.json --noEmit 2>&1 | grep -c "error TS"
```

Expected: +5 testů proti Tasku 9, tytéž dvě baseline selhání, tsc `10`. **Kdyby tsc vyskočil nad 10, oprav to** — nové chyby v novém souboru nejsou baseline.

- [ ] **Krok 6: Ověř lint**

Recept z Global Constraints pro oba nové soubory. Expected: 0 nálezů.

- [ ] **Krok 7: Commit**

```bash
git add packages/desktop/src/app/components/inputs/InputsSetupSection.tsx \
        packages/desktop/src/app/components/inputs/InputsSetupSection.test.tsx
git commit -m "feat(inputs): add the Edit inputs modal with an upfront destructive-switch confirmation"
```

---
### Task 11: Zapojení do `ProjectInputsPage.tsx` a `InputRowInspector`

> **Blokováno na OQ-1** — predikát tlačítka čte `supportsInputsModal` z Tasku 8, takže odpověď se propíše sama; test na vokální řádek ale musí sedět s Taskem 8.

**Files:**
- Modify: `packages/desktop/src/app/components/inputs/InputRowInspector.tsx` (nový prop `onEditInputs`, tlačítko)
- Modify: `packages/desktop/src/app/components/inputs/InputRowInspector.test.tsx`
- Modify: `packages/desktop/src/app/pages/ProjectInputsPage.tsx` (stav modálu, render, zápis patche)
- Modify: `packages/desktop/src/app/pages/ProjectInputsPage.test.tsx` (nový povinný prop rozbije kompilaci existujících testů)

**Interfaces:**
- Consumes: `InputsSetupSection` (Task 10), `resolveInputsEditState` (Task 7), `supportsInputsModal` (Task 8), existující `getSlotOverride`, `replaceSlotOverride`, `parseSlotIndex`, `buildSetupFieldCatalog`, `composeSetupModalTitle`.
- Produces: `InputRowInspector` s novým **povinným** propem `onEditInputs: () => void`. Task 12 na stránce maže picker; Task 16 tam přidává overlays.

**Kontext, který nesmíš přehlédnout**

**Rozpočet: 60–100 řádků v `ProjectInputsPage.tsx`.** Soubor má dnes 1669 řádků a je druhý největší v desktopu. Vejde se do toho: jeden `useState`, jedno `useMemo` na katalog polí, jedno `useMemo` na `EventSetupEditState` vybraného řádku, jeden `useCallback` na zápis patche, jeden prop v `InputRowInspector` a jeden render `InputsSetupSection`. **Když ti to roste přes 100, tahá se s tebou logika, která patří do `app/domain/inputs/`.**

**Ruling 5 z hlavičky plánu — tlačítko se neschovává za `resolveInputRowEditability`.** Přímý přenos Rulingu z Tasku 16 F5c pro `Edit kit`: brána z 13b zavírá `Remove`/`Restore` právě proto, že ty cesty dokument nečte; `Edit inputs` je cesta, kterou čte. Klíčuje se na **`row.ownerRole`**, ne na `row.group` — jinak by zmizelo kytaristovi, kterému by se podařilo přijít o všechny kanály, a po kroku D by se ke svému zapojení už nedostal.

Důsledek, který je správný a stojí za zmínku v reportu: **back-vokální overlay řádek kytaristy** má `ownerRole: "guitar"` a `group: "vocs"`. `Edit inputs` se u něj nabídne a otevře **kytarový** katalog — je to vlastnická akce nad jeho nástrojem, stejně jako `Edit kit` na bubeníkově back-vokálním řádku. Není to vada.

**Zápis patche jde do `snapshot.lineup`, ne do `project`.** Přesně jako `applyRowChange` a `applyDrumKitChange`. Persistence tím dojede sama: `InputsEditorSnapshot` nese `lineup` (`:136-142`), `isInputsDirty` porovnává celý snapshot přes `JSON.stringify` a `saveSnapshot` posílá `lineup` (`:1256`). Ověřeno u Tasku 16 F5c pro `Edit kit` — nezavádí se nová cesta.

**Existující struktura, o kterou se opřeš:**

- `selectedRow: InputEditorRow | null` — vybraný řádek tabulky.
- `getSlotOverride(lineup, role, slotIndex)` (`:213`) — patch slotu.
- `replaceSlotOverride(lineup, role, slotIndex, nextPatch)` (`:239`) — zápis; `drumDefinition` nechává být, prázdný patch vypustí.
- `parseSlotIndex(slotKey)` (`:158`).
- `presetCatalog` (`:411`), `setupData` (`:333`).
- `composeSetupModalTitle` (`app/domain/ui/setupModalTitle`) — používá ho dnes modál na `01` (`ProjectSetupPage.tsx:1965-1972`), skládá `„<jméno> — <nástroje>"`. Použij ho i tady, ať mají oba modály stejný titulek.

- [ ] **Krok 1: Přidej tlačítko do inspektoru**

V `InputRowInspector.tsx` přidej do destrukturalizace propů `onEditInputs`, do typu `onEditInputs: () => void;` a do bloku `inputInspector__actions` **nad** `Edit kit`:

```tsx
              {supportsInputsModal(row.ownerRole) ? (
                <button
                  type="button"
                  className="button-secondary"
                  onClick={onEditInputs}
                >
                  Edit inputs
                </button>
              ) : null}
```

Import: `import { supportsInputsModal } from "../../domain/inputs/resolveInputsFieldSections";`

Do doc komentáře komponenty (`:32-37`, kde je dnes odstavec o `Edit kit`) přidej sourozenecký odstavec:

```
 * `Edit inputs` (F5d R4) je totéž pro nástrojové role, co `Edit kit` pro
 * bicí: mění celou sadu kanálů slotu volbou zapojení a doplňků, ne jeden
 * řádek. Nabízí se podle `row.ownerRole` (`supportsInputsModal`), ne podle
 * `row.group` — kytaristův back-vokální řádek nese `group: "vocs"`, ale
 * `Edit inputs` u něj otevře kytarové zapojení, protože je to vlastnická
 * akce nad jeho nástrojem. Za bránu `resolveInputRowEditability` se
 * neschovává ze stejného důvodu jako `Edit kit`: ta brána zavírá cesty, které
 * dokument nečte, a tahle je čte.
```

- [ ] **Krok 2: Uprav testy inspektoru**

`onEditInputs` je povinný prop, takže existující testy v `InputRowInspector.test.tsx` a `ProjectInputsPage.test.tsx` přestanou kompilovat. Doplň `onEditInputs={() => {}}` všude, kde se komponenta renderuje, a přidej dva testy:

```tsx
  it("offers Edit inputs on a guitar row", () => {
    const html = renderInspector({ ownerRole: "guitar", group: "guitar" });
    expect(html).toContain("Edit inputs");
  });

  it("does not offer Edit inputs on a drums row — the kit has its own editor", () => {
    const html = renderInspector({ ownerRole: "drums", group: "drums" });
    expect(html).not.toContain("Edit inputs");
    expect(html).toContain("Edit kit");
  });

  it("offers Edit inputs on a guitarist's back-vocal overlay row", () => {
    // Owner action over his instrument, not over the overlay row — same shape
    // as `Edit kit` on a drummer's back-vocal row.
    const html = renderInspector({ ownerRole: "guitar", group: "vocs" });
    expect(html).toContain("Edit inputs");
  });
```

`renderInspector` je pomocník, který v tom souboru pravděpodobně už existuje — použij jeho skutečné jméno a tvar; pokud tam není, napiš ho podle vzoru okolních testů (`renderToStaticMarkup(<InputRowInspector … />)`).

- [ ] **Krok 3: Spusť testy a ověř, že padají**

Run: `npx vitest run packages/desktop/src/app/components/inputs/InputRowInspector.test.tsx`
Expected: FAIL — tlačítko zatím není, resp. TS hlásí chybějící prop.

- [ ] **Krok 4: Zapoj modál do stránky**

V `ProjectInputsPage.tsx`:

**(a) Importy** — přidej:

```ts
import { InputsSetupSection } from "../components/inputs/InputsSetupSection";
import { resolveInputsEditState } from "../domain/inputs/resolveInputsEditState";
import { buildSetupFieldCatalog } from "./shared/setupConstants";
import { composeSetupModalTitle } from "../domain/ui/setupModalTitle";
import { resolveDistinctInstrumentLabels } from "../../../../../src/domain/lineup/effectiveInstrumentGroups";
```

Cesty ověř proti sousedním importům v souboru; `resolveDistinctInstrumentLabels` má `ProjectSetupPage.tsx` na `:6`, hloubka se ale liší podle adresáře.

**(b) Stav** — vedle `const [showEditKitModal, setShowEditKitModal] = useState(false);` (`:342`):

```ts
  const [showEditInputsModal, setShowEditInputsModal] = useState(false);
```

**(c) Katalog polí** — vedle `monitorEntities` (`:414`):

```ts
  /** Katalogy polí sekce Inputs (F5d R4) — tytéž, ze kterých četl modál na `01`. */
  const setupFieldCatalog = useMemo(
    () => buildSetupFieldCatalog(presetCatalog),
    [presetCatalog],
  );
```

**(d) Stav modálu pro vybraný řádek** — vedle `selectedDrumSetup` (`:833`):

```ts
  /**
   * Vstup pro modál `Edit inputs` (F5d R4). Počítá se jen pro vybraný řádek a
   * jen pro role, kterým se modál nabízí — `null` znamená „tlačítko není".
   * Patch se bere ze slotu, ne z draftu: obrazovka `02` žádný draft nemá,
   * každá změna jde rovnou do `snapshot.lineup`, stejně jako `Edit kit`.
   */
  const selectedInputsEditState = useMemo(() => {
    if (!selectedRow?.slotKey) return null;
    if (!supportsInputsModal(selectedRow.ownerRole)) return null;
    const slotIndex = parseSlotIndex(selectedRow.slotKey);
    const patch = getSlotOverride(lineup, selectedRow.ownerRole, slotIndex);
    return resolveInputsEditState({
      role: selectedRow.ownerRole,
      musicianId: selectedRow.ownerMusicianId ?? "",
      patch,
      setupData,
      presetCatalog,
    });
  }, [selectedRow, lineup, setupData, presetCatalog]);
```

Import `supportsInputsModal` z `../domain/inputs/resolveInputsFieldSections`.

**(e) Zápis patche** — vedle `applyDrumKitChange` (`:1008`):

```ts
  /**
   * Zapíše patch z modálu `Edit inputs` (F5d R4) do slotu vlastníka. Stejná
   * cesta jako `applyRowChange` a `applyDrumKitChange`: do `snapshot.lineup`,
   * ne do `project`, jinak by se změna v tabulce projevila až po uložení.
   * `replaceSlotOverride` prázdný patch vypustí a `drumDefinition` nechá být.
   */
  const applyInputsSetupPatch = useCallback(
    (row: InputEditorRow, nextPatch: PresetOverridePatch | undefined) => {
      if (!row.slotKey) return;
      const role = row.ownerRole;
      const slotIndex = parseSlotIndex(row.slotKey);
      setState((current) => {
        if (current.kind !== "ready") return current;
        return {
          ...current,
          snapshot: {
            ...current.snapshot,
            lineup: replaceSlotOverride(current.snapshot.lineup, role, slotIndex, nextPatch),
          },
        };
      });
    },
    [],
  );
```

**(f) Prop v inspektoru** — vedle `onEditKit` (`:1479`):

```tsx
            onEditInputs={() => setShowEditInputsModal(true)}
```

**(g) Render modálu** — vedle `Edit kit` modálu (`:1583`):

```tsx
      <InputsSetupSection
        open={showEditInputsModal && Boolean(selectedRow && selectedInputsEditState)}
        title={
          selectedRow && selectedInputsEditState
            ? composeSetupModalTitle({
                templateType: project?.purpose === "generic" ? "generic" : "event",
                musicianName: ownerName,
                instrumentLabels: resolveDistinctInstrumentLabels(
                  selectedInputsEditState.effectivePreset.inputs,
                ),
              })
            : "Edit inputs"
        }
        role={selectedRow?.ownerRole ?? "bass"}
        state={
          selectedInputsEditState ?? {
            defaultPreset: { inputs: [], monitoring: { monitorRef: "wedge_foh" } },
            effectivePreset: { inputs: [], monitoring: { monitorRef: "wedge_foh" } },
          }
        }
        fieldCatalog={setupFieldCatalog}
        onPatch={(nextPatch) => selectedRow && applyInputsSetupPatch(selectedRow, nextPatch)}
        onClose={() => setShowEditInputsModal(false)}
      />
```

**(h) Zavření modálu při změně výběru** — do `selectChannelRow` (nebo tam, kde se mění `selectedInputKey`) přidej `setShowEditInputsModal(false);`. `Edit kit` tenhle problém nemá, protože `isEditKitModalOpen` visí na `selectedDrumSetup`; `Edit inputs` by jinak zůstal otevřený nad jiným vlastníkem. Ověř to čtením a v reportu napiš, kterou cestou jsi to vyřešil.

- [ ] **Krok 5: Spusť testy a ověř, že prošly**

```bash
npx vitest run packages/desktop/src/app/components/inputs/
npx vitest run packages/desktop/src/app/pages/
npx tsc -p packages/desktop/tsconfig.json --noEmit 2>&1 | grep -c "error TS"
```

Expected: PASS; tsc `10`.

- [ ] **Krok 6: Změř rozpočet 60–100 řádků**

```bash
git diff --stat -- packages/desktop/src/app/pages/ProjectInputsPage.tsx
```

Expected: přibližně `+70 −0`. **Nad 100 vložených řádků task nezavírej** — vytáhni přebytek do `app/domain/inputs/` a zapiš v reportu, co se přesunulo.

- [ ] **Krok 7: Ověř nad reálným projektem, že patch dojede do dokumentu**

Headless skript, který reprodukuje zápisovou cestu `applyInputsSetupPatch` nad reálným projektem z `%APPDATA%/StagePilot` — vzor `.superpowers/sdd/2026-08-17-inputs-screen/task-15-domain-verification.md`. Vezmi projekt s kytaristou, zapiš mu `presetOverride` ve tvaru, jaký posílá `buildGuitarFields` při přepnutí na `el_guitar_xlr_mono`, prožeň `buildDocument` a porovnej `vm.inputs` před a po. **Skript nic neukládá, jen čte.**

Expected: kanál `el_guitar_mic` zmizí, `el_guitar_xlr` přibude, čísla kanálů pod ním se posunou. Pozor při čtení očekávaných hodnot: přidaný kanál může vyplnit `spare_ch_N` (stereo pár `keys_l`/`keys_r` musí začít na lichém, `assignPdfChannels.ts:45`), takže se spare místo přibytí řádku jen ztratí a celkový počet zůstane — není to vada.

- [ ] **Krok 8: Ověř, že se nic jiného nerozbilo**

```bash
npm test 2>&1 | tail -5
npx vitest run src/domain/pipeline/buildDocument.pdfRegression.test.ts
```

Expected: +3 testy proti Tasku 10, tytéž dvě baseline selhání, `pdfRegression` zelený s nedotčenými očekáváními.

- [ ] **Krok 9: Ověř lint**

Recept z Global Constraints pro `InputRowInspector.tsx`, `InputRowInspector.test.tsx`, `ProjectInputsPage.tsx`, `ProjectInputsPage.test.tsx`, na HEAD i BASE. Expected: delta 0. Pozor na `organizeImports` — právě to našla LF-normalizovaná kopie u Tasků 17 a 19a ve F5c, když se do těchhle souborů přidával import.

- [ ] **Krok 10: Commit**

```bash
git add packages/desktop/src/app/components/inputs/InputRowInspector.tsx \
        packages/desktop/src/app/components/inputs/InputRowInspector.test.tsx \
        packages/desktop/src/app/pages/ProjectInputsPage.tsx \
        packages/desktop/src/app/pages/ProjectInputsPage.test.tsx
git commit -m "feat(inputs): wire the Edit inputs modal into the row inspector on screen 02"
```

---
### Task 12: Zrušení `+ Add input`, `AddInputPicker`, `addInputRow` a `GROUP_INPUT_LIBRARY` — **jeden commit**

**Files:**
- Delete: `packages/desktop/src/app/components/inputs/AddInputPicker.tsx` (144 ř.)
- Modify: `packages/desktop/src/app/pages/ProjectInputsPage.tsx` (import, stav `showAddInputPicker`, `ownerOptions`, `getAvailableChannelsForOwner`, `addChannelToOwner`, tlačítko `+ Add input`, render pickeru)
- Modify: `packages/desktop/src/app/pages/shared/setupConstants.ts` (smazat `GROUP_INPUT_LIBRARY`, `:47-70`)
- Modify: `packages/desktop/src/app/domain/inputs/toggleInputRow.ts` (smazat `addInputRow`)
- Modify: `packages/desktop/src/app/domain/inputs/toggleInputRow.test.ts` (smazat `describe("addInputRow")`)
- Modify: `packages/desktop/src/app/domain/inputs/resolveInputRowEditability.ts:41` a `resolveInputRowEditability.test.ts:65` (komentáře)
- Modify: `packages/desktop/src/app/pages/ProjectInputsPage.test.tsx` (pokud picker testuje)

**Interfaces:**
- Consumes: fungující `Edit inputs` z Tasku 11 — **bez něj by nezůstala žádná cesta, jak kanál přidat.**
- Produces: nic nového. Mizí `GROUP_INPUT_LIBRARY`, `AddInputPicker`, `AddInputOwnerOption`, `addInputRow`.

**Proč jeden commit**

Katalog má po Tasku 3 jediného konzumenta — picker (`ProjectInputsPage.tsx:769`). Kdyby se katalog mazal dřív, picker by neměl z čeho brát; kdyby se picker rušil dřív, přesunul by se kus UI práce do kroku A. Rozdělené by to nechalo fázi stát na půl cesty s mrtvým kódem, který `CLAUDE.md` zakazuje. **Nedej se přemluvit k rozdělení, ani kdyby review chtěla menší diff.**

**Hlubší důvod, ne jen úspora kódu.** Každý druh kanálu má v modelu jednu strukturovanou reprezentaci: bicí `drumDefinition`, nástrojové preset + `presetOverride`, vokály a talkback `ProjectOverlays`. `inputs.add`/`removeKeys` **není čtvrtá reprezentace** — je to mechanismus odchylky nad jednou z nich. Když tentýž kanál umí vzniknout dvěma cestami, přestává být z dat poznatelné, proč tam je. A přesně na to se ptá půl obrazovky `02`: `DEVIATIONS N`, `Reset to default`, odznak `• Modified`, přeškrtnutý řádek.

**Picker nenabízel nic vlastního** a z poloviny lhal: `gtr_mic` a `gtr_di` v datech nejsou (M1) a `gtr_mic` rozbíjí rozpoznání kytaristy (M2). Obsluhoval právě tři role — `drums` a `vocs` jsou z něj vyloučené branou, talkback nemá slot (`ProjectInputsPage.tsx:725-753`) — a sekce Inputs pokrývá **celý** prostor klíčů pro všechny tři:

| Role | Pole sekce Inputs | Klíče, které umí vyrobit |
|---|---|---|
| bass | Connection + Mic on cabinet + Bass synth | `el_bass_xlr_amp`, `el_bass_xlr_pedalboard`, `el_bass_mic`, `bass_synth` |
| guitar | Connection + Mic on cabinet + Acoustic guitar | `el_guitar_mic`, `el_guitar_xlr`, `el_guitar_xlr_l`, `el_guitar_xlr_r`, `ac_guitar` |
| keys | Connection + Keys units | `keys`, `keys_l`, `keys_r` |

**R4 z F5c se tím přeformulovává** z „přidání kanálu je dvoukrokový výběr z katalogu" na **„přidání kanálu je volba zapojení nebo doplňku u jeho vlastníka"**.

**Co se NEMAŽE:**

- Brána `resolveInputRowEditability` sama zůstává (R2, R7) — jen se nedá dál vysvětlovat neexistující konstantou. Přepiš komentář, ne kód.
- `removeInputRow` a `restoreInputRow` v `toggleInputRow.ts` zůstávají — pořád je volá `Remove channel`/`Restore channel`.
- **Ruling 6 z hlavičky plánu:** `removeInputRow` si nechává sjednocení `remove` + `removeKeys`. Zapisovatel do `removeKeys` mizí až v Tasku 13, ale uložená data ho nesou dál (M3) a doména obě pole při čtení slučuje. Komentář o `buildInputsPatchFromTarget` (`toggleInputRow.ts:46`) přepisuje **Task 13**, ne tenhle — funkce v tuhle chvíli ještě existuje.

- [ ] **Krok 1: Zmapuj, co všechno mizí**

```bash
cd /c/Users/mkrecmer/dev/stagepilot
grep -rn "AddInputPicker\|AddInputOwnerOption\|addInputRow\|GROUP_INPUT_LIBRARY\|showAddInputPicker\|Add input" \
  --include=*.ts --include=*.tsx src packages/desktop/src
```

Zapiš si výsledek — v kroku 6 se proti němu ověřuje, že nic nezbylo.

- [ ] **Krok 2: Uprav testy, které picker kryjí**

V `toggleInputRow.test.ts` smaž celý `describe("addInputRow")` (`:48` a dál) a import `addInputRow`. Test `removes an added channel from add instead of writing it to remove` (kolem `:15`) používá `addInputRow` k přípravě patche — **přepiš přípravu na literál**, test samotný zůstává:

```ts
    const added = { inputs: { add: [{ key: "extra", label: "Extra" }] } };
```

V `ProjectInputsPage.test.tsx` smaž testy, které renderují nebo ověřují `+ Add input` (pokud tam jsou).

- [ ] **Krok 3: Spusť testy a ověř, že padají**

Run: `npx vitest run packages/desktop/src/app/domain/inputs/toggleInputRow.test.ts`
Expected: FAIL na kompilaci, dokud `addInputRow` v testu zbývá, nebo PASS, pokud jsi ho vyčistil úplně. Cílem kroku je, aby test **nezávisel** na mazané funkci.

- [ ] **Krok 4: Smaž picker a jeho volací místa**

**(a)** `rm packages/desktop/src/app/components/inputs/AddInputPicker.tsx`

**(b)** V `ProjectInputsPage.tsx` smaž:
- import `{ type AddInputOwnerOption, AddInputPicker }` (`:24-26`),
- import `addInputRow` z bloku `toggleInputRow` (`:61`) — `removeInputRow` a `restoreInputRow` **zůstávají**,
- import `GROUP_INPUT_LIBRARY` (`:81`),
- stav `showAddInputPicker` (`:341`),
- `ownerOptions` včetně doc komentáře (`:713-753`),
- `getAvailableChannelsForOwner` včetně doc komentáře (`:755-773`),
- `addChannelToOwner` včetně doc komentáře (`:1032-1061`),
- tlačítko `+ Add input` (`:1394-1402`),
- render `<AddInputPicker … />` (`:1575-1581`).

Po smazání zkontroluj, jestli neosiřely importy `slotKeysByOwner`, `CANONICAL_LINEUP_ROLE_ORDER`, `getRoleSlotLimit`, `normalizeLineupSlots` nebo `resolveInputRowEditability` — **`slotKeysByOwner` a `resolveInputRowEditability` mají další konzumenty** (`buildInputEditorRows`, `InputRowInspector`), takže je nemaž bez ověření. Řiď se tím, co hlásí `tsc`, ne odhadem.

**(c)** V `setupConstants.ts` smaž `GROUP_INPUT_LIBRARY` (`:47-70`) a zkontroluj, jestli tím neosiřely importy `createDefaultDrumDefinition` / `resolveDrumInputs` — **neosiřely**, oba používá `getGroupDefaultPreset` po Tasku 3. Import `Group` a `InputChannel` taky zůstává.

**(d)** V `toggleInputRow.ts` smaž `addInputRow` (`:87` a dál). `withInputs` zůstává — volá ho `removeInputRow` i `restoreInputRow`.

- [ ] **Krok 5: Přepiš komentáře, které se odvolávají na katalog**

`resolveInputRowEditability.ts:36-45` — poslední odstavec doc komentáře („Použití: …") mluví o `+ Add input`'s kroku 1 a `GROUP_INPUT_LIBRARY[owner.role]`. Nahraď:

```
 * Použití: `InputRowInspector` volá s (`row.ownerRole`, `row.group`) vybraného
 * řádku, aby zavřel `Remove channel`/`Restore channel`. Druhý volající —
 * dvoukrokový picker `+ Add input` — zanikl s F5d R5: kanál se přidává volbou
 * zapojení nebo doplňku u jeho vlastníka (`Edit inputs`, `Edit kit`), ne
 * výběrem z paralelního katalogu, takže brána už jen zavírá řádky, ne cestu
 * ke vzniku nových.
```

`resolveInputRowEditability.test.ts:65` — komentář o `GROUP_INPUT_LIBRARY[owner.role]` přepiš stejným směrem. **Testy samotné nechej beze změny** — brána se nemění.

- [ ] **Krok 6: Ověř grepem, že v kódu nezbylo nic**

```bash
grep -rn "GROUP_INPUT_LIBRARY\|buildGroupInputLibrary\|AddInputPicker\|AddInputOwnerOption\|addInputRow" \
  --include=*.ts --include=*.tsx src packages/desktop/src
```

**Expected: prázdný výstup.** To je verifikace předepsaná specem („po commitu kroku C nesmí v repu zbýt výskyt … v kódu, v testech ani v komentářích").

**Ruling 3 z hlavičky plánu:** grep je omezený na `src/` a `packages/`. Doslovný grep přes celý repozitář trefí i `docs/superpowers/specs/**`, `docs/superpowers/plans/2026-08-17-inputs-screen.md`, `.superpowers/sdd/2026-08-17-inputs-screen/**` a `analysis/pdf_rendering_analysis.md` — historické artefakty, které se nepřepisují, protože popisují stav, který tehdy platil. **Tenhle plán je jeden z nich.**

Zkontroluj taky, že v UI nikde nezbylo tlačítko:

```bash
grep -rn "Add input" --include=*.tsx --include=*.css packages/desktop/src
```

Expected: prázdný výstup. Kdyby zbyla osiřelá CSS třída, smaž ji taky.

- [ ] **Krok 7: Spusť testy a ověř, že prošly**

```bash
npx vitest run packages/desktop/src/app/
npx tsc -p packages/desktop/tsconfig.json --noEmit 2>&1 | grep -c "error TS"
```

Expected: PASS; tsc `10`. `tsc` je tady hlavní nástroj — najde každý osiřelý import, který jsi přehlédl.

- [ ] **Krok 8: Ověř, že se nic jiného nerozbilo**

```bash
npm test 2>&1 | tail -5
npx vitest run src/domain/pipeline/buildDocument.pdfRegression.test.ts
```

Expected: **ubude několik testů** (`describe("addInputRow")` měl 3, plus případné testy pickeru v `ProjectInputsPage.test.tsx`). **Rozdíl vysvětli v reportu položku po položce** — „ubyly 3 testy, protože `addInputRow` přestal existovat" je platné, holé číslo ne. Baseline selhání tytéž dvě. `pdfRegression` zelený s nedotčenými očekáváními.

- [ ] **Krok 9: Smoke test tisku**

```bash
npm run smoke:stageplan-print
```

Přepnutí zapojení mění text v boxech, takže i jejich šířku (R6 z F5c). Smoke ověřuje glyph tabulku proti Chromiu a nepřetečení boxů. Expected: projde. Kdyby ne, porovnej výstup s během **před** krokem C — může to být pre-existing stav dvou projektů `blanicka_kapela`, které se po F7 nevyexportují kvůli kolizi boxů a čekají na ruční přerovnání.

- [ ] **Krok 10: Ověř lint**

Recept z Global Constraints pro `ProjectInputsPage.tsx`, `setupConstants.ts`, `toggleInputRow.ts`, `toggleInputRow.test.ts`, `resolveInputRowEditability.ts`, `resolveInputRowEditability.test.ts`, na HEAD i BASE. Expected: delta 0 (nebo záporná — smazané řádky můžou vzít nálezy s sebou; to je v pořádku, jen to zapiš).

- [ ] **Krok 11: Commit — jeden, na všechno**

```bash
git add -A packages/desktop/src/app/components/inputs/AddInputPicker.tsx \
           packages/desktop/src/app/pages/ProjectInputsPage.tsx \
           packages/desktop/src/app/pages/ProjectInputsPage.test.tsx \
           packages/desktop/src/app/pages/shared/setupConstants.ts \
           packages/desktop/src/app/domain/inputs/toggleInputRow.ts \
           packages/desktop/src/app/domain/inputs/toggleInputRow.test.ts \
           packages/desktop/src/app/domain/inputs/resolveInputRowEditability.ts \
           packages/desktop/src/app/domain/inputs/resolveInputRowEditability.test.ts
git commit -m "refactor(inputs): drop the Add input picker and the hand-written group input library"
```

Ověř, že smazaný soubor je v commitu jako `delete`: `git show --stat HEAD | grep AddInputPicker`.

---
## KROK D — dokončení Tasku 19 (R6)

Jediný task. **Smazání se dělá jedním commitem, aby šlo vrátit** — to je zmírnění rizika 1 ze specu: `ProjectSetupPage.tsx` vlastní test nemá, byl to důvod R16 z F5c a nezměnilo se to. Druhé zmírnění je pořadí: krok C proběhl a je zelený, takže nová cesta je ověřená dřív, než stará zmizí.

**Rozdělení `ProjectSetupPage.tsx` na komponenty je mimo rozsah.** Fáze soubor jen zmenší smazáním modálu (dnes 2728 řádků). Restrukturalizace zbytku je samostatná úloha; míchat ji s přesunem znamená, že u padlého testu nepoznáš, která změna za to může.

### Task 13: Smazání setup modálu z `ProjectSetupPage.tsx`, `Setup` naviguje na `/inputs`

**Files:**
- Modify: `packages/desktop/src/app/pages/ProjectSetupPage.tsx`
- Modify: `packages/desktop/src/app/pages/shared/setupConstants.ts` (smazat `buildInputsPatchFromTarget`, `:255-268`)
- Modify: `packages/desktop/src/app/domain/inputs/toggleInputRow.ts:44-49` a `toggleInputRow.test.ts:36` (komentáře)

**Interfaces:**
- Consumes: fungující `Edit inputs` na `02` z Tasků 10–12.
- Produces: nic nového. Mizí `buildInputsPatchFromTarget`.

**Kontext, který nesmíš přehlédnout**

**Co se maže** (řádky podle dnešního stavu, po Tasku 12 se posunou — orientuj se podle jmen, ne podle čísel):

- `ModalOverlay` s `open={Boolean(editingSetup)}` (`:1921-2356`) — celý blok včetně IIFE uvnitř.
- Stav: `editingSetup` (`:439`), `setupDraftBySlot` (`:444`), `selectedSetupSlotKey` (`:447`), `setupEditorRef` (`:1488`), `setupMusicians` (`:1325`) a `useEffect`, který dopočítává `selectedSetupSlotKey` (`:1344-1361`), `selectedSetupMusician` (`:1363`).
- Pomocníci: `resolveDraftOverride` (`:1184`), `getExistingSlotOverride` (`:1210`), `applySetupDraftOverrides` (`:1220`), `buildSetupDraftEntries` (`:1408`), `isDiffOriginOverridden` (`:1193`) — pokud po smazání modálu nemá jiného konzumenta, ověř grepem.
- `openSetupForRole` (`:1429`) — mizí a nahrazuje ho navigace.
- Potvrzovací modál `Update defaults` (`:1833-1918`), pokud stojí výhradně na `selectedSetupMusician` — **ověř**; je to `showUpdateMusicianDefaultsConfirmation` a čte `selectedSetupMusician?.musicianName`. Bez modálu nemá kdo ho otevřít, takže mizí s ním.
- Importy, které tím osiří: `resolveEffectiveInstrumentGroups` (`:7`), `resolveDistinctInstrumentLabels` (`:6`), `resolveInputsForCapabilitySection` (`:11`), `areSetupsEqual` (`:68`), `SchemaRenderer` (`:63`), `SetupModalShell` (`:64`), `SetupSection` (`:65`), `EventSetupEditState` (`:67`), `shouldEnableSetupReset` (`:70`), `composeSetupModalTitle` (`:84`), `buildInputsPatchFromTarget` (`:99`), `resolveDrumInputs` (`:4`), `SetupMonitoringEditor` (`:35`), `DrumsPartsEditor` (`:30`), `resolveDrumsSetupDefinition` (`:95`), `validateEffectivePresets` (`:28`) — **`validateEffectivePresets` NE**, viz níž.

**Co se ZACHOVÁ, i když to vypadá jako součást modálu:**

- **`supportsCapabilitySection`** (import `:13`) — visí na `resolveEligibleMembersForSection` (`:1375-1387`), mimo modál.
- **`effectiveSlotPresets`** (`:1268`) a **`overrideValidation`** (`:1295`) — validace lineupu na `01` je jejich jediný konzument a s modálem nesouvisí. S nimi zůstává `validateEffectivePresets`, `monitorsById`, `monitorEntities`.
- **`normalizeSetupOverridePatch`** (`:26`) — používá ho `buildSetupDraftEntries`, ale i `applySetupDraftOverrides`; po smazání obojího **ověř grepem**, jestli má jiného konzumenta, než ho smažeš z importů.
- `setupForSlot` a `defaultPresetFor` z `useSetupOverrides` — čte je `effectiveSlotPresets` i `resolveSetupCardLabel`.

**Karta muzikanta naviguje na `/inputs`.** Tlačítko `Setup` v `LineupRow` (`:1611-1619`) dnes volá `openSetupForRole(role)`. Nahradí ho navigace. **Cíl se bere z `nextStepPath`, nikdy zadrátovanou cestou** (past 5 z handoffu F5c) — soubor už `nextStepPath` importuje (`:87`) a používá (`:1765-1766`) pro tlačítko `Continue`.

**Tím zmizí dvojí bookkeeping bicí soupravy.** `ProjectSetupPage.tsx:2210-2260` dnes při každé změně kitu zapisuje `drumDefinition` (`:2229`) **a zároveň** `buildInputsPatchFromTarget(...)` do `setSetupDraftBySlot` (`:2236-2260`), což skončí jako `presetOverride.inputs.{add, removeKeys}`. Obrazovka `02` to vědomě nereplikuje (`ProjectInputsPage.tsx:265-294`, `replaceSlotDrumDefinition`). **Po commitu tohohle tasku nesmí v repu zbýt volací místo `buildInputsPatchFromTarget` z editace kitu** — a protože jiné volací místo nemá, maže se celá funkce.

Že dva zdroje pravdy dnes žijí, je vidět na `ProjectInputsPage.tsx:191-204`, kde `countOwnerDeviations` musí `presetOverride` a `drumDefinition` sčítat ručně.

**Migrace uložených dat není potřeba (M3).** Ve všech 51 JSON souborech v `%APPDATA%/StagePilot` je jediný slot nesoucí `drumDefinition` i neprázdný `presetOverride.inputs.*` zároveň, a je v archivní verzi z 19. 5. 2026. `buildDocument` s ním i bez něj dává identický dokument. Krok 4 to znovu ověří.

- [ ] **Krok 1: Zmapuj rozsah smazání**

```bash
cd /c/Users/mkrecmer/dev/stagepilot
git rev-parse HEAD > /tmp/f5d-base-task13.txt   # návratový bod, kdyby smazání ujelo
wc -l packages/desktop/src/app/pages/ProjectSetupPage.tsx
grep -n "editingSetup\|setupDraftBySlot\|selectedSetupSlotKey\|setupEditorRef\|setupMusicians\|selectedSetupMusician\|resolveDraftOverride\|getExistingSlotOverride\|applySetupDraftOverrides\|buildSetupDraftEntries\|openSetupForRole\|isDiffOriginOverridden\|showUpdateMusicianDefaultsConfirmation" \
  packages/desktop/src/app/pages/ProjectSetupPage.tsx
```

Zapiš si počet řádků před smazáním — v kroku 8 se hlásí delta.

- [ ] **Krok 2: Nahraď `Setup` navigací**

V `LineupRow` `actions` (`:1611-1619`) nahraď tlačítko:

```tsx
                  <button
                    type="button"
                    className="button-secondary"
                    disabled={slots.length === 0}
                    onClick={() => {
                      // F5d R6: sekce Inputs i monitoring slotu žijí od téhle
                      // fáze na obrazovce `02`. Cíl se bere z `processSteps`,
                      // ne zadrátovanou cestou, aby se flow `01 → 02 → 03 → 04`
                      // a process trail nemohly rozejít.
                      const target = nextStepPath("lineup", id);
                      if (target) navigate(target);
                    }}
                  >
                    Setup
                  </button>
```

Ověř, že `id` a `navigate` jsou v tomhle scope dostupné — jsou, `Continue` je používá na `:1765-1766`.

Zvaž přejmenování popisku `Setup` na něco, co říká, kam vede. **Nepřejmenovávej ho v tomhle tasku** — je to změna copy, ne funkce, a smíchaná se smazáním 400 řádků se špatně recenzuje. Zapiš návrh do reportu.

- [ ] **Krok 3: Smaž modál a jeho stav**

Postupuj shora dolů podle mapy z Kroku 1. Po každém bloku spusť `npx tsc -p packages/desktop/tsconfig.json --noEmit` — je to jediný nástroj, který ti spolehlivě řekne, co osiřelo. **Nemaž importy odhadem, maž je podle toho, co hlásí `tsc`.**

Pořadí, které minimalizuje mezistavy:
1. render modálu (`ModalOverlay` s `editingSetup`) a `Update defaults` potvrzení,
2. `openSetupForRole`, `buildSetupDraftEntries`, `applySetupDraftOverrides`,
3. `selectedSetupMusician`, `setupMusicians`, `useEffect` na `selectedSetupSlotKey`,
4. `resolveDraftOverride`, `getExistingSlotOverride`, `isDiffOriginOverridden`,
5. `setupEditorRef`, tři `useState`,
6. importy.

Po každém kroku ověř, že `effectiveSlotPresets`, `overrideValidation`, `resolveEligibleMembersForSection` a `resolveSetupCardLabel` pořád stojí.

- [ ] **Krok 4: Smaž `buildInputsPatchFromTarget` a přepiš komentáře**

```bash
grep -rn "buildInputsPatchFromTarget" --include=*.ts --include=*.tsx src packages/desktop/src
```

Po Kroku 3 zbývají tři výskyty: definice v `setupConstants.ts:255-268`, komentář v `toggleInputRow.ts:44-49` a komentář v `toggleInputRow.test.ts:36`. Smaž definici; oba komentáře přepiš.

`toggleInputRow.ts:44-49` — dnešní text vysvětluje sjednocení `remove` + `removeKeys` tím, že obrazovka `01` zapisuje do `removeKeys`. Ta cesta právě zanikla, ale merge zůstává (Ruling 6):

```
 * Duplicitu kontroluje proti sjednocení `remove` i legacy `removeKeys`.
 * Zapisovatel do `removeKeys` — editor kitu na obrazovce `01` přes
 * `buildInputsPatchFromTarget` — zanikl s F5d R6, ale uložené projekty ho
 * dál nesou a doména je při čtení stejně slučuje (`applyPresetOverride`).
 * Bez téhle kontroly by šlo stejný kanál zapsat do `remove` podruhé, i když
 * je díky `removeKeys` ze starých dat už vypnutý.
```

`toggleInputRow.test.ts:36` přepiš stejným směrem. **Merge logiku ani test nemaž** — M3 ukazuje, že `removeKeys` v uložených datech je.

- [ ] **Krok 5: Ověř nad reálnými daty, že migrace není potřeba**

```bash
node --input-type=module -e "
import {readdirSync,readFileSync,statSync} from 'node:fs';
const root=process.env.APPDATA+'/StagePilot';
const hits=[];
(function walk(d){for(const e of readdirSync(d)){const p=d+'/'+e;
  if(statSync(p).isDirectory()) walk(p);
  else if(e.endsWith('.json')){
    let j; try{ j=JSON.parse(readFileSync(p,'utf8')); }catch{ return; }
    for(const [role,v] of Object.entries(j?.lineup??{}))
      for(const s of [v].flat())
        if(s?.drumDefinition && s?.presetOverride?.inputs &&
           Object.keys(s.presetOverride.inputs).length)
          hits.push([p.replace(root,''), role, Object.keys(s.presetOverride.inputs)]);
  }}})(root);
console.log(hits.length, hits);
"
```

Expected podle M3: **právě jeden zásah**, v `versions/019e4053-…/20260519-130407-312/project.json`, `lineup.drums[0]`, `["removeKeys"]`. Je to archivní verze a `buildDocument` s ním i bez něj dává identický dokument.

**Kdyby zásahů bylo víc než jeden nebo kdyby byl mimo `versions/`, zapiš to a eskaluj** — M3 by neplatila a bylo by potřeba rozhodnout o migraci. Neopravuj to sám.

- [ ] **Krok 6: Ověř, že editace kitu na `02` nezapisuje `presetOverride`**

Automaticky přes existující test `replaceSlotDrumDefinition` (Task 16 F5c ho zamkl):

```bash
npx vitest run packages/desktop/src/app/pages/ProjectInputsPage.test.tsx
grep -rn "replaceSlotDrumDefinition" --include=*.tsx packages/desktop/src/app/pages/ProjectInputsPage.tsx
```

Expected: test zelený; `applyDrumKitChange` volá **jen** `replaceSlotDrumDefinition`, žádný `replaceSlotOverride`. Ruční ověření nad uloženým JSON je bod 13 verifikace pro člověka.

- [ ] **Krok 7: Spusť testy a ověř, že prošly**

```bash
npx tsc -p packages/desktop/tsconfig.json --noEmit 2>&1 | grep -c "error TS"
npm test 2>&1 | tail -5
npx vitest run src/domain/pipeline/buildDocument.pdfRegression.test.ts
```

Expected: tsc `10` — **ani o jednu víc**; osiřelý import by se projevil jako 11. Testy: tytéž dvě baseline selhání a **žádný úbytek**, protože `ProjectSetupPage.tsx` vlastní test nemá. Kdyby něco ubylo, smazal jsi kus, který testovaný byl — vysvětli co. `pdfRegression` zelený s nedotčenými očekáváními.

- [ ] **Krok 8: Změř, o kolik soubor zmenšel**

```bash
wc -l packages/desktop/src/app/pages/ProjectSetupPage.tsx
git diff --stat -- packages/desktop/src/app/pages/ProjectSetupPage.tsx
```

Expected: z 2728 řádků dolů zhruba o 430–470. Číslo zapiš do reportu; je to jediné měřitelné potvrzení, že R16 z F5c má konečně splněnou premisu.

- [ ] **Krok 9: Smoke test tisku**

```bash
npm run smoke:stageplan-print
```

Expected: projde, se stejným výsledkem jako v Tasku 12.

- [ ] **Krok 10: Ověř lint**

Recept z Global Constraints pro `ProjectSetupPage.tsx`, `setupConstants.ts`, `toggleInputRow.ts`, `toggleInputRow.test.ts`, na HEAD i BASE. Expected: delta 0 nebo záporná.

**Pozor na `organizeImports`.** Právě v `ProjectSetupPage.tsx` a právě po zásahu do importů ho ve F5c dvakrát propásla agregátní kontrola (Task 19a, Task 20). Tenhle task maže patnáct importů — je to nejrizikovější místo celé fáze.

- [ ] **Krok 11: Commit — jeden, na všechno**

```bash
git add packages/desktop/src/app/pages/ProjectSetupPage.tsx \
        packages/desktop/src/app/pages/shared/setupConstants.ts \
        packages/desktop/src/app/domain/inputs/toggleInputRow.ts \
        packages/desktop/src/app/domain/inputs/toggleInputRow.test.ts
git commit -m "refactor(setup): delete the lineup setup modal and route the Setup button to screen 02"
```

---
## VLNA 2 — overlays z `02` a osiřelý vokální monitor mix (R7, Nález 1)

**Oddělitelný blok. Kdyby se fáze musela zkrátit, řízne se tady** a F5d zůstane celá — kroky A–D jsou uzavřená, dodatelná fáze.

Co vlna 2 dělá: zpřístupní přidání a odebrání lead vokálu, back vokálu a talkbacku z obrazovky `02`. Dnes to jde jen z `01` (`LeadVocsBlock`/`BackVocsBlock` na `ProjectSetupPage.tsx:1625-1633` → `ChangeLeadVocsModal`/`ChangeBackVocsModal` na `:2363` a `:2407`, talkback řádek `:1667-1695`); `ProjectInputsPage.tsx` dnes slovo `overlays` neobsahuje ani jednou.

**Overlay cesta se obejde bez doménové změny** — overlays už existenci vstupních řádků plně řídí (O1, O2), takže Add/Remove na `02` jen zapisuje `project.overlays` stejně jako dnešní modály na `01`. Jediná doménová změna vlny je oprava osiřelého monitor mixu, a je to Task 14.

**R3 z F5c se pro vokály a talkback výslovně prohlašuje za neplatný.** Odebrání vokalisty je změna sestavy, ne vypnutí kanálu, a **řádek zmizí** — stejně jako se dnes chová `Change` na `01` (O3). Stav „zpěvák je v sestavě, ale nemá mikrofon" nikdo nepožadoval a v modelu pro něj reprezentace není.

**Brána `overlay-not-supported` v `resolveInputRowEditability` zůstává** — vlna 2 nepřidává patch cestu, přidává overlay cestu.

### Task 14: `buildPdfMonitorRows` — vokální monitor mix nesmí přežít odebrání z overlay + kontraktní test 5

**Files:**
- Modify: `src/domain/pipeline/pdf/buildPdfMonitorRows.ts:30-38` (`resolvePdfMonitorOwners`) a `:111-118` (volání)
- Test: `src/domain/pipeline/pdf/buildPdfMonitorRows.test.ts`
- Modify: `packages/desktop/src/app/domain/inputs/uiDocumentContract.test.ts` (kontraktní test 5)

**Interfaces:**
- Consumes: nic z kroků A–D.
- Produces: `buildPdfMonitorRows` — **signatura beze změny**; `leadVocsSlotByMusicianId` i `backVocsSlotByMusicianId` už v args jsou (`:106`, `:109`). `buildDocument.ts` se **nemění vůbec** — obě mapy do funkce už posílá (`:690`, `:693`).

**Kontext, který nesmíš přehlédnout**

**Nález 1 je živá vada, ne dluh po F5c.** Odebrání lead vokalisty z overlay nesmaže jeho monitorový řádek: po vyprázdnění `overlays.leadVocals` zůstaly v `monitorTableRows` i `stageplan.monitorOutputs` dva vokální monitor mixy, jen bez čísla a genderu. Dokument tedy vyjde s **nula** vokálními kanály a **dvěma** vokálními monitor mixy. Vyrobit se to dá dnes, jedním `Change` na `01`.

**Kořen.** Monitorové řádky staví `resolvePdfMonitorOwners` (`:30-38`) z **lineupu**, ne z overlays:

```ts
function resolvePdfMonitorOwners(args: {
  lineupMusicians: MonitorOwner[];
  effectiveSetupByMusicianId: EffectiveSetupByMusicianId;
}): MonitorOwner[] {
  const { lineupMusicians, effectiveSetupByMusicianId } = args;
  return lineupMusicians.filter(({ musician }) =>
    effectiveSetupByMusicianId.has(musician.id),
  );
}
```

Zápis do overlays proto mix neuklidí sám. **Šev, který plán určuje:** filtr se rozšíří o podmínku „vlastník s lineup rolí `vocs`, který není v žádném overlay slotu, monitor nedostane".

**Kritérium je lineup role `owner.group`, ne `musician.group`.** Basák, který zpívá back vokály, má `group: "bass"` a svůj basový monitor si nechává — do filtru nesmí spadnout. Vypadnout smí jen slot, jehož **jediný důvod existence** je zpěv, tedy `owner.group === "vocs"`.

**`stageplan.monitorOutputs` se opraví samo** — `buildPdfStageplan.ts:159` je mapuje z `args.monitorTableRows`. Jedna oprava, dvě místa.

**Testuje se na úrovni `buildPdfMonitorRows`, ne `buildDocument`.** Funkce má vlastní testový soubor a explicitní args, takže se scénář dá postavit přesně a bez stavby celého projektu. Kontrola nad celým dokumentem je kontraktní test 5 v Kroku 6.

- [ ] **Krok 1: Změř dnešní chování, než cokoli změníš**

```bash
cd /c/Users/mkrecmer/dev/stagepilot
sed -n '1,40p' src/domain/pipeline/pdf/buildPdfMonitorRows.ts
sed -n '1,40p' src/domain/pipeline/pdf/buildPdfMonitorRows.test.ts
```

Zapiš si přesné tvary `MonitorOwner`, `EffectiveSetupByMusicianId` a `MonitorPresetIndex` a jak si existující testy staví `repo` — fixtury v Kroku 2 musí sedět na ně, ne na tenhle plán.

- [ ] **Krok 2: Napiš padající test**

Do `src/domain/pipeline/pdf/buildPdfMonitorRows.test.ts` přidej. `repo`, `monitorsById` a tvar `MonitorOwner` přeber z pomocníků, které ten soubor už má; níž je uvedený scénář a aserce, které musí platit.

```ts
describe("resolvePdfMonitorOwners via buildPdfMonitorRows (F5d Nález 1)", () => {
  const singer: Musician = {
    id: "voc-1",
    firstName: "Voc",
    lastName: "One",
    group: "vocs",
    gender: "male",
    presets: [{ kind: "monitor", ref: "wedge_foh" }],
  };
  const bassist: Musician = {
    id: "bass-1",
    firstName: "Bass",
    lastName: "One",
    group: "bass",
    presets: [{ kind: "monitor", ref: "wedge_foh" }],
  };
  const effectiveSetup = new Map([
    ["voc-1", { inputs: [], monitoring: { monitorRef: "wedge_foh" } }],
    ["bass-1", { inputs: [], monitoring: { monitorRef: "wedge_foh" } }],
  ]);

  function rowsFor(args: { leadSlots: Array<[string, number]>; backSlots: Array<[string, number]> }) {
    return buildPdfMonitorRows({
      lineupMusicians: [
        { group: "bass", musician: bassist },
        { group: "vocs", musician: singer },
      ],
      effectiveSetupByMusicianId: effectiveSetup,
      monitorsById: { wedge_foh: { id: "wedge_foh", label: "Wedge" } },
      repo: makeRepo(),
      leadVocsCount: args.leadSlots.length,
      leadVocsSlotByMusicianId: new Map(args.leadSlots),
      leadVocsGenderBySlot: args.leadSlots.map(() => "male"),
      backVocsCount: args.backSlots.length,
      backVocsSlotByMusicianId: new Map(args.backSlots),
      backVocsGenderBySlot: args.backSlots.map(() => undefined),
    });
  }

  it("gives a vocs slot a monitor mix while he is in the lead overlay", () => {
    const rows = rowsFor({ leadSlots: [["voc-1", 1]], backSlots: [] });

    expect(rows.map((row) => row.ownerMusicianId)).toEqual(["bass-1", "voc-1"]);
  });

  it("drops the monitor mix of a vocs slot that is in no overlay at all", () => {
    // Removing a lead vocalist through `Change` on `01` empties
    // `overlays.leadVocals` but leaves the lineup slot in place. Monitor rows
    // are built from the lineup, so the mix used to survive a singer who
    // prints no channel — a document with zero vocal channels and a vocal
    // monitor mix.
    const rows = rowsFor({ leadSlots: [], backSlots: [] });

    expect(rows.map((row) => row.ownerMusicianId)).toEqual(["bass-1"]);
    expect(rows.map((row) => row.no)).toEqual(["1"]);
  });

  it("keeps the monitor mix of a vocs slot who moved to the back overlay", () => {
    const rows = rowsFor({ leadSlots: [], backSlots: [["voc-1", 1]] });

    expect(rows.map((row) => row.ownerMusicianId)).toEqual(["bass-1", "voc-1"]);
  });

  it("keeps an instrumentalist's monitor mix whether or not he sings", () => {
    // The criterion is the lineup role, not the vocal capability: the bass
    // slot exists because of the bass.
    const rows = rowsFor({ leadSlots: [], backSlots: [] });

    expect(rows.some((row) => row.ownerMusicianId === "bass-1")).toBe(true);
  });
});
```

`makeRepo()` je pomocník existujícího souboru; pokud tam pod jiným jménem, použij to jeho. `monitorsById` musí obsahovat `wedge_foh`, jinak `resolveMonitorLabel` spadne na `repo.getPreset`.

- [ ] **Krok 3: Spusť test a ověř, že padá**

Run: `npx vitest run src/domain/pipeline/pdf/buildPdfMonitorRows.test.ts`
Expected: FAIL na druhém testu — dostane `["bass-1", "voc-1"]` místo `["bass-1"]`. Ostatní tři projdou už teď; jsou to zámky proti přestřelení.

- [ ] **Krok 4: Uprav `resolvePdfMonitorOwners`**

Nahraď `:30-38`:

```ts
/**
 * Kdo dostane monitorový řádek. Vlastníci jdou z lineupu, ne z overlays —
 * proto samotný zápis do `project.overlays` mix neuklidí (F5d Nález 1).
 *
 * Slot s lineup rolí `vocs`, který není v žádném vokálním overlay slotu,
 * netiskne jediný kanál (řádky `voc_lead_*`/`voc_back_*` staví
 * `resolveOverlayDrivenVocalRows` výhradně z overlays, O1), takže monitorový
 * mix pro něj je osiřelý: dokument by vyšel s nula vokálními kanály a s
 * vokálním monitor mixem.
 *
 * Kritérium je **lineup role vlastníka**, ne vokální schopnost muzikanta.
 * Basák, který zpívá back vokály, má `group: "bass"` a svůj basový monitor si
 * nechává, ať je v overlay nebo ne — jeho slot existuje kvůli base. Vypadnout
 * smí jen slot, jehož jediný důvod existence je zpěv.
 */
function resolvePdfMonitorOwners(args: {
  lineupMusicians: MonitorOwner[];
  effectiveSetupByMusicianId: EffectiveSetupByMusicianId;
  leadVocsSlotByMusicianId: Map<string, number>;
  backVocsSlotByMusicianId: Map<string, number>;
}): MonitorOwner[] {
  const {
    lineupMusicians,
    effectiveSetupByMusicianId,
    leadVocsSlotByMusicianId,
    backVocsSlotByMusicianId,
  } = args;
  return lineupMusicians
    .filter(({ musician }) => effectiveSetupByMusicianId.has(musician.id))
    .filter(({ group, musician }) => {
      if (group !== "vocs") return true;
      return (
        leadVocsSlotByMusicianId.has(musician.id) ||
        backVocsSlotByMusicianId.has(musician.id)
      );
    });
}
```

A ve volání (`:111-114`) předej obě mapy:

```ts
  const monitorOwners = resolvePdfMonitorOwners({
    lineupMusicians: args.lineupMusicians,
    effectiveSetupByMusicianId: args.effectiveSetupByMusicianId,
    leadVocsSlotByMusicianId: args.leadVocsSlotByMusicianId,
    backVocsSlotByMusicianId: args.backVocsSlotByMusicianId,
  });
```

- [ ] **Krok 5: Spusť test a ověř, že prošel**

```bash
npx vitest run src/domain/pipeline/pdf/buildPdfMonitorRows.test.ts
npx vitest run src/domain/pipeline/
```

Expected: PASS. Kdyby padly existující testy na `monitorOutputs` v `buildDocument.vocalOverlays.test.ts` (`:192-199`, `:413-421`, `:688`, `:860-872`, `:1037`) nebo v `buildDocument.setupOverride.test.ts` (`:891`, `:1216-1218`), projdi je jeden po druhém a rozhodni podle fixtury:

- vokalista **je** v overlay → očekávání se nesmí změnit; padne-li, je oprava moc široká a chytá i vlastníka, který v overlay je,
- vokalista **není** v overlay → nová hodnota je správná odpověď a očekávání se upraví, s komentářem odkazujícím na Nález 1.

Do reportu zapiš každý upravený test a do které kategorie spadá.

- [ ] **Krok 6: Napiš kontraktní test 5**

Do `packages/desktop/src/app/domain/inputs/uiDocumentContract.test.ts`:

```ts
describe("contract: removing a vocalist leaves no orphaned monitor mix (F5d R7, Nález 1)", () => {
  it("zero vocal channels means zero vocal monitor mixes", () => {
    const band: Band = {
      id: "band",
      name: "Band",
      bandLeader: "bass-1",
      defaultLineup: { bass: ["bass-1"], vocs: ["voc-1"] },
      defaultOverlays: { leadVocals: ["voc-1"], backVocals: [] },
    };
    const bassist: Musician = {
      id: "bass-1",
      firstName: "Bass",
      lastName: "One",
      group: "bass",
      presets: [
        { kind: "preset", ref: "el_bass_xlr_amp" },
        { kind: "monitor", ref: "wedge_foh" },
      ],
    };
    const singer: Musician = {
      id: "voc-1",
      firstName: "Voc",
      lastName: "One",
      group: "vocs",
      gender: "male",
      presets: [
        { kind: "preset", ref: "vocal_wireless" },
        { kind: "monitor", ref: "wedge_foh" },
      ],
    };
    const presets: Record<string, PresetEntity> = {
      el_bass_xlr_amp: {
        type: "preset",
        id: "el_bass_xlr_amp",
        label: "Electric bass guitar",
        group: "bass",
        inputs: [{ key: "el_bass_xlr_amp", label: "Electric bass guitar" }],
      },
      vocal_wireless: {
        type: "preset",
        id: "vocal_wireless",
        label: "Vocal (wireless)",
        group: "vocs",
        capabilities: ["vocal"],
        inputs: [{ key: "voc_input", label: "Vocal" }],
      },
    };
    const musicians = { "bass-1": bassist, "voc-1": singer };

    const withSinger: Project = {
      id: "p-voc-present",
      bandRef: "band",
      purpose: "event",
      documentDate: "2026-01-01",
      lineup: { bass: { musicianId: "bass-1" }, vocs: [{ musicianId: "voc-1" }] },
      overlays: { leadVocals: ["voc-1"], backVocals: [] },
    };
    // Exactly the state screen `02` writes when the user removes him from the
    // overlay: the lineup slot stays, the overlay entry goes.
    const withoutSinger: Project = {
      ...withSinger,
      id: "p-voc-removed",
      overlays: { leadVocals: [], backVocals: [] },
    };

    const before = buildDocument(
      withSinger,
      makeRepo({ band, musicians, project: withSinger, presets }),
    );
    const after = buildDocument(
      withoutSinger,
      makeRepo({ band, musicians, project: withoutSinger, presets }),
    );

    expect(before.monitorTableRows.filter((row) => row.ownerRole === "vocs")).toHaveLength(1);

    expect(after.inputs.filter((row) => row.group === "vocs")).toHaveLength(0);
    expect(after.monitorTableRows.filter((row) => row.ownerRole === "vocs")).toHaveLength(0);
    expect(after.stageplan.monitorOutputs.filter((row) => row.ownerRole === "vocs")).toHaveLength(0);
    // And the numbering of what is left has no gap.
    expect(after.monitorTableRows.map((row) => row.no)).toEqual(
      after.monitorTableRows.map((_, index) => String(index + 1)),
    );
  });
});
```

- [ ] **Krok 7: Ověř nedotčenost regresní fixtury**

```bash
npx vitest run src/domain/pipeline/buildDocument.pdfRegression.test.ts
```

Expected: zelený s **nedotčenými očekáváními**. Fixtura má vokalisty v overlay, takže se jí filtr netýká. **Kdyby padl, zastav se a eskaluj** — znamenalo by to, že filtr chytá i vlastníka, který v overlay je.

- [ ] **Krok 8: Ověř, že se nic jiného nerozbilo**

```bash
npm test 2>&1 | tail -5
npx tsc -p packages/desktop/tsconfig.json --noEmit 2>&1 | grep -c "error TS"
npm run smoke:stageplan-print
```

Expected: +5 testů, tytéž dvě baseline selhání, tsc `10`, smoke projde.

- [ ] **Krok 9: Ověř lint**

Recept z Global Constraints pro `buildPdfMonitorRows.ts`, `buildPdfMonitorRows.test.ts` a `uiDocumentContract.test.ts`, na HEAD i BASE. Expected: delta 0.

- [ ] **Krok 10: Commit**

```bash
git add src/domain/pipeline/pdf/buildPdfMonitorRows.ts \
        src/domain/pipeline/pdf/buildPdfMonitorRows.test.ts \
        packages/desktop/src/app/domain/inputs/uiDocumentContract.test.ts
git commit -m "fix(pdf): drop the monitor mix of a vocs slot that is in no overlay"
```

---
### Task 15: `resolveVocalOverlayEditorModel` — složení kandidátů do jedné čisté funkce, `01` na ni přepojen

**Files:**
- Create: `packages/desktop/src/app/domain/roles/resolveVocalOverlayEditorModel.ts`
- Create: `packages/desktop/src/app/domain/roles/resolveVocalOverlayEditorModel.test.ts`
- Modify: `packages/desktop/src/app/pages/ProjectSetupPage.tsx:849-957` (nahradit odvození voláním)

**Interfaces:**
- Consumes: existující čisté helpery `resolveLineupVocalCandidates`, `resolveLeadVocalCandidates`, `enforceVocalSelectionInvariant` z `app/domain/roles/`.
- Produces:

```ts
export type VocalOverlayEditorModel = {
  /** Po uplatnění invariantu — nikdo není zároveň lead i back. */
  readonly selectedLeadIds: string[];
  readonly selectedBackIds: string[];
  /** Jména vybraných, v pořadí `selectedLeadIds` / `selectedBackIds`. */
  readonly leadMembers: MemberOption[];
  readonly backMembers: MemberOption[];
  readonly leadSections: ReturnType<typeof resolveLeadVocalCandidates>;
  readonly backSections: {
    suggested: BackVocalCandidate[];
    additional: BackVocalCandidate[];
  };
  /** Id všech kandidátů — vstup do `enforceVocalSelectionInvariant` při ukládání. */
  readonly candidateIds: ReadonlySet<string>;
  /** `false` = `Change` se nedá nabídnout, není z čeho vybírat. */
  readonly hasCandidates: boolean;
};

export function resolveVocalOverlayEditorModel(args: {
  lineupMusicians: Musician[];
  lineupMembers: MemberOption[];
  catalogMusicians: Musician[];
  catalogMembers: MemberOption[];
  presetCatalog: Record<string, PresetEntity>;
  rawLeadIds: string[];
  rawBackIds: string[];
}): VocalOverlayEditorModel;
```

  **`candidateIds` je součást kontraktu, ne volitelný přídavek** — Task 16 ho posílá do `enforceVocalSelectionInvariant` při ukládání a `01` ho dnes drží jako `lineupVocalCandidateIdSet` (`ProjectSetupPage.tsx:869-871`, používaný na `:877`, `:2380`, `:2424`).

**Kontext, který nesmíš přehlédnout**

**Tohle je čistá extrakce beze změny chování.** `ProjectSetupPage.tsx:849-957` je ~110 řádků `useMemo` bloků, které skládají už existující čisté helpery do tvaru, jaký chtějí `ChangeLeadVocsModal` a `ChangeBackVocsModal`. Nepřepisuj logiku — **přenes ji doslova** a teprve pak jí napiš testy.

Co se přenáší, v pořadí:

1. `lineupVocalCandidates` — `resolveLineupVocalCandidates({ lineupMusicians, lineupMembers, catalogMusicians, catalogMembers, presetCatalog })` (`:849-864`).
2. `lineupVocalCandidateIdSet` (`:869-871`) → `candidateIds`.
3. `enforceVocalSelectionInvariant({ lineupCandidateIds, leadIds: rawLeadIds, backIds: rawBackIds })` (`:872-884`) → `selectedLeadIds`, `selectedBackIds`.
4. `leadVocalCandidateSections` (`:887-909`) — filtr `sectionByRole.lead === "suggested" || isInProjectLineup || primaryGroup === "vocs"`, mapa na tvar, který `resolveLeadVocalCandidates` chce, a jeho volání.
5. `leadVocalMembers` / `backVocalMembers` (`:911-922`) — lookup vybraných id v `catalogMembers`.
6. `backVocalCandidateSections` (`:924-957`) — filtr `hasVocalCapability || isInProjectLineup`, mapa s `isDisabled` pro už vybrané lead vokalisty a `disabledReason: "Already selected as Lead Vocal"`, rozdělení na `suggested` / `additional` podle `sectionByRole.back`.

Co se **nepřenáší**:

- `defaultLeadVocalIds` (`:837-846`) — je to `setupData.defaultOverlays`, uložená hodnota, ne odvození ze sestavy. Zůstává na `01` a `02` si ji čte samo.
- `rawSelectedLeadVocalIds` / `rawSelectedBackVocalIds` (`:847-848`, `:866-868`) — `extractOverlayMusicianIds` nad uloženými id. Extrakci dělá volající, protože každá obrazovka má jiný zdroj (`01` stavové proměnné, `02` snapshot).

`hasCandidates` je `lineupVocalCandidates.length > 0` — dnes to `01` používá jako `changeDisabled={lineupVocalCandidates.length === 0}` (`:1627`, `:1632`).

**Proč se `01` přepojuje, i když to spec neukládá.** Kdyby `02` dostalo vlastní kopii téhle skládačky, měla by fáze, jejímž celým smyslem je zrušit dva zdroje pravdy o kanálech, dva zdroje pravdy o vokálních kandidátech. Je to assembly nad hotovými čistými helpery, ne druhá implementace, takže sloučení je levné. **Cena při chybě:** `01` nemá vlastní test, takže regresi v něm chytí až ruční kontrola (bod 14 verifikace).

- [ ] **Krok 1: Přečti, co se přenáší, a přesné tvary typů**

```bash
cd /c/Users/mkrecmer/dev/stagepilot
sed -n '849,958p' packages/desktop/src/app/pages/ProjectSetupPage.tsx
sed -n '1,60p' packages/desktop/src/app/domain/roles/resolveLineupVocalCandidates.ts
sed -n '1,60p' packages/desktop/src/app/domain/roles/resolveLeadVocalCandidates.ts
sed -n '1,40p' packages/desktop/src/app/domain/roles/vocalSelectionInvariant.ts
sed -n '1,35p' packages/desktop/src/app/components/roles/modals/ChangeBackVocsModal.tsx
sed -n '1,60p' packages/desktop/src/app/domain/roles/resolveLineupVocalCandidates.test.ts
```

Tvary `LeadVocalCandidate`, `BackVocalCandidate`, `MemberOption` a `Musician` přebírej odtud, ne z tohohle plánu. Poslední příkaz ti dá hotové fixtury pro Krok 2 — **kopíruj je, nevymýšlej nové**.

- [ ] **Krok 2: Napiš padající test**

Vytvoř `packages/desktop/src/app/domain/roles/resolveVocalOverlayEditorModel.test.ts`. Fixtury postav podle `resolveLineupVocalCandidates.test.ts`; níž je scénář a aserce, které musí platit.

```ts
import { describe, expect, it } from "vitest";
import type { PresetEntity } from "../../../../../../src/domain/model/types";
import { resolveVocalOverlayEditorModel } from "./resolveVocalOverlayEditorModel";

const PRESETS: Record<string, PresetEntity> = {
  vocal_wireless: {
    type: "preset",
    id: "vocal_wireless",
    label: "Vocal (wireless)",
    group: "vocs",
    capabilities: ["vocal"],
    inputs: [{ key: "voc_input", label: "Vocal" }],
  },
  el_bass_xlr_amp: {
    type: "preset",
    id: "el_bass_xlr_amp",
    label: "Electric bass guitar",
    group: "bass",
    inputs: [{ key: "el_bass_xlr_amp", label: "Electric bass guitar" }],
  },
};

/** A pure vocalist and a bass player who also sings — the two shapes that matter. */
const SINGER = {
  id: "voc-1",
  firstName: "",
  lastName: "",
  group: "vocs" as const,
  presets: [{ kind: "preset" as const, ref: "vocal_wireless" }],
};
const SINGING_BASSIST = {
  id: "bass-1",
  firstName: "",
  lastName: "",
  group: "bass" as const,
  presets: [
    { kind: "preset" as const, ref: "el_bass_xlr_amp" },
    { kind: "preset" as const, ref: "vocal_wireless" },
  ],
};
const MEMBERS = [
  { id: "voc-1", name: "Vera Vocals" },
  { id: "bass-1", name: "Bob Bass" },
];

function model(overrides: {
  lineup?: typeof SINGER[];
  rawLeadIds?: string[];
  rawBackIds?: string[];
}) {
  const lineup = overrides.lineup ?? [SINGER, SINGING_BASSIST];
  return resolveVocalOverlayEditorModel({
    lineupMusicians: lineup,
    lineupMembers: MEMBERS.filter((m) => lineup.some((l) => l.id === m.id)),
    catalogMusicians: [SINGER, SINGING_BASSIST],
    catalogMembers: MEMBERS,
    presetCatalog: PRESETS,
    rawLeadIds: overrides.rawLeadIds ?? [],
    rawBackIds: overrides.rawBackIds ?? [],
  });
}

describe("resolveVocalOverlayEditorModel", () => {
  it("returns no candidates for an empty lineup", () => {
    const result = model({ lineup: [] });

    expect(result.hasCandidates).toBe(false);
    expect(result.candidateIds.size).toBe(0);
    expect(result.selectedLeadIds).toEqual([]);
    expect(result.selectedBackIds).toEqual([]);
    expect(result.leadMembers).toEqual([]);
  });

  it("reports both a vocalist and a singing instrumentalist as candidates", () => {
    const result = model({});

    expect(result.hasCandidates).toBe(true);
    expect([...result.candidateIds].sort()).toEqual(["bass-1", "voc-1"]);
  });

  it("keeps a musician selected as lead out of the back selection", () => {
    // `enforceVocalSelectionInvariant` — a musician cannot be both.
    const result = model({ rawLeadIds: ["voc-1"], rawBackIds: ["voc-1"] });

    expect(result.selectedLeadIds).toEqual(["voc-1"]);
    expect(result.selectedBackIds).toEqual([]);
  });

  it("marks an already-selected lead vocalist as disabled among back candidates", () => {
    const result = model({ rawLeadIds: ["voc-1"] });
    const entry = [...result.backSections.suggested, ...result.backSections.additional].find(
      (candidate) => candidate.id === "voc-1",
    );

    expect(entry?.isDisabled).toBe(true);
    expect(entry?.disabledReason).toBe("Already selected as Lead Vocal");
  });

  it("does not disable a back candidate who is not selected as lead", () => {
    const result = model({ rawLeadIds: ["voc-1"] });
    const entry = [...result.backSections.suggested, ...result.backSections.additional].find(
      (candidate) => candidate.id === "bass-1",
    );

    expect(entry?.isDisabled).toBe(false);
  });

  it("drops a selected id that is no longer in the lineup", () => {
    const result = model({ lineup: [SINGER], rawLeadIds: ["voc-1"], rawBackIds: ["bass-1"] });

    expect(result.selectedLeadIds).toEqual(["voc-1"]);
    expect(result.selectedBackIds).toEqual([]);
  });

  it("resolves member display names for the selected ids, in selection order", () => {
    const result = model({ rawLeadIds: ["voc-1"], rawBackIds: ["bass-1"] });

    expect(result.leadMembers.map((member) => member.name)).toEqual(["Vera Vocals"]);
    expect(result.backMembers.map((member) => member.name)).toEqual(["Bob Bass"]);
  });
});
```

Kdyby některý test padl na jiný tvar dat, než plán předpokládá (třeba `isDisabled` chybí, nebo `resolveLineupVocalCandidates` chce `sectionByRole` jinak), **oprav fixtury podle skutečnosti a zapiš rozdíl do reportu** — je to extrakce, takže rozhoduje kód, ne plán.

- [ ] **Krok 3: Spusť test a ověř, že padá**

Run: `npx vitest run packages/desktop/src/app/domain/roles/resolveVocalOverlayEditorModel.test.ts`
Expected: FAIL — modul neexistuje.

- [ ] **Krok 4: Napiš implementaci**

Vytvoř `packages/desktop/src/app/domain/roles/resolveVocalOverlayEditorModel.ts`. Doc komentář:

```ts
/**
 * Co? Všechno, co potřebují modály `Change lead vocals` a `Change back
 * vocals`: id vybraných po uplatnění invariantu, jména vybraných, kandidáty
 * rozdělené na navržené a ostatní, a množinu všech kandidátů pro invariant
 * při ukládání.
 *
 * Proč tady? Do F5d to bylo ~110 řádků `useMemo` bloků uvnitř
 * `ProjectSetupPage.tsx`. Vlna 2 tytéž modály otevírá i z obrazovky `02`;
 * druhá kopie té skládačky by dala dva zdroje pravdy o vokálních kandidátech
 * — přesně to, co celá F5d ruší u kanálů. Je to assembly nad hotovými čistými
 * helpery (`resolveLineupVocalCandidates`, `resolveLeadVocalCandidates`,
 * `enforceVocalSelectionInvariant`), ne druhá implementace, takže sloučení je
 * levné.
 *
 * `defaultOverlays` kapely sem nepatří — je to uložená hodnota, ne odvození ze
 * sestavy. Stejně tak `extractOverlayMusicianIds`: každá obrazovka má id
 * uložená jinde (`01` ve stavu, `02` ve snapshotu), takže extrakci dělá
 * volající a sem chodí už hotová pole.
 */
```

Tělo přenes doslova z `ProjectSetupPage.tsx:849-957`, jen bez `useMemo` obalů a s parametry místo closure proměnných.

- [ ] **Krok 5: Spusť test a ověř, že prošel**

Run: `npx vitest run packages/desktop/src/app/domain/roles/`
Expected: PASS, 7 nových testů plus všechny existující v tom adresáři.

- [ ] **Krok 6: Přepoj `01` na novou funkci**

V `ProjectSetupPage.tsx` nahraď bloky `lineupVocalCandidates`, `lineupVocalCandidateIdSet`, `selectedLeadVocalIds`/`selectedBackVocalIds`, `leadVocalCandidateSections`, `leadVocalMembers`, `backVocalMembers` a `backVocalCandidateSections` jediným `useMemo`:

```ts
  const vocalOverlayModel = useMemo(
    () =>
      resolveVocalOverlayEditorModel({
        lineupMusicians: selectedTemplateMusicians,
        lineupMembers: templateMusicians,
        catalogMusicians: allBandMusicians,
        catalogMembers: allBandMembers,
        presetCatalog,
        rawLeadIds: rawSelectedLeadVocalIds,
        rawBackIds: rawSelectedBackVocalIds,
      }),
    [
      allBandMembers,
      allBandMusicians,
      presetCatalog,
      rawSelectedBackVocalIds,
      rawSelectedLeadVocalIds,
      selectedTemplateMusicians,
      templateMusicians,
    ],
  );
```

Aby diff nebyl zbytečně široký, rozbal model do lokálních konstant se **stávajícími jmény** hned pod `useMemo` — zbytek souboru se pak nemění vůbec:

```ts
  const {
    selectedLeadIds: selectedLeadVocalIds,
    selectedBackIds: selectedBackVocalIds,
    leadMembers: leadVocalMembers,
    backMembers: backVocalMembers,
    leadSections: leadVocalCandidateSections,
    backSections: backVocalCandidateSections,
    candidateIds: lineupVocalCandidateIdSet,
    hasCandidates: hasVocalCandidates,
  } = vocalOverlayModel;
```

Jediná dvě místa, kde se zbytek souboru přece jen dotkne: `changeDisabled={lineupVocalCandidates.length === 0}` (`:1627`, `:1632`) přepiš na `changeDisabled={!hasVocalCandidates}`.

Zkontroluj, že `lineupCandidateIds: lineupVocalCandidateIdSet` na `:877`, `:2380` a `:2424` pořád kompiluje — `enforceVocalSelectionInvariant` čeká `Set<string>` nebo `ReadonlySet<string>`; pokud první, nech typ v modelu jako `Set<string>` a v komentáři to zdůvodni.

- [ ] **Krok 7: Ověř, že se `01` nezměnilo**

```bash
npx tsc -p packages/desktop/tsconfig.json --noEmit 2>&1 | grep -c "error TS"
npm test 2>&1 | tail -5
git diff --stat -- packages/desktop/src/app/pages/ProjectSetupPage.tsx
```

Expected: tsc `10`; testy jen +7 z nového souboru; `ProjectSetupPage.tsx` zmenší o ~90 řádků.

**`ProjectSetupPage.tsx` vlastní test nemá**, takže tady je automatické ověření nejslabší v celé fázi. Zapiš to do reportu výslovně. Ruční kontrola je bod 14 verifikace: na `01` musí `Change` u lead i back vokálů nabízet **tytéž lidi ve stejném pořadí** jako před tímhle taskem. Nejjistější je udělat screenshot obou modálů **před** krokem 6 a porovnat.

- [ ] **Krok 8: Ověř lint**

Recept z Global Constraints pro oba nové soubory (absolutní 0) a `ProjectSetupPage.tsx` (HEAD i BASE, delta 0). Znovu pozor na `organizeImports`.

- [ ] **Krok 9: Commit**

```bash
git add packages/desktop/src/app/domain/roles/resolveVocalOverlayEditorModel.ts \
        packages/desktop/src/app/domain/roles/resolveVocalOverlayEditorModel.test.ts \
        packages/desktop/src/app/pages/ProjectSetupPage.tsx
git commit -m "refactor(roles): extract the vocal overlay editor model and reuse it on the lineup screen"
```

---
### Task 16: Overlays na `02` — Add/Remove lead, back a talkback + kontraktní test 4

**Files:**
- Modify: `packages/desktop/src/app/pages/ProjectInputsPage.tsx` (`InputsEditorSnapshot`, `snapshotFromProject`, `editedProject`, `saveSnapshot`, stav a render modálů, sekce v UI)
- Modify: `packages/desktop/src/app/pages/ProjectInputsPage.test.tsx`
- Modify: `packages/desktop/src/app/domain/inputs/uiDocumentContract.test.ts` (kontraktní test 4)
- Modify: `packages/desktop/src/app/domain/inputs/resetInputsScreen.ts` **jen pokud** reset má overlays zahrnout — viz Krok 7, rozhodni měřením

**Interfaces:**
- Consumes: `resolveVocalOverlayEditorModel` (Task 15), `buildPdfMonitorRows` po opravě (Task 14), existující `ChangeLeadVocsModal` / `ChangeBackVocsModal` z `app/components/roles/modals/`, `ensureMusiciansInLineup` a `enforceVocalSelectionInvariant` z `app/domain/roles/`.
- Produces: `InputsEditorSnapshot` s novým polem `overlays`.

**Kontext, který nesmíš přehlédnout**

**`InputsEditorSnapshot` dnes nese jen `inputOrder`, `notes`, `lineup`** (`ProjectInputsPage.tsx:76-81`, `:136-142`). Aby se overlays z `02` daly editovat, musí do snapshotu přibýt čtvrté pole. Tři místa, kde se snapshot skládá nebo rozkládá, musí přibýt současně, jinak se změna ztratí:

1. `snapshotFromProject` (`:136-142`) — `overlays: project.overlays`,
2. `editedProject` (`:476-484`) — `overlays: snapshot.overlays`,
3. `saveSnapshot` (`:1246-1265`) — `overlays: snapshot.overlays` v payloadu.

`isInputsDirty` (`:116-122`) porovnává celý snapshot přes `JSON.stringify`, takže se přizpůsobí sám. **Ověř to testem** — je to Critical kategorie: kdyby se overlays nedostaly do `saveSnapshot`, uživatel by přidal vokalistu, viděl ho v tabulce a po uložení by zmizel. Přesně tohle riziko review u Tasku 16 F5c pojmenovala jako první.

**Tvar `overlays`** je `{ leadVocals?: string[]; backVocals?: string[]; talkback?: { mode: "none"; ownerId: null } | { mode: "assigned"; ownerId: string } }` (`app/shell/types.ts:106-110`).

**Přidání vokalisty ho musí dostat i do lineupu.** `01` volá `ensureMusiciansInLineup(lineup, allBandMusiciansById, [...leadIds, ...backIds])` (`:961`, `:1075`) — bez toho by overlay ukazoval na někoho, kdo v `project.lineup` není, a `resolveCanonicalOverlayAssignments` (`resolveProjectAudioAssignments.ts:73-81`) by ho odfiltroval. `02` musí udělat totéž a zapsat obojí do jednoho `setState`.

**Talkback.** Na `01` je to `LineupRow` s `Change`, který otevírá `MusicianSelector` (`:1665-1694`) a zapisuje `talkbackOwnerId` + `hasTalkbackOverride`, ze kterých `toPersistableProject` skládá `overlays.talkback` (`canonicalProject.ts:120-134`). Na `02` zapisuj **rovnou `overlays.talkback`** ve tvaru `{ mode: "assigned", ownerId }` nebo `{ mode: "none", ownerId: null }` — snapshot nese overlays přímo, takže mezikrok přes dvě stavové proměnné je zbytečný. Legacy `project.talkbackOverride` je doména ignorovaná (Nález 4) a **nesahej na něj**.

**Kam to v UI patří.** Sekce `INPUT LIST` má dnes pod tabulkou tlačítko `+ Add input`, které Task 12 smazal. Na jeho místo přijde řádek s třemi tlačítky: `Lead vocals`, `Back vocals`, `Talkback`, každé otevírá svůj modál. Je to nejlevnější řešení, které nesahá na layout a využije uvolněné místo. Kdyby to člověk chtěl jinak, je to změna jednoho `<div>`.

**R3 z F5c pro vokály neplatí:** odebrání vokalisty je změna sestavy, **řádek zmizí**, čísla se přepočítají (O3). Nesnaž se to udělat jako „vypnuto, ale přeškrtnuto" — pro ten stav v modelu reprezentace není.

- [ ] **Krok 1: Rozšiř snapshot a napiš na to test**

Do `ProjectInputsPage.test.tsx` (nebo tam, kde se testuje `isInputsDirty` a `snapshotFromProject`) přidej:

```ts
  it("carries overlays through the snapshot so an overlay edit survives save", () => {
    const initial = { inputOrder: undefined, notes: undefined, lineup: {}, overlays: { leadVocals: ["m1"], backVocals: [] } };
    const changed = { ...initial, overlays: { leadVocals: [], backVocals: [] } };

    expect(isInputsDirty(initial, changed)).toBe(true);
  });
```

Pak uprav typ `InputsEditorSnapshot`, `snapshotFromProject`, `editedProject` a `saveSnapshot` — všechna čtyři místa najednou.

- [ ] **Krok 2: Ověř, že se overlays opravdu ukládají**

**Nespoléhej na to, že to „vypadá zapojeně".** Napiš dočasný skript do scratchpadu, který volá `saveSnapshot`-ekvivalentní skládání payloadu a zkontroluje, že `overlays` v něm je. Nebo jednodušeji: v `ProjectInputsPage.test.tsx` otestuj čistou část — pokud je skládání payloadu inline v `useCallback`, **vytáhni ho do exportované funkce** `buildInputsSavePayload(snapshot, project)` a otestuj tu. Je to tři řádky a zamyká to nejrizikovější místo tasku.

- [ ] **Krok 3: Zapoj modály**

Přidej stav a handlery. `allBandMusicians`, `allBandMembers` a `defaultOverlays` si `02` musí dotáhnout ze `setupData` — má ho (`:333`) a `getBandSetupData` vrací `members`, `musicianPresetsById`, `defaultOverlays` i `presetCatalog`. Skládání kandidátů dělá `resolveVocalOverlayEditorModel` z Tasku 15; **nekopíruj `useMemo` bloky z `01`.**

```ts
  const [isLeadVocsModalOpen, setIsLeadVocsModalOpen] = useState(false);
  const [isBackVocsModalOpen, setIsBackVocsModalOpen] = useState(false);
  const [isTalkbackModalOpen, setIsTalkbackModalOpen] = useState(false);
```

Handler uložení vokálů — jeden `setState`, který zapíše overlays **i** lineup:

```ts
  /**
   * Zápis vokálních overlays z `02` (F5d R7). Overlays řídí existenci
   * vstupních řádků samy (O1), takže doména se nemění — ale muzikant, na
   * kterého overlay ukazuje, musí být v `project.lineup`, jinak ho
   * `resolveCanonicalOverlayAssignments` odfiltruje a řádek se nevytiskne.
   * Proto se obojí zapisuje jedním `setState`, stejně jako to dělá `01`.
   */
  const applyVocalOverlays = useCallback(
    (next: { leadIds: string[]; backIds: string[] }) => {
      setState((current) => {
        if (current.kind !== "ready") return current;
        const normalized = enforceVocalSelectionInvariant({
          lineupCandidateIds: vocalOverlayModel.candidateIds,
          leadIds: next.leadIds,
          backIds: next.backIds,
        });
        return {
          ...current,
          snapshot: {
            ...current.snapshot,
            lineup: ensureMusiciansInLineup(
              current.snapshot.lineup,
              allBandMusiciansById,
              [...normalized.leadIds, ...normalized.backIds],
            ),
            overlays: {
              ...current.snapshot.overlays,
              leadVocals: normalized.leadIds,
              backVocals: normalized.backIds,
            },
          },
        };
      });
    },
    [allBandMusiciansById, vocalOverlayModel.candidateIds],
  );
```

Talkback:

```ts
  const applyTalkbackOwner = useCallback((ownerId: string | null) => {
    setState((current) => {
      if (current.kind !== "ready") return current;
      return {
        ...current,
        snapshot: {
          ...current.snapshot,
          overlays: {
            ...current.snapshot.overlays,
            talkback: ownerId
              ? { mode: "assigned" as const, ownerId }
              : { mode: "none" as const, ownerId: null },
          },
        },
      };
    });
  }, []);
```

Render tří tlačítek na místě uvolněném po `+ Add input` a tří `ModalOverlay` vedle `Edit kit` / `Edit inputs`. `ChangeLeadVocsModal` a `ChangeBackVocsModal` importuj z `../components/roles/modals/`, propy podle jejich signatur — okopíruj volání z `ProjectSetupPage.tsx:2358-2440`, jen `onSave` nahraď `applyVocalOverlays`.

Pro talkback použij `MusicianSelector` z `../../components/setup/MusicianSelector`, stejně jako `01`.

- [ ] **Krok 4: Napiš kontraktní test 4**

Do `uiDocumentContract.test.ts`:

```ts
describe("contract: removing a vocalist from the overlay (F5d R7, O3)", () => {
  it("the row disappears, the numbering closes up, and the UI shows no struck-through row", () => {
    // R3 from F5c does not hold for vocals: removing a singer is a lineup
    // change, not a channel toggle. There is no "in the lineup but has no
    // mic" state in the model, so the row must go, not go grey.
    // …two lead vocalists, then a project with only the first one in
    // `overlays.leadVocals`.

    const before = buildDocument(/* both */);
    const after = buildDocument(/* one */);

    expect(after.inputs).toHaveLength(before.inputs.length - 1);
    expect(after.inputs.map((row) => row.ch)).toEqual(
      after.inputs.map((_, index) => index + 1),
    );
    expect(after.inputs.some((row) => row.key.startsWith("voc_lead_2"))).toBe(false);

    // And the UI does not paint a removed row for him: `collectDisabledInputRows`
    // only reports channels a `remove`/`removeKeys` patch turned off, and the
    // overlay path writes no patch at all.
    expect(
      collectDisabledInputRows({
        lineup: { vocs: [{ musicianId: "voc-1" }, { musicianId: "voc-2" }] },
        roleOrder: ["vocs"],
        setupForSlot: /* stub returning equal default and effective */,
      }),
    ).toEqual([]);
  });
});
```

Fixtury dopiš podle `buildDocument.vocalOverlays.test.ts`; `collectDisabledInputRows` a jeho stub vzor je v `buildInputEditorRows.test.ts:845-885`.

- [ ] **Krok 5: Spusť testy**

```bash
npx vitest run packages/desktop/src/app/
npx tsc -p packages/desktop/tsconfig.json --noEmit 2>&1 | grep -c "error TS"
```

Expected: PASS; tsc `10`.

- [ ] **Krok 6: Ověř dirty a save headless**

Napiš dočasný skript, který nad reálným projektem z `%APPDATA%/StagePilot` sestaví snapshot, odebere lead vokalistu z overlays, zavolá skládání payloadu a vypíše `payload.overlays`. **Skript nic neukládá.** Expected: `leadVocals` bez odebraného id.

- [ ] **Krok 7: Rozhodni měřením, jestli `Reset to defaults` má overlays zahrnout**

`resetInputsScreen.ts` dnes zahazuje patche kanálů, ruční pořadí, monitoring, skladbu kitu a poznámky. Overlays je šestá vrstva, kterou `02` nově edituje.

```bash
sed -n '1,80p' packages/desktop/src/app/domain/inputs/resetInputsScreen.ts
grep -n "This discards every input" -A 4 packages/desktop/src/app/pages/ProjectInputsPage.tsx
```

**Rozhodnutí je na tobě, ale musí být měřené a zapsané jako `Ruling:` v reportu.** Argument pro zahrnutí: text potvrzovacího modálu slibuje „the input list and monitors rebuild from band and musician defaults", a s overlays z `01` by se přestavěl jen zčásti. Argument proti: reset by tím zasáhl sestavu, kterou uživatel dělal na `01`, a modál výslovně říká „Lineup and stage plan are not affected".

**Doporučení plánu: overlays reset NEZAHRNE** a text modálu se nemění. Odebrání vokalisty je změna sestavy (R7); reset kanálů ji vracet nemá. Kdyby to člověk chtěl jinak, je to jedno pole v `stripSlotDeviations` a jedna věta v modálu.

- [ ] **Krok 8: Ověř, že se nic jiného nerozbilo**

```bash
npm test 2>&1 | tail -5
npx vitest run src/domain/pipeline/buildDocument.pdfRegression.test.ts
npm run smoke:stageplan-print
```

Expected: tytéž dvě baseline selhání, `pdfRegression` zelený s nedotčenými očekáváními, smoke projde.

- [ ] **Krok 9: Změř růst `ProjectInputsPage.tsx`**

```bash
wc -l packages/desktop/src/app/pages/ProjectInputsPage.tsx
git diff --stat -- packages/desktop/src/app/pages/ProjectInputsPage.tsx
```

Task 12 ze souboru ubral zhruba 90 řádků, tenhle přidá zhruba 120. Čisté saldo za celou fázi má zůstat blízko nule. **Kdyby soubor přerostl 1750 řádků, zastav se** a zapiš, co by šlo vytáhnout do `app/domain/inputs/` nebo do vlastní komponenty.

- [ ] **Krok 10: Ověř lint**

Recept z Global Constraints pro `ProjectInputsPage.tsx`, `ProjectInputsPage.test.tsx`, `uiDocumentContract.test.ts` (a `resetInputsScreen.ts`, pokud jsi ho měnil), na HEAD i BASE. Expected: delta 0. Znovu `organizeImports` — přidáváš pět importů.

- [ ] **Krok 11: Commit**

```bash
git add packages/desktop/src/app/pages/ProjectInputsPage.tsx \
        packages/desktop/src/app/pages/ProjectInputsPage.test.tsx \
        packages/desktop/src/app/domain/inputs/uiDocumentContract.test.ts
git commit -m "feat(inputs): add and remove lead, back vocals and talkback from screen 02"
```

---

## Verifikace, kterou musí udělat člověk

Automaticky ověřitelné je vše z těl tasků. Následující body vyžadují `npm run dev` a běží v okně Tauri. **Žádný agent Tauri okno neotevře — jsou to závazky pro člověka, ne kroky plánu.**

### Nedodělané ruční průchody z F5c

Sedm bodů, které F5c nechala nesplněné. Sedí tady, protože F5d se dotýká týchž obrazovek a projít je po F5d je smysluplnější než dvakrát.

1. Průchod `01 → 02 → 03 → 04` a zpět.
2. Přejmenování poznámky u bicího a vokálního kanálu s exportem PDF (ověří fix 12c).
3. Zavřené akce z 13b jsou v panelu vidět se zdůvodněním.
4. `Edit kit` z panelu `02`: přidat kotel, ověřit, že v tabulce přibude kanál a čísla pod ním se posunou, a vyexportovat PDF.
5. Editor poznámek: vypnout, přepsat, vrátit na šablonu, přidat vlastní do obou sekcí, smazat vlastní, zkontrolovat pořadí v PDF.
6. `Reset to defaults` na `02` a jeho potvrzovací modál.
7. Monitoring bubeníka na `01` — **tenhle bod se F5d překlápí**, viz bod 10.

### Ruční kontroly, které přidává F5d

8. `Edit inputs` u kytaristy: přepnutí `Connection` z mikrofonu na DI se projeví v tabulce i v PDF (R4). *(po Tasku 11)*
9. Přepnutí `Connection` u kytaristy, který má **přejmenovaný kanál nebo vlastní poznámku** — potvrzení `Switch connection?` se ukáže dopředu, vypíše, co zmizí, `Cancel` nechá stav beze změny, `Switch and discard` ho aplikuje (R5). *(po Tasku 11)*
10. Monitoring bubeníka na `02`: pole je editovatelné, změna dojede do monitorové tabulky v PDF (R3). *(po Tasku 5)*
11. `+ Add input` v UI nikde není a chybět nezačne — přidání kanálu jde přes `Edit inputs` a `Edit kit` (R5). *(po Tasku 12)*
12. Průchod `01 → 02` po smazání modálu: tlačítko `Setup` na kartě role naviguje na `/inputs`, `Continue` a `Back` fungují (R6). *(po Tasku 13)*
13. Editace kitu na `02` po smazání modálu nezapíše na slot žádný `presetOverride.inputs.*` — **ověřit v uloženém JSON v `%APPDATA%/StagePilot`** (R6). *(po Tasku 13)*
14. Sestava na `01` po Tasku 15: `Change` u lead i back vokálů nabízí tytéž lidi ve stejném pořadí jako předtím. *(po Tasku 15; nejjistější je screenshot před a po)*
15. Přidání a odebrání lead vokalisty z `02` s exportem PDF: řádek přijde a zmizí, čísla se přepočítají, **a nezůstane osiřelý monitor mix** (R7, Nález 1). *(po Tasku 16)*
16. Přidání a odebrání back vokalisty a talkbacku z `02` s exportem PDF (R7). *(po Tasku 16)*
17. Starý projekt z reálného `%APPDATA%/StagePilot` (ne z fixtury) se načte, uloží a vyexportuje bez ztráty dat.
18. **Sestava na `01` po kroku A**: sekce `acoustic_guitar` je pořád vidět u kytaristy, který má jen `ac_guitar`, a kytarista s elektrikou v ní **není** (R1, kopie 1). *(po Tasku 2 — nejrizikovější bod celé fáze, `ProjectSetupPage.tsx` na tohle nemá test)*
19. **Klávesista s mono presetem** (`keys_mono_xlr` nebo `keys_mono_jack`): na `01` je nabízený do sekce keys, na `02` mu `Edit inputs` ukáže dropdown `Connection` pro klávesy, ne vokální pole, a kanál `keys` je v exportovaném PDF (R1, M4). *(po Tasku 11)*
20. **Hudebník bez jediného presetu** u kytary a u vokálů: fallback dá `el_guitar_mic`, resp. `voc_input`, ne `gtr_mic`/`voc_lead`, a projekt se vyexportuje (R1). *(po Tasku 3)*

### Známé pre-existing stavy, které nejsou vada této fáze

- Dva projekty `blanicka_kapela` se po F7 nevyexportují kvůli kolizi boxů. Pojistka funguje podle návrhu; bloky čekají na přerovnání člověkem v editoru stage planu.
- Přejmenování „Friday Night Band" na „Big Night Band" ve všech datech včetně id je samostatné zadání, nezačato.
