import { describe, expect, it } from "vitest";
import { formatKeysInputInstances } from "./formatKeysInputs.js";

describe("formatKeysInputInstances", () => {
  it("keeps single keys label unnumbered", () => {
    const out = formatKeysInputInstances([
      { key: "keys_l", label: "Keys L", group: "keys" as const },
      { key: "keys_r", label: "Keys R", group: "keys" as const },
    ]);
    expect(out.map((item) => item.label)).toEqual(["Keys", "Keys"]);
  });

  it("numbers mixed multi-unit keys without synth labels", () => {
    const out = formatKeysInputInstances([
      { key: "keys_1_l", label: "Keys L", group: "keys" as const },
      { key: "keys_1_r", label: "Keys R", group: "keys" as const },
      { key: "keys_2", label: "Keys", group: "keys" as const },
      { key: "keys_3_l", label: "Keys L", group: "keys" as const },
      { key: "keys_3_r", label: "Keys R", group: "keys" as const },
    ]);
    const unique = Array.from(new Set(out.map((item) => item.label)));
    expect(unique).toEqual(["Keys 1", "Keys 2", "Keys 3"]);
  });
});
