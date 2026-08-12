# Typografie a hlavička PDF (F4)

**Datum:** 2026-08-12
**Stav:** schváleno k implementaci
**Fáze:** F4 z pětifázového rebrandingu
**Staví na:** [F0 + F1 — identita a token foundation](2026-08-12-brand-identity-and-token-foundation-design.md), [F2 — komponenty a interakce](2026-08-12-components-and-interaction-design.md), [F3 — shell a informační architektura](2026-08-12-shell-and-information-architecture-design.md)
**Vstup:** `docs/design/brand-handoff-2026-08/`, sekce `4` v README a mock `2c` v boardu; `FNB_Inputlist_Stageplan_22-08-2026_Zamek-Bon-Repos.pdf` jako současný stav exportu

## Kontext

Aplikace nese novou identitu od F1, ale dokument, který z ní leze ven, ne. Export drží stav před rebrandingem a nese čtyři konkrétní problémy:

- **Dokument nemá značku.** Hlavička je vycentrovaný název kapely 26 pt, pod ním česká věta `Datum akce a místo konání: 22. 8. 2026, Zámek Bon Repos (datum aktualizace: 12. 8. 2026)` a kontaktní řádek. Nikde není poznat, čím to vzniklo ani kdy.
- **Strana 2 nemá hlavičku vůbec.** Když se list se stage planem oddělí od input listu, není z něj poznat, které kapely a které akce se týká.
- **Typografie je z jiného světa.** Celý dokument běží na Interu, který není součástí identity. Tabulka je uzavřená ve 2pt rámečku s 0,5pt mřížkou kolem každé buňky — vizuálně nejtěžší prvek na stránce, přitom nese nejméně informace.
- **Kontakt a číslo strany chybí tam, kde je technik hledá.** Kontakt sedí v hlavičce, číslování stran neexistuje.

Doména navíc hlavičku vrací jako jednu slepenou větu (`MetaLineModel`), takže datum a místo z ní nejde rozebrat zpátky na části, které nový návrh potřebuje vedle sebe.

**Nález, který mění zadání fáze.** Roadmapa označuje za hlavní riziko F4 to, že renderer úmyslně shodí export při přetečení A4. Ta pojistka nefunguje. `pdf.ts` porovnává `#content.bottom` proti `#page.bottom`, jenže `#content` je přímý potomek `#page` a `.pdfPage` nemá v CSS žádnou výšku — rodič končí přesně tam, kde končí poslední dítě, rozdíl je vždy zhruba nula a tolerance je 2 px. Druhá díra: DOM kontrola měří stránku v šířce okna prohlížeče, ne v šířce tiskového zrcadla, takže sloupec `note` se při měření zalamuje jinak než na papíře. Kdyby se obsah po změně typografie nevešel, export by nespadl — jen by tiše vylezla třetí strana.

## Cíl

Obě strany exportu nesou hlavičku se značkou, kapelou, druhem strany a datem aktualizace, a patičku s kontaktem a číslem strany. Dokument běží na písmech z identity. Tabulka drží pohromadě linkami místo rámečků. A renderer opravdu pozná, když se obsah na dvě A4 nevejde.

## Rozsah

### V rozsahu

- Hlavička podle mocku `2c` na obou stranách, včetně změny doménového modelu, kterou si vyžádá
- Patička s kontaktem a číslem strany na obou stranách
- Space Grotesk a IBM Plex Mono místo Interu
- Tabulka bez rámečků, mono čísla kanálů
- Oprava pojistky proti přetečení A4 a druhá vrstva kontroly nad hotovým PDF

### Mimo rozsah

| Vyřazeno | Kam patří |
|---|---|
| Bloky stage planu v nové podobě (1 px ink, bez rádiusu, plný LEAD VOC) | F5 — editor je stejně přepisuje |
| Oranžové napájení místo žlutého badge | F5, patří k blokům |
| Rotace bloků v PDF | F5, data pro ni zatím nevznikají |
| Odsazení řádků tabulky podle mocku | nevejde se na A4, viz R8 |
| Chybějící tlačítko Setup u LEAD VOCS | funkční bug, samostatná položka roadmapy |
| Anglické popisky přepínače odposlechu | samostatná oprava, viz dodatek |

### Vědomá mezera

