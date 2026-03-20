import { describe, expect, it } from "vitest";
import { formatBackVocalPdfLabel, formatLeadVocalPdfLabel } from "./vocalPdfLabels.js";

describe("vocalPdfLabels", () => {
  it("formats lead vocalist in vocs with deterministic index and gender", () => {
    expect(
      formatLeadVocalPdfLabel({
        ownerRole: "vocs",
        ownerMusicianId: "voc-1",
        leadVocsCount: 1,
        leadVocsIndexByMusicianId: new Map([["voc-1", 1]]),
        genderByLeadVocsIndex: ["f"],
        fallbackLabel: "Lead vocal",
      }),
    ).toBe("Lead vocal 1 (female)");
  });

  it("formats multiple lead vocalists in vocs with numbering and gender", () => {
    expect(
      formatLeadVocalPdfLabel({
        ownerRole: "vocs",
        ownerMusicianId: "voc-2",
        leadVocsCount: 2,
        leadVocsIndexByMusicianId: new Map([
          ["voc-1", 1],
          ["voc-2", 2],
        ]),
        genderByLeadVocsIndex: ["m", "f"],
        fallbackLabel: "Lead vocal",
      }),
    ).toBe("Lead vocal 2 (female)");
  });

  it("formats non-vocs lead vocalist with overlay numbering when assigned", () => {
    expect(
      formatLeadVocalPdfLabel({
        ownerRole: "keys",
        ownerMusicianId: "keys-1",
        leadVocsCount: 2,
        leadVocsIndexByMusicianId: new Map([["voc-1", 1], ["keys-1", 2]]),
        genderByLeadVocsIndex: ["m", "f"],
        fallbackLabel: "Lead vocal",
      }),
    ).toBe("Lead vocal 2 (keys)");
  });

  it("formats back vocal labels with deterministic index and owner-derived suffix", () => {
    expect(
      formatBackVocalPdfLabel({
        ownerRole: "guitar",
        ownerMusicianId: "gtr-1",
        backVocsCount: 2,
        backVocsIndexByMusicianId: new Map([
          ["voc-1", 1],
          ["gtr-1", 2],
        ]),
        genderByBackVocsIndex: ["f", "m"],
        fallbackLabel: "Back vocal",
      }),
    ).toBe("Back vocal 2 (guitar)");
  });

  it("formats back vocalist in vocs with index and gender", () => {
    expect(
      formatBackVocalPdfLabel({
        ownerRole: "vocs",
        ownerMusicianId: "voc-2",
        backVocsCount: 2,
        backVocsIndexByMusicianId: new Map([
          ["voc-1", 1],
          ["voc-2", 2],
        ]),
        genderByBackVocsIndex: ["m", "f"],
        fallbackLabel: "Back vocal",
      }),
    ).toBe("Back vocal 2 (female)");
  });

  it("keeps fallback when overlay index is unresolved", () => {
    expect(
      formatBackVocalPdfLabel({
        ownerRole: "vocs",
        ownerMusicianId: "voc-2",
        backVocsCount: 1,
        backVocsIndexByMusicianId: new Map([["voc-1", 1]]),
        genderByBackVocsIndex: ["f"],
        fallbackLabel: "Back vocal",
      }),
    ).toBe("Back vocal");
  });
});
