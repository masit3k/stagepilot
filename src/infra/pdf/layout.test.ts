import { describe, expect, it } from "vitest";
import { parsePt, pdfChromeHeights, pdfHeaderColumnsPt, pdfLayout } from "./layout.js";

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
  it("measures the header from its own type and spacing, contact row included", () => {
    // 17,1 + 2,7 + 11,34 + 2,7 + 11,34 = 45,18 pt textového sloupce, pak
    // 12,6 + 2 + 16,2 pt chromu → 75,98 pt = 26,80 mm. Proti F6 je hlavička
    // o 4,95 mm vyšší; to je cena R12 a nese ji obě strany.
    expect(pdfChromeHeights.headerMm).toBeCloseTo(26.8, 1);
  });

  it("counts every header column into the budget, stamp included (R14)", () => {
    // Razítko má dva řádky (STAGEPILOT / UPD …). Dnes je titulní sloupec
    // vyšší, takže na to nikdo nešlápl — kdyby se ale titul zkrátil, musí
    // rozpočet nést razítko. Testuje se proto nejvyšší sloupec obecně, ne
    // dnešní vítěz: tvrzení „headerMm ≥ razítko" by při dnešních číslech
    // platilo, i kdyby razítko v `Math.max` vůbec nefigurovalo.
    expect(pdfHeaderColumnsPt.mark).toBeCloseTo(23.4, 2);
    expect(pdfHeaderColumnsPt.title).toBeCloseTo(45.18, 2);
    expect(pdfHeaderColumnsPt.stamp).toBeCloseTo(25.92, 2);

    const tallestColumnPt = Math.max(...Object.values(pdfHeaderColumnsPt));
    const expectedMm =
      ((tallestColumnPt +
        pdfLayout.header.padBottomPt +
        pdfLayout.header.rulePt +
        pdfLayout.header.marginBottomPt) *
        25.4) /
      72;

    expect(pdfChromeHeights.headerMm).toBeCloseTo(expectedMm, 6);
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
