# Obrazovka `02 INPUTS` — editor kanálů, monitorů a poznámek

**Fáze:** F5c
**Datum:** 2026-08-17
**Předchůdci:** F5a (`2026-08-13-stageplan-editor-and-layout-model-design.md`), F3 (`2026-08-12-shell-and-information-architecture-design.md`), F7 (`2026-08-15-print-box-sized-by-text-and-header-contact-design.md`)
**Stav:** schváleno k implementaci

## Kontext

Krok `02` v procesní stopě má od F3 stav `unavailable`, protože obrazovka neexistuje.
Inputy se dnes editují v modálu uvnitř `ProjectSetupPage.tsx` (2756 řádků) a poznámky pod
tabulkami se needitují **nikde** — `buildPdfNotes` vezme šablonu podle `band.notesTemplateRef`
a jen odfiltruje monitorové řádky podle podmínek `when`.

### Co ukázal průzkum kódu před psaním specu

Tři nálezy zásadně mění rozsah fáze proti tomu, co roadmapa předpokládala.

**1. Přejmenování a poznámka řádku už mají doménu i persistenci.**
`PresetOverridePatch.inputs` nese `update?: PartialInputUpdate[]` s poli `label`, `note`,
`baseLabel`, `compactGroupKey`, `channel` a `group`, a `applyPresetOverride`
(`src/domain/rules/presetOverride.ts:154-165`) je aplikuje. Chybí výhradně UI. Ze čtyř
požadovaných operací na řádku tedy potřebují novou datovou vrstvu jen dvě.

**2. Číslování má čistý bod vstupu.**
Řetěz v `src/domain/pipeline/buildDocument.ts:600-607` je

```
composeFinalPdfInputOrder  →  assignPdfChannels  →  buildPdfInputRows
```

a ruční pořadí se vsune přesně mezi první dva kroky. `disambiguateInputKeys` běží už na
řádku 562, takže klíče jsou v tom bodě unikátní.

**3. `toPersistableProject` je whitelist a už jednou to bolelo.**
`packages/desktop/src/app/shell/types.ts:111-118` nese varování, že `stageplan` musel na
whitelist přijít výslovně, jinak by uložení z jiné obrazovky smazalo ruční rozmístění.
Naproti tomu čtení projektu je `JSON.parse` s `& Record<string, unknown>`
(`projectsApi.ts:49-51`), takže neznámá pole zůstanou zachována. Jediná branka je zápis.

### Co se tiskne na straně 1

`renderInputlistHtml` (`src/infra/pdf/template.ts:156-193`) skládá pod sebe **tabulku inputů,
tabulku monitorů a blok poznámek** (nejdřív `notes.inputs`, pak `notes.monitors`). Tři bloky,
jedna strana. To určuje identitu obrazovky.

## Cíl

Otevřít krok `02` jako editovatelné zrcadlo strany 1 dokumentu: kanály, monitory a poznámky
na jedné obrazovce, s odchylkami uloženými na projektu, aby úprava kvůli jednomu koncertu
neovlivnila ostatní dokumenty té kapely.

## Rozsah

- Nová obrazovka `/projects/:id/inputs` a její napojení na procesní stopu.
- Editace kanálů: zapnout, vypnout, přidat z katalogu, přejmenovat, změnit poznámku, přeřadit.
- Přesun editace monitoringu a skladby bicí soupravy z `ProjectSetupPage` na novou obrazovku.
- Nová doménová vrstva pro ruční pořadí kanálů.
- Nová doménová vrstva pro poznámky jako odchylky projektu nad šablonou kapely.
- Protnutí toku na `01 → 02 → 03`.

## Mimo rozsah

- Rozdělení zbytku `ProjectSetupPage.tsx` na komponenty. Fáze vytáhne jen stav, který nová
  obrazovka potřebuje; zbytek je samostatná úloha (R16).
- Editace vlastníka talkbacku, která zůstává na kroku `01` (R5).
- Napájení, které edituje editor stage planu od F6.
- Editace šablony poznámek kapely. Šablona se v této fázi jen čte.
- Změna obsahu, struktury nebo pořadí tištěných tabulek.

## Rozhodnutí

### R1 — Osou obrazovky je seznam kanálů, ne seznam muzikantů

Obrazovka je editovatelné zrcadlo strany 1 dokumentu: `INPUT LIST`, `MONITORS`, `NOTES` pod
sebou v tiskovém pořadí. Uživatel vidí to, co dostane na papír, a edituje to na místě.

*Alternativa:* osa podle muzikantů, tedy sloty lineupu vlevo a živý seznam kanálů vpravo.
Zamítnuto — kanály jsou sice odvozená data, ale krok `02` má být o dokumentu; osa podle lidí
už existuje na kroku `01` a zdvojovat ji znamená dvě obrazovky, které vypadají stejně.

