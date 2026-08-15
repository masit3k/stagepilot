# Tok, obsah bloků, úchyty a jazyk rozhraní (F6)

**Fáze:** F6
**Vstup:** stav po F5b (`b6fbf96`), handoff `docs/design/brand-handoff-2026-08/`, sekce `3g`
**Předchůdci:** [F5a](2026-08-13-stageplan-editor-and-layout-model-design.md), [F5b](2026-08-13-pdf-reads-stageplan-layout-design.md)
**Mění rozhodnutí:** R5 z F5b (viz R11 níže)

## Kontext

F5a postavila editor rozmístění, F5b naučila PDF číst z něj pozice a rotace. Editor tím technicky
funguje, ale v šesti bodech ještě nedělá to, co po něm uživatel chce.

Dvě věci je potřeba říct hned, protože se liší od toho, jak stav vypadá zvenčí.

**Krok `03 STAGE PLAN` v procesní stopě je už dnes klikatelný.** `processSteps.ts` má u něj
`segment: "stageplan"`, na routě setupu tedy dostane stav `available` a `ProcessTrail` ho vyrenderuje
jako `<button>`. Nefunkční je krok `02 INPUTS` (`segment: null`), a to je práce F5c. Skutečná díra je
jinde: **`Continue` z Lineup Setupu míří na `/preview`**, takže editor v hlavní cestě nikdo nepotká —
najde ho jen ten, kdo si klikne do stopy vpravo nahoře.

**Rezerva na minimální šířku tištěného boxu je aktivní v každém výchozím rozmístění.** `minBoxWidthMm`
je 36,26 mm a mez, pod kterou zóna přestane šířku boxu určovat, leží kolem 2,81 m. Nejužší výchozí
zóna je lead vokál **2,6 m**, takže `resolvePrintScale` už dnes měřítko snižuje z 13,11 na ~12,89 mm/m.
Není to hraniční případ, je to normální stav — a znamená to, že zmenšení jedné zóny přeškáluje celý
tištěný plán. Zmenšení na povolené minimum 0,8 m stlačí měřítko na ~10,89 mm/m, tedy plán o ~15 %
menší, přičemž ten zmenšený box bude na papíře pořád stejně široký.

Čísla v odstavci výše jsou spočítaná ze zdroje ručně. R10 je proto váže testem, ne komentářem.

## Cíl

Editor je přirozený krok po lineupu, kreslí to, co vyleze z tiskárny, a dá zónu zvětšit i zmenšit,
aniž by uživateli slíbil rozměr, který tisk neudělá. Tisk nikoho nezvýhodňuje barvou a kapelníka
označuje hvězdičkou s vysvětlivkou. Rozhraní aplikace mluví anglicky, PDF česky.

## Rozsah

### V rozsahu

1. Cíl `Continue` na Lineup Setupu, akční lišta editoru, zánik tabu `PDF PREVIEW`
2. Plný tiskový obsah v kartě bloku editoru, karta v rozměru tištěné stopy
3. Úchyty pro změnu velikosti zóny s minimem 0,8 × 0,8 m a čísla o tiskové mezi a měřítku
4. Zánik inverzního lead vokálu v PDF
5. Hvězdička u kapelníka v hlavičce boxu a česká vysvětlivka pod plánem
6. Angličtina napříč rozhraním, včetně chybových hlášek, které se uživateli zobrazí

### Mimo rozsah

- Obrazovka `02 INPUTS` — F5c, krok zůstává `unavailable`
- Zalamování odrážek v tištěném boxu — vědomá mezera R13 z F5b platí dál
- Zoom a posun plochy editoru; plocha se dál přizpůsobuje okně
- Ukládání velikosti zóny do knihovny nebo do `Band.defaultOverlays` — zóna je vlastnost projektu
- Nová tlačítka na obrazovce Preview: krok `03` je ve stopě z routy preview klikatelný, pátý knoflík
  v liště by cestu jen zdvojil
- České komentáře ve zdrojácích; nejsou to texty rozhraní

### Vědomá mezera

Cesta přes **Preview** zahazuje hlášku, kterou vrátí `buildStageplanPlan`, a nahrazuje ji generickou
`Preview could not be generated. Please retry.` (`lib.rs`, funkce `build_project_pdf_preview`).
U kolize bloků nebo přetečení plochy tedy Preview neřekne, co má uživatel udělat, zatímco Export to
řekne. Po R1 povede přes editor a Preview každý, takže se to bude potkávat častěji než dnes.
Oprava je práce v Rust mapování chyb a nepatří do žádného ze šesti bodů zadání — zapsáno, neřešeno.

## Rozhodnutí

### R1 — `Continue` z lineupu vede na stage plan a editor dostane akční lištu jako zbytek aplikace

`Continue` na Lineup Setupu míří na `/projects/:id/stageplan` místo `/projects/:id/preview`. Dirty
logika i popisek `Save & Continue` / `Continue` zůstávají.

Patička editoru se srovná se zbytkem aplikace:

