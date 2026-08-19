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
| F5c | Obrazovka `02 INPUTS` | **hotovo v rozsahu — tři body vědomě otevřené, čeká na ruční kontrolu** | [2026-08-17-inputs-screen-design.md](../superpowers/specs/2026-08-17-inputs-screen-design.md) | `71299b7`…`4c38ff5` |
| **F6** | **Tok na editor, obsah bloků, úchyty velikosti, tisk bez zvýraznění, kapelník, angličtina** | **hotovo, čeká na ruční kontrolu** | [2026-08-13-editor-flow-block-content-and-ui-language-design.md](../superpowers/specs/2026-08-13-editor-flow-block-content-and-ui-language-design.md) | `9b27385`…`b1e18f4` |
| **F7** | **Tištěný box podle textu, kapelník v boxu, kontakt v hlavičce** | **hotovo, čeká na ruční kontrolu** | [2026-08-15-print-box-sized-by-text-and-header-contact-design.md](../superpowers/specs/2026-08-15-print-box-sized-by-text-and-header-contact-design.md) | `16f05ef`…`8d8c9d3` |

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

**F5c je hotová v rozsahu, ne beze zbytku** (44 commitů `71299b7`…`4c38ff5`). Obrazovka je
editovatelné zrcadlo strany 1 dokumentu: tabulka kanálů, tabulka monitorů a poznámky pod sebou
v tiskovém pořadí, s přeřazením, přejmenováním a poznámkami jako odchylkami projektu nad
šablonou kapely. Krok `02` je odemčený v procesní stopě, `01 → 02 → 03 → 04` prochází v obou
směrech.

**Tři body zůstaly vědomě otevřené rozhodnutím člověka (2026-08-19) — detaily a zdůvodnění
jsou v sekci „Stav implementace" specu:**

1. **R3/R4/R7 platí jen pro nástrojové kanály** (bass/guitar/keys). U bicích, vokálních
   a talkback kanálů obrazovka `02` vědomě nenabízí vypnutí/vrácení/přidání ani editaci
   monitoringu, protože dokument u těchto řezů čte jen `inputs.update` — doménu tam zúžil fix
   Tasku 12c po dvou Critical vadách. Rozšíření domény (aby dokument četl `add`/`removeKeys`
   i tam) je samostatná budoucí fáze s vlastním specem a PDF regresí.
2. **Monitoring bicích není editovatelný nikde** — na `02` od Tasku 15, na `01` od Tasku 19a
   (mimo plán). Stav je konzistentní a záměrný; bubeník dostane vlastní odchylku až v té
   budoucí fázi z bodu 1.
3. **Setup modál na `01` zůstává — R16 (jeho odstranění) není splněno.** Task 19 se zastavil
   na vlastní bráně: modál nese sekci Inputs (typ zapojení basy/kytary/kláves, typ mikrofonu
   lead vocs), pro kterou `02` nemá domov a jejíž smazání by uživateli sebralo funkci. Není to
   důsledek zúžení z bodu 1 — sekce Inputs není v žádném z Tasků 10–18, je to mezera v plánu.
   Přesun dostane vlastní spec; ten bude muset vyřešit i to, že schéma projektu a katalog
   `+ Add input` na `02` používají pro tytéž kanály různé klíče
   (`el_guitar_mic`/`el_guitar_xlr_mono`/`el_guitar_xlr_stereo`/`ac_guitar` vs. `gtr_mic`/`gtr_di`).

**Mimo plán vznikly čtyři tasky** (12b, 12c, 13b, 19a) — 12b přesunulo tlačítko `Save as musician
default` do panelu (druhá polovina R5; přesun `DrumsPartsEditor` samotného je Task 16), 12c
zúžilo doménu po Critical nálezech, 13b postavilo bránu, kterou 12c vyžádalo, 19a zavřelo
monitoring bicích na `01` stejným vzorem jako Task 15 na `02`.

**Protože Task 19 nikdy neproběhl, `ProjectSetupPage.tsx` nespadl o „zhruba třetinu"** — klesl
jen o 28 řádků (2756 → 2728). Rozdělení souboru na komponenty čeká na fázi z bodu 3.