Strana 2 si po dobu F4 nechá dnešní vzhled bloků: 2px černý rámeček, šedý podklad kontejneru a žlutý badge napájení. Dokument tedy bude mít modernizovanou hlavičku, patičku a stranu 1, ale stage plan zůstane ve staré kresbě. Dokončit ho zvlášť v F4 by znamenalo udělat stejnou práci dvakrát, protože F5 tu kresbu přepisuje kvůli rotaci a pozicím z editoru.

## Rozhodnutí

### R1 — Měřítko: 1 px mocku = 0,9 pt, ukotvené na dnešní tabulku

Mock `2c` udává velikosti v px, ale ta „stránka" v boardu je široká 496 px, zatímco A4 má při 96 dpi 794 px. Je to zmenšený náhled, ne předloha 1:1, takže px z něj nejde vzít doslova ani doslova přeškálovat:

| výklad | řádek tabulky | důsledek |
|---|---|---|
| doslova px (0,75 pt/px) | 7,5 pt | −17 % výšky tabulky, ale 6pt kontakt v patičce je na papíře v šeru nečitelný |
| přeškálovat na A4 (1,2 pt/px) | 12,0 pt | +33 % výšky tabulky — na A4 se to nevejde |
| **ukotvit na dnešek (0,9 pt/px)** | **9,0 pt** | hustota dokumentu se nemění |

Faktor 0,9 vychází z toho, že řádek tabulky v mocku (10 px) se má rovnat dnešním osvědčeným 9 pt. Tabulka je nosný prvek — je to ta část, která přetéká — takže se od ní odvozuje zbytek, ne naopak. Pořadí velikostí z návrhu tím zůstává zachované přesně.

Výsledná škála:

| prvek | mock | PDF | prostrkání |
|---|---|---|---|
| logo kapely / znak | 26 px | 23,4 pt | — |
| název kapely | 19 px / 600 | 17,1 pt / 600 | −0,025em |
| mono řádek hlavičky | 9 px | 8,1 pt | 0,04em |
| záznam `STAGEPILOT / UPD` | 9 px | 8,1 pt | 0,04em |
| hlavička tabulky | 8 px | 7,2 pt | 0,14em |
| řádek tabulky | 10 px | 9,0 pt | — |
| patička | 8 px | 7,2 pt | 0,04em |

Poznámky pod tabulkami mock nekreslí. Zůstávají na 9 pt, tedy odvozené od velikosti řádku tabulky, jak je tomu dnes.

**Šířky linek se neškálují.** Linka pod hlavičkou zůstává 2 pt (`--w-frame`, který v `styles.ts` už je) a jemné linky 0,5 pt (`--w-grid`). Vlasová linka není typografie a při přepočtu 1 px × 0,9 by vyšla hodnota, kterou tiskárna stejně zaokrouhlí.

### R2 — Hlavička je strukturovaná data z domény, ne hotová věta

`MetaLineModel` se ruší a nahrazuje ho:

```ts
export interface DocumentHeaderModel {
  /** event: ["22. 8. 2026", "Zámek Bon Repos"] · general: ["Univerzální stage plan 2026"] */
  readonly contextParts: readonly string[];
  /** "12. 8. 2026" */
  readonly updatedDate: string;
}
```

`vm.meta.metaLine` se přejmenuje na `vm.meta.header`, `formatProjectMetaLine` na `formatDocumentHeader`. České popisky `Datum akce a místo konání:` a `datum aktualizace:` z domény mizí.

Ruší se tím i varianta `split`, která je mrtvá — `formatProjectMetaLine` ji nikdy nevrací a říká to i komentář v jejím vlastním testu (`src/domain/formatters/meta.test.ts:5`).

Změna je bezpečná: `metaLine` čte jenom PDF renderer a jeho testy, desktop UI se ho nedotýká.

### R3 — Druh strany a `UPD` skládá renderer

Doména vrací části, renderer je spojuje. Druh strany se totiž liší stránku od stránky (`INPUT LIST` na první, `STAGE PLAN` na druhé) a doména nemá vědět, kolik má dokument stran ani co je na které.

```
INPUT LIST · 22. 8. 2026 · ZÁMEK BON REPOS
STAGE PLAN · 22. 8. 2026 · ZÁMEK BON REPOS
```

Oddělovač je ` · `, verzálky dělá CSS (`text-transform: uppercase`), ne doména — v datech zůstávají názvy tak, jak je uživatel zadal.

