import { describe, expect, it } from "vitest";
import { pdfStyles } from "./styles.js";
import { pdfLayout } from "./layout.js";

describe("pdf notes typography", () => {
  it("matches table text size and keeps italic style for note paragraphs", () => {
    expect(pdfStyles).toContain(`.notes {\n  font-size: ${pdfLayout.typography.table.size};`);
    expect(pdfStyles).toContain("font-style: italic;");
  });

  it("allows note cells to wrap long note content", () => {
    expect(pdfStyles).toContain(".colNote {");
    expect(pdfStyles).toContain("white-space: normal;");
    expect(pdfStyles).toContain("overflow-wrap: anywhere;");
    expect(pdfStyles).toContain("word-break: break-word;");
  });
});
