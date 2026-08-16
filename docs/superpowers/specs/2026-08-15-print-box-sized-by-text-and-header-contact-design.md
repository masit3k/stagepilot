# Tištěný box podle textu, kapelník v boxu a kontakt v hlavičce

**Fáze:** F7
**Datum:** 2026-08-15
**Předchůdci:** F5b (`2026-08-13-pdf-reads-stageplan-layout-design.md`), F6 (`2026-08-13-editor-flow-block-content-and-ui-language-design.md`)
**Stav:** schváleno k implementaci

## Kontext

Ruční průchod aplikací po dokončení F6 přinesl čtyři pozorování. Tři z nich mají společnou
příčinu, čtvrté je nezávislé.

### Co ukázalo měření

Před psaním specu byl reálný projekt `019f6578…` (FNB, Zámek Bon Repos) vyrenderován
v systémovém Chrome a změřen jeho DOM. Vnitřní šířka tištěného boxu je 119 px, odrážka
s mezerou zabere 7,84 px, takže na text zbývá zhruba 111 px. Text odrážky je
`<span class="text">` s `display: inline-block`, což znamená, že se **nemůže zalomit vedle
odrážky** — jakmile se nevejde, spadne celý na další řádek a odrážka zůstane sama nahoře.
Přesně to vypadá jako „prázdný řádek se samotnou odrážkou".

Model výšky přitom tvrdí, že jedna odrážka je jeden řádek (R13 z F5b: zalamování se
neřeší). Realita:

| box | výška boxu | skutečná výška obsahu |
|---|---|---|
| DRUMS – FILIP | 125 px | 125 px |
| BASS – MATĚJ* | 110 px | **189 px** |
| GUITAR – TOMÁŠ | 83 px | 83 px |
| KEYS – JAKUB | 97 px | **109 px** |
| LEAD VOC – ELIŠKA | 83 px | **96 px** |

**Tři boxy z pěti přetékají.** Není to kosmetická vada jednoho bloku, je to vada modelu:
dokud nikdo nezná skutečnou šířku textu, nemůže být počet řádků pravdivý.

Druhé měření srovnalo zóny s tištěnými boxy ve dvou reálných projektech:

| projekt | zóna | dnešní box |
|---|---|---|
| FNB drums | 36,1 × 33,5 mm | 36,3 × 33,5 mm |
| FNB bass | 34,8 × 18,0 mm | 36,3 × 29,6 mm |
| FNB lead voc | 33,5 × 15,5 mm | 36,3 × 22,6 mm |
| BK guitar | 34,8 × 18,0 mm | 36,3 × 33,2 mm |

**Zóna nikdy nevyhrává.** Ve všech blocích obou projektů, v obou osách, je box větší nebo
stejný. Vzorec `max(zóna, text)` z R1 (F5b) je tedy v praxi vždycky `text` a zóna do
tiskové geometrie přispívá jen tím, že komplikuje měřítko.

### Ostatní zjištění

- Odsazení boxu je nesouměrné: nahoře 6 pt (`boxTitleGap`), dole 2 pt (`table.padY`),
  po stranách 6 pt (`table.padX`). Dolní hodnota pochází z odsazení **řádku tabulky**,
  což je jiná veličina, která do tiskového boxu nepatří.
- Před řádkem napájení není žádná mezera, zatímco mezi skupinami odrážek je mezera
  vysoká plný řádek.
- Kontaktní osoba se sází do patičky každé strany a její znění je
  `Kontaktní osoba – (band leader) Matěj Krečmer, …` — anglická vsuvka uprostřed české
  věty. Přesně tuhle vsuvku F6 vyhodila z hlaviček boxů (R12, R13); kontaktní řádek je
  jediné místo v PDF, kde přežila.

## Cíl

Velikost tištěného bloku určuje jeho text, ne zóna. Box je souměrný, mezery v něm jsou
konzistentní a text z něj nevytéká. Kapelnictví se v dokumentu značí na jednom místě a
česky srozumitelně. Kontaktní osoba je tam, kde ji čtenář hledá — u nadpisu dokumentu.

## Rozsah

**Ve fázi:**

- výpočet šířky textu v doméně a jeho zdroj pravdy,
- tisková stopa boxu odvozená jen z textu, včetně dopadu na měřítko plánu, kolize a editor,
- odsazení boxu, mezera před napájením, zákaz zalamování,
- kapelník jako řádek v boxu místo hvězdičky a vysvětlivky,
- kontaktní osoba jako třetí řádek hlavičky.

