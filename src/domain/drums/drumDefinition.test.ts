import { describe, expect, it } from "vitest";
import { parseDrumDefinition, parsePersistedDrumDefinition } from "./drumDefinition.js";

describe("drumDefinition persistence parsing", () => {
  it("converts legacy persisted drummer setup to canonical drum definition", () => {
    const parsed = parsePersistedDrumDefinition({
      tomCount: 2,
      floorTomCount: 1,
      hasHiHat: true,
      hasOverheads: true,
      extraSnareCount: 1,
      pad: {
        enabled: true,
        mode: "sfx",
        channels: "stereo",
      },
    });

    expect(parsed.kickCount).toBe(1);
    expect(parsed.kicks[0]).toEqual({ in: true, out: true });
    expect(parsed.snareCount).toBe(2);
    expect(parsed.snares[0]).toEqual({ top: true, bottom: true });
    expect(parsed.snares[1]).toEqual({ top: true, bottom: false });
    expect(parsed.floorCount).toBe(1);
    expect(parsed.pad).toEqual({ enabled: true, mode: "sfx", channels: "stereo" });
    expect(parsed.tracks.enabled).toBe(false);
  });

  it("keeps canonical persisted shape valid", () => {
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
      "Invalid musician m1 preset[0]: unsupported shape.",
    );
  });

  it("parseDrumDefinition still accepts legacy shape for compatibility", () => {
    const parsed = parseDrumDefinition({
      tomCount: 3,
      floorTomCount: 0,
      extraSnareCount: 0,
    });
    expect(parsed.tomCount).toBe(3);
    expect(parsed.floorCount).toBe(0);
    expect(parsed.snareCount).toBe(1);
  });
});
