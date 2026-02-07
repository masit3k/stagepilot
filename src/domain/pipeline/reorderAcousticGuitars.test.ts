import { describe, expect, it } from "vitest";
import { reorderAcousticGuitars } from "./reorderAcousticGuitars.js";

type Input = { key: string; group: "drums" | "bass" | "guitar" | "keys" | "vocs" | "talkback" };

describe("reorderAcousticGuitars", () => {
  it("places acoustic guitars between electric guitars and keys", () => {
    const inputs: Input[] = [
      { key: "dr_kick_in", group: "drums" },
      { key: "el_guitar_xlr_l", group: "guitar" },
      { key: "el_guitar_xlr_r", group: "guitar" },
      { key: "keys_pad_l", group: "keys" },
      { key: "ac_guitar", group: "vocs" },
      { key: "voc_lead", group: "vocs" },
    ];

    const result = reorderAcousticGuitars(inputs);

    expect(result.map((i) => i.key)).toEqual([
      "dr_kick_in",
      "el_guitar_xlr_l",
      "el_guitar_xlr_r",
      "ac_guitar",
      "keys_pad_l",
      "voc_lead",
    ]);
  });

  it("keeps acoustic guitars after electric guitars when no keys exist", () => {
    const inputs: Input[] = [
      { key: "el_guitar_mic", group: "guitar" },
      { key: "voc_lead", group: "vocs" },
      { key: "ac_guitar", group: "guitar" },
    ];

    const result = reorderAcousticGuitars(inputs);

    expect(result.map((i) => i.key)).toEqual(["el_guitar_mic", "ac_guitar", "voc_lead"]);
  });

  it("moves acoustic guitars to the end of the guitar block when no electric guitars exist", () => {
    const inputs: Input[] = [
      { key: "gtr_fx", group: "guitar" },
      { key: "ac_guitar", group: "guitar" },
      { key: "keys_pad_l", group: "keys" },
    ];

    const result = reorderAcousticGuitars(inputs);

    expect(result.map((i) => i.key)).toEqual(["gtr_fx", "ac_guitar", "keys_pad_l"]);
  });
});
