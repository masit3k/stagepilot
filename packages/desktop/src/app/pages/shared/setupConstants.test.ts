import { describe, expect, it } from "vitest";
import {
  buildVisibleLineupSections,
  getGroupDefaultPreset,
  resolveMusicianDefaultInputsFromPresets,
  resolveMusicianDefaultSetupForRole,
} from "./setupConstants";
import type { PresetEntity } from "../../../../../../src/domain/model/types";

describe("resolveMusicianDefaultInputsFromPresets", () => {
  it("resolves bass default input from musician preset ref", () => {
    const inputs = resolveMusicianDefaultInputsFromPresets(
      "bass",
      [{ kind: "preset", ref: "el_bass_xlr_pedalboard" }],
      {
        el_bass_xlr_pedalboard: {
          id: "el_bass_xlr_pedalboard",
          type: "preset",
          group: "bass",
          label: "Bass",
          inputs: [{ key: "el_bass_xlr_pedalboard", label: "Bass" }],
        } as never,
      },
    );
    expect(inputs?.map((item) => item.key)).toEqual(["el_bass_xlr_pedalboard"]);
  });
});

describe("resolveMusicianDefaultSetupForRole", () => {
  const catalog: Record<string, PresetEntity> = {
    el_guitar_xlr_stereo: {
      type: "preset",
      id: "el_guitar_xlr_stereo",
      label: "XLR stereo",
      group: "guitar",
      inputs: [
        { key: "el_guitar_xlr_stereo_l", label: "Guitar L" },
        { key: "el_guitar_xlr_stereo_r", label: "Guitar R" },
      ],
    },
    el_bass_xlr_pedalboard: {
      type: "preset",
      id: "el_bass_xlr_pedalboard",
      label: "Bass pedalboard",
      group: "bass",
      setupGroup: "electric_bass",
      inputs: [{ key: "el_bass_xlr_pedalboard", label: "Bass" }],
    },
    vocal_wireless: {
      type: "preset",
      id: "vocal_wireless",
      label: "Wireless lead vocal",
      group: "vocs",
      inputs: [{ key: "voc_input", label: "Vocal" }],
    },
    iem_stereo_wireless_foh: {
      type: "monitor",
      id: "iem_stereo_wireless_foh",
      label: "IEM stereo wireless",
      kind: "iem",
      supplier: "foh",
      mode: "stereo",
      wireless: true,
    },
    wedge_foh: {
      type: "monitor",
      id: "wedge_foh",
      label: "Wedge monitor (provided by FOH)",
      kind: "wedge",
      supplier: "foh",
    },
  };

  it("resolves guitar defaults from musician presets", () => {
    const resolved = resolveMusicianDefaultSetupForRole({
      role: "guitar",
      presetItems: [{ kind: "preset", ref: "el_guitar_xlr_stereo" }],
      presetCatalog: catalog,
      bandDefaults: {
        inputs: [{ key: "gtr_mic", label: "Guitar mic" }],
        monitoring: { monitorRef: "wedge_foh" },
      },
    });

    expect(resolved.inputs.map((item) => item.key)).toEqual([
      "el_guitar_xlr_stereo_l",
      "el_guitar_xlr_stereo_r",
    ]);
  });

  it("resolves bass defaults from musician presets", () => {
    const resolved = resolveMusicianDefaultSetupForRole({
      role: "bass",
      presetItems: [{ kind: "preset", ref: "el_bass_xlr_pedalboard" }],
      presetCatalog: catalog,
      bandDefaults: {
        inputs: [{ key: "el_bass_xlr_amp", label: "Amp" }],
        monitoring: { monitorRef: "wedge_foh" },
      },
    });

    expect(resolved.inputs.map((item) => item.key)).toEqual([
      "el_bass_xlr_pedalboard",
    ]);
  });

  it("resolves vocal defaults from musician presets", () => {
    const resolved = resolveMusicianDefaultSetupForRole({
      role: "vocs",
      presetItems: [{ kind: "preset", ref: "vocal_wireless" }],
      presetCatalog: catalog,
      bandDefaults: {
        inputs: [{ key: "voc_input", label: "Vocal" }],
        monitoring: { monitorRef: "wedge_foh" },
      },
    });

    expect(resolved.inputs.map((item) => item.key)).toContain("voc_input");
  });

  it("prefers explicit monitoring override defaults and falls back when no preset refs exist", () => {
    const resolved = resolveMusicianDefaultSetupForRole({
      role: "guitar",
      musicianDefaults: { monitoring: { monitorRef: "iem_stereo_wireless_foh" } },
      presetCatalog: catalog,
      bandDefaults: {
        inputs: [{ key: "gtr_mic", label: "Guitar mic" }],
        monitoring: { monitorRef: "wedge_foh" },
      },
    });

    expect(resolved.monitoring.monitorRef).toBe("iem_stereo_wireless_foh");
    expect(resolved.inputs.map((item) => item.key)).toEqual(["gtr_mic"]);
  });

  it("resolves a legacy monitor ref from a musician preset item through the alias map instead of throwing", () => {
    // The catalog only has the new "_foh"/"_own" ids (the legacy monitor JSON files were
    // deleted). A musician whose stored preset still references the old "wedge" id must
    // not crash the setup editor when its default setup is resolved.
    expect(() =>
      resolveMusicianDefaultSetupForRole({
        role: "vocs",
        presetItems: [{ kind: "monitor", ref: "wedge" }],
        presetCatalog: catalog,
        bandDefaults: {
          inputs: [{ key: "voc_input", label: "Vocal" }],
          monitoring: { monitorRef: "wedge_foh" },
        },
      }),
    ).not.toThrow();

    const resolved = resolveMusicianDefaultSetupForRole({
      role: "vocs",
      presetItems: [{ kind: "monitor", ref: "wedge" }],
      presetCatalog: catalog,
      bandDefaults: {
        inputs: [{ key: "voc_input", label: "Vocal" }],
        monitoring: { monitorRef: "wedge_foh" },
      },
    });
    expect(resolved.monitoring.monitorRef).toBe("wedge");
  });
});