| | dnes | po F6 |
|---|---|---|
| vlevo | `Zpět na Lineup` | `Back to Lineup` |
| vlevo | — | `Back to Hub` |
| vpravo | `Generate PDF` | dirty-aware `Save & Continue` / `Continue` → `/preview` |

`Generate PDF` v patičce žádné PDF negeneruje — uloží layout a přejde na Preview. Popisek tedy lže a
nahrazuje ho `Continue` se stejnou dirty logikou jako na setupu. `Back to Hub` mají setup i preview,
editor ne; navigation guard z F5a zachytí neuložené změny u všech tří cest stejně.

Parametr `?from=` se na novou cestu nepřidává. Obrazovka Preview ho nečte — používá jen celý `search`
k rekonstrukci vlastní routy — takže by to byl mrtvý parametr.

### R2 — Tab `PDF PREVIEW` v toolbaru editoru zaniká

Dělá totéž co primary v patičce, jen bez uložení. Dvě cesty na stejné místo s jinou semantikou jsou
past: jedna uloží mlčky, druhá se spolehne na guard a zeptá se. Zůstávají taby `STAGE PLAN` (aktivní)
a `INPUT LIST` (neaktivní do F5c), jak je má prototyp `3g`. Prop `onOpenPreview` zaniká s tabem.

### R3 — Karta bloku je tištěný box, zóna je obrys uvnitř

Karta se kreslí v rozměru **tištěné stopy** (`computePrintFootprintMm`, převedeno na metry
`printScale.toM`), hranatě a bez radiusu, protože takový je tištěný box podle R5 z F5b. Zóna se kreslí
jako čárkovaný obrys uvnitř karty a je to cíl úchytů. Tažení bere celou kartu — v platném rozmístění
se karty nepřekrývají, takže tam není co rozřešit.

Uvnitř karty stojí plný tiskový výpis v pořadí, ve kterém ho sází `renderBox`:

```
hlavička
(mezera)
kanálové odrážky
(mezera)
monitorové odrážky
(mezera)
extra odrážky
napájení — oranžově
```

Tištěná stopa je `max(zóna, text)` v obou osách (R1 z F5b), takže plný výpis se do karty vejde vždy;
proto je karta tou plochou, do které se sází, a ne zóna. Karta i text rotují s blokem, jako na papíře.

Vedlejší efekt, který dělá polovinu práce R10: zmenšíš zónu pod tiskovou mez a karta se nezmění, jen
se v ní zmenší vnitřní obrys. Kresba tím sama říká, že tisk to zmenšení nepřevezme.

Seznam bloků v inspektoru si nechává `LABEL_BY_SLOT` — je to volič, ne náhled.

### R4 — Příkaz metrik vrací celý tiskový box; odvozená čísla se přestanou přenášet

`build_stageplan_print_metrics` dnes vrací `lineCount` a `hasPower`. Po F6 vrací pro každý slot
**celý `StageplanPrintBox`**, jak ho sestaví `buildPdfStageplanPrintModel`, a editor si počet řádků
dopočítá `countStageplanBoxLines` — tou samou doménovou funkcí, jakou používá renderer.

Odvozené číslo přenášené po IPC je právě to místo, kde se obsah editoru a tisku může rozejít: dá se
změnit počítání řádků v rendereru a zapomenout na skript. Po F6 se přenáší jen vstup a počítá se na
obou stranách stejnou funkcí, takže není co rozejít.

`StageplanPrintBox` žije v `src/domain/pipeline/pdf/`, tedy v doméně — `packages/desktop` z ní smí
importovat, z `src/infra` ne. Typ `StageplanPrintBlockMetric` se `lineCount` a `hasPower` zaniká.

Jedna odchylka tím nezmizí: `hideMusicianNames` je stav obrazovky Preview (`useState`, výchozí
`false`, neukládá se), ne vlastnost projektu. Editor tedy staví model bez něj a jména ukazuje vždy.
Rozdíl proti tisku se může týkat **pouze jména v hlavičce** a je to volba, kterou uživatel dělá na
jiné obrazovce a vidí ji tam zaškrtnutou.

### R5 — Velikost písma v kartě: `min(11 px, tisková proporce)` s podlahou 7 px

```
pxNaTiskovýMm = scale.toPx(1) / printScale.mmPerM     // px obrazovky na 1 mm papíru
proporcePx    = fontSizePt × (25,4/72) × pxNaTiskovýMm
fontPx        = min(11, proporcePx)
```

`scale.toPx(1)` je px obrazovky na metr pódia, `printScale.mmPerM` mm papíru na metr pódia; jejich
podíl je tedy px obrazovky na milimetr papíru. `fontSizePt` je tisková velikost z
`printGeometry.typography`, ne konstanta v editoru.

Na velkém okně vyjde tisková proporce nad 11 px, použije se tedy čitelných 11 px a výpis se do karty
vejde s rezervou. Na malém okně proporce klesne pod 11 px a písmo jde s ní, takže výpis z karty
nevypadne. Pod **7 px** se odrážky schovají a zůstane jen hlavička: nečitelný text je horší než žádný.

