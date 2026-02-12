import { describe, expect, it } from "vitest";
import { formatMonitorBullet, formatStageplanBoxHeader } from "./stageplan.js";

describe("formatStageplanBoxHeader", () => {
  it("formats uppercase header with en dash", () => {
    const label = formatStageplanBoxHeader({
      instrumentLabel: "Guitar",
      firstName: "Matěj",
    });

    expect(label).toBe("GUITAR – MATĚJ");
  });

  it("omits name when missing", () => {
    const label = formatStageplanBoxHeader({
      instrumentLabel: "Lead vocal",
    });

    expect(label).toBe("LEAD VOC");
  });

  it("adds band leader suffix when requested", () => {
    const label = formatStageplanBoxHeader({
      instrumentLabel: "Bass",
      firstName: "Matěj",
      isBandLeader: true,
    });

    expect(label).toBe("BASS – MATĚJ (band leader)");
  });
});


describe("formatMonitorBullet", () => {
  it("formats monitor note with output number", () => {
    expect(formatMonitorBullet("IEM A", 3)).toBe("IEM A (3)");
  });

  it("falls back to number when note is empty", () => {
    expect(formatMonitorBullet("", 4)).toBe("(4)");
  });
});
