import { describe, expect, it } from "vitest";
import {
  getAcousticGuitarMembers,
  hasAcousticGuitarPreset,
  resolveInputsForCapabilitySection,
  resolveLineupInstrumentMembership,
  resolveMusicianCapabilityInputs,
  resolveMusicianInstrumentCapabilities,
  supportsCapabilitySection,
} from "./resolveLineupInstrumentMembership";

describe("resolveLineupInstrumentMembership", () => {
  it("classifies electric-only musician correctly", () => {
    const membership = resolveLineupInstrumentMembership([
      { key: "el_guitar_mic", label: "Electric guitar" },
    ]);

    expect(membership.hasElectricGuitarCapability).toBe(true);
    expect(membership.hasAcousticGuitarCapability).toBe(false);
    expect(membership.isElectricGuitarMember).toBe(true);
    expect(membership.isAcousticOnlyGuitarMember).toBe(false);
  });

  it("classifies acoustic-only musician correctly", () => {
    const membership = resolveLineupInstrumentMembership([
      { key: "ac_guitar", label: "Acoustic guitar" },
    ]);

    expect(membership.hasElectricGuitarCapability).toBe(false);
    expect(membership.hasAcousticGuitarCapability).toBe(true);
    expect(membership.isElectricGuitarMember).toBe(false);
    expect(membership.isAcousticOnlyGuitarMember).toBe(true);
  });

  it("classifies electric+acoustic musician as not acoustic-only", () => {
    const membership = resolveLineupInstrumentMembership([
      { key: "el_guitar_xlr_stereo_l", label: "Electric guitar L" },
      { key: "ac_guitar", label: "Acoustic guitar" },
    ]);

    expect(membership.hasElectricGuitarCapability).toBe(true);
    expect(membership.hasAcousticGuitarCapability).toBe(true);
    expect(membership.isElectricGuitarMember).toBe(true);
    expect(membership.isAcousticOnlyGuitarMember).toBe(false);
  });

  it("classifies non-guitar musician as no guitar member", () => {
    const membership = resolveLineupInstrumentMembership([
      { key: "voc_lead", label: "Lead vocal" },
    ]);

    expect(membership.hasAcousticGuitarCapability).toBe(false);
    expect(membership.hasElectricGuitarCapability).toBe(false);
    expect(membership.isElectricGuitarMember).toBe(false);
    expect(membership.isAcousticOnlyGuitarMember).toBe(false);
  });

  it("classifies vocs member with ac_guitar + vocal preset as acoustic-only", () => {
    const capabilities = resolveMusicianInstrumentCapabilities([
      { key: "ac_guitar", label: "Acoustic guitar" },
      { key: "vocal_lead_no_mic", label: "Lead vocal" },
    ]);

    expect(capabilities.hasAcousticGuitarCapability).toBe(true);
    expect(capabilities.hasElectricGuitarCapability).toBe(false);
  });

  it("classifies keys member with acoustic-only preset as acoustic-only", () => {
    const membership = resolveLineupInstrumentMembership([
      { key: "ac_guitar_di", label: "Acoustic guitar DI" },
      { key: "keys_l", label: "Keys L" },
    ]);

    expect(membership.isAcousticOnlyGuitarMember).toBe(true);
  });
});

describe("hasAcousticGuitarPreset", () => {
  it("returns true for ac_guitar preset", () => {
    expect(
      hasAcousticGuitarPreset([{ key: "ac_guitar", label: "Acoustic guitar" }]),
    ).toBe(true);
  });

  it("returns false when no acoustic guitar preset is present", () => {
    expect(
      hasAcousticGuitarPreset([{ key: "voc_lead", label: "Lead vocal" }]),
    ).toBe(false);
  });
});