*Alternativa:* jen přestěhovat modály a nechat krok `02` rozcestníkem. Zamítnuto — uživatel
by výsledný seznam kanálů neviděl, dokud nedojde na `04 EXPORT`.

### R2 — Layout je tabulka a kontextový panel, bez sloupce vlastníka

Široká tabulka vlevo, panel vybraného řádku vpravo. Přebírá vzor editoru stage planu z F5a
(canvas a panel), takže kroky `02` a `03` se ovládají stejně.

Tabulka má tři sloupce, přesně jako tisk: `no.`, `input`, `note`. **Vlastníka kanálu nese
jen panel**, ne sloupec — tabulka tak zůstává otiskem tisku.

Skupinové oddělovače podle vlastníka se zamítají: `composeFinalPdfInputOrder` sbírá lead
i back vokály od různých muzikantů do jednoho vokálního bloku, takže oddělovače by se na
vokálech rozpadly. Akce vlastníka (`Edit kit`, `Reset to default`, `Save as musician default`)
proto sedí v panelu pod údaji o vybraném řádku.

### R3 — Vypnutý kanál z tabulky nemizí

Odebraný kanál zůstane v tabulce šedý, přeškrtnutý a **bez čísla**. Uživatel vidí, co
odškrtl, a vrátí to jedním klikem. Do PDF nejde.

Je to jediné vědomé místo, kde se obrazovka liší od tisku. Alternativa, tedy odebrané
kanály v samostatném seznamu pod tabulkou (jak to dělá dnešní `InputsEditor`), se zamítá —
rozděluje jeden seznam na dva a ztrácí informaci, kde v pořadí kanál byl.

### R4 — Přidání kanálu je dvoukrokový výběr

`+ Add input` se ptá nejdřív na **vlastníka** (slot lineupu), pak na kanál z katalogu jeho
role. Kanál bez vlastníka nejde umístit do boxu stage planu, takže vlastník není volitelný.

Ukládá se do existujícího `presetOverride.inputs.add` daného slotu.

### R5 — Na krok `02` se stěhuje skladba bicích, ne vlastník talkbacku

`DrumsPartsEditor` definuje deset až dvanáct bicích kanálů, takže je to editor kanálů
zabalený do jazyka bubnů. Kdyby zůstal na `01`, řídila by se polovina input listu odjinud
než druhá. Vyvolává se z panelu jako modál, ne inline — je to editor soupravy, ne řádku.

Vlastník talkbacku zůstává na `01`. Generuje jeden kanál, ale je to přiřazení osoby, ne
technická výbava, a na kroku `01` už je select přímo na stránce.

Tlačítko `Save as musician default` se stěhuje spolu s kanály: povyšování odchylky na
trvalou výbavu muzikanta musí být tam, kde odchylka vznikla.

### R6 — Přejmenování a poznámka jdou přes existující `update` patch

Obě operace zapisují do `presetOverride.inputs.update[]` jako `PartialInputUpdate`. Doména
i persistence existují, fáze dodává jen UI.

Přejmenování mění text tištěný v tabulce **i v boxu stage planu**, tedy i šířku boxu. Je to
přijatý důsledek, ne vada: box se od F7 měří podle vlastního textu a kolizní pojistka změnu
zachytí při exportu.

### R7 — Monitoring se stěhuje na `02` jako druhá tabulka

Editace monitoringu per muzikant patří na stejnou obrazovku jako kanály, ze dvou důvodů.
Zaprvé monitory se tisknou na téže straně. Zadruhé podmínky monitorových poznámek
(`hasBandSuppliedIem`, `hasFohSuppliedIem`) se vyhodnocují z monitoringu — kdyby byl
monitoring na jiné obrazovce, poznámky by se na `02` objevovaly a mizely bez viditelné
příčiny.

Krok `01` tím zůstává čistě o lidech a presetech, jak roadmapa předpokládala.

*Alternativa:* nechat monitoring na `01` a zúžit tam modál. Zamítnuto — rozpůlí jednu věc
o muzikantovi na dvě obrazovky.

### R8 — Ruční pořadí je seznam klíčů na projektu

Nové volitelné pole `Project.inputOrder?: readonly string[]` drží celý seznam klíčů v pořadí,
jak byl při uložení. Aplikuje ho nová čistá funkce `applyManualInputOrder` vsunutá mezi
`composeFinalPdfInputOrder` a `assignPdfChannels`.

Slučovací pravidlo, aby pořadí přežilo změnu lineupu:

1. Základ je `inputOrder` profiltrovaný na klíče, které dnes existují. Zmizelé se ignorují.
2. Klíč, který v `inputOrder` není, se vloží **za poslední známý klíč, který mu předchází ve
   vypočteném pořadí**. Nový kanál tak přistane tam, kam patří, ne na konec seznamu.
3. Když žádný známý klíč nepředchází, jde nový kanál před první známý, který následuje.
4. Při ukládání se `inputOrder` přepíše aktuálním stavem, čímž se mrtvé klíče vyčistí.

