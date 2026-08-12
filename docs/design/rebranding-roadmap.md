# Rebranding — mapa fází a stav

Vstupní bod pro pokračování práce na rebrandingu. Detaily každé fáze jsou v jejím specu
v `docs/superpowers/specs/`; tady je jen co je hotové, co je další a co do které fáze patří.

**Zdroj návrhu:** `docs/design/brand-handoff-2026-08/` — `StagePilot Brand.dc.html` je celý
designový board, implementuje se **kolo 3** (`3a`–`3d` varianty značky, vybráno `3b` XLR;
`3e` ikona ve Windows; `3f` Lineup Setup; `3g` Stage Plan Editor). Kola 1 a 2 jsou zamítnutá.

## Stav

| Fáze | Co | Stav | Spec | Commit |
|---|---|---|---|---|
| F0 + F1 | Identita, ikona aplikace, dvouvrstvá tokenová architektura, tmavé téma | hotovo | [2026-08-12-brand-identity-and-token-foundation-design.md](../superpowers/specs/2026-08-12-brand-identity-and-token-foundation-design.md) | `56b05cb` |
| F2 | Ikonový set, toasty, prázdné stavy, skeleton, pozice jako řádky | hotovo | [2026-08-12-components-and-interaction-design.md](../superpowers/specs/2026-08-12-components-and-interaction-design.md) | `56b05cb` |
| F3 | Custom titlebar, pilulková navigace, procesní stopa, velikost okna, téma v Settings | hotovo | [2026-08-12-shell-and-information-architecture-design.md](../superpowers/specs/2026-08-12-shell-and-information-architecture-design.md) | `17c4580`, `cebabcf` |
| **F4** | **Typografie a hlavička PDF** | **spec schválen, čeká na implementaci** | [2026-08-12-pdf-typography-and-header-design.md](../superpowers/specs/2026-08-12-pdf-typography-and-header-design.md) | — |
| F5 | Stage Plan Editor (drag & rotate) | neotevřeno | zatím není | — |

## F4 — typografie a hlavička PDF

**Vstup:** handoff sekce `4` (PDF export) a `2c`, plus `FNB_Inputlist_Stageplan_22-08-2026_Zamek-Bon-Repos.pdf`
jako současný stav exportu.

Struktura, pořadí stran ani obsah PDF se **nemění**. Mění se hlavička a patička obou stran,
typografie podle tokenů z F1 (Space Grotesk a IBM Plex Mono místo Interu) a tabulka, která
ztrácí rámečky. Detaily a všech jedenáct rozhodnutí jsou ve specu.

Bloky stage planu si vzhled nechají a řeší se až v F5 — editor je stejně přepisuje kvůli
rotaci a pozicím.

**Riziko, které fázi definuje, je jinde, než roadmapa původně tvrdila.** Pojistka proti
přetečení A4 v `src/infra/pdf/pdf.ts` nefunguje: porovnává `#content.bottom` proti
`#page.bottom`, jenže `#content` je přímý potomek `#page` a `.pdfPage` nemá v CSS výšku, takže
rozdíl je vždy zhruba nula. Navíc měří v šířce okna prohlížeče, ne tiskového zrcadla. Přetečení
by tedy nespadlo, jen by tiše vylezla třetí strana. F4 pojistku opravuje (spec R11).

## F5 — Stage Plan Editor

**Vstup:** handoff sekce `3g` (živý prototyp — otevřít v prohlížeči a vyzkoušet chování).

Tmavé okno, toolbar, canvas s bloky, panel, patička. Souřadnice a rozměry se ukládají
**v metrech**, ne v pixelech. `stagePlan.blocks` se generuje z lineupu, dál se edituje ručně a při
změně lineupu se bloky doplňují a odebírají, ale ruční pozice existujících se **nepřepisují**.
PDF čte stejný `stagePlan` — žádný druhý layout.

Zároveň s F5 se řeší **obrazovka `02 INPUTS`**, kterou F3 odložila: dnes se inputy editují
v modálu uvnitř setupu, takže krok `02` v procesní stopě má stav `unavailable`. V
`app/shell/chrome/processSteps.ts` stačí u kroku přepsat `segment` z `null` na routu.

## Samostatné položky mimo fáze

| Co | Odkud |
|---|---|
| Chybějící tlačítko Setup u LEAD VOCS — funkční bug, ne vizuál | vyřazeno z F1, F2 i F3 |
| Hlídání neuložených změn při zavření okna (`onCloseRequested`) — vlastní `✕` i nativní ho obchází | vědomá mezera F3 |
| Ukládání velikosti a pozice okna mezi spuštěními | zamítnuto v F3 jako nevzniklá potřeba |
| `npm run build` v `packages/desktop` padá na `tsc` (typové chyby ve 4 testovacích souborech), takže `npm run tauri:build` neprojde | nález při F3 |

## Jak fázi otevřít

Precedens F1 až F3: nejdřív brainstorming a schválený návrh, pak spec do
`docs/superpowers/specs/YYYY-MM-DD-<téma>-design.md` s rozhodnutími `R1..Rn`, teprve potom
implementace. Spec se commituje zvlášť před implementací a po dokončení se do něj doplní
sekce „Stav implementace" s odchylkami, které z implementace vyplynuly.
