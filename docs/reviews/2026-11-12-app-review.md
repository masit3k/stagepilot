# Revize StagePilot — 12. 11. 2026

Revize proběhla jako čtyři nezávislé audity po vrstvách (doména, usecases +
infrastruktura + CLI, React UI, Rust/Tauri + distribuce) nad `136464a`
(`chore/harness-hardening`) a jako srovnání s webovou aplikací Rider Maker
(toolsforsound.cz/ridermaker, čteno ze zdrojáku `app.js`).

Část nálezů je už opravená na větvi `chore/app-hardening` (nad
`feat/band-editor`, necommitováno). Zbytek čeká na rozhodnutí.

## 1. Závěr

- **Jádro je v dobrém stavu.** Doména je čistá, testovaná a deterministická;
  1382 testů před revizí, žádné `any`, export hlídá kolize i přetečení A4.
- **Největší rizika byla ve ztrátě dat a v chybném PDF**, ne v architektuře.
  Úprava projektu mazala rozmístění pódia, override jednoho muzikanta
  přepisoval kanály druhého, jména šla do HTML bez escapování. Tyto chyby jsou
  opravené (oddíl 2).
- **Aplikaci dnes nejde vydat.** Instalátor se nesestaví a export PDF by mimo
  vývojový stroj nefungoval (oddíl 4). To je samostatný projekt, ne oprava.
- **Rider Maker je v šířce dál, StagePilot v hloubce.** Stojí za to převzít
  sloupce mikrofon / stojan / 48 V, volné prvky na pódiu, zálohu projektu
  a ukázková data (oddíl 5).

## 2. Co je opraveno na `chore/app-hardening`

Zadání: `docs/superpowers/specs/2026-11-12-app-hardening-design.md`. Každá
oprava má test, který před ní padal.

| # | Oprava | Kde |
|---|---|---|
| A1 | Override muzikanta už nezasáhne ostatní muzikanty téže role | `src/domain/pipeline/buildDocument.ts` |
| A2 | Rozsah kanálů na stage plánu tiskne souvislé úseky (`Drums (1, 3–11)`) | `buildPdfStageplanPrintModel.ts` |
| A3 | Neexistující datum (`2026-02-31`) se neposouvá, vrací prázdný text | `formatters/meta.ts` |
| A4 | Stereo pár jen při shodném základu klíče | `formatters/inputlist.ts` |
| A5 | Přídavný wedge u bicích se nezahodí | `setup/resolveEffectiveProjectSetup.ts` |
| B1 | Texty ve stage plánu se escapují (sdílená `escapeHtml`) | `src/infra/pdf/` |
| B2 | Neúspěšný export uklidí složku verze; výpis verzí přežije vadnou složku | `exportPdf.ts`, `versionStore.ts` |
| B3 | `loadJsonFile` snese BOM a v chybě uvede cestu | `src/infra/fs/loadJson.ts` |
| B4 | `replaceFileAtomic` nemaže cíl před přejmenováním | `replaceFileAtomic.ts` |
| B5 | Po chybě nezůstane dočasné PDF; zavření prohlížeče nepřebije chybu renderu | `src/infra/pdf/pdf.ts` |
| B6 | Id projektu, verze a kontaktu se kontrolují, než jdou do cesty; název PDF se čistí | `safePathSegment.ts` |
| C1 | Úprava projektu zachová `stageplan`, `inputOrder`, `notes` | `buildProjectInfoPayload.ts`, obě stránky |
| C2 | Lineup Setup se sám nepřenačítá z disku; pozdní odpověď se zahodí | `ProjectSetupPage.tsx` |
| C3 | Selhání uložení projektu se zobrazí a formulář jde použít znovu | `commitProjectSave.ts` |
| C4 | `ExportResultModal`: hook nad podmínkou, chyby Open file / folder se ukážou | `ExportResultModal.tsx` |
| C5 | Šipky pořadí mají `aria-label` | `ProjectSetupPage.tsx` |
| D1 | Nečitelný JSON projektu nebo kapely nezablokuje start aplikace | `storage_paths.rs` |
| D2 | Atomický zápis má unikátní dočasné jméno a uklízí po selhání | `storage_paths.rs` |
| D3 | „Save as musician default“ přežije nové načtení: soubor nese `{ musicianId, role, setup }` a klíč `id:role` se skládá z obsahu, ne ze jména souboru (14. 11.) | `lib.rs` |
| D4 | Open file / Open folder vrátí chybu, když cesta neexistuje; dřív hlásily úspěch vždy, takže hláška z C4 nebyla na Windows dosažitelná (14. 11.) | `lib.rs` `open_path` |
| D5 | `node` a `cmd` se spouštějí bez okna konzole — nutné pro release build (14. 11.) | `lib.rs` `background_command` |
| D6 | Přetahování řádků na Inputs funguje i v okně aplikace (`dragDropEnabled: false`); dřív ho na Windows blokoval nativní drop souborů (15. 11.) | `tauri.conf.json` |
| D7 | Náhled a export řeknou skutečný důvod selhání (nevejde se na A4, kolize boxů) místo odkazu na logy, které release nemá (15. 11.) | `exportErrors.ts`, `ProjectPreviewPage.tsx`, `lib.rs` |

