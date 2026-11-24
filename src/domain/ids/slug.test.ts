import { describe, expect, it } from "vitest";
import { ID_SLUG_MAX_LENGTH, stripDiacritics, toIdSlug } from "./slug";

describe("stripDiacritics", () => {
  it("removes Czech diacritics and keeps the base letters", () => {
    expect(stripDiacritics("Žluťoučký kůň úpěl ďábelské ódy")).toBe(
      "Zlutoucky kun upel dabelske ody",
    );
  });
});

describe("toIdSlug", () => {
  it("lowercases and joins words with underscores", () => {
    expect(toIdSlug("Big Night Band")).toBe("big_night_band");
  });

  it("strips diacritics so the id matches the real catalog file name", () => {
    expect(toIdSlug("Blanická kapela")).toBe("blanicka_kapela");
  });

  it("collapses runs of separators and trims them at both ends", () => {
    expect(toIdSlug("  --Party   Leaders!!  ")).toBe("party_leaders");
  });

  it("keeps digits", () => {
    expect(toIdSlug("4 Seasons 2026")).toBe("4_seasons_2026");
  });

  it("returns an empty string when nothing alphanumeric is left", () => {
    expect(toIdSlug("!!! ---")).toBe("");
  });

  it("caps the id at 50 characters", () => {
    expect(toIdSlug("a".repeat(80))).toHaveLength(ID_SLUG_MAX_LENGTH);
  });

  it("never ends with an underscore after the 50-character cut", () => {
    expect(toIdSlug(`${"a".repeat(49)} band`)).toBe("a".repeat(49));
  });
});