Pevná velikost je uživatelova volba proti proporcionální miniatuře. Cena je, že přetečení textu na
obrazovce **neříká nic** o přetečení na papíře — a to je v pořádku, protože R13 z F5b nechává
zalamování nevyřešené i v tisku.

### R6 — Kresba bez metrik padá na dnešní stav

Když `build_stageplan_print_metrics` neodpoví nebo pro slot chybí záznam, karta se nakreslí v rozměru
zóny a ukáže jen `LABEL_BY_SLOT`, tedy dnešní kresbu. Editace nesmí stát na metrikách; to je precedens
R12 z F5b — stopa je pomůcka, ne podmínka.

### R7 — `resizeBlockTo`: snap → podlaha → clamp

Nová doménová operace v `blockOps.ts` se stejnou skladbou jako `moveBlockTo`:

1. snap na `SNAP_STEP_M` (0,1 m), je-li snap zapnutý
2. podlaha `MIN_ZONE_M = 0,8` na `widthM` i `depthM`
3. `clampToArea` — zvětšená zóna se musí vrátit na plochu, stejně jako po rotaci

Podlaha 0,8 m je nejmenší rozumná lidská zóna (stojan s mikrofonem), ne tisková mez. Tisková mez do
domény nepatří: `minBoxWidthMm` je PDF konstanta a doména o nich nesmí vědět.

### R8 — Osm úchytů na obrysu zóny; táhne se hrana, protilehlá stojí

Čtyři rohy a čtyři strany, jen na vybraném bloku, na obrysu zóny — ne na hraně karty, protože karta
není to, co se mění. Tažením se pohne tažená hrana a **protilehlá zůstane stát**, takže se mění i
střed zóny; to je chování, které uživatel od úchytů čeká.

U otočeného bloku se posun kurzoru nejdřív promítne do lokálních osí zóny, tam se změní rozměr a
dopočítá posun středu, a ten se otočí zpátky do souřadnic plochy. Bez té projekce by úchyt na
otočeném bloku táhl podél osy plochy a hrana by ujížděla do strany.

Obrys zóny leží uvnitř karty a tažení bere celou kartu (R3), takže `pointerdown` na úchytu musí
`stopPropagation` — jinak by úchyt zároveň rozjel posun. Stejně to dnes dělá knoflík rotace.

Snapshot pro undo se bere na začátku gesta přes `onGestureStart`, stejně jako u tažení a rotace.

### R9 — Podlaha 0,8 m není invariant modelu

`normalizeStageplanLayout` se nemění a dál bere jakoukoli kladnou `widthM` a `depthM`. Podlaha je
omezení gesta, ne vlastnost dat: ručně editovaný JSON se musí dát otevřít (to je smysl normalizace)
a tisk zvládne jakoukoli šířku, protože `computePrintFootprintMm` vezme `max(zóna, minBoxWidthMm)`.

Ověřeno, že zvětšená zóna přežije: `rescaleForStage` vědomě mění jen pozice, ne rozměry zón, takže
přepsání rozměru pódia zvětšenou zónu nepřepíše.

### R10 — Editor pojmenuje tiskovou mez a měřítko čísly z tiskového modelu

Kresba z R3 ukazuje, že se zmenšení neprojeví; tahle rozhodnutí to říká i číslem.

**Inspektor**, u vybraného bloku dva řádky:

```
ZONE      2.8 × 1.6 m
PRINTED   2.81 × 2.93 m
```

Když je zóna užší než tisková mez, `PRINTED` se označí — na papíře je box širší než zóna, kterou
uživatel nakreslil.

**Toolbar**, měřítko a blok, který ho jmenuje:

```
SCALE 12.9 mm/m · NARROWEST ZONE: LEAD VOC 1
```

Bez druhé poloviny je první polovina k ničemu: měřítko se změní, uživatel nepozná proč. Měřítko je
`min(šířková vazba, výšková vazba)` z `resolvePrintScale` — nejužší zóna je ta, kterou popisek
jmenuje, ne nutně ta, která měřítko svázala; na hlubokém pódiu může svázat výška, a pak neurčuje
měřítko žádná konkrétní zóna.

> **Opraveno při implementaci.** Text výše dřív tvrdil, že nejužší zóna měřítko vždy určuje; review
> to vyvrátilo testem `"binds on height for a deep stage"`, kde vyhraje výšková vazba. Mechanismus
> a nález viz sekce „Stav implementace" níže.

Obě čísla pocházejí z `printGeometry` a `resolvePrintScale`, tedy z toho, co počítá renderer.
Tisková mez v metrech se dopočítá v `packages/desktop` z `printGeometry.typography.minBoxWidthMm`;
doména o PDF konstantách dál nic neví.

### R11 — V tisku nemá žádný blok zvýraznění *(mění R5 z F5b)*

`.stageplanBox--lead` ve `styles.ts`, `isLeadVocal` v `StageplanBoxPlan` a `leadClass` v `renderBox`
zanikají. Všechny bloky mají bílý podklad a `1px solid --sp-ink`.