**Mimo fázi:**

- obrazovka `02 INPUTS` (F5c) — v této fázi se do roadmapy zapisuje jen směr, viz „Navazuje",
- jakákoli změna obsahu odrážek, tabulek nebo poznámek,
- rozdělení `ProjectSetupPage.tsx`.

## Rozhodnutí

### R1 — Šířku textu určuje vygenerovaná tabulka šířek znaků

Doména je čistá a měřit text neumí; renderer je Chromium a editor je WebView. Aby obě
strany došly k témuž číslu, vzniká v doméně tabulka šířek znaků a nad ní čistá funkce.

```
src/domain/stageplan/print/glyphAdvances.ts   — generovaná data
src/domain/stageplan/print/textWidth.ts       — measurePrintTextMm(text, style, fontSizePt)
```

Tabulka drží šířku znaku jako **zlomek velikosti písma**, takže je na velikosti nezávislá.
Řezy, které box používá, jsou čtyři a každý má vlastní tabulku:

| styl | písmo | použití |
|---|---|---|
| `boxHeader` | Space Grotesk 700 | nadpis boxu |
| `boxRole` | IBM Plex Mono 400 | řádek `BANDLEADER` |
| `boxBody` | Space Grotesk 400 | odrážky |
| `boxPower` | Space Grotesk 600 | řádek napájení |

Tabulku generuje skript v `scripts/`, který znaky **změří v Chromiu** — tedy tím samým
strojem, který PDF tiskne. Nečte font přímo: `SpaceGrotesk-Variable.ttf` je variabilní
font a odečítat z něj instance pro tři různé váhy je zbytečná práce navíc, kterou by
stejně bylo nutné proti Chromiu ověřit.

Znak, který v tabulce není, dostane **nejširší šířku z dané tabulky**. Box tak vyjde
raději o kus širší; opačná chyba by znamenala uříznutý text, tedy ztracené číslo kanálu.

*Alternativa:* měřit za běhu na obou stranách a šířky posílat editoru po IPC. Zamítnuto —
export by se musel přeorganizovat na dvoufázový a asynchronní, a šířky v IPC zastarají,
jakmile se změní lineup bez znovunačtení editoru.

*Alternativa:* odrážky monospace, šířka jako počet znaků krát konstanta. Zamítnuto —
`Electric bass guitar (12)` by při 8 pt vyšlo na zhruba 49 mm místo dnešních 36, tedy
o třetinu širší boxy a výrazně vyšší riziko kolize na plánu.

### R2 — Kerning a ligatury se v tištěném boxu vypínají

`font-kerning: none` a `font-variant-ligatures: none` na `.stageplanBox` i na kartě
v editoru. Bez toho Chromium slepuje dvojice znaků těsněji, než součet jednotlivých šířek
tvrdí, a R1 by byl odhad. S tím je součet **přesné číslo** a dá se testem ověřit.

### R3 — Tisková stopa je dána jen textem *(nahrazuje R1 z F5b)*

```
šířka = 2·pad + max( nadpis,
                     BANDLEADER,
                     max přes odrážky( šířka „•" + mezera + šířka textu ),
                     napájení )

výška = 2·pad + nadpis + [BANDLEADER] + [mezeraPodNadpisem]
                + řádky odrážek + mezery mezi skupinami
                + [mezera + napájení]
```

`mezeraPodNadpisem` zůstává 6 pt jako dnes a stejně jako dnes se počítá **jen když box
nějaké odrážky má**. Mezi nadpisem a řádkem `BANDLEADER` žádná mezera není — jméno a role
patří k sobě.

Zóna do výpočtu nevstupuje v žádné ose. Měření ukázalo, že v reálných datech nikdy
nevyhrávala, takže `max(zóna, text)` jen zakrývalo, že zóna a tištěná karta jsou dvě různé
věci: zóna je místo na pódiu, karta je štítek se seznamem kanálů.

### R4 — Zóna se na papír nekreslí *(upřesňuje R3 z F6)*

PDF má na blok jeden obdélník a je to tištěná karta. Fyzický půdorys nese text odrážky
(`Drum riser 3x2`), ne obdélník.

