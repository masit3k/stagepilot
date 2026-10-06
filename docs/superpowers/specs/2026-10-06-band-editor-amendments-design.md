---
type: Design
title: "Editor kapely — dodatek: vokály v sestavě, mazání kapely, opravy layoutu"
description: "Dodatek k editoru kapely z ručního průchodu: LEAD VOCS a BACK VOCS jako řádky sestavy místo zaškrtávátek v Roles (mění R8), mazání kapely blokované projekty (ruší R14) a opravy oříznutého dropdownu a zarovnání řádků."
tags: [library, bands, user-catalog, appdata]
generated:
  by: claude/opus-5-5
  at: 2026-10-06T00:00:00+02:00
status: stable
audience: [developers, agents]
---
# Editor kapely — dodatek: vokály v sestavě, mazání kapely, opravy layoutu

**Fáze:** Uživatelský katalog, krok 1 (kapely), dodatek z ručního průchodu
**Datum:** 2026-10-06
**Mění:** [Editor kapely v Library](/superpowers/specs/2026-10-06-band-editor-design.md), pravidla R8, R12 (bod 3), R14
**Větev:** `feat/band-editor` (navazuje na 1ebeb75)
**Stav:** čeká na schválení

Co tu není, platí beze změny podle původního specu.

## Proč

Ruční průchod (2026-10-06) ukázal tři věci:

1. Výběr vokálů ve dvou místech (skupina `vocs` v sestavě a zaškrtávátka „Lead vocals"
   v Roles) je matoucí a zaškrtávátka mají rozbitý layout (popisek pod checkboxem
   jiného řádku).
2. Back vokály se nedají ovlivnit, přestože v reálných datech je tvoří konkrétní
   zpívající instrumentalisté.
3. Kapelu nejde smazat, takže se nedá uklidit ani testovací kapela z průchodu.

## Rozhodnutí

### A1 — LEAD VOCS je skupina `vocs` (nahrazuje první polovinu R8)

Řádek skupiny `vocs` v sestavě se v UI jmenuje **LEAD VOCS**. `defaultOverlays.leadVocals`
se při uložení rovná přesně `defaultLineup.vocs` (stejné pořadí). Lead vokalista je
jen člen skupiny `vocs`; zpívající instrumentalista patří do BACK VOCS.

Zaškrtávátka „Lead vocals" v sekci Roles mizí. Sekce Roles obsahuje jen select
„Band leader". Pole `leadVocalIds` v draftu a validace k němu (`collectRoleErrors`)
se upraví tak, aby odpovídaly A1 — konkrétní tvar určí plán podle kódu.

Existující kapela, jejíž uložené `leadVocals` se liší od `defaultLineup.vocs`, se
otevře podle `defaultLineup.vocs` a při uložení se srovná. Stav dat z 2026-10-06
(ověřeno skriptem): u BNB, COS a PL se shodují; u Blanické kapely je stejná množina
v opačném pořadí (`vocs` = Holoubek, Krečmerová; `leadVocals` = Krečmerová, Holoubek)
— po uložení se `leadVocals` přerovná podle `vocs`. Plán ověří, jestli pořadí
`leadVocals` ovlivňuje dokument (pořadí vstupů / monitorů); pokud ano, platí pořadí
skupiny `vocs` a změna se zmíní v ručním průchodu.

### A2 — BACK VOCS je ruční výběr, předvyplněný (nahrazuje druhou polovinu R8)

Pod LEAD VOCS je řádek **BACK VOCS**. Není to skupina sestavy (`defaultLineup` se
nemění, `BACK VOCS` nepřidává člena), ale výběr nad členy sestavy mimo skupinu `vocs`.
Ovládání je stejné jako u skupin (seznam jmen s „Remove" a multiselect „Add back vocs").

- Nabídka: členové `drums | bass | guitar | keys` aktuální sestavy, kteří ještě nejsou
  v BACK VOCS.
