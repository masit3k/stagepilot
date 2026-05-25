import { describe, expect, it } from "vitest";
import {
  buildKeysUnitInputs,
  clampKeysCount,
  readKeysUnits,
} from "./keysInstanceInputs";

describe("keysInstanceInputs", () => {
  it("clamps count to 1-5", () => {
    expect(clampKeysCount(0)).toBe(1);
    expect(clampKeysCount(10)).toBe(5);
  });

  it("builds one unnumbered stereo keys unit", () => {
    const out = buildKeysUnitInputs([{ variant: "stereo_xlr" }]);
    expect(out).toEqual([
      {
        key: "keys_l",
        label: "Keys L",
        baseLabel: "Keys",
        compactGroupKey: "keys_stereo_xlr",
        channel: "L",
        group: "keys",
        note: "XLR out from rack",
      },
      {
        key: "keys_r",
        label: "Keys R",
        baseLabel: "Keys",
        compactGroupKey: "keys_stereo_xlr",
        channel: "R",
        group: "keys",
        note: "XLR out from rack",
      },
    ]);
  });

  it("builds independent mixed keys units", () => {
    const out = buildKeysUnitInputs([
      { variant: "stereo_xlr" },
      { variant: "mono_jack" },
      { variant: "stereo_jack" },
    ]);
    expect(out.map((item) => [item.key, item.label, item.note])).toEqual([
      ["keys_l", "Keys 1 L", "XLR out from rack"],
      ["keys_r", "Keys 1 R", "XLR out from rack"],
      ["keys_2", "Keys 2", "TS jack 6.3mm – DI box"],
      ["keys_3_l", "Keys 3 L", "TS jack 6.3mm – DI box"],
      ["keys_3_r", "Keys 3 R", "TS jack 6.3mm – DI box"],
    ]);
  });

  it("reads variants from existing effective inputs", () => {
    expect(
      readKeysUnits([
        {
          key: "keys_l",
          label: "Keys L",
          group: "keys",
          note: "TS jack 6.3mm – DI box",
        },
        {
          key: "keys_r",
          label: "Keys R",
          group: "keys",
          note: "TS jack 6.3mm – DI box",
        },
        {
          key: "keys_2",
          label: "Keys 2",
          group: "keys",
          note: "XLR out from rack",
        },
      ]),
    ).toEqual([{ variant: "stereo_jack" }, { variant: "mono_xlr" }]);
  });
});
