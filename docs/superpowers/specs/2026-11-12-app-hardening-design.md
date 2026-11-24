# Zpevnění aplikace — opravy z revize 12. 11. 2026

## Záměr

Revize kódu (čtyři audity po vrstvách) našla chyby, které vedou ke ztrátě dat,
špatnému výstupu v PDF nebo pádu bez srozumitelné hlášky. Tento dokument vybírá
z nálezů jen ty, které jsou **jednoznačné chyby** a jdou opravit, aniž by se
měnil tvar uloženého JSON nebo rozhodovalo o produktu. Zbytek nálezů zůstává
v závěrečné zprávě jako návrhy pro majitele.

Výběr provedl Claude samostatně; majitel ho neschvaloval po položkách
(pokyn: „pracuj samostatně, zprofesionalizuj a zrobustni“).

## Hranice (platí pro všechny dávky)

- Větev `chore/app-hardening` (nad `feat/band-editor`), worktree
  `c:\Users\mkrecmer\dev\stagepilot-hardening`. Pracuj jen tam.
- **Necommituj.** Změny zůstávají v pracovním stromu.
- Neměň tvar uloženého JSON (projekt, kapela, muzikant, `meta.json`).
- Nepřidávej funkce, neměň texty UI ani rozložení, nerefaktoruj nad rámec opravy.
- Neopravuj předexistující selhání (viz baseline) ani cizí testy, pokud to
  položka výslovně nežádá.
- Čísla řádků v položkách pocházejí z `main` (HEAD `136464a`); na této větvi
  jsou posunutá. Místo najdi podle citace.
- Každá položka: nejdřív test, který selže z popsaného důvodu, pak oprava.
- Když se nález na této větvi nepotvrdí (kód je jinak, chyba nenastává),
  položku neimplementuj a napiš to do reportu s důkazem.
- Do `%APPDATA%\StagePilot` nezapisuj; testy používají dočasné adresáře.

## Baseline ve worktree (měřeno 12. 11. 2026, před změnami)

| Kontrola | Stav |
|---|---|
| `npm test` | 1382 prochází, 3 padají: `assetsPaths.test.ts`, `repoAssets.test.ts`, `pdf.test.ts` („embeds the brand fonts“) |
| `npx tsc --noEmit` (kořen) | 0 chyb |
| `npx tsc --noEmit` v `packages/desktop` | 14 chyb (12 v testech, 2 v produkčním kódu: `ProjectSetupPage.tsx`, `resolveStagePositionOrder.ts`) |
| `npm run lint` | 647 chyb (převážně CRLF) |

Úspěch se měří rozdílem proti těmto číslům, ne nulou. `tsc` v desktopu občas
spadne na nedostatek paměti; opakuj.

## Dávka A — doména (`src/domain/**`)

**A1. Override muzikanta nesmí zasáhnout ostatní muzikanty téže role.**
`src/domain/pipeline/buildDocument.ts`:
`const affected = inputs.filter((input) => input.group === group);` a v
`applyInputOverridePatch` `ownerMusicianId: source[0]?.ownerMusicianId`.
Vstup `lineup.guitar = ["g1", {musicianId:"g2", presetOverride:{inputs:{update:[{key:"el_guitar", note:"G2 ONLY"}]}}}]`
dnes dá poznámku „G2 ONLY“ i kanálu g1 a oběma vlastníka g1; `remove` u g2
smaže i kanál g1. Správně: patch se týká jen kanálů muzikanta, který ho nese,
a vlastník každého kanálu zůstává. Pořadí kanálů ve výstupu pro případy
s jedním muzikantem v roli se nesmí změnit. Pokryj testem role guitar, keys,
vocs (update, remove, add).

**A2. Rozsah kanálů na stage plánu nesmí zahrnout cizí kanály.**
`src/domain/pipeline/pdf/buildPdfStageplanPrintModel.ts`:
``const range = min === max ? `${min}` : `${min}–${max}`;``. Po ručním přeřazení
(`inputOrder`) tiskne box bicích `Drums (1–11)`, i když kanál 2 patří base.
Správně: souvislé úseky oddělené čárkou, např. `Drums (1, 3–11)`. Souvislý
rozsah se tiskne stejně jako dnes.

