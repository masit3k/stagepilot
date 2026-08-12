import { describe, expect, it } from "vitest";
import { pdfStyles } from "./styles.js";
import { pdfLayout } from "./layout.js";

describe("pdf notes typography", () => {
  it("matches table text size and drops italic from note paragraphs", () => {
    expect(pdfStyles).toContain(
      `.notes {\n  font-size: ${pdfLayout.typography.table.size};`,
    );
    expect(pdfStyles).not.toContain("font-style: italic");
  });

  it("loads only the two brand families", () => {
    expect(pdfStyles).toContain("font-family: 'Space Grotesk'");
    expect(pdfStyles).toContain("font-family: 'IBM Plex Mono'");
    expect(pdfStyles).not.toContain("Inter");
  });

  it("allows note cells to wrap long note content", () => {
    expect(pdfStyles).toContain(".colNote {");
    expect(pdfStyles).toContain("white-space: normal;");
    expect(pdfStyles).toContain("overflow-wrap: anywhere;");
    expect(pdfStyles).toContain("word-break: break-word;");
  });
});

describe("pdf table", () => {
  it("carries rows on hairlines instead of a frame", () => {
    expect(pdfStyles).not.toContain(".tableBlock");
    expect(pdfStyles).toContain("--w-grid");
  });

  it("sets the channel number in mono", () => {
    expect(pdfStyles).toContain(
      `.table tbody td.colNo {\n  font-family: '${pdfLayout.typography.monoFamily}'`,
    );
  });
});
