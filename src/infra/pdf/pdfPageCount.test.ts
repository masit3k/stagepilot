import { describe, expect, it } from "vitest";
import { countPdfPages } from "./pdfPageCount.js";

describe("countPdfPages", () => {
  it("counts page objects", () => {
    const pdf = Buffer.from("/Type /Page\n/Type /Page\n", "latin1");
    expect(countPdfPages(pdf)).toBe(2);
  });

  it("does not mistake the page tree for a page", () => {
    // /Type /Pages je kořen stromu stránek, ne stránka. Kdyby se počítal,
    // dvoustránkový dokument by hlásil tři.
    const pdf = Buffer.from("/Type /Pages\n/Type /Page\n", "latin1");
    expect(countPdfPages(pdf)).toBe(1);
  });

  it("tolerates the space-free form", () => {
    expect(countPdfPages(Buffer.from("/Type/Page\n", "latin1"))).toBe(1);
  });
});
