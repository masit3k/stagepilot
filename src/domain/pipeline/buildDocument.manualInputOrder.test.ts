import { describe, expect, it } from "vitest";
import type { DataRepository } from "../../infra/fs/repo.js";
import type {
  Band,
  Musician,
  NotesTemplate,
  Preset,
  Project,
} from "../model/types.js";
import { buildDocument } from "./buildDocument.js";

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
  presets: [{ kind: "preset", ref: "bass_rig" }],
};

const preset: Preset = {
  type: "preset",
  id: "bass_rig",
  label: "Bass rig",
  group: "bass",
  inputs: [
    { key: "bass_di", label: "Bass DI", group: "bass" },
    { key: "bass_mic", label: "Bass mic", group: "bass" },
    { key: "bass_sub", label: "Bass sub", group: "bass" },
  ],
};

const notes: NotesTemplate = {
  id: "notes_default_cs",
  lang: "cs",
  inputs: [],
  monitors: [],
};

function makeProject(extra: Partial<Project> = {}): Project {
  return {
    id: "p1",
    bandRef: "band",
    purpose: "event",
    documentDate: "2026-01-01",
    lineup: { bass: { musicianId: "bass-1" } },
    ...extra,
  } as Project;
}

function makeRepo(project: Project): DataRepository {
  return {
    getBand: () => band,
    getMusician: () => musician,
    getProject: () => project,
    getPreset: (id: string) => {
      if (id === "bass_rig") return preset;
      if (id === "wedge_foh") {
        return {
          type: "monitor",
          id,
          label: "Wedge",
          kind: "wedge",
          supplier: "foh",
        };
      }
      throw new Error(`unknown preset ${id}`);
    },
    getNotesTemplate: () => notes,
  } as DataRepository;
}

function build(extra: Partial<Project> = {}) {
  const project = makeProject(extra);
  return buildDocument(project, makeRepo(project));
}

describe("buildDocument manual input order", () => {
  it("numbers channels from one in computed order when the project has none", () => {
    const vm = build();

    expect(vm.inputs.map((input) => [input.key, input.ch])).toEqual([
      ["bass_di", 1],
      ["bass_mic", 2],
      ["bass_sub", 3],
    ]);
  });

  it("renumbers channels according to the manual order", () => {
    const vm = build({ inputOrder: ["bass_sub", "bass_di", "bass_mic"] });

    expect(vm.inputs.map((input) => [input.key, input.ch])).toEqual([
      ["bass_sub", 1],
      ["bass_di", 2],
      ["bass_mic", 3],
    ]);
  });

  it("ignores a manual key the project no longer has (R10)", () => {
    const vm = build({ inputOrder: ["gone", "bass_sub", "bass_di"] });

    expect(vm.inputs.map((input) => input.key)).toEqual([
      "bass_sub",
      "bass_di",
      "bass_mic",
    ]);
  });

  it("keeps the printed rows consistent with the renumbered channels", () => {
    const vm = build({ inputOrder: ["bass_sub", "bass_di", "bass_mic"] });

    expect(vm.inputRows.map((row) => [row.no, row.label])).toEqual([
      ["1", "Bass sub"],
      ["2", "Bass DI"],
      ["3", "Bass mic"],
    ]);
  });
});
