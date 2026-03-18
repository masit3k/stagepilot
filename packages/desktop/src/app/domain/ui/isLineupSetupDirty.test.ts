import { describe, expect, it } from "vitest";
import {
  areLineupStatesEqual,
  createLineupDirtyBaseline,
  hasUnsavedLineupChanges,
  isLineupSetupDirty,
} from "./isLineupSetupDirty";

describe("isLineupSetupDirty", () => {
  const baseline = {
    lineup: { drums: "drummer-1", vocs: "lead-1", back_vocs: ["back-1"] },
    bandLeaderId: "drummer-1",
    talkbackOwnerId: "drummer-1",
    leadVocalistIds: ["lead-1"],
    backVocalIds: ["back-1"],
  };

  it("returns false when unchanged", () => {
    expect(
      isLineupSetupDirty({
        baselineProject: baseline,
        currentDraftProject: { ...baseline },
      }),
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
              presetOverride: {
                inputs: {
                  add: [{ key: "bass_pedal", label: "Bass pedalboard" }],
                },
              },
            },
          },
        },
      }),
    ).toBe(true);
  });

  it("treats explicit empty back vocal override as dirty against default-derived state", () => {
    expect(
      isLineupSetupDirty({
        baselineProject: baseline,
        currentDraftProject: {
          ...baseline,
          backVocalIds: [],
          hasBackVocalOverride: true,
        },
      }),
    ).toBe(true);
  });

  it("treats explicit talkback removal as dirty against default-derived state", () => {
    expect(
      isLineupSetupDirty({
        baselineProject: baseline,
        currentDraftProject: {
          ...baseline,
          talkbackOwnerId: "",
          hasTalkbackOverride: true,
        },
      }),
    ).toBe(true);
  });

  it("ignores lineup object key ordering", () => {
    const current = {
      ...baseline,
      lineup: {
        vocs: "lead-1",
        back_vocs: ["back-1"],
        drums: "drummer-1",
      },
    };
    expect(areLineupStatesEqual(baseline, current)).toBe(true);
  });

  it("returns dirty false when edits are reverted to baseline", () => {
    const dirtyState = {
      ...baseline,
      talkbackOwnerId: "other",
    };
    expect(hasUnsavedLineupChanges({ baseline, current: dirtyState })).toBe(
      true,
    );
    expect(hasUnsavedLineupChanges({ baseline, current: baseline })).toBe(
      false,
    );
  });

  it("creates baseline from effective current state", () => {
    const effectiveCurrent = {
      ...baseline,
      backVocalIds: ["back-2", "back-1"],
    };
    const dirtyBaseline = createLineupDirtyBaseline(effectiveCurrent);
    expect(
      hasUnsavedLineupChanges({
        baseline: dirtyBaseline,
        current: effectiveCurrent,
      }),
    ).toBe(false);
  });
});
