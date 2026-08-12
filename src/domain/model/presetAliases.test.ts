import { describe, expect, it } from "vitest";
import { resolvePresetIdAlias } from "./presetAliases.js";

describe("monitor preset aliases", () => {
  it("maps every legacy monitor id to its foh variant", () => {
    expect(resolvePresetIdAlias("iem_mono_wired")).toBe("iem_mono_wired_foh");
    expect(resolvePresetIdAlias("iem_mono_wireless")).toBe(
      "iem_mono_wireless_foh",
    );
    expect(resolvePresetIdAlias("iem_stereo_wired")).toBe(
      "iem_stereo_wired_foh",
    );
    expect(resolvePresetIdAlias("iem_stereo_wireless")).toBe(
      "iem_stereo_wireless_foh",
    );
    expect(resolvePresetIdAlias("wedge")).toBe("wedge_foh");
  });

  it("leaves new monitor ids untouched", () => {
    expect(resolvePresetIdAlias("iem_stereo_wired_own")).toBe(
      "iem_stereo_wired_own",
    );
    expect(resolvePresetIdAlias("wedge_own")).toBe("wedge_own");
  });

  it("keeps the pre-existing group preset aliases", () => {
    expect(resolvePresetIdAlias("el_bass_xlr")).toBe("el_bass_xlr_amp");
    expect(resolvePresetIdAlias("keys_jack")).toBe("keys_stereo_jack");
  });
});
