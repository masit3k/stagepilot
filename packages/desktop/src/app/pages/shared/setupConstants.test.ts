import { describe, expect, it } from "vitest";
import { resolveMusicianDefaultInputsFromPresets } from "./setupConstants";

describe("resolveMusicianDefaultInputsFromPresets", () => {
  it("resolves bass default input from musician preset ref", () => {
    const inputs = resolveMusicianDefaultInputsFromPresets(
      "bass",
      [{ kind: "preset", ref: "el_bass_xlr_pedalboard" }],
      {
        el_bass_xlr_pedalboard: {
          id: "el_bass_xlr_pedalboard",
          type: "preset",
          group: "bass",
          label: "Bass",
          inputs: [{ key: "el_bass_xlr_pedalboard", label: "Bass" }],
        } as never,
      },
    );
    expect(inputs?.map((item) => item.key)).toEqual(["el_bass_xlr_pedalboard"]);
  });
});
