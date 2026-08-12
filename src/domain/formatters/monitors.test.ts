import { describe, expect, it } from "vitest";
import { formatMonitoringLabel, formatMonitorLabel, formatMonitorOwnerLabel } from "./monitors.js";

describe("formatMonitorLabel", () => {
  it("formats monitor ordering labels consistently", () => {
    expect(formatMonitorLabel({ kind: "guitar" }, { leadCount: 2 })).toBe("Guitar");
    expect(formatMonitorLabel({ kind: "keys" }, { leadCount: 2 })).toBe("Keys");
    expect(formatMonitorLabel({ kind: "bass" }, { leadCount: 2 })).toBe("Bass");
    expect(formatMonitorLabel({ kind: "drums" }, { leadCount: 2 })).toBe("Drums");
  });

  it("formats lead monitor labels via vocal formatter", () => {
    expect(formatMonitorLabel({ kind: "lead", index: 1, gender: "f" }, { leadCount: 1 })).toBe("Lead vocal");
    expect(formatMonitorLabel({ kind: "lead", index: 2, gender: "m" }, { leadCount: 2 })).toBe("Lead vocal 2 (male)");
  });
});

describe("formatMonitoringLabel", () => {
  it("adds wedge count with number-first x suffix", () => {
    expect(formatMonitoringLabel("IEM STEREO wireless", 1)).toBe("IEM STEREO wireless + Additional wedge monitor 1x");
    expect(formatMonitoringLabel("IEM STEREO wireless", 3)).toBe("IEM STEREO wireless + Additional wedge monitor 3x");
  });



  it("does not append wedge text when count is not enabled", () => {
    expect(formatMonitoringLabel("IEM STEREO wireless", undefined)).toBe("IEM STEREO wireless");
    expect(formatMonitoringLabel("IEM STEREO wireless", 0)).toBe("IEM STEREO wireless");
  });
});

describe("formatMonitorOwnerLabel", () => {
  it("keeps instrument identity for instrumental owners with vocal overlays", () => {
    expect(
      formatMonitorOwnerLabel({
        ownerRole: "keys",
        ownerMusicianId: "keys-1",
        fallbackLabel: "Keys",
        leadVocsCount: 2,
        leadVocsIndexByMusicianId: new Map([["voc-1", 1], ["keys-1", 2]]),
        genderByLeadVocsIndex: ["f", "m"],
        backVocsCount: 0,
        backVocsIndexByMusicianId: new Map(),
        genderByBackVocsIndex: [],
      }),
    ).toBe("Keys");
  });

  it("formats lead and back overlays only for vocs primary owners", () => {
    expect(
      formatMonitorOwnerLabel({
        ownerRole: "vocs",
        ownerMusicianId: "voc-1",
        fallbackLabel: "Lead vocal",
        leadVocsCount: 2,
        leadVocsIndexByMusicianId: new Map([["voc-1", 2]]),
        genderByLeadVocsIndex: ["m", "f"],
        backVocsCount: 1,
        backVocsIndexByMusicianId: new Map([["voc-2", 1]]),
        genderByBackVocsIndex: ["m"],
      }),
    ).toBe("Lead vocal 2 (female)");

    expect(
      formatMonitorOwnerLabel({
        ownerRole: "vocs",
        ownerMusicianId: "voc-2",
        fallbackLabel: "Lead vocal",
        leadVocsCount: 0,
        leadVocsIndexByMusicianId: new Map(),
        genderByLeadVocsIndex: [],
        backVocsCount: 2,
        backVocsIndexByMusicianId: new Map([["voc-2", 1], ["voc-3", 2]]),
        genderByBackVocsIndex: ["f", "m"],
      }),
    ).toBe("Back vocal 1 (female)");
  });

  it("falls back to generic vocalist label when no overlay exists", () => {
    expect(
      formatMonitorOwnerLabel({
        ownerRole: "vocs",
        ownerMusicianId: "voc-3",
        fallbackLabel: "Lead vocal",
        leadVocsCount: 1,
        leadVocsIndexByMusicianId: new Map([["voc-1", 1]]),
        genderByLeadVocsIndex: ["f"],
        backVocsCount: 1,
        backVocsIndexByMusicianId: new Map([["voc-2", 1]]),
        genderByBackVocsIndex: ["m"],
      }),
    ).toBe("Lead vocal");
  });
});
