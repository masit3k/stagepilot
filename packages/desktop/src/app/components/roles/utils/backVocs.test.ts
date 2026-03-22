import { describe, expect, it } from "vitest";
import type { Musician, PresetEntity } from "../../../../../../../src/domain/model/types";
import {
  applyBackVocsSelection,
  detectBackVocalPresetKind,
  filterBackVocalCandidates,
  getBackVocalCandidatesFromTemplate,
  getBackVocsFromTemplate,
  getLeadVocsFromTemplate,
  getTalkbackOwnersFromTemplate,
  isBackVocalPreset,
  resolveDefaultBackVocalRef,
  sanitizeBackVocsSelection,
} from "./backVocs";

const musicians: Musician[] = [
  { id: "m1", firstName: "A", lastName: "One", group: "vocs", presets: [{ kind: "preset", ref: "vocal_no_mic" }] },
  { id: "m2", firstName: "B", lastName: "Two", group: "guitar", presets: [{ kind: "preset", ref: "vocal_wired" }] },
  { id: "m3", firstName: "C", lastName: "Three", group: "bass", presets: [{ kind: "preset", ref: "el_bass_xlr_amp" }] },
];

describe("backVocs utils", () => {
  it("detects vocal capability from generic vocal presets", () => {
    expect(Array.from(getBackVocsFromTemplate(musicians)).sort()).toEqual(["m1", "m2"]);
    expect(Array.from(getLeadVocsFromTemplate(musicians)).sort()).toEqual(["m1", "m2"]);
  });

  it("detects talkback owners", () => {
    const withTalkback: Musician[] = [
      ...musicians,
      { id: "m4", firstName: "D", lastName: "Four", group: "keys", presets: [{ kind: "talkback", ref: "talkback", ownerKey: "keys", ownerLabel: "Keys" }] },
    ];
    expect(Array.from(getTalkbackOwnersFromTemplate(withTalkback))).toContain("m4");
  });

  it("filters candidates and selections", () => {
    expect(filterBackVocalCandidates({ lineupCandidates: [{ id: "m1" }, { id: "m2" }], selectedLeadVocalistIds: ["m1"] })).toEqual(["m2"]);
    expect(Array.from(sanitizeBackVocsSelection(new Set(["m1", "m2"]), new Set(["m2"])))).toEqual(["m1"]);
  });

  it("applies back vocal selection using generic preset refs", () => {
    const updated = applyBackVocsSelection(musicians, new Set(["m3"]), "vocal_no_mic");
    const m3 = updated.find((m) => m.id === "m3");
    expect(m3?.presets.some((preset) => preset.kind === "preset" && preset.ref === "vocal_no_mic")).toBe(true);
  });

  it("resolves deterministic default ref", () => {
    const registry: PresetEntity[] = [
      { type: "preset", id: "vocal_wired", label: "Wired", group: "vocs", inputs: [{ key: "voc_input", label: "Vocal" }] },
      { type: "preset", id: "vocal_no_mic", label: "No mic", group: "vocs", inputs: [{ key: "voc_input", label: "Vocal" }] },
    ];
    expect(resolveDefaultBackVocalRef(registry)).toBe("vocal_no_mic");
  });

  it("marks back vocal preset shape", () => {
    expect(isBackVocalPreset({ kind: "preset", ref: "vocal_wireless" })).toBe(true);
    expect(isBackVocalPreset({ kind: "preset", ref: "el_bass_xlr_amp" })).toBe(false);
    expect(detectBackVocalPresetKind(musicians)).toBe("preset");
    expect(getBackVocalCandidatesFromTemplate(musicians).map((m) => m.id)).toEqual(["m3"]);
  });
});
