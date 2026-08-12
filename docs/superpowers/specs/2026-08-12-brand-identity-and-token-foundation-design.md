# Identita a token foundation (F0 + F1)

**Datum:** 2026-08-12
**Stav:** schváleno k implementaci
**Fáze:** F0 (identita) + F1 (design systém) z pětifázového rebrandingu
**Vstup:** `docs/design/brand-handoff-2026-08/` — designový handoff, kolo 3, značka „XLR"

## Kontext

Aplikace nemá definovanou značku: ikony ve `src-tauri/icons/` jsou stále výchozí logo Tauri, `index.html` má titulek `Tauri + React + Typescript`. Vizuální vrstva stojí na 58 řádcích tokenů, které pokrývají asi třetinu reálných rozhodnutí — zbytek se rozhodoval ad hoc přímo v CSS pravidlech (303 raw `px` hodnot, 56 barevných literálů, 14 velikostí písma). Tmavý režim je kvůli tomu funkčně rozbitý: primární tlačítko má kontrast 3.98:1, chybové hlášky 2.27:1.

Tato specifikace pokrývá dvě fáze, které nelze rozdělit: paleta *jsou* barevné tokeny a typografický pár *je* typografická škála.

## Cíl

Aplikace vypadá jako produkt značky StagePilot a stojí na tokenové architektuře, kterou nelze potichu obejít. Rozvržení obrazovek, navigace a routy zůstávají nedotčené.

## Rozsah

### V rozsahu

- Brand assety (znak, inverzní znak, monochromatická varianta, lockup) v UI
- Ikony aplikace pro všechny platformy, generované reprodukovatelně
- Zabalené fonty Space Grotesk a IBM Plex Mono
- Dvouvrstvá tokenová architektura: primitivy → semantická vrstva
- Světlé i tmavé téma aplikace, obojí s ověřenými kontrasty
- Automatický kontrastní test jako regresní pojistka
- Převod veškerého komponentního CSS na semantické tokeny
- Odstranění mrtvého CSS, doplnění chybějících pravidel, rozpad `features.css`
- `prefers-reduced-motion`, `prefers-color-scheme`, viditelný focus ring, návrat fokusu po zavření modálu
- Úklid scaffoldu: `index.html`, favicon, nefunkční ikonová pipeline

### Mimo rozsah

| Vyřazeno | Kam patří | Důvod |
|---|---|---|
| Stage Plan Editor (drag & rotate) | F5, samostatný projekt | Nová funkce s perzistovaným modelem, ne rebranding |
| Procesní stopa `01 LINEUP → 04 EXPORT` | F3 | Změna informační architektury |
| Pozice jako řádky místo karet | F2 | Změna komponentní struktury |
| Custom titlebar | F3 | Vyžaduje `decorations: false` a vlastní window controls |
| Toasty, prázdné stavy, skeletony | F2 | Nové komponenty |
| Typografie PDF, hlavička se znakem | F4 | Riziko přetečení A4, potřebuje golden testy |
| Chybějící tlačítko Setup u LEAD VOCS | samostatná oprava | Funkční bug, ne vizuál |

Rozvržení obrazovek se **nemění**. Tato fáze mění hodnoty a jejich architekturu, ne strukturu.

## Rozhodnutí

Handoff je grafický nástřel; následující rozhodnutí ho upravují nebo doplňují. Uvedené kontrasty jsou spočítané podle WCAG 2.1 relativní luminance.

### R1 — `steel` se rozdvojí na textovou a dekorativní variantu

`#8A8D92` dává **2.98:1** na `paper` a **3.33:1** na bílé, přitom ho handoff předepisuje na sekundární text. Pro text se použije ztmavená varianta **`#6B6D71`** — musí projít na všech třech světlých podkladech, nejen na bílé: 5.18 na `surface`, 4.63 na `paper`, 4.52 na `chip`. Původní odstín zůstává jako `steel-decor` výhradně pro netextové použití.

### R2 — `textDarkDim` se zesvětlí

