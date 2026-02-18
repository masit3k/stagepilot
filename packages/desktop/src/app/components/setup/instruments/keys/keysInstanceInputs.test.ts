import { describe, expect, it } from "vitest";
import { buildMonoInstanceInputs, buildStereoInstanceInputs, clampKeysCount } from "./keysInstanceInputs";

describe("keysInstanceInputs", () => {
  it("clamps count to 1-3", () => {
    expect(clampKeysCount(0)).toBe(1);
    expect(clampKeysCount(10)).toBe(3);
  });

  it("builds deterministic stereo keys", () => {
    const out = buildStereoInstanceInputs([{ key: "keys_l", label: "L" }, { key: "keys_r", label: "R" }], "keys", 2);
    expect(out.map((item) => item.key)).toEqual(["keys_1_l", "keys_1_r", "keys_2_l", "keys_2_r"]);
  });

  it("builds deterministic mono keys", () => {
    const out = buildMonoInstanceInputs({ key: "synth_mono", label: "Synth" }, "synth_mono", 3);
    expect(out.map((item) => item.key)).toEqual(["synth_mono_1", "synth_mono_2", "synth_mono_3"]);
  });
});