**Ověřeno (Task 20):** `npm test` 1089 testů, stejná 2 trvale padající jako baseline fáze,
delta 0. `tsc` desktop 10 chyb ve 4 test. souborech, delta 0. `smoke:stageplan-print`: 1 ze 3
reálných projektů staví bez přetečení, 2 zůstávají na stejné kolizní pojistce, kterou
zdokumentovala už F7 — není to vada F5c. **Baseline lintu ~1368 z briefů je zastaralá** — reálná
je ~1543 (agregát je nedeterministický, nepoužívat jako signál); na 72 souborech dotčených fází
(LF-normalizovaně, kvůli `core.autocrlf=true`) je 44 nálezů, z toho 43 zděděných odjinud
(ověřeno proti bázi fáze) a 1 nový kosmetický (`organizeImports` v `ProjectSetupPage.tsx`,
z Tasku 19a). Patnáct bodů ruční verifikace ze specu **neprovedeno** — vyžadují okno Tauri,
stejné omezení jako u F5a, F5b, F6 a F7.

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

## F7 — tištěný box podle textu, kapelník v boxu, kontakt v hlavičce

Tištěný box stage plánu se teď měří podle vlastního textu, ne podle `max(zóna, text)` z F5b:
zóna je místo na pódiu, box je štítek se seznamem kanálů, a měření na reálných datech ukázalo,
že maximum vždycky vyhrával text. Kapelník se v boxu značí řádkem `BANDLEADER` místo hvězdičky
a legendy pod plánem. Kontaktní osoba se přestěhovala z patičky stránky do hlavičky dokumentu.
Měřítko tisku teď rezervuje místo na přesah zvlášť na blok a v obou osách — svislá osa dřív
rezervu neměla vůbec.

**Do fáze se dostaly dva tasky navíc, které spec nepředvídal, a oba váží víc než vlastní rozsah
fáze:**

- PDF renderer nikdy fakticky nenačetl vlastní fonty. `page.setContent` nechává dokument na
  `about:blank` a Chromium z jiného než `file://` původu tiše odmítne `@font-face` soubory, takže
  každé PDF, které aplikace kdy vyexportovala, neslo font **Arial** — typografie F4 se na papír
  nikdy nedostala. Oprava dá stránce souborový původ ještě před zápisem obsahu, přidá pojistku,
  která teď hodí výjimku, když se brand font nenačte, a test, který čte fonty skutečně vložené do
  vyrenderovaného PDF.
- Vzorec stopy boxu nepočítal s vlastním 1px rámečkem. Při `box-sizing: border-box` je zadaná
  šířka šířka vnějšího boxu, takže obsahu zbylo o 2 px míň místa, než vzorec předpokládal, a sedm
  odrážek v reálném projektu přeteklo. Našla to vlastní nová smoke kontrola fáze.

**K čemu jsou smoke kontroly** (`npm run smoke:stageplan-print`): jedna ověřuje, že vygenerovaná
tabulka šířek glyfů pořád souhlasí s tím, co vysází Chromium, druhá, že žádný box v reálném
projektu nepřetéká. Obě vady fáze by kontroly odhalily okamžitě, kdyby v době jejich vzniku
existovaly.

**Caveat k zápisu:** naměřená čísla ve specu (výšky boxů v px, odhadovaný pokles měřítka na
~12,5 mm/m) pocházela z dokumentu vysázeného Arialem, popisují tedy dokument, který už neexistuje.
Skutečné měřítko vyšlo na 12,79 mm/m. Autoritou jsou smoke kontroly a reálné rendery, ne tyhle
odhady.

**Otevřené, na člověku:** oba projekty `blanicka_kapela` teď selžou na kolizní pojistce
(`guitar × lead_voc_1`, `keys × lead_voc_2`, `lead_voc_1 × lead_voc_2`), protože boxy narostly na
svou skutečnou textovou šířku. To je pojistka fungující podle návrhu — bloky je potřeba přerovnat
v editoru, což je úsudek o rozmístění na pódiu, ne oprava kódu.

Space Grotesk se vkládá jako Type3 fonty, protože repozitář nese variabilní řez — text zůstává
prohledatelný (každý font nese mapu `/ToUnicode`), ale soubor narostl asi o 28 %. Statické řezy by
vrátily `CIDFontType2`. Nerozhodnuto.

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