**Pole se zapisuje jen tehdy, když uživatel skutečně přeřadil.** Projekt, ve kterém nikdo
s pořadím nehýbal, `inputOrder` nemá vůbec, a řídí se tedy vypočteným pořadím i po pozdější
změně řadicích pravidel v doméně. Kdyby se pole zapisovalo vždy, každý uložený projekt by si
dnešní pořadí zabetonoval.

Ruční pořadí smí překročit hranici skupiny. Je to uživatelův dokument.

### R9 — Stereo partnery drží u sebe doména, ne UI

Po přerovnání se každý `R`, který nesousedí se svým `L`, vrátí k němu. Hlídá to
`applyManualInputOrder`, ne komponenta: `buildPdfInputRows` slučuje `13+14` jen ze
sousedních řádků, takže rozdělený pár by se tiskl jako dva samostatné. Doména je krytá
testy, UI ne.

### R10 — Posun klíčů při změně lineupu je přijatá degradace

`disambiguateInputKeys` odvozuje klíče jako `el_guitar_1` a `el_guitar_2` podle počtu
instancí. Když ubude jeden kytarista, druhému se klíč posune a jeho ruční pozice se z pohledu
pravidla 1 v R8 tváří jako zmizelý kanál — spadne zpátky na vypočtenou pozici.

Přijímá se to. Degradace je lokální a kanál skončí na rozumném místě, ne na konci;
ruční pořadí se v praxi ladí nad hotovým lineupem.

*Alternativa:* stabilní identita kanálu, tedy vlastník plus klíč před disambiguací.
Zamítnuto — znamená protáhnout novou identitu celou pipeline kvůli okrajovému případu.

### R11 — Poznámky jsou odchylky projektu nad šablonou kapely

```ts
export type ProjectNotesOverride = {
  /** id řádků šablony, které se v tomto projektu netisknou */
  readonly disabled?: readonly string[];
  /** id řádku šablony → vlastní znění */
  readonly overrides?: Readonly<Record<string, string>>;
  /** vlastní řádky projektu, řadí se za šablonové ve své sekci */
  readonly custom?: readonly {
    readonly id: string;
    readonly section: "inputs" | "monitors";
    readonly text: string;
  }[];
};
```

`buildPdfNotes` dostane čtvrtý krok. **Pořadí operací je závazné:**

1. Filtr podmínek `when` — beze změny.
2. Vyhodit řádky uvedené v `disabled`.
3. Nahradit text podle `overrides`.
4. Připojit `custom` na konec příslušné sekce.

Šablona dál určuje, co se nabídne. Projekt drží jen odchylku, takže nové řádky v šabloně se
v starších projektech objeví samy.

`id` vlastní poznámky má prefix `custom_`, aby nikdy nekolidovalo s `id` ze šablony — jinak by
`disabled` nebo `overrides` mířily na dvě věci zároveň. Za prefixem následuje nejnižší volné
číslo v rámci projektu, ne pořadí v seznamu; smazání prostředního řádku tak nepřečísluje
ostatní.

*Alternativa:* editovat rovnou šablonu kapely a krok `02` zrušit. Zamítnuto — je to špatná
úroveň pro jednorázovou poznámku a poznámky by zůstaly needitovatelné.

### R12 — Přepis textu je vratný a je vidět

Řádek s přepisem nese v editoru štítek `upraveno` a tlačítko zpět na znění ze šablony.
Bez toho by přepis tiše překryl pozdější změnu šablony.

*Alternativa:* jen vypnout a přidat vlastní řádek. Zamítnuto — změna jednoho čísla ve větě
by znamenala přepsat třicet slov ručně.

*Alternativa:* při první úpravě řádek od šablony odpojit. Zamítnuto — úprava by byla
nevratná a původní znění by se ztratilo.

### R13 — Vypnutí platí i na podmíněné řádky, vlastní poznámky podmínky nemají

Jedno pravidlo pro všechny řádky, žádná výjimka podle toho, odkud řádek pochází.

Vlastní poznámky nemají podmínky ani vlastní řazení — když je píšeš pro jeden koncert, víš,
jestli platí.

Přepis na řádku, který podmínka skrývá, se v editoru ukáže šedě s vysvětlením
(`Hidden: band has no FOH-supplied IEM`). Jinak by uživatel psal text do prázdna.

**Jazyk:** popisky rozhraní jsou anglicky podle R14 z F6, text poznámek zůstává český, protože
je to obsah dokumentu, ne rozhraní. Platí to pro celou obrazovku, včetně štítku `edited` u
přepsaného řádku z R12.

### R14 — Nová pole musí být na whitelistu, krytá testem

`inputOrder` i `notes` patří do `NewProjectPayload` **a do whitelistu v
`toPersistableProject`**. Bez toho by uložení z kroku `01` nebo `03` obě věci smazalo, a to
bez chybové hlášky. Komentář nestačí; hlídá to test, který uloží projekt z jiné obrazovky
a ověří, že pole přežila.

