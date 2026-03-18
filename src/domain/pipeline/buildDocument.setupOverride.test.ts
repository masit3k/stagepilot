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

describe("buildDocument setup overrides", () => {
  it("uses lineup monitoring + input overrides in monitor table and stageplan", () => {
    const band: Band = {
      id: "band",
      name: "Band",
      bandLeader: "bass-1",
      defaultLineup: { bass: "bass-1" },
    };
    const musician: Musician = {
      id: "bass-1",
      firstName: "Bass",
      lastName: "Player",
      group: "bass",
      presets: [
        { kind: "preset", ref: "el_bass_xlr_pedalboard" },
        { kind: "monitor", ref: "iem_stereo_wireless" },
      ],
    };
    const bassPreset: Preset = {
      type: "preset",
      id: "el_bass_xlr_pedalboard",
      label: "Electric bass guitar",
      group: "bass",
      inputs: [
        {
          key: "el_bass_xlr_pedalboard",
          label: "Electric bass guitar",
          group: "bass",
        },
      ],
    };

    const notes: NotesTemplate = {
      id: "notes_default_cs",
      lang: "cs",
      inputs: [],
      monitors: [],
    };
    const project: Project = {
      id: "p1",
      bandRef: "band",
      purpose: "event",
      documentDate: "2026-01-01",
      lineup: {
        bass: {
          musicianId: "bass-1",
          presetOverride: {
            monitoring: {
              monitorRef: "iem_stereo_wired",
              additionalWedgeCount: 2,
            },
            inputs: {
              replace: [
                {
                  targetKey: "el_bass_xlr_pedalboard",
                  with: {
                    key: "el_bass_xlr_amp",
                    label: "Electric bass guitar",
                    note: "XLR out from amp",
                    group: "bass",
                  },
                },
              ],
            },
          },
        },
      },
    };

    const repo: DataRepository = {
      getBand: () => band,
      getMusician: () => musician,
      getProject: () => project,
      getPreset: (id: string) => {
        if (id === "el_bass_xlr_pedalboard") return bassPreset;
        if (id === "iem_stereo_wireless")
          return { type: "monitor", id, label: "IEM STEREO wireless" };
        if (id === "wedge") return { type: "monitor", id, label: "Wedge" };
        if (id === "iem_stereo_wired")
          return { type: "monitor", id, label: "IEM STEREO wired" };
        if (id === "talkback")
          return {
            type: "talkback_type",
            id: "talkback",
            label: "Talkback",
            group: "talkback",
            input: { key: "tb_{ownerKey}", label: "Talkback ({ownerLabel})" },
          };
        throw new Error(`unknown preset ${id}`);
      },
      getNotesTemplate: () => notes,
    };

    const vm = buildDocument(project, repo);
    expect(
      vm.stageplan.monitorOutputs.some(
        (row) => row.note === "IEM STEREO wired + Additional wedge monitor 2x",
      ),
    ).toBe(true);
    expect(vm.inputs.some((item) => item.key === "el_bass_xlr_amp")).toBe(true);
    expect(
      vm.inputs.some((item) => item.key === "el_bass_xlr_pedalboard"),
    ).toBe(false);
  });

  it("omits talkback row when event talkback override is explicit none", () => {
    const band: Band = {
      id: "band",
      name: "Band",
      bandLeader: "bass-1",
      defaultLineup: { bass: "bass-1" },
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
      inputs: [
        {
          key: "el_bass_xlr_pedalboard",
          label: "Electric bass guitar",
          group: "bass",
        },
      ],
    };
    const notes: NotesTemplate = {
      id: "notes_default_cs",
      lang: "cs",
      inputs: [],
      monitors: [],
    };
    const project: Project = {
      id: "p-none",
      bandRef: "band",
      purpose: "event",
      documentDate: "2026-01-01",
      lineup: { bass: "bass-1" },
      talkbackOverride: { mode: "none" },
    };

    const repo: DataRepository = {
      getBand: () => band,
      getMusician: () => musician,
      getProject: () => project,
      getPreset: (id: string) => {
        if (id === "el_bass_xlr_pedalboard") return bassPreset;
        if (id === "iem_stereo_wireless")
          return { type: "monitor", id, label: "IEM STEREO wireless" };
        if (id === "wedge") return { type: "monitor", id, label: "Wedge" };
        if (id === "talkback")
          return {
            type: "talkback_type",
            id: "talkback",
            label: "Talkback",
            group: "talkback",
            input: { key: "tb_{ownerKey}", label: "Talkback ({ownerLabel})" },
          };
        throw new Error(`unknown preset ${id}`);
      },
      getNotesTemplate: () => notes,
    };

    const vm = buildDocument(project, repo);
    expect(vm.inputs.some((item) => item.group === "talkback")).toBe(false);
  });

  it("adds sound-engineer wording for vocal no-mic and wedge monitor only", () => {
    const band: Band = {
      id: "band",
      name: "Band",
      bandLeader: "lead-1",
      defaultLineup: { vocs: "lead-1", guitar: "gtr-1" },
    };
    const lead: Musician = {
      id: "lead-1",
      firstName: "Lead",
      lastName: "Singer",
      group: "vocs",
      presets: [
        { kind: "preset", ref: "vocal_lead_no_mic" },
        { kind: "monitor", ref: "wedge" },
      ],
    };
    const guitar: Musician = {
      id: "gtr-1",
      firstName: "Guitar",
      lastName: "Player",
      group: "guitar",
      presets: [
        { kind: "preset", ref: "el_guitar" },
        { kind: "monitor", ref: "iem_stereo_wireless" },
        {
          kind: "vocal",
          ref: "vocal_back_no_mic",
          ownerKey: "guitar",
          ownerLabel: "Guitar",
        },
      ],
    };
    const notes: NotesTemplate = {
      id: "notes_default_cs",
      lang: "cs",
      inputs: [],
      monitors: [],
    };
    const project: Project = {
      id: "p2",
      bandRef: "band",
      purpose: "event",
      documentDate: "2026-01-01",
      lineup: { vocs: "lead-1", guitar: "gtr-1" },
    };

    const repo: DataRepository = {
      getBand: () => band,
      getMusician: (id: string) => (id === "lead-1" ? lead : guitar),
      getProject: () => project,
      getPreset: (id: string) => {
        if (id === "vocal_lead_no_mic")
          return {
            type: "preset",
            id,
            label: "Lead vocal (no mic)",
            group: "vocs",
            inputs: [
              {
                key: "voc_lead",
                label: "Lead vocal",
                group: "vocs",
                note: "BETA 58A, SE V7, SM58 – boom mic stand (requested from sound engineer)",
              },
            ],
          };
        if (id === "vocal_back_no_mic")
          return {
            type: "vocal_type",
            id,
            label: "Back vocal (no mic)",
            group: "vocs",
            input: {
              key: "voc_back_{ownerKey}",
              label: "Back vocal – {ownerLabel}",
              note: "BETA 58A, SE V7, SM58 – boom mic stand (requested from sound engineer)",
            },
          };
        if (id === "el_guitar")
          return {
            type: "preset",
            id,
            label: "Guitar",
            group: "guitar",
            inputs: [
              { key: "gtr", label: "Guitar", group: "guitar", note: "Own DI" },
            ],
          };
        if (id === "wedge")
          return { type: "monitor", id, label: "Wedge monitor" };
        if (id === "iem_stereo_wireless")
          return { type: "monitor", id, label: "IEM STEREO wireless" };
        if (id === "talkback")
          return {
            type: "talkback_type",
            id: "talkback",
            label: "Talkback",
            group: "talkback",
            input: { key: "tb_{ownerKey}", label: "Talkback ({ownerLabel})" },
          };
        throw new Error(`unknown preset ${id}`);
      },
      getNotesTemplate: () => notes,
    };

    const vm = buildDocument(project, repo);
    expect(
      vm.inputRows.some((row) =>
        row.note?.includes("requested from sound engineer"),
      ),
    ).toBe(true);
    expect(vm.inputRows.some((row) => row.note === "Own DI")).toBe(true);
    expect(
      vm.stageplan.monitorOutputs.some(
        (row) => (row.note ?? "").includes("Wedge monitor"),
      ),
    ).toBe(true);
    expect(
      vm.stageplan.monitorOutputs.some(
        (row) => row.note === "IEM STEREO wireless",
      ),
    ).toBe(true);
  });

  it("keeps explicit lineup input note override over seeded no-mic preset note", () => {
    const band: Band = {
      id: "band",
      name: "Band",
      bandLeader: "lead-1",
      defaultLineup: { vocs: "lead-1" },
    };
    const lead: Musician = {
      id: "lead-1",
      firstName: "Lead",
      lastName: "Singer",
      group: "vocs",
      presets: [
        { kind: "preset", ref: "vocal_lead_no_mic" },
        { kind: "monitor", ref: "wedge" },
      ],
    };
    const notes: NotesTemplate = {
      id: "notes_default_cs",
      lang: "cs",
      inputs: [],
      monitors: [],
    };
    const project: Project = {
      id: "p3",
      bandRef: "band",
      purpose: "event",
      documentDate: "2026-01-01",
      lineup: {
        vocs: {
          musicianId: "lead-1",
          presetOverride: {
            inputs: {
              replace: [
                {
                  targetKey: "voc_lead",
                  with: {
                    key: "voc_lead",
                    label: "Lead vocal",
                    note: "Custom event mic note",
                    group: "vocs",
                  },
                },
              ],
            },
          },
        },
      },
    };

    const repo: DataRepository = {
      getBand: () => band,
      getMusician: () => lead,
      getProject: () => project,
      getPreset: (id: string) => {
        if (id === "vocal_lead_no_mic")
          return {
            type: "preset",
            id,
            label: "Lead vocal (no mic)",
            group: "vocs",
            inputs: [
              {
                key: "voc_lead",
                label: "Lead vocal",
                group: "vocs",
                note: "BETA 58A, SE V7, SM58 – boom mic stand (provided by FOH)",
              },
            ],
          };
        if (id === "wedge")
          return { type: "monitor", id, label: "Wedge monitor" };
        if (id === "talkback")
          return {
            type: "talkback_type",
            id,
            label: "Talkback",
            group: "talkback",
            input: { key: "tb_{ownerKey}", label: "Talkback ({ownerLabel})" },
          };
        throw new Error(`unknown preset ${id}`);
      },
      getNotesTemplate: () => notes,
    };

    const vm = buildDocument(project, repo);
    expect(
      vm.inputs.some(
        (row) => row.key === "voc_lead" && row.note === "Custom event mic note",
      ),
    ).toBe(true);
  });
});

