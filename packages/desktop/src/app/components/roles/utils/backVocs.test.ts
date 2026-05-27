import { describe, expect, it } from "vitest";
import { sanitizeBackVocsSelection } from "./backVocs";

describe("sanitizeBackVocsSelection", () => {
  it("removes musicians already selected as lead vocals", () => {
    expect(
      Array.from(
        sanitizeBackVocsSelection(new Set(["m1", "m2"]), new Set(["m2"])),
      ),
    ).toEqual(["m1"]);
  });
});
