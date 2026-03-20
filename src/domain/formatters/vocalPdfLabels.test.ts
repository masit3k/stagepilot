import { describe, expect, it } from "vitest";
import { formatBackVocalPdfLabel, formatLeadVocalPdfLabel } from "./vocalPdfLabels.js";

describe("vocalPdfLabels", () => {
  it("formats back vocal labels with owner instrument in parentheses", () => {
    expect(formatBackVocalPdfLabel("guitar")).toBe("Back vocal (guitar)");
    expect(formatBackVocalPdfLabel("keys")).toBe("Back vocal (keys)");
  });

  it("formats single lead vocalist in vocs without numbering", () => {
    expect(
      formatLeadVocalPdfLabel({
        ownerRole: "vocs",
        ownerMusicianId: "voc-1",
        leadVocsCount: 1,
        leadVocsIndexByMusicianId: new Map([["voc-1", 1]]),
        genderByLeadVocsIndex: ["f"],
        fallbackLabel: "Lead vocal",
      }),
    ).toBe("Lead vocal");
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
    ).toBe("Lead vocal 2 (female)");
  });

  it("keeps fallback label when vocs owner is not among resolved vocs lead vocalists", () => {
    expect(
      formatLeadVocalPdfLabel({
        ownerRole: "vocs",
        ownerMusicianId: "voc-2",
        leadVocsCount: 1,
        leadVocsIndexByMusicianId: new Map([["voc-1", 1]]),
        genderByLeadVocsIndex: ["f"],
        fallbackLabel: "Lead vocal",
      }),
    ).toBe("Lead vocal");
  });
});
