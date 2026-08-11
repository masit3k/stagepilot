# Datum aktualizace rideru a dodavatel odposlechů

Datum: 2026-08-11
Stav: schválený návrh, připraven k rozpisu implementačního plánu

## Problém

Dvě nezávislé vady, které se řeší společně, protože obě sahají do hlavičky a tabulky odposlechů generovaného PDF.

**1. Datum aktualizace v hlavičce neodpovídá poslední změně.** Řádek „datum aktualizace: …" ukazuje datum vzniku projektu. Formátovací vrstva je přitom správně — `formatProjectMetaLine` v `src/domain/formatters/meta.ts` čte `updatedAt` a padá zpět na `documentDate`. Chybí zápis razítka: `persistProject()` v `packages/desktop/src/app/pages/ProjectSetupPage.tsx` ukládá projekt bez dotčení `updatedAt`. Pole se nastavuje jen při zakládání projektu, při automigracích a při hub operacích.

**2. Katalog odposlechů nerozlišuje, kdo vybavení dodává.** Pořadatel z rideru nepozná, zda si kapela IEM veze a potřebuje jen monitorový send z pultu, nebo zda má sadu zajistit. Existujících pět presetů v `data/assets/presets/monitors/` tuto osu nemá.

## Rozsah

Doména, katalog presetů, jedna UI komponenta. Body A a B–D jsou nezávislé a lze je implementovat i commitovat odděleně.

---

## A. Razítko poslední změny

### Rozdělení dvojí role

Pole `updatedAt` dnes odpovídá na dvě různé otázky současně: co ukázat v hlavičce PDF a jak seřadit seznam projektů (`StartPage.tsx`, `projectHubUtils.ts`). Archivace projektu nebo přesun do koše jsou uživatelské akce, které mají posunout pořadí v seznamu, ale nemění obsah rideru — datum v hlavičce se posunout nesmí.

Návrh proto zavádí druhé pole:

| Pole | Význam | Čte |
|---|---|---|
| `contentUpdatedAt` | poslední změna obsahu rideru | hlavička PDF |
| `updatedAt` | poslední jakákoli uživatelská akce nad projektem | řazení a sloupec v hubu |

Pole `contentUpdatedAt` přibude do `Project` (`src/domain/model/types.ts`), do `NewProjectPayload` (`packages/desktop/src/app/shell/types.ts`) a musí projít funkcí `toPersistableProject`, která dnes vyjmenovává pole explicitně.

Rust command `list_projects` čte `updatedAt` pro `ProjectSummary` — jeho význam se nemění, zůstává beze změny.

### Rozlišení záměru zápisu

Zápis projektu dostane jedno hrdlo, aby se na razítko nedalo zapomenout. Čistá funkce:

```ts
// packages/desktop/src/app/domain/project/stampProjectUpdate.ts
export type SaveIntent = "content" | "lifecycle" | "system";

export function stampProjectUpdate(
  payload: NewProjectPayload,
  intent: SaveIntent,
  nowIso: string,
): NewProjectPayload;
```

| Intent | `contentUpdatedAt` | `updatedAt` | Použití |
|---|---|---|---|
| `content` | nastaví | nastaví | změna setupu, lineupu, přesetů, metadat rideru |
| `lifecycle` | ponechá | nastaví | archivace, koš, obnovení, přejmenování |
| `system` | ponechá | ponechá | automigrace při otevření, maintenance |

Nad funkcí vznikne tenký service wrapper v `packages/desktop/src/app/services/projectsApi.ts`:

```ts
saveProjectPayload({ projectId, legacyProjectId?, payload, intent })
```

Wrapper dodá `new Date().toISOString()`, provede `toPersistableProject` a serializaci. Stávající `saveProject` zůstane jako nízkoúrovňový invoke, ale všechna volání ze stránek a služeb se přesměrují na `saveProjectPayload`. Injektování času parametrem drží `stampProjectUpdate` čistou a testovatelnou.

### Klasifikace stávajících volajících

Rozhodovací pravidlo: zápis je `content` právě tehdy, mění-li pole, které se propisuje do generovaného PDF — tedy lineup, přesety, `eventDate`, `eventVenue`, `documentDate`, `note`, `bandLeaderId`, `bandRef` a talkback. Zápis, který se dotýká jen stavu projektu v aplikaci, je `lifecycle`. Zápis, který si vynutila aplikace bez uživatelského zásahu, je `system`.

