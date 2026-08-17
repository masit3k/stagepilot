import { describe, expect, it } from "vitest";
import type {
  Musician,
  NotesTemplate,
  PresetEntity,
  Project,
} from "../../../../../../src/domain/model/types";
import { buildDocument } from "../../../../../../src/domain/pipeline/buildDocument";
import type { BandSetupData } from "../../shell/types";
import { createDocumentRepository } from "./createDocumentRepository";

/**
 * Nejmenší platný `BandSetupData` — `id`, `name` a `members` jsou povinné,
 * i když je konkrétní test nepoužívá. Přetypováním se to nesmí obcházet,
 * jinak testy nechytí rozpad tvaru payloadu z `get_band_setup_data`.
 */
function makeSetupData(overrides: Partial<BandSetupData> = {}): BandSetupData {
  return {
    id: "band-1",
    name: "Test band",
    members: {},
    ...overrides,
  };
}

const project: Project = {
  id: "p1",
  bandRef: "band-1",
  purpose: "generic",
  documentDate: "2026-01-01",
};

describe("createDocumentRepository", () => {
  it("getProject returns the same project regardless of id", () => {
    const repo = createDocumentRepository({
      project,
      setupData: makeSetupData(),
    });

    expect(repo.getProject("band-1")).toBe(project);
    expect(repo.getProject("anything-else")).toBe(project);
  });

  it("getPreset returns a catalog entry by id", () => {
    const preset: PresetEntity = {
      type: "preset",
      id: "bass_rig",
      label: "Bass rig",
      group: "bass",
      inputs: [{ key: "bass_di", label: "Bass DI", group: "bass" }],
    };
    const repo = createDocumentRepository({
      project,
      setupData: makeSetupData({ presetCatalog: { bass_rig: preset } }),
    });

    expect(repo.getPreset("bass_rig")).toBe(preset);
  });

  it("getPreset throws with the missing id when the preset is unknown", () => {
    const repo = createDocumentRepository({
      project,
      setupData: makeSetupData({ presetCatalog: {} }),
    });

    expect(() => repo.getPreset("unknown_preset")).toThrowError(
      /unknown_preset/,
    );
  });

  it("getMusician returns the full musician, including group and presets", () => {
    const musician: Musician = {
      id: "bass-1",
      firstName: "Bass",
      lastName: "Player",
      group: "bass",
      presets: [{ kind: "preset", ref: "bass_rig" }],
    };
    const repo = createDocumentRepository({
      project,
      setupData: makeSetupData({ musicians: { "bass-1": musician } }),
    });

    const found = repo.getMusician("bass-1");
    expect(found.group).toBe("bass");
    expect(found.presets).toEqual([{ kind: "preset", ref: "bass_rig" }]);
  });

  it("getMusician throws with the missing id when the musician is unknown", () => {
    const repo = createDocumentRepository({
      project,
      setupData: makeSetupData({ musicians: {} }),
    });

    expect(() => repo.getMusician("unknown-musician")).toThrowError(
      /unknown-musician/,
    );
  });

  it("getNotesTemplate returns the template when the id matches notesTemplateRef", () => {
    const template: NotesTemplate = {
      id: "notes_default_cs",
      lang: "cs",
      inputs: [],
      monitors: [],
    };
    const repo = createDocumentRepository({
      project,
      setupData: makeSetupData({
        notesTemplateRef: "notes_default_cs",
        notesTemplate: template,
      }),
    });

    expect(repo.getNotesTemplate("notes_default_cs")).toBe(template);
  });

  it("getNotesTemplate throws for an id other than notesTemplateRef", () => {
    const template: NotesTemplate = {
      id: "notes_default_cs",
      lang: "cs",
      inputs: [],
      monitors: [],
    };
    const repo = createDocumentRepository({
      project,
      setupData: makeSetupData({
        notesTemplateRef: "notes_default_cs",
        notesTemplate: template,
      }),
    });

    expect(() => repo.getNotesTemplate("notes_other")).toThrowError(
      /notes_other/,
    );
  });

  it("getBand composes id, name, notesTemplateRef, defaultLineup and defaultOverlays", () => {
    const repo = createDocumentRepository({
      project,
      setupData: makeSetupData({
        id: "band-1",
        name: "Test band",
        notesTemplateRef: "notes_default_cs",
        defaultLineup: { bass: ["bass-1"], drums: ["drums-1"] },
        defaultOverlays: { leadVocals: ["bass-1"], backVocals: [] },
      }),
    });

    const band = repo.getBand("band-1");

    expect(band.id).toBe("band-1");
    expect(band.name).toBe("Test band");
    expect(band.notesTemplateRef).toBe("notes_default_cs");
    expect(band.defaultLineup).toEqual({
      bass: ["bass-1"],
      drums: ["drums-1"],
    });
    expect(band.defaultOverlays).toEqual({
      leadVocals: ["bass-1"],
      backVocals: [],
    });
  });

  /**
   * Tohle je test, o který ve skutečnosti jde: dokazuje, že adaptér skládá
   * repozitář, který skutečné `buildDocument` prožene end-to-end a vyprodukuje
   * stejná čísla kanálů, jaká uvidí tisk. Kdyby adaptér vracel cokoliv
   * nekonzistentního (chybějící preset, špatně tvarovaný defaultLineup,
   * nenalezenou notes šablonu), `buildDocument` by na tom spadl — a to je
   * přesně to, co má tento test zachytit.
   */
  it("feeds buildDocument end to end and produces the printed channel numbers", () => {
    const e2eProject: Project = {
      id: "p1",
      bandRef: "band",
      purpose: "event",
      documentDate: "2026-01-01",
      lineup: { bass: { musicianId: "bass-1" } },
    } as Project;

    const musician: Musician = {
      id: "bass-1",
      firstName: "Bass",
      lastName: "Player",
      group: "bass",
      presets: [{ kind: "preset", ref: "bass_rig" }],
    };

    const bassRig: PresetEntity = {
      type: "preset",
      id: "bass_rig",
      label: "Bass rig",
      group: "bass",
      inputs: [
        { key: "bass_di", label: "Bass DI", group: "bass" },
        { key: "bass_amp", label: "Bass amp mic", group: "bass" },
      ],
    };

    const wedgeFoh: PresetEntity = {
      type: "monitor",
      id: "wedge_foh",
      label: "Wedge",
      kind: "wedge",
      supplier: "foh",
    };

    const notesTemplate: NotesTemplate = {
      id: "notes_default_cs",
      lang: "cs",
      inputs: [],
      monitors: [],
    };

    const setupData = makeSetupData({
      id: "band",
      name: "Band",
      bandLeader: "bass-1",
      defaultLineup: { bass: ["bass-1"] },
      defaultOverlays: { leadVocals: [], backVocals: [] },
      musicians: { "bass-1": musician },
      presetCatalog: { bass_rig: bassRig, wedge_foh: wedgeFoh },
      notesTemplateRef: "notes_default_cs",
      notesTemplate,
    });

    const repo = createDocumentRepository({ project: e2eProject, setupData });
    const vm = buildDocument(e2eProject, repo);

    expect(
      vm.inputs.map((input) => ({
        ch: input.ch,
        key: input.key,
        label: input.label,
      })),
    ).toEqual([
      { ch: 1, key: "bass_di", label: "Bass DI" },
      { ch: 2, key: "bass_amp", label: "Bass amp mic" },
    ]);
  });
});
