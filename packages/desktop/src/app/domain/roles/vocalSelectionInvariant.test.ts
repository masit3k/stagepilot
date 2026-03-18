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
});