### R15 — Ukládání je `Save & Continue`, ne autosave

Stejný dirty model jako na kroku `01`, včetně `registerNavigationGuard`. `Continue` z `01`
míří na `/inputs`, `Continue` z `02` na `/stageplan`. Tok se tím protne na `01 → 02 → 03 → 04`.

`Reset to defaults` v hlavičce karty zahodí na této obrazovce **všech pět vrstev najednou** —
patche kanálů, ruční pořadí, monitoring, skladbu bicí soupravy a poznámky. Je to reset
dokumentu, ne jedné tabulky.

Pravidlo, které to drží pohromadě: reset maže vše, co je na projektu odchylkou od výchozího
stavu muzikanta nebo kapely. `drumDefinition` na slotu lineupu do toho patří, protože
`resolveDrumsSetupDefinition` ho staví nad `musicianPresetItems` — je to odchylka jako každá
jiná, jen uložená vedle patche a ne v něm.

### R16 — Sdílený stav se vytáhne do hooku testovatelného bez Reactu

Z `ProjectSetupPage` se vytáhne `setupDraftBySlot`, `getExistingSlotOverride`,
`resolveSlotSetup`, `resolveDraftOverride` a `validateEffectivePresets`. Obě obrazovky to
potřebují: `01` kvůli validaci lineupu, `02` kvůli editaci.

Logika se píše tak, aby byla testovatelná v node prostředí bez Reactu — vzor `processSteps.ts`.
Je to jediná pojistka, kterou u tohoto přesunu máme: `ProjectSetupPage.tsx` nemá vlastní test.

Zbylé rozdělení `ProjectSetupPage` do této fáze nepatří. Refaktorovat kód, který se vzápětí
odstěhuje jinam, je práce vniveč, a míchat přesun s restrukturalizací znamená, že u padlého
testu nepoznáš, která změna za to může.

## Architektura

**Doména** (`src/domain/`, čistá, bez I/O):

| Soubor | Co |
|---|---|
| `pipeline/applyManualInputOrder.ts` | nová čistá funkce, R8 a R9 |
| `pipeline/pdf/buildPdfNotes.ts` | čtvrtý krok rozlišení, R11 |
| `model/types.ts` | `Project.inputOrder`, `Project.notes`, `ProjectNotesOverride` |
| `pipeline/buildDocument.ts` | dva zásahy: vsunout funkci, předat `project.notes` |

**Persistence** (`packages/desktop/src/app/shell/types.ts`): `NewProjectPayload` a whitelist
v `toPersistableProject` (R14).

**Obrazovka**: `app/pages/ProjectInputsPage.tsx` na vzoru `StagePlanEditorPage.tsx` — `LoadState`
union, `readProject` / `parseProjectPayload` / `saveProjectPayload`, `registerNavigationGuard`.
Komponenty do `app/components/inputs/`: `InputTable`, `InputRowInspector`, `MonitorTable`,
`NotesEditor`, `AddInputPicker`. `DrumsPartsEditor` a `MonitoringEditor` se stěhují bez úprav.

**Sdílený stav**: `app/domain/setup/useSetupOverrides.ts` (R16).

**Napojení kroku**: `routes.ts` (`matchProjectInputsPath`, položka `project-inputs`),
`chrome/processSteps.ts` (`segment: "inputs"` a čtvrtá větev pro `current`), `ShellRouter.tsx`,
a v `ProjectSetupPage.tsx` odebrat modál se stavem a přesměrovat `Continue`.

## Testování

**Doména.** `applyManualInputOrder`: prázdné pořadí je identita; zmizelý klíč se ignoruje;
nový klíč přistane na vypočtené pozici a ne na konci; nový klíč bez předchůdce jde před
první známý následník; rozdělený stereo pár se spojí; pořadí smí překročit skupinu.
`buildPdfNotes`: vypnutí, přepis, vlastní řádky po sekcích, vypnutí podmíněného řádku,
přepis na podmínkou skrytém řádku, závazné pořadí čtyř kroků.

**Integrace.** `buildDocument`: projekt s `inputOrder` dá očekávaná čísla `ch`; projekt
s `notes` dá očekávané řádky poznámek.

**Desktop.** `toPersistableProject` nová pole nese a uložení z jiné obrazovky je nesmaže
(R14). `processSteps`: krok `02` je `available` a na `/inputs` je `current`. Matcher routy.
Logika vytaženého hooku (R16).

**Smoke.** `npm run smoke:stageplan-print` — přečíslování a přejmenování mění text v boxech.

**Baseline, měřit rozdíl a ne absolutní čísla:** `npm test` má 2 trvale padající testy
(`assetsPaths`, `repoAssets`); `npm run lint` má asi 1368 CRLF chyb, takže lintovat jen
dotčené soubory; `npx tsc -p packages/desktop/tsconfig.json --noEmit` má 10 chyb ve
4 testových souborech.