### R4 — Projekt typu general nese poznámku a rok

U `general` projektů žádné datum akce ani místo neexistuje. `contextParts` proto nese jednu položku složenou z poznámky projektu a roku platnosti — tedy přesně to, co dnes stojí v jeho metaLine:

```
INPUT LIST · UNIVERZÁLNÍ STAGE PLAN 2026
```

Poznámka projektu je jinde v dokumentu nedostupná, takže její vypuštění by ubralo informaci. Prázdné části se z pole vynechávají, aby nevznikaly osamocené oddělovače: projekt bez poznámky i bez roku dá `INPUT LIST` a nic víc.

### R5 — Logo kapely má přednost, znak XLR je záskok

Vlevo v hlavičce se vykreslí logo kapely, když je `band.logoFile` vyplněné, jinak znak XLR. Obojí ve výšce 23,4 pt, šířka auto, `max-width: 40mm` — aby hlavička neměnila výšku podle toho, jestli logo existuje, a aby široké logo neroztlačilo text.

Značka StagePilotu z dokumentu nemizí ani s logem: nese ji slovní záznam `STAGEPILOT` vpravo.

Znak se kreslí jako **inline SVG přímo v šabloně**, ne jako soubor. Geometrie je v handoff README a je to pět elementů. Odpadá tím závislost na `baseHref` a jedna cesta k selhání (chybějící soubor). Logo kapely zůstává `<img>` z `file://`, jak je dnes.

### R6 — Patička nese kontakt a číslo strany odvozené z pořadí

Kontakt (`opts.contactLine`) se stěhuje z hlavičky do patičky, verzálkami přes CSS, barva `--sp-steel`. Vpravo `1 / 2` a `2 / 2`.

Číslo strany se **nezadrátuje**. Šablona bude stránky skládat ze seznamu a tisknout `pořadí / počet`, takže kdyby stran někdy přibylo, patička nebude lhát. Chybějící kontakt patičku neruší — číslo strany se tiskne vždy.

### R7 — Barvy PDF jsou hodnoty v TS, hlídané testem proti `primitives.css`

`src/infra/pdf/` je Node vrstva a nemůže importovat CSS z `packages/desktop`. Pět barev, které dokument potřebuje, se proto v `layout.ts` zopakuje jako hodnoty v TS a přibude test, který je porovná s hexy vyparsovanými z `primitives.css`. Precedens na parsování CSS v testu už v repu je (`semantic.contrast.test.ts`).

| role | hodnota | kde |
|---|---|---|
| `--sp-ink` | `#101112` | název kapely, linka pod hlavičkou, název inputu |
| `--sp-body` | `#55585c` | mono řádek hlavičky, sloupec note, poznámky |
| `--sp-steel` | `#6b6d71` | záznam `STAGEPILOT / UPD`, hlavička tabulky, čísla kanálů, patička |
| `--sp-line` | `#e4e1da` | linka pod hlavičkou tabulky, linka nad patičkou |
| `--sp-line-faint` | `#f0ede7` | linky mezi řádky tabulky |

**Odchylka od mocku:** mock používá na mono texty `#8A8D92`. F1 tuhle hodnotu kvůli kontrastu ztmavil na `--sp-steel` `#6b6d71` a původní nechal jako `--sp-steel-decor` (rozhodnutí F1 R1). Na papíře v šeru dává původní hodnota 2,98:1, což je u 7,2pt textu málo, takže dokument bere ztmavenou variantu — stejnou úvahou, z jaké vznikla.

Konstanta `--c-line` v `styles.ts` se přesměruje z `#000` na `--sp-ink`. Bloky stage planu ji dál používají a je to změna bez vlivu na layout, která zbaví dokument dvou různých černých.

### R8 — Tabulka ztrácí rámečky, ne hustotu

Ruší se `.tableBlock` s 2pt rámečkem a 0,5pt mřížka kolem každé buňky. Zůstávají jen vodorovné linky:

| sloupec | dnes | nově |
|---|---|---|
| `no.` | 9 pt, bold, černá, orámovaná buňka | mono 9 pt, `--sp-steel` |
| `input` | 9 pt, běžná váha | 9 pt / 500, `--sp-ink` |
| `note` | 9 pt, černá | 9 pt, `--sp-body` |
| hlavička | 9 pt bold + spodní linka 2 pt | mono 7,2 pt / 0,14em / uppercase + linka 0,5 pt `--sp-line` |
| mezi řádky | mřížka kolem každé buňky | spodní linka 0,5 pt `--sp-line-faint`, poslední řádek bez ní |

