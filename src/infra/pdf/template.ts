import type { DocumentViewModel } from "../../domain/model/types.js";
import { pdfStyles } from "./styles.js";
import { pdfLayout } from "./layout.js";

function esc(s: unknown): string {
  const str = s == null ? "" : String(s);
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatDateCZ(iso: string): string {
  // ISO "YYYY-MM-DD" -> "D. M. YYYY"
  const d = new Date(iso);
  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  return `${day}. ${month}. ${year}`;
}

function renderNotesBlock(title: string | null, lines: Array<{ text: string }> | undefined): string {
  const items = (lines ?? []).filter((x) => x.text && x.text.trim() !== "");
  if (items.length === 0) return "";

  const titleHtml = title ? `<div class="notesTitle">${esc(title)}</div>` : "";

  return `
<div class="notes">
  ${titleHtml}
  ${items.map((x) => `<div class="noteLine">${esc(x.text)}</div>`).join("\n")}
</div>`.trim();
}

function renderInputTable(vm: DocumentViewModel): string {
  const rowsHtml = (vm.inputRows ?? [])
    .map((r) => {
      return `
<tr>
  <td class="colNo">${esc(r.no)}</td>
  <td class="colInput">${esc(r.label)}</td>
  <td class="colNote">${r.note ? esc(r.note) : ""}</td>
</tr>`.trim();
    })
    .join("\n");

  return `
<table class="table inputTable">
  <thead>
    <tr>
      <th class="colNo">no.</th>
      <th class="colInput">input</th>
      <th class="colNote">note</th>
    </tr>
  </thead>
  <tbody>
    ${rowsHtml}
  </tbody>
</table>`.trim();
}

function renderMonitorTable(vm: DocumentViewModel): string {
  const rowsSrc: Array<{ no: string; output: string; note: string }> =
    (vm as any).monitorTableRows ?? [];

  // pokud monitorTableRows není přítomné, netiskni tabulku
  if (!rowsSrc || rowsSrc.length === 0) return "";

  const rows = rowsSrc
    .map((r) => {
      return `
<tr>
  <td class="colNo">${esc(r.no)}</td>
  <td class="colInput">${esc(r.output)}</td>
  <td class="colNote">${esc(r.note)}</td>
</tr>`.trim();
    })
    .join("\n");

  return `
<table class="table monitorTable">
  <thead>
    <tr>
      <th class="colNo">no.</th>
      <th class="colInput">monitor output</th>
      <th class="colNote">note</th>
    </tr>
  </thead>
  <tbody>
    ${rows}
  </tbody>
</table>`.trim();
}

export interface RenderTemplateOptions {
  tabTitle: string;
  baseHref: string; // file:///.../src/infra/pdf/
  contactLine?: string;
}

export function renderInputlistHtml(vm: DocumentViewModel, opts: RenderTemplateOptions): string {
  const contactHtml = opts.contactLine
    ? `<div class="contactLine">${esc(opts.contactLine)}</div>`
    : "";

  const eventDate = vm.meta.date ? formatDateCZ(vm.meta.date) : "";
  const venue = vm.meta.venue?.trim();

  const metaHtml = `
<div class="metaLine">
  <span class="metaLabel">Datum akce:</span> ${esc(eventDate)}
  ${venue ? `<span class="metaSep">•</span><span class="metaLabel">Místo:</span> ${esc(venue)}` : ""}
</div>`.trim();

  // TABLES
  const inputTableHtml = renderInputTable(vm);
  const monitorTableHtml = renderMonitorTable(vm);

  // NOTES: vždy až POD oběma tabulkami
  const inputNotesHtml = renderNotesBlock(null, vm.notes?.inputs);
  const monitorNotesHtml = renderNotesBlock(null, vm.notes?.monitors);

  return `<!doctype html>
<html lang="cs">
<head>
  <meta charset="utf-8" />
  <title>${esc(opts.tabTitle)}</title>
  <base href="${esc(opts.baseHref)}">
  <style>
${pdfStyles}
  </style>
</head>

<body>
  <div id="${pdfLayout.ids.page}">
    <header class="header">
      <div class="headerCenter">
        <div class="bandName">${esc(vm.meta.bandName)}</div>
        ${metaHtml}
        ${contactHtml}
      </div>
    </header>

<main id="${pdfLayout.ids.content}">

  <!-- INPUT LIST -->
  <div class="tableBlock">
    <table class="table inputTable">
      <thead>
        <tr>
          <th class="colNo">no.</th>
          <th class="colInput">input</th>
          <th class="colNote">note</th>
        </tr>
      </thead>
      <tbody>
        ${vm.inputRows.map(r => `
          <tr>
            <td class="colNo">${esc(r.no)}</td>
            <td class="colInput">${esc(r.label)}</td>
            <td class="colNote">${r.note ? esc(r.note) : ""}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  </div>

  <!-- MONITORS (spec table) -->
  <div class="tableBlock">
    ${monitorTableHtml}
  </div>

  <!-- NOTES (ALWAYS AFTER BOTH TABLES) -->
  <div class="notesBlock">
    <div class="notes">
      ${vm.notes.inputs.map(n => `<div class="noteLine">${esc(n.text)}</div>`).join("")}
      ${vm.notes.monitors.map(n => `<div class="noteLine">${esc(n.text)}</div>`).join("")}
    </div>
  </div>

</main>

  </div>
</body>
</html>`.trim();
}