import { describe, expect, it } from "vitest";
import { formatStageplanBoxHeader } from "./formatStageplanBoxHeader.js";

describe("formatStageplanBoxHeader", () => {
  it("formats uppercase header with en dash", () => {
    const label = formatStageplanBoxHeader({
      instrumentLabel: "Guitar",
      firstName: "Matěj",
    });

    expect(label).toBe("GUITAR – MATĚJ");
  });

  it("falls back to question mark when name missing", () => {
    const label = formatStageplanBoxHeader({
      instrumentLabel: "Lead vocal",
    });

    expect(label).toBe("LEAD VOC – ?");
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
