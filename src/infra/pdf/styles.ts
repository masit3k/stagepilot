import { pdfLayout, pdfTokens } from "./layout.js";
import { stageplanLayout } from "./sections/stageplan.js";

export const pdfStyles = `
/* ===============================
   Local fonts (deterministic)

   Obě rodiny jsou SIL OFL 1.1 a leží v repu vedle licenčních textů. Nic se
   nestahuje ze sítě — render musí být stejný na každém stroji.
   Space Grotesk je jeden variabilní soubor pro váhy 300-700, proto jeden
   @font-face místo tří statických řezů.
   =============================== */
@font-face {
  font-family: 'Space Grotesk';
  font-style: normal;
  font-weight: 300 700;
  src: url('./fonts/SpaceGrotesk/SpaceGrotesk-Variable.ttf') format('truetype-variations');
}

@font-face {
  font-family: 'IBM Plex Mono';
  font-style: normal;
  font-weight: 400;
  src: url('./fonts/IBMPlexMono/IBMPlexMono-Regular.ttf') format('truetype');
}

@font-face {
  font-family: 'IBM Plex Mono';
  font-style: normal;
  font-weight: 500;
  src: url('./fonts/IBMPlexMono/IBMPlexMono-Medium.ttf') format('truetype');
}

/* ===============================
   Page setup
   =============================== */
@page {
  size: ${pdfLayout.page.size};
  margin: ${pdfLayout.page.margins.top}
          ${pdfLayout.page.margins.right}
          ${pdfLayout.page.margins.bottom}
          ${pdfLayout.page.margins.left};
}

* { box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
}

body {
  font-family: ${pdfLayout.typography.fontFamily}, 'Segoe UI', Helvetica, Arial, sans-serif;
  color: #000;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Wrappery pro overflow check v pdf.ts */
#${pdfLayout.ids.page} { }
#${pdfLayout.ids.content} { }
#${pdfLayout.ids.page2} { }
#${pdfLayout.ids.content2} { }

.pdfPage {
  position: relative;
}

.pdfPage--break {
  break-after: page;
  page-break-after: always;
}

/* ===============================
   Constants for lines
   =============================== */
:root {
  --block-gap: 14pt;

  /* line color + widths (single source of truth) */
  --c-line: #000;
  --w-frame: 2pt;   /* outer frame + header separator */
  --w-grid: 0.5pt;  /* inner grid */
}

/* ===============================
   Hlavička dokumentu
   =============================== */
.docHeader {
  display: flex;
  align-items: flex-start;
  gap: ${pdfLayout.header.gapPt}pt;
  padding-bottom: ${pdfLayout.header.padBottomPt}pt;
  border-bottom: ${pdfLayout.header.rulePt}pt solid ${pdfTokens.ink};
  margin-bottom: ${pdfLayout.header.marginBottomPt}pt;
}

.docHeader__mark {
  flex: 0 0 auto;
  width: ${pdfLayout.header.markSizePt}pt;
  height: ${pdfLayout.header.markSizePt}pt;
}

.docHeader__logo {
  flex: 0 0 auto;
  height: ${pdfLayout.header.markSizePt}pt;
  width: auto;
  max-width: ${pdfLayout.header.logoMaxWidthMm}mm;
}

.docHeader__title {
  display: flex;
  flex-direction: column;
  gap: ${pdfLayout.header.textGapPt}pt;
  min-width: 0;
}

.docHeader__band {
  font-size: ${pdfLayout.typography.title.size};
  font-weight: ${pdfLayout.typography.title.weight};
  line-height: ${pdfLayout.typography.title.lineHeight};
  letter-spacing: ${pdfLayout.typography.title.tracking};
  color: ${pdfTokens.ink};
}

.docHeader__meta {
  font-family: '${pdfLayout.typography.monoFamily}', Consolas, monospace;
  font-size: ${pdfLayout.typography.meta.size};
  line-height: ${pdfLayout.typography.meta.lineHeight};
  letter-spacing: ${pdfLayout.typography.meta.tracking};
  text-transform: uppercase;
  color: ${pdfTokens.body};
}

.docHeader__stamp {
  margin-left: auto;
  text-align: right;
  white-space: nowrap;
  font-family: '${pdfLayout.typography.monoFamily}', Consolas, monospace;
  font-size: ${pdfLayout.typography.stamp.size};
  line-height: ${pdfLayout.typography.stamp.lineHeight};
  letter-spacing: ${pdfLayout.typography.stamp.tracking};
  color: ${pdfTokens.steel};
}

/* ===============================
   Patička dokumentu
   =============================== */
.docFooter {
  display: flex;
  align-items: baseline;
  gap: 12pt;
  padding-top: ${pdfLayout.footer.padTopPt}pt;
  border-top: ${pdfLayout.footer.rulePt}pt solid ${pdfTokens.line};
  font-family: '${pdfLayout.typography.monoFamily}', Consolas, monospace;
  font-size: ${pdfLayout.typography.footer.size};
  line-height: ${pdfLayout.typography.footer.lineHeight};
  letter-spacing: ${pdfLayout.typography.footer.tracking};
  text-transform: uppercase;
  color: ${pdfTokens.steel};
}

.docFooter__contact {
  min-width: 0;
  overflow: hidden;
  text-overflow: clip;
  white-space: nowrap;
}

.docFooter__page {
  margin-left: auto;
  white-space: nowrap;
}

/* ===============================
   Table blocks (outer thick frame)
   =============================== */
.tableBlock {
  border: var(--w-frame) solid var(--c-line);
  padding: 0;
  margin: 0 0 var(--block-gap) 0;
}

/* ===============================
   Table (thin inner grid)
   =============================== */
.table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: ${pdfLayout.typography.table.size};
  line-height: ${pdfLayout.typography.table.lineHeight};
}

/* Spacing between two consecutive tables (works even without .tableBlock) */
.table + .table {
  margin-top: 12pt;
}

.table th,
.table td {
  border: var(--w-grid) solid var(--c-line);
  padding: ${pdfLayout.table.padY} ${pdfLayout.table.padX};
  vertical-align: middle;
}

/* Header row: left aligned, vertically centered, thick bottom border */
.table thead th {
  font-weight: ${pdfLayout.typography.table.headerWeight};
  text-align: left;
  vertical-align: middle;
  line-height: 1;
  padding-top: 4pt;
  padding-bottom: 4pt;
  border-bottom: var(--w-frame) solid var(--c-line);
}

/* keep "no." header centered horizontally */
.table thead th.colNo {
  text-align: center;
}

/* ===== Remove outer cell borders (avoid double line with .tableBlock frame) ===== */
.tableBlock .table tr > *:first-child { border-left: none; }
.tableBlock .table tr > *:last-child { border-right: none; }
.tableBlock .table thead tr:first-child > * { border-top: none; }
.tableBlock .table tbody tr:last-child > * { border-bottom: none; }

/* Columns */
.colNo {
  width: ${pdfLayout.table.colNo};
  text-align: center;
  white-space: nowrap;
}

.colInput {
  width: ${pdfLayout.table.colInput};
  text-align: left;
  white-space: nowrap;
}

.colNote {
  width: auto;
  text-align: left;
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
}

/* no. in body bold */
.table tbody td.colNo {
  font-weight: 700;
}

/* ===============================
   Legacy cleanup
   =============================== */
.groupTitle,
.stageGroupTitle,
.group h2 {
  display: none !important;
}

/* ===============================
   Notes under tables (no border)
   =============================== */

.notesBlock {
  margin-top: 22pt;          /* výrazná mezera od tabulek */
}

.notes {
  font-size: ${pdfLayout.typography.table.size};
  line-height: 1.4;
  color: #000000;
}

.noteLine {
  margin: 0 0 12pt 0;        /* větší mezery mezi poznámkami */
}

/* ===============================
   Stageplan section
   =============================== */

.stageplanSection {
  text-align: center;
}

.stageplanContainer {
  display: inline-block;
  margin-top: ${stageplanLayout.containerMarginTop};
  padding: ${stageplanLayout.containerPad};
  background: #eeeeee;
  border: 1px solid var(--c-line);
}

.stageplanArea {
  position: relative;
  width: ${stageplanLayout.areaWidthMm}mm;
  margin: 0;
}

.stageplanBox {
  position: absolute;
  border: 2px solid var(--c-line);
  background: #fff;
  padding: 0 ${stageplanLayout.padX} ${stageplanLayout.boxPaddingBottom};
  padding-top: ${stageplanLayout.boxTitleGap};
  font-size: ${stageplanLayout.textSize};
  line-height: ${stageplanLayout.textLineHeight};
}

.stageplanBox--withPower {
  padding-bottom: 0;
}

.stageplanBoxHeader {
  font-weight: 700;
  margin: 0;
  padding-top: 0;
  text-align: center;
}

.stageplanTitleGap {
  height: ${stageplanLayout.boxTitleGap};
}

.stageplanBoxLine {
  margin: 0;
  text-align: center;
  white-space: normal;
  word-break: break-word;
}

.stageplanBoxLine .bullet {
  display: inline-block;
  margin-right: 6px;
}

.stageplanBoxLine .text {
  display: inline-block;
}

.stageplanGap {
  height: calc(1em * ${stageplanLayout.textLineHeight});
}

.stageplanPower {
  position: absolute;
  right: -2px;
  bottom: -2px;
  border: 2px solid var(--c-line);
  background: ${stageplanLayout.powerCellColor};
  padding: ${stageplanLayout.padY} ${stageplanLayout.padX};
  font-size: ${stageplanLayout.textSize};
  line-height: ${stageplanLayout.textLineHeight};
  white-space: nowrap;
}

.stageplanPowerGap {
  height: ${stageplanLayout.powerBadgeSpacerHeight};
}


`.trim();
