import { describe, expect, it } from "vitest";
import {
  resolveDistinctInstrumentLabels,
  resolveEffectiveInstrumentGroups,
} from "./effectiveInstrumentGroups";

describe("resolveEffectiveInstrumentGroups", () => {
  it("returns deterministic distinct groups for mixed setups", () => {
    const groups = resolveEffectiveInstrumentGroups([
      { key: "voc_lead", label: "Lead vocal" },
      { key: "ac_guitar", label: "Ac guitar" },
      { key: "voc_back_wireless", label: "Back vocal" },
      { key: "ac_guitar_di", label: "Ac guitar DI" },
    ]);

    expect(groups.map((item) => item.label)).toEqual([
      "acoustic guitar",
      "lead voc",
      "back voc",
    ]);
    expect(groups[0]?.inputs.map((item) => item.key)).toEqual([
      "ac_guitar",
      "ac_guitar_di",
    ]);
  });

  it("returns unique labels only", () => {
    expect(
      resolveDistinctInstrumentLabels([
        { key: "voc_lead", label: "Lead vocal" },
        { key: "voc_lead_2", label: "Lead vocal 2" },
      ]),
    ).toEqual(["lead voc"]);
  });
});

describe("resolveGroupKey fallbacks (F5d R1, copy 2)", () => {
  it("classifies a guitar-group channel outside the el_guitar prefix as electric guitar", () => {
    const groups = resolveEffectiveInstrumentGroups([
      { key: "gtr_whatever", label: "Odd guitar channel", group: "guitar" },
    ]);

    expect(groups.map((item) => item.key)).toEqual(["electric_guitar"]);
  });

  it("never routes a guitar-group channel to acoustic guitar", () => {
    // `preset.group` is "guitar" for both guitar slices, so one value cannot
    // decide between them. Acoustic stays on its single fixed key prefix.
    const groups = resolveEffectiveInstrumentGroups([
      { key: "ac_guitar", label: "Acoustic guitar", group: "guitar" },
      { key: "el_guitar_mic", label: "Electric guitar", group: "guitar" },
    ]);

    expect(groups.map((item) => item.key)).toEqual([
      "electric_guitar",
      "acoustic_guitar",
    ]);
    expect(
      groups
        .find((item) => item.key === "acoustic_guitar")
        ?.inputs.map((input) => input.key),
    ).toEqual(["ac_guitar"]);
  });

  it("classifies the bare `keys` key as keys, not as null", () => {
    // `keys_mono_xlr`/`keys_mono_jack` carry exactly one channel keyed `keys`
    // and preset channels never carry `group`, so the key is the only signal.
    const groups = resolveEffectiveInstrumentGroups([
      { key: "keys", label: "Keys" },
    ]);

    expect(groups.map((item) => item.key)).toEqual(["keys"]);
  });

  it("keeps a vocs-group channel outside the lead/back prefixes on the plain vocs slice", () => {
    // The overlay decides the vocal slot, not the key (O1) — so no fallback
    // on the lead_voc / back_voc rows.
    const groups = resolveEffectiveInstrumentGroups([
      { key: "voc_input", label: "Vocal", group: "vocs" },
    ]);

    expect(groups.map((item) => item.key)).toEqual(["vocs"]);
  });
});