## Rizika

Seřazená podle toho, co by bolelo nejvíc.

1. **Whitelist v `toPersistableProject`** — tichá ztráta ručního pořadí i poznámek při
   uložení z jiné obrazovky. Krytý testem (R14).
2. **Extrakce sdíleného stavu bez záchytné sítě** — `ProjectSetupPage.tsx` nemá test.
   Zmírnění: logiku hooku napsat testovatelně bez Reactu a otestovat ji **před** přesunem
   UI (R16).
3. **Posun klíčů při změně lineupu** — přijatá degradace (R10).
4. **Přečíslování a přejmenování mění šířky tištěných boxů** — kolizní pojistka z F7 to
   zachytí při exportu. Je to hlášená chyba, ne tichá vada.

## Verifikace

Automaticky ověřitelné je vše z části Testování. Následující body vyžadují `npm run dev`
a běží v okně Tauri, takže je nutné projít je ručně — stejně jako u F5a, F6 a F7.

1. Krok `02` v procesní stopě je klikatelný a vede na novou obrazovku.
2. `Continue` z kroku `01` vede na `02`, `Continue` z `02` na `03`.
3. Tabulka kanálů odpovídá tabulce v exportovaném PDF, číslo za číslem.
4. Vypnutý kanál zůstane v tabulce šedý a bez čísla, v PDF chybí (R3).
5. Přidání kanálu přes dvoukrokový výběr skončí u správného vlastníka (R4).
6. Přejmenování a změna poznámky se projeví v PDF i v boxu stage planu (R6).
7. Přeřazení řádku přečísluje kanály a stereo pár zůstane pohromadě (R8, R9).
8. Změna lineupu po přeřazení nerozsype pořadí zbylých kanálů (R8, pravidla 1 a 2).
9. Přepnutí monitoru změní podmíněné poznámky ve stejné obrazovce (R7).
10. Vypnutí, přepis a vlastní poznámka se projeví v PDF ve správné sekci a pořadí (R11).
11. Štítek `upraveno` a návrat na šablonu fungují (R12).
12. Přepis na skrytém řádku je šedý s vysvětlením (R13).
13. `Reset to defaults` zahodí všechny tři vrstvy (R15).
14. Uložení z kroku `01` nebo `03` nesmaže pořadí ani poznámky (R14).
15. Starý projekt bez nových polí se načte a uloží bez ztráty dat.

## Navazuje

**Rozdělení `ProjectSetupPage.tsx`.** Předpoklad byl, že po této fázi ze stránky odejde modál
kanálů, monitoringu a bicích a spadne o zhruba třetinu — neplatí, viz sekce „Stav implementace"
níže: modál zůstává (R16 nesplněno), soubor klesl jen o 28 řádků. Zbylé rozdělení na komponenty
čeká na fázi, která modál skutečně odstraní.

**Editace šablony poznámek kapely.** Tato fáze šablonu jen čte. Až bude potřeba měnit ji
samotnou, patří to do knihovny ke kapele, ne na krok `02`.

**Stabilní identita kanálu.** Kdyby se degradace z R10 ukázala v praxi jako obtěžující,
řešení je vlastník plus klíč před disambiguací protažený pipeline.

## Stav implementace

**Fáze je hotová v rozsahu, ne beze zbytku.** 44 commitů `71299b7`…`4c38ff5`
(10056 vložených / 141 smazaných řádků v 75 souborech). R1–R15 platí beze změny.
R16 (extrakce sdíleného stavu do hooku bez Reactu) je splněná **jen částečně**
a jinak, než tahle sekce dřív tvrdila. Task 9 vytáhl výhradně dvě funkce —
`resolveMusicianDefaultPreset` (přejmenováno na `defaultPresetFor`) a
`resolveSlotSetup` (přejmenováno na `setupForSlot`) — do nového
`app/domain/setup/resolveSetupForSlot.ts`, obalené tenkým hookem
`useSetupOverrides.ts`. Ruling 1 Tasku 9 explicitně vyloučil zbytek:
`setupDraftBySlot`, `resolveDraftOverride` a `getExistingSlotOverride`
se **neextrahovaly** a dodnes žijí jako lokální stav a funkce uvnitř
`ProjectSetupPage.tsx` (`useState` na řádku 444, `resolveDraftOverride` na
řádku 1184, `getExistingSlotOverride` na řádku 1210) — je to stav modálu,
který měl podle plánu smazat až Task 19, a refaktorovat kód, který se vzápětí
smaže, by byla práce vniveč. (`resolveEffectiveProjectSetup.ts` v
`src/domain/setup/` je mimochodem starší než tahle fáze a Task 9 se ho
netýká; funkce, kterou `resolveSetupForSlot.ts` importuje, je
`resolveEffectiveMusicianSetup`.)

