import { describe, expect, it } from "vitest";
import {
  buildVisibleLineupSections,
  resolveMusicianDefaultInputsFromPresets,
  resolveMusicianDefaultSetupForRole,
} from "./setupConstants";

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
  const catalog = {
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
    iem_stereo_wireless: {
      type: "monitor",
      id: "iem_stereo_wireless",
      label: "IEM stereo wireless",
    },
  } as const;

  it("resolves guitar defaults from musician presets", () => {
    const resolved = resolveMusicianDefaultSetupForRole({
      role: "guitar",
      presetItems: [{ kind: "preset", ref: "el_guitar_xlr_stereo" }],
      presetCatalog: catalog,
      bandDefaults: {
        inputs: [{ key: "gtr_mic", label: "Guitar mic" }],
        monitoring: { monitorRef: "wedge" },
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
        monitoring: { monitorRef: "wedge" },
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
        monitoring: { monitorRef: "wedge" },
      },
    });

    expect(resolved.inputs.map((item) => item.key)).toContain("voc_input");
  });

  it("prefers explicit monitoring override defaults and falls back when no preset refs exist", () => {
    const resolved = resolveMusicianDefaultSetupForRole({
      role: "guitar",
      musicianDefaults: { monitoring: { monitorRef: "iem_stereo_wireless" } },
      presetCatalog: catalog,
      bandDefaults: {
        inputs: [{ key: "gtr_mic", label: "Guitar mic" }],
        monitoring: { monitorRef: "wedge" },
      },
    });

    expect(resolved.monitoring.monitorRef).toBe("iem_stereo_wireless");
    expect(resolved.inputs.map((item) => item.key)).toEqual(["gtr_mic"]);
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
