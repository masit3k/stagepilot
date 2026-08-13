# Editor stage planu a model rozmístění (F5a)

**Datum:** 2026-08-13
**Stav:** schváleno k implementaci
**Fáze:** F5a — první ze tří specifikací, na které se F5 dělí (viz R1)
**Staví na:** [F0 + F1 — identita a token foundation](2026-08-12-brand-identity-and-token-foundation-design.md), [F2 — komponenty a interakce](2026-08-12-components-and-interaction-design.md), [F3 — shell a informační architektura](2026-08-12-shell-and-information-architecture-design.md), [F4 — typografie a hlavička PDF](2026-08-12-pdf-typography-and-header-design.md)
**Vstup:** `docs/design/brand-handoff-2026-08/` — sekce `3. Stage Plan Editor` v README a živý prototyp `3g` v boardu

## Kontext

Stage plan dnes není plán, je to sazba. Renderer má v `src/infra/pdf/sections/stageplan.ts` dva pevné layouty (`layout_5_party` a `layout_6_2_vocs`), pozice boxů počítá z řádků a sloupců a jejich výšku odvozuje z počtu odrážek. Souřadnice ani rotace nikde neexistují, takže nejde vytisknout, že bicí stojí uprostřed vzadu a kytara vlevo vpředu — dokument říká jen to, kdo v kapele je a co má za kanály.