**Odsazení buněk zůstává 2 pt / 6 pt.** Mock má v řádcích `padding: 7px 0`, což je po přepočtu 6,3 pt nahoře i dole. Při zhruba 26 řádcích to dělá +224 pt ≈ 79 mm navíc a na A4 to nemá šanci. Vzdušnost z mocku je vlastnost náhledu s osmi řádky, ne reálného input listu s dvaceti inputy, monitory a poznámkami.

**Šířky sloupců zůstávají** (`42 pt` / `145 pt`). Jsou dané obsahem — `no.` musí unést slepené stereo páry typu `13+14` — a mock je kreslený na užší stránku, takže jeho `32px / 130px / 1fr` neodpovídá skutečnému zrcadlu.

### R9 — Kurzíva mizí, Inter odchází z projektu

Poznámky pod tabulkami jsou dnes kurzívou přes `Inter-Italic.ttf`. Space Grotesk je v projektu jeden variabilní soubor s vahami 300–700 a kurzívu nemá; v design systému F1 se kurzíva nikde nepoužívá. Poznámky proto půjdou stejným řezem jako zbytek dokumentu a odliší se barvou `--sp-body`, stejně jako sloupec `note`.

Do `src/infra/pdf/fonts/` se zkopírují `SpaceGrotesk-Variable.ttf`, `IBMPlexMono-Regular.ttf` a `IBMPlexMono-Medium.ttf` z `packages/desktop/public/fonts/`. Celá složka `fonts/Inter/` se smaže — po této změně ji nic nečte.

Syntetický sklon (`font-style: italic` nad Space Groteskem) je zamítnutý: Chromium písmo naklopí sám, tvary se rozbijí a v tisku je to vidět.

### R10 — Nadpis `Stageplan` na straně 2 se ruší

Hlavička nově říká `STAGE PLAN · 22. 8. 2026 · ZÁMEK BON REPOS`, takže samostatný nadpis nad plánem by tutéž informaci uvedl podruhé. Zmizí s ním i vazba `headingSize = title.size − 6` v `sections/stageplan.ts:49`, která by jinak nadpis potichu zmenšila spolu s názvem kapely.

Velikost textu v blocích zůstává 9 pt, tedy odvozená od `typography.table.size`, která se nemění — geometrie stage planu se tím nehne.

### R11 — Pojistka A4 dostane pevné zrcadlo a druhou vrstvu nad hotovým PDF

Zrcadlo se odvodí z marginů, ne opíše:

```ts
// layout.ts
page.contentWidthMm  = 210 − 15 − 15 = 180
page.contentHeightMm = 297 − 20 − 15 = 262
```

```css
.pdfPage { width: 180mm; height: 262mm; display: flex; flex-direction: column; }
#content { flex: 1 1 auto; min-height: 0; }
```

Pevná **šířka** srovná obrazovku s tiskem — bez ní měří DOM kontrola jiný zlom řádků, než jaký skončí na papíře. Pevná **výška** dá kontrole co měřit. Samotný test se změní z porovnávání `bottom` rodiče a dítěte na `content.scrollHeight > content.clientHeight`. To je přímé měření přetečení a nejde ho splnit omylem.

Druhá vrstva: po zápisu souboru se spočítají výskyty `/Type /Page` ve výsledném PDF a jiný počet než dva je chyba. Chytí to i případ, kdy Chromium zalomí jinak, než jak vypadá layout na obrazovce. Funkce `countPdfPages` už v repu je, jen sedí v `pdf.test.ts:11` — přesune se do produkčního kódu a test ji bude sdílet.

## Bilance výšky

Odhad z hodnot v R1, ne měření. Ověří se až renderem.

| | strana 1 | strana 2 |
|---|---|---|
| menší hlavička | −6,5 mm | — |
| nová hlavička (dnes strana 2 žádnou nemá) | — | +21,8 mm |
| patička | +8,2 mm | +8,2 mm |
| zrušené rámečky tabulek | −2,8 mm | — |
| zrušený nadpis `Stageplan` | — | −12,7 mm |
| **celkem** | **−1,1 mm** | **+17,3 mm** |