**A3. `formatDocumentDate` nesmí posouvat neexistující datum.**
`src/domain/formatters/meta.ts`. `"2026-02-31"` dnes dá `3. 3. 2026`. Správně:
stejný výsledek jako pro jiné neplatné datum (`"2026-13-01"` → `""`).

**A4. Stereo pár podle přípony musí mít shodný základ klíče.**
`src/domain/formatters/inputlist.ts`: `if ((aIsL && bIsR) || (aIsR && bIsL))`.
`synth_l` + `piano_r` se dnes sloučí. Správně: pár jen při shodném základu.

**A5. Monitoring patch bicích jen s `additionalWedgeCount` se nesmí zahodit.**
`src/domain/setup/resolveEffectiveProjectSetup.ts`:
`drumPatch?.monitoring?.monitorRef ? {...} : defaultPreset.monitoring`.
Správně: sloučit výchozí monitoring s patchem stejně jako u ostatních rolí.

## Dávka B — infrastruktura a usecases (`src/infra/**`, `src/app/usecases/**`)

**B1. Escapování textu ve stage plánu.**
`src/infra/pdf/sections/stageplan.ts` vkládá `box.header`, odrážky a
`box.powerBadgeText` do HTML bez escapování; `esc()` je jen lokálně
v `src/infra/pdf/template.ts`. Správně: jedna sdílená funkce použitá v obou
souborech; jméno `A<b>&B` se vytiskne doslova. Test na `<`, `>`, `&`, `"`.

**B2. Neúspěšný export nesmí nechat sirotčí složku verze a výpis verzí nesmí
na vadné složce spadnout.**
`src/app/usecases/exportPdf.ts` volá `prepareVersionDir` před `renderPdf` a při
chybě složku neuklidí; `listProjectVersions` v `src/infra/fs/versionStore.ts`
čte `meta.json` z každé složky a první chybějící ho shodí. Správně: při chybě
renderu nebo zápisu verze se právě založená složka verze smaže a původní chyba
se vyhodí dál; `listProjectVersions` přeskočí složky bez čitelného `meta.json`.
`meta.json` se zapisuje jako poslední soubor verze.

**B3. `loadJsonFile` — BOM a kontext chyby.**
`src/infra/fs/loadJson.ts`: `return JSON.parse(raw) as T;`. Správně: odstranit
úvodní BOM; chyba parsování nese cestu k souboru a původní chybu jako `cause`.

**B4. `replaceFileAtomic` nesmí mazat cíl před přejmenováním.**
`src/infra/fs/replaceFileAtomic.ts`: `await fs.rm(destPath, { force: true });`
před `rename`. Správně: `rename` přes existující cíl; při selhání zůstane
původní soubor a temp se uklidí. Ověř testem na Windows, že přepis existujícího
souboru funguje.

**B5. Úklid dočasného souboru PDF a zavírání prohlížeče.**
`src/infra/pdf/pdf.ts`: selhání `fs.rename(tempOutFile, outFile)` nechá temp
soubor; `await browser.close()` ve `finally` může zastínit původní chybu.
Správně: temp se při selhání smaže; chyba ze zavření prohlížeče nepřebije
chybu renderu.

**B6. Bezpečné segmenty cest.**
`projectId`, `versionId`, `defaultContactId` a název PDF (`slug`) jdou do
`path.join` bez kontroly (`versionStore.ts`, `exportPdf.ts`). `id: "..\..\evil"`
dá cestu mimo kořen uživatelských dat; kód kapely `AC/DC` dá podsložku.
Správně: jedna funkce, která odmítne segment obsahující oddělovač cesty, `..`,
znak nepovolený ve Windows názvu nebo rezervované jméno, a vyhodí chybu
s názvem pole. Použít pro id projektu, id verze a id kontaktu. U názvu PDF
nepovolené znaky nahradit `_` (soubor se dál vytvoří, jen s bezpečným jménem).
Existující platná id a slugy musí projít beze změny — ověř na vzorcích, které
generuje `src/domain/projectNaming.ts` a pravidla pro kód kapely.

## Dávka C — desktop UI (`packages/desktop/src/**`)

UI nejde v tomto prostředí spustit. Logiku proto vytahuj do čistých funkcí
s testem (Vitest, Node, bez jsdom) a komponentu měň co nejméně.