| Místo | Intent | Poznámka |
|---|---|---|
| `ProjectSetupPage.persistProject()` | `content` | hlavní cesta uložení setupu |
| `ProjectSetupPage` — inicializace lineupu | `system` | dnešní ruční `updatedAt: new Date()` se odstraní |
| `ProjectSetupPage` — migrace formátu lineupu | `system` | totéž |
| `projectMaintenance.ts` | `system` | podmíněné razítko `needsMaintenance ? nowIso : …` odpadá |
| `useProjectsHubData` — archivace, koš, obnovení | `lifecycle` | ruční `updatedAt` se odstraní |
| `NewEventProjectPage`, `NewGenericProjectPage` | zakládání | `createdAt`, `updatedAt` i `contentUpdatedAt` se rovnají času vzniku |

Editace metadat rideru mimo `ProjectSetupPage` — pokud v hubu existuje — spadá podle pravidla do `content`, i když ostatní hub operace jsou `lifecycle`. Implementační plán volající projde jednotlivě.

### Čtení v pipeline

`resolveUpdatedDateIso` v `src/domain/formatters/meta.ts` bude řešit pořadí:

```
contentUpdatedAt ?? updatedAt ?? documentDate
```

Fallback přes `updatedAt` pokrývá projekty uložené před touto změnou, poslední stupeň pokrývá projekty bez razítka vůbec. `buildDocument.ts` předá nové pole do meta modelu na obou místech, kde dnes předává `updatedAt`.

### Testy

- Jednotkové na `stampProjectUpdate` — tabulka intent × dotčená pole, s pevným `nowIso`.
- Jednotkové na `resolveUpdatedDateIso` — celý fallback řetězec včetně neplatných hodnot.
- Rozšíření `pdfHeader.integration.test.ts` o případ, kdy `contentUpdatedAt` a `updatedAt` nesou různá data a hlavička musí vzít to první.

---

## B. Model monitor presetů

### Doménový typ

Pole `mode` a `wireless` v JSONech katalogu dnes nikdo nečte — typ `Monitor` zná jen `type`, `id` a `label`. Návrh je povyšuje na doménu a přidává `supplier`:

```ts
export type MonitorSupplier = "band" | "foh";

export type Monitor =
  | {
      type: "monitor";
      id: string;
      label: string;
      kind: "iem";
      supplier: MonitorSupplier;
      mode: "mono" | "stereo";
      wireless: boolean;
    }
  | {
      type: "monitor";
      id: string;
      label: string;
      kind: "wedge";
      supplier: MonitorSupplier;
    };
```

Rozlišený svaz podle `kind` odpovídá pravidlu z CLAUDE.md o preferenci rozlišených svazů před volitelnými poli — `mode` a `wireless` dávají smysl jen u IEM.

### Katalog

Deset souborů v `data/assets/presets/monitors/`:

| id | label | kind | supplier | mode | wireless |
|---|---|---|---|---|---|
| `iem_mono_wired_foh` | IEM MONO wired (provided by FOH) | iem | foh | mono | false |
| `iem_mono_wired_own` | IEM MONO wired (own) | iem | band | mono | false |
| `iem_mono_wireless_foh` | IEM MONO wireless (provided by FOH) | iem | foh | mono | true |
| `iem_mono_wireless_own` | IEM MONO wireless (own) | iem | band | mono | true |
| `iem_stereo_wired_foh` | IEM STEREO wired (provided by FOH) | iem | foh | stereo | false |
| `iem_stereo_wired_own` | IEM STEREO wired (own) | iem | band | stereo | false |
| `iem_stereo_wireless_foh` | IEM STEREO wireless (provided by FOH) | iem | foh | stereo | true |
| `iem_stereo_wireless_own` | IEM STEREO wireless (own) | iem | band | stereo | true |
| `wedge_foh` | Wedge monitor (provided by FOH) | wedge | foh | — | — |
| `wedge_own` | Wedge monitor (own) | wedge | band | — | — |

Původních pět souborů se odstraní; jejich ID nadále fungují přes aliasy.

### Zpětná kompatibilita

Do `PRESET_ID_ALIASES` v `src/domain/model/presetAliases.ts` přibude pět záznamů mapujících stará ID na variantu `_foh`:

```
iem_mono_wired      → iem_mono_wired_foh
iem_mono_wireless   → iem_mono_wireless_foh
iem_stereo_wired    → iem_stereo_wired_foh
iem_stereo_wireless → iem_stereo_wireless_foh
wedge               → wedge_foh
```