describe("buildVisibleLineupSections", () => {
  it("does not show AC. GUITAR without acoustic member", () => {
    const sections = buildVisibleLineupSections({
      roleOrder: ["drums", "bass", "guitar", "keys", "vocs"],
      resolveRoleSlots: (role) =>
        role === "guitar"
          ? [{ musicianId: "electric-player" }]
          : role === "vocs"
            ? [{ musicianId: "lead-vocal" }]
            : [{ musicianId: undefined }],
      resolveMusicianDefaultInputs: (musicianId) =>
        musicianId === "electric-player"
          ? [{ key: "el_guitar_mic", label: "Electric guitar" }]
          : [{ key: "voc_lead", label: "Lead vocal" }],
    });

    expect(sections.some((section) => section.kind === "acoustic_guitar")).toBe(
      false,
    );
  });

  it("shows AC. GUITAR when acoustic member exists and places it after EL. GUITAR", () => {
    const sections = buildVisibleLineupSections({
      roleOrder: ["drums", "bass", "guitar", "keys", "vocs"],
      resolveRoleSlots: (role) =>
        role === "vocs"
          ? [{ musicianId: "lukas-holoubek" }]
          : [{ musicianId: undefined }],
      resolveMusicianDefaultInputs: (musicianId) =>
        musicianId === "lukas-holoubek"
          ? [
              { key: "ac_guitar", label: "Acoustic guitar" },
              { key: "vocal_no_mic", label: "Vocal no mic" },
              { key: "wedge", label: "Wedge" },
            ]
          : [],
    });

    const guitarIndex = sections.findIndex(
      (section) => section.kind === "role" && section.role === "guitar",
    );
    const acousticIndex = sections.findIndex(
      (section) => section.kind === "acoustic_guitar",
    );

    expect(acousticIndex).toBe(guitarIndex + 1);
    const acousticSection = sections.find(
      (section) => section.kind === "acoustic_guitar",
    );
    expect(acousticSection?.kind).toBe("acoustic_guitar");
    if (acousticSection?.kind === "acoustic_guitar") {
      expect(
        acousticSection.members.map((member) => member.musicianId),
      ).toEqual(["lukas-holoubek"]);
    }
  });

  it("shows AC. GUITAR for any acoustic member outside guitar role", () => {
    const sections = buildVisibleLineupSections({
      roleOrder: ["drums", "bass", "guitar", "keys", "vocs"],
      resolveRoleSlots: (role) =>
        role === "keys"
          ? [{ musicianId: "keys-acoustic" }]
          : role === "vocs"
            ? [{ musicianId: "vocal-acoustic" }]
            : [{ musicianId: undefined }],
      resolveMusicianDefaultInputs: (musicianId) =>
        musicianId === "keys-acoustic" || musicianId === "vocal-acoustic"
          ? [{ key: "ac_guitar", label: "Acoustic guitar" }]
          : [],
    });

    const acousticSection = sections.find(
      (section) => section.kind === "acoustic_guitar",
    );
    expect(acousticSection?.kind).toBe("acoustic_guitar");
    if (acousticSection?.kind === "acoustic_guitar") {
      expect(
        acousticSection.members.map((member) => member.musicianId),
      ).toEqual(["keys-acoustic", "vocal-acoustic"]);
    }
  });

  it("does not include electric+acoustic-only lineup in AC. GUITAR section", () => {
    const sections = buildVisibleLineupSections({
      roleOrder: ["drums", "bass", "guitar", "keys", "vocs"],
      resolveRoleSlots: (role) =>
        role === "guitar"
          ? [{ musicianId: "electric-and-acoustic" }]
          : [{ musicianId: undefined }],
      resolveMusicianDefaultInputs: (musicianId) =>
        musicianId === "electric-and-acoustic"
          ? [
              { key: "el_guitar_xlr_stereo_l", label: "Electric guitar L" },
              { key: "ac_guitar", label: "Acoustic guitar" },
            ]
          : [],
    });

    expect(sections.some((section) => section.kind === "acoustic_guitar")).toBe(false);
  });


  it("shows AC. GUITAR when lineup has acoustic-only member plus electric guitarist", () => {
    const sections = buildVisibleLineupSections({
      roleOrder: ["drums", "bass", "guitar", "keys", "vocs"],
      resolveRoleSlots: (role) =>
        role === "guitar"
          ? [{ musicianId: "electric-player" }]
          : role === "vocs"
            ? [{ musicianId: "acoustic-vocal" }]
            : [{ musicianId: undefined }],
      resolveMusicianDefaultInputs: (musicianId) =>
        musicianId === "electric-player"
          ? [{ key: "el_guitar_mic", label: "Electric guitar" }]
          : musicianId === "acoustic-vocal"
            ? [
                { key: "ac_guitar", label: "Acoustic guitar" },
                { key: "voc_lead", label: "Lead vocal" },
              ]
            : [],
    });

    const acousticSection = sections.find(
      (section) => section.kind === "acoustic_guitar",
    );
    expect(acousticSection?.kind).toBe("acoustic_guitar");
    if (acousticSection?.kind === "acoustic_guitar") {
      expect(acousticSection.members.map((member) => member.musicianId)).toEqual([
        "acoustic-vocal",
      ]);
      expect(acousticSection.members[0]).toMatchObject({
        sourceRole: "vocs",
        sourceSlotIndex: 0,
      });
    }
  });

  it("hides AC. GUITAR after member change away from acoustic", () => {
    const roleSlotsByRole: Record<string, Array<{ musicianId?: string }>> = {
      drums: [{ musicianId: undefined }],
      bass: [{ musicianId: undefined }],
      guitar: [{ musicianId: undefined }],
      keys: [{ musicianId: undefined }],
      vocs: [{ musicianId: "lukas-holoubek" }],
    };

    const resolveSections = () =>
      buildVisibleLineupSections({
        roleOrder: ["drums", "bass", "guitar", "keys", "vocs"],
        resolveRoleSlots: (role) =>
          roleSlotsByRole[role] ?? [{ musicianId: undefined }],
        resolveMusicianDefaultInputs: (musicianId) =>
          musicianId === "lukas-holoubek"
            ? [{ key: "ac_guitar", label: "Acoustic guitar" }]
            : [{ key: "voc_lead", label: "Lead vocal" }],
      });

    expect(
      resolveSections().some((section) => section.kind === "acoustic_guitar"),
    ).toBe(true);

    roleSlotsByRole.vocs = [{ musicianId: "different-vocal" }];

    expect(
      resolveSections().some((section) => section.kind === "acoustic_guitar"),
    ).toBe(false);
  });

  it("places AC. GUITAR in consistent order when EL. GUITAR role section is missing", () => {
    const sections = buildVisibleLineupSections({
      roleOrder: ["drums", "bass", "keys", "vocs"],
      resolveRoleSlots: (role) =>
        role === "vocs"
          ? [{ musicianId: "lukas-holoubek" }]
          : [{ musicianId: undefined }],
      resolveMusicianDefaultInputs: (musicianId) =>
        musicianId === "lukas-holoubek"
          ? [{ key: "ac_guitar", label: "Acoustic guitar" }]
          : [],
    });

    expect(
      sections.map((section) =>
        section.kind === "role" ? section.role : section.kind,
      ),
    ).toEqual(["drums", "bass", "keys", "vocs", "acoustic_guitar"]);
  });
  it("returns AC. GUITAR visibility based on default lineup source during reset", () => {
    const defaultSections = buildVisibleLineupSections({
      roleOrder: ["drums", "bass", "guitar", "keys", "vocs"],
      resolveRoleSlots: (role) =>
        role === "vocs"
          ? [{ musicianId: "lukas-holoubek" }]
          : [{ musicianId: undefined }],
      resolveMusicianDefaultInputs: (musicianId) =>
        musicianId === "lukas-holoubek"
          ? [{ key: "ac_guitar", label: "Acoustic guitar" }]
          : [],
    });

    expect(
      defaultSections.some((section) => section.kind === "acoustic_guitar"),
    ).toBe(true);
  });
});