Ruční průchod 15. 11.: C2, C3, C4 potvrzeny; C1 potvrzeno pro přeřazení
kanálů, zachování stage plánu při úpravě projektu čeká na potvrzení pořadí
kroků. Po D7: `npm test` 1545 prochází, tytéž 3 padají; desktop `tsc` 14.

Předexistující, neopraveno: projekt COS 17-12 Hradec přetéká A4 o 24 px na
výšku; oba projekty BK padají na kolizi boxů stage plánu. Stejně se chovají
i nad `136464a`.

Stav k 14. 11.: `cargo test` 51 (bylo 46), `cargo clippy` 7 varování, `npm test`
1540 prochází a tytéž 3 padají, `tsc` v kořeni 0. Počet z `npm run lint` po
release buildu není srovnatelný — biome prochází i `src-tauri/target/` a
`packages/desktop/dist/`.

Lokální release build bez instalátoru: `npm run tauri:build:local` (přeskakuje
`tsc`, viz oddíl 4 bod 1). Výsledné exe má cestu k repozitáři zapečenou při
kompilaci, funguje tedy jen na tomto stroji a dokud tento worktree existuje.

### Měření (worktree, před → po)

| Kontrola | Před | Po |
|---|---|---|
| `npm test` | 1382 prochází, 3 padají | 1540 prochází, tytéž 3 padají |
| `npx tsc --noEmit` (kořen) | 0 | 0 |
| `npx tsc --noEmit` (desktop) | 14 | 14 |
| `npm run lint` | 647 | 649 — z toho +4 jsou vygenerovaná schémata v `src-tauri/gen/`, zdrojáky −2 |
| `cargo test` | 39 | 46 |
| `cargo clippy` | 7 varování | 7, stejná |

### Co potřebuje ruční průchod v běžící aplikaci

UI nešlo spustit, C2–C4 jsou ověřené jen čtením a typovou kontrolou.

- **C1:** upravit datum nebo místo u projektu s ručním stage plánem a pořadím
  kanálů; rozmístění i pořadí musí zůstat.
- **C2:** projekt s talkbackem → změnit sestavu → `Reset to defaults` nebo
  přepnout talkback; rozpracovaný stav se nesmí vrátit ke stavu z disku.
- **C3:** vynutit selhání uložení; má se ukázat „Failed to save project.
  Please try again.“ a tlačítko jde použít znovu.
- **C4:** selhání Open file / Open folder ukáže hlášku v modálu. Po D4 jde
  vyvolat: po exportu smazat nebo přejmenovat vyexportované PDF a kliknout.

### Rozhodnutí přijatá při opravách (ke kontrole)

- **A1:** dva vokalisté teď mohou přidat kanál se stejným klíčem; dřív to
  skončilo chybou „Preset override collision“.
- **A5:** patch bicích s `monitorRef` bez počtu wedge zachová výchozí počet
  (dřív ho zahodil); počet 0 se bere jako nenastaveno. Stejně se chovají
  ostatní role.
- **B6:** id obsahující `..`, oddělovač cesty, koncovou tečku nebo rezervované
  jméno Windows se odmítne chybou. Všechna id a slugy, které aplikace sama
  generuje, procházejí (test).
