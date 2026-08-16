import { beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadRepository } from "../fs/repo.js";
import { buildDocument } from "../../domain/pipeline/buildDocument.js";
import { finalizeRenderedPdf, launchPdfBrowser, renderPdf } from "./pdf.js";
import { countPdfPages } from "./pdfPageCount.js";
import {
  createPdfRendererFixtureProject,
  createPdfRendererFixtureRoot,
} from "./pdfRendererFixture.js";

/**
 * Jména fontů vložených do PDF. Chromium je sází nekomprimovaně, takže se dají
 * číst přímo z bajtů; podsada má prefix typu "AAAAAA+", ten se zahazuje.
 *
 * Čte se `/BaseFont` i `/FontName`: Space Grotesk je variabilní řez a Chromium
 * ho nevloží jako běžný CIDFontType2 s `/BaseFont` — každou použitou váhu
 * převede na samostatný Type3 font, jehož jméno nese jen `/FontDescriptor`
 * pod `/FontName`. Statické řezy (IBM Plex Mono, systémová náhrada) mají
 * obojí shodné, takže se stejným vzorem najdou taky.
 */
function embeddedFontNames(pdf: Buffer): string[] {
  const matches = pdf
    .toString("latin1")
    .matchAll(/\/(?:BaseFont|FontName)\s*\/(?:[A-Z]{6}\+)?([A-Za-z0-9\-,._]+)/g);
  return [...new Set([...matches].map((match) => match[1]))];
}

let chromiumAvailable = false;

beforeAll(async () => {
  try {
    const browser = await launchPdfBrowser();
    await browser.close();
    chromiumAvailable = true;
  } catch {
    chromiumAvailable = false;
  }
}, 60000);

describe("finalizeRenderedPdf", () => {
  it("removes the temp file and leaves no artifact at outFile when the page count is wrong", async () => {
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "stagepilot-pdf-finalize-"));

    try {
      const tempOutFile = path.join(tmpRoot, "doc.pdf.tmp-test");
      const outFile = path.join(tmpRoot, "doc.pdf");
      await fs.writeFile(tempOutFile, "/Type /Page\n"); // only one page marker

      await expect(finalizeRenderedPdf(tempOutFile, outFile)).rejects.toThrow(
        /PDF page count mismatch: expected 2, got 1/,
      );

      await expect(fs.access(tempOutFile)).rejects.toThrow();
      await expect(fs.access(outFile)).rejects.toThrow();
    } finally {
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
  });

  it("renames the temp file onto outFile, unchanged, when the page count is correct", async () => {
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "stagepilot-pdf-finalize-"));

    try {
      const tempOutFile = path.join(tmpRoot, "doc.pdf.tmp-test");
      const outFile = path.join(tmpRoot, "doc.pdf");
      const content = "/Type /Page\n/Type /Page\n";
      await fs.writeFile(tempOutFile, content);

      await finalizeRenderedPdf(tempOutFile, outFile);

      await expect(fs.access(tempOutFile)).rejects.toThrow();
      expect(await fs.readFile(outFile, "utf8")).toBe(content);
    } finally {
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
  });
});

describe("PDF export", () => {
  it("renders two pages when stageplan is included", { timeout: 60000 }, async (ctx) => {
    if (!chromiumAvailable) {
      // Bez prohlížeče se nedá render ověřit. Test se musí nahlásit jako
      // "skipped", ne jako "passed" — jinak je bez Chromia celá sada zelená,
      // aniž by se render vůbec zkusil.
      ctx.skip();
    }

    const tmpRoot = await createPdfRendererFixtureRoot();

    try {
      const repo = await loadRepository({ userDataRoot: tmpRoot });
      const project = createPdfRendererFixtureProject("stageplan-pdf");

      const vm = buildDocument(project, repo);
      const outFile = path.join(tmpRoot, "stageplan.pdf");

      await renderPdf(vm, { outFile });

      const buffer = await fs.readFile(outFile);
      expect(countPdfPages(buffer)).toBe(2);
    } finally {
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
  });

  it("embeds the brand fonts, not a fallback", { timeout: 60000 }, async (ctx) => {
    if (!chromiumAvailable) {
      ctx.skip();
    }

    // Pojistka proti tiché náhradě písma. `page.setContent` nechává dokument na
    // about:blank a Chromium z takového původu odmítne file:// zdroje, takže
    // @font-face selhal a dokument se sázel Arialem — a nikdo si toho nevšiml,
    // protože počet stran zůstal správný. Tenhle test se dívá na to, co v PDF
    // opravdu je.
    const tmpRoot = await createPdfRendererFixtureRoot();

    try {
      const repo = await loadRepository({ userDataRoot: tmpRoot });
      const project = createPdfRendererFixtureProject("stageplan-fonts");

      const vm = buildDocument(project, repo);
      const outFile = path.join(tmpRoot, "fonts.pdf");

      await renderPdf(vm, { outFile });

      const fonts = embeddedFontNames(await fs.readFile(outFile));
      // Skia dává jménům instancí variabilního řezu pomlčku ("Space-Grotesk-Bold"),
      // ne mezeru ani spojení bez oddělovače — ověřeno na skutečném PDF výstupu.
      expect(fonts.join(" ")).toContain("Space-Grotesk");
      expect(fonts.join(" ")).toContain("IBMPlexMono");
      expect(fonts.join(" ")).not.toContain("Arial");
    } finally {
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
  });
});
