import { describe, expect, it } from "vitest";
import type { Musician, PresetEntity } from "../model/types.js";
import { resolveMusicianHasVocalCapability } from "./resolveMusicianHasVocalCapability.js";

const presetCatalog: Record<string, PresetEntity | undefined> = {
  vocal_no_mic: {
    type: "preset",
    id: "vocal_no_mic",
    label: "Vocal (no mic)",
    group: "vocs",
    capabilities: ["vocal"],
    inputs: [],
  },
  el_bass_xlr_amp: {
    type: "preset",
    id: "el_bass_xlr_amp",
    label: "Bass XLR",
    group: "bass",
    inputs: [],
  },
};

function musician(presets: Musician["presets"]): Musician {
  return {
    id: "m-1",
    firstName: "Test",
    lastName: "Musician",
    group: "guitar",
    presets,
  };
}

describe("resolveMusicianHasVocalCapability", () => {
  it("reports a musician holding a vocal-capable preset", () => {
    expect(
      resolveMusicianHasVocalCapability(
        musician([{ kind: "preset", ref: "vocal_no_mic" }]),
        presetCatalog,
      ),
    ).toBe(true);
  });

  it("reports no capability when every preset lacks it", () => {
    expect(
      resolveMusicianHasVocalCapability(
        musician([{ kind: "preset", ref: "el_bass_xlr_amp" }]),
        presetCatalog,
      ),
    ).toBe(false);
  });

  it("resolves preset id aliases before looking the preset up", () => {
    expect(
      resolveMusicianHasVocalCapability(
        musician([{ kind: "preset", ref: "el_bass_xlr" }]),
        presetCatalog,
      ),
    ).toBe(false);
  });

  it("ignores presets missing from the catalog", () => {
    expect(
      resolveMusicianHasVocalCapability(
        musician([{ kind: "preset", ref: "ghost_preset" }]),
        presetCatalog,
      ),
    ).toBe(false);
  });
});