- **C1:** úprava projektu dál nastavuje `status: "active"` jako dřív.
  Neznámá pole přežijí v paměti, ale na disk je nepustí `toPersistableProject`
  — to je stávající chování.
- **C3, C4:** tři nové anglické texty v chybových stavech, které dřív neměly
  žádný.
- **D1:** přeskakuje se i soubor s neplatným UTF-8.

### Zbytky po práci

- `C:\Users\mkrecmer\AppData\Local\Temp\evil` — tři podsložky z testu B6,
  který nejdřív (záměrně) padal. Agentovi bylo smazání odepřeno; smaž ručně.
- `%LOCALAPPDATA%\Temp\stagepilot-storage-tests-*` — šest adresářů z testů D.

## 3. Nálezy, které čekají na rozhodnutí

Seřazeno podle dopadu. U každého je místo a to, co je potřeba rozhodnout.

### Ztráta dat a práce

1. **Rozhodnuto 14. 11.: samostatná feature se specem, až bude hardening
   commitnutý.** Zavření okna zahodí neuložené změny. `windowActions.ts` volá `close()`
   bez `onCloseRequested`; hooky v `app/guards/` nikdo nepoužívá. Roadmapa to
   vede jako vědomou mezeru. Doporučuji zařadit před vydání.
2. **Opraveno 14. 11. jako D3.** ~~„Save as musician default“ nikdy nefungovalo.~~
   V běžící session fungovalo, ztrácelo se při dalším načtení. Rust ukládá pod
   `id_role.json` a při čtení dává klíč `id_role`; UI hledá `id:role`
   (`lib.rs` `update_musician_defaults`, `musicianDefaultsKey.ts`). Oprava mění
   uložený tvar. Na disku zatím žádná data nejsou (`catalog/` obsahuje jen
   `bands`, `contacts`, `musicians`, `templates`), takže migrace není potřeba.
3. **„Save & Exit“ při selhání mlčí** (`useAppNavigation.ts`, jen
   `console.error`) a na neúplném formuláři nic neuloží a přesto odejde.
4. **Jeden nečitelný projekt vyprázdní Hub** (`projectMaintenance.ts`,
   `parseProjectPayload` v cyklu bez ošetření). Projekt smazané kapely z Hubu
   tiše zmizí. Potřebuje rozhodnout, jak poškozený projekt zobrazit.
5. **Chybí error boundary.** Okno je bez rámečku, pád renderu odmountuje
   i vlastní title bar s křížkem.
6. **Trvalé smazání projektu bere exporty podle předpony.** Projekt se slugem
   `a` smaže i `a__b.pdf` cizího projektu (`lib.rs`, `starts_with`).
7. **`migrate_legacy_library` při vadném `library/*.json` start dál shodí.**
   Stejná oprava jako D1, jen pro starý formát.

### Správnost výstupu

8. **Lead vokál na stage plánu se počítá dvěma různými pravidly.** Při dvou
   kytaristech, z nichž druhý zpívá lead, dostane box cizí jméno a zpěvák
   z plánu vypadne (`buildPdfStageplan.ts` vs. `resolveBlockSlots.ts`).
   Reprodukováno na `main`; `feat/band-editor` tuto oblast mění, takže je
   potřeba ověřit znovu tam.
9. **Dva klávesisté se stereo klávesami ztratí zarovnání páru na liché číslo**
   (`formatters/inputlist.ts`, klíč po rozlišení končí `_l_1`).
10. **Přejmenování kanálu kláves se tiše zahodí, UI ho přitom nabízí**
    (`formatKeysInputs.ts`). Buď respektovat, nebo pole zamknout.
11. **Duplicitní muzikant v lineupu projektu se nevaliduje**; pro kapelu
    validace existuje.
12. **Limit vstupů: kód a test říkají 30, dokumentace 32**
    (`validateDocument.ts`, `ARCHITECTURE.md`, `PROJECT_GUIDELINES.md`).
    `validateDocument` navíc počítá i výplňové kanály, souhrn pro UI ne —
    UI může hlásit OK a export spadnout.
13. **Náhled PDF může neodpovídat exportu**, když se „Hide musician names“
    přepne během generování (`ProjectPreviewPage.tsx`).

