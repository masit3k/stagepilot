import { describe, expect, it } from "vitest";
import { disambiguateInputKeys } from "./disambiguateInputKeys.js";

describe("disambiguateInputKeys", () => {
  it("keeps single instance keys intact", () => {
    const inputs = [{ key: "voc_lead", label: "Lead Voc", group: "vocs" }];
    const result = disambiguateInputKeys(inputs);
    expect(result).toEqual(inputs);
  });

  it("numbers duplicate mono keys and labels", () => {
    const inputs = [
      { key: "voc_lead", label: "Lead Voc", group: "vocs" },
      { key: "voc_lead", label: "Lead Voc", group: "vocs" },
    ];
    const result = disambiguateInputKeys(inputs);
    expect(result.map((i) => i.key)).toEqual(["voc_lead_1", "voc_lead_2"]);
    expect(result.map((i) => i.label)).toEqual(["Lead Voc 1", "Lead Voc 2"]);
  });

  it("pairs stereo instances by stem and appends index after _l/_r", () => {
    const inputs = [
      { key: "keys_pad_l", label: "Pad L", group: "keys" },
      { key: "keys_pad_r", label: "Pad R", group: "keys" },
      { key: "keys_pad_l", label: "Pad L", group: "keys" },
      { key: "keys_pad_r", label: "Pad R", group: "keys" },
    ];
    const result = disambiguateInputKeys(inputs);
    expect(result.map((i) => i.key)).toEqual([
      "keys_pad_l_1",
      "keys_pad_r_1",
      "keys_pad_l_2",
      "keys_pad_r_2",
    ]);
    expect(result.map((i) => i.label)).toEqual(["Pad 1 L", "Pad 1 R", "Pad 2 L", "Pad 2 R"]);
  });

  it("leaves mixed mono/stereo inputs unchanged when no duplicates exist", () => {
    const inputs = [
      { key: "gtr_main", label: "Guitar", group: "guitar" },
      { key: "keys_pad_l", label: "Pad L", group: "keys" },
      { key: "keys_pad_r", label: "Pad R", group: "keys" },
    ];
    const result = disambiguateInputKeys(inputs);
    expect(result).toEqual(inputs);
  });
});
