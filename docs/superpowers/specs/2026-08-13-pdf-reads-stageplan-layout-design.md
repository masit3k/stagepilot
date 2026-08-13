# PDF čte rozmístění stage planu (F5b)

**Datum:** 2026-08-13
**Stav:** schváleno k implementaci
**Fáze:** F5b — druhá ze tří specifikací, na které se F5 dělí (R1 ve specu F5a)
**Staví na:** [F4 — typografie a hlavička PDF](2026-08-12-pdf-typography-and-header-design.md), [F5a — editor a model rozmístění](2026-08-13-stageplan-editor-and-layout-model-design.md)
**Vstup:** `docs/design/brand-handoff-2026-08/README.md` řádek 125 (kresba bloků v PDF) a řádek 161 („generování PDF čte stejný `stagePlan`")

## Kontext

F5a postavila model rozmístění, persistenci i editor. Tisk z toho nečte nic: `src/infra/pdf/sections/stageplan.ts`
má dva pevné layouty (`layout_5_party`, `layout_6_2_vocs`), pozice boxů počítá z řádků a sloupců a výšku
odvozuje z počtu odrážek. Patička editoru proto dnes přiznává `ROZMÍSTĚNÍ SE ZATÍM DO PDF NEPROPISUJE`.
F5b tu větu odstraní tím, že ji udělá pravdivou.

Průzkum před návrhem přinesl čtyři nálezy, které zadání mění:

- **Zóna neunese svůj obsah.** Tiskové zrcadlo je 162,5 mm, nominální pódium 12 m, tedy **13,545 mm na metr**.
  Zóna bicích 2,8 × 1,6 m je na papíře 37,9 × 21,7 mm, ale osm odrážek s hlavičkou a napájením potřebuje při
  8 pt **~40 mm**. Automatické zmenšení písma by u bicích znamenalo ~5 pt, což je na jevišti nečitelné.
- **Výšky je naopak dost.** Strana 2 nese jen stage plan, na plochu zbývá 206,6 mm a plán 12 × 8 m zabere 108 mm.
  Šířka váže dřív než výška, takže ~98 mm zůstává nevyužitých.
- **Editor o obsahu bloků neví.** `DocumentViewModel` vzniká v pipeline, která potřebuje `DataRepository`;
  desktopové okno čte jen `read_project` a PDF mu generuje node proces za Tauri příkazem
  (`build_project_pdf_preview` → `scripts/desktop_preview.ts`). Blok v editoru dnes kreslí jen názvy pozic.
- **Prázdné boxy.** Dnešní renderer tiskne vždy stejnou pětici nebo šestici boxů bez ohledu na obsazení —
  chybí-li klávesák, vytiskne se prázdný box `Keys`.

## Cíl

Tištěný stage plan stojí na `stageplan.layout`: bloky jsou tam, kde je uživatel v editoru nechal, otočené tak,
jak je otočil, a nakreslené podle identity z handoffu. Druhý layout v kódu nezůstane žádný. Editor dopředu
ukazuje, kolik místa blok na papíře opravdu zabere.

## Rozsah

### V rozsahu

- `DocumentViewModel.stageplan.layout` a jeho dopočet v `buildPdfStageplanModel` (v paměti, bez zápisu)
- Doménová tisková geometrie: měřítko, tisková stopa boxu, kolize otočených obdélníků, počet řádků boxu
- Přepis `src/infra/pdf/sections/stageplan.ts` na kresbu z layoutu; smazání obou pevných layoutů
- Nová kresba bloku podle handoffu: 1px ink bez radiusu, inverzní lead vokál, oranžové napájení
- Rám plochy pódia, pruh `DOWNSTAGE · PUBLIKUM`, rozměr pódia nad rámem
- Pojistky: kolize bloků, přetečení zrcadla i dostupné výšky
- Lehký Tauri příkaz `build_stageplan_print_metrics` a tisková stopa bloku v editoru
- Patička editoru dostane handoffovou větu `Změny se propíší do PDF exportu`

### Mimo rozsah

| Vyřazeno | Kam patří |
|---|---|
| Obrazovka `02 INPUTS` a tab `INPUT LIST` v toolbaru | F5c |
| Volné vlastní bloky a mazání bloků | po F5 |
| Změna velikosti zóny úchyty | po F5 |
| Kreslení kanálů, monitorů a napájení do bloků v editoru | po F5; editor kreslí názvy pozic a stopu |
| Zalamování dlouhé odrážky ve výpočtu výšky | vědomá mezera, viz R13 |

### Vědomá mezera

Výška boxu se počítá pravidlem **jedna odrážka = jeden řádek**, stejně jako dnes. Odrážka, která se na šířku
boxu nevejde, se v Chromiu zalomí a box přeteče, aniž by to výpočet věděl. Ošetřením je minimální šířka boxu
opsaná z dnešní prověřené geometrie (R3), ne měření textu. Skutečné měření by znamenalo znát metriky písma
v doméně; to je samostatná práce, ne přívažek k F5b.

## Rozhodnutí

### R1 — Tištěný blok je karta zakotvená na středu zóny, ne půdorys aparátu

Zóna unese asi polovinu textu, který v ní dnes stojí. Ze tří možností — pravdivý půdorys s automaticky
zmenšeným písmem, pravdivý půdorys s detailem v legendě vedle plánu, a mapa pozic, kde obsah vítězí — je
zvolená **mapa pozic**: obsah bloků zůstává beze změny a kresba přiznává, že kreslí pozice, ne stopy aparátu.

Rozměr boxu je `max(zóna, co potřebuje text)` v **obou** osách, vycentrovaný na `centerXM, centerYM`. Střed
zůstává invariantní, takže rotace kolem středu platí dál (R3 ve specu F5a) a diff projektu se růstem boxu nemění.

| Blok | Zóna | Tištěný box při 8 pt |
|---|---|---|
| bicí, 8 odrážek + napájení | 2,8 × 1,6 m | **2,81** × **3,12 m** (36,26 × 40,22 mm) |
| lead vokál, 3 odrážky | 2,6 × 1,2 m | **2,81** × **1,48 m** (36,26 × 19,05 mm) |

Metrový sloupec je box přepočítaný zpátky do metrů pódia **při daném měřítku** — hýbe se s ním,
zatímco milimetrová výška je daná jen textem a s měřítkem se nemění; obě čísla v tabulce platí pro
nominální pódium s lead vokálem v rozmístění (12,8855 mm/m), kde na minimum klesá šířka obou boxů.

Zmenšené písmo padá na čitelnosti, legenda vedle plánu by přesunula obsah, který dnes stojí v bloku a patří
k němu. Mapa pozic je jediná varianta, která nemění ani obsah, ani čitelnost.

### R2 — Měřítko je jedno, izotropní a odvozené z pódia

```
mmPerM = min(areaWidthMm / stage.widthM, areaHeightMm / stage.depthM)

areaWidthMm  = 162,5375  zrcadlo mínus padding a rámeček kontejneru (odvozené už v F4)
areaHeightMm = 202,091   totéž ve výšce, mínus hlavička, patička, margin kontejneru a řádek
                         popisku rozměru pódia — ten se rezervuje vždy, aby měřítko nezáviselo
                         na tom, jestli je rozměr zadaný (R6)
```

Plocha, ze které se měřítko počítá, je zmenšená o **rezervu na přesah**: clamp v editoru nechává
blok přesahovat hranu pódia o 20 cm a tištěný box je navíc širší než úzká zóna, protože nesmí
klesnout pod minimální šířku (R3). Bez rezervy shodí export každý blok postavený k boční hraně —
což je na stage planu běžné umístění. Měřítko proto řeší `resolvePrintScale` v uzavřeném tvaru:
hledá největší `s`, pro které se do plochy vejde pódium i s tolerancí a nejširší možný přerostlý
box. Při nominálních 12 × 8 m s lead vokálem v rozmístění z toho vychází **12,8855 mm/m** místo
13,5448 a plán je o 4,9 % menší. Bez úzké zóny, u které by box narostl na minimální šířku, se
rezervuje jen tolerance a měřítko je 13,1079 mm/m — konkrétní hodnota tedy závisí na tom, jak úzkou
zónu rozmístění obsahuje.

Váže šířka; výšková vazba se zapojí až u pódia, jehož hloubka i s tolerancí přesáhne 1,243násobek
jeho šířky s tolerancí — **ale jen tehdy, když žádná zóna nezapojí větev, která šířku dorůstá na
minimum.** Jakmile ji zapojí, šířkové měřítko klesne pod tuto tolerance-only hodnotu a výšková vazba
se zapne dřív, při nižším poměru hloubky k šířce. Plán se v ploše centruje. Nezadaný rozměr znamená
nominální 12 × 8 m, stejně jako v editoru (R5 ve specu F5a), a nad rámem se pak nic netvrdí.

Obě čísla se **počítají z `pdfLayout`**, neopisují se. Dokud byla `areaWidthMm` napsaná natvrdo, byl kontejner
širší než stránka a Chromium tisklo celý dokument zmenšený na 91,25 % (nález F4).

Neizotropní měřítko — roztažení hloubky do zbývajících ~98 mm — je zamítnuté: otočený obdélník by se v něm
kreslil jako zkosený rovnoběžník a údaj o rotaci by lhal. Rotace je přesně to, co má F5b tisknout.

### R3 — Minimální šířka boxu a jediná velikost písma

Pevné řady zmizí, takže dnešní dvojice „horní řada 9 pt, dolní 8 pt" ztrácí smysl. Všechny boxy dostanou
**8 pt / řádkování 1,25 / odsazení odrážky 4 px**, tedy dnešní hodnoty dolní řady.

Minimální šířka boxu je **36,259 mm** — šířka dnešního čtyřsloupcového boxu, spočítaná ze stejného vzorce
(`(areaWidthMm − 2 × sideInsetXmm − 3 × gutterXmm) / 4`, tedy odsazení 2 mm po stranách a tři mezery po
4,5 mm z dnešní definice `layout_6_2_vocs`). Není to odhad, je to geometrie, o které z dnešního exportu víme,
že se do ní odrážky při 8 pt vejdou. Na nominálním pódiu s rezervou na přesah (R2) je měřítko tak malé, že
pod ni spadají všechny zóny z tabulky (2,6 až 2,8 m) — sedí tedy na 36,26 mm úplně všechny boxy, ne jen
lead vokál. Minimum přestává svazovat až na menším pódiu, kde je měřítko větší a zóna v milimetrech roste
rychleji než tahle podlaha.

### R4 — Osy, rotace a to, že se otáčí i text

`centerXM` se měří od levé hrany plánu doprava, `centerYM` od upstage hrany dolů k publiku — model, canvas
i papír tedy mají stejnou orientaci a dnešní „bicí nahoře" vyjde z výchozího rozmístění samo (R7 ve specu F5a).
Rotace je `transform: rotate()` s originem ve středu boxu a otáčí se **blok včetně textu**, jako v editoru a
jak žádá handoff řádkem 125. Text vodorovný v otočeném rámečku by tvrdil, že pult stojí našikmo, ale popisek ne.

### R5 — Kresba bloku podle handoffu; žlutý badge a šedý kontejner končí

F4 tuhle kresbu vědomě odložila („patří k blokům, F5 ji stejně přepisuje"). F5b ji tedy dokončuje:

| | dnes | po F5b |
|---|---|---|
| rámeček boxu | 2px `--c-line` | 1px `--sp-ink`, bez radiusu |
| lead vokál | jako ostatní | plný `--sp-ink`, bílý text |
| napájení | žlutý badge v rohu | oranžový text `--sp-signal` 600 v toku |
| kontejner | šedý podklad `#eeeeee` | rám plochy pódia, bílý vnitřek |

Napájení v toku textu místo absolutně umístěného rohového badge ruší dnešní vyhrazenou mezeru pod textem a
**zkrátí každý blok s napájením o ~4 mm**. Oranžová zůstává jedinou barvou na stránce, jak žádá handoff.

### R6 — Orientaci nese rám, pruh a rozměr

Dokud byly bicí vždy nahoře, orientace se čekala. Jakmile blok může být kdekoli a otočený, musí ji strana říct:
rám ohraničuje plochu pódia, dole přes celou šířku je mono pruh `DOWNSTAGE · PUBLIKUM` jako v editoru a nad
rámem stojí `PÓDIUM 10,0 × 6,0 m` — **jen když je rozměr zadaný**. Metrová mřížka se nekreslí; byly by to čáry
pod textem bloků za informaci, kterou z papíru nikdo neodměřuje.

### R7 — Které boxy se tisknou, určuje layout

Dnes se tiskne pevná pětice nebo šestice, takže neobsazená role dá prázdný box. Po F5b kreslí PDF bloky
z layoutu a ten vzniká z lineupu přes `resolveStageplanBlockSlots`. Prázdné boxy tím zmizí.

Je to **změna obsahu tisku**, na rozdíl od zbytku F5b, který mění jen kresbu. Přijímá se vědomě: je to přímý
důsledek pravidla „PDF čte stejný `stagePlan`, žádný druhý layout" a prázdný box s názvem nástroje, který v
kapele nikdo nehraje, je stejně dezinformace.

### R8 — Layout se do view modelu dopočítá v paměti a nikdy se neukládá

`DocumentViewModel.stageplan` dostane pole `layout: StageplanLayout` — **povinné**, ne volitelné; tisk vždycky
ví, co kreslí, a nemá druhou větev pro „layout chybí". Plní ho `buildPdfStageplanModel`:

```
project.stageplan?.layout  ─┐
                            ├─► mergeWithLineup(existing, { slots, stage }) ─► vm.stageplan.layout
resolveStageplanBlockSlots ─┘
```

`mergeWithLineup` už umí přesně to, co tisk potřebuje: `undefined` → výchozí rozmístění, chybějící slot →
doplní na výchozí pozici, ruční pozice → nechá být. Druhá cesta pro tisk se nepíše. Zápis se nedělá žádný,
takže export neposune `contentUpdatedAt` (R9 a R13 ve specu F5a).

Konkrétně: `slots` se skládají z `resolveStageplanBlockSlots` nad `args.lineup` (skupiny `drums`, `bass`,
`guitar`, `keys`) a `args.leadOverlayMembers`, které `buildPdfStageplanModel` už dostává. Argument `stage` je
`null`; rozměr pódia si `mergeWithLineup` bere z uloženého layoutu, a když layout není, platí nominální plocha.

### R9 — Tisková geometrie je v doméně, typografie do ní teče parametrem

Nové čisté moduly bez I/O:

| Modul | Co |
|---|---|
| `src/domain/pipeline/pdf/countStageplanBoxLines.ts` | počet řádků boxu — přesun `countRenderedLines` z infra |
| `src/domain/stageplan/print/printScale.ts` | `mmPerM` podle R2 a rozměry plánu v mm |
| `src/domain/stageplan/print/printFootprint.ts` | `max(zóna, text)` v mm podle R1 a R3 |
| `src/domain/stageplan/print/printCollisions.ts` | překryv otočených obdélníků, seznam kolidujících párů |

Typografii (velikost písma, řádkování, odsazení) dostanou funkce **argumentem** z `src/infra/pdf/layout.ts` —
doména tak nedrží žádnou PDF konstantu a hranice z CLAUDE.md zůstává celá. Matematika v infra by znamenala,
že si ji editor nemůže půjčit, aniž by přes něj protekl celý renderer.

### R10 — Kolize se hlídají SAT, ne opsanými obdélníky

Dva bloky otočené o 45° mají opsané obdélníky přeložené, i když se samy nedotýkají — pojistka postavená na
`rotatedHalfExtents` by odmítla legitimní rozmístění. Použije se proto separating axis test nad čtyřmi hranami
obou obdélníků; pro nerotované bloky dává stejný výsledek jako porovnání hran, takže se nic neztrácí.

### R11 — Kontejner se sází z union bboxu a pojistky házejí

Tištěný box smí přerůst rám pódia (zóna smí přesahovat o 20 cm a text ji navíc nafoukne). Kontejner plánu se
proto sází z **union bboxu** rámu a všech boxů, ne z rámu samotného: jinak by přerostlý box rozšířil
`inline-block` kontejner nad tiskové zrcadlo a Chromium by potichu zmenšilo **celý dokument**, což je past,
kterou zavírala F4 (viz `areaWidthMm` v `sections/stageplan.ts`).

Nad tím dvě tvrdé hlášky, které vyhodí výjimku po vzoru dnešního přetečení: kolize bloků (s výpisem slotů) a
union bbox, který nesedí do zrcadla nebo do dostupné výšky. Stávající pojistka v `pdf.ts` (přetečení v obou
osách a počet stran ve výsledném souboru) zůstává.

**Kolizní pojistka rozlišuje, odkud překryv pochází.** `buildStageplanPlan` srovnává dvě sady obdélníků se
stejným středem a otočením: zóny (`block.widthM`/`depthM`, co uložil editor) a tištěné boxy (`max(zóna, text)`
z R1). Pár, který koliduje už jako **zóna**, je stav, který F5a uložila vědomě: `rescaleForStage.ts` při změně
rozměru pódia přepočítá jen středy a rozměry zón nechává být, takže na malém pódiu se zóny mohou překrývat —
to je pravdivá informace o namačkané kapele, ne chyba k odmítnutí, a **tiskne se**. Pár, který koliduje jen
jako **box** — zóny jsou od sebe, ale box narostl nad zónu, aby unesl text — je artefakt, který teprve tahle
fáze zavedla (viz R1), a jen ten pojistka **odmítá** stejnou hláškou jako dřív. Bez tohohle rozlišení by export
selhal na každém pódiu užším než ~10 m i beze změny jediného bloku, protože `rescaleForStage` (F5a) a kolizní
pojistka (F5b) by si jinak odporovaly.

### R12 — Editor dostane tiskovou stopu z nového lehkého příkazu

Aby editor stopu nakreslil, musí znát počet řádků bloku, a ten vzniká až v pipeline. Vzniká proto cesta po
vzoru `desktop_preview.ts`, jen bez Chromia:

```
StagePlanEditorPage ─► stageplanMetrics.ts ─► Tauri build_stageplan_print_metrics
                                               └─► node scripts/stageplan_print_metrics.ts
                                                     └─► { area, typography,
                                                           blocks: [{ slot, lineCount, hasPower }] }
```

Tisková plocha a typografie jdou v odpovědi s sebou, aby okno nemuselo importovat konstanty z infra vrstvy —
hranice z CLAUDE.md tak drží a jediným zdrojem těch čísel zůstává `src/infra/pdf/`.

Vrací se **počty řádků, ne milimetry**: box v mm si editor spočítá stejnou doménovou funkcí jako tisk, takže
změna rozměru pódia v toolbaru překreslí stopu správně bez dalšího volání. Když příkaz selže (chybí node,
projekt se nenačte), stopa se nenakreslí, chyba jde do konzole a editor jede dál — obrys je pomůcka, ne
podmínka editace. Odhad „tak asi tři metry" je zamítnutý: přesně takovou lež F5a odmítla u patičky i u
popisku `ZOOM`.

Stopa je potomek bloku, takže rotuje s ním, a má `pointer-events: none`, aby nebrala gesta.

### R13 — Zalamování textu se v této fázi neřeší

Výška boxu = jedna odrážka jeden řádek, jako dnes. Měřit šířku textu by znamenalo dostat metriky písma do
domény; F5b místo toho drží boxy na prověřené šířce (R3). Riziko je popsané ve „Vědomé mezeře" a v Rizicích.

### R14 — Patička editoru začne mluvit pravdu

`ROZMÍSTĚNÍ SE ZATÍM DO PDF NEPROPISUJE` se mění na handoffovou větu `Změny se propíší do PDF exportu`.
Je to poslední zbytek vědomé mezery F5a a jeho odstranění je součást hotové F5b, ne kosmetika.

## Architektura

```
src/domain/model/types.ts                         DocumentViewModel.stageplan + layout (povinné)
src/domain/pipeline/pdf/buildPdfStageplan.ts      + dopočet layoutu přes mergeWithLineup (R8)
src/domain/pipeline/pdf/countStageplanBoxLines.ts nový — přesun z infra
src/domain/stageplan/print/                       nový — čistá tisková geometrie
  printScale.ts                                   mmPerM, rozměry plánu (R2)
  printFootprint.ts                               max(zóna, text) (R1, R3)
  printCollisions.ts                              SAT nad otočenými obdélníky (R10)

src/infra/pdf/sections/stageplan.ts               přepis: kresba z layoutu; −2 pevné layouty,
                                                  −matchStageplanLayout, −computeTopRowGeometry,
                                                  −computeBottomRowGeometry, −per-řádková typografie
src/infra/pdf/styles.ts                           blok, inverzní lead vokál, oranžové napájení, rám, pruh

scripts/stageplan_print_metrics.ts                nový — počty řádků po vzoru desktop_preview.ts
packages/desktop/src-tauri/src/lib.rs             + build_stageplan_print_metrics
packages/desktop/src/app/services/
  stageplanMetrics.ts                             nový — volání příkazu, degradace při selhání
packages/desktop/src/app/pages/StagePlanEditorPage.tsx  načte metriky, předá do canvasu
packages/desktop/src/app/components/stageplan/
  StageBlock.tsx                                  + tisková stopa jako potomek bloku
  EditorFooter.tsx                                věta podle R14
packages/desktop/src/app/styles/features/stageplan-editor.css  + .stage-block__print-footprint
```

Tok dat pro tisk je jednosměrný: projekt na disku → `normalizeProject` → `mergeWithLineup` v paměti →
`vm.stageplan.layout` → tisková geometrie v doméně → HTML v infra. Editor si tu samou geometrii volá s
počty řádků z metrics příkazu.

## Testování

Vitest v node prostředí:

- `printScale` — vazba šířkou i výškou, práh 1,271, `null` pódium → nominál 12 × 8
- `printFootprint` — růst po řádcích, minimální šířka 36,259 mm, zóna větší než text zůstane zónou,
  centrování na střed při růstu v obou osách
- `printCollisions` — 45° případ, kde by opsané obdélníky lhaly; bloky vedle sebe bez kolize; identické bloky
- **regrese:** výchozí rozmístění pro 5 i 6 bloků nekoliduje a vejde se do zrcadla — existující projekty musí
  po upgradu vytisknout
- `countStageplanBoxLines` — přesunuté testy beze změny chování
- `buildPdfStageplanModel` — layout se dopočítá z `undefined`, uložený se nezmění, chybějící slot se doplní,
  a projekt se nikde nemodifikuje
- `sections/stageplan` — pozice boxu v mm ze středu zóny, rotace v `transform`, inverze lead vokálu, oranžové
  napájení, rám a pruh v HTML, obě hlášky pojistek
- funkce, která z tiskového modelu dělá metriky pro editor — testuje se samostatně, bez spouštění node

Dnešní `src/infra/pdf/sections/stageplan.test.ts` se přepisuje: přibližně polovina jeho tvrzení popisuje
geometrii, která zmizí (`matchStageplanLayout`, `boxWidthMm` 49,664 mm, `gapXmm` 6,772 mm, součet tří boxů a
dvou mezer). Zůstat musí tvrzení o šířce plochy (162,5375 mm) a o tom, že se kontejner vejde do zrcadla — to
je pojistka z F4 a ta platí dál.

Rust příkaz se neověřuje automaticky, stejný precedens má `build_project_pdf_preview`. Editor se ověřuje ručně
přes `npm run dev`, protože projekt běží bez jsdom (CLAUDE.md).

Baseline před implementací: dva trvale padající testy (`assetsPaths`, `repoAssets`) a CRLF hlášky z Biome dané
`core.autocrlf=true` bez `.gitattributes`. Hodnotí se **rozdíl**, ne absolutní čísla.

## Rizika

| Riziko | Ošetření |
|---|---|
| Existující projekt po upgradu nevytiskne kvůli kolizi | regresní test na výchozí rozmístění 5 i 6 bloků; hláška pojmenuje bloky; editor stopu ukazuje dopředu (R12) |
| Dlouhá odrážka se zalomí a box přeteče | dnešní pravidlo zůstává; minimální šířka opsaná z prověřené geometrie (R3, R13) |
| Kontejner přeroste zrcadlo a Chromium zmenší celý dokument | union bbox (R11) plus měření v `pdf.ts` z F4 |
| Metrics příkaz selže | stopa se nenakreslí, export ani editace tím netrpí (R12) |
| Zmizení prázdných boxů zaskočí uživatele | vědomé rozhodnutí R7, uvedené ve Verifikaci jako kontrolní bod |

## Verifikace

1. `npm test && npm run lint` — bez nových chyb proti baseline
2. Export projektu s ručně upraveným rozmístěním: bloky stojí na pozicích z editoru, rotace se tiskne,
   lead vokál je inverzní, napájení oranžové, rám a pruh `DOWNSTAGE · PUBLIKUM` na místě
3. Posun bloku v editoru → uložení → export: blok je na novém místě a `contentUpdatedAt` se **exportem** neposunul
4. Starý projekt bez `stageplan.layout`: vytiskne se výchozí rozmístění a do JSONu se nic nezapsalo
5. Pódium 10 × 6 m: nad rámem stojí `PÓDIUM 10,0 × 6,0 m`, plán drží proporce; bez zadaného rozměru se netvrdí nic
6. Bloky namáčknuté na sebe: export selže a hláška pojmenuje bloky; v editoru byly obrysy stop přeložené už dřív
7. Lineup bez klávesáka: box `Keys` se netiskne (R7)
8. Vizuální kontrola vytištěného PDF — ruční, stejně jako u F4
9. **Pódium 8 × 5 m**: na malém pódiu vyjde `resolvePrintScale` **jinou větví** než na nominálním —
   při 8 m šířky je rezerva na minimální šířku boxu neaktivní (nejužší zóna 2,6 m se do 36,26 mm
   vejde s přehledem), takže měřítko je `areaWidthMm / (8 + 2·tolerance)`. Zkontrolovat, že se plán
   nafoukne do celého zrcadla, popisek `PÓDIUM 8,0 × 5,0 m` sedí a nic nepřeteče. Bod vznikl až
   v závěrečném review, kdy `resolvePrintScale` dostala rezervu na přesah.
10. **Odrážka delší než šířka boxu**: R13 nechává zalamování nevyřešené a `overflow: hidden` se
    v opravě po Findingu 3 vědomě nepřidalo. Vytisknout box s odrážkou, která se do 36,26 mm nevejde,
    a potvrdit, že text **vyčuhuje a je vidět**, ne že se potichu odstřihne poslední řádek. Tohle je
    ta kontrola, která má rozhodnout, jestli R13 smí zůstat mezerou i dál.

## Stav implementace

**Hotovo** v sedmnácti commitech `7ec42a9`…`b6fbf96`. Rozhodnutí R4–R14 platí beze změny; R1, R2
a R3 byly za běhu implementace opravené — ne proto, že by byl cíl specu špatný, ale protože R2 měl
mezeru, kterou odhalil až běžící kód (viz níže). Text výše už nese opravený stav; tahle sekce
popisuje, jak se k němu došlo.

### Co vzniklo

| Vrstva | Soubory |
|---|---|
| Doména — tisková geometrie | `src/domain/stageplan/print/printScale.ts` (+ `resolvePrintScale`), `printFootprint.ts`, `printCollisions.ts`, `printMetrics.ts`; `src/domain/pipeline/pdf/countStageplanBoxLines.ts`, `buildStageplanPrintMetrics.ts`; `buildPdfStageplan.ts` dopočítá `layout` (R8); `DocumentViewModel.stageplan.layout` jako povinné pole |
| Renderer PDF | `src/infra/pdf/sections/stageplan.ts` — přepis: kresba z `vm.layout`, oba pevné layouty i jejich pomocné funkce smazané; `src/infra/pdf/styles.ts` — identita z R5 (1px ink rám, inverzní lead vokál, oranžové napájení, rám pódia, pruh `DOWNSTAGE · PUBLIKUM`), dead `--c-line` odstraněná |
| Skript a Tauri příkaz | `scripts/stageplan_print_metrics.ts` (nový) a `build_stageplan_print_metrics` v `packages/desktop/src-tauri/src/lib.rs`, po vzoru `desktop_preview.ts` / `build_project_pdf_preview` včetně logování na stderr |
| Editor | `stageplanMetrics.ts` (nová služba), `StagePlanEditorPage.tsx`, `StageCanvas.tsx`, `StageBlock.tsx` — tisková stopa jako čárkovaný obrys bloku; `EditorFooter.tsx` nese větu `Změny se propíší do PDF exportu` (R14) |

Testy (`npm test`): **759 → 790 procházejících (+31)**, měřeno proti stavu na konci F5a (o dva
commity starším než báze F5b, oba jen dokumentační). Trvale padající zůstaly dva (`assetsPaths`,
`repoAssets`), beze změny proti baseline — 792 testů celkem místo 761, celý rozdíl je v nových
procházejících. `npx tsc --noEmit` v kořeni: 0 chyb. `npx tsc --noEmit` v `packages/desktop`:
deset chyb ve čtyřech předem existujících testovacích souborech (`BassFieldRendering.test.tsx`,
`buildBassFields.test.ts`, `buildKeysFields.test.ts`, `projectMaintenance.test.ts`) — stejná sada
jako v F5a, touto fází nezměněná. `npx vite build` v `packages/desktop` proběhl (189 modulů).
Rust: `cargo check` i `cargo fmt -- --check` bez nálezu. `npm run lint` na celém repozitáři hlásí
1402 chyb, výhradně kategorie `format` (CRLF, `core.autocrlf=true` bez `.gitattributes`) a
ojedinělé `organizeImports` na řádcích, které tato fáze nezavedla — každý dotčený soubor to
potvrzuje samostatně ve svém tasku; žádné pravidlo `lint/*` touto fází nově neselhává.

### Defekt zjištěný až při ověřování, ne v review

Po Tasku 8 spustil kontrolor postavený kód napřímo a zjistil, že tištěný plán je široký přesně
tolik, kolik je tiskové zrcadlo. Blok postavený k boční hraně pódia — běžné umístění na stage
planu, a takové, které clamp editoru z F5a výslovně povoluje (přesah 20 cm,
`OVERHANG_TOLERANCE_M`) — proto shodí export: `lead_voc_1` na `centerXM = 1,3 m` (lícuje s hranou)
i na `1,1 m` (mez clampu) hodilo `Stageplan layout overflow`. Příčina je v R2, ne v žádné
implementaci — vzorec pro `mmPerM` nepočítal s tím, že legální přesah a minimální šířka boxu (R3)
žádají víc místa, než kolik pódium samo zabírá.

Nález šel k rozhodnutí uživateli, ne k řešení na vlastní pěst implementace. Rozhodnuto rezervovat
místo na přesah přímo v měřítku (varianta A) — vznikl Task 12 (`resolvePrintScale`), zařazený
**před** Task 10, protože editor musí stopu počítat stejnou funkcí jako tisk. Řešení je uzavřený
tvar, ne iterace: hledá největší `s`, pro které se do plochy vejde pódium i s tolerancí a nejširší
možný přerostlý box. Důsledek je posun nominálního měřítka z 13,5448 na 13,1079 mm/m (rozmístění
beze zóny padající pod minimum) nebo 12,8855 mm/m (s lead vokálem, jehož zóna 2,6 m na minimum
dorůstá) — nominální plán je tedy o **přibližně 4,9 %** menší než před opravou.

### Tři nálezy review, které se vracely k chybě v plánu, ne u implementátorů

- **Pinovaná milimetrová hodnota z jiné zóny.** Krok 6 Tasku 12 předepsal posun testu na
  12,8855 mm/m — to je ale hodnota ze scénáře s blokem `lead_voc_1` (zóna 2,6 m) z jiného testu
  ve stejném briefu. Test v `stageplan.test.ts`, který se skutečně opravoval, staví jediný blok
  `drums` (zóna 2,8 m), pro který `resolvePrintScale` dá 13,1079 mm/m. Implementátor hodnotu
  přepočítal ručně proti skutečnému modulu a opravil ji; review to následně potvrdilo jako
  správné.
- **Konvence logování na stderr chyběla u obou cest zadání.** Review Tasku 9 (Important) našlo,
  že brief vynechal stderr logování, které `desktop_preview.ts` a `build_project_pdf_preview` už
  zavádí — ani nový skript, ani nový Rust příkaz nemá jediné hlášení chyby na stderr. Implementátor
  doplnil obě cesty (skript i Rust) podle přesného vzoru precedentní funkce ve fix kole 1.
- **Tabulka ve specu mísila staré a nové měřítko.** Fix kolo 1 Tasku 12 (Important) zjistilo, že
  tabulka v R1 nese metry přepočítané ze starého měřítka (13,5448) vedle milimetrů z nového —
  vlastní instrukce briefu („metrový sloupec zůstává stejný") byla chybná. Implementátor
  přepočítal celou tabulku i R2 a R3 pod jedno měřítko; review to potvrdilo hodnotu po hodnotě.

Ve všech třech případech implementátor chybu odhalil přepočtem ze skutečného modelu, ne
přepisováním briefu podle sebe — review pak výsledek ověřilo, neodhalilo ho jako první.

### Dva testy v plánu měly chybně spočítané očekávané hodnoty

Stejný vzorec jako F5a: implementace je správně, opravily se testy.

- **Box bicích nese vždy pevnou odrážku navíc.** Fixture briefu pro `buildStageplanPrintMetrics`
  (Task 9) čekala `lineCount: 1` pro bicí, ale `buildPdfStageplanPrintModel` k bicím trvale
  připojuje `extraBullets: ["Drum riser 3x2"]` — předchozí, úmyslné chování, kryté i dvěma dalšími
  testy (`countStageplanBoxLines.test.ts`, `stageplan.test.ts`), kterých se tento task nedotkl. Se
  dvěma vstupy sbalenými do jedné odrážky, odrážkou riseru a oddělovačem mezi skupinami vychází
  `countStageplanBoxLines` na 3, ne na 1. Opraven test, ne produkční kód.
- **Pinovaná hodnota měřítka z jiné zóny** (Task 12, popsáno i výše u review nálezů) je zároveň
  případ chybného testu v plánu: 12,8855 mm/m patřilo scénáři s `lead_voc_1`, test v
  `stageplan.test.ts` ale staví blok `drums` — opraveno na 13,1079 mm/m po přepočtu ze skutečného
  modelu.

### Co ověřeno není

Automaticky se ověřilo všechno, co bez jsdom a bez okna Tauri ověřit jde: doménová matematika
testy, kresba a pojistky rendereru testy (včetně `pdf.test.ts`, který vykresluje skutečné PDF přes
systémový Chromium), typová správnost přes `tsc --noEmit` (0 chyb v kořeni; v `packages/desktop`
stejných deset chyb jako v F5a, nezměněno), sestavitelnost přes `vite build` a Rust přes
`cargo check` / `cargo fmt -- --check`.

**Ruční kontrola v `npm run dev` proběhnout nemohla** — editor běží v okně Tauri, ne v headless
procesu, a projekt spouští testy bez jsdom (CLAUDE.md). Body 2 až 7 z Verifikace výše proto
zůstávají **neodbavené**:

2. export s ručně upraveným rozmístěním — pozice, rotace, inverzní lead vokál, oranžové napájení,
   rám a pruh `DOWNSTAGE · PUBLIKUM`
3. posun bloku → uložení → export — nová pozice se vytiskne a `contentUpdatedAt` se exportem
   neposune
4. starý projekt bez `stageplan.layout` — vytiskne se výchozí rozmístění, do JSONu se nic nezapíše
5. pódium 10 × 6 m — popisek nad rámem, zachování proporcí
6. bloky namáčknuté na sebe — export selže s hláškou, která bloky pojmenuje
7. lineup bez klávesáka — box `Keys` se nevytiskne
9. pódium 8 × 5 m — druhá větev `resolvePrintScale`, plán vyplní zrcadlo, nic nepřeteče
10. odrážka delší než šířka boxu — text vyčuhuje a je vidět, nic se neodstřihne

Bod 8 — vizuální kontrola vytištěného PDF — je také ruční a neproběhl.

Body **9 a 10 nikdo neviděl ani jako záměr**: vznikly až v závěrečném review F5b, tedy po sepsání
sekce Verifikace, a do seznamu se dostaly zpětně. Bod 10 je zároveň jediná kontrola, která může
rozhodnout, jestli vědomá mezera R13 smí přežít do dalších fází.

K tomu Task 10 sám hlásí tři věci u editoru, které nešlo ověřit jinak než čtením kódu: že se obrys
stopy skutečně vykresluje na správném místě a rotuje s blokem při tažení, že skutečná odpověď
příkazu `build_stageplan_print_metrics` za běhu odpovídá typu `StageplanPrintGeometry` (ověřeno
jen staticky přes import typu, ne end-to-end IPC round-trip), a vzhled čárkovaného obrysu v obou
tématech.

### Co se předává dál

- R1, R2 a R3 jsou opravené ve specu výše; `resolvePrintScale` je jediné měřítko, které renderer i
  editor používají. `createPrintScale` po závěrečném review **zanikla** — byla exportovaná bez
  jediného produkčního volajícího a její testy přibíjely měřítko bez rezervy (13,5448 mm/m), tedy
  hodnotu, která se nikde netiskne. Konstrukce výsledku je dnes v privátním `buildPrintScale`.
- Nominální plán je po opravě o ~4,9 % menší; budoucí změna izotropního měřítka nebo rozměrů
  zrcadla musí rezervu znovu prověřit (headroom spočítaný v Tasku 8 a 12 už na tom stojí).
- F5c (obrazovka `02 INPUTS`) může začít bez závislosti na F5b — žádné rozhodnutí F5b nemění model
  ani persistenci z F5a.