Plán navíc pod stejnou nálepku „R16" schoval i **odstranění starého setup
modálu** (Task 19, titulek briefu doslova „Odebrání setup modálu z
`ProjectSetupPage` (R16)") — a tahle část **splněná není**, viz bod 3 níže.
Protože Task 19 nedoběhl, zbytek stavu popsaný výše (`setupDraftBySlot` a
spol.) zůstává v modálu i nadále — až spec pro přesun sekce Inputs (bod 3)
vznikne, bude muset počítat s tím, že tahle trojice ještě NENÍ extrahovaná.

Tři rozhodnutí zůstala otevřená, všechna vědomě a všechna rozhodnutím člověka
(2026-08-19), ne opomenutím. Fáze se jimi uzavírá — nejsou to nálezy pro finální
review, jsou to hranice rozsahu, které je potřeba znát dřív, než se s kódem
dál pracuje.

### 1. R3/R4/R7 platí jen pro nástrojové kanály

Vypnutí, vrácení, přidání kanálu (R3/R4) i editace monitoringu (R7) fungují
na `02` u basy, kytary a kláves. U bicích, vokálních a talkback kanálů
obrazovka tyhle akce **vědomě nenabízí** — `resolveInputRowEditability` a
`resolveMonitorRowEditability` (Task 13b) vrací `canEdit: false` s důvodem
`drums-not-supported`/obdobným, protože dokument čte jen `inputs.update` u
těchto řezů, ne `inputs.add`/`removeKeys`. Domain byla na tenhle rozsah zúžena
teprve fixem **Tasku 12c**, po dvou Critical vadách nalezených review (zápis
mimo to, co dokument skutečně čte).

Rozhodnutí člověka: nechat fázi takhle omezenou. Rozšíření domény (aby bicí,
vokální a talkback řez četly `inputs.add`/`removeKeys` proti klíčům, které v
nich reálně existují) se otevírá jako **samostatná fáze s vlastním specem a
PDF regresí**, ne dovnitř F5c — je to změna chování dokumentu, ne úklid UI, a
brána je navržená tak, aby šla později zrušit jedním podmíněným renderem.

### 2. Monitoring bicích není editovatelný nikde

Na `02` je zakázaný se zdůvodněním (Task 15, `drums-not-supported`). Na `01`
je od **Tasku 19a** zakázaný stejně — nová komponenta
`components/setup/SetupMonitoringEditor.tsx` obaluje `MonitoringEditor` za
tutéž bránu (`resolveMonitorRowEditability`), takže obě volací místa
`setSetupDraftBySlot(..., "monitoring:...")` v `ProjectSetupPage.tsx` vedou
přes gate. Stav je **konzistentní a záměrný** — needitovatelný nikde, se
zdůvodněním viditelným v UI, ne tichá mezera.

Rozhodnutí člověka: bubeník vlastní odchylku monitoringu mít má, ale až
v té následné fázi, co rozšíří doménu (bod 1), ne v F5c.

### 3. R16 (odstranění setup modálu) NENÍ splněno

Modál na `01` zůstává. **Task 19 se zastavil na vlastní bráně** dřív, než cokoli
smazal (`status: NEEDS_CONTEXT`, žádný commit, `git status --porcelain` čistý) —
brief mu předepisoval z kódu vypsat, co modál umí, ke každé akci najít domov
na `02`, a když některá domov nemá, nemazat nic.

Osm z devíti akcí modálu domov má (výběr muzikanta, reset patche, `Save as
musician default`, validace lineupu, `MonitoringEditor`, `Edit kit`). Jedna
(řádek 3 tabulky v `task-19-report.md` — reset `drumDefinition` per muzikant)
má na `02` jen hrubší ekvivalent (globální „Reset to defaults") — to samo
bránu nezastavuje.

**Skutečná zábrana je devátý řádek téže tabulky — sekce Inputs**, kterou modál nese
(`ProjectSetupPage.tsx:2144–2172` a `2262–2303`): dropdown typu zapojení pro
basu/kytaru/klávesy a doplňkové toggly (mic on cabinet, bass synth, acoustic
guitar, varianty kláves, typ mikrofonu lead vocs). Obrazovka `02` tuhle sekci
**nikde neimportuje ani nereplikuje** — jediná editace vstupu na `02` je
přejmenování/poznámka + `Remove`/`Restore`/`+ Add input` z `GROUP_INPUT_LIBRARY`,
což je jinak klíčovaný a chudší katalog. Smazat modál by uživateli sebralo
možnost přepnout např. kytaristu z mikrofonu na DI.

**Tohle není důsledek zúžení z bodu 1.** Sekce Inputs není v žádném z Tasků
10–18 spec ani plánu — je to mezera v plánu, ne rozšíření domény, které si
člověk vědomě odmítl. R16 stálo na premise „teprve teď, když nová obrazovka
umí všechno, se stará cesta zavře" — ta premisa přestala platit dřív, než na
Task 19 došla řada.

Rozhodnutí člověka: Task 19 se **odkládá celý**. Přesun sekce Inputs na `02`
dostane vlastní spec a vlastní fázi.

**Věcná otázka pro ten budoucí spec:** schéma projektu a katalog `+ Add input`
používají pro tytéž kanály **různé klíče** — schéma/presety znají
`el_guitar_mic`, `el_guitar_xlr_mono`, `el_guitar_xlr_stereo`, `ac_guitar`,
zatímco `GROUP_INPUT_LIBRARY` (na `02`) zná jen `gtr_mic`/`gtr_di`. Bez
sjednocení klíčů nebo výslovného mapování mezi nimi se sekce Inputs na `02`
přesunout nedá.

**Vedlejší efekt:** protože Task 19 nikdy neproběhl, `ProjectSetupPage.tsx`
nespadl o „zhruba třetinu", jak předpokládala sekce Navazuje výše. Klesl jen
o 28 řádků (2756 → 2728), z drobných úprav ostatních tasků (především 19a).
Rozdělení souboru na komponenty (mimo rozsah i podle R16) čeká na fázi, která
Task 19 provede.

### Mimo plán vznikly čtyři tasky

**12b, 12c, 13b a 19a** nejsou v plánu — vznikly za běhu fáze:

- **12b** přesunulo tlačítko `Save as musician default` do panelu (druhá
  polovina R5) — přesun samotného `DrumsPartsEditor` na `02` je Task 16, ne
  12b.
- **12c** zúžilo doménu (viz bod 1) po dvou Critical nálezech review — zápis
  z UI mířil tam, kam dokument nekouká.
- **13b** postavilo bránu `resolveInputRowEditability`/
  `resolveMonitorRowEditability`, kterou 12c vyžádalo a kterou od té doby
  používají Tasky 15, 16 i 19a.
- **19a** zakázalo editaci monitoringu bicích na `01` stejným vzorem jako
  Task 15 na `02` — jediná živá vada, kterou by jinak odložení Tasku 19
  nechalo viset (viz bod 2).

### Rulingy a odchylky, které stojí za přečtení

Podrobný záznam každého rozhodnutí je v `progress.md` tohoto adresáře
(řádky s `Ruling`); tady jen to, co má dopad mimo vlastní task.

- **Task 12c narazilo na produkční Critical dřív, než ho odhalilo review** —
  UI zapisovalo `inputs.add`/`removeKeys` u bicích, vokálních a talkback
  kanálů, které dokument nikdy nečetl (zápis do prázdna). Oprava zúžila
  doménu na `inputs.update`, což je rozhodnutí 1 výše zpětně zdůvodňuje.
- **Task 16 (Edit kit) zůstává vlastnickou akcí i na vokálním řádku bubeníka**,
  záměrně nezúženo na `row.group === "drums"` — kdyby kit mohl skončit bez
  kanálů, zúžená podmínka by tlačítko schovala a k soupravě by se pak nedalo
  dostat, obzvlášť když měl Task 19 (odloženě) zavřít modál jako jedinou
  zbývající cestu.
- **Task 17 našlo Critical, který review nevidělo dřív, protože ho
  neošetřovalo doménové ověření: vypnutí vlastní poznámky se v editoru
  odškrtlo, ale `buildPdfNotes.ts` mazání nefiltrovalo `overrides.custom`.**
  Oprava je v UI, ne v doméně: vlastní řádek dostal `Remove` místo
  zaškrtávátka; šablonové řádky si zaškrtávátko podržely.
- **Task 18 našlo skutečnou vadu v kódu, který plán předepisoval doslova** —
  naivní `Array.isArray` mapování slotů lineupu by na reálných datech
  (role uložené jako holé stringy) smazalo přiřazení muzikanta při resetu.
  Oprava je destrukturace se zachováním neznámých polí, ověřená na reálném
  projektu z `%APPDATA%/StagePilot`. Je to třetí místo v této fázi (po
  Tasku 14 a Tasku 17), kde plán psal kód proti typům, ne proti uloženým datům.
- **Task 19a**: implementer umístil novou komponentu do `components/setup/`
  místo `app/domain/inputs/` bez sesterské čisté funkce — review posoudilo
  jako v pořádku, protože přímo použila `resolveMonitorRowEditability`
  z Tasku 15 (brief to výslovně připouštěl), takže rozhodnutí v testovatelné
  čisté funkci leží, jen se nezdvojilo.

### Co je automaticky ověřeno (Task 20)

- `npm test`: **1089 testů, 1087 procházejících, stejná 2 trvale padající**
  (`assetsPaths`, `repoAssets`) jako baseline fáze — delta 0.
- `npx tsc -p packages/desktop/tsconfig.json --noEmit`: **10 chyb ve 4
  testovacích souborech** (`BassFieldRendering.test.tsx`,
  `buildBassFields.test.ts`, `buildKeysFields.test.ts`,
  `projectMaintenance.test.ts`) — shodné s baseline, delta 0.
- `src/domain/pipeline/buildDocument.pdfRegression.test.ts`: zelený,
  neupravovaný.
- `npm run smoke:stageplan-print`: glyph tabulka sedí s Chromiem (53 řetězců
  ve 4 řezech). Ze tří reálných projektů **1 staví a bez přetečení**
  (`FNB_Inputlist_Stageplan_22-08-2026_Zamek-Bon-Repos`), **2 jsou
  přeskočené na kolizní pojistce** (`guitar × lead_voc_1`, `keys × lead_voc_2`,
  `lead_voc_1 × lead_voc_2`) — stejná trojice kolizí, jakou už zdokumentovala
  F7 (viz roadmapa, sekce F7) **před** začátkem F5c. Není to vada této fáze:
  pojistka funguje podle návrhu, bloky čekají na přerovnání v editoru
  člověkem, přejmenování/přeřazení z F5c ji jen nezhoršilo ani nezlepšilo.
- **Lint — baseline z briefů (~1368) je zastaralá, nahrazena.** Agregát
  `npx biome check .` je nedeterministický (tři po sobě jdoucí běhy v tomto
  ověření: 1543/1543/1543; dřívější měření během fáze: 1540/1541/1543) a jako
  signál se dál nepoužívá. Platná metoda je kontrola dotčených souborů na
  LF-normalizované kopii (`core.autocrlf=true` jinak u každého souboru
  s CRLF ukáže „celý soubor jiný" a maskuje skutečné nálezy). Na všech 72
  netriviálních souborech dotčených fází (LF-normalizovaně) je **44 nálezů**:
  20 kategorie `format` (zalomení řádku nad 80 znaků — kontrolní vzorek na
  souboru, kterého se fáze vůbec nedotkla, potvrdil, že jde o repozitářový
  dluh odjinud, ne o něco, co přinesla F5c), 7× `lint/a11y/useSemanticElements`
  (návrh vlastního `<dialog>` místo `div role="dialog"` — stejný vzorec
  používá `ModalOverlay` v sedmi souborech napříč aplikací včetně modálů,
  které F5c nezaložila; 2 z nich na `ProjectInputsPage.tsx:1416,1470` už
  zaznamenal Task 18 jako zděděné), 6× `lint/correctness/useExhaustiveDependencies`
  a 5× `lint/complexity/noForEach` (ověřeno bod za bodem proti verzi souboru
  z báze fáze `8982767` — identické pravidlo, identický počet, jen posunuté
  řádky), 1× `lint/style/noNonNullAssertion` (`buildDocument.setupOverride.test.ts:1159`,
  shodné s bází). **Jediný skutečně nový nález** je jeden `organizeImports`
  v `ProjectSetupPage.tsx` (báze ho nemá) — pravděpodobně z importu
  `SetupMonitoringEditor` v Tasku 19a, nezachycený tehdy kvůli CRLF masce.
  Je to kosmetický dluh o jednom souboru, Task 20 produkční kód neopravuje;
  patří do triáže při finální review. **Nové číslo pro příští fázi:**
  agregát ~1543 (nespoléhat na něj), 44 nálezů na LF-normalizovaných
  souborech dotčených F5c (z toho 43 zděděných, 1 nový a kosmetický).

### Co ověřeno není

Patnáct bodů „Verifikace" výše vyžaduje `npm run dev` a okno Tauri — stejné
omezení jako u F5a, F5b, F6 a F7 (editor/obrazovka běží v desktopové appce,
CLAUDE.md drží testy bez jsdom, tenhle běh nemá přístup k desktopovému oknu).
**Žádný z patnácti bodů nebyl ručně prověřen v rámci Tasku 20** — zůstávají
na člověku, včetně bodu 15 (starý projekt ze skutečného `%APPDATA%/StagePilot`,
ne z fixtury), přesně jak „Co plán vědomě nedodává" v briefu předjímá.

### Co se předává dál

- **R16 (odstranění setup modálu) a přesun sekce Inputs** — vlastní spec,
  viz bod 3.
- **Rozšíření domény na bicí/vokální/talkback řezy** (`inputs.add`/
  `removeKeys` + monitoring bicích) — vlastní spec a PDF regrese, viz body
  1 a 2.
- **Rozdělení zbytku `ProjectSetupPage.tsx`** čeká na Task 19 — beze změny
  z F5b/F6/F7 precedentu, jen teď víme, že se nestane, dokud nedostane
  vlastní fázi.
- **Klíčový nesoulad schéma vs. katalog** (`el_guitar_*`/`ac_guitar` vs.
  `gtr_mic`/`gtr_di`) — věcná otázka pro spec z bodu 3, jinak se sekce
  Inputs přesunout nedá.
- Patnáct bodů ruční verifikace, viz výše.
