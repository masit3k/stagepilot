import { describe, expect, it } from "vitest";
import type { InputChannel } from "../model/types.js";
import { compareInputsForRole } from "./orderInputsForRole.js";
import { orderInputs } from "./orderInputs.js";

describe("orderInputs bass ordering", () => {
  it("orders bass connection, mic, and synth by fixed priority", () => {
    const inputs: InputChannel[] = [
      { key: "bass_synth", label: "Bass synth", group: "bass" },
      { key: "el_bass_xlr_pedalboard", label: "Electric bass guitar", group: "bass" },
      { key: "el_bass_mic", label: "Electric bass mic", group: "bass" },
    ];

    expect(orderInputs(inputs, "bass").map((item) => item.key)).toEqual([
      "el_bass_xlr_pedalboard",
      "el_bass_mic",
      "bass_synth",
    ]);
  });

  it("keeps unexpected bass extras after known items", () => {
    const inputs: InputChannel[] = [
      { key: "bass_fx_a", label: "FX A", group: "bass" },
      { key: "el_bass_mic", label: "Electric bass mic", group: "bass" },
      { key: "bass_fx_b", label: "FX B", group: "bass" },
      { key: "el_bass_xlr_amp", label: "Electric bass guitar", group: "bass" },
    ];

    expect(orderInputs(inputs, "bass").map((item) => item.key)).toEqual([
      "el_bass_xlr_amp",
      "el_bass_mic",
      "bass_fx_a",
      "bass_fx_b",
    ]);
  });

  it("returns neutral comparison for non-bass roles", () => {
    expect(
      compareInputsForRole(
        "guitar",
        { key: "gtr_di", label: "GTR DI", group: "guitar" },
        { key: "gtr_mic", label: "GTR MIC", group: "guitar" },
      ),
    ).toBe(0);
  });
});
