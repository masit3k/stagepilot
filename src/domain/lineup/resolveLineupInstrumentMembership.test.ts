import { describe, expect, it } from "vitest";
import { resolveLineupInstrumentMembership } from "./resolveLineupInstrumentMembership";

describe("resolveLineupInstrumentMembership", () => {
  it("classifies acoustic-only vocalist as AC guitar member", () => {
    const membership = resolveLineupInstrumentMembership([
      { key: "voc_lead", label: "Lead vocal" },
      { key: "ac_guitar", label: "Acoustic guitar" },
    ]);

    expect(membership.hasAcousticGuitarCapability).toBe(true);
    expect(membership.hasElectricGuitarCapability).toBe(false);
    expect(membership.isAcousticOnlyGuitarMember).toBe(true);
  });

  it("classifies acoustic-only keys player as AC guitar member", () => {
    const membership = resolveLineupInstrumentMembership([
      { key: "keys_l", label: "Keys L" },
      { key: "ac_guitar_di", label: "Acoustic guitar DI" },
    ]);

    expect(membership.hasAcousticGuitarCapability).toBe(true);
    expect(membership.hasElectricGuitarCapability).toBe(false);
    expect(membership.isAcousticOnlyGuitarMember).toBe(true);
  });

  it("classifies electric-only musician as EL guitar member", () => {
    const membership = resolveLineupInstrumentMembership([
      { key: "el_guitar_mic", label: "Electric guitar" },
    ]);

    expect(membership.isElectricGuitarMember).toBe(true);
    expect(membership.isAcousticOnlyGuitarMember).toBe(false);
  });

  it("classifies electric+acoustic musician as EL guitar member only", () => {
    const membership = resolveLineupInstrumentMembership([
      { key: "el_guitar_xlr_stereo_l", label: "Electric guitar L" },
      { key: "ac_guitar", label: "Acoustic guitar" },
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
