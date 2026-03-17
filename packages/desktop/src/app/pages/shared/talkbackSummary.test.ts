import { describe, expect, it } from "vitest";
import { resolveTalkbackSummaryLabel } from "./talkbackSummary";

describe("resolveTalkbackSummaryLabel", () => {
  it("returns owner name when present", () => {
    expect(resolveTalkbackSummaryLabel("Drummer")).toBe("Drummer");
  });

  it("returns Not selected when owner is empty", () => {
    expect(resolveTalkbackSummaryLabel("")).toBe("Not selected");
    expect(resolveTalkbackSummaryLabel(undefined)).toBe("Not selected");
  });
});
