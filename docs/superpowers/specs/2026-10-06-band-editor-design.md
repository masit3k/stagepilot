---
type: Design
title: "Editor kapely v Library — založení a úprava kapely nad reálným schématem"
description: "Návrh prvního kroku uživatelského katalogu: založení a úprava kapely (název, zkratka, sestava, kapelník, lead vokály, kontakt) s čistou doménou v TypeScriptu, Rustem jen jako souborovým systémem a odstraněním mrtvého lešení Library."
tags: [library, bands, user-catalog, appdata]
generated:
  by: claude/fable-5-1
  at: 2026-10-06T00:00:00+02:00
status: stable
audience: [developers, agents]
---
# Editor kapely v Library — založení a úprava kapely nad reálným schématem

**Fáze:** Uživatelský katalog, krok 1 (kapely)
**Datum:** 2026-10-06
**Předchůdci:** F2 (`/superpowers/specs/2026-08-12-components-and-interaction-design.md`, prázdné stavy a toasty), F3 (`/superpowers/specs/2026-08-12-shell-and-information-architecture-design.md`, navigace `Projects / Library / Settings`), F7 (`/superpowers/specs/2026-08-15-print-box-sized-by-text-and-header-contact-design.md`, kontakt v hlavičce PDF)
**Následníci:** editor muzikanta (vlastní spec), mazání kapel (vlastní spec)
**Stav:** schváleno k plánování

## Kontext

Aplikace jde k uživatelům, kteří nemají autorovy kapely. Potřebují si muzikanty a kapely
založit v aplikaci a z nich skládat projekty. Data zůstávají jen lokálně v uživatelské
složce, bez serveru.

Průzkum repa a APPDATA (6. 10. 2026) ukázal, že **otázka „kam ukládat" je už vyřešená**:

- Muzikanti a kapely jsou uživatelská data v `%APPDATA%/StagePilot/catalog/` (`bands/`,
  `musicians/<role>/`, `contacts/`, `templates/`). V `data/assets/` jsou jen presety,
  katalog vstupů a blueprint bicích. Čistá instalace začíná bez kapel a muzikantů; seed
  zapíše jen šablonu poznámek (`storage_paths.rs`, `seed_catalog`).
- Rust vrstva umí atomický zápis (`atomic_write_bytes`) a sanitaci id na název souboru
  (`sanitize_id_to_filename`).
- V aplikaci existuje sekce Library se stránkami Bands, Musicians, Instruments, Contacts,
  Messages a sedmnácti Tauri příkazy `*_library_*`. Je to **mrtvé lešení**: Rust typ
  `LibraryMusician` je `{id, name, gender, default_roles, notes}`, zatímco skutečný soubor má
  `firstName, lastName, group, presets, requirements`; `LibraryBand` vyžaduje
  `members/contacts/messages`, které reálné kapely nemají, a chyba načtení se tiše polyká
  (`LibraryPages.tsx`, `.catch(() => undefined)`). Nové muzikanty generuje s UUID místo
  slugu. Nic z toho nemá test.
- Presety jsou jen pro čtení a `/architecture/pdf-rendering-pipeline.md` výslovně říká,
  že jejich editace za běhu potřebuje vlastní návrh.

Skutečná práce je tedy **funkční editor nad reálným schématem** a náhrada lešení.
Uživatel zvolil začít kapelou a celé staré lešení vyhodit a postavit načisto.

### Co se nemění

- Tvar souboru kapely, muzikanta a kontaktu. Nic nového do `types.ts` kromě zvednutí
  typu `Contact` z `exportPdf.ts`.
- Příkazy `list_bands` a `get_band_setup_data`, na kterých stojí založení projektu.
- Presety zůstávají přibalené a jen pro čtení.
- `update_musician_defaults` a „Save as musician default" na `02 INPUTS`.

## Cíl

Uživatel na čisté instalaci (poté, co bude mít muzikanty) založí kapelu s názvem,
zkratkou, sestavou, kapelníkem, lead vokály a kontaktem, aniž by sáhl do JSON, a
z této kapely vznikne projekt a PDF. Stejným formulářem kapelu později upraví.

## Rozhodnutí

