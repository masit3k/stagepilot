# Komponenty a interakce (F2)

**Datum:** 2026-08-12
**Stav:** schváleno k implementaci
**Fáze:** F2 z pětifázového rebrandingu
**Staví na:** [F0 + F1 — identita a token foundation](2026-08-12-brand-identity-and-token-foundation-design.md)
**Vstup:** `docs/design/brand-handoff-2026-08/`, sekce `3f`

## Kontext

F1 dala aplikaci značku a tokenovou architekturu, ale nechala nedotčené tři věci, které UI analýza označila jako slabá místa:

- **Ikony jsou textové glyfy.** 21 výskytů `⋯ ≣ ⊞ × ← → ↑ ↓ ▾` proti 4 inline SVG. Renderují se z fallback fontu, mají různou optickou váhu i baseline a nedají se konzistentně zvětšit. Handoff to explicitně řeší: „ikony v prototypu jsou textové znaky — nahraď je ikonovou sadou, tloušťka tahu 1,5–2 px, velikost 16–18 px".
- **Zpětná vazba nemá systém.** Chyby jsou inline `<p class="status">`, výsledek exportu modál, chyba náhledu zase inline blok. „Uloženo" si dnes vyžádá modál a kliknutí.
- **Prázdné a načítací stavy jsou jedna věta.** `"No active projects."` bez ilustrace a bez CTA je první obrazovka po instalaci. `"Generating preview…"` je jediná zpětná vazba u operace, která přes Puppeteer trvá měřitelně dlouho.

## Cíl

Aplikace má konzistentní ikonografii, jednu cestu pro potvrzení a chyby, a stavy prázdna i načítání, které nevypadají jako chybějící obsah. Rozvržení obrazovek se mění pouze u Lineup Setup, kde to handoff přímo předepisuje.

## Rozsah

### V rozsahu

- Ikonový set jako inline SVG komponenty, nahrazení všech textových glyfů
- Toast vrstva pro potvrzení a nefatální chyby
- Prázdné stavy s ikonou, vysvětlením a akcí
- Skeleton pro generování PDF náhledu
- Pozice v Lineup Setup jako řádky místo karet (handoff `3f`)

### Mimo rozsah

| Vyřazeno | Kam patří |
|---|---|
| Custom titlebar, procesní stopa, pilulková navigace, velikost okna | F3 |
| Typografie a hlavička PDF | F4 |
| Stage Plan Editor | F5 |
| Oprava chybějícího Setup u LEAD VOCS | samostatná oprava |

## Rozhodnutí

### R1 — Ikony se nakreslí, nepřidá se knihovna

Handoff navrhuje Lucide nebo Fluent. Nepřidávám ani jedno:

- Potřebných ikon je **dvanáct**. Závislost na knihovnu kvůli dvanácti tvarům je nepoměr.
- Desktopový balík má dnes čtyři runtime závislosti (`react`, `react-dom`, dvě Tauri). Držet to je hodnota sama pro sebe.
- Aplikace už inline SVG používá (`BrandMark`, přepínač témat, ikona kalendáře), takže vzor existuje a nezavádí se nový.
- Tloušťka tahu se musí trefit do značky (1,75 px, stejně jako `BrandMark`). U cizí sady bych ji přepisoval.

Ikony jdou do jednoho modulu `components/ui/icons.tsx`, každá jako komponenta s jednotným rozhraním `{ size, className }`, `stroke="currentColor"`, `stroke-width="1.75"`, `viewBox="0 0 24 24"`, bez výplně. Barvu dědí z kontextu, takže se automaticky chovají správně v obou tématech.

Sada: `MoreHorizontal`, `Close`, `ChevronLeft`, `ChevronRight`, `ChevronDown`, `ArrowUp`, `ArrowDown`, `ListView`, `GridView`, `Calendar`, `Info`, `Sun`, `Moon`. Poslední čtyři se přesouvají z dnešních inline definic v `AppShell` a `EventDateInput`, aby existovalo jedno místo.

**Výjimka:** znak `•` v `SetupSection` a `VocalCandidateOptionRow` zůstává. Není to ikona, ale typografický oddělovač uvnitř textu — nahradit ho SVG by bylo horší.

### R2 — Toasty jsou pro potvrzení, modály zůstávají pro rozhodnutí

Dělicí linie: **modál, když aplikace potřebuje odpověď; toast, když jen oznamuje.**

- Toast: „Náhled přegenerován", „Setup uložen".
- Modál zůstává: potvrzení smazání, neuložené změny, výsledek exportu **s cestou k souboru**, kterou si uživatel chce otevřít.

**Selhání náhledu toast nedostane.** Původně jsem ho tam měl, ale inline chybový blok u náhledu nese tlačítko Retry, tedy nabízí akci — a to je podle výše uvedené linie věc pro inline blok, ne pro toast. Toast navíc plus inline blok znamená dvojí hlášení téhož.

Export je hraniční případ a řeším ho takto: úspěch s akcí „Otevřít složku" má zůstat modál, protože nese cíl a nabízí následný krok. Selhání exportu s technickým detailem taky. Toast dostane jen uložení a regenerace náhledu.

Implementace: `ToastProvider` v `app/providers/AppProviders.tsx` a hook `useToast`. React Context, ne stavová knihovna — CLAUDE.md zakazuje state management library, kontext je součást Reactu a alternativou by bylo protáhnout callback přes sedm úrovní props.

