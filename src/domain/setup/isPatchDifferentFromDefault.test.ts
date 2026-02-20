import { describe, expect, it } from "vitest";
import type { MusicianSetupPreset } from "../model/types.js";
import { isPatchDifferentFromDefault } from "./isPatchDifferentFromDefault.js";

const defaultPreset: MusicianSetupPreset = {
  inputs: [{ key: "keys_l", label: "Keys L", group: "keys" }, { key: "keys_r", label: "Keys R", group: "keys" }],
  monitoring: { monitorRef: "wedge" },
};

describe("isPatchDifferentFromDefault", () => {
  it("returns false for redundant overrides that match defaults", () => {
    expect(isPatchDifferentFromDefault(defaultPreset, { monitoring: { monitorRef: "wedge" } })).toBe(false);
    expect(isPatchDifferentFromDefault(defaultPreset, { monitoring: { additionalWedgeCount: 0 } })).toBe(false);
  });

  it("returns true for real monitoring changes", () => {
    expect(isPatchDifferentFromDefault(defaultPreset, { monitoring: { monitorRef: "iem_mono_wired" } })).toBe(true);
  });

  it("returns false when patch is empty", () => {
    expect(isPatchDifferentFromDefault(defaultPreset, undefined)).toBe(false);
  });
});
