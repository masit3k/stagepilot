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
