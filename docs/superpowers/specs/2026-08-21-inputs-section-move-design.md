# Přesun sekce Inputs na `02`, srovnání doménových řezů a dokončení Tasku 19

**Fáze:** F5d
**Datum:** 2026-08-21
**Předchůdci:** F5c (`2026-08-17-inputs-screen-design.md`), F5a (`2026-08-13-stageplan-editor-and-layout-model-design.md`), F3 (`2026-08-12-shell-and-information-architecture-design.md`), F7 (`2026-08-15-print-box-sized-by-text-and-header-contact-design.md`)
**Stav:** schváleno k implementaci

## Kontext

F5c postavila obrazovku `02 INPUTS` — editor kanálů, monitorů a poznámek — a uzavřela se
se **čtyřmi vědomě otevřenými položkami** (spec F5c, sekce „Stav implementace"). Hlavní z nich
je bod 3: Task 19 (smazání starého setup modálu z obrazovky `01 LINEUP`) se zastavil na vlastní
bráně dřív, než cokoli smazal, protože modál nese **sekci Inputs** — dropdown typu zapojení pro
basu, kytaru a klávesy, typ mikrofonu lead vocals a doplňkové toggly
(`ProjectSetupPage.tsx:2144-2172` a `2262-2305`) — a ta na `02` nemá domov. R16 zůstal nesplněný
a bicí souprava má dvojí editor s neslučitelným zápisem (bod 4).

**Ty čtyři položky jsou rozhodnutí uživatele, na která tato fáze odpovídá. Nejsou to nálezy
k triáži ani vady k opravě.** F5d je nemá znovu vyhodnocovat, má je uzavřít.

F5d slučuje tři věci, které spolu drží: přesun sekce Inputs na `02`, srovnání toho, co doména
u jednotlivých řezů skutečně čte, a dokončení Tasku 19.

### Pořadí kroků je vynucené, ne libovolné

| Krok | Co |
|---|---|
| **A** | Katalog vstupů se derivuje z presetů (R1) |
| **B** | Srovnání doménových řezů — vlna 1 (R2, R3) |
| **C** | Sekce Inputs jako modál z inspektoru na `02`, `+ Add input` se ruší (R4, R5) |
| **D** | Dokončení Tasku 19 — smazání modálu z `01` (R6) |
| **vlna 2** | Overlays z `02`, oprava osiřelého monitor mixu (R7) — oddělitelný poslední krok |

Bez kroku A mluví sekce Inputs (klíče z presetů) a `+ Add input` (klíče z `GROUP_INPUT_LIBRARY`)
o týchž kanálech dvěma jazyky. Krok D potřebuje krok C, protože jinak nemá kam přestěhovat
devátou akci modálu. Vlna 2 je uříznutelná: kdyby se fáze musela zkrátit, řízne se právě tam
a F5d zůstane celá.

### Doklady z měření

Měření proběhlo před psaním specu, nad reálnými daty z `%APPDATA%/StagePilot` a nad
`data/assets/`. Několik z nich vyvrátilo premisu, na které stojí handoff i spec F5c — proto
jsou tady vypsané a proto se na ně rozhodnutí odkazují jmenovitě.

**Terminologie — oprava.** `addKeys` v repu **neexistuje** (grep, 0 výskytů). Operace
`PresetOverridePatch.inputs` jsou `add`, `remove`, `replace`, `removeKeys` (legacy alias pro
`remove`) a `update` — `src/domain/model/types.ts:343-348`. Handoff i spec F5c mluví
o `addKeys`; ve F5d a všude dál se používá `add`/`removeKeys`.

**Klíče — oprava premisy.** `el_guitar_mic`, `el_guitar_xlr_mono`, `el_guitar_xlr_stereo`
a `ac_guitar` **nejsou channel keys, ale ID presetů** (soubory v
`data/assets/presets/groups/guitar/`). Skutečné `InputChannel.key` v nich jsou `el_guitar_mic`,
`el_guitar_xlr`, `el_guitar_xlr_l`, `el_guitar_xlr_r`, `ac_guitar`. Premisa „schéma a katalog
používají dvě sady klíčů pro tytéž kanály" tedy **neplatí tak, jak je zapsaná**:
`gtr_mic`/`gtr_di` je osamocená UI konstanta bez opory v datech — jediné místo v repu je
`packages/desktop/src/app/pages/shared/setupConstants.ts:58-59` — ne konkurenční schéma.
Není co mapovat, je co smazat.

**M1 — `BandSetupData.presetCatalog` nese celé presety včetně `inputs[]` s klíči.**
`packages/desktop/src/app/services/projectsApi.ts:46` → Tauri command `get_band_setup_data`
(`packages/desktop/src-tauri/src/lib.rs:891` a `:1112-1137`) vkládá parsovaný soubor verbatim.
Obrazovka `02` katalog už dnes používá (`ProjectInputsPage.tsx:411`). Derivace z presetů tedy
**nevyžaduje žádnou změnu datové vrstvy.**

Úplný seznam input keys v `data/assets/`: `ac_guitar`, `bass_synth`, `el_bass_mic`,
`el_bass_xlr_amp`, `el_bass_xlr_pedalboard`, `el_guitar_mic`, `el_guitar_xlr`,
`el_guitar_xlr_l`, `el_guitar_xlr_r`, `keys`, `keys_l`, `keys_r`, `voc_input`. `gtr_mic`
a `gtr_di` tam nejsou. `voc_lead`/`voc_back` z `GROUP_INPUT_LIBRARY.vocs`
(`setupConstants.ts:66-69`) tam taky nejsou — všechny tři vokální presety mají jediný klíč
`voc_input`; je to táž vada o řádek níž a dnes neškodí jen proto, že `vocs` jsou z pickeru
vyloučené. Mono keys preset má klíč `keys`, který dnešní katalog vůbec nenabízí (nabízí jen
`keys_l`/`keys_r`).

**Sekce Inputs pokrývá celý prostor klíčů pro tři role** (doklad pro R5):

| Role | Pole sekce Inputs | Klíče, které umí vyrobit |
|---|---|---|
| bass | Connection + Mic on cabinet + Bass synth | `el_bass_xlr_amp`, `el_bass_xlr_pedalboard`, `el_bass_mic`, `bass_synth` |
| guitar | Connection + Mic on cabinet + Acoustic guitar | `el_guitar_mic`, `el_guitar_xlr`, `el_guitar_xlr_l`, `el_guitar_xlr_r`, `ac_guitar` |
| keys | Connection + Keys units | `keys`, `keys_l`, `keys_r` |

**M2 — `gtr_mic` přidaný přes `inputs.add` projde do PDF správně, ale rozbije setup UI.**
Měřeno nad reálným projektem `FNB_Inputlist_Stageplan_22-08-2026_Zamek-Bon-Repos.json`: řádek
se objeví s `group: "guitar"`, `ownerRole: "guitar"`, ve stageplanu pod kytarovým blokem. Ale
`resolveLineupInstrumentMembership(["gtr_mic"])` vrátí `hasElectricGuitarCapability: false`
a kytarista přestane být kytaristou — se samotným `gtr_mic` sekce guitar na `01` zmizí celá.
Kořen je chybějící `group` fallback u kytary (viz R1). U keys je táž past nachystaná: mono klíč
`keys` neprojde `startsWith("keys_")` a drží ho jen ten fallback.

**M3 — pozůstatkový bookkeeping v uložených datech prakticky neexistuje.** Ve všech 50 JSON
souborech v `%APPDATA%/StagePilot` je **jediný** slot nesoucí `drumDefinition` i neprázdný
`presetOverride.inputs.*` zároveň, a je v archivní verzi z 19. 5. 2026
(`versions/019e4053-2009-7b9d-9299-78eda1e88c62/20260519-130407-312/project.json`,
`lineup.drums[0]`: `removeKeys: ["dr_pad_mono_sfx"]` vedle `drumDefinition.pad.enabled = false`
— totéž řečené dvakrát). `buildDocument` s ním i bez něj dává identický dokument. Band defaults
(`catalog/bands/*.json`) mají `defaultLineup` jako holá pole ID stringů, žádné sloty a žádné
patche; musician defaults nenesou `presetOverride` ani `drumDefinition`. **Migrace uložených dat
tedy není potřeba, stačí zastavit zdroj zápisu.**

**O1 — vokální a talkback řádky vznikají výhradně z `project.overlays` + lineupu.**
`src/domain/pipeline/buildDocument.ts:625-626` → `resolveOverlaySlots` (`:104-121`) →
`resolveCanonicalOverlayAssignments` (`src/domain/project/resolveProjectAudioAssignments.ts:73-81`),
která dedupuje, zachová pořadí pole a odfiltruje id mimo lineup. Klíče `voc_lead_{slot}`
a `voc_back_{ownerRole}_{slot}` se generují v `resolveOverlayDrivenVocalRows`
(`buildDocument.ts:123-168`), talkback `tb_{ownerLineupGroup}` v
`src/domain/pipeline/pdf/buildPdfTalkback.ts:21-66`. **Pořadí pole je jediný zdroj číslování**
a v modálech na `01` se nedá přeřadit (jen Add/Remove). Talkback je jeden na projekt, ne per role.

**O2 — `remove`/`removeKeys` na vokálním i talkback klíči je dnes úplný no-op.** Ověřeno na šesti
variantách patche (`voc_lead_1`, `voc_back_bass_1`, `tb_bass`, `voc_input`, `remove` i
`removeKeys`) — všechny nulový diff. Mechanismus: `narrowPatchToUpdatesFor`
(`buildDocument.ts:216-222`) propustí jen `update` a jen na klíče, které v řezu existují.

**O3 — odebrání z overlay smaže celý řádek a přečísluje zbytek.** Měřeno na
`BK_Inputlist_Stageplan_30-06-2026_Praha.json`: `inputs.length` 24 → 23, zbylý lead vokál se
přejmenoval z `Lead vocal 1 (male)` na `Lead vocal`, `voc_back_bass_1` přečíslován 24 → 23,
ze stage planu zmizel blok `lead_voc_2` a přepočítaly se pozice ostatních. Stav „vypnuto, ale
v tabulce přeškrtnuto" tedy přes overlays nejde a přes patch taky ne — **pro ten stav neexistuje
v modelu reprezentace.** Navíc se rozchází keyspace: default preset vokálního slotu má klíč
`voc_input`, dokument tiskne `voc_lead_1`; UI-preview přitom `remove: ["voc_input"]` uzná
a přeškrtne řádek, který dokument dál tiskne — táž past falešného potvrzení jako u bicích, dnes
zavřená jen bránou `overlay-not-supported`
(`packages/desktop/src/app/domain/inputs/resolveInputRowEditability.ts:59-61`).

**O4 — u vokálů není v R7 co odemykat.** `presetOverride.monitoring` u vokálů dojede až do
`vm.monitors`; brána blokuje **výhradně bicí**
(`packages/desktop/src/app/domain/inputs/resolveMonitorRowEditability.ts:26-35`). Reálná data to
potvrzují — FNB má `lineup.vocs[0].presetOverride.monitoring`. Handoff tvrdí, že vlna 2 uvolní
R7; to je nepřesné a tenhle spec to opravuje: uvolňuje se jen monitoring **bicích** (R3).

**Co u vokálních a talkback řádků funguje přes `update` už dnes:** poznámka u obou; přejmenování
u talkbacku ano, u vokálů ne (formatter ho přepíše, `labelIsCanonical: true`,
`buildDocument.ts:703-750`, UI to respektuje přes `disabled={row.labelIsCanonical}`);
`channel`/`compactGroupKey` u vokálů projde do `vm.inputs`, ale bez druhého řádku se pár nespojí.

## Cíl

Sjednotit editaci vstupů na jedné obrazovce: kanál se přidá a odebere tam, kde vzniká — u svého
vlastníka, volbou zapojení nebo doplňku, ne výběrem z paralelního katalogu. Odstranit tím poslední
zábranu Tasku 19, zavřít dvojí bookkeeping bicí soupravy a srovnat to, co UI nabízí, s tím, co
dokument skutečně čte.

## Rozsah

- **Krok A** — `GROUP_INPUT_LIBRARY` se derivuje z `presetCatalog` (R1) a srovná se asymetrie
  fallbacků v `effectiveInstrumentGroups.ts` (R1).
- **Krok B, vlna 1** — potvrzení zúžení `add`/`removeKeys` u bicích (R2) a odemčení monitoringu
  bicích (R3). Jediné skutečné rozšíření domény v této vlně.
- **Krok C** — sekce Inputs jako modál `Edit inputs` z inspektoru na `02` (R4) a zrušení
  `+ Add input` (R5).
- **Krok D** — dokončení Tasku 19: smazání setup modálu z `01`, navigace karty muzikanta na
  `/inputs`, zánik dvojího bookkeepingu bicí soupravy (R6).
- **Vlna 2** — přidání a odebrání lead/back vokálu a talkbacku z `02`, oprava osiřelého
  vokálního monitor mixu (R7, Nález 1).
- Kontraktní testy UI ↔ dokument pro každou bránu, kterou fáze otevírá nebo zavírá (R8).

## Mimo rozsah

- **Rozdělení `ProjectSetupPage.tsx` na komponenty.** Fáze soubor jen zmenší smazáním modálu
  (dnes 2728 řádků). Restrukturalizace zbytku je samostatná úloha, stejně jako v R16 F5c.
- **R4 z F5c u vokálů** — stereo lead vocal, druhý mikrofon pro jednoho zpěváka. Overlay je
  jeden muzikant = jeden řádek a klíč se generuje ze slotu (O1); zůstává zavřený.
- **Nová reprezentace pro vypnutý vokální řádek.** Stav „zpěvák je v sestavě, ale nemá mikrofon"
  nikdo nepožadoval a v modelu pro něj reprezentace není (O2, O3).
- **Nálezy 2–5** ze sekce „Nálezy nad rámec rozsahu".
- **Přejmenování „Friday Night Band" na „Big Night Band"** ve všech datech včetně id — samostatné
  zadání.
- **Dva projekty `blanicka_kapela`**, které se po F7 nevyexportují kvůli kolizi boxů. Pojistka
  funguje podle návrhu; bloky čekají na přerovnání člověkem v editoru.
- Migrace uložených dat (M3 ukazuje, že není potřeba).

## Rozhodnutí

### R1 — Katalog vstupů se derivuje z presetů, ne z ručně psaného seznamu

`GROUP_INPUT_LIBRARY` (`packages/desktop/src/app/pages/shared/setupConstants.ts:47-70`) přestane
být ručně psaný seznam a odvodí se z `BandSetupData.presetCatalog` pro role `guitar`, `bass`,
`keys` a `vocs`. Zdrojem referencí je **už existující `PRESET_REFS`**
(`setupConstants.ts:72-92`) — táž konstanta, kterou dnes používá `buildSetupFieldCatalog`
(`:94-121`), takže katalog vstupů a katalogy polí sekce Inputs čtou z jednoho seznamu.
Rozlišení ref → preset jde přes `resolvePresetIdAlias`, jak to `buildSetupFieldCatalog` dělá dnes.

- **Drums zůstávají na `resolveDrumInputs(createDefaultDrumDefinition())`** (`setupConstants.ts:48`).
  Je to dnešní stav a jediný řádek katalogu, který si klíče nevymýšlí — vzor pro ostatní.
- **Talkback zůstává po svém.** Jeho preset (`data/assets/presets/groups/talkback/talkback.json`)
  má `type: "talkback_type"` a místo `inputs[]` singulární šablonu s klíčem `tb_{ownerKey}`.
  Derivovat z něj statický kanál nejde a nemá to smysl — řádek staví `buildPdfTalkback` (O1).
- **Pole `group` se u odvozených položek doplní z `preset.group`**, protože `inputs[]` v presetech
  ho nenesou (viz `keys_stereo_xlr.json`, `vocal_wireless.json`). Bez toho by odvozený kanál
  přišel o `group` a spadl do pasti z M2.

Z konstanty se stane funkce `buildGroupInputLibrary(presetCatalog)`. Navázaný
`getGroupDefaultPreset` (`setupConstants.ts:248-252`) dostane katalog parametrem; oba volající
(`packages/desktop/src/app/domain/setup/resolveSetupForSlot.ts:39` a `:59`) ho už mají v args.

**Dvě různé otázky, dvě různé odpovědi.** Dnešní konstanta odpovídá na obě zároveň a je to vada:

1. *Které kanály role vůbec existují?* → union `inputs[]` přes všechny presety role
   z `PRESET_REFS`, deduplikovaný podle `key`, v pořadí referencí. Tohle je „library".
2. *Co dostane hudebník bez jediného presetu?* → `getGroupDefaultPreset` vrátí `inputs[]`
   **prvního** refu role (`el_bass_xlr_amp`, `el_guitar_mic`, `keys_stereo_xlr`,
   `vocal_wireless`), ne union. Union by kytaristovi bez presetu dal mikrofon, DI, stereo pár
   i akustiku současně.

Změna chování `getGroupDefaultPreset`, kterou to přinese, je oprava: bass zůstává na
`el_bass_xlr_amp` (nula změny), keys zůstává na `keys_l` + `keys_r`, guitar se posune
z neexistujících `gtr_mic` + `gtr_di` na `el_guitar_mic`, vocs z neexistujících
`voc_lead` + `voc_back` na `voc_input`. Staré klíče v datech nejsou (M1) a `gtr_mic` navíc rozbíjí
rozpoznání kytaristy (M2), takže dnešní hodnoty nejsou baseline, kterou by šlo chtít zachovat.

**Součástí R1 je srovnání asymetrie v `src/domain/lineup/effectiveInstrumentGroups.ts:32-41`.**
`drums`, `bass`, `keys` i `vocs` mají fallback `|| group === "…"`, řádky pro `electric_guitar`
a `acoustic_guitar` ho jako jediné nemají a jedou čistě na `key.startsWith`. Bez doplnění zůstane
past nachystaná pro každý budoucí klíč mimo prefix — přesně ta, na které M2 uklouzlo.

### R2 — Bicí řez `add`/`removeKeys` číst nezačne

Potvrzuje se zúžení z fixu Tasku 12c; F5d ho **nerozšiřuje**. Důvod: bicí kanály staví výhradně
`drumDefinition` (`src/domain/setup/resolveEffectiveProjectSetup.ts:48-56`), takže přehrání `add`
pro kanál, který už z definice vznikl, narazí na collision guard
(`src/domain/rules/presetOverride.ts:174-176`) a spadne na
`Error: Preset override collision for input key "dr_tom_3"`. To byla Critical 1 z 12c.

R3 a R4 z F5c tedy u bicích vedou přes `Edit kit`, ne přes patch. Zdroj zápisu toho patche mizí
krokem D (R6), takže po F5d nebude co číst ani kdyby se to chtělo.

To zároveň znamená, že brána `drums-not-supported` v `resolveInputRowEditability` **zůstává**.
Odemyká se jen její monitorová sestra (R3).

### R3 — Monitoring bicích se odemkne a nevalidní `monitorRef` hodí chybu

Dnes drums dostávají monitoring natvrdo z `defaultPreset` a `patch.monitoring` se u nich zahazuje
(`resolveEffectiveProjectSetup.ts:81-90`, komentář „Monitoring override reverted (fix round 1,
Important 3)"). Odemčení je **jediné skutečné rozšíření domény ve vlně 1**: bicí slot se
u monitoringu srovná s basou, kytarou a klávesami, a brána `drums-not-supported`
v `resolveMonitorRowEditability` (`:26-35`) padá.

Odemčení vrací do hry throw path `assertMonitorPresetRef`
(`resolveEffectiveProjectSetup.ts:96-101`, definice `:114`), kterou 12c jako Important 3 záměrně
obešel s odůvodněním, že ji nic nechtělo.

**Rozhodnutí: padá, nedegraduje.** Nevalidní `monitorRef` na bicím slotu hodí stejnou chybu jako
na basovém — jedna cesta kódu, ne dvě. Důvody:

1. `CLAUDE.md`: „Errors must be handled explicitly; never silently swallow exceptions." Zbytek
   projektu preferuje explicitní chyby, včetně kolizní pojistky v PDF, která schválně shodí export.
2. Jediná cesta, jak `monitorRef` vzniká, je select nad katalogem monitorů. Nevalidní ref tedy
   znamená ručně editovaná nebo poškozená data, ne uživatelský stav — degradace na výchozí mix by
   vytiskla monitorovou tabulku, kterou nikdo nenastavil, a nikde by to neřekla.
3. Symetrie zjednodušuje bicí větev: po odemčení monitoringu je rozdíl proti ostatním rolím jen
   ve zdroji `inputs`, ne v celém `MusicianSetupPreset`.

Chyba padá v `resolveEffectiveProjectSetup`, tedy uvnitř `buildDocument` — projekt s takovým
refem se neexportuje a řekne proč. To je hlášená chyba, ne tichá vada.

**Vedlejší efekt, který plán musí ošetřit:** zaparkovaný minor z Tasku 19a — odznak `• Modified`
u monitoringu bicího slotu se mohl zobrazit i u skrytého pole. Odemčením se pole přestane skrývat,
takže odznak začne odpovídat skutečnosti; ověřit, že se tak chová.

### R4 — Sekce Inputs žije na `02` jako modál z inspektoru

Po vzoru `Edit kit` (`packages/desktop/src/app/pages/ProjectInputsPage.tsx:1583-1617`). Symetrie
je čitelná: bubeník má v inspektoru `Edit kit`, kytarista dostane `Edit inputs`.

**Proč modál a ne inline v inspektoru:** obojí je destruktivní přepis celé sady kanálů slotu, ne
editace jednoho řádku, a úzký postranní panel tu váhu neukáže. Inspektor dál nese operace na
řádku (rename, note, remove/restore), modály nesou operace na sadě.

Co vzniká:

- `packages/desktop/src/app/components/inputs/InputsSetupSection.tsx` — obal modálu,
  `SchemaRenderer` a katalogy polí.
- Čistá funkce v `packages/desktop/src/app/domain/inputs/`, která ze slotu (role, musicianId,
  patch, `setupData`, `presetCatalog`) odvodí `EventSetupEditState`
  (`{ defaultPreset, effectivePreset, patch }`). Dnes tenhle adaptér existuje jen jako inline
  výraz uvnitř `ProjectSetupPage.tsx:1929-1961` a nikdy nebyl testovaný.

Katalogy polí se **importují beze změny**: `buildBassFields`, `buildGuitarFields`,
`buildKeysFields`, `buildLeadVocsFields`
(`packages/desktop/src/app/components/setup/instruments/`, 443 řádků implementace + 336 řádků
testů). Přepisovat je by znamenalo zahodit hotovou otestovanou logiku a je to zbytečné — čtou
`EventSetupEditState` a vracejí patch, o obrazovku se nezajímají.

**Zásah do `ProjectInputsPage.tsx` má zůstat u 60–100 řádků** (stav modálu, tlačítko v inspektoru,
render). Soubor má dnes 1669 řádků a je druhý největší v desktopu; přesun nesmí být záminka
k jeho dalšímu růstu.

Modál se nabízí pro role `bass`, `guitar`, `keys` a lead vocals — tedy přesně tam, kde katalog
polí existuje. U bicích zůstává `Edit kit`.

### R5 — `+ Add input` se ruší

Sekce Inputs pokrývá **celý** prostor klíčů pro bass, guitar i keys (tabulka v M1) a picker
obsluhuje **právě a jenom tyhle tři role**: `drums` a `vocs` jsou z něj vyloučené branou
a talkback nemá slot (`ProjectInputsPage.tsx:725-753`). Picker nenabízí nic vlastního, jen pevný
seznam. Po kroku A je ten seznam navíc týž jako v presetech, takže dvě cesty ke stejnému výsledku.

Zaniká `packages/desktop/src/app/components/inputs/AddInputPicker.tsx` (144 řádků) a `addInputRow`.
**R4 z F5c se přeformuluje** z „přidání kanálu je dvoukrokový výběr z katalogu" na **„přidání
kanálu je volba zapojení nebo doplňku u jeho vlastníka"**.

**Hlubší důvod, ne jen úspora kódu.** Každý druh kanálu má v modelu jednu strukturovanou
reprezentaci, odkud se bere:

| Druh kanálu | Reprezentace |
|---|---|
| bicí | `drumDefinition` na slotu |
| nástrojové | preset + `presetOverride` |
| vokály, talkback | `ProjectOverlays` (O1) |

`inputs.add`/`removeKeys` **není čtvrtá reprezentace** — je to mechanismus odchylky nad jednou
z nich. Když tentýž kanál umí vzniknout dvěma cestami, přestává být z dat poznatelné, proč tam je.
A přesně na to se ptá půl obrazovky `02`: `DEVIATIONS N`, `Reset to default`, odznak `• Modified`,
přeškrtnutý řádek.

`GROUP_INPUT_LIBRARY` tím **nezaniká** — má druhého konzumenta, `bandDefaults` fallback pro
hudebníka s nula presety (R1, otázka 2).

**Nedestruktivní `rebuild()` byl zvážen a zamítnut.** Pravidlo „zachovej kanály, které nepocházejí
z presetu" zavádí do modelu třetí kategorii kanálů, kterou by musela znát doména, `Reset to
default`, `countOwnerDeviations`, řazení v PDF i validace. Destruktivita dnešního `rebuild`
(`packages/desktop/src/app/components/setup/instruments/guitar/buildGuitarFields.ts:25-33`) je
naopak **správná sémantika**: kytarista, který přepnul z mikrofonu na DI, ten mikrofon na pódiu
nemá.

**Ale destruktivita musí být vidět dopředu, ne až v PDF.** Přepnutí `Connection`, které by zahodilo
kanál nesoucí uživatelskou odchylku — přejmenování nebo poznámku z `presetOverride.inputs.update`
— se **potvrzuje**, s výpisem kanálů, které zmizí, jejich uživatelskými popisky.

Mechanismus, závazný pro plán: kontrola sedí v obalu z R4 (`InputsSetupSection.tsx`), **ne
v katalozích polí**. Obal dostane z `SchemaRenderer` zamýšlený patch, čistou funkcí
v `app/domain/inputs/` spočítá efektivní kanály před a po, vezme rozdíl a proti němu prověří
`patch.inputs.update`. Neprázdný průsečík → potvrzení; prázdný → patch se aplikuje bez dotazu.
Katalogy polí se nemění.

### R6 — Task 19 se dokončí

Z `ProjectSetupPage.tsx` (2728 řádků) se maže `ModalOverlay` s `editingSetup` (`:1921` a dál)
a s ním:

- stav `editingSetup` (`:439`), `setupDraftBySlot` (`:444`), `selectedSetupSlotKey` (`:447`),
  `setupEditorRef` (`:1488`), `setupMusicians` (`:1325`),
- pomocníci `resolveDraftOverride` (`:1184`), `getExistingSlotOverride` (`:1210`),
  `resolveInputsForCapabilitySection` (import `:11`), `areSetupsEqual` (import `:68`).

**Zachovat** `effectiveSlotPresets` (`:1268`) a `overrideValidation` (`:1295`) — validace lineupu
na `01` je jejich jediný konzument a s modálem nesouvisí.

Karta muzikanta místo modálu **naviguje na `/inputs`**. Cíle navigace se berou z
`nextStepPath`/`previousStepPath` v `packages/desktop/src/app/shell/chrome/processSteps.ts` —
zadrátovaná cesta se do stránek nesmí vracet (past 5 z handoffu F5c).

**Tím zmizí dvojí bookkeeping bicí soupravy.** `ProjectSetupPage.tsx:2210-2260` dnes při každé
změně kitu zapisuje `drumDefinition` (`:2229`) **a zároveň** `buildInputsPatchFromTarget(...)`
do `setSetupDraftBySlot` (`:2236-2260`), což skončí jako `presetOverride.inputs.{add, removeKeys}`.
Obrazovka `02` to vědomě nereplikuje (`ProjectInputsPage.tsx:265-294`, `replaceSlotDrumDefinition`).
**Po commitu kroku D nesmí v repu zbýt volací místo `buildInputsPatchFromTarget` z editace kitu.**

Že dva zdroje pravdy dnes žijí, je vidět na `ProjectInputsPage.tsx:191-204`, kde
`countOwnerDeviations` musí `presetOverride` a `drumDefinition` sčítat ručně.

**Migrace uložených dat není potřeba** — M3. Jediný nalezený pozůstatek je v archivní verzi
a dokument je vůči němu lhostejný.

### R7 — Vlna 2: overlays se zpřístupní z `02`, doména se nemění

Přidání a odebrání **lead vokálu, back vokálu i talkbacku** se zpřístupní z obrazovky `02`. Dnes
to jde jen z `01`: `LeadVocsBlock`/`BackVocsBlock` (`ProjectSetupPage.tsx:1625-1633`) →
`ChangeLeadVocsModal`/`ChangeBackVocsModal` (`:2363`, `:2407`), talkback řádek `:1667-1695`.
`ProjectInputsPage.tsx` dnes slovo `overlays` neobsahuje ani jednou.

**Doména se nemění ani o řádek** — overlays už existenci řádků plně řídí (O1, O2).

Součástí vlny 2 je oprava osiřelého vokálního monitor mixu (Nález 1) — jediný nález, který fáze
bere do rozsahu.

**R3 z F5c se pro vokály a talkback výslovně prohlašuje za neplatný.** Odebrání vokalisty je změna
sestavy, ne vypnutí kanálu, a **řádek zmizí** — stejně jako se dnes chová `Change` na `01` (O3).
Důvod: R3 vznikl pro kanály, které existují nezávisle na sestavě (kytarista má mikrofon, i když ho
dnes nepoužije), zatímco vokální řádek existuje právě proto, že je někdo v sestavě. Stav „zpěvák je
v sestavě, ale nemá mikrofon" nikdo nepožadoval a v modelu pro něj reprezentace není (O2, O3).

**R4 z F5c zůstává u vokálů zavřený** — stereo lead vocal ani druhý mikrofon pro jednoho zpěváka
nejdou: overlay je jeden muzikant = jeden řádek a klíč se generuje ze slotu (O1).

Brána `overlay-not-supported` v `resolveInputRowEditability` (`:59-61`) **zůstává** — vlna 2
nepřidává patch cestu, přidává overlay cestu.

**Vlna 2 je oddělitelný poslední krok.** Kdyby se fáze musela zkrátit, řízne se právě tam.

### R8 — jsdom se nezavádí; místo něj kontraktní testy UI ↔ dokument

Vzorec „UI drží stav, který doména nemá" se v F5c objevil **sedmkrát** a ani jednou nešlo o rozbité
zavěšení handleru — vždy o rozjezd dvou zdrojů pravdy. UI-preview
`src/domain/setup/resolveEffectiveMusicianSetup.ts:35-41` aplikuje patch **vždy a bez ohledu na
roli**, doména `resolveEffectiveProjectSetup.ts:77-79` ho u bicích zahodí. Test v jsdom by viděl,
že se UI změnilo správně — protože UI se opravdu změní správně. Špatný je dokument, a ten v DOM
není.

Co tu vadu chytí: **kontraktní test**, který pro danou vstupní situaci porovná, co UI tvrdí
(`canEdit`, přeškrtnutý řádek, `DEVIATIONS N`), s tím, co `buildDocument` nad týmiž daty skutečně
vyprodukuje. Čistý node test, žádné DOM.

Vzor už v repu je —
`packages/desktop/src/app/domain/inputs/buildInputEditorRows.test.ts:845` („never reports a drums
slot's channel as disabled, even with a removeKeys patch the document ignores"), který vznikl jako
jednorázová záplata po Nálezu 3 opravné vlny F5c. **F5d z něj udělá systematickou vrstvu: jeden
takový test pro každou bránu, kterou fáze otevírá nebo zavírá.**

Další důvody proti jsdom:

- `environment: "node"` je konvence **všech** 153 testových souborů (jediný `vitest.config.ts`
  v rootu, bez per-file override).
- `processSteps.ts:10-12` ji drží záměrně, komentářem „Pure on purpose".
- Katalogy polí, které se v kroku C stěhují, jsou čisté funkce a testy už mají (336 řádků).
- V repu není jsdom, happy-dom ani `@testing-library/*`, ani v lockfile. Všech 15 `.test.tsx`
  souborů (92 `it()`) používá `renderToStaticMarkup` a asertuje nad HTML stringem.

**Vědomě nekryté zůstane:** že `SchemaRenderer` novou sekci vyrenderuje a zavěsí `onChange`.

**Kritérium, kdy se jsdom vrátí na stůl:** jakmile na `02` vznikne **třetí** interaktivní modál,
nebo nastane **první** případ, kdy se handler prokazatelně nezavěsil. Ne dřív.

## Architektura

Vrstvy podle `CLAUDE.md`; přesun nesmí žádnou překročit.

**Doména** (`src/domain/`, čistá, bez I/O):

| Soubor | Co | Krok |
|---|---|---|
| `lineup/effectiveInstrumentGroups.ts` | doplnit `group` fallback u `electric_guitar` a `acoustic_guitar` (R1) | A |
| `setup/resolveEffectiveProjectSetup.ts` | bicí větev přestane zahazovat `patch.monitoring`; `assertMonitorPresetRef` platí i pro drums (R3) | B |

Nic jiného v `src/domain/` se nemění. `add`/`removeKeys` u bicích, vokálů a talkbacku zůstávají
nečtené (R2, R7).

**Desktop — čistá logika** (`packages/desktop/src/app/domain/`):

| Soubor | Co | Krok |
|---|---|---|
| `inputs/resolveInputsEditState.ts` (nový) | slot → `EventSetupEditState`, dnes inline v `ProjectSetupPage.tsx:1929-1961` (R4) | C |
| `inputs/resolveDroppedUserEdits.ts` (nový) | kanály s uživatelskou odchylkou, které by patch zahodil (R5) | C |
| `inputs/resolveMonitorRowEditability.ts` | brána `drums-not-supported` padá (R3) | B |
| `inputs/resolveInputRowEditability.ts` | `drums-not-supported` i `overlay-not-supported` **zůstávají** (R2, R7) | — |

**Desktop — sdílené konstanty** (`packages/desktop/src/app/pages/shared/setupConstants.ts`):
`buildGroupInputLibrary(presetCatalog)` místo konstanty, `getGroupDefaultPreset(group,
presetCatalog)` s parametrem, derivace přes `PRESET_REFS` a `resolvePresetIdAlias` (R1, krok A).
Volající `resolveSetupForSlot.ts:39,59` katalog už má.

**Desktop — komponenty:**

| Soubor | Co | Krok |
|---|---|---|
| `components/inputs/InputsSetupSection.tsx` (nový) | modál `Edit inputs`, `SchemaRenderer` + katalogy polí + potvrzení z R5 | C |
| `components/inputs/AddInputPicker.tsx` | **smazat** (144 ř.), s ním `addInputRow` | C |
| `pages/ProjectInputsPage.tsx` | 60–100 řádků: stav modálu, tlačítko v inspektoru, render; odstranit picker | C |
| `pages/ProjectSetupPage.tsx` | smazat setup modál a jeho stav, karta naviguje na `/inputs` (R6) | D |
| `pages/ProjectInputsPage.tsx` | overlays: Add/Remove lead, back, talkback (R7) | vlna 2 |

Katalogy polí (`components/setup/instruments/{bass,guitar,keys,vocs}/`) se **neupravují** —
importují se, kde jsou.

## Testování

**Doména.**
`effectiveInstrumentGroups`: klíč mimo prefix s `group: "guitar"` dá `electric_guitar`; totéž pro
`acoustic_guitar`; mono `keys` klíč dál prochází.
`resolveEffectiveProjectSetup`: bicí slot s `patch.monitoring.monitorRef` dostane ten ref;
nevalidní ref na bicím slotu **hodí** stejnou chybu jako na basovém (R3); bicí `add` na klíč
z `drumDefinition` se dál ignoruje a **nehodí** collision (R2).

**Desktop — čistá logika.**
`buildGroupInputLibrary`: derivuje z `PRESET_REFS`, dedupuje podle `key`, doplní `group`
z `preset.group`, drums a talkback nechává být, prázdný katalog dá prázdné pole.
`getGroupDefaultPreset`: první ref role, ne union.
`resolveInputsEditState`: pro každou ze čtyř rolí dá `EventSetupEditState`, jehož
`effectivePreset` odpovídá `setupForSlot`.
`resolveDroppedUserEdits`: přepnutí, které zahodí kanál s `update.label`, ho ohlásí; přepnutí bez
dotčené odchylky vrátí prázdno; přejmenování bez přepnutí zapojení vrátí prázdno.
`resolveMonitorRowEditability`: bicí slot je editovatelný.

**Kontraktní testy UI ↔ dokument (R8)** — jeden na každou bránu, kterou fáze otevírá nebo zavírá.
Vzor `buildInputEditorRows.test.ts:845`. Minimálně:

1. Monitoring bicích: UI hlásí `canEdit: true` **a** `buildDocument` nad týmiž daty vrátí ten
   monitor mix (R3).
2. Bicí kanály: UI nenabízí remove/add **a** `buildDocument` `add`/`removeKeys` ignoruje (R2).
3. Vokální a talkback řádky: UI hlásí `overlay-not-supported` **a** patch je v dokumentu no-op (O2).
4. Odebrání vokalisty z overlay: řádek v dokumentu zmizí, čísla se přepočítají, **a UI nezobrazí
   přeškrtnutý řádek** (O3, R7).
5. Odebrání vokalisty: v dokumentu nezůstane osiřelý monitor mix (Nález 1).
6. Přepnutí `Connection`, které zahodí kanál s poznámkou: `resolveDroppedUserEdits` ho ohlásí **a**
   dokument ten kanál po aplikaci netiskne (R5).

**Regrese.** `src/domain/pipeline/buildDocument.pdfRegression.test.ts` musí zůstat zelený
s **nedotčenými očekáváními**. Měření potvrdilo, že rozšíření domény na jeho fixtury nesahá —
jediný `presetOverride` v nich je `monitoring` na basovém slotu, žádné `inputs.*`.

**Smoke.** `npm run smoke:stageplan-print` po kroku C i D — přepnutí zapojení mění text v boxech,
takže i jejich šířku (R6 z F5c).

**Co testy vědomě nekryjí:** render a zavěšení `onChange` v `SchemaRenderer` (R8).

## Global Constraints

- `npm test`: **1105 testů, 2 trvale padající** (`assetsPaths`, `repoAssets`).
- `npx tsc -p packages/desktop/tsconfig.json --noEmit`: **10 chyb ve 4 testovacích souborech**.
- `npm run lint`: **agregátní číslo je nedeterministické** (1540 / 1541 / 1543 nad totožným kódem)
  a **nepoužívá se**. Ověřují se dotčené soubory na LF-normalizované kopii nebo přes
  `--stdin-file-path`. Touhle metodou se v Taskách 17, 18 i 19a pokaždé našla skutečná chyba,
  kterou agregát maskoval.
- `buildDocument.pdfRegression.test.ts` musí zůstat zelený s **nedotčenými očekáváními**.
- **Měří se delta proti baseline, nikdy úspěch podle absolutní nuly.** Nesouvisející pre-existing
  nálezy se neopravují.
- Commit: **jednořádková zpráva bez těla a patičky** — hook obojí odmítne.

## Rizika

Seřazená podle toho, co by bolelo nejvíc.

1. **Krok D maže stav, který nemá test.** `ProjectSetupPage.tsx` vlastní test nemá — to byl důvod
   R16 z F5c a nezměnilo se to. Zmírnění: krok C proběhne a je zelený **před** krokem D, takže nová
   cesta je ověřená dřív, než stará zmizí; a smazání se dělá jedním commitem, aby šlo vrátit.
2. **Odemčení monitoringu bicích vrací throw path do pipeline** (R3). Projekt s nevalidním
   `monitorRef` na bicím slotu se přestane exportovat. Je to vědomé a hlášené, ne tiché; krytý
   doménovým testem a kontraktním testem 1.
3. **`getGroupDefaultPreset` mění hodnoty pro guitar a vocs** (R1). Dotýká se hudebníků s nula
   presety. Zmírnění: staré klíče v datech nejsou (M1) a `gtr_mic` navíc rozbíjí rozpoznání
   kytaristy (M2), takže jde o opravu; krytý testem na první ref.
4. **Destruktivní `rebuild` zahodí uživatelskou odchylku** (R5). Zmírnění: potvrzení dopředu
   s výpisem, čistou funkcí a testem.
5. **`ProjectInputsPage.tsx` naroste** (1669 řádků). Zmírnění: limit 60–100 řádků v R4, logika
   v `app/domain/inputs/`, ne v komponentě.
6. **Přepnutí zapojení mění šířky tištěných boxů.** Kolizní pojistka z F7 to zachytí při exportu.
   Hlášená chyba, ne tichá vada.

## Nálezy nad rámec rozsahu

Nálezy, ne tasky. **Do rozsahu je zařazený jen první.**

1. **Osiřelý vokální monitor mix — živá vada, patří do vlny 2.** Odebrání lead vokalisty z overlay
   nesmaže jeho monitorový řádek: po vyprázdnění `overlays.leadVocals` zůstaly v `monitorTableRows`
   i `stageplan.monitorOutputs` dva vokální monitor mixy, jen bez čísla a genderu. Dokument tedy
   vyjde s **nula** vokálními kanály a **dvěma** vokálními monitor mixy. Vyrobit se to dá dnes,
   jedním `Change` na `01`. Není to dluh z otevřených položek F5c a F5c to nezpůsobila — monitory
   jdou z lineupu, ne z overlay, takže to overlays samy neošetří.
2. **`replace` na vokálním klíči duplikuje řádek — latentní.** Umělý patch
   `replace: [{targetKey: "voc_lead_1", with: {key: "voc_lead_1"}}]` vyrobil `n` 24 → 25
   s `voc_lead_1_1` + `voc_lead_1_2` (unshift v `applyInputReplacements` plus
   `disambiguateInputKeys`). Je to týž fantomový vzorec, kterému 12c brání u `add`, ale `replace`
   podle měření prosakuje generickou `eventOverride` větví (`buildDocument.ts:610-619`).
   **Reálná cesta, jak takový patch vznikne, ověřená není** — proto to fáze nezařazuje.
3. **Doména nečte `band.defaultOverlays`.** Smazání `overlays.leadVocals` z projektu dá nula lead
   vokálních řádků, přestože band default je neprázdný. Defaulty kapely používá jen UI při
   zakládání projektu (`app/shell/canonicalProject.ts`).
4. **Legacy `project.talkbackOverride` je ignorované.** Projekt s tímto polem a bez
   `overlays.talkback` spadl na band default, ne na hodnotu v legacy poli.
5. **Přidaný kanál vyplní `spare` a posune číslování.** Baseline FNB má `spare_ch_14` (stereo pár
   `keys_l`/`keys_r` musí začít na lichém, `assignPdfChannels.ts:45`). Přidaný kytarový kanál tu
   díru vyplní, spare zmizí, celkový počet zůstane. Není to vada, ale **plán s tím musí počítat při
   čtení očekávaných hodnot.**

## Verifikace

Automaticky ověřitelné je vše z části Testování. Následující body vyžadují `npm run dev` a běží
v okně Tauri. **Žádný agent Tauri okno neotevře — jsou to závazky pro člověka, ne kroky plánu.**

### Nedodělané ruční průchody z F5c

Sedm bodů, které F5c nechala nesplněné (handoff, sekce „Co čeká na člověka"). Sedí tady, protože
F5d se dotýká týchž obrazovek a projít je po F5d je smysluplnější než dvakrát:

1. Průchod `01 → 02 → 03 → 04` a zpět.
2. Přejmenování poznámky u bicího a vokálního kanálu s exportem PDF (ověří fix 12c).
3. Zavřené akce z 13b jsou v panelu vidět se zdůvodněním.
4. `Edit kit` z panelu `02`: přidat kotel, ověřit, že v tabulce přibude kanál a čísla pod ním se
   posunou, a vyexportovat PDF (Task 16).
5. Editor poznámek: vypnout, přepsat, vrátit na šablonu, přidat vlastní do obou sekcí, smazat
   vlastní, zkontrolovat pořadí v PDF (Task 17).
6. `Reset to defaults` na `02` a jeho potvrzovací modál (Task 18).
7. Monitoring bubeníka na `01` — před F5d zavřený se zdůvodněním (Task 19a). Po F5d už zavřený
   být nesmí, viz bod 10.

### Ruční kontroly, které přidává F5d

8. `Edit inputs` u kytaristy: přepnutí `Connection` z mikrofonu na DI se projeví v tabulce i v PDF
   (R4).
9. Přepnutí `Connection` u kytaristy, který má **přejmenovaný kanál nebo vlastní poznámku** —
   potvrzení se ukáže dopředu a vypíše, co zmizí (R5).
10. Monitoring bubeníka na `02`: pole je editovatelné, změna dojede do monitorové tabulky v PDF
    (R3).
11. `+ Add input` v UI nikde není a chybět nezačne — přidání kanálu jde přes `Edit inputs`
    a `Edit kit` (R5).
12. Průchod `01 → 02` po smazání modálu: karta muzikanta na `01` naviguje na `/inputs`, `Continue`
    a `Back` fungují (R6).
13. Editace kitu na `02` po smazání modálu nezapíše na slot žádný `presetOverride.inputs.*` —
    ověřit v uloženém JSON v `%APPDATA%/StagePilot` (R6).
14. Přidání a odebrání lead vokalisty z `02` s exportem PDF: řádek přijde a zmizí, čísla se
    přepočítají, **a nezůstane osiřelý monitor mix** (R7, Nález 1).
15. Přidání a odebrání back vokalisty a talkbacku z `02` s exportem PDF (R7).
16. Starý projekt z reálného `%APPDATA%/StagePilot` (ne z fixtury) se načte, uloží a vyexportuje
    bez ztráty dat.

## Navazuje

**Rozdělení `ProjectSetupPage.tsx` na komponenty.** Po kroku D ze souboru odejde setup modál
a s ním stav, který ho obsluhoval — teprve tím se splní premisa, na které R16 z F5c stálo.
Restrukturalizace zbytku je samostatná úloha; míchat ji s přesunem znamená, že u padlého testu
nepoznáš, která změna za to může.

**`replace` na vokálním klíči** (Nález 2). Zařadit, až se najde reálná cesta, jak takový patch
vznikne — nebo cestu uzavřít bez ohledu na to, jestli existuje.

**`band.defaultOverlays` a legacy `talkbackOverride`** (Nálezy 3 a 4). Obojí je otázka pro fázi,
která se bude zabývat zakládáním projektu a čtením legacy dat, ne pro editor vstupů.

**Stereo lead vocal a druhý mikrofon pro zpěváka** (R4 z F5c u vokálů). Vyžaduje jinou reprezentaci
overlay než „jeden muzikant = jeden řádek" (O1).

**Přejmenování „Friday Night Band" na „Big Night Band"** ve všech datech včetně id — samostatné
zadání, nezačato.

**Dva projekty `blanicka_kapela`**, které se po F7 nevyexportují kvůli kolizi boxů. Čekají na
přerovnání bloků člověkem v editoru stage planu.