Je to **vědomá odchylka od handoffu, řádek 125** („LEAD VOC blok plný `--sp-ink` s bílým textem")
a oprava R5 z F5b, který ji zapsal. Handoff sám se neupravuje — je to vstupní artefakt fáze, ne
živý dokument. Řádek v tabulce R5 ve specu F5b se opraví a doplní se odkaz sem.

Inverze dělá z lead vokálu nejvýraznější prvek stránky. Na plánu, kde jsou všechny bloky rovnocenné
pozice na pódiu, to je hierarchie, kterou tam nikdo nechtěl — a oranžové napájení má být podle
handoffu jediná barva na stránce.

Testy v `styles.test.ts` a `sections/stageplan.test.ts`, které dnes inverzi **vyžadují**, se přepíšou
na opačné tvrzení: žádný box nemá `background: #101112` ani `color: #fff` a v HTML není třída
`stageplanBox--lead`.

### R12 — Kapelník hvězdičkou v hlavičce boxu

`formatStageplanBoxHeader` vymění suffix `" (band leader)"` za `"*"` bez mezery:

```
DRUMS – PAVEL*
```

Hvězdička je značka poznámky pod čarou a ta se ke slovu tiskne bez mezery. Text `(band leader)` zabíral
v hlavičce víc místa než celé jméno a v boxu, který má 36,26 mm, to je znatelné. Přidává se i tehdy,
když je `hideMusicianNames` zapnuté — `DRUMS*` je pořád pravdivá informace.

### R13 — Vysvětlivka pod plánem; výška se rezervuje vždy, text podmíněně

Pod kontejnerem plánu — **mimo jeho rám**, zrcadlově k popisku pódia nad ním — stojí `* KAPELNÍK`
ve stejném stylu: mono 8 pt, tracking 0,14em, `--sp-steel`, oddělený stejnou mezerou jako popisek
(`legendGapPt` po vzoru `captionGapPt`). Česky, protože PDF je česky.

**Výška vysvětlivky se odečítá od `areaHeightMm` vždy, i když v lineupu žádný kapelník není.** Jinak
by měřítko plánu záviselo na tom, jestli je někdo označený jako kapelník — přesně důvod, proč R6 z F5b
rezervuje řádek popisku pódia i u projektu bez zadaného rozměru. Text se vykreslí jen tehdy, když
hvězdička v plánu skutečně je.

Zda hvězdička v plánu je, se **nezjišťuje hledáním `*` v hlavičce**. `StageplanPrintBox` dostane pole
`hasBandLeaderMark` z `roleData.isBandLeader` a vysvětlivka se rozhodne podle `plan.boxes` — tedy podle
bloků, které se opravdu tisknou. Kapelník, jehož blok v layoutu není, vysvětlivku nevyvolá.

Rezerva stojí ~3,6 mm výšky. Měřítko je dnes vázané šířkou (~12,9 mm/m proti ~25 mm/m, které by
dovolila výška), takže by se na papíře projevit neměla — **to je tvrzení pro test, ne pro odhad**
(viz Testování).

### R14 — Rozhraní anglicky, PDF česky

Všechny texty rozhraní jdou anglicky. Soustředěné jsou v editoru, který vznikl v F5a a F5b:

| dnes | po F6 |
|---|---|
| `Zpět na Lineup` | `Back to Lineup` |
| `Změny se propíší do PDF exportu` | `Changes are written to the PDF export` |
| `Načítám…` | `Loading…` |
| `Projekt se nepodařilo načíst.` | `Project could not be loaded.` |
| `Projekt nemá obsazený lineup, takže na pódiu není co rozmístit.` | `This project has no lineup, so there is nothing to arrange on stage.` |
| `Otevřít Lineup Setup` | `Open Lineup Setup` |
| `Rozmístění uloženo.` | `Arrangement saved.` |
| `VYBRANÝ BLOK` | `SELECTED BLOCK` |
| `ROTACE` | `ROTATION` |
| `ROZMĚR` | `ZONE` *(řádek `PRINTED` přidává R10)* |
| `BLOKY NA PÓDIU` | `BLOCKS ON STAGE` |
| `Reset rozmístění` | `Reset arrangement` |
| `PÓDIUM` *(toolbar)* | `STAGE` |
| `m · NEZADÁNO` | `m · NOT SET` |
| `Otočit blok`, `Otočit o 15 stupňů vlevo/vpravo` | `Rotate block`, `Rotate 15° left/right` |
| `Šířka pódia v metrech`, `Hloubka pódia v metrech` | `Stage width in metres`, `Stage depth in metres` |
| `DOWNSTAGE · PUBLIKUM` *(plocha editoru)* | `DOWNSTAGE · AUDIENCE` |

V PDF zůstává česky **všechno**: pruh `DOWNSTAGE · PUBLIKUM`, popisek `PÓDIUM 10,0 × 6,0 m` i nová
vysvětlivka `* KAPELNÍK`. Pruh se tedy mezi editorem a papírem rozejde záměrně — v editoru je to
orientační značka rozhraní, na papíře je to obsah dokumentu pro českého zvukaře.

Mimo editor se v `packages/desktop` české texty rozhraní nenašly; české řetězce jsou tam už jen
v komentářích, v testovacích datech a ve jméně autora v `AboutModal`.

### R15 — Chybové hlášky, které uživatel uvidí, jdou anglicky

`buildStageplanPlan` vyhazuje dvě české hlášky — kolize bloků a přetečení plochy. **Nejsou to jen
logy:** `ExportResultModal` renderuje `state.technical`, který `mapExportError` plní z `message`,
a tu Rust u exportu propouští z odpovědi skriptu (`export_pdf` na rozdíl od
`build_project_pdf_preview` hlášku nepřepisuje). Při exportu se tedy zobrazí uživateli.

Obě jdou anglicky a nechávají si to, co je na nich cenné — jmenují vinné bloky a říkají, co udělat:

```
Stageplan print collision: drums × bass. Blocks overlap on paper — rearrange them in the editor.
Stageplan layout overflow: required … exceeds available …. Block drums extends past the area —
move it closer to the centre of the stage in the editor.
```

## Architektura

Vrstvy se nemění. Co kde vzniká:

| Vrstva | Změna |
|---|---|
| `src/domain/stageplan/layout/blockOps.ts` | `resizeBlockTo`, `MIN_ZONE_M` (R7) |
| `src/domain/formatters/stageplan.ts` | hvězdička místo `(band leader)` (R12) |
| `src/domain/pipeline/pdf/buildPdfStageplanPrintModel.ts` | `hasBandLeaderMark` na boxu (R13) |
| `src/domain/stageplan/print/printMetrics.ts` | `StageplanPrintGeometry.blocks` nese boxy, `StageplanPrintBlockMetric` zaniká (R4) |
| `src/infra/pdf/sections/stageplan.ts` | rozpočet výšky s vysvětlivkou, `legend` v plánu, zánik `isLeadVocal`, anglické hlášky (R11, R13, R15) |
| `src/infra/pdf/styles.ts` | zánik `.stageplanBox--lead`, přírůstek `.stageplanLegend` (R11, R13) |
| `scripts/stageplan_print_metrics.ts` | vrací boxy z `buildPdfStageplanPrintModel` (R4) |
| `packages/desktop/.../components/stageplan/` | karta jako tištěný box, plný výpis, úchyty, čísla, angličtina (R3, R5, R8, R10, R14) |
| `packages/desktop/.../pages/ProjectSetupPage.tsx` | cíl `Continue` (R1) |
| `packages/desktop/.../pages/StagePlanEditorPage.tsx` | akční lišta, dirty-aware primary (R1) |

Dvě věci, které při tom mají zůstat malé. `StagePlanEditorPage` má dnes 311 řádků a přibývá jí stav
úchytů — geometrie gesta patří do `useBlockDrag`, ne do stránky. A výpočet velikosti písma z R5 je
čistá funkce nad dvěma čísly, takže patří vedle `blockContent.ts` s vlastním testem, ne dovnitř
komponenty.

`buildStageplanPrintMetrics` v `src/domain/pipeline/pdf/` se po R4 zredukuje na výběr boxů pro slots
z layoutu. Pokud po redukci nezbude nic než `map`, zanikne a skript si boxy vybere sám — mrtvá
nepřímost je horší než o funkci méně.

## Testování

Doména a rendererem generované HTML a CSS jdou testy; kresba v okně Tauri ne (projekt běží bez jsdom).

**Nové jednotkové testy:**

- `resizeBlockTo`: snap, podlaha 0,8 m v obou osách, clamp po zvětšení, chování u otočené zóny,
  zaokrouhlení (R7, R8)
- velikost písma karty: nad 11 px se zastropuje, pod 7 px se odrážky schovají (R5)
- `formatStageplanBoxHeader`: hvězdička bez mezery, hvězdička i při `hideMusicianNames` (R12)
- `hasBandLeaderMark` na boxu a `legend` v plánu: kapelník mimo layout vysvětlivku nevyvolá (R13)
- rozpočet výšky: rezervovaná výška vysvětlivky odpovídá tomu, co sází renderer — stejný test jako
  dnešní „pins the caption's height budget" (R13)

**Testy, které se přepisují:**

- `styles.test.ts` a `sections/stageplan.test.ts`: inverze lead vokálu se z požadavku mění na zákaz (R11)
- `printMetrics` / `stageplan_print_metrics` kontrakt: boxy místo `lineCount` a `hasPower` (R4)

**Test, který drží čísla z Kontextu** (R10, R13): jeden test připíchne `minBoxWidthMm`, měřítko
výchozího rozmístění na nominálním pódiu a to, že **měřítko je vázané šířkou, ne výškou**. Bez toho
posledního tvrzení je věta „rezerva na vysvětlivku se na papíře neprojeví" nepodložená a rezerva z R13
by mohla plán potichu zmenšit.

## Rizika

| Riziko | Co s tím |
|---|---|
| Karta v rozměru tištěné stopy zabere na ploše víc místa a plocha zhoustne | V platném rozmístění se karty nepřekrývají — `findArtifactCollisions` shodí export právě u páru, který koliduje jako box, ale ne jako zóna. Hustší plocha je informace, ne regrese. |
| Úchyt na otočeném bloku bez projekce do lokálních osí | Vlastní testovací případ v `resizeBlockTo` a v testu gesta (R8) |
| Rezerva na vysvětlivku potichu zmenší plán | Test „měřítko je vázané šířkou" (Testování) |
| `Continue` na stageplan vede přes obrazovku, kterou uživatel u generického projektu bez lineupu nepotřebuje | Prázdný stav editoru už existuje a nabízí `Open Lineup Setup`; primary v patičce vede dál na Preview |
| Přepis testů u R11 zamaskuje regresi | Nové tvrzení je zákaz (`not.toContain`), ne absence tvrzení |

## Verifikace

**Automaticky:**

1. `npm test && npm run lint` — bez nových chyb proti baseline (2 padající testy `assetsPaths`
   a `repoAssets`, ~1400 CRLF lint chyb, 10 typových chyb ve 4 testovacích souborech
   `packages/desktop`); lintovat jen dotčené soubory
2. `tsc --noEmit` v kořeni: 0 chyb; v `packages/desktop` nezhoršeno proti baseline
3. `cargo check` a `cargo fmt -- --check`, pokud se `lib.rs` dotkne

**Ručně v `npm run dev`** (okno Tauri, jinak to nejde — před spuštěním zkontrolovat port 1420):

4. `Continue` na Lineup Setupu otevře editor, ne Preview; `Save & Continue` uloží
5. Patička editoru: `Back to Lineup`, `Back to Hub`, dirty-aware primary na Preview; guard se ptá
   u všech tří
6. Karta bloku ukazuje plný tiskový výpis a její rozměr odpovídá čárkovanému obrysu z F5b
7. Zmenšení okna: písmo klesá s proporcí, pod 7 px zůstane jen hlavička
8. Úchyty: rohy i strany, minimum 0,8 × 0,8 m, protilehlá hrana stojí, u otočeného bloku hrana
   neujíždí, undo vrací celé gesto
9. Zmenšení zóny pod ~2,8 m: karta se nezmění, obrys v ní se zmenší, `PRINTED` se označí,
   `SCALE` a `NARROWEST` se přepočítají
10. Export: žádný blok není inverzní, kapelník má hvězdičku, pod plánem stojí `* KAPELNÍK`
11. Lineup bez kapelníka: vysvětlivka se netiskne a plán má **stejné měřítko** jako s ní
12. Rozhraní: v editoru ani jinde v aplikaci není český text; pruh na ploše říká `AUDIENCE`,
    v PDF `PUBLIKUM`
13. Kolize bloků při **exportu**: hláška je anglicky a jmenuje bloky

## Stav implementace

**Hotovo** ve dvaceti commitech `9b27385`…`b1e18f4`. Rozhodnutí R1–R15 platí beze změny — na rozdíl
od F5b tahle fáze nenarazila na chybu v návrhu, která by vyžadovala přepsat text výše. Odchylky od
plánu se odehrály jen v tom, *jak* se rozhodnutí ověřila: čtyři z nich prosadil lidský rozhodčí proti
doslovnému znění briefů, protože brief buď porušoval vlastní pravidlo repozitáře, nebo nechal defekt
neohlídaný.

### Co vzniklo

| Vrstva | Soubory |
|---|---|
| Doména | `src/domain/formatters/stageplan.ts` (hvězdička místo `(band leader)`, R12); `src/domain/pipeline/pdf/buildPdfStageplanPrintModel.ts` (+`hasBandLeaderMark`, R13); `src/domain/stageplan/layout/blockOps.ts` (+`resizeBlockTo`, `MIN_ZONE_M`, R7); `src/domain/stageplan/print/printMetrics.ts` (`StageplanPrintGeometry.blocks` nese celé boxy místo `lineCount`/`hasPower`, R4) |
| Renderer PDF | `src/infra/pdf/sections/stageplan.ts` — zánik `isLeadVocal` (R11), legenda `* KAPELNÍK` s bezpodmínečnou rezervou výšky (R13), anglické hlášky kolize a přetečení (R15); `src/infra/pdf/styles.ts` — zánik `.stageplanBox--lead`, přírůstek `.stageplanLegend` |
| Skript | `scripts/stageplan_print_metrics.ts` — vrací celé boxy místo odvozených čísel (R4). `src/domain/pipeline/pdf/buildStageplanPrintMetrics.ts` **zanikl úplně** — po redukci na jediný `map` nezbylo nic k obalení, přesně jak Architektura ve specu výše předpokládala; skript si teď boxy pro slots vybírá sám |
| Editor | `blockFont.ts` (nový, R5), `blockPrint.ts` (nový, R3/R4, jediné místo, které v editoru počítá tiskovou stopu karty); `StageBlock.tsx` (karta jako tištěný box, plný výpis, R3), `StageCanvas.tsx` (měřítko zvednuté do stránky), `useBlockDrag.ts` (+resize gesto, R7/R8), `blockContent.ts` (formátování v tečkách, `formatScale`, `narrowestZoneSlot`, R10/R14), `BlockInspector.tsx` (`ZONE`/`PRINTED`, R10), `EditorToolbar.tsx` (`SCALE`/`NARROWEST ZONE`, zánik tabu `PDF PREVIEW`, R2/R10), `EditorFooter.tsx` (nová akční lišta, angličtina, R1/R14), `StagePlanEditorPage.tsx`, `ProjectSetupPage.tsx` (cíl `Continue`, R1) |

**Automaticky ověřeno** (`npm test`): 819 z 821 testů prochází — stejné dva trvale padající
(`assetsPaths`, `repoAssets`) jako baseline, nic navíc. `npx tsc --noEmit` v kořeni: 0 chyb. V
`packages/desktop`: 10 chyb ve stejných čtyřech předem existujících testovacích souborech jako
v F5a/F5b, nezměněno. `npx vite build`: 192 modulů bez chyby. `cargo check`: bez nálezu — `lib.rs` se
v tomto plánu nemění, jde jen o pojistku. `npm run lint`: 1389 chyb, výhradně kategorie CRLF/format
daná `core.autocrlf=true` bez `.gitattributes`, žádné nové pravidlo.

### Čtyři odchylky od doslovného znění plánu

1. **Fixtury bez `as unknown as`.** Brief Tasků 3 a 5 předepsal fixtury s type cast. Oba dotčené
   soubory už měly vlastní typované pomocníky (`baseStageplan`, `emptyStageplan`) a repo pravidlo
   zakazuje cast bez odůvodnění — žádné tu nebylo. Rozhodnuto použít existující pomocníky; typují se
   beze zbytku, cast nebyl potřeba ani jednou. (Fix kolo 2 Tasku 3 pak muselo vrátit import
   `DocumentViewModel`, který fix kolo 1 omylem smazalo — vitest transpiluje bez typové kontroly, takže
   to nezachytil; `tsc --noEmit` ano.)
2. **Test „geometrie identická" nemohl selhat na defektu, který měl hlídat.** Rezerva na vysvětlivku
   z Tasku 5 je u testovací fixtury vázaná šířkou, ne výškou, takže odebrání rezervy by
   `stage.widthMm` ani `heightMm` vůbec nepohnulo — test by prošel, i kdyby R13 přestala platit. Místo
   přijetí slabého testu se přidaly tři skutečné hlídky: rozpočet výšky ověřený **odvozenou** hodnotou
   z modulových konstant (ne golden konstantou), tvrzení, že `<div class="stageplanLegend">` zůstává
   v toku i prázdný, a případ, kdy kapelníkův slot není mezi vytištěnými bloky. Mutační test (dočasné
   odebrání rezervy, dočasná „optimalizace" prázdného elementu) potvrdil, že každá hlídka na svém
   defektu skutečně spadne.
3. **Regex na přetečení hlídal jen slovesnou příponu.** `[\s\S]*` v Tasku 6 spolklo celé jméno bloku
   a `.*` spolklo zájmeno — z trojice tvarů (jméno viníka, tvar podstatného jména, zájmeno), které měl
   brief chránit, hlídal doopravdy jen jeden. Zpřísněno na doslovné sepnutí jména, tvaru a zájmena;
   mutace zájmena (`it` → `them`) v produkčním kódu tím teď test spolehlivě odhalí.
4. **`blockPrint.test.ts` — soubor, který struktura plánu neuváděla.** `resolveBlockPrint` v Tasku 9
   mapuje `footprint.widthMm`/`heightMm` na `widthM`/`depthM` karty; prohození os by nakreslilo každou
   kartu otočenou o 90° a **žádná** existující brána (typy, 347 tehdejších testů, `tsc`) by to
   nechytila. Fixtura musela být záměrně nečtvercová (šířka a hloubka měřitelně různé), aby prohození
   bylo vůbec detekovatelné. Vznikl `blockPrint.test.ts` (5 testů) a mutační běh (prohozené osy)
   potvrdil, že test na defektu skutečně spadne.

### Další review nálezy, které opravily plán, ne implementaci

- **`NARROWEST:` v R10 tvrdilo víc, než platí vždy.** Poznámka v toolbaru říkala, že nejužší zóna vždy
  určuje měřítko, ale `resolvePrintScale` bere `min(šířka, výška)` a existující test dokazuje, že
  výška může vyhrát — pak nic „nejužšího" neurčuje. Přeformulováno na `NARROWEST ZONE:`, což tvrdí jen
  to, co platí vždy; logika `narrowestZoneSlot`/`resolvePrintScale` se neměnila. **Příklad v R10 výše
  (`SCALE 12.9 mm/m · NARROWEST: LEAD VOC 1`) zůstal s původním textem** — oprava proběhla jen v kódu,
  ne v tomto specu, protože brief Tasku 11 úpravu spec souboru nezahrnoval.
- **`EditorFooter.tsx` zůstal česky přesně tam, kde to Task 12 mělo zakázat.** Řádek `Zpět na Lineup`
  review Tasku 12 přehlédl. Nešlo o konflikt s plánem — diacritics sweep z Kroku 2 je akceptační brána
  celého úkolu a řetězec do ní spadal. Opraveno bez čekání na rozhodnutí.

### Co ověřeno není

Editor běží v okně Tauri a projekt testuje bez jsdom (CLAUDE.md), takže body 4–13 z Verifikace výše
zůstávají **ruční kontrola v `npm run dev`**, dosud neproběhlá. Review napříč tasky k nim přidalo
konkrétní věci, na které se má dívat:

- **Karty se mohou překrývat** (body 6, 9) — karta je teď tištěná stopa, ne zóna, takže je větší a nic
  ji neřadí podle z-indexu ani výběru; zvětšená karta může sousedovi ukrást `pointerdown` (Task 9).
- **Zdvojená hrana ve stavu bez metrik** (R6) — když `build_stageplan_print_metrics` neodpoví, obrys
  zóny padne přesně na hranu karty, takže se kreslí dvě hrany na sobě (Task 9).
- **Poznámka a rozměr pódia v toolbaru se mohou zalomit pod sebe** (bod 9) — `.stage-toolbar__meta`
  nemá `display: flex`, takže `SCALE`/`NARROWEST ZONE` a řádek s rozměrem pódia nemusí sedět vedle
  sebe, jak návrh předpokládá (Task 11).
- **Cit gesta úchytů** (bod 8) — že protilehlá hrana skutečně stojí, že se otočený blok zvětšuje podél
  vlastních os a ne os plochy, a že je úchyt na zaslané velikosti canvasu pohodlně klikatelný (Task 10).
- **Délka anglického textu v patičce** (body 5, 12) — `Changes are written to the PDF export` má
  38 znaků proti 32 v češtině; zkontrolovat, že se nepřekrývá s tlačítky patičky, a stejným pohledem
  prázdný stav a dva eyebrow popisky v panelu pevné šířky (Task 12).

### Co se předává dál

- **Gesto zvětšování zóny nemá test na kumulativní posun.** `useBlockDrag.ts` počítá deltu tažení přes
  celé gesto stejně jako u posunu a rotace, ale ani jedno z těch dvou nemá test — chybí `jsdom`
  a `@testing-library/react`, které `packages/desktop` nemá a které CLAUDE.md vylučuje výslovně
  („Vitest, Node prostředí, bez jsdom"). Zavedení DOM test infrastruktury kvůli jednomu ze tří
  sourozeneckých gest je větší rozhodnutí než rozsah F6. Lidské rozhodnutí (informované): zapsat sem
  jako společný follow-up pro všechna tři gesta najednou, neřešit teď.
- **Neuložený stav bez zpětné vazby — předchází F6.** `StagePlanEditorPage.tsx:344–351` nechá selhané
  uložení propadnout jako neodchycené odmítnutí slibu, bez `notify("error")`; stejná mezera je
  v `ProjectSetupPage.tsx:1779–1788`. Uživatel tak může odejít v přesvědčení, že se rozmístění uložilo,
  i když se neuložilo. F6 to nezavedla, oprava patří jinam.
- **Editor a Preview nemají žádný test.** Pro `ProjectSetupPage.tsx`, `StagePlanEditorPage.tsx`,
  `EditorFooter.tsx` ani `EditorToolbar.tsx` neexistuje testovací soubor — stejný kořen jako
  u neotestovaného gesta výše: `packages/desktop` nemá DOM test infrastrukturu.
- **`(band leader)` v kontaktní řádce PDF exportu zůstává anglicky uvnitř českého textu.**
  `src/app/usecases/exportPdf.ts:86` je jiná funkce než hlavička boxu, kterou opravil R12, a F6 ji
  nepokrývala. Kandidát na navazující práci, ne chyba F6.
- **Editor počítá měřítko z živé plochy, tisk z uložené.** `StageCanvas` volá `resolvePrintScale`
  s aktuálním prop `area`, zatímco renderer čte `vm.layout.stage` z disku — dokud se rozměr pódia
  neuloží, mohou se `mmPerM` a zobrazená stopa lišit od tisku. Pravděpodobně záměr (editor ukazuje, co
  se právě edituje), ale nepotvrzeno; kandidát na potvrzení při některé z dalších fází.
- **`snapM` v `blockOps.ts` zůstal `export`**, ačkoli ho žádný modul mimo `blockOps.ts` nepotřebuje.
  Neškodné rozšíření rozhraní, nerozhodnuto, jestli se má vrátit zpět na privátní.
- **Vědomá mezera ze sekce Rozsah trvá.** Cesta přes Preview dál zahazuje hlášku
  `buildStageplanPlan` a nahrazuje ji obecnou `Preview could not be generated. Please retry.`
  (`lib.rs`, `build_project_pdf_preview`) — zapsáno vědomě v Rozsahu výše, F6 to neřešila.
