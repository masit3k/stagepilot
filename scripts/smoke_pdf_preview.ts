import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { buildDocument } from "../src/domain/pipeline/buildDocument.js";
import type { Project } from "../src/domain/model/types.js";
import { loadRepository } from "../src/infra/fs/repo.js";
import { renderPdf } from "../src/infra/pdf/pdf.js";

async function run() {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "stagepilot-pdf-smoke-"));
  try {
    await fs.mkdir(path.join(tmpRoot, "projects"), { recursive: true });
    const repo = await loadRepository({ userDataRoot: tmpRoot });
    const project: Project = {
      id: "pdf-smoke",
      purpose: "generic",
      bandRef: "pl",
      documentDate: "2026-01-01",
    };
    const vm = buildDocument(project, repo);
    const outFile = path.join(tmpRoot, "preview-smoke.pdf");
    await renderPdf(vm, { outFile });
    const stat = await fs.stat(outFile);
    if (!stat.isFile() || stat.size <= 0) {
      throw new Error(`Smoke PDF output is invalid. exists=${stat.isFile()} size=${stat.size}`);
    }
    console.log(`PDF smoke OK: ${outFile} (${stat.size} bytes)`);
  } finally {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error("PDF smoke failed", error);
  process.exitCode = 1;
});