describe("getGroupDefaultPreset (F5d R1)", () => {
  const catalog: Record<string, PresetEntity> = {
    el_bass_xlr_amp: {
      type: "preset",
      id: "el_bass_xlr_amp",
      label: "Electric bass guitar",
      group: "bass",
      inputs: [
        {
          key: "el_bass_xlr_amp",
          label: "Electric bass guitar",
          note: "XLR out from amp",
        },
      ],
    },
    el_guitar_mic: {
      type: "preset",
      id: "el_guitar_mic",
      label: "Electric guitar (mic)",
      group: "guitar",
      inputs: [{ key: "el_guitar_mic", label: "Electric guitar" }],
    },
    keys_stereo_xlr: {
      type: "preset",
      id: "keys_stereo_xlr",
      label: "Keys stereo XLR",
      group: "keys",
      inputs: [
        { key: "keys_l", label: "Keys L", channel: "L" },
        { key: "keys_r", label: "Keys R", channel: "R" },
      ],
    },
    vocal_wireless: {
      type: "preset",
      id: "vocal_wireless",
      label: "Vocal (wireless)",
      group: "vocs",
      inputs: [{ key: "voc_input", label: "Vocal" }],
    },
  };

  it("takes the first ref of the role, not the union of all of them", () => {
    // Union would hand a guitarist with no preset a mic, a DI, a stereo pair
    // and an acoustic all at once, and would merge mutually exclusive bass
    // presets that `selectBassMainPreset` exists to keep apart.
    expect(
      getGroupDefaultPreset("bass", catalog).inputs.map((i) => i.key),
    ).toEqual(["el_bass_xlr_amp"]);
    expect(
      getGroupDefaultPreset("guitar", catalog).inputs.map((i) => i.key),
    ).toEqual(["el_guitar_mic"]);
    expect(
      getGroupDefaultPreset("keys", catalog).inputs.map((i) => i.key),
    ).toEqual(["keys_l", "keys_r"]);
    expect(
      getGroupDefaultPreset("vocs", catalog).inputs.map((i) => i.key),
    ).toEqual(["voc_input"]);
  });

  it("stamps the preset's group onto every derived channel", () => {
    // Preset channels never carry `group` themselves; without this the
    // derived channel falls into the M2 trap on both prefix copies.
    expect(
      getGroupDefaultPreset("guitar", catalog).inputs.every(
        (i) => i.group === "guitar",
      ),
    ).toBe(true);
    expect(
      getGroupDefaultPreset("keys", catalog).inputs.every(
        (i) => i.group === "keys",
      ),
    ).toBe(true);
  });

  it("keeps the default drum kit for drums", () => {
    const inputs = getGroupDefaultPreset("drums", catalog).inputs;

    expect(inputs.length).toBeGreaterThan(0);
    expect(inputs.every((input) => input.key.startsWith("dr_"))).toBe(true);
  });

  it("returns no inputs for talkback", () => {
    // The talkback preset is a `talkback_type` template keyed
    // `tb_{ownerKey}`, has no `PRESET_REFS` entry and no lineup slot; the row
    // is built by `buildPdfTalkback` from overlays.
    expect(getGroupDefaultPreset("talkback", catalog).inputs).toEqual([]);
  });

  it("returns no inputs when the catalog is empty", () => {
    expect(getGroupDefaultPreset("guitar", {}).inputs).toEqual([]);
    expect(getGroupDefaultPreset("bass").inputs).toEqual([]);
  });

  it("keeps wedge_foh as the fallback monitor for every role", () => {
    for (const role of [
      "drums",
      "bass",
      "guitar",
      "keys",
      "vocs",
      "talkback",
    ] as const) {
      expect(getGroupDefaultPreset(role, catalog).monitoring.monitorRef).toBe(
        "wedge_foh",
      );
    }
  });
});
