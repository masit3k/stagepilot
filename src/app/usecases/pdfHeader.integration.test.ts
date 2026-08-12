import { describe, expect, it } from "vitest";
import type { Band, Musician, NotesTemplate, Preset, ProjectJsonV2 } from "../../domain/model/types.js";
import { buildDocument } from "../../domain/pipeline/buildDocument.js";
import type { DataRepository } from "../../infra/fs/repo.js";
import { pdfLayout } from "../../infra/pdf/layout.js";
import { renderInputlistHtml } from "../../infra/pdf/template.js";
import { normalizeProject } from "./normalizeProject.js";

/**
 * The header now renders on both pages, so assertions split the HTML the
 * same way template.test.ts does: page one runs up to the page-two anchor,
 * page two picks up from there.
 */
function splitPages(html: string): { page1: string; page2: string } {
  const page2Start = html.indexOf(`id="${pdfLayout.ids.page2}"`);
  return { page1: html.slice(0, page2Start), page2: html.slice(page2Start) };
}

function createRepo(): DataRepository {
  const band: Band = {
    id: "band",
    name: "Band",
    bandLeader: "bass-1",
    defaultLineup: { bass: ["bass-1"] },
    defaultOverlays: { leadVocals: [], backVocals: [] },
  };
  const musician: Musician = {
    id: "bass-1",
    firstName: "Bass",
    lastName: "Player",
    group: "bass",
    presets: [{ kind: "preset", ref: "el_bass_xlr_pedalboard" }],
  };
  const bassPreset: Preset = {
    type: "preset",
    id: "el_bass_xlr_pedalboard",
    label: "Electric bass guitar",
    group: "bass",
    inputs: [{ key: "el_bass_xlr_pedalboard", label: "Electric bass guitar", group: "bass" }],
  };
  const notes: NotesTemplate = { id: "notes_default_cs", lang: "cs", inputs: [], monitors: [] };

  return {
    getBand: () => band,
    getMusician: () => musician,
    getProject: () => {
      throw new Error("not needed");
    },
    getPreset: (id: string) => {
      if (id === "el_bass_xlr_pedalboard") return bassPreset;
      if (id === "wedge_foh") return { type: "monitor", id, label: "Wedge", kind: "wedge", supplier: "foh" };
      if (id === "talkback") {
        return {
          type: "talkback_type",
          id: "talkback",
          label: "Talkback",
          group: "talkback",
          input: { key: "tb_{ownerKey}", label: "Talkback ({ownerLabel})" },
        };
      }
      throw new Error(`unknown preset ${id}`);
    },
    getNotesTemplate: () => notes,
  };
}

describe("pdf header integration (project json -> normalize -> buildDocument -> template)", () => {
  it("renders generic metadata as one line with updatedAt date", () => {
    const repo = createRepo();
    const json: ProjectJsonV2 = {
      id: "g-meta",
      bandRef: "band",
      purpose: "generic",
      note: "Léto s Blaníkem",
      documentDate: "2026-01-01",
      updatedAt: "2026-03-16T09:45:00.000Z",
    };

    const vm = buildDocument(normalizeProject(json), repo);
    const html = renderInputlistHtml(vm, { tabTitle: "Stageplan", baseHref: "file:///tmp/" });
    const { page1, page2 } = splitPages(html);

    expect(page1).toContain("INPUT LIST · Léto s Blaníkem 2026");
    expect(page2).toContain("STAGE PLAN · Léto s Blaníkem 2026");
    expect(html.match(/UPD 16\. 3\. 2026/g) ?? []).toHaveLength(2);
    expect(html).not.toContain("UPD 1. 1. 2026");
  });

  it("renders event date and venue with the updatedAt date", () => {
    const repo = createRepo();
    const json: ProjectJsonV2 = {
      id: "e-meta",
      bandRef: "band",
      purpose: "event",
      eventDate: "2026-03-10",
      eventVenue: "Klub",
      documentDate: "2026-01-01",
      updatedAt: "2026-03-12T09:45:00.000Z",
    };

    const vm = buildDocument(normalizeProject(json), repo);
    const html = renderInputlistHtml(vm, { tabTitle: "Stageplan", baseHref: "file:///tmp/" });
    const { page1, page2 } = splitPages(html);

    expect(page1).toContain("INPUT LIST · 10. 3. 2026 · Klub");
    expect(page2).toContain("STAGE PLAN · 10. 3. 2026 · Klub");
    expect(html.match(/UPD 12\. 3\. 2026/g) ?? []).toHaveLength(2);
    expect(html).not.toContain("UPD 1. 1. 2026");
  });

  it("prefers contentUpdatedAt over updatedAt when both stamps are present", () => {
    const repo = createRepo();
    const json: ProjectJsonV2 = {
      id: "e-content-meta",
      bandRef: "band",
      purpose: "event",
      eventDate: "2026-03-10",
      eventVenue: "Klub",
      documentDate: "2026-01-01",
      updatedAt: "2026-07-30T09:45:00.000Z",
      contentUpdatedAt: "2026-07-15T09:45:00.000Z",
    };

    const vm = buildDocument(normalizeProject(json), repo);
    const html = renderInputlistHtml(vm, { tabTitle: "Stageplan", baseHref: "file:///tmp/" });

    expect(html.match(/UPD 15\. 7\. 2026/g) ?? []).toHaveLength(2);
    expect(html).not.toContain("UPD 30. 7. 2026");
  });
});
