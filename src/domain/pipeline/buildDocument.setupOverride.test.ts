import { describe, expect, it } from "vitest";
import type { DataRepository } from "../../infra/fs/repo.js";
import { createDefaultDrumDefinition } from "../drums/drumDefinition.js";
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
      defaultLineup: { bass: ["bass-1"] },
      defaultOverlays: { leadVocals: [], backVocals: [] },
    };
    const musician: Musician = {
      id: "bass-1",
      firstName: "Bass",
      lastName: "Player",
      group: "bass",
      presets: [
        { kind: "preset", ref: "el_bass_xlr_pedalboard" },
        { kind: "monitor", ref: "iem_stereo_wireless_foh" },
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
              monitorRef: "iem_stereo_wired_foh",
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
        if (id === "iem_stereo_wireless_foh")
          return { type: "monitor", id, label: "IEM STEREO wireless", kind: "iem", supplier: "foh", mode: "stereo", wireless: true };
        if (id === "wedge_foh") return { type: "monitor", id, label: "Wedge", kind: "wedge", supplier: "foh" };
        if (id === "iem_stereo_wired_foh")
          return { type: "monitor", id, label: "IEM STEREO wired", kind: "iem", supplier: "foh", mode: "stereo", wireless: false };
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
      lineup: { bass: ["bass-1"] },
      talkbackOverride: { mode: "none" },
    };

    const repo: DataRepository = {
      getBand: () => band,
      getMusician: () => musician,
      getProject: () => project,
      getPreset: (id: string) => {
        if (id === "el_bass_xlr_pedalboard") return bassPreset;
        if (id === "iem_stereo_wireless_foh")
          return { type: "monitor", id, label: "IEM STEREO wireless", kind: "iem", supplier: "foh", mode: "stereo", wireless: true };
        if (id === "wedge_foh") return { type: "monitor", id, label: "Wedge", kind: "wedge", supplier: "foh" };
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
      defaultLineup: { vocs: ["lead-1"], guitar: ["gtr-1"] },
      defaultOverlays: { leadVocals: [], backVocals: [] },
    };
    const lead: Musician = {
      id: "lead-1",
      firstName: "Lead",
      lastName: "Singer",
      group: "vocs",
      presets: [
        { kind: "preset", ref: "vocal_lead_no_mic" },
        { kind: "monitor", ref: "wedge_foh" },
      ],
    };
    const guitar: Musician = {
      id: "gtr-1",
      firstName: "Guitar",
      lastName: "Player",
      group: "guitar",
      presets: [
        { kind: "preset", ref: "el_guitar" },
        { kind: "monitor", ref: "iem_stereo_wireless_foh" },
        { kind: "preset", ref: "vocal_back_no_mic" },
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
      lineup: { vocs: ["lead-1"], guitar: ["gtr-1"] },
      overlays: { leadVocals: ["lead-1"] },
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
            type: "preset",
            id,
            label: "Back vocal (no mic)",
            group: "vocs",
            inputs: [{ key: "voc_back", label: "Back vocal", group: "vocs", note: "BETA 58A, SE V7, SM58 – boom mic stand (requested from sound engineer)" }],
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
        if (id === "wedge_foh")
          return { type: "monitor", id, label: "Wedge monitor (provided by FOH)", kind: "wedge", supplier: "foh" };
        if (id === "iem_stereo_wireless_foh")
          return { type: "monitor", id, label: "IEM STEREO wireless", kind: "iem", supplier: "foh", mode: "stereo", wireless: true };
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
      vm.stageplan.monitorOutputs.some((row) =>
        (row.note ?? "").includes("Wedge monitor"),
      ),
    ).toBe(true);
    expect(
      vm.stageplan.monitorOutputs.some(
        (row) => row.note === "IEM STEREO wireless",
      ),
    ).toBe(true);
  });

  it("does not print back vocal rows without explicit project overlays.backVocals", () => {
    const band: Band = {
      id: "band",
      name: "Band",
      bandLeader: "lead-1",
      defaultLineup: { vocs: ["lead-1"], guitar: ["gtr-1"] },
      defaultOverlays: { leadVocals: [], backVocals: ["gtr-1"] },
    };
    const lead: Musician = {
      id: "lead-1",
      firstName: "Lead",
      lastName: "Singer",
      group: "vocs",
      presets: [{ kind: "preset", ref: "vocal_lead_no_mic" }],
    };
    const guitar: Musician = {
      id: "gtr-1",
      firstName: "Guitar",
      lastName: "Player",
      group: "guitar",
      presets: [
        { kind: "preset", ref: "el_guitar" },
        { kind: "preset", ref: "vocal_back_no_mic" },
      ],
    };
    const notes: NotesTemplate = {
      id: "notes_default_cs",
      lang: "cs",
      inputs: [],
      monitors: [],
    };
    const project: Project = {
      id: "p-no-back-explicit",
      bandRef: "band",
      purpose: "event",
      documentDate: "2026-01-01",
      lineup: { vocs: ["lead-1"], guitar: ["gtr-1"] },
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
            inputs: [{ key: "voc_lead", label: "Lead vocal", group: "vocs" }],
          };
        if (id === "vocal_back_no_mic")
          return {
            type: "preset",
            id,
            label: "Back vocal (no mic)",
            group: "vocs",
            inputs: [{ key: "voc_back", label: "Back vocal", group: "vocs" }],
          };
        if (id === "el_guitar")
          return {
            type: "preset",
            id,
            label: "Guitar",
            group: "guitar",
            inputs: [{ key: "gtr", label: "Guitar", group: "guitar" }],
          };
        if (id === "wedge_foh")
          return { type: "monitor", id, label: "Wedge monitor (provided by FOH)", kind: "wedge", supplier: "foh" };
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
    expect(vm.inputs.some((input) => input.key.startsWith("voc_back_"))).toBe(
      false,
    );
  });

  it("uses explicit overlays lead vocals as authoritative output source", () => {
    const band: Band = {
      id: "band",
      name: "Band",
      bandLeader: "keys-1",
      defaultLineup: { vocs: ["voc-1"], keys: ["keys-1"] },
      defaultOverlays: { leadVocals: [], backVocals: [] },
    };
    const vocalist: Musician = {
      id: "voc-1",
      firstName: "Vocal",
      lastName: "Default",
      group: "vocs",
      presets: [
        { kind: "preset", ref: "vocal_lead_no_mic" },
        { kind: "monitor", ref: "wedge_foh" },
      ],
    };
    const keys: Musician = {
      id: "keys-1",
      firstName: "Keys",
      lastName: "Player",
      group: "keys",
      presets: [
        { kind: "preset", ref: "keys" },
        { kind: "monitor", ref: "wedge_foh" },
      ],
    };
    const project: Project = {
      id: "p-lead-override",
      bandRef: "band",
      purpose: "event",
      documentDate: "2026-01-01",
      lineup: { vocs: ["voc-1"], keys: ["keys-1"] },
      overlays: { leadVocals: ["keys-1"] },
    };
    const notes: NotesTemplate = {
      id: "notes_default_cs",
      lang: "cs",
      inputs: [],
      monitors: [],
    };

    const repo: DataRepository = {
      getBand: () => band,
      getMusician: (id: string) => (id === "keys-1" ? keys : vocalist),
      getProject: () => project,
      getPreset: (id: string) => {
        if (id === "keys")
          return {
            type: "preset",
            id: "keys",
            label: "Keys",
            group: "keys",
            inputs: [
              { key: "keys_l", label: "Keys L", group: "keys" },
              { key: "keys_r", label: "Keys R", group: "keys" },
            ],
          };
        if (id === "vocal_lead_no_mic")
          return {
            type: "preset",
            id: "vocal_lead_no_mic",
            label: "Lead vocal (no mic)",
            group: "vocs",
            inputs: [{ key: "voc_lead", label: "Lead vocal", group: "vocs" }],
          };
        if (id === "wedge_foh") return { type: "monitor", id, label: "Wedge", kind: "wedge", supplier: "foh" };
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
    const leadNames = (vm.stageplan.leadVocals ?? []).map(
      (item) => item.firstName,
    );
    expect(leadNames).toEqual([]);
  });

  it("keeps mixed-role lead vocalist order authoritative for stageplan and vocs numbering", () => {
    const band: Band = {
      id: "band-lead-order",
      name: "Band",
      bandLeader: "keys-1",
      defaultLineup: { vocs: ["voc-1", "voc-2"], keys: ["keys-1"] },
      defaultOverlays: { leadVocals: [], backVocals: [] },
    };
    const voc1: Musician = {
      id: "voc-1",
      firstName: "Vocal One",
      lastName: "Singer",
      group: "vocs",
      presets: [
        { kind: "preset", ref: "vocal_lead_no_mic" },
        { kind: "monitor", ref: "wedge_foh" },
      ],
    };
    const voc2: Musician = {
      id: "voc-2",
      firstName: "Vocal Two",
      lastName: "Singer",
      group: "vocs",
      presets: [
        { kind: "preset", ref: "vocal_lead_no_mic" },
        { kind: "monitor", ref: "wedge_foh" },
      ],
    };
    const keys: Musician = {
      id: "keys-1",
      firstName: "Keys",
      lastName: "Player",
      group: "keys",
      presets: [
        { kind: "preset", ref: "keys_with_lead" },
        { kind: "monitor", ref: "wedge_foh" },
      ],
    };
    const project: Project = {
      id: "p-lead-order",
      bandRef: "band-lead-order",
      purpose: "event",
      documentDate: "2026-01-01",
      lineup: { vocs: ["voc-1", "voc-2"], keys: ["keys-1"] },
      overlays: {
        leadVocals: [
          "keys-1",
          "voc-2",
          "voc-1",
        ],
      },
    };
    const notes: NotesTemplate = {
      id: "notes_default_cs",
      lang: "cs",
      inputs: [],
      monitors: [],
    };

    const repo: DataRepository = {
      getBand: () => band,
      getMusician: (id: string) =>
        id === "keys-1" ? keys : id === "voc-2" ? voc2 : voc1,
      getProject: () => project,
      getPreset: (id: string) => {
        if (id === "keys_with_lead") {
          return {
            type: "preset",
            id,
            label: "Keys + lead",
            group: "keys",
            inputs: [
              { key: "keys_l", label: "Keys L", group: "keys" },
              { key: "voc_lead", label: "Lead vocal", group: "vocs" },
            ],
          };
        }
        if (id === "vocal_lead_no_mic") {
          return {
            type: "preset",
            id,
            label: "Lead vocal",
            group: "vocs",
            inputs: [{ key: "voc_lead", label: "Lead vocal", group: "vocs" }],
          };
        }
        if (id === "wedge_foh") return { type: "monitor", id, label: "Wedge", kind: "wedge", supplier: "foh" };
        if (id === "talkback") {
          return {
            type: "talkback_type",
            id,
            label: "Talkback",
            group: "talkback",
            input: { key: "tb_{ownerKey}", label: "Talkback ({ownerLabel})" },
          };
        }
        throw new Error(`unknown preset ${id}`);
      },
      getNotesTemplate: () => notes,
    };

    const vm = buildDocument(project, repo);

    expect((vm.stageplan.leadVocals ?? []).map((item) => item.firstName)).toEqual([
      "Vocal Two",
      "Vocal One",
    ]);
    const leadLabels = vm.inputRows
      .filter((row) => row.label.startsWith("Lead vocal"))
      .map((row) => row.label);
    expect(leadLabels).toContain("Lead vocal 1 (keys)");
    expect(leadLabels).toContain("Lead vocal 2");
    expect(leadLabels).toContain("Lead vocal 3");
  });

  it("respects explicit empty overlays.leadVocals and does not fallback to lineup vocs", () => {
    const band: Band = {
      id: "band-empty-lead",
      name: "Band",
      bandLeader: "voc-1",
      defaultLineup: { vocs: ["voc-1"] },
      defaultOverlays: { leadVocals: ["voc-1"], backVocals: [] },
    };
    const vocalist: Musician = {
      id: "voc-1",
      firstName: "Vocal",
      lastName: "Default",
      group: "vocs",
      presets: [
        { kind: "preset", ref: "vocal_lead_no_mic" },
        { kind: "monitor", ref: "wedge_foh" },
      ],
    };
    const project: Project = {
      id: "p-empty-lead",
      bandRef: "band-empty-lead",
      purpose: "event",
      documentDate: "2026-01-01",
      lineup: { vocs: ["voc-1"] },
      overlays: { leadVocals: [] },
    };
    const notes: NotesTemplate = {
      id: "notes_default_cs",
      lang: "cs",
      inputs: [],
      monitors: [],
    };

    const repo: DataRepository = {
      getBand: () => band,
      getMusician: () => vocalist,
      getProject: () => project,
      getPreset: (id: string) => {
        if (id === "vocal_lead_no_mic") {
          return {
            type: "preset",
            id,
            label: "Lead vocal (no mic)",
            group: "vocs",
            inputs: [{ key: "voc_lead", label: "Lead vocal", group: "vocs" }],
          };
        }
        if (id === "wedge_foh") return { type: "monitor", id, label: "Wedge", kind: "wedge", supplier: "foh" };
        if (id === "talkback") {
          return {
            type: "talkback_type",
            id,
            label: "Talkback",
            group: "talkback",
            input: { key: "tb_{ownerKey}", label: "Talkback ({ownerLabel})" },
          };
        }
        throw new Error(`unknown preset ${id}`);
      },
      getNotesTemplate: () => notes,
    };

    const vm = buildDocument(project, repo);
    expect(vm.stageplan.leadVocals).toEqual([]);
  });

  it("keeps vocal overlay rows for bassist and drummer roles", () => {
    const band: Band = {
      id: "band-rhythm-vocals",
      name: "Band",
      bandLeader: "dr-1",
      defaultLineup: { bass: ["bass-1"], drums: ["dr-1"] },
      defaultOverlays: { leadVocals: [], backVocals: [] },
    };
    const bassist: Musician = {
      id: "bass-1",
      firstName: "Bass",
      lastName: "Player",
      group: "bass",
      presets: [
        { kind: "preset", ref: "el_bass_xlr_pedalboard" },
        { kind: "preset", ref: "vocal_lead_no_mic" },
        { kind: "monitor", ref: "wedge_foh" },
      ],
    };
    const drummer: Musician = {
      id: "dr-1",
      firstName: "Drum",
      lastName: "Player",
      group: "drums",
      presets: [
        { kind: "drum_setup", setup: createDefaultDrumDefinition() },
        { kind: "preset", ref: "vocal_lead_no_mic" },
        { kind: "monitor", ref: "wedge_foh" },
      ],
    };
    const project: Project = {
      id: "p-rhythm-vocals",
      bandRef: "band-rhythm-vocals",
      purpose: "event",
      documentDate: "2026-01-01",
      lineup: { bass: ["bass-1"], drums: ["dr-1"] },
      overlays: {
        leadVocals: [
          "bass-1",
          "dr-1",
        ],
      },
    };
    const notes: NotesTemplate = {
      id: "notes_default_cs",
      lang: "cs",
      inputs: [],
      monitors: [],
    };
    const repo: DataRepository = {
      getBand: () => band,
      getMusician: (id: string) => (id === "bass-1" ? bassist : drummer),
      getProject: () => project,
      getPreset: (id: string) => {
        if (id === "el_bass_xlr_pedalboard") {
          return {
            type: "preset",
            id,
            label: "Bass",
            group: "bass",
            inputs: [{ key: "bass_di", label: "Bass DI", group: "bass" }],
          };
        }
        if (id === "vocal_lead_no_mic") {
          return {
            type: "preset",
            id,
            label: "Lead vocal",
            group: "vocs",
            inputs: [{ key: "voc_lead", label: "Lead vocal", group: "vocs" }],
          };
        }
        if (id === "wedge_foh") return { type: "monitor", id, label: "Wedge", kind: "wedge", supplier: "foh" };
        if (id === "talkback") {
          return {
            type: "talkback_type",
            id,
            label: "Talkback",
            group: "talkback",
            input: { key: "tb_{ownerKey}", label: "Talkback ({ownerLabel})" },
          };
        }
        throw new Error(`unknown preset ${id}`);
      },
      getNotesTemplate: () => notes,
    };

    const vm = buildDocument(project, repo);
    expect((vm.stageplan.leadVocals ?? []).map((person) => person.firstName)).toEqual(
      [],
    );
    expect(
      vm.inputRows.some((row) => row.label.startsWith("Lead vocal 1")),
    ).toBe(true);
    expect(
      vm.inputRows.some((row) => row.label.startsWith("Lead vocal 2")),
    ).toBe(true);
  });

  it("formats mixed lead/back vocal PDF labels and de-duplicates monitor rows", () => {
    const band: Band = {
      id: "band-vocal-labels",
      name: "Band",
      bandLeader: "voc-1",
      defaultLineup: { vocs: ["voc-1"], guitar: ["gtr-1"], keys: ["keys-1"] },
      defaultOverlays: { leadVocals: [], backVocals: [] },
    };
    const vocs: Musician = {
      id: "voc-1",
      firstName: "Lead",
      lastName: "Singer",
      group: "vocs",
      presets: [
        { kind: "preset", ref: "vocal_lead_no_mic" },
        { kind: "monitor", ref: "wedge_foh" },
      ],
    };
    const guitar: Musician = {
      id: "gtr-1",
      firstName: "Guitar",
      lastName: "Player",
      group: "guitar",
      presets: [
        { kind: "preset", ref: "el_guitar" },
        { kind: "monitor", ref: "wedge_foh" },
      ],
    };
    const keys: Musician = {
      id: "keys-1",
      firstName: "Keys",
      lastName: "Player",
      group: "keys",
      presets: [
        { kind: "preset", ref: "keys_with_lead" },
        { kind: "monitor", ref: "wedge_foh" },
      ],
    };
    const project: Project = {
      id: "p-vocal-labels",
      bandRef: "band-vocal-labels",
      purpose: "event",
      documentDate: "2026-01-01",
      lineup: { vocs: ["voc-1"], guitar: ["gtr-1"], keys: ["keys-1"] },
      overlays: {
        backVocals: ["gtr-1"],
        leadVocals: [
          "voc-1",
          "keys-1",
        ],
      },
    };
    const notes: NotesTemplate = {
      id: "notes_default_cs",
      lang: "cs",
      inputs: [],
      monitors: [],
    };
    const repo: DataRepository = {
      getBand: () => band,
      getMusician: (id: string) =>
        id === "voc-1" ? vocs : id === "gtr-1" ? guitar : keys,
      getProject: () => project,
      getPreset: (id: string) => {
        if (id === "vocal_lead_no_mic") {
          return {
            type: "preset",
            id,
            label: "Lead vocal (no mic)",
            group: "vocs",
            inputs: [{ key: "voc_lead", label: "Lead vocal", group: "vocs" }],
          };
        }
        if (id === "keys_with_lead") {
          return {
            type: "preset",
            id,
            label: "Keys + lead",
            group: "keys",
            inputs: [
              { key: "keys_l", label: "Keys L", group: "keys" },
              { key: "keys_r", label: "Keys R", group: "keys" },
              { key: "voc_lead", label: "Lead vocal", group: "vocs" },
            ],
          };
        }
        if (id === "el_guitar") {
          return {
            type: "preset",
            id,
            label: "Guitar",
            group: "guitar",
            inputs: [{ key: "gtr", label: "Guitar", group: "guitar" }],
          };
        }
        if (id === "vocal_back_no_mic") {
          return {
            type: "preset",
            id,
            label: "Back vocal (no mic)",
            group: "vocs",
            inputs: [{ key: "voc_back", label: "Back vocal", group: "vocs" }],
          };
        }
        if (id === "wedge_foh") return { type: "monitor", id, label: "Wedge", kind: "wedge", supplier: "foh" };
        if (id === "talkback") {
          return {
            type: "talkback_type",
            id,
            label: "Talkback",
            group: "talkback",
            input: { key: "tb_{ownerKey}", label: "Talkback ({ownerLabel})" },
          };
        }
        throw new Error(`unknown preset ${id}`);
      },
      getNotesTemplate: () => notes,
    };

    const vm = buildDocument(project, repo);
    expect(
      vm.inputRows.some((row) => row.label.startsWith("Lead vocal 1")),
    ).toBe(true);
    expect(
      vm.inputRows.some((row) => row.label.startsWith("Lead vocal 2")),
    ).toBe(true);
    expect(
      vm.inputRows.some((row) => row.label === "Back vocal (guitar)"),
    ).toBe(true);
    expect(vm.stageplan.monitorOutputs.map((row) => row.output)).toEqual([
      "Guitar",
      "Lead vocal 1",
      "Keys",
    ]);
  });

  it("keeps explicit lineup input note override over seeded no-mic preset note", () => {
    const band: Band = {
      id: "band",
      name: "Band",
      bandLeader: "lead-1",
      defaultLineup: { vocs: ["lead-1"] },
      defaultOverlays: { leadVocals: [], backVocals: [] },
    };
    const lead: Musician = {
      id: "lead-1",
      firstName: "Lead",
      lastName: "Singer",
      group: "vocs",
      presets: [
        { kind: "preset", ref: "vocal_lead_no_mic" },
        { kind: "monitor", ref: "wedge_foh" },
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
        if (id === "wedge_foh")
          return { type: "monitor", id, label: "Wedge monitor (provided by FOH)", kind: "wedge", supplier: "foh" };
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

  it("emits stageplan input ownerRole from current lineup assignment", () => {
    const band: Band = {
      id: "band-owner",
      name: "Band",
      bandLeader: "guitar-1",
      defaultLineup: { guitar: ["guitar-1"], vocs: ["vocs-1"] },
      defaultOverlays: { leadVocals: [], backVocals: [] },
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
      lineup: { guitar: ["guitar-1"], vocs: ["vocs-1"] },
      overlays: { leadVocals: ["vocs-1"] },
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
        if (id === "wedge_foh") return { type: "monitor", id, label: "Wedge", kind: "wedge", supplier: "foh" };
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

  it("keeps monitor rows roster-based while inputs may expand from overlays", () => {
    const band: Band = {
      id: "band-roster",
      name: "Band",
      bandLeader: "dr-1",
      defaultLineup: {},
      defaultOverlays: { leadVocals: [], backVocals: [] },
    };
    const makeMusician = (
      id: string,
      group: Musician["group"],
      presets: Musician["presets"],
    ): Musician => ({
      id,
      firstName: id,
      lastName: "Player",
      group,
      presets,
    });
    const musicians: Record<string, Musician> = {
      "dr-1": makeMusician("dr-1", "drums", [
        { kind: "preset", ref: "drum_preset" },
        { kind: "monitor", ref: "wedge_foh" },
      ]),
      "bs-1": makeMusician("bs-1", "bass", [
        { kind: "preset", ref: "bass_preset" },
        { kind: "monitor", ref: "wedge_foh" },
      ]),
      "gt-1": makeMusician("gt-1", "guitar", [
        { kind: "preset", ref: "gtr_preset" },
        { kind: "monitor", ref: "wedge_foh" },
      ]),
      "ky-1": makeMusician("ky-1", "keys", [
        { kind: "preset", ref: "keys_preset" },
        { kind: "monitor", ref: "wedge_foh" },
      ]),
      "vc-1": makeMusician("vc-1", "vocs", [
        { kind: "preset", ref: "vocal_lead_no_mic" },
        { kind: "monitor", ref: "wedge_foh" },
      ]),
      "vc-2": makeMusician("vc-2", "vocs", [
        { kind: "preset", ref: "vocal_lead_no_mic" },
        { kind: "monitor", ref: "wedge_foh" },
      ]),
    };
    const project: Project = {
      id: "p-roster",
      bandRef: band.id,
      purpose: "event",
      documentDate: "2026-01-01",
      lineup: {
        drums: ["dr-1"],
        bass: ["bs-1"],
        guitar: ["gt-1"],
        keys: ["ky-1"],
        vocs: ["vc-1", "vc-2"],
      },
      overlays: {
        leadVocals: [
          "vc-1",
          "gt-1",
          "ky-1",
          "dr-1",
        ],
      },
    };
    const repo: DataRepository = {
      getBand: () => band,
      getMusician: (id: string) => musicians[id]!,
      getProject: () => project,
      getPreset: (id: string) => {
        if (id === "wedge_foh") return { type: "monitor", id, label: "Wedge", kind: "wedge", supplier: "foh" };
        if (id === "talkback")
          return {
            type: "talkback_type",
            id,
            label: "Talkback",
            group: "talkback",
            input: { key: "tb_{ownerKey}", label: "Talkback ({ownerLabel})" },
          };
        if (id === "vocal_lead_no_mic")
          return {
            type: "preset",
            id,
            label: "Lead vocal",
            group: "vocs",
            inputs: [{ key: "voc_lead", label: "Lead vocal", group: "vocs" }],
          };
        return {
          type: "preset",
          id,
          label: id,
          group:
            id === "drum_preset"
              ? "drums"
              : id === "bass_preset"
                ? "bass"
                : id === "gtr_preset"
                  ? "guitar"
                  : "keys",
          inputs: [
            {
              key: id,
              label: id,
              group:
                id === "drum_preset"
                  ? "drums"
                  : id === "bass_preset"
                    ? "bass"
                    : id === "gtr_preset"
                      ? "guitar"
                      : "keys",
            },
          ],
        };
      },
      getNotesTemplate: () => ({
        id: "notes_default_cs",
        lang: "cs",
        inputs: [],
        monitors: [],
      }),
    };

    const vm = buildDocument(project, repo);
    expect(vm.stageplan.monitorOutputs).toHaveLength(6);
    expect(vm.inputs.length).toBeGreaterThan(
      vm.stageplan.monitorOutputs.length,
    );
  });

  it("does not duplicate stageplan people when overlay lead is already a primary-slot musician", () => {
    const band: Band = {
      id: "band-stage",
      name: "Band",
      bandLeader: "gt-1",
      defaultLineup: {},
      defaultOverlays: { leadVocals: [], backVocals: [] },
    };
    const project: Project = {
      id: "p-stage",
      bandRef: band.id,
      purpose: "event",
      documentDate: "2026-01-01",
      lineup: { guitar: ["gt-1"], vocs: ["vc-1"] },
      overlays: {
        leadVocals: [
          "gt-1",
          "vc-1",
        ],
      },
    };
    const repo: DataRepository = {
      getBand: () => band,
      getProject: () => project,
      getMusician: (id: string) => ({
        id,
        firstName: id,
        lastName: "Player",
        group: id === "gt-1" ? "guitar" : "vocs",
        presets: [
          { kind: "preset", ref: id === "gt-1" ? "gtr" : "voc" },
          { kind: "monitor", ref: "wedge_foh" },
        ],
      }),
      getPreset: (id: string) => {
        if (id === "wedge_foh") return { type: "monitor", id, label: "Wedge", kind: "wedge", supplier: "foh" };
        if (id === "talkback")
          return {
            type: "talkback_type",
            id,
            label: "Talkback",
            group: "talkback",
            input: { key: "tb_{ownerKey}", label: "Talkback ({ownerLabel})" },
          };
        return {
          type: "preset",
          id,
          label: id,
          group: id === "gtr" ? "guitar" : "vocs",
          inputs: [
            { key: id, label: id, group: id === "gtr" ? "guitar" : "vocs" },
          ],
        };
      },
      getNotesTemplate: () => ({
        id: "notes_default_cs",
        lang: "cs",
        inputs: [],
        monitors: [],
      }),
    };

    const vm = buildDocument(project, repo);
    expect((vm.stageplan.leadVocals ?? []).map((person) => person.firstName)).toEqual([
      "vc-1",
    ]);
  });

  it("builds document for drummer with canonical persisted drum_setup", () => {
    const band: Band = {
      id: "band-d",
      name: "Band",
      bandLeader: "dr-1",
      defaultLineup: { drums: ["dr-1"] },
      defaultOverlays: { leadVocals: [], backVocals: [] },
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
      lineup: { drums: ["dr-1"] },
    };

    const repo: DataRepository = {
      getBand: () => band,
      getMusician: () => drummer,
      getProject: () => project,
      getPreset: (id: string) => {
        if (id === "wedge_foh") return { type: "monitor", id, label: "Wedge", kind: "wedge", supplier: "foh" };
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
    expect(vm.inputs.some((item) => item.key === "dr_pad_stereo_sfx_l")).toBe(
      true,
    );
    expect(vm.inputs.some((item) => item.key === "dr_tracks_l")).toBe(true);
    expect(
      vm.inputs.filter((item) => item.key.startsWith("dr_kick_1_out")).length,
    ).toBe(1);
    expect(
      vm.inputs.filter((item) => item.key.startsWith("dr_tracks_l")).length,
    ).toBe(1);
    expect(vm.inputRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "PAD",
          note: "2x TS jack 6.3mm – DI box",
        }),
        expect.objectContaining({
          label: "Tracks",
          note: "2x TS jack 6.3mm – DI box",
        }),
      ]),
    );
    const stageplanLabels = vm.stageplan.inputs.map((item) => item.label);
    expect(stageplanLabels).toContain("Backing track L");
    expect(stageplanLabels).toContain("Backing track R");
    expect(stageplanLabels.indexOf("Backing track L")).toBeGreaterThan(
      stageplanLabels.indexOf("PAD SFX R"),
    );
  });

  it("uses effective drumDefinition override from lineup for counts and tracks toggle", () => {
    const band: Band = {
      id: "band-d-override",
      name: "Band",
      bandLeader: "dr-2",
      defaultLineup: { drums: ["dr-2"], bass: ["b-1"] },
      defaultOverlays: { leadVocals: [], backVocals: [] },
    };
    const drummer: Musician = {
      id: "dr-2",
      firstName: "Dr",
      lastName: "Two",
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
            tomCount: 1,
            floorCount: 1,
            hasOverheads: true,
            pad: { enabled: false },
            tracks: { enabled: false },
          },
        },
      ],
    };
    const bassist: Musician = {
      id: "b-1",
      firstName: "Bass",
      lastName: "One",
      group: "bass",
      presets: [{ kind: "preset", ref: "el_bass_xlr_pedalboard" }],
    };
    const notes: NotesTemplate = {
      id: "notes_default_cs",
      lang: "cs",
      inputs: [],
      monitors: [],
    };

    const projectWithTracks: Project = {
      id: "p-drum-override-on",
      bandRef: "band-d-override",
      purpose: "event",
      documentDate: "2026-01-01",
      lineup: {
        drums: {
          musicianId: "dr-2",
          drumDefinition: {
            kickCount: 2,
            kicks: [
              { in: true, out: true },
              { in: true, out: true },
            ],
            snareCount: 3,
            snares: [
              { top: true, bottom: true },
              { top: true, bottom: true },
              { top: true, bottom: true },
            ],
            hasHiHat: true,
            tomCount: 4,
            floorCount: 2,
            hasOverheads: true,
            pad: { enabled: false },
            tracks: { enabled: true, channels: "stereo" },
          },
        },
        bass: ["b-1"],
      },
    };

    const projectWithoutTracks: Project = {
      ...projectWithTracks,
      id: "p-drum-override-off",
      lineup: {
        drums: {
          musicianId: "dr-2",
          drumDefinition: {
            kickCount: 2,
            kicks: [
              { in: true, out: true },
              { in: true, out: true },
            ],
            snareCount: 3,
            snares: [
              { top: true, bottom: true },
              { top: true, bottom: true },
              { top: true, bottom: true },
            ],
            hasHiHat: true,
            tomCount: 4,
            floorCount: 2,
            hasOverheads: true,
            pad: { enabled: false },
            tracks: { enabled: false },
          },
        },
        bass: ["b-1"],
      },
    };

    const repoForProject = (currentProject: Project): DataRepository => ({
      getBand: () => band,
      getMusician: (id: string) => (id === "dr-2" ? drummer : bassist),
      getProject: () => currentProject,
      getPreset: (id: string) => {
        if (id === "el_bass_xlr_pedalboard")
          return {
            type: "preset",
            id,
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
        if (id === "wedge_foh") return { type: "monitor", id, label: "Wedge", kind: "wedge", supplier: "foh" };
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
    });

    const vmWithTracks = buildDocument(
      projectWithTracks,
      repoForProject(projectWithTracks),
    );
    expect(
      vmWithTracks.inputs.some((item) => item.key === "dr_kick_2_out"),
    ).toBe(true);
    expect(
      vmWithTracks.inputs.some((item) => item.key === "dr_snare3_top"),
    ).toBe(true);
    expect(vmWithTracks.inputs.some((item) => item.key === "dr_tom_4")).toBe(
      true,
    );
    expect(vmWithTracks.inputs.some((item) => item.key === "dr_floor_2")).toBe(
      true,
    );
    expect(vmWithTracks.inputs.some((item) => item.key === "dr_tracks_l")).toBe(
      true,
    );
    expect(vmWithTracks.inputs.some((item) => item.key === "dr_tracks_r")).toBe(
      true,
    );
    expect(
      vmWithTracks.inputs.filter((item) => item.key.startsWith("dr_kick_1_out"))
        .length,
    ).toBe(1);
    expect(
      vmWithTracks.stageplan.inputs.some(
        (item) => item.label === "Backing track L",
      ),
    ).toBe(true);
    expect(
      vmWithTracks.stageplan.inputs.some(
        (item) => item.label === "Backing track R",
      ),
    ).toBe(true);
    expect(
      vmWithTracks.inputs.some((item) => item.key === "el_bass_xlr_pedalboard"),
    ).toBe(true);

    const vmWithoutTracks = buildDocument(
      projectWithoutTracks,
      repoForProject(projectWithoutTracks),
    );
    expect(
      vmWithoutTracks.inputs.some((item) => item.key === "dr_tracks_l"),
    ).toBe(false);
    expect(
      vmWithoutTracks.inputs.some((item) => item.key === "dr_tracks_r"),
    ).toBe(false);
    expect(
      vmWithoutTracks.stageplan.inputs.some(
        (item) => item.label === "Backing track L",
      ),
    ).toBe(false);
    expect(
      vmWithoutTracks.stageplan.inputs.some(
        (item) => item.label === "Backing track R",
      ),
    ).toBe(false);
  });

  it("renders mixed keys units with Keys/Keys N labels and per-unit notes", () => {
    const band: Band = {
      id: "band-keys",
      name: "Keys Band",
      bandLeader: "keys-1",
      defaultLineup: { keys: ["keys-1"] },
      defaultOverlays: { leadVocals: [], backVocals: [] },
    };
    const musician: Musician = {
      id: "keys-1",
      firstName: "Keys",
      lastName: "Player",
      group: "keys",
      presets: [
        { kind: "preset", ref: "keys_stereo_xlr" },
        { kind: "monitor", ref: "wedge_foh" },
      ],
    };
    const notes: NotesTemplate = {
      id: "notes_default_cs",
      lang: "cs",
      inputs: [],
      monitors: [],
    };
    const project: Project = {
      id: "p-keys",
      bandRef: band.id,
      purpose: "event",
      eventDate: "2026-01-01",
      eventVenue: "Venue",
      documentDate: "2026-01-01",
      lineup: {
        keys: [
          {
            musicianId: "keys-1",
            presetOverride: {
              inputs: {
                add: [
                  {
                    key: "keys_2",
                    label: "Keys 2",
                    group: "keys",
                    note: "TS jack 6.3mm – DI box",
                  },
                ],
                update: [
                  {
                    key: "keys_l",
                    label: "Keys 1 L",
                    group: "keys",
                    note: "XLR out from rack",
                  },
                  {
                    key: "keys_r",
                    label: "Keys 1 R",
                    group: "keys",
                    note: "XLR out from rack",
                  },
                ],
              },
            },
          },
        ],
      },
    };
    const keyPreset: Preset = {
      type: "preset",
      id: "keys_stereo_xlr",
      label: "Keys stereo XLR",
      group: "keys",
      inputs: [
        {
          key: "keys_l",
          label: "Keys L",
          baseLabel: "Keys",
          compactGroupKey: "keys_stereo_xlr",
          channel: "L",
          group: "keys",
          note: "XLR out from rack",
        },
        {
          key: "keys_r",
          label: "Keys R",
          baseLabel: "Keys",
          compactGroupKey: "keys_stereo_xlr",
          channel: "R",
          group: "keys",
          note: "XLR out from rack",
        },
      ],
    };
    const repo: DataRepository = {
      getBand: () => band,
      getMusician: () => musician,
      getProject: () => project,
      getPreset: (id: string) => {
        if (id === "keys_stereo_xlr") return keyPreset;
        if (id === "wedge_foh") return { type: "monitor", id, label: "Wedge", kind: "wedge", supplier: "foh" };
        throw new Error(`unknown preset ${id}`);
      },
      getNotesTemplate: () => notes,
    };

    const vm = buildDocument(project, repo);
    expect(vm.inputRows.map((row) => [row.label, row.note])).toEqual([
      ["Keys 1", "2x XLR out from rack"],
      ["Keys 2", "TS jack 6.3mm – DI box"],
    ]);
  });

  it("carries a lineup presetOverride.inputs.update patch onto drum-kit channels in vm.inputs (task 12c)", () => {
    const band: Band = {
      id: "band-drum-update",
      name: "Band",
      bandLeader: "dr-1",
      defaultLineup: { drums: ["dr-1"] },
      defaultOverlays: { leadVocals: [], backVocals: [] },
    };
    const drummer: Musician = {
      id: "dr-1",
      firstName: "Dr",
      lastName: "One",
      group: "drums",
      presets: [{ kind: "drum_setup", setup: createDefaultDrumDefinition() }],
    };
    const notes: NotesTemplate = { id: "notes_default_cs", lang: "cs", inputs: [], monitors: [] };
    const repoFor = (project: Project): DataRepository => ({
      getBand: () => band,
      getMusician: () => drummer,
      getProject: () => project,
      getPreset: (id: string) => {
        if (id === "wedge_foh") return { type: "monitor", id, label: "Wedge", kind: "wedge", supplier: "foh" };
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
    });

    const baseProject: Project = {
      id: "p-drum-update-off",
      bandRef: band.id,
      purpose: "event",
      documentDate: "2026-01-01",
      lineup: { drums: ["dr-1"] },
    };
    const patchedProject: Project = {
      ...baseProject,
      id: "p-drum-update-on",
      lineup: {
        drums: {
          musicianId: "dr-1",
          presetOverride: {
            inputs: {
              update: [
                // Hi-hat isn't one of the catalog families (kick/snare/tom/
                // floor) that the drum label formatter always recomputes, so
                // its rename is expected to survive to the printed label.
                { key: "dr_hihat", label: "Hi-hat EDITED" },
                { key: "dr_kick_1_out", note: "Custom kick note EDITED" },
              ],
            },
          },
        },
      },
    };

    const vmBase = buildDocument(baseProject, repoFor(baseProject));
    const vmPatched = buildDocument(patchedProject, repoFor(patchedProject));

    expect(vmBase.inputs.find((i) => i.key === "dr_hihat")?.label).toBe("Hi-hat");
    expect(vmPatched.inputs.find((i) => i.key === "dr_hihat")?.label).toBe(
      "Hi-hat EDITED",
    );
    expect(vmPatched.inputs.find((i) => i.key === "dr_kick_1_out")?.note).toBe(
      "Custom kick note EDITED",
    );

    // Regression: every other channel is untouched by the patch.
    const pick = (vm: ReturnType<typeof buildDocument>) =>
      vm.inputs
        .filter((i) => i.key !== "dr_hihat" && i.key !== "dr_kick_1_out")
        .map((i) => ({ key: i.key, label: i.label, note: i.note }));
    expect(pick(vmPatched)).toEqual(pick(vmBase));
  });
});
