import { describe, expect, it } from "vitest";
import type { Band, Musician, PresetEntity, Project } from "../model/types.js";
import { resolveEffectiveProjectSetup } from "./resolveEffectiveProjectSetup.js";

describe("resolveEffectiveProjectSetup", () => {
  it("resolves setup for members inherited from band defaultLineup", () => {
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
    const project: Project = {
      id: "p-inherited-setup",
      bandRef: "band",
      purpose: "generic",
      documentDate: "2026-01-01",
    };
    const presets: Record<string, PresetEntity> = {
      el_bass_xlr_pedalboard: {
        type: "preset",
        id: "el_bass_xlr_pedalboard",
        label: "Electric bass guitar",
        group: "bass",
        setupGroup: "electric_bass",
        inputs: [{ key: "el_bass_xlr_pedalboard", label: "Electric bass guitar", group: "bass" }],
      } as PresetEntity,
    };

    const resolved = resolveEffectiveProjectSetup({
      project,
      band,
      bandLeaderId: "bass-1",
      getMusicianById: () => musician,
      getPresetByRef: (ref) => presets[ref],
    });

    expect(resolved.lineup.bass).toEqual(["bass-1"]);
    expect(resolved.byMusicianId.get("bass-1")?.inputs).toEqual([
      { key: "el_bass_xlr_pedalboard", label: "Electric bass guitar", group: "bass" },
    ]);
  });

  it("keeps project setup override while inheriting other roles from band defaultLineup", () => {
    const band: Band = {
      id: "band",
      name: "Band",
      bandLeader: "bass-1",
      defaultLineup: { bass: ["bass-1"], guitar: ["gtr-1"] },
      defaultOverlays: { leadVocals: [], backVocals: [] },
    };
    const musicians: Record<string, Musician> = {
      "bass-1": {
        id: "bass-1",
        firstName: "Bass",
        lastName: "Player",
        group: "bass",
        presets: [
          { kind: "preset", ref: "el_bass_xlr_pedalboard" },
          { kind: "monitor", ref: "iem_stereo_wireless_foh" },
        ],
      },
      "gtr-1": {
        id: "gtr-1",
        firstName: "Guitar",
        lastName: "Player",
        group: "guitar",
        presets: [{ kind: "preset", ref: "el_guitar_mic" }],
      },
    };
    const project: Project = {
      id: "p-partial-override",
      bandRef: "band",
      purpose: "generic",
      documentDate: "2026-01-01",
      lineup: {
        bass: {
          musicianId: "bass-1",
          presetOverride: {
            monitoring: { monitorRef: "iem_stereo_wired_foh" },
          },
        },
      },
    };
    const presets: Record<string, PresetEntity> = {
      el_bass_xlr_pedalboard: {
        type: "preset",
        id: "el_bass_xlr_pedalboard",
        label: "Electric bass guitar",
        group: "bass",
        setupGroup: "electric_bass",
        inputs: [{ key: "el_bass_xlr_pedalboard", label: "Electric bass guitar", group: "bass" }],
      } as PresetEntity,
      el_guitar_mic: {
        type: "preset",
        id: "el_guitar_mic",
        label: "Electric guitar",
        group: "guitar",
        inputs: [{ key: "el_guitar_mic", label: "Electric guitar", group: "guitar" }],
      } as PresetEntity,
      iem_stereo_wireless_foh: { type: "monitor", id: "iem_stereo_wireless_foh", label: "IEM STEREO wireless", kind: "iem", supplier: "foh", mode: "stereo", wireless: true } as PresetEntity,
      iem_stereo_wired_foh: { type: "monitor", id: "iem_stereo_wired_foh", label: "IEM STEREO wired", kind: "iem", supplier: "foh", mode: "stereo", wireless: false } as PresetEntity,
    };

    const resolved = resolveEffectiveProjectSetup({
      project,
      band,
      bandLeaderId: "bass-1",
      getMusicianById: (id) => musicians[id],
      getPresetByRef: (ref) => presets[ref],
    });

    expect(resolved.lineup.bass).toEqual(["bass-1"]);
    expect(resolved.lineup.guitar).toEqual(["gtr-1"]);
    expect(resolved.byMusicianId.get("bass-1")?.monitoring.monitorRef).toBe("iem_stereo_wired_foh");
    expect(resolved.byMusicianId.get("gtr-1")?.inputs).toEqual([
      { key: "el_guitar_mic", label: "Electric guitar", group: "guitar" },
    ]);
  });

  it("resolves band default talkback owner for inherited lineup", () => {
    const band: Band = {
      id: "band",
      name: "Band",
      bandLeader: "bass-1",
      defaultLineup: { bass: ["bass-1"] },
      defaultOverlays: { leadVocals: [], backVocals: [] },
      defaultTalkbackOwnerId: "bass-1",
    };
    const musician: Musician = {
      id: "bass-1",
      firstName: "Bass",
      lastName: "Player",
      group: "bass",
      presets: [],
    };
    const project: Project = {
      id: "p-inherited-talkback",
      bandRef: "band",
      purpose: "generic",
      documentDate: "2026-01-01",
    };

    const resolved = resolveEffectiveProjectSetup({
      project,
      band,
      bandLeaderId: "bass-1",
      getMusicianById: () => musician,
      getPresetByRef: () => undefined,
    });

    expect(resolved.talkbackOwnerId).toBe("bass-1");
  });

  it("applies monitoring overrides from lineup presetOverride", () => {
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
    const project: Project = {
      id: "p1",
      bandRef: "band",
      purpose: "event",
      documentDate: "2026-01-01",
      lineup: {
        bass: {
          musicianId: "bass-1",
          presetOverride: {
            monitoring: { monitorRef: "iem_stereo_wired_foh" },
          },
        },
      },
    };

    const presets: Record<string, PresetEntity> = {
      el_bass_xlr_pedalboard: {
        type: "preset",
        id: "el_bass_xlr_pedalboard",
        label: "Electric bass guitar",
        group: "bass",
        setupGroup: "electric_bass",
        inputs: [{ key: "el_bass_xlr_pedalboard", label: "Electric bass guitar", group: "bass" }],
      } as PresetEntity,
      iem_stereo_wireless_foh: { type: "monitor", id: "iem_stereo_wireless_foh", label: "IEM STEREO wireless", kind: "iem", supplier: "foh", mode: "stereo", wireless: true } as PresetEntity,
      iem_stereo_wired_foh: { type: "monitor", id: "iem_stereo_wired_foh", label: "IEM STEREO wired", kind: "iem", supplier: "foh", mode: "stereo", wireless: false } as PresetEntity,
    };

    const resolved = resolveEffectiveProjectSetup({
      project,
      band,
      bandLeaderId: "bass-1",
      getMusicianById: () => musician,
      getPresetByRef: (ref) => presets[ref],
    });

    expect(resolved.byMusicianId.get("bass-1")?.monitoring.monitorRef).toBe("iem_stereo_wired_foh");
  });


  it("resolves drummer setup from canonical persisted drum_setup payload", () => {
    const band: Band = {
      id: "band",
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
            tracks: { enabled: false },
          },
        },
      ],
    };
    const project: Project = {
      id: "p-drum",
      bandRef: "band",
      purpose: "event",
      documentDate: "2026-01-01",
      lineup: { drums: ["dr-1"] },
    };

    const resolved = resolveEffectiveProjectSetup({
      project,
      band,
      bandLeaderId: "dr-1",
      getMusicianById: () => drummer,
      getPresetByRef: () => undefined,
    });

    expect(resolved.byMusicianId.get("dr-1")?.inputs.some((input) => input.key === "dr_pad_stereo_sfx_l")).toBe(true);
  });

  it("applies a lineup presetOverride.inputs.update patch onto drum-kit channels built from a drumDefinition", () => {
    const band: Band = {
      id: "band",
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
      presets: [],
    };
    const drumDefinition = {
      kickCount: 1 as const,
      kicks: [{ in: true, out: true }] as [{ in: boolean; out: boolean }],
      snareCount: 1 as const,
      snares: [{ top: true, bottom: true }] as [{ top: boolean; bottom: boolean }],
      hasHiHat: true,
      tomCount: 0 as const,
      floorCount: 0 as const,
      hasOverheads: false,
      pad: { enabled: false as const },
      tracks: { enabled: false },
    };
    const project: Project = {
      id: "p-drum-patch",
      bandRef: "band",
      purpose: "event",
      documentDate: "2026-01-01",
      lineup: {
        drums: {
          musicianId: "dr-1",
          drumDefinition,
          presetOverride: {
            inputs: {
              update: [
                { key: "dr_hihat", label: "Hi-hat EDITED" },
                { key: "dr_kick_1_out", note: "Custom kick note" },
              ],
            },
          },
        },
      },
    };

    const resolved = resolveEffectiveProjectSetup({
      project,
      band,
      bandLeaderId: "dr-1",
      getMusicianById: () => drummer,
      getPresetByRef: () => undefined,
    });

    const inputs = resolved.byMusicianId.get("dr-1")?.inputs ?? [];
    expect(inputs.find((input) => input.key === "dr_hihat")?.label).toBe("Hi-hat EDITED");
    expect(inputs.find((input) => input.key === "dr_kick_1_out")?.note).toBe("Custom kick note");
    // Regression guard: only the two patched channels changed, everything else
    // (including the label of the un-patched kick channel) stays exactly as
    // the unpatched resolution would produce.
    const withoutPatch = resolveEffectiveProjectSetup({
      project: {
        ...project,
        id: "p-drum-no-patch",
        lineup: { drums: { musicianId: "dr-1", drumDefinition } },
      },
      band,
      bandLeaderId: "dr-1",
      getMusicianById: () => drummer,
      getPresetByRef: () => undefined,
    }).byMusicianId.get("dr-1")?.inputs ?? [];
    const otherKeys = withoutPatch
      .filter((input) => input.key !== "dr_hihat" && input.key !== "dr_kick_1_out")
      .map((input) => input.key);
    for (const key of otherKeys) {
      expect(inputs.find((input) => input.key === key)).toEqual(
        withoutPatch.find((input) => input.key === key),
      );
    }
    expect(withoutPatch.find((input) => input.key === "dr_kick_1_out")?.note).not.toBe(
      "Custom kick note",
    );
  });

});