V editoru se dál kreslí karta i obrys zóny — nově ale obrys **může ležet i vně karty**,
protože karta už nikdy neroste, aby zónu pohltila. Právě to je viditelná zpětná vazba,
kterou F6 chtěla: zvětšení zóny, které tisk nepřevezme, je na první pohled vidět.

Důsledek, který je potřeba vyslovit: **úchyty velikosti nemají po této změně na papír
žádný vliv.** Zóna drží dvě věci — pravdu o kolizích a rezervu v měřítku.

### R5 — Šířka boxu nemá strop *(uzavírá R13 z F5b)*

Box roste s textem. Až přeroste plochu nebo narazí do sousedního boxu, spadne export
s hláškou, která pojmenuje viníka — obě pojistky už existují (`findArtifactCollisions`,
kontrola union bboxu).

Argument, proč strop není potřeba: po F6 je karta v editoru tištěný box, takže přerostlý
blok je vidět **při editaci**, ne až při exportu. Zpětná vazba přichází dřív než chyba.

Zalamování textu se tím definitivně neřeší — ne odloženě, ale proto, že po R3 nemá co
zalamovat.

### R6 — Měřítko rezervuje místo pro každý box zvlášť, v obou osách *(nahrazuje R3 z F5b v části o minimální šířce)*

Minimální šířka boxu zaniká — po R3 je šířka dána textem a žádná podlaha nedává smysl.
`resolvePrintScale` dnes rezervuje místo na jedno číslo, nejužší zónu proti minimální
šířce boxu. Nově je box široký každý jinak a **na měřítku nezávisí**, protože text se sází
v bodech. Stejný uzavřený tvar se proto zobecní na jednotlivé bloky:

```
s ≤ (šířkaPlochy − šířkaBoxu_i) / (šířkaPódia + 2·tolerance − šířkaZóny_i)
```

a bere se minimum přes bloky, u kterých box zónu přerůstá. Iterace ani binární hledání
nejsou potřeba, tvar zůstává uzavřený.

**Táž rezerva musí přibýt ve svislé ose**, kde dnes chybí úplně — výška se počítá jen jako
`plocha / hloubkaSPřesahem`. Je to skrytá díra: vysoký box u horní hrany pódia může
plochu přerůst a rozpočet o tom neví. Dnes nikdo nešlápl jen proto, že šířka váže dřív.

Odhadovaný dopad na FNB: měřítko klesne z 12,89 na zhruba **12,54 mm/m**, tedy plán menší
o necelá 3 %.

### R7 — Odsazení boxu je 6 pt na všech čtyřech stranách

Jedna hodnota místo tří. Box vyroste o 4 pt na výšku, což plán unese — dnes využívá 103
z 198 mm dostupné výšky. Zároveň tím mizí závislost tiskového boxu na `table.padY`, tedy
na odsazení řádku tabulky, se kterým nemá nic společného.

### R8 — Před řádkem napájení je plný řádek

Stejná mezera jako mezi skupinami odrážek. Napájení je vizuálně samostatná informace a
dnes se lepí na poslední odrážku.

### R9 — Kapelník je řádek `BANDLEADER` v boxu *(nahrazuje R12 a R13 z F6)*

Hvězdička v hlavičce boxu a vysvětlivka `* KAPELNÍK` pod plánem zanikají. Místo nich má
kapelník **pod svým jménem řádek se slovem** — 7,2 pt IBM Plex Mono, prostrkané, šedé,
tedy tentýž řez, který měla vysvětlivka a má popisek rozměru pódia. Typografie se stěhuje
dovnitř boxu, nová nevzniká.

Řádek zabírá **jednu řádkovou výšku boxu**, jen menším písmem — rytmus boxu se tím nemění
a stopa ho počítá stejným násobkem jako odrážku. Do šířky se ovšem počítá jeho skutečná
šířka v mono řezu, ne šířka odrážky.

Řádek se počítá do stopy boxu (R3). Když je jméno hudebníka skryté
(`hideMusicianNames` na obrazovce Preview), skryje se i tento řádek — je to vlastnost
osoby, ne pozice.

Rezerva na výšku vysvětlivky pod plánem zaniká celá, včetně důvodu, proč se držela vždy
(aby měřítko nezáviselo na datech). Plán tím získá zpátky zhruba 2,4 mm výšky.

### R10 — `BANDLEADER` je vědomá výjimka z pravidla „PDF česky" *(mění R14 z F6)*

