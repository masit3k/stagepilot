import { describe, expect, it } from "vitest";
import {
  BAND_CODE_MAX_LENGTH,
  deriveBandCode,
  isValidBandCode,
  normalizeBandCode,
} from "./bandCode";

describe("deriveBandCode", () => {
  it("takes the initials of a multi-word name without diacritics", () => {
    expect(deriveBandCode("Big Night Band")).toBe("BNB");
    expect(deriveBandCode("Blanická kapela")).toBe("BK");
    expect(deriveBandCode("Žluťoučký kůň")).toBe("ZK");
  });

  it("takes the first three letters of a one-word name", () => {
    expect(deriveBandCode("Metallica")).toBe("MET");
    expect(deriveBandCode("U2")).toBe("U2");
  });

  it("keeps digits as initials", () => {
    expect(deriveBandCode("4 Seasons Band")).toBe("4SB");
  });

  it("caps the initials at six characters", () => {
    const code = deriveBandCode("One Two Three Four Five Six Seven");
    expect(code).toBe("OTTFFS");
    expect(code).toHaveLength(BAND_CODE_MAX_LENGTH);
  });

  it("splits words on hyphens and punctuation", () => {
    expect(deriveBandCode("Rock-n-Roll Band")).toBe("RNRB");
  });

  it("returns an empty code for a name without letters or digits", () => {
    expect(deriveBandCode("  !!  ")).toBe("");
  });
});

describe("normalizeBandCode", () => {
  it("uppercases, strips diacritics and removes whitespace", () => {
    expect(normalizeBandCode(" bnb ")).toBe("BNB");
    expect(normalizeBandCode("b n b")).toBe("BNB");
    expect(normalizeBandCode("čk")).toBe("CK");
  });
});

describe("isValidBandCode", () => {
  it("accepts two to six upper-case letters or digits", () => {
    expect(isValidBandCode("BNB")).toBe(true);
    expect(isValidBandCode("B2")).toBe(true);
    expect(isValidBandCode("ABCDEF")).toBe(true);
  });

  it("rejects too short, too long, lower-case and punctuated codes", () => {
    expect(isValidBandCode("B")).toBe(false);
    expect(isValidBandCode("ABCDEFG")).toBe(false);
    expect(isValidBandCode("bnb")).toBe(false);
    expect(isValidBandCode("BN-B")).toBe(false);
    expect(isValidBandCode(deriveBandCode("A"))).toBe(false);
  });
});