Volba `_foh` jako cíle aliasu odpovídá dosavadnímu významu — dosavadní presety popisovaly vybavení bez určení dodavatele a v praxi šlo o vybavení pořadatele.

Alias se aplikuje v `getPreset` (`src/infra/storage/catalogRepository.ts`), takže pipeline i uložené projekty projdou bez zásahu do dat na disku.

### Odstranění hádání typu z názvu

Dvě místa dnes odvozují druh odposlechu porovnáním řetězce:

**`src/domain/pipeline/buildDocument.ts`** — `monitorEntity.id === "wedge"` nahradí čtení `monitorEntity.kind`. Přímočaré.

**`src/domain/rules/presetOverride.ts`** — `getRequiredMonitorMixCount` má k dispozici jen `monitorRef` jako řetězec, bez katalogu. Testovat `startsWith("wedge")` by tutéž křehkost jen přesunulo. Funkce a její volající `validateEffectivePresets` a `summarizeEffectivePresetValidation` proto dostanou index `Record<string, Monitor>` a `kind` budou číst z katalogu. Je to zásah do signatur mimo monitorovou agendu, ale odstraňuje poslední místo, kde doména odvozuje typ z názvu.

### Testy

- Aktualizace `presetOverride.test.ts` na nové signatury a ID.
- Jednotkový test aliasů — každé staré ID vede na existující preset.
- Test, že `getRequiredMonitorMixCount` vrací 0 pro obě wedge varianty a 1 pro všechny IEM varianty.

---

## C. Poznámky pod tabulkou odposlechů

### Podmínky

`NoteCondition` je dnes jediný tvar `{ monitors: { hasWedge: true } }`. Rozšiřuje se na volitelné příznaky:

```ts
export type NoteCondition = {
  monitors: {
    hasWedge?: true;
    hasBandSuppliedIem?: true;
    hasFohSuppliedIem?: true;
  };
};
```

Aby je bylo z čeho vyhodnotit, položky `DocumentViewModel.monitors` dostanou pole `supplier`.

Poznámka se zobrazí, jsou-li splněny všechny uvedené příznaky. Obě IEM podmínky mohou nastat současně — kapela se smíšeným vybavením dostane obě poznámky.

Vyhodnocení se přepíše v `filterNotesMonitors` (`src/domain/pipeline/pdf/buildPdfNotes.ts`). Současná podoba testuje jediný příznak a jinak propadá na `return false`, takže by nová podmínka poznámku tiše skryla. Nová podoba vyhodnotí konjunkci všech uvedených příznaků a poznámku bez `when` propustí. `buildPdfNotes` proto místo dnešního `hasWedge: boolean` přijme celý kontext:

```ts
type MonitorNoteContext = {
  hasWedge: boolean;
  hasBandSuppliedIem: boolean;
  hasFohSuppliedIem: boolean;
};
```

Kontext sestaví `buildDocument.ts` z `monitors`, tedy na místě, kde dnes počítá `hasWedge`.

### Texty

Do šablony `notes_default_cs` přibudou dvě položky v sekci `monitors`:

| id | podmínka | text |
|---|---|---|
| `band_supplied_iem` | `hasBandSuppliedIem` | Členové kapely používající vlastní IEM požadují pouze monitorový send z pultu; sluchátka a vysílače/přijímače si zajišťuje kapela. |
| `foh_supplied_iem` | `hasFohSuppliedIem` | Pro členy kapely bez vlastního IEM požadujeme zajištění kompletní IEM sady ze strany pořadatele. |

### Doplnění šablony u existujících instalací

Šablona poznámek žije v uživatelských datech (`%APPDATA%/StagePilot/catalog/templates/notes/`) a `bootstrapSeed` existující soubor záměrně nepřepisuje. Nové poznámky by se u již nainstalované aplikace samy neobjevily.

Řešení stojí na verzování šablony. Výchozí šablona (`src/infra/storage/defaultNotesTemplate.notes_default_cs.json`) ponese pole `version` a každá její položka pole `since` s číslem verze, ve které byla přidána. Soubor v APPDATA nese `version` naposledy aplikované verze; soubor bez pole se považuje za verzi 0.

Při startu se doplní právě ty položky výchozí šablony, jejichž `since` je vyšší než `version` souboru v APPDATA. Poté se `version` v souboru zvýší na verzi výchozí šablony.

Z toho plyne požadované chování:

- Položka přidaná v nové verzi se doplní i do existující instalace.
- Text upravený uživatelem se nikdy nepřepíše — sloučení nikdy nesahá na položku, která už v souboru je.
- Položka, kterou uživatel smazal, se nevrátí, protože její `since` už není vyšší než `version` souboru.
- Opakovaný start nic nemění; po prvním sloučení se `version` rovnají.

