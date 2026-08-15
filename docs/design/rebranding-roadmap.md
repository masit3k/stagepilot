# Rebranding — mapa fází a stav

Vstupní bod pro pokračování práce na rebrandingu. Detaily každé fáze jsou v jejím specu
v `docs/superpowers/specs/`; tady je jen co je hotové, co je další a co do které fáze patří.

**Zdroj návrhu:** `docs/design/brand-handoff-2026-08/` — `StagePilot Brand.dc.html` je celý
designový board, implementuje se **kolo 3** (`3a`–`3d` varianty značky, vybráno `3b` XLR;
`3e` ikona ve Windows; `3f` Lineup Setup; `3g` Stage Plan Editor). Kola 1 a 2 jsou zamítnutá.

## Stav

| Fáze | Co | Stav | Spec | Commit |
|---|---|---|---|---|
| F0 + F1 | Identita, ikona aplikace, dvouvrstvá tokenová architektura, tmavé téma | hotovo | [2026-08-12-brand-identity-and-token-foundation-design.md](../superpowers/specs/2026-08-12-brand-identity-and-token-foundation-design.md) | `56b05cb` |
| F2 | Ikonový set, toasty, prázdné stavy, skeleton, pozice jako řádky | hotovo | [2026-08-12-components-and-interaction-design.md](../superpowers/specs/2026-08-12-components-and-interaction-design.md) | `56b05cb` |
| F3 | Custom titlebar, pilulková navigace, procesní stopa, velikost okna, téma v Settings | hotovo | [2026-08-12-shell-and-information-architecture-design.md](../superpowers/specs/2026-08-12-shell-and-information-architecture-design.md) | `17c4580`, `cebabcf` |
| F4 | Typografie a hlavička PDF | hotovo, čeká na vizuální kontrolu | [2026-08-12-pdf-typography-and-header-design.md](../superpowers/specs/2026-08-12-pdf-typography-and-header-design.md) | `785377d`…`b8c9e40` |
| F5a | Model rozmístění + Stage Plan Editor | hotovo, čeká na ruční kontrolu editoru | [2026-08-13-stageplan-editor-and-layout-model-design.md](../superpowers/specs/2026-08-13-stageplan-editor-and-layout-model-design.md) | `fdee3b8`…`67b3895` |
| **F5b** | **PDF čte rozmístění z projektu (pozice, rotace, nová kresba bloků)** | **hotovo, čeká na ruční kontrolu** | [2026-08-13-pdf-reads-stageplan-layout-design.md](../superpowers/specs/2026-08-13-pdf-reads-stageplan-layout-design.md) | `7ec42a9`…`b6fbf96` |
| F5c | Obrazovka `02 INPUTS` | připraveno k otevření | zatím není | — |
| **F6** | **Tok na editor, obsah bloků, úchyty velikosti, tisk bez zvýraznění, kapelník, angličtina** | **hotovo, čeká na ruční kontrolu** | [2026-08-13-editor-flow-block-content-and-ui-language-design.md](../superpowers/specs/2026-08-13-editor-flow-block-content-and-ui-language-design.md) | `9b27385`…`b1e18f4` |
| **F7** | **Tištěný box podle textu, kapelník v boxu, kontakt v hlavičce** | **spec hotový, neimplementováno** | [2026-08-15-print-box-sized-by-text-and-header-contact-design.md](../superpowers/specs/2026-08-15-print-box-sized-by-text-and-header-contact-design.md) | — |

## F4 — typografie a hlavička PDF

**Vstup:** handoff sekce `4` (PDF export) a `2c`, plus `FNB_Inputlist_Stageplan_22-08-2026_Zamek-Bon-Repos.pdf`
jako současný stav exportu.

Struktura, pořadí stran ani obsah PDF se **nemění**. Mění se hlavička a patička obou stran,
typografie podle tokenů z F1 (Space Grotesk a IBM Plex Mono místo Interu) a tabulka, která
ztrácí rámečky. Detaily a všech jedenáct rozhodnutí jsou ve specu.

