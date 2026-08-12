import type { DocumentHeaderModel, DocumentViewModel } from "../../domain/model/types.js";
import { pdfLayout, pdfTokens } from "./layout.js";
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

/**
 * Znak XLR je inline SVG, ne soubor: odpadá tím závislost na baseHref a jedna
 * cesta k selhání. Geometrie je z docs/design/brand-handoff-2026-08/README.md.
 */
function renderMark(): string {
  return `<svg class="docHeader__mark" viewBox="0 0 64 64" fill="none">
      <rect x="26" y="1" width="12" height="11" rx="3" fill="${pdfTokens.ink}" />
      <circle cx="32" cy="34" r="22" stroke="${pdfTokens.ink}" stroke-width="6" />
      <circle cx="32" cy="25" r="5.5" fill="${pdfTokens.signal}" />
      <circle cx="23" cy="41" r="5.5" fill="${pdfTokens.ink}" />
      <circle cx="41" cy="41" r="5.5" fill="${pdfTokens.ink}" />
    </svg>`;
}

function renderDocumentHeader(args: {
  header: DocumentHeaderModel;
  bandName: string;
  documentKind: string;
  logoHref?: string;
}): string {
  const markHtml = args.logoHref
    ? `<img class="docHeader__logo" src="${esc(args.logoHref)}" alt="" />`
    : renderMark();

  const metaText = [args.documentKind, ...args.header.contextParts].join(" · ");

  return `<header class="docHeader">
      ${markHtml}
      <div class="docHeader__title">
        <div class="docHeader__band">${esc(args.bandName)}</div>
        <div class="docHeader__meta">${esc(metaText)}</div>
      </div>
      <div class="docHeader__stamp">STAGEPILOT<br />UPD ${esc(args.header.updatedDate)}</div>
    </header>`;
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
    ${renderDocumentHeader({
      header: vm.meta.header,
      bandName: vm.meta.bandName,
      documentKind: "INPUT LIST",
      logoHref: opts.logoHref,
    })}

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
    ${renderDocumentHeader({
      header: vm.meta.header,
      bandName: vm.meta.bandName,
      documentKind: "STAGE PLAN",
      logoHref: opts.logoHref,
    })}
    <main id="${pdfLayout.ids.content2}" class="stageplanPageContent">
      ${stageplanHtml}
    </main>
  </div>
</body>
</html>`.trim();
}