### R1 — Kapela jako obálka: sestava jen z existujících muzikantů

Formulář vybírá kapelníka, kontakt i sestavu jen z muzikantů, kteří už v katalogu jsou.
Bez muzikantů se kapela uloží jen s názvem a zkratkou a sestava se doplní, až vznikne
editor muzikanta. Rychlé založení muzikanta zevnitř formuláře kapely **není** součástí;
muzikant bez presetů by dal v PDF prázdný řádek a tahal by sem půlku editoru muzikanta.

Proveditelné bez zásahu do domény: kapelník se vynucuje až při stavbě dokumentu
(`src/domain/rules/validateBandLeader.ts`) a v setupu projektu, `catalogRepository`
kapelu bez kapelníka načte.

### R2 — Kontakt je člen kapely plus telefon a e-mail

Kontakt je volitelný. Když je zvolen, je to jeden z muzikantů v sestavě (výchozí
kapelník) plus telefon a e-mail, z nichž **aspoň jedno je povinné**. Uloží se jako
`contacts/<musicianId>.json` ve tvaru `{ id, firstName, lastName, phone?, email? }`
se jménem převzatým z muzikanta. Do kapely jde `defaultContactId`.

Pokud `contacts/<musicianId>.json` už existuje (muzikant je kontaktem jiné kapely),
formulář ho načte a uložení ho přepíše. Je to **sdílený záznam** bez vlastníka.
Kontakt mimo kapelu (manažer) se dá doplnit později rozšířením, ne jinou entitou.

### R3 — Doména v TypeScriptu, Rust jen jako souborový systém

Pravidla kapely žijí v čisté doméně `src/domain/band/` a jsou pod vitestem. Rust
dostane tenké příkazy, které pracují se `serde_json::Value`, ověří jen
parsovatelnost a bezpečné jméno souboru a zapíší atomicky. Žádné serde typy entit.

Proč ne Rust: pravidla pro sestavu a vokály už doména má (`bandLineup.ts`) a
pipeline je používá; druhá kopie v Rustu je přesně to, co dnešní lešení zabilo
(nesoulad serde typů s reálnými soubory). Hybrid s dvojí validací byl zamítnut.

### R4 — id je slug z názvu, vzniká jednou a je neměnné

`id` vzniká při založení jako slug názvu: malá písmena, bez diakritiky, nealfanumerické
znaky na `_`, sloučené, oříznuté, max 50 znaků. Dnešní `toIdSlug` z
`packages/desktop/src/app/pages/shared/projectHubUtils.ts` se **přesune do domény** jako
`src/domain/ids/slug.ts` (`toIdSlug`), `src/domain/band/bandId.ts` ho obalí jako
`deriveBandId(name)` a UI importuje z domény, aby pravidlo bylo jedno.

Po založení se id nemění ani při přejmenování, protože projekty odkazují přes
`bandRef`. Kolize s existující kapelou je chyba „kapela s tímto názvem už existuje",
bez automatických přípon.

### R5 — Zkratka se dopočítává, dokud do ní uživatel nesáhne

`code`:
- víceslovný název → iniciály bez diakritiky velkými písmeny (`Big Night Band` → `BNB`,
  `Blanická kapela` → `BK`), nejvýš 6 znaků;
- jednoslovný název → první tři písmena (`Metallica` → `MET`);
- dopočítává se živě z názvu, dokud uživatel pole sám needituje; pak zůstává ruční;
- po normalizaci (velká písmena, bez diakritiky a mezer) musí odpovídat `[A-Z0-9]{2,6}`;
- musí být **unikátní bez ohledu na velikost písmen**, protože `catalogRepository`
  mapuje `code.toLowerCase()` jako alias odkazu na kapelu;
- jde do názvu PDF souboru (`formatProjectSlug`: `BNB_Inputlist_Stageplan_…`).

### R6 — Sestava: pět skupin, muzikanti jen ze své skupiny

`defaultLineup` má skupiny `drums, bass, guitar, keys, vocs`, v každé 0 až N muzikantů.
Výběr nabízí jen muzikanty dané skupiny (podle `musician.group`), stejně jako editor
projektu. Platí stávající pravidla z `bandLineup.ts`: bez duplicit, muzikant nejvýš
v jedné skupině. Skupina `talkback` se v sestavě nenabízí.

