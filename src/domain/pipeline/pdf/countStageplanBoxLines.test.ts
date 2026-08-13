import { describe, expect, it } from "vitest";
import { countStageplanBoxLines } from "./countStageplanBoxLines.js";

function box(args: {
  inputs?: string[];
  monitors?: string[];
  extras?: string[];
}) {
  return {
    inputBullets: args.inputs ?? [],
    monitorBullets: args.monitors ?? [],
    extraBullets: args.extras ?? [],
  };
}

describe("countStageplanBoxLines", () => {
  it("counts nothing for an empty box", () => {
    expect(countStageplanBoxLines(box({}))).toBe(0);
  });

  it("counts bullets of a single group without a separator", () => {
    expect(countStageplanBoxLines(box({ inputs: ["a", "b", "c"] }))).toBe(3);
    expect(countStageplanBoxLines(box({ monitors: ["a"] }))).toBe(1);
  });

  it("adds a separator line between two non-empty groups", () => {
    expect(
      countStageplanBoxLines(box({ inputs: ["a"], monitors: ["b"] })),
    ).toBe(3);
  });

  it("counts the drums box with all three groups", () => {
    expect(
      countStageplanBoxLines(
        box({
          inputs: ["Drums (1–8)", "PAD SFX (9+10)", "Backing track (11–12)"],
          monitors: ["IEM STEREO wired (5)"],
          extras: ["Drum riser 3x2"],
        }),
      ),
    ).toBe(7);
  });

  it("does not add a separator when only later groups are filled", () => {
    expect(
      countStageplanBoxLines(box({ monitors: ["a"], extras: ["b"] })),
    ).toBe(3);
  });
});