Obě nové poznámky dostanou `since` odpovídající nové verzi šablony, stávající tři položky `since: 0`.

### Testy

- Jednotkové na `filterNotesMonitors` — kapela jen s vlastním IEM, jen s FOH IEM, se smíšeným vybavením, jen s wedge; poznámka bez `when` projde vždy; poznámka s nesplněnou podmínkou se skryje.
- Jednotkové na slučovací funkci šablony — doplnění položky z nové verze, zachování textu upraveného uživatelem, nevrácení smazané položky, idempotence, chování při souboru bez `version`.

---

## D. Výběr odposlechu v UI

### Dvě osy místo jedné

`MonitoringEditor` (`packages/desktop/src/components/setup/MonitoringEditor.tsx`) dnes nabízí jeden rozbalovací seznam. S deseti presety by uživatel musel číst dlouhé popisky a abecední řazení by rozházelo dvojice. Návrh rozděluje volbu na dvě nezávislá rozhodnutí:

```
Monitoring
┌─────────────────────────────┐
│ IEM STEREO wired         ▾ │   ← 5 typů
└─────────────────────────────┘
┌──────────────┬──────────────┐
│ ● Vlastní    │  Pořadatel   │   ← supplier
└──────────────┴──────────────┘
☑ Additional wedge monitor  − 1 +
```

Dodavatel je vidět bez otevření seznamu a přepnutí je jeden klik.

### Chování

Komponenta si z katalogu postaví index `(kind, mode, wireless) → { band: id, foh: id }`. Cílové ID se **nikdy neskládá spojováním řetězců** — vždy se vyhledá existující preset v katalogu.

- Změna typu zachová zvoleného dodavatele.
- Změna dodavatele zachová zvolený typ.
- Pokud by kombinace v katalogu chyběla, přepínač je pro tuto variantu nedostupný. Při plném katalogu deseti presetů nenastane; je to pojistka proti neúplnému katalogu, ne očekávaný stav.

Uložený tvar se nemění — `monitorRef` v projektu zůstává jeden řetězec. Rozdělení na dvě osy je čistě projekce v UI.

Prop `monitorOptions` proto ponese celé entity `Monitor` místo dnešních dvojic `{ value, label }`.

### Alias v UI vrstvě

`monitorOptions` se dnes staví přímo z `presetCatalog`, tedy mimo `getPreset`, kde se aliasy aplikují. Uložený projekt se starým `monitorRef` by neodpovídal žádné položce, spadl by do větve `hasCurrentMonitorOption === false` a zobrazil by se jako „No monitor selected" — tichá ztráta nastavení. Rozlišení aliasu proto musí proběhnout i na této cestě, při načtení `monitorRef` do stavu komponenty.

### Popisky

Přepínač je česky (`Vlastní` / `Pořadatel`), protože UI aplikace je česká. Popisky presetů v katalogu zůstávají anglické, protože jdou do PDF, které je anglicko-české a dosud tuto konvenci drží.

### Testy

- Rozšíření `MonitoringEditor.test.tsx` — změna typu drží dodavatele, změna dodavatele drží typ, starý `monitorRef` se rozliší aliasem a neztratí se.

---

## Rizika

**Změna signatur ve validaci přesetů.** Předání katalogu do `validateEffectivePresets` a `summarizeEffectivePresetValidation` zasahuje volající mimo monitorovou agendu. Rozsah je nutné ověřit před zahájením prací; pokud by byl širší, než se čeká, je to samostatný commit před zbytkem sekce B.

**Uživatelská data.** Doplňování šablony poznámek zapisuje do APPDATA. Musí být idempotentní a nikdy nepřepsat existující text položky.

**Tisková plocha.** Dvě nové poznámky prodlužují obsah pod tabulkou odposlechů. Renderer podle CLAUDE.md při přetečení A4 vyhazuje výjimku — po implementaci sekce C je nutné projet PDF smoke testy na kapele se smíšeným vybavením, kde se obě poznámky zobrazí současně.

## Mimo rozsah

- Sloupec „dodává" v tabulce odposlechů. Zvažován, zamítnut kvůli riziku přetečení A4.
- Rozšíření `additionalWedgeCount` o vlastního dodavatele. Doplňkové wedge se řídí presetem hlavního odposlechu.
- Editace katalogu presetů za běhu aplikace.
