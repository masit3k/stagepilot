import { describe, expect, it } from "vitest";
import type { DataRepository } from "../../infra/fs/repo.js";
import { createDefaultDrumDefinition } from "../drums/drumDefinition.js";
import type { Band, Musician, NotesTemplate, PresetEntity, Project } from "../model/types.js";
import { buildDocument } from "./buildDocument.js";

/**
 * `labelIsCanonical` (task 12c, part 2) tells the "02 INPUTS" screen which
 * rows have a name it computes itself — kick/snare/tom/floor drum channels
 * and every lead/back vocal overlay row — so the UI can disable the rename
 * field instead of accepting text it silently discards. It's set exactly
 * where the label gets recomputed, so it can't drift from
 * `formatDrumInputDisplayLabel` / `formatLeadVocalPdfLabel` /
 * `formatBackVocalPdfLabel`.
 */
describe("buildDocument labelIsCanonical flag", () => {
  it("marks kick/snare/tom/floor drum channels canonical but leaves hihat/pad/tracks and instrument/talkback rows editable", () => {
    const band: Band = {
      id: "band-canonical-drums",
      name: "Band",
      bandLeader: "dr-1",
      defaultLineup: { drums: ["dr-1"], bass: ["bass-1"] },
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
            ...createDefaultDrumDefinition(),
            pad: { enabled: true, mode: "sfx", channels: "mono" },
          },
        },
      ],
    };
    const bassist: Musician = {
      id: "bass-1",
      firstName: "Ben",
      lastName: "Bass",
      group: "bass",
      presets: [{ kind: "preset", ref: "el_bass_xlr_pedalboard" }],
    };
    const notes: NotesTemplate = { id: "notes_default_cs", lang: "cs", inputs: [], monitors: [] };
    const presets: Record<string, PresetEntity> = {
      el_bass_xlr_pedalboard: {
        type: "preset",
        id: "el_bass_xlr_pedalboard",
        label: "Electric bass guitar",
        group: "bass",
        inputs: [{ key: "el_bass_xlr_pedalboard", label: "Electric bass guitar", group: "bass" }],
      },
      wedge_foh: { type: "monitor", id: "wedge_foh", label: "Wedge", kind: "wedge", supplier: "foh" },
      talkback: {
        type: "talkback_type",
        id: "talkback",
        label: "Talkback",
        group: "talkback",
        input: { key: "tb_{ownerKey}", label: "Talkback ({ownerLabel})" },
      },
    };
    const project: Project = {
      id: "p-canonical-drums",
      bandRef: band.id,
      purpose: "event",
      documentDate: "2026-01-01",
      lineup: { drums: ["dr-1"], bass: ["bass-1"] },
      overlays: { talkback: { mode: "assigned", ownerId: "bass-1" } },
    };
    const repo: DataRepository = {
      getBand: () => band,
      getMusician: (id) => (id === "dr-1" ? drummer : bassist),
      getProject: () => project,
      getPreset: (id) => {
        const preset = presets[id];
        if (!preset) throw new Error(`unknown preset ${id}`);
        return preset;
      },
      getNotesTemplate: () => notes,
    };

    const vm = buildDocument(project, repo);
    const byKey = (key: string) => vm.inputs.find((i) => i.key === key);

    expect(byKey("dr_kick_1_out")?.labelIsCanonical).toBe(true);
    expect(byKey("dr_snare1_top")?.labelIsCanonical).toBe(true);
    expect(byKey("dr_tom_1")?.labelIsCanonical).toBe(true);
    expect(byKey("dr_floor_1")?.labelIsCanonical).toBe(true);

    expect(byKey("dr_hihat")?.labelIsCanonical).toBe(false);
    expect(byKey("dr_pad_mono_sfx")?.labelIsCanonical).toBe(false);
    expect(byKey("el_bass_xlr_pedalboard")?.labelIsCanonical).toBe(false);
    expect(byKey("tb_bass")?.labelIsCanonical).toBe(false);
  });

  it("marks lead and back vocal overlay rows canonical, including for a singer holding a different lineup role", () => {
    const band: Band = {
      id: "band-canonical-vocals",
      name: "Band",
      bandLeader: "keys-1",
      defaultLineup: { keys: ["keys-1"], vocs: ["voc-1"] },
      defaultOverlays: { leadVocals: [], backVocals: [] },
    };
    const keys: Musician = {
      id: "keys-1",
      firstName: "Kira",
      lastName: "Keys",
      group: "keys",
      presets: [{ kind: "preset", ref: "keys_mono" }],
    };
    const singer: Musician = {
      id: "voc-1",
      firstName: "Vera",
      lastName: "Vocal",
      group: "vocs",
      presets: [],
    };
    const notes: NotesTemplate = { id: "notes_default_cs", lang: "cs", inputs: [], monitors: [] };
    const presets: Record<string, PresetEntity> = {
      keys_mono: {
        type: "preset",
        id: "keys_mono",
        label: "Keys",
        group: "keys",
        inputs: [{ key: "keys_mono", label: "Keys", group: "keys" }],
      },
      wedge_foh: { type: "monitor", id: "wedge_foh", label: "Wedge", kind: "wedge", supplier: "foh" },
      talkback: {
        type: "talkback_type",
        id: "talkback",
        label: "Talkback",
        group: "talkback",
        input: { key: "tb_{ownerKey}", label: "Talkback ({ownerLabel})" },
      },
    };
    const project: Project = {
      id: "p-canonical-vocals",
      bandRef: band.id,
      purpose: "event",
      documentDate: "2026-01-01",
      lineup: { keys: ["keys-1"], vocs: ["voc-1"] },
      overlays: { leadVocals: ["voc-1"], backVocals: ["keys-1"] },
    };
    const repo: DataRepository = {
      getBand: () => band,
      getMusician: (id) => (id === "keys-1" ? keys : singer),
      getProject: () => project,
      getPreset: (id) => {
        const preset = presets[id];
        if (!preset) throw new Error(`unknown preset ${id}`);
        return preset;
      },
      getNotesTemplate: () => notes,
    };

    const vm = buildDocument(project, repo);
    const byKey = (key: string) => vm.inputs.find((i) => i.key === key);

    expect(byKey("voc_lead_1")?.labelIsCanonical).toBe(true);
    expect(byKey("voc_back_keys_1")?.labelIsCanonical).toBe(true);
    expect(byKey("keys_mono")?.labelIsCanonical).toBe(false);
  });

  it("leaves labelIsCanonical false for a voc_lead-keyed row whose owner isn't in the slot map (fix round 1, Minor 5)", () => {
    // A lineup-role "vocs" musician's own preset, patched via a `replace`
    // whose targetKey isn't found — an existing, working mechanism
    // unrelated to the overlay rows this task fixed (see the "replace
    // trick" in `applyInputReplacements`). It produces a `voc_lead`-keyed
    // row with no `ownerMusicianId`, so `formatLeadVocalPdfLabel` takes its
    // `!ownerMusicianId` early return and prints `fallbackLabel` verbatim —
    // that row's name is NOT computed, so a rename on it would actually
    // land, and `labelIsCanonical` must say so.
    const band: Band = {
      id: "band-lead-no-owner",
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
      presets: [{ kind: "preset", ref: "vocal_lead_no_mic" }],
    };
    const notes: NotesTemplate = { id: "notes_default_cs", lang: "cs", inputs: [], monitors: [] };
    const project: Project = {
      id: "p-lead-no-owner",
      bandRef: band.id,
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
                  with: { key: "voc_lead", label: "Lead vocal", note: "Custom note", group: "vocs" },
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
      getPreset: (id) => {
        if (id === "vocal_lead_no_mic")
          return {
            type: "preset",
            id,
            label: "Lead vocal (no mic)",
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
    const row = vm.inputs.find((i) => i.key === "voc_lead");
    expect(row?.label).toBe("Lead vocal");
    expect(row?.labelIsCanonical).toBe(false);
  });
});
