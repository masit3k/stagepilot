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

const notesTemplate: NotesTemplate = {
  id: "notes_default_cs",
  lang: "cs",
  inputs: [],
  monitors: [],
};

function createRepo(args: {
  band: Band;
  musicians: Record<string, Musician>;
  presets: Record<string, PresetEntity>;
  project: Project;
}): DataRepository {
  return {
    getBand: () => args.band,
    getMusician: (id: string) => {
      const musician = args.musicians[id];
      if (!musician) throw new Error(`Unknown musician ${id}`);
      return musician;
    },
    getProject: () => args.project,
    getPreset: (id: string) => {
      const preset = args.presets[id];
      if (!preset) throw new Error(`Unknown preset ${id}`);
      return preset;
    },
    getNotesTemplate: () => notesTemplate,
  };
}

describe("buildDocument vocal overlay composition", () => {
  it("keeps monitor/stageplan cardinality lineup-based while applying unified lead/back labels", () => {
    const band: Band = {
      id: "band",
      name: "Band",
      bandLeader: "voc-1",
      defaultLineup: {
        guitar: ["gtr-1"],
        bass: ["bass-1"],
        drums: ["drm-1"],
        vocs: ["voc-1"],
      },
      defaultOverlays: { leadVocals: [], backVocals: [] },
    };

    const musicians: Record<string, Musician> = {
      "gtr-1": {
        id: "gtr-1",
        firstName: "Guitar",
        lastName: "Player",
        gender: "m",
        group: "guitar",
        presets: [
          { kind: "preset", ref: "el_guitar" },
          { kind: "monitor", ref: "iem_stereo_wireless_foh" },
        ],
      },
      "bass-1": {
        id: "bass-1",
        firstName: "Bass",
        lastName: "Player",
        gender: "m",
        group: "bass",
        presets: [
          { kind: "preset", ref: "el_bass_xlr_pedalboard" },
          { kind: "preset", ref: "vocal_lead_no_mic" },
          { kind: "monitor", ref: "iem_stereo_wireless_foh" },
        ],
      },
      "drm-1": {
        id: "drm-1",
        firstName: "Drummer",
        lastName: "Player",
        gender: "m",
        group: "drums",
        presets: [
          { kind: "preset", ref: "drums_basic" },
          { kind: "monitor", ref: "iem_stereo_wireless_foh" },
        ],
      },
      "voc-1": {
        id: "voc-1",
        firstName: "Vocal",
        lastName: "Player",
        gender: "f",
        group: "vocs",
        presets: [
          { kind: "preset", ref: "vocal_lead_no_mic" },
          { kind: "monitor", ref: "wedge_foh" },
        ],
      },
    };

    const project: Project = {
      id: "project",
      bandRef: "band",
      purpose: "event",
      documentDate: "2026-01-01",
      lineup: band.defaultLineup,
      overlays: {
        leadVocals: ["bass-1", "voc-1"],
        backVocals: ["gtr-1", "voc-1"],
        talkback: { mode: "assigned", ownerId: "bass-1" },
      },
    };

    const presets: Record<string, PresetEntity> = {
      el_guitar: {
        type: "preset",
        id: "el_guitar",
        label: "Electric guitar",
        group: "guitar",
        inputs: [
          { key: "el_guitar", label: "Electric guitar", group: "guitar" },
        ],
      },
      el_bass_xlr_pedalboard: {
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
      },
      drums_basic: {
        type: "preset",
        id: "drums_basic",
        label: "Drums",
        group: "drums",
        inputs: [{ key: "dr_oh_l", label: "OH L", group: "drums" }],
      },
      vocal_lead_no_mic: {
        type: "preset",
        id: "vocal_lead_no_mic",
        label: "Lead vocal no mic",
        group: "vocs",
        inputs: [
          {
            key: "voc_cap_no_mic",
            label: "Lead vocal capability",
            group: "vocs",
          },
        ],
      },
      vocal_back_no_mic: {
        type: "preset",
        id: "vocal_back_no_mic",
        label: "Back vocal no mic",
        group: "vocs",
        inputs: [{ key: "voc_back", label: "Back vocal", group: "vocs" }],
      },
      talkback: {
        type: "talkback_type",
        id: "talkback",
        label: "Talkback",
        group: "talkback",
        input: { key: "tb_{ownerKey}", label: "Talkback - {ownerLabel}" },
      },
      wedge_foh: { type: "monitor", id: "wedge_foh", label: "Wedge monitor (provided by FOH)", kind: "wedge", supplier: "foh" },
      iem_stereo_wireless_foh: {
        type: "monitor",
        id: "iem_stereo_wireless_foh",
        label: "IEM STEREO wireless (provided by FOH)",
        kind: "iem",
        supplier: "foh",
        mode: "stereo",
        wireless: true,
      },
    };

    const vm = buildDocument(
      project,
      createRepo({ band, musicians, presets, project }),
    );

    const monitorOutputs = vm.stageplan.monitorOutputs.map((row) => row.output);
    expect(monitorOutputs).toEqual([
      "Guitar",
      "Lead vocal 2 (female)",
      "Bass",
      "Drums",
    ]);
    expect(vm.stageplan.monitorOutputs).toHaveLength(4);

    const stageplanPersonCount =
      ["drums", "bass", "guitar", "keys"]
        .map(
          (role) =>
            vm.stageplan.lineupByRole[
              role as "drums" | "bass" | "guitar" | "keys"
            ],
        )
        .filter(Boolean).length + (vm.stageplan.leadVocals?.length ?? 0);
    expect(stageplanPersonCount).toBe(4);

    expect(
      vm.inputs.some((input) => input.label === "Lead vocal 1 (bass)"),
    ).toBe(true);
    expect(
      vm.inputs.some((input) => input.label === "Lead vocal 2 (female)"),
    ).toBe(true);
    expect(vm.inputs.some((input) => input.label === "Talkback (bass)")).toBe(
      true,
    );
    expect(vm.inputs.some((input) => input.label === "Talkback - bass")).toBe(
      false,
    );
  });

  it("renders monitor owners in business order and keeps all resolved lead owners in input rows", () => {
    const band: Band = {
      id: "band-2",
      name: "Band",
      bandLeader: "voc-1",
      defaultLineup: {
        drums: ["drm-1"],
        bass: ["bass-1"],
        guitar: ["gtr-1"],
        keys: ["keys-1"],
        vocs: ["voc-1", "voc-2"],
      },
      defaultOverlays: { leadVocals: [], backVocals: [] },
    };

    const musicians: Record<string, Musician> = {
      "drm-1": {
        id: "drm-1",
        firstName: "Drummer",
        lastName: "Player",
        gender: "m",
        group: "drums",
        presets: [
          { kind: "preset", ref: "drums_basic" },
          { kind: "preset", ref: "vocal_wired" },
          { kind: "monitor", ref: "iem_stereo_wireless_foh" },
        ],
      },
      "bass-1": {
        id: "bass-1",
        firstName: "Bass",
        lastName: "Player",
        gender: "m",
        group: "bass",
        presets: [
          { kind: "preset", ref: "el_bass_xlr_pedalboard" },
          { kind: "preset", ref: "vocal_wired" },
          { kind: "monitor", ref: "iem_stereo_wireless_foh" },
        ],
      },
      "gtr-1": {
        id: "gtr-1",
        firstName: "Guitar",
        lastName: "Player",
        gender: "m",
        group: "guitar",
        presets: [
          { kind: "preset", ref: "el_guitar" },
          { kind: "monitor", ref: "iem_stereo_wireless_foh" },
        ],
      },
      "keys-1": {
        id: "keys-1",
        firstName: "Keys",
        lastName: "Player",
        gender: "f",
        group: "keys",
        presets: [
          { kind: "preset", ref: "keys_stereo_xlr" },
          { kind: "monitor", ref: "iem_stereo_wireless_foh" },
        ],
      },
      "voc-1": {
        id: "voc-1",
        firstName: "Lead",
        lastName: "Singer",
        gender: "f",
        group: "vocs",
        presets: [
          { kind: "preset", ref: "vocal_lead_no_mic" },
          { kind: "monitor", ref: "wedge_foh" },
        ],
      },
      "voc-2": {
        id: "voc-2",
        firstName: "Back",
        lastName: "Singer",
        gender: "m",
        group: "vocs",
        presets: [
          { kind: "preset", ref: "vocal_wired" },
          { kind: "monitor", ref: "wedge_foh" },
        ],
      },
    };

    const project: Project = {
      id: "project-2",
      bandRef: "band-2",
      purpose: "event",
      documentDate: "2026-01-01",
      lineup: band.defaultLineup,
      overlays: {
        leadVocals: [
          "bass-1",
          "voc-1",
          "drm-1",
          "voc-2",
        ],
        backVocals: ["gtr-1"],
      },
    };

    const presets: Record<string, PresetEntity> = {
      drums_basic: {
        type: "preset",
        id: "drums_basic",
        label: "Drums",
        group: "drums",
        inputs: [{ key: "dr_oh_l", label: "OH L", group: "drums" }],
      },
      el_bass_xlr_pedalboard: {
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
      },
      el_guitar: {
        type: "preset",
        id: "el_guitar",
        label: "Electric guitar",
        group: "guitar",
        inputs: [
          { key: "el_guitar", label: "Electric guitar", group: "guitar" },
        ],
      },
      keys_stereo_xlr: {
        type: "preset",
        id: "keys_stereo_xlr",
        label: "Keys stereo XLR",
        group: "keys",
        inputs: [
          { key: "keys_l", label: "Keys L", group: "keys" },
          { key: "keys_r", label: "Keys R", group: "keys" },
        ],
      },
      vocal_lead_no_mic: {
        type: "preset",
        id: "vocal_lead_no_mic",
        label: "Lead vocal no mic",
        group: "vocs",
        inputs: [{ key: "voc_lead", label: "Lead vocal", group: "vocs" }],
      },
      vocal_wired: {
        type: "preset",
        id: "vocal_wired",
        label: "Wired vocal",
        group: "vocs",
        inputs: [{ key: "voc_cap_wired", label: "Wired vocal", group: "vocs" }],
      },
      vocal_back_no_mic: {
        type: "preset",
        id: "vocal_back_no_mic",
        label: "Back vocal no mic",
        group: "vocs",
        inputs: [{ key: "voc_back", label: "Back vocal", group: "vocs" }],
      },
      talkback: {
        type: "talkback_type",
        id: "talkback",
        label: "Talkback",
        group: "talkback",
        input: { key: "tb_{ownerKey}", label: "Talkback - {ownerLabel}" },
      },
      wedge_foh: { type: "monitor", id: "wedge_foh", label: "Wedge monitor (provided by FOH)", kind: "wedge", supplier: "foh" },
      iem_stereo_wireless_foh: {
        type: "monitor",
        id: "iem_stereo_wireless_foh",
        label: "IEM STEREO wireless (provided by FOH)",
        kind: "iem",
        supplier: "foh",
        mode: "stereo",
        wireless: true,
      },
    };

    const vm = buildDocument(
      project,
      createRepo({ band, musicians, presets, project }),
    );
    expect(vm.stageplan.monitorOutputs.map((row) => row.output)).toEqual([
      "Guitar",
      "Lead vocal 2 (female)",
      "Lead vocal 4 (male)",
      "Keys",
      "Bass",
      "Drums",
    ]);
    expect(vm.stageplan.monitorOutputs).toHaveLength(6);

    const leadRows = vm.inputRows.filter((row) =>
      row.label.startsWith("Lead vocal "),
    );
    expect(leadRows).toHaveLength(4);
    expect(leadRows.some((row) => row.label === "Lead vocal 1 (bass)")).toBe(
      true,
    );
    expect(leadRows.some((row) => row.label === "Lead vocal 2 (female)")).toBe(
      true,
    );
    expect(leadRows.some((row) => row.label === "Lead vocal 3 (drums)")).toBe(
      true,
    );
    expect(leadRows.some((row) => row.label === "Lead vocal 4 (male)")).toBe(
      true,
    );

    const stageplanPersonCount =
      ["drums", "bass", "guitar", "keys"]
        .map(
          (role) =>
            vm.stageplan.lineupByRole[
              role as "drums" | "bass" | "guitar" | "keys"
            ],
        )
        .filter(Boolean).length + (vm.stageplan.leadVocals?.length ?? 0);
    expect(stageplanPersonCount).toBe(6);
  });

  it("moves vocals to an end block, keeps talkback last, and keeps drummer lead vocal attached to drums in stageplan", () => {
    const band: Band = {
      id: "band-3",
      name: "Band",
      bandLeader: "voc-f",
      defaultLineup: {
        guitar: ["gtr-1"],
        keys: ["keys-1"],
        bass: ["bass-1"],
        drums: ["drm-1"],
        vocs: ["voc-m", "voc-f"],
      },
      defaultOverlays: { leadVocals: [], backVocals: [] },
    };

    const musicians: Record<string, Musician> = {
      "gtr-1": {
        id: "gtr-1",
        firstName: "Guitar",
        lastName: "Player",
        gender: "m",
        group: "guitar",
        presets: [
          { kind: "preset", ref: "el_guitar" },
          { kind: "monitor", ref: "iem_stereo_wireless_foh" },
        ],
      },
      "keys-1": {
        id: "keys-1",
        firstName: "Keys",
        lastName: "Player",
        gender: "f",
        group: "keys",
        presets: [
          { kind: "preset", ref: "keys_stereo_xlr" },
          { kind: "monitor", ref: "iem_stereo_wireless_foh" },
        ],
      },
      "bass-1": {
        id: "bass-1",
        firstName: "Bass",
        lastName: "Player",
        gender: "m",
        group: "bass",
        presets: [
          { kind: "preset", ref: "el_bass_xlr_pedalboard" },
          { kind: "preset", ref: "vocal_wired" },
          { kind: "monitor", ref: "iem_stereo_wireless_foh" },
        ],
      },
      "drm-1": {
        id: "drm-1",
        firstName: "Drummer",
        lastName: "Player",
        gender: "m",
        group: "drums",
        presets: [
          { kind: "preset", ref: "drums_basic" },
          { kind: "preset", ref: "vocal_wired" },
          { kind: "monitor", ref: "iem_stereo_wireless_foh" },
        ],
      },
      "voc-m": {
        id: "voc-m",
        firstName: "Male",
        lastName: "Singer",
        gender: "m",
        group: "vocs",
        presets: [
          { kind: "preset", ref: "vocal_lead_no_mic" },
          { kind: "monitor", ref: "wedge_foh" },
        ],
      },
      "voc-f": {
        id: "voc-f",
        firstName: "Female",
        lastName: "Singer",
        gender: "f",
        group: "vocs",
        presets: [
          { kind: "preset", ref: "vocal_lead_no_mic" },
          { kind: "monitor", ref: "wedge_foh" },
        ],
      },
    };

    const project: Project = {
      id: "project-3",
      bandRef: "band-3",
      purpose: "event",
      documentDate: "2026-01-01",
      lineup: band.defaultLineup,
      overlays: {
        leadVocals: [
          "voc-m",
          "voc-f",
          "bass-1",
          "drm-1",
        ],
        backVocals: ["gtr-1"],
        talkback: { mode: "assigned", ownerId: "bass-1" },
      },
    };

    const presets: Record<string, PresetEntity> = {
      drums_basic: {
        type: "preset",
        id: "drums_basic",
        label: "Drums",
        group: "drums",
        inputs: [{ key: "dr_kick_in", label: "Kick IN", group: "drums" }],
      },
      el_bass_xlr_pedalboard: {
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
      },
      el_guitar: {
        type: "preset",
        id: "el_guitar",
        label: "Electric guitar",
        group: "guitar",
        inputs: [
          { key: "el_guitar", label: "Electric guitar", group: "guitar" },
        ],
      },
      keys_stereo_xlr: {
        type: "preset",
        id: "keys_stereo_xlr",
        label: "Keys stereo XLR",
        group: "keys",
        inputs: [{ key: "keys", label: "Keys", group: "keys" }],
      },
      vocal_lead_no_mic: {
        type: "preset",
        id: "vocal_lead_no_mic",
        label: "Lead vocal no mic",
        group: "vocs",
        inputs: [{ key: "voc_lead", label: "Lead vocal", group: "vocs" }],
      },
      vocal_back_no_mic: {
        type: "preset",
        id: "vocal_back_no_mic",
        label: "Back vocal no mic",
        group: "vocs",
        inputs: [
          {
            key: "voc_cap_back_no_mic",
            label: "Back vocal capability",
            group: "vocs",
          },
        ],
      },
      vocal_wired: {
        type: "preset",
        id: "vocal_wired",
        label: "Wired vocal",
        group: "vocs",
        inputs: [{ key: "voc_cap_wired", label: "Wired vocal", group: "vocs" }],
      },
      talkback: {
        type: "talkback_type",
        id: "talkback",
        label: "Talkback",
        group: "talkback",
        input: { key: "tb_{ownerKey}", label: "Talkback - {ownerLabel}" },
      },
      wedge_foh: { type: "monitor", id: "wedge_foh", label: "Wedge monitor (provided by FOH)", kind: "wedge", supplier: "foh" },
      iem_stereo_wireless_foh: {
        type: "monitor",
        id: "iem_stereo_wireless_foh",
        label: "IEM STEREO wireless (provided by FOH)",
        kind: "iem",
        supplier: "foh",
        mode: "stereo",
        wireless: true,
      },
    };

    const vm = buildDocument(
      project,
      createRepo({ band, musicians, presets, project }),
    );
    const labels = vm.inputRows.map((row) => row.label);
    const vocals = labels.filter((label) => label.includes("vocal"));
    expect(vocals).toEqual([
      "Back vocal (guitar)",
      "Lead vocal 1 (male)",
      "Lead vocal 2 (female)",
      "Lead vocal 3 (bass)",
      "Lead vocal 4 (drums)",
    ]);
    expect(labels.at(-1)).toBe("Talkback (bass)");

    const firstVocalIndex = labels.findIndex((label) =>
      label.includes("vocal"),
    );
    const lastVocalIndex = labels.reduce(
      (index, label, current) => (label.includes("vocal") ? current : index),
      -1,
    );
    expect(firstVocalIndex).toBeGreaterThan(0);
    expect(
      labels.slice(0, firstVocalIndex).some((label) => label.includes("vocal")),
    ).toBe(false);
    expect(
      labels
        .slice(firstVocalIndex, lastVocalIndex + 1)
        .every((label) => label.includes("vocal")),
    ).toBe(true);

    expect(
      vm.stageplan.inputs.some(
        (input) =>
          input.ownerRole === "drums" && input.label === "Lead vocal 4 (drums)",
      ),
    ).toBe(true);

    const stageplanPersonCount =
      ["drums", "bass", "guitar", "keys"]
        .map(
          (role) =>
            vm.stageplan.lineupByRole[
              role as "drums" | "bass" | "guitar" | "keys"
            ],
        )
        .filter(Boolean).length + (vm.stageplan.leadVocals?.length ?? 0);
    expect(stageplanPersonCount).toBe(6);
    expect(vm.stageplan.monitorOutputs).toHaveLength(6);
  });

  it("binds lead vocal capability and stageplan inputs by musicianId when overlay order differs", () => {
    const band: Band = {
      id: "band-musician-binding",
      name: "Band",
      bandLeader: "voc-1",
      defaultLineup: {
        guitar: ["gtr-1"],
        bass: ["bass-1"],
        drums: ["drm-1"],
        vocs: ["voc-1", "voc-2"],
      },
      defaultOverlays: { leadVocals: [], backVocals: [] },
    };

    const musicians: Record<string, Musician> = {
      "gtr-1": {
        id: "gtr-1",
        firstName: "Gtr",
        lastName: "One",
        gender: "m",
        group: "guitar",
        presets: [
          { kind: "preset", ref: "el_guitar" },
          { kind: "monitor", ref: "iem_stereo_wireless_foh" },
        ],
      },
      "bass-1": {
        id: "bass-1",
        firstName: "Bass",
        lastName: "One",
        gender: "m",
        group: "bass",
        presets: [
          { kind: "preset", ref: "el_bass_xlr_pedalboard" },
          { kind: "monitor", ref: "iem_stereo_wireless_foh" },
        ],
      },
      "drm-1": {
        id: "drm-1",
        firstName: "Dr",
        lastName: "One",
        gender: "m",
        group: "drums",
        presets: [
          { kind: "preset", ref: "drums_basic" },
          { kind: "monitor", ref: "iem_stereo_wireless_foh" },
        ],
      },
      "voc-1": {
        id: "voc-1",
        firstName: "Eliska",
        lastName: "Singer",
        gender: "f",
        group: "vocs",
        presets: [
          { kind: "preset", ref: "vocal_wireless" },
          { kind: "monitor", ref: "wedge_foh" },
        ],
      },
      "voc-2": {
        id: "voc-2",
        firstName: "Lukas",
        lastName: "Singer",
        gender: "m",
        group: "vocs",
        presets: [
          { kind: "preset", ref: "vocal_wired" },
          { kind: "monitor", ref: "wedge_foh" },
        ],
      },
    };

    const project: Project = {
      id: "project-musician-binding",
      bandRef: "band-musician-binding",
      purpose: "event",
      documentDate: "2026-01-01",
      lineup: band.defaultLineup,
      overlays: {
        leadVocals: [
          "voc-2",
          "voc-1",
        ],
      },
    };

    const presets: Record<string, PresetEntity> = {
      drums_basic: {
        type: "preset",
        id: "drums_basic",
        label: "Drums",
        group: "drums",
        inputs: [{ key: "dr_kick_in", label: "Kick IN", group: "drums" }],
      },
      el_bass_xlr_pedalboard: {
        type: "preset",
        id: "el_bass_xlr_pedalboard",
        label: "Bass",
        group: "bass",
        inputs: [
          { key: "el_bass_xlr_pedalboard", label: "Bass", group: "bass" },
        ],
      },
      el_guitar: {
        type: "preset",
        id: "el_guitar",
        label: "Guitar",
        group: "guitar",
        inputs: [{ key: "el_guitar", label: "Guitar", group: "guitar" }],
      },
      vocal_wireless: {
        type: "preset",
        id: "vocal_wireless",
        label: "Wireless vocal",
        group: "vocs",
        inputs: [
          { key: "voc_cap_wireless", label: "Wireless vocal", group: "vocs" },
        ],
      },
      vocal_wired: {
        type: "preset",
        id: "vocal_wired",
        label: "Wired vocal",
        group: "vocs",
        inputs: [{ key: "voc_cap_wired", label: "Wired vocal", group: "vocs" }],
      },
      talkback: {
        type: "talkback_type",
        id: "talkback",
        label: "Talkback",
        group: "talkback",
        input: { key: "tb_{ownerKey}", label: "Talkback - {ownerLabel}" },
      },
      wedge_foh: { type: "monitor", id: "wedge_foh", label: "Wedge monitor (provided by FOH)", kind: "wedge", supplier: "foh" },
      iem_stereo_wireless_foh: {
        type: "monitor",
        id: "iem_stereo_wireless_foh",
        label: "IEM STEREO wireless (provided by FOH)",
        kind: "iem",
        supplier: "foh",
        mode: "stereo",
        wireless: true,
      },
    };

    const vm = buildDocument(
      project,
      createRepo({ band, musicians, presets, project }),
    );
    const vocalInputs = vm.stageplan.inputs.filter((input) =>
      input.label.startsWith("Lead vocal"),
    );

    expect(vocalInputs).toHaveLength(2);
    expect(
      vocalInputs.some(
        (input) =>
          input.ownerMusicianId === "voc-2" &&
          input.label === "Lead vocal 1 (male)",
      ),
    ).toBe(true);
    expect(
      vocalInputs.some(
        (input) =>
          input.ownerMusicianId === "voc-1" &&
          input.label === "Lead vocal 2 (female)",
      ),
    ).toBe(true);

    const monitorOutputs = vm.stageplan.monitorOutputs.filter((output) =>
      output.output.startsWith("Lead vocal"),
    );
    expect(monitorOutputs).toHaveLength(2);
    expect(
      monitorOutputs.some(
        (output) =>
          output.ownerMusicianId === "voc-2" &&
          output.output === "Lead vocal 1 (male)",
      ),
    ).toBe(true);
    expect(
      monitorOutputs.some(
        (output) =>
          output.ownerMusicianId === "voc-1" &&
          output.output === "Lead vocal 2 (female)",
      ),
    ).toBe(true);
  });

  it("keeps stageplan and monitor cardinality lineup-based after vocalist slot remapping", () => {
    const band: Band = {
      id: "band-cardinality",
      name: "Band",
      bandLeader: "voc-1",
      defaultLineup: {
        guitar: ["gtr-1"],
        bass: ["bass-1"],
        drums: ["drm-1"],
        vocs: ["voc-1", "voc-2"],
      },
      defaultOverlays: { leadVocals: [], backVocals: [] },
    };
    const musicians: Record<string, Musician> = {
      "gtr-1": {
        id: "gtr-1",
        firstName: "Gtr",
        lastName: "One",
        gender: "m",
        group: "guitar",
        presets: [
          { kind: "preset", ref: "el_guitar" },
          { kind: "monitor", ref: "iem_stereo_wireless_foh" },
        ],
      },
      "bass-1": {
        id: "bass-1",
        firstName: "Bass",
        lastName: "One",
        gender: "m",
        group: "bass",
        presets: [
          { kind: "preset", ref: "el_bass_xlr_pedalboard" },
          { kind: "monitor", ref: "iem_stereo_wireless_foh" },
        ],
      },
      "drm-1": {
        id: "drm-1",
        firstName: "Dr",
        lastName: "One",
        gender: "m",
        group: "drums",
        presets: [
          { kind: "preset", ref: "drums_basic" },
          { kind: "monitor", ref: "iem_stereo_wireless_foh" },
        ],
      },
      "voc-1": {
        id: "voc-1",
        firstName: "Eliska",
        lastName: "Singer",
        gender: "f",
        group: "vocs",
        presets: [
          { kind: "preset", ref: "vocal_wireless" },
          { kind: "monitor", ref: "wedge_foh" },
        ],
      },
      "voc-2": {
        id: "voc-2",
        firstName: "Lukas",
        lastName: "Singer",
        gender: "m",
        group: "vocs",
        presets: [
          { kind: "preset", ref: "vocal_wired" },
          { kind: "monitor", ref: "wedge_foh" },
        ],
      },
    };
    const project: Project = {
      id: "project-cardinality",
      bandRef: "band-cardinality",
      purpose: "event",
      documentDate: "2026-01-01",
      lineup: band.defaultLineup,
      overlays: {
        leadVocals: [
          "voc-1",
          "voc-2",
        ],
      },
    };
    const presets: Record<string, PresetEntity> = {
      drums_basic: {
        type: "preset",
        id: "drums_basic",
        label: "Drums",
        group: "drums",
        inputs: [{ key: "dr_kick_in", label: "Kick IN", group: "drums" }],
      },
      el_bass_xlr_pedalboard: {
        type: "preset",
        id: "el_bass_xlr_pedalboard",
        label: "Bass",
        group: "bass",
        inputs: [
          { key: "el_bass_xlr_pedalboard", label: "Bass", group: "bass" },
        ],
      },
      el_guitar: {
        type: "preset",
        id: "el_guitar",
        label: "Guitar",
        group: "guitar",
        inputs: [{ key: "el_guitar", label: "Guitar", group: "guitar" }],
      },
      vocal_wireless: {
        type: "preset",
        id: "vocal_wireless",
        label: "Wireless vocal",
        group: "vocs",
        inputs: [
          { key: "voc_cap_wireless", label: "Wireless vocal", group: "vocs" },
        ],
      },
      vocal_wired: {
        type: "preset",
        id: "vocal_wired",
        label: "Wired vocal",
        group: "vocs",
        inputs: [{ key: "voc_cap_wired", label: "Wired vocal", group: "vocs" }],
      },
      talkback: {
        type: "talkback_type",
        id: "talkback",
        label: "Talkback",
        group: "talkback",
        input: { key: "tb_{ownerKey}", label: "Talkback - {ownerLabel}" },
      },
      wedge_foh: { type: "monitor", id: "wedge_foh", label: "Wedge monitor (provided by FOH)", kind: "wedge", supplier: "foh" },
      iem_stereo_wireless_foh: {
        type: "monitor",
        id: "iem_stereo_wireless_foh",
        label: "IEM STEREO wireless (provided by FOH)",
        kind: "iem",
        supplier: "foh",
        mode: "stereo",
        wireless: true,
      },
    };

    const vm = buildDocument(
      project,
      createRepo({ band, musicians, presets, project }),
    );
    const personCount =
      ["drums", "bass", "guitar", "keys"]
        .map(
          (role) =>
            vm.stageplan.lineupByRole[
              role as "drums" | "bass" | "guitar" | "keys"
            ],
        )
        .filter(Boolean).length + (vm.stageplan.leadVocals?.length ?? 0);

    expect(personCount).toBe(5);
    expect(vm.stageplan.monitorOutputs).toHaveLength(5);
  });

  it("applies a lineup presetOverride.inputs.update note patch to the lead vocal overlay row (task 12c)", () => {
    const band: Band = {
      id: "band-lead-note-patch",
      name: "Band",
      bandLeader: "voc-1",
      defaultLineup: { vocs: ["voc-1"] },
      defaultOverlays: { leadVocals: [], backVocals: [] },
    };
    const singer: Musician = {
      id: "voc-1",
      firstName: "Vera",
      lastName: "Vocal",
      gender: "f",
      group: "vocs",
      presets: [{ kind: "monitor", ref: "wedge_foh" }],
    };
    const notes: NotesTemplate = { id: "notes_default_cs", lang: "cs", inputs: [], monitors: [] };
    const presets: Record<string, PresetEntity> = {
      wedge_foh: { type: "monitor", id: "wedge_foh", label: "Wedge", kind: "wedge", supplier: "foh" },
      talkback: {
        type: "talkback_type",
        id: "talkback",
        label: "Talkback",
        group: "talkback",
        input: { key: "tb_{ownerKey}", label: "Talkback - {ownerLabel}" },
      },
    };
    const makeProject = (withPatch: boolean): Project => ({
      id: withPatch ? "p-lead-note-on" : "p-lead-note-off",
      bandRef: band.id,
      purpose: "event",
      documentDate: "2026-01-01",
      lineup: {
        vocs: withPatch
          ? [
              {
                musicianId: "voc-1",
                presetOverride: {
                  inputs: { update: [{ key: "voc_lead_1", note: "Lead vocal custom note EDITED" }] },
                },
              },
            ]
          : ["voc-1"],
      },
      overlays: { leadVocals: ["voc-1"] },
    });

    const buildFor = (withPatch: boolean) => {
      const project = makeProject(withPatch);
      return buildDocument(project, createRepo({ band, musicians: { "voc-1": singer }, presets, project }));
    };

    const vmOff = buildFor(false);
    const vmOn = buildFor(true);

    expect(vmOff.inputs.find((i) => i.key === "voc_lead_1")?.note).toBeUndefined();
    expect(vmOn.inputs.find((i) => i.key === "voc_lead_1")?.note).toBe(
      "Lead vocal custom note EDITED",
    );
    // Label stays whatever the pipeline would have printed anyway — a lead
    // vocal row's label is canonical (R6 does not make it user text).
    expect(vmOn.inputs.find((i) => i.key === "voc_lead_1")?.label).toBe(
      vmOff.inputs.find((i) => i.key === "voc_lead_1")?.label,
    );
  });

  it("applies presetOverride.inputs.update note patches to back-vocal overlay rows owned by a bassist and a keyboardist, without touching their instrument rows or the canonical vocal label (task 12c)", () => {
    const band: Band = {
      id: "band-back-note-patch",
      name: "Band",
      bandLeader: "bass-1",
      defaultLineup: { bass: ["bass-1"], keys: ["keys-1"] },
      defaultOverlays: { leadVocals: [], backVocals: [] },
    };
    const musicians: Record<string, Musician> = {
      "bass-1": {
        id: "bass-1",
        firstName: "Ben",
        lastName: "Bass",
        gender: "m",
        group: "bass",
        presets: [
          { kind: "preset", ref: "el_bass_xlr_pedalboard" },
          { kind: "monitor", ref: "wedge_foh" },
        ],
      },
      "keys-1": {
        id: "keys-1",
        firstName: "Kira",
        lastName: "Keys",
        gender: "f",
        group: "keys",
        presets: [
          { kind: "preset", ref: "keys_mono" },
          { kind: "monitor", ref: "wedge_foh" },
        ],
      },
    };
    const presets: Record<string, PresetEntity> = {
      el_bass_xlr_pedalboard: {
        type: "preset",
        id: "el_bass_xlr_pedalboard",
        label: "Electric bass guitar",
        group: "bass",
        inputs: [{ key: "el_bass_xlr_pedalboard", label: "Electric bass guitar", group: "bass" }],
      },
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
        input: { key: "tb_{ownerKey}", label: "Talkback - {ownerLabel}" },
      },
    };
    const makeProject = (withPatch: boolean): Project => ({
      id: withPatch ? "p-back-note-on" : "p-back-note-off",
      bandRef: band.id,
      purpose: "event",
      documentDate: "2026-01-01",
      lineup: {
        bass: withPatch
          ? [
              {
                musicianId: "bass-1",
                presetOverride: {
                  inputs: { update: [{ key: "voc_back_bass_1", note: "Bassist brings own SM58" }] },
                },
              },
            ]
          : ["bass-1"],
        keys: withPatch
          ? [
              {
                musicianId: "keys-1",
                presetOverride: {
                  inputs: {
                    update: [
                      {
                        key: "voc_back_keys_2",
                        label: "Nickname EDITED",
                        note: "Keys brings own mic",
                      },
                    ],
                  },
                },
              },
            ]
          : ["keys-1"],
      },
      overlays: { backVocals: ["bass-1", "keys-1"] },
    });

    const buildFor = (withPatch: boolean) => {
      const project = makeProject(withPatch);
      return buildDocument(project, createRepo({ band, musicians, presets, project }));
    };

    const vmOff = buildFor(false);
    const vmOn = buildFor(true);

    expect(vmOn.inputs.find((i) => i.key === "voc_back_bass_1")?.note).toBe(
      "Bassist brings own SM58",
    );
    expect(vmOn.inputs.find((i) => i.key === "voc_back_keys_2")?.note).toBe(
      "Keys brings own mic",
    );
    // The canonical back-vocal label formatter still wins over the rename —
    // "Nickname EDITED" never reaches the printed label.
    expect(vmOn.inputs.find((i) => i.key === "voc_back_keys_2")?.label).toBe(
      vmOff.inputs.find((i) => i.key === "voc_back_keys_2")?.label,
    );
    expect(vmOn.inputs.find((i) => i.key === "voc_back_keys_2")?.label).toBe(
      "Back vocal 2 (keys)",
    );
    // The patch must not leak onto either musician's own instrument channel.
    expect(vmOn.inputs.find((i) => i.key === "el_bass_xlr_pedalboard")).toEqual(
      vmOff.inputs.find((i) => i.key === "el_bass_xlr_pedalboard"),
    );
    expect(vmOn.inputs.find((i) => i.key === "keys_mono")).toEqual(
      vmOff.inputs.find((i) => i.key === "keys_mono"),
    );
    // No-patch regression guard: every other field of every other row is
    // byte-for-byte identical between the two builds.
    const pick = (vm: ReturnType<typeof buildDocument>) =>
      vm.inputs
        .filter((i) => i.key !== "voc_back_bass_1" && i.key !== "voc_back_keys_2")
        .map((i) => ({ key: i.key, label: i.label, note: i.note }));
    expect(pick(vmOn)).toEqual(pick(vmOff));
  });

  it("does not inject a phantom channel into the back-vocal block for a bassist whose bass-connection replace patch also sings back vocals (fix round 1, Critical 2)", () => {
    // The bassist's slot carries the ordinary bass-connection `replace`
    // (the same shape the existing, working bass-setup-override test uses)
    // — nothing to do with their vocal row. Handing that whole patch to the
    // back-vocal row slice made `applyInputReplacements` `unshift` the
    // replacement into the vocal block because its `targetKey` isn't found
    // there.
    const band: Band = {
      id: "band-bass-replace-and-sing",
      name: "Band",
      bandLeader: "bass-1",
      defaultLineup: { bass: ["bass-1"] },
      defaultOverlays: { leadVocals: [], backVocals: [] },
    };
    const musicians: Record<string, Musician> = {
      "bass-1": {
        id: "bass-1",
        firstName: "Ben",
        lastName: "Bass",
        group: "bass",
        presets: [
          { kind: "preset", ref: "el_bass_xlr_pedalboard" },
          { kind: "monitor", ref: "wedge_foh" },
        ],
      },
    };
    const presets: Record<string, PresetEntity> = {
      el_bass_xlr_pedalboard: {
        type: "preset",
        id: "el_bass_xlr_pedalboard",
        label: "Electric bass guitar",
        group: "bass",
        setupGroup: "electric_bass",
        inputs: [
          { key: "el_bass_xlr_pedalboard", label: "Electric bass guitar", group: "bass" },
        ],
      },
      wedge_foh: { type: "monitor", id: "wedge_foh", label: "Wedge", kind: "wedge", supplier: "foh" },
      talkback: {
        type: "talkback_type",
        id: "talkback",
        label: "Talkback",
        group: "talkback",
        input: { key: "tb_{ownerKey}", label: "Talkback - {ownerLabel}" },
      },
    };
    const project: Project = {
      id: "p-bass-replace-and-sing",
      bandRef: band.id,
      purpose: "event",
      documentDate: "2026-01-01",
      lineup: {
        bass: [
          {
            musicianId: "bass-1",
            presetOverride: {
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
        ],
      },
      overlays: { backVocals: ["bass-1"] },
    };

    const vm = buildDocument(
      project,
      createRepo({ band, musicians, presets, project }),
    );

    // The replace lands exactly once on the bass channel...
    expect(vm.inputs.filter((i) => i.key === "el_bass_xlr_amp")).toHaveLength(1);
    expect(vm.inputs.some((i) => i.key === "el_bass_xlr_pedalboard")).toBe(false);
    // ...and the back-vocal block gets exactly its own one row, nothing
    // unshifted in from the bass patch.
    expect(vm.inputs.filter((i) => i.group === "vocs")).toHaveLength(1);
    expect(vm.inputs.some((i) => i.key === "voc_back_bass_1")).toBe(true);
    // Baseline channel count: one bass channel, one back-vocal channel.
    expect(vm.inputs).toHaveLength(2);
  });

  it("does not duplicate a channel a guitarist's inputs.add already added, when the same guitarist sings a vocal row (fix round 1, Critical 2)", () => {
    const band: Band = {
      id: "band-guitar-add-and-sing",
      name: "Band",
      bandLeader: "gtr-1",
      defaultLineup: { guitar: ["gtr-1"] },
      defaultOverlays: { leadVocals: [], backVocals: [] },
    };
    const musicians: Record<string, Musician> = {
      "gtr-1": {
        id: "gtr-1",
        firstName: "Gina",
        lastName: "Guitar",
        group: "guitar",
        presets: [
          { kind: "preset", ref: "el_guitar" },
          { kind: "monitor", ref: "wedge_foh" },
        ],
      },
    };
    const presets: Record<string, PresetEntity> = {
      el_guitar: {
        type: "preset",
        id: "el_guitar",
        label: "Electric guitar",
        group: "guitar",
        inputs: [{ key: "el_guitar", label: "Electric guitar", group: "guitar" }],
      },
      wedge_foh: { type: "monitor", id: "wedge_foh", label: "Wedge", kind: "wedge", supplier: "foh" },
      talkback: {
        type: "talkback_type",
        id: "talkback",
        label: "Talkback",
        group: "talkback",
        input: { key: "tb_{ownerKey}", label: "Talkback - {ownerLabel}" },
      },
    };
    const project: Project = {
      id: "p-guitar-add-and-sing",
      bandRef: band.id,
      purpose: "event",
      documentDate: "2026-01-01",
      lineup: {
        guitar: [
          {
            musicianId: "gtr-1",
            presetOverride: {
              inputs: {
                add: [{ key: "el_guitar_mic", label: "Guitar mic", group: "guitar" }],
              },
            },
          },
        ],
      },
      overlays: { leadVocals: ["gtr-1"] },
    };

    const vm = buildDocument(
      project,
      createRepo({ band, musicians, presets, project }),
    );

    expect(vm.inputs.filter((i) => i.key.startsWith("el_guitar_mic"))).toHaveLength(1);
    expect(vm.inputs.filter((i) => i.group === "vocs")).toHaveLength(1);
  });
});
