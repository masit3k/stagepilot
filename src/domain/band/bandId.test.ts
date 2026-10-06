import { describe, expect, it } from "vitest";
import { deriveBandId } from "./bandId";

describe("deriveBandId", () => {
  it("derives the ids of the existing catalog bands from their names", () => {
    expect(deriveBandId("Big Night Band")).toBe("big_night_band");
    expect(deriveBandId("Blanická kapela")).toBe("blanicka_kapela");
    expect(deriveBandId("Couple of Sounds")).toBe("couple_of_sounds");
  });

  it("returns an empty id for a name without letters or digits", () => {
    expect(deriveBandId("   ")).toBe("");
  });
});