Model je na to připravený stejně málo. `Project.stageplan` nese jediné pole `powerOverridesByMusician` ([types.ts:82](../../../src/domain/model/types.ts#L82)), v procesní stopě má krok `03 STAGE PLAN` stav `unavailable`, protože obrazovka neexistuje, a `packages/desktop` žádnou plochu s bloky nemá.

Tři nálezy z průzkumu, které zadání mění:

- **`toPersistableProject` je whitelist a `stageplan` v něm není** ([types.ts:117](../../../packages/desktop/src/app/shell/types.ts#L117)). Cokoli, co v `NewProjectPayload` nefiguruje, se při uložení z UI zahodí. Dnes je to neškodné, protože power overrides žádná obrazovka needituje. U rozmístění by to znamenalo, že první uložení z Lineup Setupu smaže celý ručně naskládaný plán — a nikde by se to neohlásilo.
- **`normalizeProject` propouští `stageplan` bez jakékoli kontroly** ([normalizeProject.ts:199](../../../src/app/usecases/normalizeProject.ts#L199)). Jen ho přiřadí a věří deklarovanému typu. Ručně editovaný JSON tak dostane do domény `rotationDeg: "45"` nebo blok pro slot, který v lineupu není.
- **Rust nic nepotřebuje.** `save_project` bere celý JSON jako string, parsuje ho jen kvůli názvu souboru a schéma nevaliduje ([lib.rs:1162](../../../packages/desktop/src-tauri/src/lib.rs#L1162)). Persistence nových polí je čistě otázka TypeScriptu.

A jeden rozpor přímo v handoffu: prototyp ukládá blokům pevné `w/h` v pixelech (250×140, 240×130, 230×110 při 90 px/m, tedy 2,8 × 1,6 m až 2,6 × 1,2 m), kdežto tiskový box si dnes velikost počítá z textu. Blok tedy není kartička s textem, ale zóna na pódiu, do které se text sází — a to se musí rozhodnout v modelu, ne až u tisku.

## Cíl

Rozmístění bloků na pódiu je doménová data v metrech, uložená v projektu, vygenerovaná z lineupu a editovatelná myší na tmavé ploše. Ruční pozice přežije změnu obsazení i uložení z jiné obrazovky. Tisk se v této fázi nemění.

## Rozsah

### V rozsahu

- Doménový model `StageplanLayout` v `Project.stageplan.layout`, včetně normalizace a persistence celou cestou až na disk
- Doménový modul geometrie: výchozí rozmístění, sloučení s lineupem, snap, clamp, rotace, přeškálování na jiný rozměr pódia
- Obrazovka editoru na routě `/projects/:id/stageplan` podle prototypu `3g`: toolbar, plocha s mřížkou, bloky, pravý panel, patička
- Tažení, rotace úchytem i tlačítky, snap, výběr, klávesové posuny, undo, reset rozmístění
- Krok `03 STAGE PLAN` v procesní stopě se odemkne

### Mimo rozsah

| Vyřazeno | Kam patří |
|---|---|
| PDF čte `stageplan.layout` (pozice, rotace, inverze na bílém) | F5b |
| Obrazovka `02 INPUTS` a tab `INPUT LIST` v toolbaru | F5c |
| Volné vlastní bloky (DJ pult, monitor rack, praktikábl) a mazání bloků | po F5, model je na to připravený (R4) |
| Změna velikosti zóny úchyty | po F5, rozměr má výchozí hodnotu podle role (R2) |
| Zoom a posun plochy | po F5, plocha se přizpůsobuje oknu (R16) |
| Bloky pro back vocs, band leadera a talkback | zamítnuto — mění obsah tisku, který má zůstat beze změny |
| Chybějící tlačítko Setup u LEAD VOCS | funkční bug, samostatná položka roadmapy |

### Vědomá mezera

Po F5a existuje editor, který se ukládá, ale do PDF se ještě nepropisuje — export dál tiskne dnešní pevný layout. Patička editoru proto **nesmí** nést větu z handoffu „Změny se propíší do PDF exportu"; do F5b tam bude `ROZMÍSTĚNÍ SE ZATÍM DO PDF NEPROPISUJE`. Vysvětlit uživateli mezeru je lepší než mu lhát rozhraním.

## Rozhodnutí

### R1 — F5 se dělí na tři specifikace

Roadmapa vede F5 jako jednu fázi, ale jsou to čtyři nezávislé celky: model rozmístění, editor, přepis geometrie tisku a obrazovka `02 INPUTS`, která se stage planem nesouvisí vůbec. Precedens F1 až F4 je jeden spec o devíti úkolech; tohle by bylo trojnásobek bez commitovatelného mezistavu.

| Spec | Obsah |
|---|---|
| **F5a** (tento) | doménový model rozmístění, persistence, editor |
| **F5b** | PDF čte `stageplan.layout`, včetně rotace a nové kresby bloků |
| **F5c** | obrazovka `02 INPUTS` |

Model se přitom navrhuje s tiskem na mysli, aby F5b nemusela nic přepisovat: proto R2, R5 a R9.

### R2 — Blok je zóna v metrech s výchozím rozměrem podle role

Prototyp má bloky velké 2,6 až 2,8 m — to nejsou rozměry aparátu, ale místa, kde muzikant stojí se svým backlinem. Zóna je tedy fyzická veličina v metrech, ne kartička dimenzovaná textem.

| Slot | Šířka × hloubka |
|---|---|
| `drums` | 2,8 × 1,6 m |
| `keys` | 2,8 × 1,4 m |
| `bass` | 2,7 × 1,4 m |
| `guitar` | 2,7 × 1,4 m |
| `lead_voc_1`, `lead_voc_2` | 2,6 × 1,2 m |

Rozměr je v modelu uložený u každého bloku, ale **v F5a ho nejde editovat** — panel ho jen zobrazuje, žádné úchyty na změnu velikosti, stejně jako prototyp. Uložený je proto, aby pozdější editace nebyla přepis modelu, a aby F5b měla co kreslit.

Poznámka pro F5b: při šířce tiskového zrcadla, kterou zavedla F4, vychází na metr pódia řádově 12 mm, takže zóna 2,6 × 1,2 m unese při 8 pt asi čtyři až pět řádků textu. Jak se do zóny vejde box, který má dnes odrážek deset, je otázka F5b — ne důvod měnit model.

### R3 — Ukládá se střed zóny, ne levý horní roh

Prototyp drží `x, y` jako CSS `left/top` a rotuje přes `transform-origin: center`. Kdyby model ukládal roh, každá rotace by změnila uloženou pozici, přesto že se blok fyzicky neposunul — a diff projektu by tvrdil, že se posunul. Střed je při rotaci invariantní; clamp i tisk si z něj rotovaný opsaný obdélník spočítají.

Osa `y` roste od upstage hrany k publiku: `centerYM = 0` je vzadu, `depthM` je u publika. Odpovídá to jak souřadnicím canvasu, tak pruhu `DOWNSTAGE · PUBLIKUM` dole v prototypu.

### R4 — Identita bloku je tiskový slot, ne generované `id`

Bloky vznikají z lineupu a jsou právě šest: `drums`, `bass`, `guitar`, `keys`, `lead_voc_1`, `lead_voc_2` — tedy přesně inventář, který dnes tiskne PDF. Handoff nese vedle sebe `id` i `positionId`; při pevných slotech je slot sám identitou, mapování se ušetří a nemůže vzniknout druhý blok pro tu samou roli.

Až přijdou volné bloky, `StageplanBlock` se rozšíří na sjednocení s variantou nesoucí vlastní `id` a `label`. Změna je uzavřená do modulu geometrie a normalizace, protože slot je jediný odkaz do lineupu.

### R5 — Rozměr pódia je volitelný; nezadaný znamená nominální plochu 12 × 8 m

Rozměr pódia často není v době přípravy známý, takže model ho nesmí vyžadovat:

```ts
readonly stage: { readonly widthM: number; readonly depthM: number } | null;
```

`null` znamená „rozměr nezadán". Pracovní plocha je pak nominálních 12 × 8 m (`NOMINAL_STAGE`) — kreslicí rám, ne tvrzení o pódiu. Toolbar v takovém případě píše `PÓDIUM · ROZMĚR NEZADÁN` a tisk (F5b) žádný rozměr neuvádí. Discriminated union místo dvou volitelných čísel, jak žádá CLAUDE.md; nejde tedy zapsat pódium široké, ale bezhloubkové.

Souřadnice bloků jsou **vždy v metrech vůči pracovní ploše**, ať je rozměr zadaný nebo ne. Jednotka se tím nikdy nemění.

### R6 — Změna rozměru pódia přeškáluje pozice proporcionálně

Když se plán postaví na nominální ploše a později se doplní skutečné pódium 10 × 6 m, doslovné souřadnice by polovinu bloků poslaly za hranu. `rescaleForStage()` proto středy přepočítá poměrem stran (`x * wNew/wOld`, `y * dNew/dOld`) a **rozměry zón nechá být** — bubeník potřebuje stejné místo na klubovém i festivalovém pódiu.

Volá se **výhradně** při explicitní změně rozměru, nikdy při načtení projektu. Na malém pódiu se zóny po přeškálování mohou překrývat; to je pravdivá informace o tom, že se kapela tísní, ne chyba, kterou má program tiše uklidit.

### R7 — Výchozí rozmístění kopíruje dnešní tiskový layout

`buildDefaultLayout()` rozmístí přítomné sloty tak, aby výsledek odpovídal tomu, co export tiskne dnes: vzadu bicí uprostřed a basa vpravo, vpředu kytara, lead vokál a klávesy. První export po F5b tak bude srovnatelný s dosavadním a rozdíl půjde připsat kresbě, ne rozmístění.

Souřadnice středů na nominální ploše 12 × 8 m, pět bloků:

| Slot | Střed |
|---|---|
| `drums` | 6,0 × 1,2 m |
| `bass` | 9,4 × 1,2 m |
| `guitar` | 2,6 × 5,5 m |
| `lead_voc_1` | 6,0 × 5,5 m |
| `keys` | 9,4 × 5,5 m |

Se dvěma lead vokály má dolní řada čtyři sloupce s roztečí 3,0 m, jak je má i dnešní `layout_6_2_vocs`: `guitar` 1,5 m, `lead_voc_1` 4,5 m, `lead_voc_2` 7,5 m, `keys` 10,5 m, všechny na `y = 5,5 m`. Horní řada se nemění.

Když je rozměr pódia zadaný, tyto nominální souřadnice se přepočtou stejným poměrem jako v R6. Funkce je čistá a deterministická — stejný vstup dá vždy stejné rozmístění, takže `Reset rozmístění` je jen její další zavolání.

Když lineup nemá žádný slot, layout je prázdný a plocha ukazuje prázdný stav zavedený v F2 s odkazem na Lineup Setup — ne prázdnou mřížku, ze které není poznat, jestli se něco nepokazilo.

### R8 — Sloučení s lineupem doplňuje a odebírá, ruční pozice nikdy nepřepisuje

`mergeWithLineup(existing, slots)` přidá bloky pro nové sloty na jejich výchozí pozici podle R7 (ne na nulu), odebere bloky slotů, které z lineupu zmizely, a existující nechá **naprosto beze změny** — pozici, rotaci i rozměr. Tohle je to pravidlo z roadmapy, které se nesmí obejít: vymění-li kapela kytaristu, plán zůstane stát.

### R9 — Layout se dopočítává jen v editoru; chybějící layout je legitimní stav

Sloučení běží při otevření editoru a nikde jinde. Načtení projektu, generování dokumentu ani export nesmí do `stageplan.layout` zapsat nic — jinak by projekt měnil obsah bez uživatelovy akce a razítko `contentUpdatedAt` by lhalo.

Chybějící `layout` proto znamená „rozmístění nikdo neupravoval". F5b si pro tisk v takovém případě dopočítá výchozí rozmístění za běhu, aniž by ho ukládala. Je to vstupní podmínka pro další spec, ne odložený úkol.

### R10 — Geometrie je v doméně, komponenta je tenká

Nový modul `src/domain/stageplan/layout/` obsahuje čisté funkce bez I/O: `buildDefaultLayout`, `mergeWithLineup`, `moveBlockTo`, `rotateBlockTo`, `snapPositionM`, `snapRotationDeg`, `clampToArea`, `rescaleForStage`, `isStageplanLayoutDirty`. Přepočet metrů na pixely je jediná funkce `createStageScale(area, canvasPx)`.

Alternativa — matematika v React hookách — byla zamítnuta: testy běží v node prostředí bez jsdom, takže pravidla v komponentách by nešlo automaticky ověřit, a F5b by si snap a clamp musela napsat znovu. Tenká komponenta je tady důsledek testovatelnosti, ne estetiky.

### R11 — Normalizace layoutu je povinná a persistence vědomá

`normalizeStageplanLayout()` v `normalizeProject`: neznámý slot pryč, duplicitní slot ponechá první výskyt, nečíselné a nekonečné hodnoty pryč, rozměry musí být kladné, rotace modulo 360, `stage` se přijme jen když jsou oba rozměry kladné. Poškozený layout tedy skončí jako chybějící layout, ne jako výjimka za běhu — projekt se musí dát otevřít i po ruční editaci JSONu.

`NewProjectPayload` a `toPersistableProject` musí `stageplan` (layout i power overrides) nést výslovně. Hlídá to samostatný test: uložení z Lineup Setupu nechá `stageplan.layout` na disku beze změny.

### R12 — Zaokrouhlení je součást modelu

Metry se ukládají na tři desetinná místa (milimetr), rotace na celé stupně. Bez toho by tažení myší plnilo JSON hodnotami typu `4.300000000000001` a každý diff projektu by vypadal jako změna obsahu. Zaokrouhluje doména při každé operaci, ne až serializace.

### R13 — Změna rozmístění posouvá `contentUpdatedAt`

Hlavička PDF tiskne po F4 `UPD <datum>` z `contentUpdatedAt`. Posunuté rozmístění je změna obsahu rideru, ne kosmetika, takže se razítko posouvá stejně jako u změny obsazení. Zapisuje se existující jedinou cestou `saveProjectPayload` ([projectsApi.ts:27](../../../packages/desktop/src/app/services/projectsApi.ts#L27)), která razítko už umí.

### R14 — Editor je vždy tmavý

Obrazovka běží v tmavé paletě i tehdy, když je aplikace ve světlém tématu. Tokeny pro plochu a bloky (`--sp-canvas`, `--sp-canvas-grid`, `--sp-block`, `--sp-block-selected`) mají v handoffu jen tmavou variantu a plán se čte jako plocha, ne jako dokument — na světlém papíře by mřížka i vybraný blok ztratily kontrast, který jim identita dává.

### R15 — Undo přes snapshoty, padesát stavů

`Ctrl+Z` a `Ctrl+Y` nad zásobníkem posledních padesáti stavů pole `blocks`, žijícím jen po dobu sezení v editoru. Stav je malý (šest bloků po šesti číslech), takže snapshot je jednodušší i spolehlivější než inverzní operace, a ruční rozmisťování bez undo je trápení. Zásobník se plní při dokončení gesta (`pointerup`), ne během tažení.

### R16 — Odchylky od prototypu `3g`

| Prototyp | F5a | Proč |
|---|---|---|
| `Delete` odebere blok | klávesa nedělá nic | bloky vznikají z lineupu; mazat lze až volné bloky |
| `＋ přidat blok` v toolbaru | vypuštěno | totéž — přidávat lze až volné bloky |
| popisek `ZOOM 100 %` | vypuštěno | ovládání zoomu neexistuje, plocha se přizpůsobuje oknu přes `ResizeObserver`; konstanta předstírající funkci je horší než nic |
| tab `INPUT LIST` | disabled | obrazovka vznikne v F5c; stav `unavailable` má precedens v F3 |
| patička „Změny se propíší do PDF exportu" | `ROZMÍSTĚNÍ SE ZATÍM DO PDF NEPROPISUJE` | do F5b by to byla nepravda |
| clamp s tolerancí 20 px | tolerance 20 cm | model je v metrech; 20 px prototypu je 22 cm, což je přesnost, kterou nikdo nepozná |
| snap `Math.round(n / 10) * 10` v px | snap 10 cm a 15° v metrech a stupních | pixelový snap by na jiné velikosti okna snapoval na jiná místa |

Snap je při otevření zapnutý a jeho stav se neukládá — je to nástroj, ne vlastnost projektu.

Ve všem ostatním se vzhled i chování řídí handoffem, sekcí `3. Stage Plan Editor` a prototypem `3g`: rozměry toolbaru a panelu, tokeny, kresba bloku včetně mono popisku rotace a oranžového napájení, pruh `DOWNSTAGE · PUBLIKUM`, kurzory `grab` a `grabbing`, přechody jen na barvách po 120 ms.

### R17 — Klávesnice

Prototyp klávesnici nemá a handoff ji nechává na implementaci. Mapa pro F5a, aktivní jen když je vybraný blok a fokus není v poli:

| Klávesa | Akce |
|---|---|
| šipky | posun o 10 cm |
| Shift + šipky | posun o 1 m |
| `R` / `Shift + R` | rotace o +15° / −15° |
| `Ctrl + Z` / `Ctrl + Y` | undo / redo (R15) |
| `Esc` | zruší výběr |
| `Delete` | nedělá nic (R16) |

Posuny z klávesnice procházejí stejným clampem i zaokrouhlením jako tažení myší — jsou to volání téže doménové funkce, ne druhá cesta k témuž.

## Architektura

```
src/domain/stageplan/layout/          nový — čistá geometrie, bez I/O
  defaultLayout.ts                    buildDefaultLayout, zóny podle role, nominální plocha
  mergeWithLineup.ts                  doplnění a odebrání bloků
  blockOps.ts                         moveBlockTo, rotateBlockTo, snap, clampToArea
  rescaleForStage.ts                  proporcionální přepočet na jiný rozměr pódia
  dirty.ts                            isStageplanLayoutDirty
  scale.ts                            createStageScale (metry ↔ px)
src/domain/model/types.ts             + StageplanBlockSlot, StageplanBlock, StageplanLayout
src/app/usecases/normalizeProject.ts  + normalizeStageplanLayout

packages/desktop/src/app/
  pages/StagePlanEditorPage.tsx       načte projekt, sloučí, drží state, registruje guard
  components/stageplan/
    EditorToolbar.tsx                 taby, nástroje, snap, popisek pódia
    StageCanvas.tsx                   plocha, mřížka, downstage pruh
    StageBlock.tsx                    blok a rotační úchyt
    BlockInspector.tsx                pravý panel: vybraný blok, rotace, rozměr, seznam, reset
    useBlockDrag.ts                   pointer eventy → doménová volání
  shell/routes.ts                     + matchProjectStageplanPath, klíč v SHELL_ROUTES
  shell/chrome/processSteps.ts        krok stageplan dostane segment
  shell/types.ts                      NewProjectPayload + toPersistableProject nesou stageplan
  styles/features/stageplan-editor.css
```

Tok dat je jednosměrný: projekt na disku → `normalizeProject` → `mergeWithLineup` při otevření → state komponenty → doménová operace při gestu → state → `saveProjectPayload`. Komponenta nezná metry ani stupně jinak než skrz doménu; `useBlockDrag` drží pouze `pointerId`, výchozí bod gesta a aktuální `scale`.

Navigace: `Zpět na Lineup` a odchod odkudkoli jinud projde `NavigationGuard` registrovaným stejně jako v [LibraryEntityCrud.tsx:33](../../../packages/desktop/src/app/pages/components/library/LibraryEntityCrud.tsx#L33), takže `UnsavedChangesModal` se použije bez úprav. `Generate PDF` uloží a přejde na `/projects/:id/preview` — export už ta obrazovka umí a duplikovat ho nebudu. `Reset rozmístění` je dirty změna ve state, ne zápis na disk.

## Testování

Vitest v node prostředí:

- `buildDefaultLayout` — pět i šest bloků, souřadnice podle R7, determinismus, přepočet na zadaný rozměr pódia
- `mergeWithLineup` — doplnění nového slotu na výchozí pozici, odebrání zmizelého, a hlavně nedotčená ruční pozice, rotace i rozměr existujícího
- `snapPositionM`, `snapRotationDeg`, `clampToArea` — včetně tolerance 20 cm a chování při vypnutém snapu
- `rotateBlockTo` — normalizace do 0–359, zaokrouhlení na násobek 15°
- `rescaleForStage` — proporce drží, rozměry zón se nemění, `null` → zadaný rozměr i naopak
- `normalizeStageplanLayout` — string v rotaci, duplicitní slot, neznámý slot, nula v rozměru, `stage` s nulou, chybějící pole
- `isStageplanLayoutDirty` — nezávislost na zaokrouhlovacím šumu
- `createStageScale` — round-trip metry → px → metry
- `buildProcessSteps` — nová routa je `current`, z ostatních rout projektu je krok `03` ve stavu `available`
- `toPersistableProject` — layout přežije uložení; samostatný test, že uložení ze Setupu ho nesmaže

Komponenty editoru se automaticky netestují: projekt běží bez jsdom (viz CLAUDE.md), takže pointer eventy nejsou dosažitelné. Právě proto je veškerá matematika v doméně. Editor se ověřuje ručně přes `npm run dev`.

Baseline před implementací: dva trvale padající testy a velké množství CRLF hlášek z Biome. Hodnotí se **rozdíl**, ne absolutní čísla.

## Rizika

| Riziko | Ošetření |
|---|---|
| Uložení z jiné obrazovky smaže rozmístění | whitelist v `toPersistableProject` a test přímo na tuhle regresi (R11) |
| Zóny se na malém pódiu překrývají | vědomé chování, ne bug (R6); uživatel plán přerovná |
| F5b zjistí, že se text do zóny nevejde | model nese rozměr zóny odděleně od obsahu, takže řešení je věcí kresby, ne přepisu dat (R2) |
| Tažení drhne na velkém plánu | pozice bloků bez CSS transition, přechody jen na barvách, snapshot undo až na `pointerup` (R15) |
| Ruční editace JSONu shodí otevření projektu | normalizace poškozený layout zahodí místo vyhození výjimky (R11) |

## Verifikace

1. `npm test && npm run lint` — bez nových chyb proti baseline
2. Nový projekt: editor otevře plán s pěti bloky v rozestavení podle R7, toolbar píše `PÓDIUM · ROZMĚR NEZADÁN`
3. Posunutí a rotace bloku, uložení, znovuotevření — pozice i rotace jsou tam, kde je uživatel nechal, JSON má souřadnice na tři desetinná místa
4. Změna obsazení v Lineup Setupu a uložení — rozmístění zůstává; přidaný lead vokál dostane blok, odebraná role ho ztratí
5. Zadání rozměru pódia 10 × 6 m — rozmístění drží tvar, bloky zůstávají na ploše
6. Odchod z editoru s neuloženou změnou vyvolá `UnsavedChangesModal`
7. Procesní stopa: krok `03 STAGE PLAN` je dostupný, `02 INPUTS` zůstává `unavailable`
8. Export PDF se proti stavu před F5a nezměnil ani o pixel
