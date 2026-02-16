import { describe, expect, it } from "vitest";
import type { Musician, PresetEntity } from "../../../../../../../src/domain/model/types";
import { applyBackVocsSelection, getBackVocalCandidatesFromTemplate, getBackVocsFromTemplate, getLeadVocsFromTemplate, resolveDefaultBackVocalRef, sanitizeBackVocsSelection } from "./backVocs";

const musicians: Musician[] = [
  {
    id: "m1",
    firstName: "A",
    lastName: "One",
    group: "vocs",
    presets: [{ kind: "vocal", ref: "vocal_back_no_mic", ownerKey: "vocs", ownerLabel: "vocs" }],
  },
  {
    id: "m2",
    firstName: "B",
    lastName: "Two",
    group: "guitar",
    presets: [{ kind: "vocal", ref: "vocal_back_wired", ownerKey: "guitar", ownerLabel: "guitar" }],
  },
  {
    id: "m3",
    firstName: "C",
    lastName: "Three",
    group: "keys",
    presets: [{ kind: "monitor", ref: "wedge" }],
  },
];

describe("backVocs utils", () => {
  it("detects back vocal assignments from vocal_back refs", () => {
    expect(Array.from(getBackVocsFromTemplate(musicians)).sort()).toEqual(["m1", "m2"]);
  });



  it("detects lead vocal assignments from vocal_lead refs", () => {
    const withLead: Musician[] = [
      ...musicians,
      {
        id: "m4",
        firstName: "D",
        lastName: "Four",
        group: "vocs",
        presets: [{ kind: "vocal", ref: "vocal_lead_no_mic", ownerKey: "vocs", ownerLabel: "vocs" }],
      },
    ];

    expect(Array.from(getLeadVocsFromTemplate(withLead))).toEqual(["m4"]);
  });

  it("excludes lead vocalists from back vocal candidates", () => {
    const withLead: Musician[] = [
      {
        id: "m1",
        firstName: "A",
        lastName: "One",
        group: "vocs",
        presets: [{ kind: "vocal", ref: "vocal_lead_no_mic", ownerKey: "vocs", ownerLabel: "vocs" }],
      },
      {
        id: "m2",
        firstName: "B",
        lastName: "Two",
        group: "vocs",
        presets: [{ kind: "vocal", ref: "vocal_back_no_mic", ownerKey: "vocs", ownerLabel: "vocs" }],
      },
    ];

    expect(getBackVocalCandidatesFromTemplate(withLead).map((musician) => musician.id)).toEqual(["m2"]);
  });

  it("sanitizes selected ids by removing lead vocal ids", () => {
    const selected = new Set(["m1", "m2", "m3"]);
    const lead = new Set(["m2"]);

    expect(Array.from(sanitizeBackVocsSelection(selected, lead)).sort()).toEqual(["m1", "m3"]);
  });
  it("adds default ref for newly selected and preserves existing refs", () => {
    const updated = applyBackVocsSelection(musicians, new Set(["m2", "m3"]), "vocal_back_no_mic");
    const m2 = updated.find((item) => item.id === "m2");
    const m3 = updated.find((item) => item.id === "m3");
    expect(m2?.presets.find((preset) => preset.kind === "vocal" && preset.ref.startsWith("vocal_back_"))).toEqual({ kind: "vocal", ref: "vocal_back_wired", ownerKey: "guitar", ownerLabel: "guitar" });
    expect(m3?.presets.some((preset) => preset.kind === "vocal" && preset.ref === "vocal_back_no_mic")).toBe(true);
  });

  it("removes all vocal_back refs for deselected musicians", () => {
    const updated = applyBackVocsSelection(musicians, new Set(["m3"]), "vocal_back_no_mic");
    const m1 = updated.find((item) => item.id === "m1");
    const m2 = updated.find((item) => item.id === "m2");
    expect(m1?.presets.some((preset) => preset.kind === "vocal" && preset.ref.startsWith("vocal_back_"))).toBe(false);
    expect(m2?.presets.some((preset) => preset.kind === "vocal" && preset.ref.startsWith("vocal_back_"))).toBe(false);
  });

  it("prefers vocal_back_no_mic as deterministic default", () => {
    const registry = [
      { type: "vocal_type", id: "vocal_back_wired", label: "Back vocal (wired)", group: "vocs", input: { key: "voc_back_{ownerKey}", label: "Back vocal – {ownerLabel}" } },
      { type: "vocal_type", id: "vocal_back_no_mic", label: "Back vocal (no mic)", group: "vocs", input: { key: "voc_back_{ownerKey}", label: "Back vocal – {ownerLabel}" } },
    ] as PresetEntity[];

    expect(resolveDefaultBackVocalRef(registry)).toBe("vocal_back_no_mic");
  });
});