### R7 — Kapelník povinný, jakmile je sestava neprázdná

`bandLeader` musí být člen sestavy. Při prázdné sestavě se kapela uloží bez kapelníka
a v seznamu nese štítek „neúplná". Zapisuje se do `bandLeader` i `bandLeaderId`, jak to
dělá `normalizeBandToCanonicalShape`, protože `get_band_setup_data` čte
`bandLeaderId` jako první. `defaultTalkbackOwnerId` formulář nenabízí; normalizace ho
doplní kapelníkem.

### R8 — Lead vokály ručně, back vokály odvozené

`defaultOverlays.leadVocals` vybírá uživatel zaškrtáváním mezi členy sestavy,
předvyplněno skupinou `vocs`. `backVocals` se **nevyplňují ručně**: při uložení se
dopočítají `deriveVocalOverlaysFromLineup` (všichni členové se zpěvovou schopností
mimo leady), s predikátem `canSing` z `resolveMusicianHasVocalCapability` nad
katalogem presetů. Tím zůstane tvar souboru stejný jako u existujících kapel a
`validateDefaultVocals` projde.

Důsledek: `backVocals` v souboru kapely jsou snímek z doby uložení. Projekt si je
stejně přepočítává při otevření, takže zastarání kapely neovlivní dokument.

### R9 — Jeden vstupní bod domény vrací diskriminovanou unii, nevyhazuje

`buildBandFromDraft(draft, context)` v `src/domain/band/buildBandFromDraft.ts`:

- vstup `BandDraft`: `name, code, bandLeaderId?, lineup (Partial<Record<Group, string[]>>),
  leadVocalIds, contact?: { musicianId, phone?, email? }`, plus `existingId?` pro úpravu;
- kontext: `existingBandIds, existingCodes (lowercase), musiciansById, canSing`;
- výstup `{ ok: true; band: Band; contact?: Contact } | { ok: false; errors: BandDraftError[] }`,
  kde každá chyba nese `field` (`name | code | lineup | bandLeader | leadVocals | contact`)
  a `message`;
- uvnitř `normalizeBandToCanonicalShape`, `validateCanonicalBandModel`,
  `deriveVocalOverlaysFromLineup`; jejich výjimky se převádí na chyby polí.

Formulář potřebuje chyby zobrazit u polí, ne spadnout; proto unie a ne `throw`.

### R10 — Tauri příkazy

| Příkaz | Vstup | Výstup / chování | Kód chyby |
|---|---|---|---|
| `list_catalog_musicians` | — | `Value[]` ze všech `catalog/musicians/<role>/*.json`; jeden rozbitý soubor = chyba s cestou | `MUSICIAN_LIST_FAILED` |
| `list_presets` | — | `Value[]` presetů z assets stejným loaderem jako `get_band_setup_data` | `PRESET_LIST_FAILED` |
| `read_band` | `bandId` | `Value \| null` | `BAND_READ_FAILED` |
| `read_contact` | `contactId` | `Value \| null` | `CONTACT_READ_FAILED` |
| `write_band` | `bandId, json, expectNew` | ověří `sanitize_id_to_filename(bandId) == bandId` a `json.id == bandId`; při `expectNew` odmítne existující soubor; `atomic_write_bytes` do `catalog/bands/<id>.json` | `BAND_WRITE_FAILED`, `BAND_EXISTS` |
| `write_contact` | `contactId, json` | totéž bez `expectNew`, do `catalog/contacts/<id>.json` | `CONTACT_WRITE_FAILED` |

`list_presets` dědí známý defekt zabalené aplikace (`resolve_workspace_root` staví
cestu z `CARGO_MANIFEST_DIR`); tento spec ho neřeší, budoucí oprava pokryje obě cesty.

### R11 — Desktop volá příkazy jen přes `bandsApi.ts`