R14 z F6 platí dál: rozhraní anglicky, obsah PDF česky. Slovo `BANDLEADER` je z toho
pravidla **jediná vědomá výjimka**. Je to zavedený termín v hudební praxi a pro
zahraničního zvukaře srozumitelnější než `KAPELNÍK`. Zapsáno explicitně proto, aby to
příští revize „neopravila" zpátky jako překlep.

### R11 — Text se nezalamuje

`white-space: nowrap` na řádku odrážky, `display: inline` na textu, `word-break` pryč.
Po R3 je box na svůj nejdelší řádek stavěný, takže zalomení nemá nastat. Kdyby přesto
nastalo, text vyteče **viditelně** — `overflow: hidden` se nezavádí, ze stejného důvodu
jako v F6: box, který přeteče, to má být vidět, ne potichu ztratit poslední řádek.

### R12 — Kontaktní osoba je třetí řádek hlavičky

Titulní sloupec, pod meta řádkem, tentýž řez jako meta (8,1 pt IBM Plex Mono, prostrkané,
verzálky):

```
KONTAKTNÍ OSOBA · JMÉNO PŘÍJMENÍ · + 420 000 000 000 · jmeno@example.com
```

Verzálky platí pro celý řádek **kromě e-mailu** — ten dostane vlastní span
s `text-transform: none`, protože adresa ve verzálkách je hůř čitelná a v mailu se stejně
píše malými.

Řádek je na obou stranách, protože hlavička je na obou stejná. `docFooter__contact`
zaniká, v patičce zůstane jen číslo strany.

Cena: hlavička vyroste o 4,95 mm na obou stranách, tedy i na straně s tabulkou inputů.
Pojistka proti přetečení A4 to chytí, ale u velkého lineupu to bude těsné — ověřuje se
na reálných datech, viz Verifikace.

*Alternativa:* třetí řádek vpravo pod razítkem, levnější na výšku (2,7 mm). Zamítnuto —
řádek je dlouhý a zarovnaný doprava, takže se u delšího názvu kapely nebo delšího mailu
potká s názvem kapely.

### R13 — Kontaktní řádek neoznačuje kapelníka

Vsuvka `(band leader)` mizí bez náhrady. Kapelnictví značí v dokumentu jediné místo —
řádek v boxu (R9). Dvě souběžné mechaniky pro tutéž informaci jsou přesně to, co F6
odstraňovala.

Věcný důvod navíc: kontaktní osoba **nemusí být hudebník** — `resolveContactMusicianId`
smí vrátit `undefined` — takže označení není vždy použitelné.

`formatContactLine` tím přestává potřebovat `band` i `contactMusicianId` a volání
`isBandLeader` z ní mizí.

### R14 — Rozpočet výšky hlavičky počítá i razítkový sloupec

`pdfChromeHeights.headerMm` dnes počítá `max(značka, titulní sloupec)` a razítkový sloupec
ignoruje. Je to latentní chyba — razítko má dva řádky a titul je vyšší, takže na ni zatím
nikdo nešlápl. Opravuje se na `max(značka, titulní sloupec, razítkový sloupec)` při té
příležitosti, protože R12 do titulního sloupce přidává řádek a rozpočet musí sedět.

### R15 — Tisková mez v editoru zaniká *(mění R10 z F6)*

`isBelowPrintFloor` a zvýrazněná hodnota `PRINTED` v inspektoru zanikají — po R6 žádná
minimální šířka neexistuje, takže není co hlásit. Řádky `ZONE` a `PRINTED` v inspektoru
zůstávají; jen `PRINTED` přestane být příznakem a je to prostý údaj.

### R16 — Dvě nové tiskové smoke kontroly jsou součástí dodávky

Obě dnešní chyby by byly chycené hned, kdyby existovaly:

1. **Šířka z tabulky se rovná šířce naměřené v Chromiu** pro každý řetězec z reálného
   korpusu, v každém ze čtyř řezů, s tolerancí 0,05 px. Tohle drží generovanou tabulku
   poctivou — je to jediná pojistka proti tomu, aby se data z R1 rozešla s realitou.
2. **Žádný box v reálných projektech nepřetéká** — `scrollHeight === clientHeight` pro
   každý `.stageplanBox`. Přesně tahle sonda odhalila, že přetékají tři boxy z pěti.

