import { describe, expect, it } from "vitest";
import { composeSetupModalTitle } from "./setupModalTitle";

describe("composeSetupModalTitle", () => {
  it("builds event title with distinct instrument labels", () => {
    expect(
      composeSetupModalTitle({
        templateType: "event",
        musicianName: "Holoubek Lukáš",
        instrumentLabels: ["acoustic guitar", "lead voc", "lead voc"],
      }),
    ).toBe("Setup for this event – Holoubek Lukáš (acoustic guitar, lead voc)");
  });

  it("builds generic title", () => {
    expect(
      composeSetupModalTitle({
        templateType: "generic",
        musicianName: "Piša Karel",
        instrumentLabels: ["electric guitar"],
      }),
    ).toBe("Setup – Piša Karel (electric guitar)");
  });
});