`packages/desktop/src/app/services/bandsApi.ts` s typovanými obálkami přes
`tauriCommands.ts`, podle vzoru `projectsApi.ts`. Uložení je jedna funkce
`saveBandDraft`: doména postaví entitu; při chybách se nic nezapíše; jinak se zapíše
**nejdřív kontakt, potom kapela**, aby kapela nikdy neodkazovala na kontakt, který na
disku není. Stránky `invoke` přímo nevolají.

### R12 — Obrazovky

- **`/library` = seznam kapel.** S jedinou entitou nemá rozcestník smysl; stránka
  Musicians si při svém specu přidá vlastní záložku. Seznam ukazuje název, zkratku,
  počet členů a štítek „neúplná" (bez sestavy nebo bez kapelníka). Prázdný stav přes
  `EmptyState` („No bands yet" + akce „New band") podle R3 specu F2. Tlačítko „New band"
  v hlavičce.
- **`/library/bands/new` a `/library/bands/:id` = jeden formulář** pro založení i
  úpravu, jedna stránka bez průvodce, `registerNavigationGuard` na neuložené změny.
- **Bloky formuláře shora dolů:**
  1. *Identita*: Název; Zkratka s nápovědou „derived from name", která zmizí po ručním
     zásahu. U existující kapely je id jen zobrazené.
  2. *Sestava*: pět řádků skupin ve stylu řádků `01 LINEUP`; vybraní muzikanti
     s odebráním a akce „Add", která otevře výběr muzikantů dané skupiny mimo sestavu
     (`AddMusiciansMultiSelect`, pokud při plánu projde jeho rozhraní; jinak nová malá
     komponenta). Bez muzikantů v katalogu `EmptyState` „No musicians in your library
     yet" bez akce.
  3. *Role*: Kapelník jako select nad členy sestavy; Lead vocals jako zaškrtávátka nad
     členy sestavy. Člen odebraný ze sestavy z obou mizí.
  4. *Kontakt*: přepínač „no contact / band member"; při členu select (výchozí
     kapelník) a pole phone, email. Při výběru člena se načte existující kontakt.
- **Uložení**: chyby u polí; po úspěchu toast „Band saved" a u nové kapely přesměrování
  na `/library/bands/:id`, aby další uložení bylo úpravou.
- Jazyk rozhraní anglicky (F6), stejně jako zbytek aplikace.

### R13 — Chybové stavy

- *Validace z domény* (u polí): prázdný název; id koliduje s existující kapelou;
  zkratka mimo `[A-Z0-9]{2,6}` nebo duplicitní; kapelník chybí při neprázdné sestavě
  nebo není v sestavě; lead vokál mimo sestavu; kontakt mimo sestavu; kontakt bez
  telefonu i e-mailu; muzikant ve dvou skupinách.
- *Načtení*: rozbitý soubor muzikanta nebo kapely přeruší načtení formuláře s cestou
  k souboru v toastu. Žádné tiché polykání.
- *Zápis*: `BAND_EXISTS` (souběh dvou oken) → chyba zpět do formuláře, nic se nepřepíše.
  Když se zapíše kontakt a kapela selže, kontakt zůstane (sdílený záznam bez vlastníka)
  a toast to řekne.
- Rust vrací stávající `ApiError { code, message }`.

### R14 — Mazání kapel není součástí

Vyžaduje kontrolu odkazů z projektů (`bandRef`) a rozhodnutí, co s nimi. Vlastní spec.
`notesTemplateRef` a `logoFile` formulář nenabízí.

### R15 — Staré lešení Library se maže celé

- `packages/desktop/src/app/pages/components/library/` celá (`LibraryPages.tsx`,
  `LibraryEntityCrud.tsx`, `LibrarySimpleEntityPage.tsx`).
- Routy `library-musicians`, `library-instruments`, `library-contacts`,
  `library-messages` v `routes.ts`; `LibraryHomePage` v `src/pages/ShellPages.tsx`
  nahradí seznam kapel.
- Typy `LibraryBand`, `LibraryBandMember`, `LibraryContact`, `LibraryMessage`,
  `LibraryMusician` v `app/shell/types.ts`.