Chování: fronta max 3 toasty, auto-dismiss po 5 s (chyby po 8 s), `role="status"` pro informace a `role="alert"` pro chyby, pauza při hoveru, ruční zavření. `prefers-reduced-motion` už řeší globální pravidlo z F1.

### R3 — Prázdný stav je komponenta, ne věta

`EmptyState` s ikonou, nadpisem, vysvětlením a volitelnou akcí. Nasazení:

| Místo | Nadpis | Akce |
|---|---|---|
| Hub, Active | Zatím žádné projekty | + New Project |
| Hub, Archived | Nic archivovaného | — |
| Hub, Trash | Koš je prázdný | — |
| Library, entity | Zatím žádné záznamy | přidat záznam |
| Multiselect | Všichni muzikanti jsou přiřazeni | — |

Zůstává `aria-live="polite"`, které tam dnes je.

### R4 — Skeleton místo věty u generování náhledu

`Skeleton` jako neutrální blok s jemnou pulzací (vypnutou při `prefers-reduced-motion`). U PDF náhledu se vykreslí obrys stránky A4 v poměru, aby bylo vidět, co se chystá. Text „Generating preview…" zůstává jako `aria-live` sdělení pro čtečky, vizuálně ho nahradí skeleton.

### R5 — Pozice jako řádky, ale bez procesní stopy

Handoff `3f` mění pozice z karet na řádky přes celou šířku. Přebírám to, protože osm pozic v kartách vytváří osm rámečků pod sebou a řádka je pro srovnávací čtení lepší.

Přebírám z handoffu: řádkové rozvržení, sloupce ROLE (150 px, mono uppercase) / jméno (230 px) / technické čipy / akce vpravo, dělicí linku mezi řádkami, hover `--color-row-highlight`.

**Nepřebírám:** procesní stopu `01 LINEUP → 04 EXPORT` a pilulkovou navigaci — to je informační architektura a patří do F3. Rovněž zvýraznění řádky LEAD VOCS a čip `+ SETUP DOPLNĚN`, což handoff sám označuje za značku pro implementátora, ne za součást návrhu.

Chybějící tlačítko Setup u LEAD VOCS **nedoplňuju v této fázi** — je to funkční změna, ne vizuální, a má vlastní opravu. Řádkový layout ji ale nijak neblokuje.

## Architektura

```
packages/desktop/src/components/ui/
  icons.tsx            jeden modul, 13 ikon, jednotné rozhraní
  EmptyState.tsx
  Skeleton.tsx
  toast/
    ToastProvider.tsx  kontext, fronta, časovače
    useToast.ts        hook pro konzumenty
    ToastViewport.tsx  vykreslení do portálu
packages/desktop/src/styles/components/
  icons.css  empty-state.css  skeleton.css  toast.css
```

Nové CSS soubory se importují v `app.css` ve vrstvě komponent, tedy před `features/`.

## Stav implementace

**R1 až R5 jsou hotové a ověřené.** Fáze je uzavřená.

Čtyři varianty pozic (akustická kytara, obecné role, LEAD/BACK VOCS, band leader a talkback) sjednotila jedna komponenta `LineupRow`. Vedlejší efekt: `LeadVocsBlock` a `BackVocsBlock` byly dva byte-identické soubory až na jeden string, teď jsou to tenké obálky nad společnou řádkou.

Tři úpravy proti původnímu návrhu R5, které vyplynuly z implementace:

- **Hint nesedí ve sloupci jména, ale v prostředním sloupci s odznaky.** Sloupec jména má podle handoffu 230 px, což větu láme na dva řádky při každém zobrazení. Prostřední sloupec je pružný a věta se do něj vejde na jeden řádek.
- **Prop se jmenuje `roleLabel`, ne `role`.** JSX atribut `role` čte jako ARIA atribut jak lint, tak člověk.
- **Nepřiřazená pozice má text ztlumený** (`is-placeholder`). V plné váze jména vypadalo „Not selected" jako skutečné obsazení.

`.lineup-card` v CSS zůstává, i když ho pozice už nepoužívají: obrazovky Library ho používají jako obecný ohraničený blok. Části `__header`, `__body` a `__actions`, které patřily jen kartám pozic, jsou odstraněné.

## Rizika

| Riziko | Mitigace |
|---|---|
| Řádkový layout zasahuje do `ProjectSetupPage` (2774 řádků) | Dělá se jako poslední krok fáze, samostatně, po ověření zbytku |
| Ikony mění optickou velikost ovládacích prvků | Jednotný `viewBox` a velikost 18 px u akcí, 16 px v textu; vizuální kontrola obou témat |
| Toast kontext obalí celou aplikaci | Provider je bez stavu navenek, konzumenti čtou přes hook; `Root.test.tsx` ověří, že se aplikace bez toastů vykreslí |

## Verifikace

- `npm test` — bez nových selhání proti baseline (2 padající v `src/infra/fs/`)
- `npx biome check` na dotčených cestách — bez chyb
- `npx vite build` v `packages/desktop` prochází
- Žádný textový glyf jako ikona — ověřeno grepem na `⋯ ≣ ⊞ × ← → ↑ ↓ ▾`
- Žádná mrtvá CSS třída ani třída bez pravidla
- Vizuální kontrola v obou tématech: hub prázdný i s projekty, kalendář, multiselect, náhled při generování, toast