## Architektura

| Vrstva | Co přibývá nebo se mění |
|---|---|
| `src/domain/stageplan/print/` | `glyphAdvances.ts` (generovaná data), `textWidth.ts`, přepsaný `printFootprint.ts`, zobecněný `printScale.ts` |
| `src/domain/pipeline/pdf/` | `countStageplanBoxLines.ts` — řádek `BANDLEADER`; tiskový model přestane nést hvězdičku a začne nést příznak role |
| `src/infra/pdf/` | `sections/stageplan.ts` (stopa, zánik rezervy na vysvětlivku), `styles.ts` (odsazení, `nowrap`, kerning), `template.ts` (kontakt v hlavičce), `layout.ts` (rozpočet hlavičky) |
| `src/app/usecases/` | `exportPdf.ts` — `formatContactLine` bez kapelníka |
| `scripts/` | generátor tabulky šířek |
| `packages/desktop/` | `blockPrint.ts`, `StageBlock.tsx`, `BlockInspector.tsx`, CSS karty |

Hranice zůstávají: tabulka šířek jsou **data**, ne I/O, takže patří do domény a
`packages/desktop` si na ni smí sáhnout. Generátor je skript, ne součást běhu.

**Dvě volací místa.** Editor a renderer počítají stopu odděleně a nic dnes netvrdí, že
dávají totéž — je to zapsaný follow-up z F6. Tato fáze ho neuzavírá, ale zmenšuje:
po R1 obě strany čtou tytéž šířky ze stejné tabulky, takže se nemají čím rozejít jinde
než v pořadí argumentů. Test proti prohození os (`blockPrint.test.ts`) zůstává.

## Testování

**Jednotkové (doména):**

- `textWidth` — součet šířek, chování u neznámého znaku, pokrytí české abecedy a číslic,
- `printFootprint` — nový vzorec, box bez odrážek, box bez napájení, box s kapelníkem,
- `printScale` — rezerva podle jednotlivých bloků, rezerva ve svislé ose, případ kdy box
  zónu nepřerůstá,
- `countStageplanBoxLines` — řádek kapelníka.

**Smoke (Chromium):** obě kontroly z R16.

**Editor:** `blockPrint.test.ts` doplněný o stopu s řádkem kapelníka.

**Co se ruší:** testy vázané na minimální šířku boxu a na vysvětlivku pod plánem.

## Rizika

| Riziko | Dopad | Co s tím |
|---|---|---|
| Boxy vyrostou (bass odhadem z 29,6 na ~38,6 mm) a plán se zmenší o ~3 % | rozmístění bloků bude nejspíš potřeba srovnat | pojistka pojmenuje viníka; ověřuje se ručně |
| Generovaná tabulka se rozejde s fontem | tiché uříznutí nebo zbytečně široké boxy | smoke kontrola 1 z R16 |
| Hlavička o 4,95 mm vyšší | tabulka inputů se u velkého lineupu nemusí vejít | ověřit na reálných datech, ne odhadem |
| Chromium změní shaping mezi verzemi | tabulka přestane sedět | smoke kontrola 1 selže a řekne to |

## Verifikace

Automaticky:

1. `npm test` — rozdíl proti baseline, ne absolutní čísla (baseline: 2 padající testy).
2. `npm run lint` na dotčených souborech explicitními cestami.
3. `tsc` v kořeni (0 chyb) a v `packages/desktop` (baseline 10 chyb ve 4 testových souborech).
4. Smoke kontroly z R16 na obou reálných projektech.

Ručně (vyžaduje `npm run dev` nebo prohlédnutí PDF):

5. Kontaktní osoba je v hlavičce obou stran a e-mail není ve verzálkách.
6. Tabulka inputů se po zvýšení hlavičky vejde na stranu 1.
7. Žádná odrážka nestojí na řádku sama.
8. Odstup nad nadpisem a pod napájením je na oko stejný.
9. Mezera před napájením je stejná jako mezi skupinami odrážek.
10. Kapelník má pod jménem `BANDLEADER` a pod plánem není žádná vysvětlivka.
11. V editoru odpovídá karta tomu, co je v PDF, a obrys zóny je vidět i když leží vně karty.
12. Inspektor u vybraného bloku ukazuje `ZONE` i `PRINTED` bez zvýraznění.

## Navazuje

