import { describe, expect, it } from "vitest";
import { formatMonitoringLabel, formatMonitorLabel } from "./monitors.js";

describe("formatMonitorLabel", () => {
  it("formats monitor ordering labels consistently", () => {
    expect(formatMonitorLabel({ kind: "guitar" }, { leadCount: 2 })).toBe("Guitar");
    expect(formatMonitorLabel({ kind: "keys" }, { leadCount: 2 })).toBe("Keys");
    expect(formatMonitorLabel({ kind: "bass" }, { leadCount: 2 })).toBe("Bass");
    expect(formatMonitorLabel({ kind: "drums" }, { leadCount: 2 })).toBe("Drums");
  });

  it("formats lead monitor labels via vocal formatter", () => {
    expect(formatMonitorLabel({ kind: "lead", index: 1, gender: "f" }, { leadCount: 1 })).toBe("Lead vocal");
    expect(formatMonitorLabel({ kind: "lead", index: 2, gender: "m" }, { leadCount: 2 })).toBe("Lead vocal 2 (m)");
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
