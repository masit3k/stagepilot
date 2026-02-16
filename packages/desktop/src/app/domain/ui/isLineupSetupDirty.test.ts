import { describe, expect, it } from "vitest";
import { isLineupSetupDirty } from "./isLineupSetupDirty";

describe("isLineupSetupDirty", () => {
  const baseline = {
    lineup: { drums: "drummer-1", lead_vocs: "lead-1", back_vocs: ["back-1"] },
    bandLeaderId: "drummer-1",
    talkbackOwnerId: "drummer-1",
    backVocalIds: ["back-1"],
  };

  it("returns false when unchanged", () => {
    expect(
      isLineupSetupDirty({ baselineProject: baseline, currentDraftProject: { ...baseline } }),
    ).toBe(false);
  });

  it("returns true when lineup or overrides change", () => {
    expect(
      isLineupSetupDirty({
        baselineProject: baseline,
        currentDraftProject: {
          ...baseline,
          lineup: {
            ...baseline.lineup,
            bass: {
              musicianId: "bass-1",
              presetOverride: { inputs: { add: [{ key: "bass_pedal", label: "Bass pedalboard" }] } },
            },
          },
        },
      }),
    ).toBe(true);
  });
});
