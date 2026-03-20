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



  it("adds FOH source wording for wedge monitor", () => {
    expect(formatMonitoringLabel("Wedge monitor", undefined)).toBe("Wedge monitor (provided by FOH)");
  });
  it("does not append wedge text when count is not enabled", () => {
    expect(formatMonitoringLabel("IEM STEREO wireless", undefined)).toBe("IEM STEREO wireless");
    expect(formatMonitoringLabel("IEM STEREO wireless", 0)).toBe("IEM STEREO wireless");
  });
});

describe("formatMonitorOwnerLabel", () => {
  it("uses lead numbering from overlay order regardless of primary section", () => {
    expect(
      formatMonitorOwnerLabel({
        ownerRole: "keys",
        ownerMusicianId: "keys-1",
        fallbackLabel: "Keys",
        leadVocsCount: 2,
        leadVocsIndexByMusicianId: new Map([["voc-1", 1], ["keys-1", 2]]),
        genderByLeadVocsIndex: ["f", "m"],
      }),
    ).toBe("Lead vocal 2 (male)");
  });

  it("falls back to primary section label for non-lead monitor owners", () => {
    expect(
      formatMonitorOwnerLabel({
        ownerRole: "guitar",
        ownerMusicianId: "gtr-1",
        fallbackLabel: "Guitar",
        leadVocsCount: 1,
        leadVocsIndexByMusicianId: new Map([["voc-1", 1]]),
        genderByLeadVocsIndex: ["f"],
      }),
    ).toBe("Guitar");
  });
});