Bloky stage planu si vzhled nechají a řeší se až v F5 — editor je stejně přepisuje kvůli
rotaci a pozicím.

**Hotovo.** Pojistka proti přetečení A4 v `src/infra/pdf/pdf.ts` nefungovala — porovnávala
`#content.bottom` proti `#page.bottom`, jenže `#content` je přímý potomek `#page` a `.pdfPage`
neměla v CSS výšku, takže rozdíl byl vždy zhruba nula. Nově měří přetečení ve výšce i v šířce a
po zápisu souboru se navíc kontroluje počet stran ve výsledném PDF.

Zbývá **vizuální kontrola** vytištěného dokumentu, viz sekci „Stav implementace" ve specu.

## F5 — Stage Plan Editor

**Vstup:** handoff sekce `3g` (živý prototyp — otevřít v prohlížeči a vyzkoušet chování).

**F5 se dělí na tři specifikace** (rozhodnutí R1 ve specu F5a): `F5a` doménový model rozmístění a
editor, `F5b` tisk téhož rozmístění, `F5c` obrazovka `02 INPUTS`. Jsou to nezávislé celky a v jednom
specu by to byl trojnásobek precedentu F1–F4 bez commitovatelného mezistavu. Detaily a rozhodnutí
R1–R17 jsou ve specu F5a; níže zůstává jen to, co platí pro celou fázi.

**F5a je hotová** — model, persistence i editor stojí, sekce „Stav implementace" ve specu popisuje
odchylky a co se předává dál. Zbývá **ruční kontrola editoru** v `npm run dev`: běží v okně Tauri,
takže se automaticky ověřit nedala.

**F5b je taky hotová** — tisk čte `stageplan.layout`, kreslí bloky na jejich pozicích a rotacích
podle nové identity a patička editoru už mezeru z F5a nepřiznává, protože přestala existovat.
Ověřování po jednom z tasků (Task 8) odhalilo skutečný defekt v návrhu, ne v implementaci: nominální
plán byl přesně tak široký jako tiskové zrcadlo, takže blok u boční hrany pódia — legální umístění,
které clamp z F5a povoluje — shodil export. Oprava (`resolvePrintScale`) rezervuje místo na přesah
přímo v měřítku a zmenšila nominální plán o ~4,9 %. Detaily, tři review nálezy vzešlé z chyb v
plánu a co zůstává neověřené (body 2–8 z Verifikace, vyžadují `npm run dev`) jsou v sekci „Stav
implementace" specu F5b.

**Co si z F4 přinést:** geometrie stage planu se nově odvozuje z tiskového zrcadla — `areaWidthMm`
z `contentWidthMm` mínus odsazení a rámeček kontejneru, šířky bloků a mezer z `areaWidthMm`.
Nesahej na to zpátky konstantami: dokud byla `areaWidthMm` napsaná natvrdo jako 180, byl kontejner
širší než stránka a Chromium tisklo **celý dokument zmenšený na 91,25 %**. Pojistka to dnes chytí
(`scrollWidth > clientWidth`), ale jen když ji nikdo neobejde.

Tmavé okno, toolbar, canvas s bloky, panel, patička. Souřadnice a rozměry se ukládají
**v metrech**, ne v pixelech. `stagePlan.blocks` se generuje z lineupu, dál se edituje ručně a při
změně lineupu se bloky doplňují a odebírají, ale ruční pozice existujících se **nepřepisují**.
PDF čte stejný `stagePlan` — žádný druhý layout.

V **F5c** přijde **obrazovka `02 INPUTS`**, kterou F3 odložila: dnes se inputy editují
v modálu uvnitř setupu, takže krok `02` v procesní stopě má stav `unavailable`. V
`app/shell/chrome/processSteps.ts` stačí u kroku přepsat `segment` z `null` na routu — krok `03`
takhle odemkne už F5a.

