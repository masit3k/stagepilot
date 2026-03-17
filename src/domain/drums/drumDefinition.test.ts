import { describe, expect, it } from "vitest";
import { parseDrumDefinition, parsePersistedDrumDefinition } from "./drumDefinition.js";

describe("drumDefinition persistence parsing", () => {
  it("parses canonical persisted drummer setup", () => {
    const parsed = parsePersistedDrumDefinition({
      kickCount: 1,
      kicks: [{ in: true, out: false }],
      snareCount: 1,
      snares: [{ top: true, bottom: true }],
      hasHiHat: true,
      tomCount: 1,
      floorCount: 1,
      hasOverheads: false,
      pad: { enabled: false },
      tracks: { enabled: true },
    });

    expect(parsed.tracks.enabled).toBe(true);
    expect(parsed.kicks[0].out).toBe(false);
  });

  it("throws explicit error for unsupported drum payload", () => {
    expect(() => parsePersistedDrumDefinition({ foo: "bar" }, "musician m1 preset[0]")).toThrow(
      "Invalid musician m1 preset[0]: kickCount must be one of [1, 2].",
    );
  });

  it("rejects legacy drum shape", () => {
    expect(() =>
      parsePersistedDrumDefinition(
        {
          tomCount: 2,
          floorTomCount: 1,
          hasHiHat: true,
          hasOverheads: true,
          extraSnareCount: 1,
        },
        "musician m1 preset[0]",
      ),
    ).toThrow("Invalid musician m1 preset[0]: unsupported legacy drum setup shape.");
  });

  it("parseDrumDefinition is strict canonical-only", () => {
    expect(() => parseDrumDefinition({ tomCount: 3, floorTomCount: 0, extraSnareCount: 0 })).toThrow(
      "Invalid drum definition: unsupported legacy drum setup shape.",
    );
  });
});
