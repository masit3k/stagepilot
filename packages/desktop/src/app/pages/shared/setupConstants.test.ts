import { describe, expect, it } from "vitest";
import { resolveMusicianDefaultInputsFromPresets } from "./setupConstants";

describe("resolveMusicianDefaultInputsFromPresets", () => {
  it("resolves bass default input from musician preset ref", () => {
    const inputs = resolveMusicianDefaultInputsFromPresets("bass", [
      { kind: "preset", ref: "el_bass_xlr_pedalboard" },
    ]);
    expect(inputs?.map((item) => item.key)).toEqual(["el_bass_xlr_pedalboard"]);
  });
});
