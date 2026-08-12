# Handoff: StagePilot — značka, vizuální styl, Lineup Setup a Stage Plan Editor

## Overview
StagePilot je desktopová aplikace pro Windows, ve které kapela/produkce sestaví **input list** a **stage plan** a vyexportuje je do PDF pro techniky na místě. Tento balík obsahuje novou vizuální identitu (značka „XLR", barvy, typografie) a redesign dvou obrazovek: **Lineup Setup** a nový **Stage Plan Editor** (interaktivní, drag & rotate). PDF export zůstává funkčně beze změny — mění se jen jeho hlavička a typografie.

## About the Design Files
Soubory v balíku jsou **designové reference vytvořené v HTML** — prototypy, které ukazují zamýšlený vzhled a chování. **Nejsou to produkční zdrojáky k překopírování.** Úkolem je tyto návrhy znovu postavit v existujícím prostředí aplikace StagePilot (Electron/React, WinUI, Avalonia, .NET MAUI — podle toho, co projekt používá) s jejími zavedenými vzory a knihovnami. Pokud prostředí ještě není ustálené, zvol pro projekt nejvhodnější framework a implementuj návrhy v něm.

`StagePilot Brand.dc.html` je jeden dlouhý „board" se třemi koly návrhu. **Závazné je kolo 3** (sekce s id `3a`–`3g`, úplně nahoře v souboru). Kola 2 a 1 níže jsou historie — starší varianty značky; neimplementuj je.

## Fidelity
**High-fidelity.** Barvy, typografie, rozestupy, rádiusy a stavy jsou finální; interakce editoru jsou v prototypu funkční. UI stav skládej z tokenů níže, ne z odhadu z obrázku.

Jediná výjimka: prototyp je HTML, takže platformní ovládací prvky (title bar, dialogy, výběr souboru) použij nativní a jen je nabarvi podle tokenů.

---

## Značka

### Znak (mark) — „XLR"
Objímka konektoru XLR: prstenec, západka nahoře, tři piny. Horní pin je akcentní oranžový, zbylé dva neutrální.

Geometrie (viewBox `0 0 64 64`, žádná výplň na kořeni):

| element | souřadnice |
|---|---|
| západka | `rect x=26 y=1 w=12 h=11 rx=3` — fill = barva znaku |
| prstenec | `circle cx=32 cy=34 r=22`, `stroke-width=6`, bez fillu |
| horní pin | `circle cx=32 cy=25 r=5.5` — fill `#FF5B1F` |
| levý pin | `circle cx=23 cy=41 r=5.5` |
| pravý pin | `circle cx=41 cy=41 r=5.5` |

Soubory: `assets/stagepilot-mark.svg` (na světlém), `stagepilot-mark-inverse.svg` (na tmavém), `stagepilot-mark-mono.svg` (jednobarevná, `currentColor` — pro tisk, razítka, disabled stavy), `stagepilot-app-icon.svg` (dlaždice 256×256, rádius 56), `stagepilot-lockup.svg` (znak + název).

**Pravidla použití**
- Minimální velikost 16 px. Pod 20 px se nepoužívá lockup, jen znak.
- Ochranná zóna kolem znaku = poloměr pinu (5,5 jednotek ≈ 8,6 % šířky).
- Znak nikdy nerotuj, needituj barvy pinů a nepřidávej stín ani gradient.
- Na tmavém podkladu vždy inverzní varianta; oranžový pin zůstává stejný v obou.

### Lockup (znak + název)
Vodorovně, mezera mezi znakem a textem = 0,36 × výška znaku (např. znak 28 px → mezera 10 px). Text `StagePilot`, Space Grotesk 600, `letter-spacing: -0.035em`, barva `--sp-ink` (na tmavém `--sp-text-dark`). Dvoubarevná varianta (`Stage` ink + `Pilot` signal) je povolená jen na marketingových materiálech, ne v UI.

### Ikony aplikace ve Windows
Exportuj `.ico` s vrstvami 16, 20, 24, 32, 48, 64, 128, 256 px.
- **256/128/64/48/32**: dlaždice `--sp-ink` s rádiusem 22 % strany, znak inverzní, optická velikost znaku 61 % strany dlaždice.
- **20/16**: bez dlaždice, jen znak v `--sp-ink` (světlé téma) / `--sp-text-dark` (tmavé téma systému), aby zůstal čitelný.
- **Title bar**: znak 18 px, 14 px od levého okraje, vertikálně na střed lišty (40 px). Vpravo od něj název `StagePilot` (13 px / 500) a hned za ním název projektu monospace 11 px v `--sp-text-dark-dim`.
- **Hlavní panel (taskbar)**: ikona 34×34 dlaždice, znak 22 px, pod ní indikátor aktivního okna: `18×3 px, radius 2, --sp-signal`.

---

## Screens / Views

### 1. Title bar (globální, každé okno) — viz `3e`
- Výška **40 px** (v mocku 36 px u vnořených oken), pozadí `--sp-titlebar`.
- Obsah zleva: znak 18 px → `StagePilot` (Space Grotesk 500 / 13 px, `--sp-text-dark`) → název projektu (IBM Plex Mono 11 px, `--sp-text-dark-dim`), mezery 10 px.
- Vpravo systémová tlačítka 44×40 px, glyfy 12–13 px v `--sp-text-dark-mid`; hover u zavření `--sp-close-hover` s bílým glyfem.

### 2. Lineup Setup — viz `3f`
**Účel:** přiřadit muzikanty k pozicím a otevřít per-event setup, než se generuje input list.

**Layout**
- Obsah aplikace na `--sp-paper`, vnitřní odsazení 22 px / 28 px.
- Nad obsahem řádek s navigací (`Projects` / `Library` / `Settings`, pilulky 8×16 px, aktivní = `--sp-ink` + `--sp-text-dark`) a vpravo **procesní stopa**: `01 LINEUP — 02 INPUTS — 03 STAGE PLAN — 04 EXPORT`, mono 11 px, `letter-spacing: 0.1em`, aktivní krok `--sp-signal`, ostatní `--sp-steel`.
- Hlavní karta: `--sp-surface`, `1px solid --sp-line`, radius `--sp-r-card-lg`, bez vnějšího stínu.

**Hlavička karty** (padding 22/24/18): H1 `Lineup Setup` (26 px / 600 / -0.03em), pod ním popis 14 px `--sp-body`. Vpravo: čip `20 INPUTS · 5 IEM` (mono 11 px, rámeček `--sp-line`, radius 8, padding 9/12) a tlačítko `Reset to defaults` (13 px / 500, rámeček `--sp-line-strong`, radius 9, padding 10/16).

**Řádka pozice** — klíčová změna proti současnému stavu: **jedna pozice = jedna řádka přes celou šířku**, ne karta.
- Padding `16px 24px`, spodní linka `1px solid --sp-line-faint`, poslední řádka bez linky.
- Sloupce (flex, gap 24 px):
  1. **Role** — pevná šířka **150 px**, mono 12 px / 500, `letter-spacing: 0.12em`, uppercase, `--sp-ink`.
  2. **Jméno** — pevná šířka **230 px**, 17 px / 600 / -0.02em. Víc jmen (BACK VOCS) = sloupec pod sebou, gap 4 px, řádka pak `align-items: flex-start`.
  3. **Technické čipy** — mono 11 px, `--sp-body`, podklad `#F2EFE9`, radius 6, padding 5/9, gap 6 px. Čip s upozorněním: podklad `--sp-signal-wash`, text `--sp-signal-text`.
  4. **Akce** (`margin-left: auto`) — `Change` (13 px, rámeček `--sp-line-strong`, radius 8, padding 8/14) a `Setup` (stejné rozměry, rámeček `--sp-ink`, text `--sp-ink`, 500).
- Hover řádky: podklad `--sp-row-highlight`.

**Pořadí řádek:** DRUMS, BASS, EL. GUITAR, KEYS, LEAD VOCS, BACK VOCS, BAND LEADER, TALKBACK. Řádky s obsazením mají `Change` + `Setup`; BAND LEADER a TALKBACK jen `Change` (jde o přiřazení osoby, ne o technický setup).

> **Oprava proti současné aplikaci:** LEAD VOCS musí mít tlačítko **Setup** stejně jako ostatní pozice (dnes chybí). V mocku je řádka zvýrazněná (`--sp-row-highlight`) a nese čip `+ SETUP DOPLNĚN` — to je jen značka pro tebe, v implementaci zvýraznění i čip vypusť.

**Patička karty:** `Edit Project`, `Back to Hub` (obojí ghost, radius 10, padding 11/18) vlevo; vpravo primární `Continue` (`--sp-signal` podklad, text `--sp-ink`, 600 / 14 px, radius 10, padding 12/30). Podklad patičky `#FBFAF7`, horní linka `--sp-line`.

**Dialog Setup** (existující, jen přebarvit): nadpis 20 px / 600, sekce `Input` a `Monitoring` v kartách s `--sp-line`, segmentovaný přepínač `Vlastní / Pořadatel` (aktivní segment `--sp-ink` + `--sp-text-dark`), primární `Save` = signal, ostatní ghost.

### 3. Stage Plan Editor — viz `3g` (nová obrazovka, nahrazuje statický náhled)
**Účel:** rozmístit bloky pódia tak, jak reálně stojí, a poslat je do PDF.

**Layout**: tmavé okno. Shora: title bar → toolbar (56 px) → tělo (canvas + panel) → patička (60 px).

**Toolbar**
- Vlevo taby `STAGE PLAN` (aktivní: podklad `--sp-paper`, text `--sp-ink`) / `INPUT LIST` / `PDF PREVIEW` (rámeček `--sp-border-dark`, text `--sp-text-dark-mid`), mono 11 px `letter-spacing: 0.1em`, radius 8, padding 8/14.
- Nástroje: čtverce 34×34, radius 8 — **výběr** (aktivní, podklad `--sp-signal`), **posun**, **rotace**, **přidat blok**.
- Přepínač snapu: mono 11 px; zapnutý = podklad `--sp-signal`, text `--sp-ink`, popisek `SNAP 10 CM · 15°`; vypnutý = rámeček `--sp-border-dark`, text `--sp-text-dark-mid`, popisek `SNAP OFF`.
- Vpravo mono 11 px `--sp-text-dark-dim`: `PÓDIUM 12,0 × 8,0 m · ZOOM 100 %`.

**Canvas**
- Plocha 1080×470 px v mocku = **12,0 × 8,0 m** reálného pódia; **90 px = 1 m** (mřížka 30 px = 0,5 m). V implementaci canvas škáluj na dostupnou plochu a přepočítávej metry, ne pixely — ukládej metry.
- Pozadí `--sp-canvas`, mřížka: dvě lineární gradientové linky `--sp-canvas-grid` 1 px, rozteč 30 px.
- Dole přes celou šířku pruh 30 px s gradientem do `rgba(16,17,18,0.92)` a popiskem `DOWNSTAGE · PUBLIKUM` (mono 10 px, `letter-spacing: 0.2em`, `--sp-text-dark-dim`), `pointer-events: none`.

**Blok**
- `position: absolute`, radius 12, padding 14/16, `transform: rotate(<deg>)`, origin střed.
- Nevybraný: podklad `--sp-block`, `1px solid --sp-border-dark`, stín `--sp-shadow-block`.
- Vybraný: podklad `--sp-block-selected`, `2px solid --sp-signal`, stín `--sp-shadow-block-sel`.
- Obsah shora: název pozice (mono 12 px / 500, `0.1em`, `--sp-text-dark`), kanály (mono 11 px, `--sp-text-dark-mid`), poznámka (13 px, `--sp-text-dark-mid`), dole vlevo napájení (mono 11 px / 500, `--sp-signal`), dole vpravo aktuální rotace (mono 10 px, `--sp-text-dark-dim`).
- **Rotační úchyt** jen u vybraného bloku: kolečko 22 px, `--sp-signal`, `2px solid --sp-ink`, 34 px nad horní hranou, na střed, glyf `↻`.
- Kurzor `grab` / `grabbing`, `touch-action: none`, `user-select: none`.

**Pravý panel (šířka ~296 px, levá linka `--sp-border-dark-2`, padding 18 px)**
1. `VYBRANÝ BLOK` (mono 10 px, `0.16em`, `--sp-text-dark-dim`) → název 17 px / 600 → kanály mono 11 px.
2. Řádky vlastností, popisek mono 11 px šířky 62 px: **ROTACE** (tlačítka ↺ / ↻ po 15°, mezi nimi hodnota), **ROZMĚR** (v metrech), **NAPÁJENÍ** (`--sp-signal`).
3. `BLOKY NA PÓDIU` — seznam všech bloků, mono 11 px, radius 9, padding 9/12; vybraný má podklad `--sp-signal` + text `--sp-ink`, ostatní rámeček `#2A2E34` a text `--sp-text-dark-mid`. Vpravo v řádce rotace.
4. Dole `Reset rozmístění` (ghost přes celou šířku).

**Patička**: vlevo `Zpět na Lineup` (ghost), uprostřed vpravo mono 11 px `Změny se propíší do PDF exportu`, vpravo `Generate PDF` (signal).

### 4. PDF export — viz `2c`
Struktura, pořadí stran i obsah **beze změny**. Mění se jen:
- **Hlavička každé strany**: znak 26 px + název kapely (19 px / 600 / -0.025em) + řádek `INPUT LIST · 22. 8. 2026 · ZÁMEK BON REPOS` (mono 9 px, `0.04em`, `--sp-body`); vpravo `STAGEPILOT / UPD <datum>` mono 9 px `--sp-steel`. Pod hlavičkou linka `2px solid --sp-ink`.
- **Tabulka**: hlavička mono 8 px `0.14em` `--sp-steel`; řádky 10 px, číslo kanálu mono `--sp-steel`, název 500, poznámka `--sp-body`; dělicí linky `--sp-line-faint`.
- **Napájení** ve stage planu oranžově (`--sp-signal`, 600) — jediná barva na stránce.
- **Patička**: kontakt mono 8 px uppercase vlevo, `<n> / <celkem>` vpravo, nad tím linka `--sp-line`.
- Bloky stage planu se do PDF vykreslí přesně tak, jak jsou v editoru (pozice i rotace), jen v inverzi na bílém: `1px solid --sp-ink`, bez radiusu, LEAD VOC blok plný `--sp-ink` s bílým textem.

---

## Interactions & Behavior

### Editor — táhnutí bloku
1. `pointerdown` na bloku: `preventDefault` + `stopPropagation`, blok se označí jako vybraný, uloží se výchozí pozice a souřadnice kurzoru.
2. `pointermove` na okně: `nx = x0 + (ev.clientX - startX) / scale`, totéž pro `y`. `scale` = `canvas.getBoundingClientRect().width / canvas.offsetWidth` (kompenzace zoomu).
3. Se zapnutým snapem `Math.round(n / 10) * 10` (10 px ≈ 11 cm; v implementaci snapuj na **10 cm** v metrech).
4. Clamp na plochu canvasu s tolerancí 20 px za hranou (blok smí kousek přesahovat — pódia bývají nepravidelná).
5. `pointerup` na okně: odregistrovat listenery. Žádná animace během tažení.

### Editor — rotace
- Tažení za úchyt: `angle = atan2(ev.clientY - cy, ev.clientX - cx) * 180 / PI + 90`, kde `cx, cy` je střed bloku v obrazovkových souřadnicích. Krok 15° se snapem, 1° bez něj; hodnota se normalizuje do 0–359.
- Tlačítka ↺ / ↻ v panelu: ±15°, zaokrouhleno na násobek 15.

### Ostatní
- Klik na položku v seznamu bloků = výběr (canvas na to nescrolluje).
- `Reset rozmístění` vrátí výchozí layout a vybere první blok.
- Přechody: pouze `background-color` a `border-color`, 120 ms `ease-out`. Pozice bloků **bez** transition, jinak drhne tažení.
- Klávesnice (doplnit při implementaci, v prototypu není): šipky = posun o 10 cm, Shift+šipky o 1 m, `R` = +15°, `Delete` = odebrat blok, `Ctrl+Z` = undo.

## State Management
```
project { id, type: 'event'|'template', bandId, date, venue, updatedAt }
lineup  { positionId, musicianId[], setupOverrides }   // override platí jen pro event
inputs  [{ no, label, note, positionId }]
stagePlan {
  stage: { widthM: 12.0, depthM: 8.0 },
  blocks: [{ id, positionId, label, sub, extra, power, xM, yM, wM, hM, rot }]
}
ui      { selectedBlockId, snap: true, activeTab: 'stage'|'inputs'|'pdf' }
```
- Souřadnice a rozměry ukládej **v metrech**, ne v pixelech — canvas je jen zobrazení.
- `stagePlan.blocks` se generuje z lineupu (jeden blok na pozici) a dál se edituje ručně; při změně lineupu bloky doplň/odeber, ale **nepřepisuj ruční pozice** existujících.
- Generování PDF čte stejný `stagePlan` — žádný druhý layout.

## Design Tokens
Kompletní sada je v `tokens/design-tokens.css` (CSS proměnné) a `tokens/design-tokens.json` (pro build/theme). Shrnutí:
- **Neutrály**: `#101112` ink · `#33363A` · `#55585C` text · `#8A8D92` sekundární · `#F4F2ED` paper · `#E9E7E2` plocha · `#FFFFFF` karty · `#E4E1DA` / `#D8D5CE` / `#F0EDE7` linky.
- **Akcent**: `#FF5B1F` (jediná barva UI), `#C43F0E` jako text na světlém, `#FFF1E9` / `#FFE9DE` podklady, `#FFFBF8` zvýrazněná řádka.
- **Tmavý režim editoru**: `#15171A` canvas · `#20242A` mřížka a bloky · `#2A211B` vybraný blok · `#363B42` / `#26282B` okraje · `#F4F2ED` / `#9AA0A6` / `#6C7074` text · `#1B1B1F` taskbar.
- **Typografie**: Space Grotesk (400/500/600) na UI, IBM Plex Mono (400/500) na čísla, kanály, technické popisky a stavové řádky. Nadpisy vždy záporné prostrkání (-0.02 až -0.035em), mono popisky vždy kladné (0.1–0.16em) a uppercase.
- **Rádiusy**: 6 čip · 8 tlačítko · 9–10 větší tlačítko · 12 karta/blok · 14 velká karta · 20 panel.
- **Stíny**: bloky `0 2px 8px rgba(0,0,0,.3)`, vybraný `0 10px 28px rgba(255,91,31,.22)`, papír `0 2px 14px rgba(16,17,18,.1)`. Jinde stíny nepoužívej.

### Písma
Space Grotesk i IBM Plex Mono jsou zdarma (SIL OFL). Pro desktop app je **zabal do instalace** (`ttf`/`woff2`), nespoléhej na Google Fonts. Fallback: `Segoe UI`, resp. `Consolas`.

## Assets
| Soubor | Použití |
|---|---|
| `assets/stagepilot-mark.svg` | znak na světlém podkladu |
| `assets/stagepilot-mark-inverse.svg` | znak na tmavém podkladu (title bar, taskbar, editor) |
| `assets/stagepilot-mark-mono.svg` | jednobarevná varianta, dědí `currentColor` |
| `assets/stagepilot-app-icon.svg` | podklad pro `.ico` / instalátor / zástupce |
| `assets/stagepilot-lockup.svg` | znak + název (splash, O aplikaci, hlavička PDF) |
| `tokens/design-tokens.css`, `.json` | barvy, typografie, rádiusy, parametry editoru |

Ikony v UI (nástroje editoru, systémové glyfy) jsou v prototypu textové znaky — nahraď je ikonovou sadou, kterou projekt už používá (např. Lucide/Fluent), tloušťka tahu 1,5–2 px, velikost 16–18 px.

## Files
- `StagePilot Brand.dc.html` — celý designový board. **Implementuj kolo 3**: `3a`–`3d` varianty značky (vybráno **3b — XLR**), `3e` ikona ve Windows, `3f` Lineup Setup, `3g` Stage Plan Editor (funkční drag & rotate — otevři v prohlížeči a vyzkoušej chování, které máš replikovat). Kola 2 a 1 níže jsou zamítnuté starší varianty; slouží jen jako kontext.
- `FNB_Inputlist_Stageplan_22-08-2026_Zamek-Bon-Repos.pdf` — současný export, jehož obsah a struktura zůstávají.