- **Nová kapela:** předvyplní se odvozením `deriveVocalOverlaysFromLineup` s predikátem
  `canSing` (dosavadní chování R8), a to při každé změně sestavy, dokud uživatel BACK
  VOCS ručně nezmění (stejný princip jako „dirty" zkratka v R5).
- **Existující kapela:** načte se uložené `defaultOverlays.backVocals`, nic se
  nepřepočítává.
- Člen odebraný ze sestavy z BACK VOCS zmizí.
- Uloží se přesně vybraný seznam. `validateDefaultVocals` musí projít (žádný back
  vokalista v lead, každý v sestavě).

Důsledek: bod 9 původního ručního průchodu (Blanické kapele se `backVocals` přepočítají
z `[]`) neplatí — uložené `[]` zůstane `[]`.

### A3 — Mazání kapely (ruší R14)

- Tlačítko **Delete band** dole na stránce úpravy kapely (ne v seznamu, ne u nové
  kapely). Vizuálně jako destruktivní akce podle stávajících tříd tlačítek.
- Před smazáním se zjistí projekty s `bandRef` rovným id kapely
  (`%APPDATA%/StagePilot/projects/*.json`).
  - **Nějaké existují:** smazání se zablokuje. Dialog vypíše názvy (nebo id) těch
    projektů a nabídne jen zavření.
  - **Žádné:** potvrzovací dialog „Delete band <název>?" → smazání souboru
    `catalog/bands/<id>.json` → návrat na seznam kapel s toastem.
- Soubory kontaktů (`catalog/contacts/<musicianId>.json`) se **nemažou** — patří
  muzikantovi a sdílí je víc kapel.
- Kontrola projektů i mazání běží v Rustu jako souborové operace (R3): nový příkaz
  `delete_band(bandId)` s kontrolou projektů uvnitř, aby mezi kontrolou a smazáním
  nebyla mezera v UI. Při existujících projektech vrací chybu s kódem
  `BAND_IN_USE` a seznamem projektů; ostatní selhání `BAND_DELETE_FAILED`. Sanitace
  id stejná jako u `read_band`.
- Desktop volá příkaz jen přes `bandsApi.ts` (R11).
- Neplatný JSON v jednom projektu kontrolu neshodí: takový soubor se počítá jako
  „nelze ověřit" a smazání zablokuje (bezpečnější strana), s uvedením souboru.

### A4 — Opravy layoutu (doplňuje R12 bod 2)

1. **Oříznutý dropdown:** rozbalovací panel „Add <skupina>" se u pravého okraje
   karty ořízne (viditelné jen „Ernst Filip", „Nývlt Jakul…", tlačítko „A… sele…").
   Panel musí být celý viditelný — zarovnat k pravému okraji spouštěče a nesmí ho
   oříznout `overflow` předků.
2. **Zarovnání řádků sestavy:** tlačítka „Remove …" a „Add …" mají ve všech řádcích
   (včetně LEAD VOCS a BACK VOCS) stejný sloupec; řádek nesmí měnit šířku sloupců
   podle délky jména.
3. **Úzké okno:** při šířce, kdy se ovládání nevejde vedle jména, se zalomí pod něj,
   nezmizí (screenshot z průchodu ukazuje řádky bez tlačítek).

Opravy se týkají `AddMusiciansMultiSelect` i ProjectSetupPage, kde se komponenta
používá — oprava nesmí rozbít tamní layout.

## Testy

- **Doména:** `buildBandFromDraft` — `leadVocals` = `defaultLineup.vocs`; `backVocals`
  = přesně draft; back vokalista mimo sestavu nebo ve `vocs` → chyba; prázdné
  `backVocals` zůstane prázdné. Předvyplnění BACK VOCS pro novou kapelu a jeho
  zastavení po ruční změně (čistá funkce ve `bandFormModel.ts` nebo doméně).
- **Rust:** `delete_band` — smaže soubor bez projektů; s projektem vrátí `BAND_IN_USE`
  a soubor nechá; neplatný projekt zablokuje; nepovolené id odmítne. Testy nad
  dočasným adresářem jako stávající.
- **Desktop:** `bandsApi.deleteBand` mapuje `BAND_IN_USE` na typovaný výsledek se
  seznamem projektů (mock `invoke`).

## Ruční průchod (doplnění)

1. Nová kapela: přidání bubeníka se zpěvem předvyplní BACK VOCS; ruční odebrání a
   další změna sestavy už BACK VOCS nepřepíše.
2. Blanická kapela: otevřít a uložit bez změn → `backVocals` zůstane `[]`.
3. Big Night Band: BACK VOCS ukazuje Plašil, Krečmer, Žídek; uložení beze změny
   nemění soubor (kromě formátování).
4. Smazání Blanické kapely je zablokované (dva projekty s `bandRef: blanicka_kapela`).
5. Smazání `test_band` projde, kapela zmizí ze seznamu, `contacts/` beze změny.
6. Dropdown „Add drums" je celý viditelný; tlačítka v řádcích jsou v jednom sloupci;
   úzké okno je nezahodí.

## Mimo rozsah

- Mazání muzikantů a kontaktů.
- Mazání rozbité kapely z chybového řádku seznamu.
- Hromadné přepojení projektů na jinou kapelu.
