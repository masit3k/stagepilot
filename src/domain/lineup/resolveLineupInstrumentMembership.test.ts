import { describe, expect, it } from "vitest";
import {
  getAcousticGuitarMembers,
  hasAcousticGuitarPreset,
  resolveLineupInstrumentMembership,
} from "./resolveLineupInstrumentMembership";

describe("resolveLineupInstrumentMembership", () => {
  it("classifies electric-only musician as EL guitar member", () => {
    const membership = resolveLineupInstrumentMembership([
      { key: "el_guitar_mic", label: "Electric guitar" },
    ]);

    expect(membership.isElectricGuitarMember).toBe(true);
    expect(membership.isAcousticOnlyGuitarMember).toBe(false);
  });

  it("classifies acoustic-only musician as AC guitar member", () => {
    const membership = resolveLineupInstrumentMembership([
      { key: "ac_guitar", label: "Acoustic guitar" },
    ]);

    expect(membership.isElectricGuitarMember).toBe(false);
    expect(membership.isAcousticOnlyGuitarMember).toBe(true);
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
});

describe("hasAcousticGuitarPreset", () => {
  it("returns true for ac_guitar preset", () => {
    expect(
      hasAcousticGuitarPreset([{ key: "ac_guitar", label: "Acoustic guitar" }]),
    ).toBe(true);
  });

  it("returns true for vocalist with acoustic and vocal preset inputs", () => {
    expect(
      hasAcousticGuitarPreset([
        { key: "ac_guitar", label: "Acoustic guitar" },
        { key: "vocal_lead_no_mic", label: "Lead vocal" },
      ]),
    ).toBe(true);
  });

  it("returns false when no acoustic guitar preset is present", () => {
    expect(
      hasAcousticGuitarPreset([{ key: "voc_lead", label: "Lead vocal" }]),
    ).toBe(false);
  });

  it("returns true for electric + acoustic presets", () => {
    expect(
      hasAcousticGuitarPreset([
        { key: "el_guitar_xlr_stereo_l", label: "Electric guitar L" },
        { key: "ac_guitar", label: "Acoustic guitar" },
      ]),
    ).toBe(true);
  });
});

describe("getAcousticGuitarMembers", () => {
  it("returns all slots with acoustic guitar presets regardless of role", () => {
    const members = getAcousticGuitarMembers({
      slots: [
        { role: "guitar", slotIndex: 0, musicianId: "electric-only" },
        { role: "vocs", slotIndex: 0, musicianId: "lukas-holoubek" },
        { role: "keys", slotIndex: 0, musicianId: "keys-acoustic" },
      ],
      resolveInputs: (_role, musicianId) => {
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
        return [{ key: "el_guitar_mic", label: "Electric guitar" }];
      },
    });

    expect(members.map((member) => member.musicianId)).toEqual([
      "lukas-holoubek",
      "keys-acoustic",
    ]);
  });
});