**Směr je rozhodnutý (2026-08-15), spec zatím není.** Obrazovka je editor kanálů **i
poznámek**: modály pro editaci inputů se přestěhují z `ProjectSetupPage.tsx` (2756 řádků)
sem a krok `01` zůstane o lidech a presetech. Poznámky se editují jako **odchylky projektu
nad šablonou kapely** — šablona (`notesTemplateRef`, dnes `notes_default_cs`) dál určuje,
co se nabídne, projekt si drží jen to, které řádky vypnout a jaké vlastní přidat, takže
úprava kvůli jednomu koncertu neovlivní ostatní dokumenty té kapely. Zamítnuto: editovat
rovnou šablonu kapely a zrušit krok `02`. Podrobnosti v sekci „Navazuje" specu F7.

## F6 — tok, obsah bloků, úchyty a jazyk

Není to F5d: F5 byla rozdělená rozhodnutím R1 ve F5a na model, tisk a `02 INPUTS`, a tohle je jiné
téma. F5c tím zůstává otevřená a nezávislá.

Šest bodů v jednom specu, patnáct rozhodnutí `R1`–`R15`. Dvě věci, které stojí za přečtení, i když se
do F6 nepustíš hned:

- **Krok `03 STAGE PLAN` ve stopě je klikatelný už dnes.** Nefunkční je krok `02` a to je F5c. Díra
  je v tom, že `Continue` z Lineup Setupu míří na `/preview`, takže editor v hlavní cestě nikdo
  nepotká.
- **Rezerva na minimální šířku tištěného boxu je aktivní v každém výchozím rozmístění.** Nejužší
  výchozí zóna je 2,6 m, mez leží kolem 2,81 m, takže `resolvePrintScale` snižuje měřítko už teď.
  Zmenšení jedné zóny přeškáluje **celý** tištěný plán. F6 to řeší tím, že karta bloku v editoru je
  tištěný box a zóna je obrys uvnitř — zmenšení, které tisk nepřevezme, je pak vidět.

F6 **mění R5 z F5b**: inverzní lead vokál v PDF končí, všechny bloky mají stejnou barvu. Je to vědomá
odchylka od handoffu, řádek 125. Handoff se neupravuje, je to vstupní artefakt.

**F6 je hotová.** R1–R15 platí beze změny; čtyři místa se za běhu odchýlila od doslovného znění
briefů (typované fixtury místo castů, dvě testovací hlídky nahrazené za slabé, zpřísněný regex
a nový `blockPrint.test.ts` proti prohození os) a review opravilo formulaci `NARROWEST:` v R10 na
`NARROWEST ZONE:`. Zbylé body 4–13 z Verifikace vyžadují `npm run dev` a neproběhly. Detaily a
seznam manuálních kontrol jsou v sekci „Stav implementace" specu F6.

## Samostatné položky mimo fáze

| Co | Odkud |
|---|---|
| Chybějící tlačítko Setup u LEAD VOCS — funkční bug, ne vizuál | vyřazeno z F1, F2 i F3 |
| Hlídání neuložených změn při zavření okna (`onCloseRequested`) — vlastní `✕` i nativní ho obchází | vědomá mezera F3 |
| Ukládání velikosti a pozice okna mezi spuštěními | zamítnuto v F3 jako nevzniklá potřeba |
| `npm run build` v `packages/desktop` padá na `tsc` (typové chyby ve 4 testovacích souborech), takže `npm run tauri:build` neprojde | nález při F3 |

## Jak fázi otevřít

Precedens F1 až F3: nejdřív brainstorming a schválený návrh, pak spec do
`docs/superpowers/specs/YYYY-MM-DD-<téma>-design.md` s rozhodnutími `R1..Rn`, teprve potom
implementace. Spec se commituje zvlášť před implementací a po dokončení se do něj doplní
sekce „Stav implementace" s odchylkami, které z implementace vyplynuly.
