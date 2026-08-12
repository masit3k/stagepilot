# Shell a informační architektura (F3)

**Datum:** 2026-08-12
**Stav:** schváleno k implementaci
**Fáze:** F3 z pětifázového rebrandingu
**Staví na:** [F0 + F1 — identita a token foundation](2026-08-12-brand-identity-and-token-foundation-design.md), [F2 — komponenty a interakce](2026-08-12-components-and-interaction-design.md)
**Vstup:** `docs/design/brand-handoff-2026-08/`, sekce `3e` a `3f`

## Kontext

F1 dala aplikaci značku a tokeny, F2 ikonografii, zpětnou vazbu a řádkové pozice. Obal aplikace ale zůstal takový, jaký byl před rebrandingem, a nese tři konkrétní problémy:

- **Okno nemá vlastní lištu.** Nativní dekorace Windows sedí nad tmavou aplikací jako cizí prvek a handoff sekce `3e` předepisuje vlastní lištu 40 px s tmavým podkladem, znakem a názvem projektu.
- **Hlavička aplikace duplikuje to, co patří liště.** `app-header` nese znak, název, verzi, přepínač témat a About. Znak a název se s titlebarem překrývají, verze je v hlavičce trvale a přitom stejnou informaci nese About modál.
- **Uživatel nevidí, kde v procesu je.** Navigace `Projects / Library / Settings` jsou obyčejná tlačítka a procesní stopa `01 LINEUP — 02 INPUTS — 03 STAGE PLAN — 04 EXPORT` z handoffu neexistuje vůbec. Okno 800×600 navíc nedává layoutu, který handoff kreslí na 1388 px, žádný prostor.

Volba tématu je dnes dvoustavová a F1 R12 tříbodovou variantu (světlé / tmavé / systém) výslovně odložila sem, protože Settings je zatím placeholder s větou „Settings will be available in a future update".

## Cíl

Aplikace má vlastní obal: tmavou lištu okna s identitou a názvem otevřeného projektu, pod ní jeden navigační řádek s pilulkami a procesní stopou, okno velké dost pro navržený layout a Settings, kde se dá téma nastavit včetně volby „řiď se systémem".

## Rozsah

### V rozsahu

- Custom titlebar 40 px podle handoffu `3e`, včetně vlastních systémových tlačítek
- Procesní stopa se čtyřmi kroky a stavem per krok
- Pilulková navigace `Projects / Library / Settings`
- Zrušení `app-header`; přepínač témat a About se přesouvají do navigačního řádku, verze do About modálu
- Výchozí a minimální velikost okna
- Settings se sekcí Appearance a tříbodovou volbou tématu

### Mimo rozsah

| Vyřazeno | Kam patří |
|---|---|
| Stage Plan Editor | F5 |
| `02 INPUTS` jako samostatná obrazovka | F5 nebo později |
| Typografie a hlavička PDF | F4 |
| Ukládání velikosti a pozice okna mezi spuštěními | nevzniklá potřeba |
| Další sekce Settings (export, cesty k datům) | nevzniklá potřeba |
| Oprava chybějícího Setup u LEAD VOCS | samostatná oprava |

### Vědomá mezera

Vlastní tlačítko zavření nebude hlídat neuložené změny. Dnešní nativní `✕` je také obchází — `UnsavedChangesModal` se otevírá jen při navigaci vnitř aplikace, ne při zavření okna. F3 tedy drží paritu se současným chováním; hlídání `onCloseRequested` je funkční oprava a má vlastní zadání.

## Rozhodnutí

### R1 — Titlebar je vlastní, bez pluginu

`decorations: false` v `tauri.conf.json`, tažení přes `data-tauri-drag-region`, tři vlastní tlačítka. Komunitní plugin (decorum a podobné) by přinesl závislost do Rust vrstvy kvůli třem tlačítkům a část vizuálních detailů handoffu (44×40 px, `--sp-close-hover`) by přes něj nešla nastavit. Je to stejná úvaha jako F2 R1 u ikon.

Capabilities se rozšíří o čtyři akce: `core:window:allow-start-dragging`, `allow-minimize`, `allow-toggle-maximize`, `allow-close`. Čtení stavu okna ani dvojklik na maximalizaci nic nepotřebují — `core:window:default`, který je součástí `core:default`, už `allow-is-maximized` i `allow-internal-toggle-maximize` obsahuje.