### Robustnost

14. **Pořadí hledání prohlížeče.** První se bere systémový Chrome libovolné
    verze, tabulka glyfů je přitom měřená v Chromiu (`pdf.ts`). To je i příčina
    padajícího testu fontů.
15. **CLI vrací kód 0 i při `ok:false`** a chyby třídí regexem nad textem
    hlášky (`src/cli/index.ts`).
16. **`ensure_user_storage` běží při každém příkazu** a pokaždé projde migrace
    nad všemi soubory (`storage_paths.rs`).
17. **CSP je vypnuté** a `open_file` skládá `cmd /C start` z cesty bez
    uvozovek (`tauri.conf.json`, `lib.rs`). Zneužitelné až po vložení skriptu
    do webview; B1 jeden takový vektor zavřel.
18. **Všech 37 příkazů je synchronních**, export zmrazí okno na několik sekund.
19. **Logování v release neexistuje** (`eprintln!` při
    `windows_subsystem = "windows"`), UI přitom radí „Check desktop logs“.
20. **Esc zavře všechny vrstvy modálů naráz; klávesy editoru pódia fungují
    i pod modálem.**

### Tři padající testy

Projektové pravidlo říká předexistující selhání neopravovat, proto zůstaly.

- `assetsPaths.test.ts` — **vadný test.** Očekává POSIX cestu, `path.join` na
  Windows vrací zpětná lomítka. Oprava je jeden řádek.
- `pdf.test.ts` („embeds the brand fonts“) — **křehký test.** Oba fonty jsou
  vložené, test natvrdo čeká jméno s pomlčkou. Souvisí s bodem 14.
- `repoAssets.test.ts` — **rozhodnutí o chování.** `60ca33f` vrátil toleranci
  chybějícího adresáře a test neupravil. Otázka je, zda mají chybějící
  vestavěné assety selhat hned, nebo se načíst tiše bez presetů.

### Údržba (nízká priorita)

- `ProjectSetupPage.tsx` (1882 ř.) a `ProjectInputsPage.tsx` (1750 ř.) míchají
  načítání, migraci, validaci a vykreslení. `lib.rs` má přes 2100 řádků.
- Doména importuje typ `DataRepository` z `src/infra`; `buildDocument.ts`
  volá `console.warn`; `projectNaming.ts` čte hodiny a náhodu.
- Mrtvý kód: `app/guards/*`, `app/router/navigation.ts`,
  `layout/ShellLayout.tsx`, `DrumSetupEditor.tsx`, `formatMonitorLabel`,
  `formatLeadVocalDisplayLabel`, pole `Project.talkbackOverride`.
- Tři normalizéry lineupu a čtyři detekce stereo strany s různými pravidly.
- Bez testů: `validateDocument`, `cli/index.ts`, `useLayoutHistory`,
  `useEditorKeyboard`, `ProjectSetupPage` jako celek.

## 4. Co brání vydání instalátoru

1. **`tauri:build` neprojde** — `tsc` v desktopu hlásí 14 chyb. Dvanáct je
   v testech, dvě v produkčním kódu, který přidala `feat/band-editor`:
   `ProjectSetupPage.tsx` a `src/domain/stageplan/resolveStagePositionOrder.ts`.
   Na `main` jich je 10, všechny v testech.
2. **Export, náhled a tiskové metriky spouštějí `node --import tsx` nad
   repozitářem** na cestě zapečené při kompilaci (`CARGO_MANIFEST_DIR`). Na
   cizím počítači není Node, `tsx`, skripty ani repo. Možnosti: sidecar se
   zkompilovaným exportérem, přibalený Node s bundlem, nebo tisk přes WebView2.
3. **Presety a fonty nejsou v bundlu** (`tauri.conf.json` nemá
   `bundle.resources`; cesty se berou z `process.cwd()`).
4. **Chromium není přibalený**; bez systémového Chrome export selže.
5. **Čistá instalace nemá žádnou kapelu ani muzikanta.**
6. **Chybí podpis, updater, metadata** (`description = "A Tauri App"`,
   `authors = ["you"]`), licence a CI.

## 5. Srovnání s Rider Makerem

### V čem je StagePilot dál

