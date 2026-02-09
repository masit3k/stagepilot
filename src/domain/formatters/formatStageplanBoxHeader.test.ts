import { describe, expect, it } from "vitest";
import { formatStageplanBoxHeader } from "./formatStageplanBoxHeader.js";

describe("formatStageplanBoxHeader", () => {
  it("formats uppercase header with underscore", () => {
    const label = formatStageplanBoxHeader({
      instrumentLabel: "Guitar",
      firstName: "Matěj",
    });

    expect(label).toBe("GUITAR_MATĚJ");
  });

  it("falls back to question mark when name missing", () => {
    const label = formatStageplanBoxHeader({
      instrumentLabel: "Lead vocal",
    });

    expect(label).toBe("LEAD VOCAL_?");
  });
});