**C1. Úprava projektu nesmí zahodit `stageplan`, `inputOrder` a `notes`.**
`app/pages/NewEventProjectPage.tsx` a `NewGenericProjectPage.tsx` staví payload
od nuly: `lineup: existingProject?.lineup, overlays: existingProject?.overlays,
bandLeaderId: existingProject?.bandLeaderId` — ostatní pole existujícího
projektu chybí a po Save zmizí z JSON. Správně: při úpravě se vychází
z existujícího projektu a přepíšou se jen pole, která formulář edituje. Všechna
ostatní pole (i ta, která typ nezná) zůstanou. Test na čisté funkci.

**C2. Načítací efekt v Lineup Setup nesmí znovu běžet kvůli `applyState`.**
`app/pages/ProjectSetupPage.tsx`: efekt načtení projektu má v závislostech
`applyState`, který nepoužívá a jehož identita se mění s `hasTalkbackOverride`;
rozpracovaný stav se pak přepíše stavem z disku. Správně: efekt závisí jen na
tom, co čte, a pozdní odpověď po odmountování nebo změně `id` se zahodí.
Nejdřív ověř čtením, že efekt `applyState` opravdu nevolá; pokud volá, položku
neimplementuj a popiš proč.

**C3. Selhání uložení při vytvoření nebo úpravě projektu.**
`NewEventProjectPage.tsx` / `NewGenericProjectPage.tsx`:
`setIsCommitting(true); … await persist(id);` bez `try/catch/finally`. Správně:
chyba se zobrazí existujícím mechanismem stránky (`setStatus` nebo `notify`,
podle toho, co stránka už používá) a `isCommitting` se vrátí na `false`.

**C4. `ExportResultModal` — hook za podmíněným `return`.**
`app/modals/ExportResultModal.tsx`: `if (!state) return null;` před
`useModalBehavior(…)`. Správně: hook nad podmínkou. Dvě volání `invoke`
(Open file, Open folder) dostanou ošetření chyby existujícím mechanismem.

**C5. Tlačítka bez přístupného názvu.**
`ProjectSetupPage.tsx` (šipky nahoru/dolů s ikonami `ArrowUp`/`ArrowDown`)
a zavírací tlačítko v `ChangeBackVocsModal.tsx`: doplnit `aria-label`
(anglicky, UI je anglicky). Viditelný text neměnit.

## Dávka D — Rust (`packages/desktop/src-tauri/src/**`)

Baseline `cargo test` na této větvi: změř před změnami (předávka uvádí 39).
Sestavení v repozitářovém `target/` při auditu padalo (`E0463`, pád `rustc`);
pomohl čistý cílový adresář mimo repo (`CARGO_TARGET_DIR`) a `-j 2`.

**D1. Nečitelný JSON nesmí zablokovat start aplikace.**
`storage_paths.rs`: `migrate_lineup_json_file` a `cleanup_vocal_overlays_in_file`
vracejí `StorageError::Resolve(format!("Invalid JSON {} …"))`, chyba se šíří
přes `?` z `ensure_user_storage` až do startu, kde aplikace skončí na
`.expect("error while running tauri application")`. Šablona poznámek tutéž
situaci už řeší přeskočením („leaving it untouched“). Správně: startovní
migrace nad projekty a kapelami nečitelný soubor přeskočí, nechají ho beze
změny a zapíšou varování stejným způsobem, jakým to dnes dělá šablona poznámek;
ostatní soubory se zmigrují. Chyby čtení adresáře se dál šíří.

**D2. Atomický zápis s unikátním dočasným jménem.**
`storage_paths.rs`: `let temp_path = path.with_extension("tmp");`. Dva souběžné
zápisy téhož souboru sdílejí dočasný soubor. Správně: dočasné jméno unikátní
pro každý zápis (ve stejném adresáři jako cíl), při selhání zápisu nebo
přejmenování se dočasný soubor smaže. Bez nové závislosti, pokud to jde.

## Mimo rozsah (zůstává v závěrečné zprávě)

Guard při zavření okna, error boundary, izolace poškozeného projektu v Hubu,
limit vstupů 30 vs. 32, pravidla pro lead vokál na stage plánu, duplicitní
muzikant v lineupu, přejmenování kanálů kláves, číslování stereo páru u dvou
klávesistů, pořadí hledání Chrome, návratové kódy CLI, přibalení rendereru pro
distribuci, tři předexistující padající testy, vše v Rustu.