`#6C7074` dává **3.60:1** na canvas a **3.91:1** na bloku, a handoff ho používá v 10–11 px. Zesvětluje se na **`#8B9095`**. Přesnou hodnotu validuje kontrastní test; pokud neprojde, posune se dál ke `textDarkMid`.

### R3 — Karta získá hranu

`surface #FFFFFF` na `paper #F4F2ED` je kontrast **1.12:1** a okraj `line #E4E1DA` **1.31:1**, takže kartu ve zvoleném scénáři (kontrola na místě, špatné světlo) není vidět. Řešení používá prostředky, které handoff už má: **`--sp-shadow-page`** (`0 2px 14px rgba(16,17,18,.1)`, v handoffu popsaný jako „papír") na strukturálních kartách a **strukturální okraj `#A6A39E`** (2.51:1) tam, kde hranice nese informaci. Jemné linky v tabulkách zůstávají na `lineFaint`.

Zákaz těžkých stínů z handoffu zůstává v platnosti.

### R4 — Tmavé téma aplikace se dopočítá

Handoff dodává tmavé tokeny jen pro editor a titlebar. Aplikace má funkční přepínač témat, takže tmavé téma UI se odvodí ze stejné neutrální rodiny:

| Semantická role | Světlé | Tmavé |
|---|---|---|
| pozadí aplikace | `#E9E7E2` paperDeep | `#0D0E10` |
| pozadí obsahu | `#F4F2ED` paper | `#15171A` canvas |
| karta | `#FFFFFF` surface | `#1D2024` |
| zvýšená plocha | `#F0EDE7` | `#20242A` block |
| jemná linka | `#E4E1DA` line | `#2A2E34` |
| strukturální okraj | `#A6A39E` | `#363B42` borderDark |
| hlavní text | `#101112` ink | `#F4F2ED` textDark |
| odstavcový text | `#55585C` body | `#C4C7CB` |
| sekundární text | `#6C6F73` (R1) | `#9AA0A6` textDarkMid |

Primární tlačítko je v obou tématech `signal` s textem `ink` — kontrast **6.09:1** shodně. To je záměrná vlastnost: hlavní akce vypadá v obou režimech stejně.

### R5 — Barva pro stavy je vědomá odchylka od handoffu

Handoff stanoví `signal` jako jedinou barvu v UI. To nelze udržet u stavových hlášení: mono-oranžové UI neumí rozlišit „projekt smazán navždy" od „export dokončen", a červená u destruktivní akce je bezpečnostní afordance, ne dekorace.

Zavádějí se proto tři stavové role, každá se světlou i tmavou hodnotou, držené v tlumeném charakteru palety:

| Role | Světlé | Tmavé | Použití |
|---|---|---|---|
| danger | `#B3261E` | `#FF8A80` | destruktivní akce, chyby |
| warning | `#C43F0E` signalText | `#FF5B1F` signal | upozornění |
| success | `#1F6B3B` | `#6FD08C` | dokončený export, uložení |

Mimo stavová hlášení a napájení ve stage planu se barva nepoužívá. Pravidlo „jediná barva" tedy platí pro dekoraci, ne pro sdělení stavu.

### R6 — Ikona aplikace: znak zabírá 61 % strany dlaždice

README předepisuje 61 %, ale `stagepilot-app-icon.svg` má znak na ~39 % šířky. Platí **prose (61 %)**, protože v 16–32 px by znak na 39 % byl nečitelný — což je přesně velikost, ve které ikona žije na hlavním panelu.

Interpretace: **největší rozměr znaku** = 61 % strany dlaždice. Znak je vyšší než širší (západka nahoře), takže rozhoduje výška: ink znaku sahá od `y=1` do `y=59`, tedy 58 jednotek z 64. Pro dlaždici 256 px → `scale = 256 × 0.61 / 58 = 2.69`, znak pak zabírá 156 px na výšku (61 %) a 134 px na šířku (52 %). Vystředěno v obou osách.

Rádius dlaždice zůstává 22 % strany (v SVG `rx=56` na 256 px = 21,9 %).

### R7 — Ikonová pipeline na Puppeteeru, ne na ImageMagicku

Stávající `Makefile` vyžaduje inkscape, ImageMagick a macOS `iconutil`; na cílovém stroji není ani jedno. Navíc obsahuje past: `IM_CMD` padá zpět na `convert`, což se na Windows rozhodne pro `C:\WINDOWS\system32\convert.exe` — nástroj na konverzi souborového systému.

Nová pipeline používá **Puppeteer, který už je závislostí projektu**, k rasterizaci SVG na PNG 1024 × 1024, a pak `tauri icon` k vygenerování všech platformních formátů (`.ico`, `.icns`, dlaždice Windows Store). Bez nových závislostí a bez externích nástrojů. `make icons` zůstává jako delegace na npm skript.

### R8 — Fonty jako variabilní a statické TTF

Space Grotesk se zabalí jako **variabilní TTF** (jeden soubor, 137 kB, pokrývá váhy 300–700, tedy všechny tři použité). IBM Plex Mono staticky jako Regular a Medium. Formát TTF pro aplikaci i pro pozdější PDF — vyhne se potřebě konvertoru na `woff2` a PDF renderer už TTF přes lokální `@font-face` používá.

Obojí SIL OFL 1.1; licenční texty se ukládají vedle fontů.

### R9 — Tokeny mají dvě vrstvy

Plochá vrstva je příčinou rozbitého tmavého režimu: komponenty sahají přímo po hodnotách, a když jedna nemá tmavou variantu, režim se rozpadne, aniž by to cokoli zachytilo.

```
primitivy  (--sp-*)          hodnoty z handoffu, nemění se, nezávislé na tématu
    ↓
semantická vrstva (--color-*, --elevation-*, --font-*, --space-*, --radius-*)
    ↓
komponenty                   konzumují VÝHRADNĚ semantickou vrstvu
```

Tmavé téma přepisuje pouze semantickou vrstvu. Invariant: **komponentní CSS nesmí obsahovat barevný literál ani odkaz na barevný primitiv.** Typografie, spacing a rádiusy se na tématu nemění, takže u nich je primitiv zároveň semantickou rolí a komponenty je používají přímo — aliasovat je by přidalo vrstvu bez užitku.

Jediná povolená výjimka je `#ffffff` jako pozadí iframu s PDF náhledem: je to papír, ne plocha UI, a bílý zůstává i v tmavém tématu.

### R10 — Typografická škála přebírá handoff

Handoff definuje kompletní škálu (`--sp-display` až `--sp-mono-2xs`) včetně prostrkání. Přebírá se beze změny; nahrazuje 14 nesystematických velikostí. Nadpisy mají záporné prostrkání, mono popisky kladné a uppercase.

### R11 — Spacing zůstává v hodnotách handoffu

Handoff dává 13 kroků (4–44 px). Je to hustá škála, ale je to rytmus, na kterém návrh stojí, a zvolený vizuál je schválený. Nezužuje se; vynucuje se ale **výhradně tokenové použití** — přínos je „žádné raw px v komponentním CSS", ne „méně kroků".

Výjimka: `--sp-r-icon: 11px` a `--sp-r-tile: 17px` jsou artefakty mocku (rádiusy pro ikony 46 a 72 px). Nahrazují se výpočtem z 22 % strany.

### R11b — Focus ring je ink, ne akcent

Původní záměr byl obarvit focus ring akcentem. Výpočet to vyloučil: `#FF5B1F` dává **3.10:1** na bílé, ale jen **2.77:1** na `paper` a **2.70:1** na `chip` — tedy pod 3:1 právě na podkladech, kde se ovládací prvky nejčastěji nacházejí. Focus indikátor je jediný signál pozice klávesnice, takže nesmí být hraniční.

Ring proto používá `--sp-ink` ve světlém tématu (16.9:1 na paper) a `--sp-text-dark` v tmavém (16.05:1 na canvas). Ink je součást brandové palety, takže to není ústupek mimo značku.

### R12 — Tmavý režim respektuje systém při prvním spuštění

Dnes se bez uložené volby vždy nastartuje světlé téma. Nově: bez uložené volby se použije `prefers-color-scheme`. Přepínač zůstává dvoustavový — třístavová volba (světlé/tmavé/systém) patří do Settings, tedy do F3.

## Architektura

### Struktura souborů

```
packages/desktop/
  assets/
    brand/                      znak, inverze, mono, lockup, app-icon (z handoffu)
    fonts/                      SpaceGrotesk[wght].ttf, IBMPlexMono-{Regular,Medium}.ttf, OFL
  src/styles/
    primitives.css              vrstva 1 — hodnoty z handoffu
    semantic.css                vrstva 2 — role, light + dark
    fonts.css                   @font-face
    base.css                    reset, formulářové prvky
    components.css              tlačítka, panely, stavy, čipy
    layout.css                  shell, header
    modal.css                   overlay, dialog
    features/                   rozpad dnešního features.css
      hub.css  library.css  calendar.css  lineup.css  setup.css  preview.css  about.css
    app.css                     importy v pořadí vrstev
src/domain/design/
  contrast.ts                   výpočet WCAG kontrastu (čistá funkce)
  contrast.test.ts              matice semantických párů, obě témata
scripts/
  render_brand_icons.ts         SVG → PNG přes Puppeteer
```

`src/domain/design/contrast.ts` je čistá funkce bez I/O, takže respektuje hranici `src/domain/`.

### Kontrastní test

Test drží matici párů (barva textu × pozadí × minimální požadovaný poměr) pro obě témata a padne, jakmile některý pár spadne pod hranici. Hodnoty čte z jednoho TypeScript modulu, který je zdrojem pravdy pro semantickou vrstvu; CSS se z něj generuje, aby nemohly rozejít.

Hranice: 4.5:1 pro text pod 18,66 px, 3:1 pro větší text a pro netextové prvky nesoucí informaci.

### Postup migrace CSS

Mechanická, nízkoriziková transformace: **názvy tříd ani struktura markupu se nemění**, mění se pouze hodnoty na pravé straně deklarací. Tím se drží pravidlo „jedna změna za jednou" — vizuální identita se aplikuje, rozvržení ne.

Pořadí:
1. Postavit primitivy a semantickou vrstvu, přidat kontrastní test (padá — hodnoty ještě nejsou zapojené)
2. Zapojit fonty
3. Převést `base.css`, `components.css`, `layout.css`, `modal.css`
4. Rozpadnout `features.css` do `features/`, převést po souborech
5. Odstranit 20 mrtvých tříd, doplnit 3 chybějící pravidla
6. Doplnit a11y chování

## Rizika

| Riziko | Dopad | Mitigace |
|---|---|---|
| Vizuální regrese bez vizuálních testů | Rozbité rozvržení bez povšimnutí | Nemění se názvy tříd ani markup, jen hodnoty; kontrola v běžící aplikaci po každém kroku |
| Space Grotesk má jiné metriky než systémový font | Přetečení textu, zalomení tlačítek | Změna se týká jen aplikace, ne PDF (to je F4); kontrola v běžící aplikaci |
| `tauri icon` přepíše ikony nevratně | Ztráta stávajících ikon | Stávající ikony jsou výchozí Tauri logo, tedy bez hodnoty; navíc je vše v gitu |
| Semantická vrstva se rozejde s testem | Tichý návrat P1 | CSS se generuje z téhož modulu, který test čte |

## Verifikace

- `npm test` — kontrastní test prochází pro obě témata
- `npm run lint` — biome bez nových chyb (měří se rozdíl proti baseline, ne absolutní čísla)
- `npm run build` v `packages/desktop` — TypeScript i Vite build prochází
- Žádný barevný literál ani odkaz na primitiv v komponentním CSS — ověřeno grepem
- Žádná mrtvá CSS třída, žádná třída bez pravidla — ověřeno skriptem z analýzy
- Ikony aplikace vygenerované a viditelně StagePilot, ne Tauri
- Vizuální kontrola v běžící aplikaci: hub, nový projekt, lineup setup, PDF preview, modály — ve světlém i tmavém tématu