- V `lib.rs` všech sedmnáct příkazů `*_library_*` (bands, musicians, instruments,
  contacts, messages), struktury `Library*` a pomocné `load_library_list`,
  `save_library_list`, `entity_name`, pokud po smazání nemají jiného uživatele.
  `update_musician_defaults` s `load_library_map`/`save_library_map` **zůstává**.
- CSS jen to, co po smazání nemá žádného uživatele (`.form-grid` a podobné ověřit grepem).

Plán si konečný výčet ověří grepem proti repu, ne proti tomuto seznamu.

## Vrstvy

| Vrstva | Soubory | Odpovědnost |
|---|---|---|
| `src/domain/ids/` | `slug.ts` | `toIdSlug` přesunutý z UI |
| `src/domain/band/` | `bandId.ts`, `bandCode.ts`, `buildBandFromDraft.ts` | id kapely, zkratka, stavba kanonické kapely a kontaktu, chyby polí |
| `src/domain/model/types.ts` | `Contact` | zvednutý typ z `exportPdf.ts` |
| `packages/desktop/src-tauri/src/lib.rs` | šest příkazů z R10 | čtení a atomický zápis JSON, sanitace id |
| `packages/desktop/src/app/services/` | `tauriCommands.ts`, `bandsApi.ts` | typované obálky, `saveBandDraft` |
| `packages/desktop/src/app/pages/` | `LibraryBandsPage.tsx`, `LibraryBandFormPage.tsx` a komponenty | seznam a formulář |

## Tok dat

```
formulář (BandDraft) ──► buildBandFromDraft(draft, ctx) ──► { ok, band, contact }
      ▲                                                          │
      │ list_catalog_musicians + list_presets (ctx: musicians, canSing)
      │ list_bands (ctx: existingIds, existingCodes)             ▼
      │ read_band + read_contact (úprava)         write_contact ─► write_band
```

## Testy

- **Doména (vitest, těžiště):** `bandCode` (iniciály, jedno slovo, diakritika, číslice,
  ruční normalizace, strop 6 znaků), `bandId` slug (diakritika, mezery, strop 50),
  `buildBandFromDraft` pro každé pravidlo z R13 plus pozitivní případ porovnaný
  s tvarem reálného souboru (fixtura podle `big_night_band.json` v testu, ne čtení
  APPDATA). Odvození `backVocals` přes `canSing` predikát.
- **Desktop:** test `bandsApi.saveBandDraft` na pořadí zápisu kontakt → kapela a na to,
  že chyba domény zápis nevyvolá (mock `invoke`). Stránky bez jsdom testovat nejde;
  ruční průchod podle seznamu níže.
- **Rust:** unit testy pro `write_band` (odmítnutí nesanitizovaného id, nesouladu id,
  `expectNew` nad existujícím souborem) nad temp adresářem podle vzoru testů
  v `storage_paths.rs`.
- **Smoke:** po založení testovací kapely projde `npm run cli:dev -- --project <id>`
  nad projektem, který na ni odkazuje. To je důkaz, že Node pipeline soubor z nového
  editoru přijme.

### Ruční průchod v `npm run dev`

1. `/library` bez kapel → prázdný stav s akcí; s kapelami → seznam se štítkem „neúplná".
2. Nová kapela: zkratka se dopočítává z názvu, po ručním zásahu přestane.
3. Sestava: přidání muzikanta dané skupiny, odebrání; odebraný mizí z kapelníka i lead vokálů.
4. Kontakt: výběr člena načte existující telefon a e-mail; uložení bez obojího je chyba u pole.
5. Uložení nové kapely přesměruje na `/library/bands/:id`; soubor v `catalog/bands/` má tvar
   jako existující kapely (`bandLeader` i `bandLeaderId`, `defaultOverlays` s oběma poli).
6. Založení projektu nabídne novou kapelu a `01 LINEUP` ji předvyplní.
7. Odchod z rozpracovaného formuláře vyvolá dialog neuložených změn.

## Mimo rozsah

- Editor muzikanta (vlastní spec; tam i úklid `update_musician_defaults` a klíče `id:role`).
- Mazání a duplikace kapel.
- Vlastní presety uživatele.
- Oprava `resolve_workspace_root` pro zabalenou aplikaci.
- Kontakt mimo kapelu.
