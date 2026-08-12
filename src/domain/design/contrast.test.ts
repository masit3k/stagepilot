import { describe, expect, it } from "vitest";
import {
  AA_NORMAL_TEXT,
  contrastRatio,
  meetsContrast,
  parseHexColor,
  relativeLuminance,
} from "./contrast.js";

describe("parseHexColor", () => {
  it("reads six-digit hex with and without the hash", () => {
    expect(parseHexColor("#FF5B1F")).toEqual({ r: 255, g: 91, b: 31 });
    expect(parseHexColor("FF5B1F")).toEqual({ r: 255, g: 91, b: 31 });
  });

  it("expands three-digit shorthand", () => {
    expect(parseHexColor("#fff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseHexColor("#0a3")).toEqual({ r: 0, g: 170, b: 51 });
  });

  it("is case insensitive", () => {
    expect(parseHexColor("#ff5b1f")).toEqual(parseHexColor("#FF5B1F"));
  });

  it("rejects anything that is not a hex colour", () => {
    expect(() => parseHexColor("rgb(255, 91, 31)")).toThrow(/Not a hex colour/);
    expect(() => parseHexColor("#12345")).toThrow(/Not a hex colour/);
    expect(() => parseHexColor("")).toThrow(/Not a hex colour/);
  });
});

describe("relativeLuminance", () => {
  it("puts black at 0 and white at 1", () => {
    expect(relativeLuminance(parseHexColor("#000000"))).toBe(0);
    expect(relativeLuminance(parseHexColor("#FFFFFF"))).toBeCloseTo(1, 10);
  });
});

describe("contrastRatio", () => {
  it("gives 21:1 for black on white", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 10);
  });

  it("gives 1:1 for a colour against itself", () => {
    expect(contrastRatio("#FF5B1F", "#FF5B1F")).toBeCloseTo(1, 10);
  });

  it("is symmetric — order of arguments does not matter", () => {
    expect(contrastRatio("#101112", "#FF5B1F")).toBeCloseTo(
      contrastRatio("#FF5B1F", "#101112"),
      10,
    );
  });

  it("matches known reference values from the brand palette", () => {
    // ink on signal — the primary button in both themes
    expect(contrastRatio("#101112", "#FF5B1F")).toBeCloseTo(6.09, 2);
    // body text on paper
    expect(contrastRatio("#55585C", "#F4F2ED")).toBeCloseTo(6.39, 2);
  });
});

describe("meetsContrast", () => {
  it("accepts a pair at or above the threshold", () => {
    expect(meetsContrast("#000000", "#FFFFFF", AA_NORMAL_TEXT)).toBe(true);
  });

  it("rejects a pair below the threshold", () => {
    // The pre-rebrand secondary text, which failed AA on paper at 2.98:1.
    expect(meetsContrast("#8A8D92", "#F4F2ED", AA_NORMAL_TEXT)).toBe(false);
  });
});
