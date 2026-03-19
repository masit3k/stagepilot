import { describe, expect, it } from "vitest";
import { enforceVocalSelectionInvariant } from "./vocalSelectionInvariant";

describe("enforceVocalSelectionInvariant", () => {
  it("prevents lead/back overlap and non-lineup ids", () => {
    const result = enforceVocalSelectionInvariant({
      lineupCandidateIds: ["m1", "m2", "m3"],
      leadIds: ["m1", "outside", "m2"],
      backIds: ["m2", "m3", "outside"],
    });

    expect(result).toEqual({
      leadIds: ["m1", "m2"],
      backIds: ["m3"],
    });
  });

  it("preserves user-selected order while removing duplicates", () => {
    const result = enforceVocalSelectionInvariant({
      lineupCandidateIds: ["m1", "m2", "m3", "m4"],
      leadIds: ["m3", "m1", "m3", "m4"],
      backIds: ["m2", "m1", "m2"],
    });

    expect(result).toEqual({
      leadIds: ["m3", "m1", "m4"],
      backIds: ["m2"],
    });
  });
});
