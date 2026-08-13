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
  it("renders two pages when stageplan is included", { timeout: 60000 }, async () => {
    if (!chromiumAvailable) {
      // Bez prohlížeče se nedá render ověřit. Přeskočení není zelený výsledek.
      console.warn("[pdf.test] Chromium unavailable — skipping render check");
      return;
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
});
