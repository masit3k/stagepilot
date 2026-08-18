import { describe, expect, it } from "vitest";
import {
  formatBackVocalPdfLabel,
  formatLeadVocalPdfLabel,
  isBackVocalLabelCanonical,
  isLeadVocalLabelCanonical,
} from "./vocalPdfLabels.js";

describe("vocalPdfLabels", () => {
  it("formats single lead as unnumbered label", () => {
    expect(
      formatLeadVocalPdfLabel({
        ownerRole: "vocs",
        ownerMusicianId: "voc-1",
        leadVocsCount: 1,
        leadVocsSlotByMusicianId: new Map([["voc-1", 1]]),
        genderByLeadVocsSlot: ["f"],
        fallbackLabel: "Lead vocal",
      }),
    ).toBe("Lead vocal");
  });

  it("formats multiple lead vocalists in vocs with slot numbering and gender", () => {
    expect(
      formatLeadVocalPdfLabel({
        ownerRole: "vocs",
        ownerMusicianId: "voc-2",
        leadVocsCount: 2,
        leadVocsSlotByMusicianId: new Map([
          ["voc-1", 1],
          ["voc-2", 2],
        ]),
        genderByLeadVocsSlot: ["m", "f"],
        fallbackLabel: "Lead vocal",
      }),
    ).toBe("Lead vocal 2 (female)");
  });

  it("formats instrumental lead vocalist with authoritative overlay slot", () => {
    expect(
      formatLeadVocalPdfLabel({
        ownerRole: "keys",
        ownerMusicianId: "keys-1",
        leadVocsCount: 4,
        leadVocsSlotByMusicianId: new Map([["voc-1", 1], ["voc-2", 2], ["keys-1", 4]]),
        genderByLeadVocsSlot: ["m", "f", undefined, "f"],
        fallbackLabel: "Lead vocal",
      }),
    ).toBe("Lead vocal 4 (keys)");
  });

  it("formats single back vocal for instrumental owner without numbering", () => {
    expect(
      formatBackVocalPdfLabel({
        ownerRole: "guitar",
        ownerMusicianId: "gtr-1",
        backVocsCount: 1,
        backVocsSlotByMusicianId: new Map([["gtr-1", 1]]),
        genderByBackVocsSlot: ["m"],
        fallbackLabel: "Back vocal",
      }),
    ).toBe("Back vocal (guitar)");
  });

  it("formats single back vocal in vocs with gender", () => {
    expect(
      formatBackVocalPdfLabel({
        ownerRole: "vocs",
        ownerMusicianId: "voc-2",
        backVocsCount: 1,
        backVocsSlotByMusicianId: new Map([["voc-2", 1]]),
        genderByBackVocsSlot: ["f"],
        fallbackLabel: "Back vocal",
      }),
    ).toBe("Back vocal (female)");
  });

  it("formats multiple back vocals with overlay-slot numbering", () => {
    expect(
      formatBackVocalPdfLabel({
        ownerRole: "drums",
        ownerMusicianId: "drm-1",
        backVocsCount: 3,
        backVocsSlotByMusicianId: new Map([
          ["voc-1", 1],
          ["gtr-1", 2],
          ["drm-1", 3],
        ]),
        genderByBackVocsSlot: ["f", "m", "m"],
        fallbackLabel: "Back vocal",
      }),
    ).toBe("Back vocal 3 (drums)");
  });

  it("keeps fallback when overlay slot is unresolved", () => {
    expect(
      formatBackVocalPdfLabel({
        ownerRole: "vocs",
        ownerMusicianId: "voc-2",
        backVocsCount: 1,
        backVocsSlotByMusicianId: new Map([["voc-1", 1]]),
        genderByBackVocsSlot: ["f"],
        fallbackLabel: "Back vocal",
      }),
    ).toBe("Back vocal");
  });
});

describe("isLeadVocalLabelCanonical / isBackVocalLabelCanonical", () => {
  it("is true whenever the owner resolves a slot", () => {
    expect(
      isLeadVocalLabelCanonical({
        ownerMusicianId: "voc-1",
        leadVocsSlotByMusicianId: new Map([["voc-1", 1]]),
      }),
    ).toBe(true);
    expect(
      isBackVocalLabelCanonical({
        ownerMusicianId: "gtr-1",
        backVocsSlotByMusicianId: new Map([["gtr-1", 1]]),
      }),
    ).toBe(true);
  });

  it("is false when ownerMusicianId is missing — matches formatLeadVocalPdfLabel's !ownerMusicianId early return", () => {
    expect(
      isLeadVocalLabelCanonical({
        ownerMusicianId: undefined,
        leadVocsSlotByMusicianId: new Map([["voc-1", 1]]),
      }),
    ).toBe(false);
  });

  it("is false when the owner has no slot — matches formatBackVocalPdfLabel's !slot early return, the exact case a rename would actually print (fix round 1, Minor 5)", () => {
    expect(
      isBackVocalLabelCanonical({
        ownerMusicianId: "voc-2",
        backVocsSlotByMusicianId: new Map([["voc-1", 1]]),
      }),
    ).toBe(false);
  });
});