**F5c — obrazovka `02 INPUTS`.** Rozhodnutý směr, vlastní spec a vlastní brainstorming:
obrazovka je editor kanálů **i poznámek**. Modály pro editaci inputů se přestěhují
z `ProjectSetupPage.tsx` (2756 řádků) sem, krok `01` zůstane o lidech a presetech.
Poznámky se editují jako **odchylky projektu nad šablonou kapely** — šablona dál určuje,
co se nabídne, projekt si drží jen to, které řádky vypnout a jaké vlastní přidat. Úprava
kvůli jednomu koncertu tak neovlivní ostatní dokumenty té kapely.

Zamítnuto: editovat rovnou šablonu kapely (špatná úroveň pro jednorázovou poznámku) a
zrušit krok `02` (poznámky by zůstaly navždy needitovatelné).

## Stav implementace

**Hotovo** v commitech `16f05ef`…`8d8c9d3` (viz `docs/design/rebranding-roadmap.md`). Rozhodnutí
R1, R2, R4, R5 a R7–R15 platí beze změny. Čtyři rozhodnutí se za běhu odchýlila od doslovného
znění výše — tři review zpřesnilo proti reálným datům a reálnému renderu, čtvrté je oprava
předpokladu, který spec vůbec nepředvídal.

### R3 — vzorec počítal s odsazením, ne s vlastním rámečkem boxu

`* { box-sizing: border-box }` znamená, že zadaná šířka a výška boxu je jeho **vnější** rozměr —
rámeček se z ní ukrajuje stejně jako padding. Vzorec v R3 výše počítal `2·pad`, ale ne
`2·rámeček`, takže obsahu zbylo o 2 px míň místa, než model tvrdil, a v reálném projektu
přeteklo sedm odrážek. Obě osy teď rezervují navíc `2 × borderPx`, čtené ze stejné konstanty
(`containerBorderPx` v `src/infra/pdf/sections/stageplan.ts`), kterou používá i CSS boxu — z
téhož důvodu, proč je v R3 sdílená: dvě jedničky by se dřív nebo později rozešly.

### R16, kontrola 1 — přesná rovnost 0,05 px je z konstrukce nesplnitelná

Spec žádal shodu tabulky s Chromiem do 0,05 px. Chromium ale při sazbě kvantuje šířku každého
glyfu na 1/64 px, kdežto tabulka sčítá nekvantované zlomky — rozdíl s délkou řetězce roste a
přesná rovnost proto není splnitelná, ať je font sebepřesněji změřený. Naměřeno: tabulka vždy
**nadhodnocuje**, o 0,019–0,060 %. Kontrola se místo rovnosti ptá na vlastnost, která dokument
skutečně chrání: podhodnocení (tabulka tvrdí, že je text užší, než ho Chromium vysází) zůstává
tvrdé na 0,05 px, protože přesně tahle chyba uřízne konec čísla kanálu; nadhodnocení smí být až
0,2 % + 0,05 px, protože nanejvýš zbytečně nafoukne box. **Tahle odchylka nebyla zapsaná
nikde** — je to jediné nezdokumentované rozhodnutí celé fáze.

### R6 — odhad poklesu měřítka počítal s Arialem, ne se skutečným písmem

Číslo ~12,54 mm/m v R6 výše vzniklo z dokumentu vysázeného Arialem (viz předpoklad níže) — tedy
z dokumentu, který po opravě chybějícího `file://` původu už neexistuje. Skutečné měřítko se
Space Grotesk vyšlo na **12,7864 mm/m**. Autoritou jsou smoke kontroly a reálné rendery, ne
tenhle dopočet z jiného písma.

### Předpoklad, který spec nepředvídal — renderer nikdy nenačetl vlastní fonty

`page.setContent` nechává dokument na `about:blank`, a Chromium z jiného než `file://` původu
tiše odmítne `@font-face` soubory — takže každé PDF, které aplikace kdy vyexportovala, neslo
Arial, a typografie F4 se na papír nikdy nedostala. Oprava (`setPdfPageContent` v
`src/infra/pdf/pdf.ts`) nechá stránku navigovat na `baseHref` ještě před zápisem obsahu, čímž jí
zůstane souborový původ i po `document.open()`; k tomu přibyla pojistka, která hodí výjimku, když
se brandová rodina fontu nenačte, a test, který čte fonty skutečně vložené do vyrenderovaného
PDF.
