import { describe, expect, it } from "vitest";
import { parsePt, pdfChromeHeights, pdfLayout } from "./layout.js";

describe("pdf page box", () => {
  it("derives the print area from the page margins", () => {
    // 210 - 15 - 15 a 297 - 20 - 15. Kdyby se okraje změnily, musí se
    // změnit i zrcadlo — jinak DOM kontrola měří jinou stránku, než se tiskne.
    expect(pdfLayout.page.contentWidthMm).toBe(180);
    expect(pdfLayout.page.contentHeightMm).toBe(262);
  });

  it("keeps the derived box in sync with the declared margins", () => {
    const left = Number.parseFloat(pdfLayout.page.margins.left);
    const right = Number.parseFloat(pdfLayout.page.margins.right);
    const top = Number.parseFloat(pdfLayout.page.margins.top);
    const bottom = Number.parseFloat(pdfLayout.page.margins.bottom);

    expect(pdfLayout.page.contentWidthMm).toBe(210 - left - right);
    expect(pdfLayout.page.contentHeightMm).toBe(297 - top - bottom);
  });
});

describe("pdf chrome heights", () => {
  it("measures the header from its own type and spacing", () => {
    expect(pdfChromeHeights.headerMm).toBeCloseTo(21.85, 1);
  });

  it("measures the footer from its own type and spacing", () => {
    expect(pdfChromeHeights.footerMm).toBeCloseTo(8.18, 1);
  });
});

describe("parsePt", () => {
  it("reads a pt value", () => {
    expect(parsePt("17.1pt")).toBe(17.1);
  });

  it("throws on anything else, instead of guessing", () => {
    expect(() => parsePt("17.1mm")).toThrow();
  });
});
