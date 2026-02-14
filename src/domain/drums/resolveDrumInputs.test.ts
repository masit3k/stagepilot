import { describe, expect, it } from "vitest";
import { resolveDrumInputs } from "./resolveDrumInputs.js";
import { STANDARD_10_SETUP, validateDrumSetup, migrateLegacyDrumPresetRefs } from "./drumSetup.js";

describe("resolveDrumInputs", () => {
  it("resolves standard 10 in deterministic order", () => {
    const rows = resolveDrumInputs(STANDARD_10_SETUP);
    expect(rows.map((row) => row.key)).toEqual([
      "dr_kick_out",
      "dr_kick_in",
      "dr_snare1_top",
      "dr_snare1_bottom",
      "dr_hihat",
      "dr_tom_1",
      "dr_tom_2",
      "dr_floor_1",
      "dr_oh_l",
      "dr_oh_r",
    ]);
  });

  it("supports tom/floor range and extra snares after OH", () => {
    const rows = resolveDrumInputs({
      tomCount: 4,
      floorTomCount: 4,
      hasHiHat: true,
      hasOverheads: true,
      extraSnareCount: 2,
      pad: { enabled: false },
    });

    expect(rows.map((row) => row.key)).toEqual([
      "dr_kick_out",
      "dr_kick_in",
      "dr_snare1_top",
      "dr_snare1_bottom",
      "dr_hihat",
      "dr_tom_1",
      "dr_tom_2",
      "dr_tom_3",
      "dr_tom_4",
      "dr_floor_1",
      "dr_floor_2",
      "dr_floor_3",
      "dr_floor_4",
      "dr_oh_l",
      "dr_oh_r",
      "dr_snare2_top",
      "dr_snare3_top",
    ]);
  });

  it("supports pad variants and keeps pad at end", () => {
    const rows = resolveDrumInputs({
      tomCount: 0,
      floorTomCount: 0,
      hasHiHat: false,
      hasOverheads: false,
      extraSnareCount: 0,
      pad: { enabled: true, mode: "backing", channels: "stereo" },
    });

    expect(rows.map((row) => row.key)).toEqual([
      "dr_kick_out",
      "dr_kick_in",
      "dr_snare1_top",
      "dr_snare1_bottom",
      "dr_pad_stereo_backing_l",
      "dr_pad_stereo_backing_r",
    ]);
  });
});

describe("drum setup validation + migration", () => {
  it("rejects out-of-range values", () => {
    const errors = validateDrumSetup({
      tomCount: 5,
      floorTomCount: -1,
      hasHiHat: true,
      hasOverheads: true,
      extraSnareCount: 3,
      pad: { enabled: false },
    });

    expect(errors.length).toBe(3);
  });

  it("rejects incomplete pad config", () => {
    const errors = validateDrumSetup({
      tomCount: 1,
      floorTomCount: 1,
      hasHiHat: true,
      hasOverheads: true,
      extraSnareCount: 0,
      pad: { enabled: true, mode: "sfx", channels: undefined as never },
    });

    expect(errors).toContain("pad.mode and pad.channels are required when pad is enabled.");
  });

  it("migrates legacy standard_10 + features", () => {
    const setup = migrateLegacyDrumPresetRefs(["standard_10", "sample_pad_mono", "effect_snare"]);
    const rows = resolveDrumInputs(setup);
    expect(rows.some((row) => row.key === "dr_snare2_top")).toBe(true);
    expect(rows.some((row) => row.key === "dr_pad_mono_sfx")).toBe(true);
  });
});