### R2 — Mimo Tauri se systémová tlačítka nevykreslí

`npm run dev` běží v prohlížeči, kde Tauri IPC není. Detekce je čistá funkce `hasNativeWindowApi()` nad `__TAURI_INTERNALS__`. Titlebar se vykreslí i tam — se znakem, názvem a popisem projektu, jen bez tlačítek — takže layout je v prohlížeči i v aplikaci stejný.

### R3 — Procesní stopa je model, ne komponenta plná podmínek

```ts
type StepId = "lineup" | "inputs" | "stageplan" | "export";
type StepState = "current" | "available" | "unavailable";
buildProcessTrail(pathname: string): readonly TrailStep[] | null;
```

`null` znamená „mimo kontext projektu" a stopa se nevykreslí; na hubu, v Library a v Settings nemá co ukazovat. Mapování: `01 LINEUP` → `/projects/:id/setup`, `04 EXPORT` → `/projects/:id/preview`. `02 INPUTS` a `03 STAGE PLAN` mají v F3 stav `unavailable`, protože jejich obrazovky neexistují — inputy se editují v modálu uvnitř setupu a editor přijde v F5. F5 překlopí jednu konstantu, ne komponentu.

Uživatel tak vidí celou cestu včetně toho, co ještě není. Alternativa „ukázat jen existující kroky" by v F5 přečíslovala kroky, na které si uživatel mezitím zvykl.

Sémantika: `<nav aria-label="Project steps">` s `<ol>`, `aria-current="step"` na aktivním kroku, nedostupné kroky jako `<span>` bez tabindexu — nedostupný krok není tlačítko, které nefunguje.

### R4 — Jeden stav tématu, dva vstupy do něj

`ThemePreference = "light" | "dark" | "system"` v dosavadním klíči `theme`. Neznámá i chybějící hodnota se čte jako `system`, takže chování z F1 R12 (bez uložené volby se řídím systémem) zůstává a stará uložená `light`/`dark` platí dál — žádná migrace není potřeba.

Bootstrap v `index.html` se rozšíří o `system` a dál stampuje `data-theme` před prvním vykreslením. Při preferenci `system` běží `matchMedia` listener, takže přepnutí témat ve Windows se projeví okamžitě, ne až po restartu.

Rychlý přepínač v navigačním řádku zůstává dvoustavový a volá `nextExplicitTheme(resolved)` — ze stavu `system` tedy skočí na opak toho, co je právě vidět, a preference se tím změní na explicitní. Settings ukazuje všechny tři stavy a je jediné místo, odkud se lze vrátit na `system`.

### R5 — Titlebar zobrazuje `displayName`, nic nového nepočítá

`ProjectSummary.displayName` už existuje a vzniká v domain vrstvě (`formatProjectDisplayName`) ve tvaru `Friday Night Band – 22.08.2026 – Zámek Bon Repos`. Mock `3e` ukazuje jen kapelu a datum, ale zavést druhý formát popisu projektu by znamenalo mít dvě pravdy o jeho jménu. Delší text se zkracuje ellipsis. Když projekt otevřený není nebo se v seznamu nenajde, popis se prostě nevykreslí.

### R6 — Barvy titlebaru dostanou sémantické role

`--sp-titlebar` a `--sp-close-hover` jsou dnes jen primitivy. F1 R9 zavedla dvě vrstvy — komponenty čtou sémantické role, ne primitivy — takže titlebar dostane role v `semantic.css` a jejich páry se doplní do `semantic.contrast.test.ts`. Ten má v hlavičce explicitní kontrakt: přidáš roli, přidáš pár. Lišta je tmavá v obou tématech, protože je to obal aplikace, ne její obsah.

### R7 — Okno 1400×900, minimum 1120×720, vystředěné

Výchozí velikost odpovídá layoutu, který handoff kreslí na 1388 px vnitřní šířky. Minimum je hranice, pod kterou se řádka pozice (role 150 + jméno 230 + čipy + akce) začne lámat. Je to jediné číslo v návrhu, které se smí při implementaci upravit podle skutečného měření.

### R8 — Navigační řádek nahrazuje tři obálky jednou komponentou