- **PDF je vektorové a deterministické.** Rider Maker tiskne JPEG rastr přes
  html2canvas.
- **Input list vzniká z dat.** Muzikant má presety, kapela sestavu; změna
  sestavy přepočítá kanály i plán. V Rider Makeru entita „člen kapely“
  neexistuje, vše se kreslí a píše ručně.
- **Kontroly před exportem:** kolize boxů, přetečení A4, stereo páry na
  lichém kanálu.
- **Verzované exporty, undo i redo, testy.**

### Co doporučuji převzít

| Priorita | Co | Proč a jak to sedí na StagePilot |
|---|---|---|
| 1 | **Sloupce Mikrofon / DI, Stojan, 48 V, Vlastní** v input listu | Zvukař je očekává; dnes je jen `input` a `note`. Hodnoty mohou nést presety, takže se vyplní samy. „Vlastní“ rozšiřuje to, co už umí monitory (`supplier: band\|foh`). |
| 1 | **Záloha a načtení projektu / kapely jako JSON** | Dnes neexistuje žádný import ani export dat. Levné a řeší přenos mezi počítači. |
| 1 | **Ukázková kapela při první instalaci** | Čistá instalace je prázdná. Rider Maker má „Otevřít ukázku“ s bannerem „Ukázková data“. |
| 2 | **Volné prvky na pódiu**: riser, wedge, zásuvka, popisek | Dnes jsou jen bloky z lineupu; riser je natvrdo text `Drum riser 3x2`. Přídavná vrstva objektů vedle bloků, bloky zůstanou generované. |
| 2 | **Napájení jako data s UI** | Model ho má (`requirements.power`, `powerOverridesByMusician`), UI pro zadání chybí. |
| 2 | **Křížové vazby na plánu**: bublina s čísly kanálů a mixu u prvku | StagePilot čísla kanálů v boxu už tiskne; chybí číslo monitorového mixu. |
| 2 | **Export input listu do CSV a stage plánu do SVG** | Pro zvukaře, který si list načte do konzole nebo tabulky. |
| 3 | **Technický a hospitality rider** jako bloky textu s rychlými sekcemi | Library `Messages` dnes do PDF nevede. Byl by to třetí, volitelný dokument; dvoustránkové PDF zůstane. |
| 3 | **Seznam vybavení rozdělený na „přiveze kapela“ / „zajistí pořadatel“** | Odvodí se z dat (mikrofony, stojany, monitory), jakmile bude sloupec „Vlastní“. |
| 3 | **Živý odkaz a QR na výtisku** se stránkou pro pořadatele | Nejsilnější nápad Rider Makeru: pořadatel vidí poslední verzi i ze starého papíru. Vyžaduje server, což je pro lokální desktopovou aplikaci nová vrstva. |
| 3 | **Prohlídka ovládání** | Devět kroků se zvýrazněním prvku. |

### Principy, které stojí za pozornost

- **Stav uložení je vždy vidět** („Neuložené změny“ / „Uloženo 12. 11.
  14:05“) a odchod s neuloženými změnami se hlídá. StagePilot guard při
  zavření okna nemá.
- **Strana A4 se přizpůsobí obsahu** (výška řádků a písmo podle počtu
  kanálů). StagePilot při přetečení export zastaví. Kompromis: ukazatel
  zaplnění strany už na obrazovce Inputs, ne až chyba při exportu.
- **Po smazání se nabídne „Vrátit“** místo potvrzovacího dialogu předem.

### Co nepřebírat

Rastrové PDF, přihlášení názvem kapely a šestimístným kódem, celou aplikaci
v jednom souboru bez testů, ruční číslování kanálů.

## 6. Co revize neprověřila

- Běžící aplikaci: nic z UI nebylo spuštěno.
- `stageplan/print/*` (glyfy, kolize, měřítko), CSS a kontrast, buildery polí
  nástrojů, obsah většiny testů.
- Skutečný vzhled PDF po opravách A2 a B1.
- `npm run tauri:build` (nespouštěno; blokaci dokládá jen `tsc`).
- Chování serveru Rider Makeru; srovnání vychází z klientského kódu.
- Nálezy 8 a 13 jsou z `main`; na `feat/band-editor` neověřeny.
