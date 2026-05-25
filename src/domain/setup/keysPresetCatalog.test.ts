import { describe, expect, it } from "vitest";
import keysMonoJack from "../../../data/assets/presets/groups/keys/keys_mono_jack.json";
import keysMonoXlr from "../../../data/assets/presets/groups/keys/keys_mono_xlr.json";
import keysStereoJack from "../../../data/assets/presets/groups/keys/keys_stereo_jack.json";
import keysStereoXlr from "../../../data/assets/presets/groups/keys/keys_stereo_xlr.json";

describe("keys preset catalog", () => {
  it("defines only the supported keys variants with expected notes", () => {
    const presets = [keysStereoXlr, keysMonoXlr, keysStereoJack, keysMonoJack];
    expect(presets.map((preset) => preset.id).sort()).toEqual([
      "keys_mono_jack",
      "keys_mono_xlr",
      "keys_stereo_jack",
      "keys_stereo_xlr",
    ]);
    expect(
      keysStereoXlr.inputs.every((input) => input.note === "XLR out from rack"),
    ).toBe(true);
    expect(
      keysMonoXlr.inputs.every((input) => input.note === "XLR out from rack"),
    ).toBe(true);
    expect(
      keysStereoJack.inputs.every(
        (input) => input.note === "TS jack 6.3mm – DI box",
      ),
    ).toBe(true);
    expect(
      keysMonoJack.inputs.every(
        (input) => input.note === "TS jack 6.3mm – DI box",
      ),
    ).toBe(true);
    expect(presets.some((preset) => preset.id.includes("synth"))).toBe(false);
  });
});