it("emits stageplan input ownerRole from current lineup assignment", () => {
  const band: Band = {
    id: "band-owner",
    name: "Band",
    bandLeader: "guitar-1",
    defaultLineup: { guitar: "guitar-1", vocs: "vocs-1" },
  };
  const guitar: Musician = {
    id: "guitar-1",
    firstName: "Karel",
    lastName: "G",
    group: "guitar",
    presets: [{ kind: "preset", ref: "el_guitar" }],
  };
  const vocs: Musician = {
    id: "vocs-1",
    firstName: "Lukas",
    lastName: "H",
    group: "vocs",
    presets: [
      { kind: "preset", ref: "ac_guitar" },
      { kind: "preset", ref: "vocal_lead" },
    ],
  };
  const project: Project = {
    id: "p-owner",
    bandRef: "band-owner",
    purpose: "generic",
    documentDate: "2026-01-01",
  };
  const notes: NotesTemplate = {
    id: "notes_default_cs",
    lang: "cs",
    inputs: [],
    monitors: [],
  };

  const repo: DataRepository = {
    getBand: () => band,
    getMusician: (id: string) => (id === "guitar-1" ? guitar : vocs),
    getProject: () => project,
    getPreset: (id: string) => {
      if (id === "el_guitar")
        return {
          type: "preset",
          id,
          label: "Electric guitar",
          group: "guitar",
          inputs: [
            { key: "el_guitar", label: "Electric guitar", group: "guitar" },
          ],
        };
      if (id === "ac_guitar")
        return {
          type: "preset",
          id,
          label: "Acoustic guitar",
          group: "guitar",
          inputs: [
            { key: "ac_guitar", label: "Acoustic guitar", group: "guitar" },
          ],
        };
      if (id === "vocal_lead")
        return {
          type: "preset",
          id,
          label: "Lead vocal",
          group: "vocs",
          inputs: [{ key: "voc_lead", label: "Lead vocal", group: "vocs" }],
        };
      if (id === "wedge") return { type: "monitor", id, label: "Wedge" };
      if (id === "talkback")
        return {
          type: "talkback_type",
          id,
          label: "Talkback",
          group: "talkback",
          input: { key: "tb_{ownerKey}", label: "Talkback ({ownerLabel})" },
        };
      throw new Error(`unknown preset ${id}`);
    },
    getNotesTemplate: () => notes,
  };

  const vm = buildDocument(project, repo);
  const acoustic = vm.stageplan.inputs.find(
    (input) => input.label === "Acoustic guitar",
  );
  const electric = vm.stageplan.inputs.find(
    (input) => input.label === "Electric guitar",
  );

  expect(acoustic?.ownerRole).toBe("vocs");
  expect(electric?.ownerRole).toBe("guitar");
});

  it("builds document for drummer with canonical persisted drum_setup", () => {
    const band: Band = {
      id: "band-d",
      name: "Band",
      bandLeader: "dr-1",
      defaultLineup: { drums: "dr-1" },
    };
    const drummer: Musician = {
      id: "dr-1",
      firstName: "Dr",
      lastName: "One",
      group: "drums",
      presets: [
        {
          kind: "drum_setup",
          setup: {
            kickCount: 1,
            kicks: [{ in: true, out: true }],
            snareCount: 1,
            snares: [{ top: true, bottom: true }],
            hasHiHat: true,
            tomCount: 2,
            floorCount: 1,
            hasOverheads: true,
            pad: { enabled: true, mode: "sfx", channels: "stereo" },
            tracks: { enabled: true },
          },
        },
      ],
    };
    const notes: NotesTemplate = {
      id: "notes_default_cs",
      lang: "cs",
      inputs: [],
      monitors: [],
    };
    const project: Project = {
      id: "p-drum-doc",
      bandRef: "band-d",
      purpose: "event",
      documentDate: "2026-01-01",
      lineup: { drums: "dr-1" },
    };

    const repo: DataRepository = {
      getBand: () => band,
      getMusician: () => drummer,
      getProject: () => project,
      getPreset: (id: string) => {
        if (id === "wedge") return { type: "monitor", id, label: "Wedge" };
        if (id === "talkback")
          return {
            type: "talkback_type",
            id: "talkback",
            label: "Talkback",
            group: "talkback",
            input: { key: "tb_{ownerKey}", label: "Talkback ({ownerLabel})" },
          };
        throw new Error(`unknown preset ${id}`);
      },
      getNotesTemplate: () => notes,
    };

    const vm = buildDocument(project, repo);
    expect(vm.inputs.some((item) => item.key === "dr_kick_1_out")).toBe(true);
    expect(vm.inputs.some((item) => item.key === "dr_pad_stereo_sfx_l")).toBe(true);
    expect(vm.inputs.some((item) => item.key === "dr_tracks_l")).toBe(true);
    const stageplanLabels = vm.stageplan.inputs.map((item) => item.label);
    expect(stageplanLabels.indexOf("Playback L")).toBeGreaterThan(stageplanLabels.indexOf("PAD SFX R"));
  });