Strana 1 vychází zhruba nastejno. **Strana 2 se o 17 mm utáhne** a je to hlavní riziko implementace. Když se plán nevejde, první páky jsou `containerPad` a `containerMarginTop` v `sections/stageplan.ts` (obojí 24 pt).

## Testování

| Co | Jak |
|---|---|
| Odvození zrcadla z marginů | jednotkově nad `layout.ts` — změna marginu musí změnit zrcadlo |
| `formatDocumentHeader` | event, general, chybějící datum, chybějící místo, chybějící poznámka |
| Struktura hlavičky a patičky | nad HTML řetězcem z `renderInputlistHtml`: hlavička na obou stranách, prefix `INPUT LIST` / `STAGE PLAN`, záznam `UPD`, `1 / 2` a `2 / 2`, kontakt v patičce a ne v hlavičce |
| Tabulka | nulový výskyt `tableBlock` v HTML, mono třída na sloupci `no.` |
| Barvy | pět hexů v `layout.ts` proti `primitives.css` |
| Fonty | `styles.ts` nesmí odkazovat na Inter; složka `fonts/Inter/` neexistuje |
| Dvě strany a vejití se | `pdf.test.ts` — vyžaduje Chromium, viz Rizika |
| Vizuálně | `npm run pdf:dev` na reálném projektu, obě strany |

## Rizika

| Riziko | Mitigace |
|---|---|
| Strana 2 se po přidání hlavičky a patičky nevejde | bilance výšky výše dává −12,7 mm zrušeným nadpisem; když nestačí, snížit `containerPad` a `containerMarginTop` |
| Skutečné vejití se nejde ověřit v tomto prostředí | `pdf.test.ts` se dnes na Windows vždy přeskočí (`hasChromiumDeps` hledá linuxové `.so`) a Chromium pro Puppeteer nainstalované není; podmínka se opraví, ale **ověření dvěma stranami je na uživateli** — jedno spuštění `npm run pdf:dev` po implementaci |
| Variabilní Space Grotesk se v Chromiu nenačte přes `truetype-variations` | ověřit hned prvním renderem; záskok je statický řez, ne návrat k Interu |
| Zrušení `MetaLineModel` sáhne do domény i testů | `metaLine` čte jen PDF renderer; grep na `metaLine` a `MetaLineModel` po dokončení musí být prázdný |
| Odvozené hodnoty v `sections/stageplan.ts` se hnou spolu s typografií | `typography.table.size` zůstává 9 pt, takže geometrie stage planu se nemění; hlídat, aby nová hlavička nezaváděla další odvozeniny |
| Pevná šířka `.pdfPage` změní tisk | 180 mm je přesně obsahová šířka A4 s dnešními marginy — na tisku se nesmí projevit; ověřit vizuálně |

## Verifikace

- `npm test` — bez nových selhání proti baseline (2 trvale padající v `src/infra/fs/`)
- `npx biome check` na dotčených cestách — bez nových chyb proti baseline CRLF hlášek
- `npm run pdf:dev` doběhne a vygeneruje dvoustránkové PDF
- Vizuální kontrola obou stran proti mocku `2c`
- Žádný odkaz na Inter, `metaLine` ani `tableBlock` nezůstal v kódu

---

## Dodatek — samostatná oprava mimo F4

Není součástí fáze, jde do vlastního commitu.

Přepínač dodavatele odposlechu v Setup dialogu (`packages/desktop/src/components/setup/MonitoringEditor.tsx:123-148`) má české popisky `Vlastní` / `Pořadatel`, zatímco zbytek dialogu i dokumentu je anglicky.

- `Vlastní` / `Pořadatel` → **`Band` / `FOH`**. Kopíruje to doménové hodnoty `band` a `foh` a navazuje na formulaci `(provided by FOH)`, která je už dnes v poznámkách PDF.
- Nad přepínač přibude popisek **`Monitor supplier`** přes třídu `.setup-field-block__label` — ten vzor dialog už používá u ostatních polí (`DropdownField`, `AdditionalPickerField`), takže nevzniká nové CSS. Vykreslí se verzálkami, mono 11 px.
- `aria-label="Dodavatel odposlechu"` na skupině se nahradí `aria-labelledby` mířícím na ten viditelný popisek.
- Test `MonitoringEditor.test.tsx:87-88` hlídá české řetězce a přepíše se.