describe("getAcousticGuitarMembers", () => {
  it("returns only acoustic-only members regardless of source role", () => {
    const members = getAcousticGuitarMembers({
      slots: [
        { role: "guitar", slotIndex: 0, musicianId: "electric-only" },
        { role: "guitar", slotIndex: 1, musicianId: "electric-and-acoustic" },
        { role: "vocs", slotIndex: 0, musicianId: "lukas-holoubek" },
        { role: "keys", slotIndex: 0, musicianId: "keys-acoustic" },
      ],
      resolveInputs: (musicianId) => {
        if (musicianId === "lukas-holoubek") {
          return [
            { key: "ac_guitar", label: "Acoustic guitar" },
            { key: "vocal_lead_no_mic", label: "Lead vocal" },
            { key: "wedge", label: "Wedge" },
          ];
        }
        if (musicianId === "keys-acoustic") {
          return [{ key: "ac_guitar_di", label: "Acoustic guitar DI" }];
        }
        if (musicianId === "electric-and-acoustic") {
          return [
            { key: "el_guitar_mic", label: "Electric guitar" },
            { key: "ac_guitar", label: "Acoustic guitar" },
          ];
        }
        return [{ key: "el_guitar_mic", label: "Electric guitar" }];
      },
    });

    expect(members.map((member) => member.musicianId)).toEqual([
      "lukas-holoubek",
      "keys-acoustic",
    ]);
  });
});

describe("resolveMusicianCapabilityInputs", () => {
  it("keeps cross-role preset inputs for capability detection", () => {
    const inputs = resolveMusicianCapabilityInputs({
      presetItems: [
        { kind: "preset", ref: "ac_guitar" },
        { kind: "preset", ref: "vocal_lead_no_mic" },
        { kind: "monitor", ref: "wedge" },
      ],
      getPresetByRef: (ref) => {
        if (ref === "ac_guitar") {
          return {
            type: "preset",
            id: "ac_guitar",
            label: "Ac Guitar",
            group: "guitar",
            inputs: [{ key: "ac_guitar", label: "Acoustic guitar" }],
          };
        }
        if (ref === "vocal_lead_no_mic") {
          return {
            type: "preset",
            id: "vocal_lead_no_mic",
            label: "Lead vocal no mic",
            group: "vocs",
            inputs: [{ key: "voc_lead", label: "Lead vocal" }],
          };
        }
        if (ref === "wedge") {
          return { type: "monitor", id: "wedge", label: "Wedge" };
        }
        return undefined;
      },
    });

    expect(inputs.map((input) => input.key)).toEqual(["ac_guitar", "voc_lead"]);
  });
});


describe("supportsCapabilitySection", () => {
  const compositeInputs = [
    { key: "ac_guitar", label: "Acoustic guitar" },
    { key: "voc_lead", label: "Lead vocal" },
    { key: "keys_l", label: "Keys L" },
  ];

  it("matches acoustic section using acoustic capability", () => {
    expect(
      supportsCapabilitySection({ section: "acoustic_guitar", inputs: compositeInputs }),
    ).toBe(true);
    expect(
      supportsCapabilitySection({ section: "acoustic_guitar", inputs: [{ key: "voc_lead", label: "Lead vocal" }] }),
    ).toBe(false);
  });

  it("matches concrete role sections by effective input keys", () => {
    expect(supportsCapabilitySection({ section: "vocs", inputs: compositeInputs })).toBe(true);
    expect(supportsCapabilitySection({ section: "keys", inputs: compositeInputs })).toBe(true);
    expect(supportsCapabilitySection({ section: "bass", inputs: compositeInputs })).toBe(false);
  });
});

describe("resolveInputsForCapabilitySection", () => {
  const effectiveInputs = [
    { key: "ac_guitar", label: "Acoustic guitar" },
    { key: "voc_lead", label: "Lead vocal" },
    { key: "ac_guitar_di", label: "Acoustic guitar DI" },
    { key: "keys_l", label: "Keys L" },
  ];

  it("returns all relevant acoustic-guitar inputs", () => {
    expect(
      resolveInputsForCapabilitySection({ section: "acoustic_guitar", inputs: effectiveInputs }).map((input) => input.key),
    ).toEqual(["ac_guitar", "ac_guitar_di"]);
  });

  it("returns only role-specific effective inputs", () => {
    expect(
      resolveInputsForCapabilitySection({ section: "vocs", inputs: effectiveInputs }).map((input) => input.key),
    ).toEqual(["voc_lead"]);
  });
});