Dnešní cesta je `AppShell → TopTabs → Header → nav.ts`, tedy tři soubory nad jedním polem odkazů. F3 ji nahrazuje komponentou `ShellNav`, která nese pilulky vlevo a stopu, přepínač témat a About vpravo. `layout/Header.tsx`, `layout/nav.ts` i `TopTabs` zanikají.

## Architektura

```
packages/desktop/src/app/shell/
  AppShell.tsx              skládá pruhy; stav tématu z něj odchází
  chrome/
    TitleBar.tsx            znak 18 px · StagePilot · displayName · WindowControls
    WindowControls.tsx      minimize / maximize / close, 44×40
    ShellNav.tsx            pilulky vlevo · stopa, přepínač, About vpravo
    ProcessTrail.tsx        vykreslení stopy
    processTrail.ts         ČISTÉ — model kroků
    windowChrome.ts         ČISTÉ — detekce IPC, popis projektu z routy
    navItems.ts             přesun z layout/nav.ts
packages/desktop/src/app/providers/
    ThemeProvider.tsx       preference, zápis na <html>, matchMedia listener
    theme.ts                ČISTÉ — resolveTheme, nextExplicitTheme, parse
packages/desktop/src/app/pages/
    SettingsPage.tsx        sekce Appearance
packages/desktop/src/styles/components/
    titlebar.css  shell-nav.css  process-trail.css
```

Nové CSS se importuje v `app.css` ve vrstvě komponent, před `features/`.

**Zaniká:** `layout/Header.tsx`, `layout/nav.ts`, `TopTabs` a placeholder `SettingsPage` v `pages/ShellPages.tsx`, CSS `.app-header*` a `.top-tabs`.

**Téma jde přes kontext, ostatní zůstává prop drilling.** Settings se vykresluje hluboko v `ShellRouter`; protáhnout téma propsy by znamenalo dotknout se každé routy. `ToastProvider` z F2 je precedens pro sdílený stav shellu. Stopa a popis projektu se naopak předávají propsy, protože `AppShell` už `pathname` i `projects` má.

## Testování

Testy běží v node prostředí a komponenty se ověřují přes `renderToString`, takže klik ani `matchMedia` se v nich odehrát nemohou. Logika proto sedí v čistých modulech — stejný vzor jako `toastQueue.ts` z F2.

| Co | Jak |
|---|---|
| `processTrail.ts` | stavy na obou routách, `null` mimo projekt, pořadí a čísla kroků, neznámá routa |
| `theme.ts` | rozklad preference, `system` na obě strany, staré uložené hodnoty, další explicitní volba |
| `windowChrome.ts` | detekce IPC, popis projektu včetně nenalezeného a nezadaného projektu |
| Komponenty | `renderToString` smoke: shell se vykreslí bez Tauri a bez pádu |
| Barvy | páry titlebaru v `semantic.contrast.test.ts` |
| Vizuálně | tažení, dvojklik, Win+←/→, minimum okna, tři režimy tématu, živá reakce na téma Windows, stopa na setupu i preview, ellipsis u dlouhého názvu, obě témata |

## Rizika

| Riziko | Mitigace |
|---|---|
| `decorations: false` bere na Windows 11 stín a zaoblené rohy | zkusit `"shadow": true`; když nepomůže, přijmout — tmavá lišta hranu vizuálně nese |
| Aero Snap a dvojklik závisí na Tauri drag regionu | dvojklik jede přes `allow-internal-toggle-maximize` z `core:default`; ruční ověření všech tří gest |
| Okno 1400×900 se nevejde na malý displej | `center: true` a minimum 1120×720; při přečnívání dořešit clampem na work area monitoru |
| Zrušení `app-header` sáhne do `app.css` a `layout.css` | grep na `.app-header` a `.top-tabs` po dokončení, mrtvá třída nesmí zůstat |
| Kontrastní test je zdroj pravdy o barvách | páry titlebaru se přidají ve stejném commitu jako role |

## Verifikace

- `npm test` — bez nových selhání proti baseline (2 padající v `src/infra/fs/`)
- `npx biome check` na dotčených cestách — bez nových chyb
- `npx vite build` v `packages/desktop` prochází
- Žádná mrtvá CSS třída ani třída bez pravidla
- Ruční průchod aplikací podle tabulky testování, v obou tématech
