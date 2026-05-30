import { describe, expect, it } from "vitest";
import type { DataRepository } from "../../infra/fs/repo.js";
import type {
  Band,
  Musician,
  NotesTemplate,
  PresetEntity,
  Project,
} from "../model/types.js";
import { buildDocument } from "./buildDocument.js";

const notes: NotesTemplate = {
  id: "notes_default_cs",
  lang: "cs",
  inputs: [],
  monitors: [],
};

function createProject(): Project {
  return {
    id: "p-preset-diagnostics",
    bandRef: "band",
    purpose: "event",
    documentDate: "2026-01-01",
    lineup: { bass: ["bass-1"] },
  };
}

function createBand(): Band {
  return {
    id: "band",
    name: "Band",
    bandLeader: "bass-1",
    defaultLineup: { bass: ["bass-1"] },
    defaultOverlays: { leadVocals: [], backVocals: [] },
  };
}

function createMusician(presets: Musician["presets"]): Musician {
  return {
    id: "bass-1",
    firstName: "Bass",
    lastName: "Player",
    group: "bass",
    presets,
  };
}

function createRepo(args: {
  project?: Project;
  musician: Musician;
  presets: Record<string, PresetEntity>;
}): DataRepository {
  const band = createBand();
  const project = args.project ?? createProject();
  return {
    getBand: () => band,
    getMusician: () => args.musician,
    getProject: () => project,
    getPreset: (id: string) => {
      const preset = args.presets[id];
      if (!preset) throw new Error(`Unknown preset ${id}`);
      return preset;
    },
    getNotesTemplate: () => notes,
  };
}

const bassPreset: PresetEntity = {
  type: "preset",
  id: "bass_di",
  label: "Bass DI",
  group: "bass",
  setupGroup: "electric_bass",
  presetRole: "primary",
  inputs: [{ key: "bass_di", label: "Bass DI", group: "bass" }],
};

const wedgeMonitor: PresetEntity = {
  type: "monitor",
  id: "wedge",
  label: "Wedge monitor",
};

describe("buildDocument preset diagnostics", () => {
  it("fails fast for a missing explicit musician preset ref", () => {
    const musician = createMusician([
      { kind: "preset", ref: "missing_bass_di" },
      { kind: "monitor", ref: "wedge" },
    ]);
    const repo = createRepo({
      musician,
      presets: { wedge: wedgeMonitor },
    });

    expect(() => buildDocument(createProject(), repo)).toThrow(
      /Missing preset reference "missing_bass_di" while resolving setup for musician "bass-1" \(role: bass\)\./,
    );
  });

  it("fails fast for a missing explicit musician monitor ref", () => {
    const musician = createMusician([
      { kind: "preset", ref: "bass_di" },
      { kind: "monitor", ref: "missing_iem" },
    ]);
    const repo = createRepo({
      musician,
      presets: { bass_di: bassPreset, wedge: wedgeMonitor },
    });

    expect(() => buildDocument(createProject(), repo)).toThrow(
      /Missing monitor preset reference "missing_iem" while resolving setup for musician "bass-1" \(role: bass\)\./,
    );
  });

  it("fails fast for a missing explicit project monitoring override ref", () => {
    const project: Project = {
      ...createProject(),
      lineup: {
        bass: {
          musicianId: "bass-1",
          presetOverride: {
            monitoring: { monitorRef: "missing_override_iem" },
          },
        },
      },
    };
    const musician = createMusician([{ kind: "preset", ref: "bass_di" }]);
    const repo = createRepo({
      project,
      musician,
      presets: { bass_di: bassPreset, wedge: wedgeMonitor },
    });

    expect(() => buildDocument(project, repo)).toThrow(
      /Missing monitor preset reference "missing_override_iem" while resolving monitoring override for musician "bass-1" \(role: bass\)\./,
    );
  });

  it("fails fast when a musician preset ref resolves to the wrong type", () => {
    const musician = createMusician([
      { kind: "preset", ref: "bass_ref_is_monitor" },
      { kind: "monitor", ref: "wedge" },
    ]);
    const repo = createRepo({
      musician,
      presets: {
        bass_ref_is_monitor: {
          type: "monitor",
          id: "bass_ref_is_monitor",
          label: "Not a bass preset",
        },
        wedge: wedgeMonitor,
      },
    });

    expect(() => buildDocument(createProject(), repo)).toThrow(
      /Preset reference "bass_ref_is_monitor" points to type "monitor", expected "preset" while resolving setup for musician "bass-1" \(role: bass\)\./,
    );
  });

  it("fails fast when a monitor ref resolves to the wrong type", () => {
    const musician = createMusician([
      { kind: "preset", ref: "bass_di" },
      { kind: "monitor", ref: "monitor_ref_is_preset" },
    ]);
    const repo = createRepo({
      musician,
      presets: {
        bass_di: bassPreset,
        monitor_ref_is_preset: {
          type: "preset",
          id: "monitor_ref_is_preset",
          label: "Not a monitor",
          group: "bass",
          inputs: [],
        },
        wedge: wedgeMonitor,
      },
    });

    expect(() => buildDocument(createProject(), repo)).toThrow(
      /Monitor preset reference "monitor_ref_is_preset" points to type "preset", expected "monitor" while resolving setup for musician "bass-1" \(role: bass\)\./,
    );
  });

  it("fails fast for a missing assigned talkback preset ref", () => {
    const project: Project = {
      ...createProject(),
      overlays: {
        talkback: { mode: "assigned", ownerId: "bass-1" },
      },
    };
    const musician = createMusician([
      { kind: "preset", ref: "bass_di" },
      { kind: "monitor", ref: "wedge" },
    ]);
    const repo = createRepo({
      project,
      musician,
      presets: { bass_di: bassPreset, wedge: wedgeMonitor },
    });

    expect(() => buildDocument(project, repo)).toThrow(
      /Missing talkback preset reference "talkback" while resolving talkback for musician "bass-1" \(role: bass\)\./,
    );
  });
});
