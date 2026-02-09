import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadRepository } from "../fs/repo.js";
import { buildDocument } from "../../domain/pipeline/buildDocument.js";
import type { Project } from "../../domain/model/types.js";
import { renderPdf } from "./pdf.js";

function countPdfPages(buffer: Buffer): number {
  const content = buffer.toString("latin1");
  const matches = content.match(/\/Type\s*\/Page\b/g) ?? [];
  return matches.length;
}

const hasChromiumDeps =
  existsSync("/usr/lib/x86_64-linux-gnu/libatk-1.0.so.0") ||
  existsSync("/usr/lib64/libatk-1.0.so.0");

describe("PDF export", () => {
  const maybeIt = hasChromiumDeps ? it : it.skip;

  maybeIt(
    "renders two pages when stageplan is included",
    { timeout: 30000 },
    async () => {
      const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "stagepilot-"));
      await fs.mkdir(path.join(tmpRoot, "projects"), { recursive: true });

      try {
        const repo = await loadRepository({ userDataRoot: tmpRoot });
        const project: Project = {
          id: "stageplan-pdf",
          bandRef: "pl",
          purpose: "generic",
          documentDate: "2024-01-01",
        };

        const vm = buildDocument(project, repo);
        const outFile = path.join(tmpRoot, "stageplan.pdf");

        await renderPdf(vm, { outFile });

        const buffer = await fs.readFile(outFile);
        expect(countPdfPages(buffer)).toBe(2);
      } finally {
        await fs.rm(tmpRoot, { recursive: true, force: true });
      }
    }
  );
});
