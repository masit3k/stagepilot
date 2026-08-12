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
    TitleBar.tsx            znak 22 px · StagePilot · displayName · WindowControls
    WindowControls.tsx      minimize / maximize / close, 44×40
    ShellNav.tsx            pilulky vlevo · stopa, přepínač, About vpravo
    ProcessTrail.tsx        vykreslení stopy
    processSteps.ts         ČISTÉ — model kroků
    windowChrome.ts         ČISTÉ — detekce IPC, popis projektu z routy
    windowActions.ts        imperativní volání Tauri, líný import
    navItems.ts             přesun z layout/nav.ts + activeNavId
packages/desktop/src/app/providers/
    ThemeProvider.tsx       preference, zápis na <html>, matchMedia listener
    theme.ts                ČISTÉ — resolveTheme, nextExplicitTheme, parse
    useTheme.ts             hook pro konzumenty
packages/desktop/src/app/pages/
    SettingsPage.tsx        sekce Appearance
packages/desktop/src/styles/components/
    titlebar.css  shell-nav.css  process-trail.css
packages/desktop/src/styles/features/
    settings.css
```

Tauri se importuje líně (`await import("@tauri-apps/api/window")`) uvnitř `windowActions.ts`. Modul tak zůstává načtitelný tam, kde most neexistuje — ve vitest i ve Vite dev serveru — a případné omylné zavolání spadne na místě volání, ne při načtení modulu. Build to potvrzuje samostatným chunkem `window-*.js`.

Nové CSS se importuje v `app.css` ve vrstvě komponent, před `features/`.

**Zaniká:** `layout/Header.tsx`, `layout/nav.ts`, `TopTabs` a placeholder `SettingsPage` v `pages/ShellPages.tsx`, CSS `.app-header*` a `.top-tabs`.

**Téma jde přes kontext, ostatní zůstává prop drilling.** Settings se vykresluje hluboko v `ShellRouter`; protáhnout téma propsy by znamenalo dotknout se každé routy. `ToastProvider` z F2 je precedens pro sdílený stav shellu. Stopa a popis projektu se naopak předávají propsy, protože `AppShell` už `pathname` i `projects` má.

## Testování

Testy běží v node prostředí a komponenty se ověřují přes `renderToString`, takže klik ani `matchMedia` se v nich odehrát nemohou. Logika proto sedí v čistých modulech — stejný vzor jako `toastQueue.ts` z F2.

| Co | Jak |
|---|---|
| `processSteps.ts` | stavy na obou routách, `null` mimo projekt, pořadí a čísla kroků, neznámá routa |
| `navItems.ts` | která pilulka svítí na které routě, včetně neznámé |
| `theme.ts` | rozklad preference, `system` na obě strany, staré uložené hodnoty, další explicitní volba |
| `windowChrome.ts` | detekce IPC, popis projektu včetně nenalezeného a nezadaného projektu |
| Komponenty | `renderToString` smoke: shell se vykreslí bez Tauri a bez pádu |
| Barvy | páry titlebaru v `semantic.contrast.test.ts` |
| Vizuálně | tažení, dvojklik, Win+←/→, minimum okna, tři režimy tématu, živá reakce na téma Windows, stopa na setupu i preview, ellipsis u dlouhého názvu, obě témata |

## Stav implementace

**R1 až R8 jsou hotové a vizuálně ověřené.** Fáze je uzavřená.

Rám okna si na Windows drží `WS_CAPTION` i `WS_THICKFRAME` a nekreslený je udělá `WM_NCCALCSIZE` — tak to řeší tao. Právě proto okno nepřišlo o Aero Snap, stín ani tažení za okraje. Klientská oblast měří přesně 1400 × 900, takže z nativní lišty nezůstalo nic.

Sedm odchylek proti návrhu, které vyplynuly z implementace:

- **Model kroků se jmenuje `processSteps.ts` a funkce `buildProcessSteps`.** Původní `processTrail.ts` se na Windows tluče s komponentou `ProcessTrail.tsx` — souborový systém nerozlišuje velikost písmen a TypeScript to hlásí jako TS1149.
- **Stopa má tři barevná ošetření, ne dvě.** Handoff říká „aktivní `--sp-signal`, ostatní `--sp-steel`", ale nepočítal s kroky bez obrazovky. Aktivní krok bere `--color-accent-text` (surový signal má na paper 2,77:1, viz F1 R5), dosažitelný krok jde na ink, aby byl poznat jako klikatelný, a nedostupný zůstává na sekundární barvě. Rozdíl mezi dosažitelným a nedostupným tedy nedělá slabší kontrast, ale absence afordance.
- **Prostrkání stopy je 0,12em, ne 0,1em.** Používá `--sp-track-mono-label` z typografické škály F1 místo zavádění další hodnoty.
- **`shadow` se v konfiguraci nenastavuje.** V Tauri 2 je výchozí `true`, takže nebylo co zapínat; riziko o stínu zůstává jako věc k vizuální kontrole.
- **`activeNavId` je vytažená a otestovaná funkce.** V `Header.tsx` to byl vnořený ternár bez testu.
- **Znak v liště má 22 px, ne 18 px podle handoffu.** Vyšlo to z vizuální kontroly: na 18 px padne tloušťka prstence (6 ze 64 jednotek) i poloměr pinů (5,5) pod 2 px, prstenec se čte jako šedý pás a dva spodní piny se do něj rozpustí. Ověřoval jsem to rasterizací značky na 18, 20 a 22 px a porovnáním pixelů, ne vektorů — 22 px je nejmenší velikost, kde se všechny tři piny od prstence oddělí. Kresba zůstává nedotčená, mění se jen velikost. Kdyby 22 px nestačilo, další krok je optická varianta (prstenec 5, piny 6,5), která byla ve srovnání nejčistší, ale sahá na tvary značky.
- **Vedlejší efekt: kontextové menu projektu se přestalo posouvat proti kurzoru.** Portál se vykresluje do `body` s `position: absolute`, ale souřadnice počítá z `getBoundingClientRect()`. Dokud scrolloval dokument, byly ty dvě soustavy o odscrollovanou výšku vedle sebe. Rám okna scrollování přesunul do `.app-shell`, dokument stojí, a souřadnice teď souhlasí.

Jedna známá vlastnost, ne chyba: název projektu v liště pochází ze seznamu projektů, který shell už drží. Při otevření projektu přímým odkazem se lišta na okamžik vykreslí bez názvu, dokud seznam nedojde.

## Rizika

| Riziko | Mitigace |
|---|---|
| `decorations: false` bere na Windows 11 stín a zaoblené rohy | `shadow` je v Tauri 2 výchozí `true`, takže zbývá vizuální kontrola; když stín nebude, přijmout — tmavá lišta hranu nese |
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
