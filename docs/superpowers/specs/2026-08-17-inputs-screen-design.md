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

**Rozdělení `ProjectSetupPage.tsx`.** Po této fázi ze stránky odejde modál kanálů,
monitoringu a bicích, takže spadne o zhruba třetinu. Zbylé rozdělení na komponenty je
samostatná úloha bez změny chování (R16).

**Editace šablony poznámek kapely.** Tato fáze šablonu jen čte. Až bude potřeba měnit ji
samotnou, patří to do knihovny ke kapele, ne na krok `02`.

**Stabilní identita kanálu.** Kdyby se degradace z R10 ukázala v praxi jako obtěžující,
řešení je vlastník plus klíč před disambiguací protažený pipeline.
