import type { DocumentHeaderModel, DocumentViewModel } from "../../domain/model/types.js";
import { pdfLayout } from "./layout.js";
import { renderStageplanSection } from "./sections/stageplan.js";
import type { StageplanRenderOptions } from "./stageplanRenderOptions.js";
import { pdfStyles } from "./styles.js";

function esc(s: unknown): string {
  const str = s == null ? "" : String(s);
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderMetaLine(header: DocumentHeaderModel, esc: (s: string) => string): string {
  const parts = [...header.contextParts, `UPD ${header.updatedDate}`];
  return `<div class="metaLine">${esc(parts.join(" · "))}</div>`;
}

function renderMonitorTable(vm: DocumentViewModel): string {
  const rowsSrc = vm.monitorTableRows;

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
  logoHref?: string;
  stageplan?: Partial<StageplanRenderOptions>;
}

export function renderInputlistHtml(vm: DocumentViewModel, opts: RenderTemplateOptions): string {
  const contactHtml = opts.contactLine
    ? `<div class="contactLine">${esc(opts.contactLine)}</div>`
    : "";

  const metaHtml = renderMetaLine(vm.meta.header, esc);

  // TABLES
  const monitorTableHtml = renderMonitorTable(vm);

  // NOTES: vždy až POD oběma tabulkami
  const stageplanHtml = renderStageplanSection(vm, opts.stageplan);

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
  <div class="pdfPage pdfPage--break" id="${pdfLayout.ids.page}">
    <header class="header">
      ${opts.logoHref ? `<img class="bandLogo" src="${esc(opts.logoHref)}" alt="" />` : ""}
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

  <div class="pdfPage" id="${pdfLayout.ids.page2}">
    <main id="${pdfLayout.ids.content2}" class="stageplanPageContent">
      ${stageplanHtml}
    </main>
  </div>
</body>
</html>`.trim();
}
