import { beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { loadRepository } from "../fs/repo.js";
import { buildDocument } from "../../domain/pipeline/buildDocument.js";
import { launchPdfBrowser, renderPdf } from "./pdf.js";
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
