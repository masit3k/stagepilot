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
import { createDefaultDrumDefinition } from "../drums/drumDefinition.js";

describe("buildDocument setup overrides", () => {
  it("uses lineup monitoring + input overrides in monitor table and stageplan", () => {
    const band: Band = {
      id: "band",
      name: "Band",
      bandLeader: "bass-1",
      defaultLineup: { bass: ["bass-1"] },
      defaultVocals: { lead: [], back: [] },
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
      defaultLineup: { bass: ["bass-1"] },
      defaultVocals: { lead: [], back: [] },
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
      defaultLineup: { vocs: ["lead-1"], guitar: ["gtr-1"] },
      defaultVocals: { lead: [], back: [] },
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
      lineup: { vocs: ["lead-1"], guitar: ["gtr-1"] },
      overlays: { leadVocals: [{ slot: 1, musicianId: "lead-1" }] },
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

  it("does not print back vocal rows without explicit project overlays.backVocals", () => {
    const band: Band = {
      id: "band",
      name: "Band",
      bandLeader: "lead-1",
      defaultLineup: { vocs: ["lead-1"], guitar: ["gtr-1"] },
      defaultVocals: { lead: [], back: ["gtr-1"] },
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
            type: "vocal_type",
            id,
            label: "Back vocal (no mic)",
            group: "vocs",
            input: { key: "voc_back_{ownerKey}", label: "Back vocal – {ownerLabel}" },
          };
        if (id === "el_guitar")
          return {
            type: "preset",
            id,
            label: "Guitar",
            group: "guitar",
            inputs: [{ key: "gtr", label: "Guitar", group: "guitar" }],
          };
        if (id === "wedge") return { type: "monitor", id, label: "Wedge monitor" };
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
      vm.inputs.some((input) => input.key.startsWith("voc_back_")),
    ).toBe(false);
  });

  it("uses explicit overlays lead vocals as authoritative output source", () => {
    const band: Band = {
      id: "band",
      name: "Band",
      bandLeader: "keys-1",
      defaultLineup: { vocs: ["voc-1"], keys: ["keys-1"] },
      defaultVocals: { lead: [], back: [] },
    };
    const vocalist: Musician = {
      id: "voc-1",
      firstName: "Vocal",
      lastName: "Default",
      group: "vocs",
      presets: [
        { kind: "preset", ref: "vocal_lead_no_mic" },
        { kind: "monitor", ref: "wedge" },
      ],
    };
    const keys: Musician = {
      id: "keys-1",
      firstName: "Keys",
      lastName: "Player",
      group: "keys",
      presets: [
        { kind: "preset", ref: "keys" },
        { kind: "monitor", ref: "wedge" },
      ],
    };
    const project: Project = {
      id: "p-lead-override",
      bandRef: "band",
      purpose: "event",
      documentDate: "2026-01-01",
      lineup: { vocs: ["voc-1"], keys: ["keys-1"] },
      overlays: { leadVocals: [{ slot: 1, musicianId: "keys-1" }] },
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
    const leadNames = (vm.stageplan.leadVocals ?? []).map((item) => item.firstName);
    expect(leadNames).toEqual(["Keys"]);
    expect(leadNames).not.toContain("Vocal");
  });

  it("keeps mixed-role lead vocalist order authoritative for stageplan and vocs numbering", () => {
    const band: Band = {
      id: "band-lead-order",
      name: "Band",
      bandLeader: "keys-1",
      defaultLineup: { vocs: ["voc-1", "voc-2"], keys: ["keys-1"] },
      defaultVocals: { lead: [], back: [] },
    };
    const voc1: Musician = {
      id: "voc-1",
      firstName: "Vocal One",
      lastName: "Singer",
      group: "vocs",
      presets: [{ kind: "preset", ref: "vocal_lead_no_mic" }, { kind: "monitor", ref: "wedge" }],
    };
    const voc2: Musician = {
      id: "voc-2",
      firstName: "Vocal Two",
      lastName: "Singer",
      group: "vocs",
      presets: [{ kind: "preset", ref: "vocal_lead_no_mic" }, { kind: "monitor", ref: "wedge" }],
    };
    const keys: Musician = {
      id: "keys-1",
      firstName: "Keys",
      lastName: "Player",
      group: "keys",
      presets: [
        { kind: "preset", ref: "keys_with_lead" },
        { kind: "monitor", ref: "wedge" },
      ],
    };
    const project: Project = {
      id: "p-lead-order",
      bandRef: "band-lead-order",
      purpose: "event",
      documentDate: "2026-01-01",
      lineup: { vocs: ["voc-1", "voc-2"], keys: ["keys-1"] },
      overlays: { leadVocals: [{ slot: 1, musicianId: "keys-1" }, { slot: 2, musicianId: "voc-2" }, { slot: 3, musicianId: "voc-1" }] },
    };
    const notes: NotesTemplate = { id: "notes_default_cs", lang: "cs", inputs: [], monitors: [] };

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
        if (id === "wedge") return { type: "monitor", id, label: "Wedge" };
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

    expect(vm.stageplan.leadVocals.map((item) => item.firstName)).toEqual([
      "Keys",
      "Vocal Two",
      "Vocal One",
    ]);
    expect(vm.inputRows.filter((row) => row.label.startsWith("Lead vocal")).map((row) => row.label)).toEqual([
      "Lead vocal (keys)",
      "Lead vocal 3",
      "Lead vocal 2",
    ]);
  });

  it("respects explicit empty overlays.leadVocals and does not fallback to lineup vocs", () => {
    const band: Band = {
      id: "band-empty-lead",
      name: "Band",
      bandLeader: "voc-1",
      defaultLineup: { vocs: ["voc-1"] },
      defaultVocals: { lead: ["voc-1"], back: [] },
    };
    const vocalist: Musician = {
      id: "voc-1",
      firstName: "Vocal",
      lastName: "Default",
      group: "vocs",
      presets: [{ kind: "preset", ref: "vocal_lead_no_mic" }, { kind: "monitor", ref: "wedge" }],
    };
    const project: Project = {
      id: "p-empty-lead",
      bandRef: "band-empty-lead",
      purpose: "event",
      documentDate: "2026-01-01",
      lineup: { vocs: ["voc-1"] },
      overlays: { leadVocals: [] },
    };
    const notes: NotesTemplate = { id: "notes_default_cs", lang: "cs", inputs: [], monitors: [] };

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
        if (id === "wedge") return { type: "monitor", id, label: "Wedge" };
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
      defaultVocals: { lead: [], back: [] },
    };
    const bassist: Musician = {
      id: "bass-1",
      firstName: "Bass",
      lastName: "Player",
      group: "bass",
      presets: [
        { kind: "preset", ref: "el_bass_xlr_pedalboard" },
        { kind: "preset", ref: "vocal_lead_no_mic" },
        { kind: "monitor", ref: "wedge" },
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
        { kind: "monitor", ref: "wedge" },
      ],
    };
    const project: Project = {
      id: "p-rhythm-vocals",
      bandRef: "band-rhythm-vocals",
      purpose: "event",
      documentDate: "2026-01-01",
      lineup: { bass: ["bass-1"], drums: ["dr-1"] },
      overlays: {
        leadVocals: [{ slot: 1, musicianId: "bass-1" }, { slot: 2, musicianId: "dr-1" }],
      },
    };
    const notes: NotesTemplate = { id: "notes_default_cs", lang: "cs", inputs: [], monitors: [] };
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
        if (id === "wedge") return { type: "monitor", id, label: "Wedge" };
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
    expect(vm.stageplan.leadVocals.map((person) => person.firstName)).toEqual(["Bass", "Drum"]);
    expect(vm.inputRows.some((row) => row.label === "Lead vocal (bass)")).toBe(true);
    expect(vm.inputRows.some((row) => row.label === "Lead vocal (drums)")).toBe(true);
  });

  it("formats mixed lead/back vocal PDF labels and de-duplicates monitor rows", () => {
    const band: Band = {
      id: "band-vocal-labels",
      name: "Band",
      bandLeader: "voc-1",
      defaultLineup: { vocs: ["voc-1"], guitar: ["gtr-1"], keys: ["keys-1"] },
      defaultVocals: { lead: [], back: [] },
    };
    const vocs: Musician = {
      id: "voc-1",
      firstName: "Lead",
      lastName: "Singer",
      group: "vocs",
      presets: [{ kind: "preset", ref: "vocal_lead_no_mic" }, { kind: "monitor", ref: "wedge" }],
    };
    const guitar: Musician = {
      id: "gtr-1",
      firstName: "Guitar",
      lastName: "Player",
      group: "guitar",
      presets: [{ kind: "preset", ref: "el_guitar" }, { kind: "monitor", ref: "wedge" }],
    };
    const keys: Musician = {
      id: "keys-1",
      firstName: "Keys",
      lastName: "Player",
      group: "keys",
      presets: [{ kind: "preset", ref: "keys_with_lead" }, { kind: "monitor", ref: "wedge" }],
    };
    const project: Project = {
      id: "p-vocal-labels",
      bandRef: "band-vocal-labels",
      purpose: "event",
      documentDate: "2026-01-01",
      lineup: { vocs: ["voc-1"], guitar: ["gtr-1"], keys: ["keys-1"] },
      overlays: {
        backVocals: [{ slot: 1, musicianId: "gtr-1" }],
        leadVocals: [{ slot: 1, musicianId: "voc-1" }, { slot: 2, musicianId: "keys-1" }],
      },
    };
    const notes: NotesTemplate = { id: "notes_default_cs", lang: "cs", inputs: [], monitors: [] };
    const repo: DataRepository = {
      getBand: () => band,
      getMusician: (id: string) => (id === "voc-1" ? vocs : id === "gtr-1" ? guitar : keys),
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
            type: "vocal_type",
            id,
            label: "Back vocal (no mic)",
            group: "vocs",
            input: { key: "voc_back_{ownerKey}", label: "Back vocal – {ownerLabel}" },
          };
        }
        if (id === "wedge") return { type: "monitor", id, label: "Wedge" };
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
    expect(vm.inputRows.some((row) => row.label === "Lead vocal 1")).toBe(true);
    expect(vm.inputRows.some((row) => row.label === "Lead vocal (keys)")).toBe(true);
    expect(vm.inputRows.some((row) => row.label === "Back vocal (guitar)")).toBe(true);
    expect(vm.stageplan.monitorOutputs.map((row) => row.output)).toEqual([
      "Guitar",
      "Lead vocal 1",
      "Lead vocal 2",
      "Keys",
    ]);
  });

  it("keeps explicit lineup input note override over seeded no-mic preset note", () => {
    const band: Band = {
      id: "band",
      name: "Band",
      bandLeader: "lead-1",
      defaultLineup: { vocs: ["lead-1"] },
      defaultVocals: { lead: [], back: [] },
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

it("emits stageplan input ownerRole from current lineup assignment", () => {
  const band: Band = {
    id: "band-owner",
    name: "Band",
    bandLeader: "guitar-1",
    defaultLineup: { guitar: ["guitar-1"], vocs: ["vocs-1"] },
    defaultVocals: { lead: [], back: [] },
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
    overlays: { leadVocals: [{ slot: 1, musicianId: "vocs-1" }] },
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
      defaultLineup: { drums: ["dr-1"] },
      defaultVocals: { lead: [], back: [] },
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
    expect(vm.inputs.filter((item) => item.key.startsWith("dr_kick_1_out")).length).toBe(1);
    expect(vm.inputs.filter((item) => item.key.startsWith("dr_tracks_l")).length).toBe(1);
    const stageplanLabels = vm.stageplan.inputs.map((item) => item.label);
    expect(stageplanLabels).toContain("Backing track L");
    expect(stageplanLabels).toContain("Backing track R");
    expect(stageplanLabels.indexOf("Backing track L")).toBeGreaterThan(stageplanLabels.indexOf("PAD SFX R"));
  });

  it("uses effective drumDefinition override from lineup for counts and tracks toggle", () => {
    const band: Band = {
      id: "band-d-override",
      name: "Band",
      bandLeader: "dr-2",
      defaultLineup: { drums: ["dr-2"], bass: ["b-1"] },
      defaultVocals: { lead: [], back: [] },
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
            kicks: [{ in: true, out: true }, { in: true, out: true }],
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
            kicks: [{ in: true, out: true }, { in: true, out: true }],
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
    });

    const vmWithTracks = buildDocument(projectWithTracks, repoForProject(projectWithTracks));
    expect(vmWithTracks.inputs.some((item) => item.key === "dr_kick_2_out")).toBe(true);
    expect(vmWithTracks.inputs.some((item) => item.key === "dr_snare3_top")).toBe(true);
    expect(vmWithTracks.inputs.some((item) => item.key === "dr_tom_4")).toBe(true);
    expect(vmWithTracks.inputs.some((item) => item.key === "dr_floor_2")).toBe(true);
    expect(vmWithTracks.inputs.some((item) => item.key === "dr_tracks_l")).toBe(true);
    expect(vmWithTracks.inputs.some((item) => item.key === "dr_tracks_r")).toBe(true);
    expect(vmWithTracks.inputs.filter((item) => item.key.startsWith("dr_kick_1_out")).length).toBe(1);
    expect(vmWithTracks.stageplan.inputs.some((item) => item.label === "Backing track L")).toBe(true);
    expect(vmWithTracks.stageplan.inputs.some((item) => item.label === "Backing track R")).toBe(true);
    expect(vmWithTracks.inputs.some((item) => item.key === "el_bass_xlr_pedalboard")).toBe(true);

    const vmWithoutTracks = buildDocument(projectWithoutTracks, repoForProject(projectWithoutTracks));
    expect(vmWithoutTracks.inputs.some((item) => item.key === "dr_tracks_l")).toBe(false);
    expect(vmWithoutTracks.inputs.some((item) => item.key === "dr_tracks_r")).toBe(false);
    expect(vmWithoutTracks.stageplan.inputs.some((item) => item.label === "Backing track L")).toBe(false);
    expect(vmWithoutTracks.stageplan.inputs.some((item) => item.label === "Backing track R")).toBe(false);
  });
});
