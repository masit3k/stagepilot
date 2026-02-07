import { pdfLayout } from "./layout.js";

export const pdfStyles = `
/* ===============================
   Local fonts (deterministic)
   =============================== */
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 400;
  src: url('./fonts/Inter/Inter-Regular.ttf') format('truetype');
}

@font-face {
  font-family: 'Inter';
  font-style: italic;
  font-weight: 400;
  src: url('./fonts/Inter/Inter-Italic.ttf') format('truetype');
}

@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 700;
  src: url('./fonts/Inter/Inter-Bold.ttf') format('truetype');
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
  font-family: ${pdfLayout.typography.fontFamily}, Helvetica, Arial, sans-serif;
  color: #000;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Wrappery pro overflow check v pdf.ts */
#${pdfLayout.ids.page} { }
#${pdfLayout.ids.content} { }

/* ===============================
   Constants for lines
   =============================== */
:root {
  --header-gap: 6pt;
  --block-gap: 14pt;
  --meta-contact-letter-spacing: 0.2px;

  /* line color + widths (single source of truth) */
  --c-line: #000;
  --w-frame: 2pt;   /* outer frame + header separator */
  --w-grid: 0.5pt;  /* inner grid */
}

/* ===============================
   Header (Variant A)
   =============================== */
.header {
  margin-bottom: 12pt;
  position: relative;
}

.headerCenter {
  text-align: center;
}

.bandName {
  font-size: ${pdfLayout.typography.title.size};
  font-weight: ${pdfLayout.typography.title.weight};
  line-height: ${pdfLayout.typography.title.lineHeight};
  margin: 0 0 var(--header-gap) 0;
  letter-spacing: 0.2px;
}

.bandLogo {
  position: absolute;
  left: 0;
  top: 0;
  width: 40mm;
  height: auto;
}

/* Datum/Místo – celé kurzívou */
.metaLine {
  margin: 0 0 var(--header-gap) 0;
  font-size: ${pdfLayout.typography.contact.size};
  line-height: 1.2;
  letter-spacing: var(--meta-contact-letter-spacing);
  color: #222;
  font-style: italic;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: clip;
}

.metaLabel {
  color: #222;
}

.metaSep {
  margin: 0 6pt;
  color: #444;
}

.contactLine {
  margin: 0;
  font-size: ${pdfLayout.typography.contact.size};
  font-weight: ${pdfLayout.typography.contact.weight};
  line-height: ${pdfLayout.typography.contact.lineHeight};
  letter-spacing: var(--meta-contact-letter-spacing);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: clip;
  color: #111;
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
  font-size: 10pt;            /* MENŠÍ písmo – jasně menší než tabulka */
  line-height: 1.4;
  font-style: italic;        /* použije Inter-Italic.ttf */
  color: #222;
}

.noteLine {
  margin: 0 0 12pt 0;        /* větší mezery mezi poznámkami */
}


`.trim();
