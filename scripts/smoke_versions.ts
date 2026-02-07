import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { exportPdf } from "../src/app/usecases/exportPdf.js";
import { PROJECT_ROOT, USER_DATA_ROOT } from "../src/infra/fs/dataRoot.js";

const projectId = "smoke_versions";

async function ensureProject(): Promise<void> {
  const projectsDir = path.join(USER_DATA_ROOT, "projects");
  await fs.mkdir(projectsDir, { recursive: true });

  const projectPath = path.join(projectsDir, `${projectId}.json`);
  const project = {
    id: projectId,
    bandRef: "pl",
    purpose: "event",
    eventDate: "2026-02-13",
    eventVenue: "Praha",
    documentDate: "2026-02-07",
  };

  await fs.writeFile(projectPath, JSON.stringify(project, null, 2));
}

function runCliVersions(): unknown[] {
  const result = spawnSync(
    process.execPath,
    ["--enable-source-maps", "--import", "tsx", "src/cli/index.ts", "--versions", projectId, "--json"],
    { cwd: PROJECT_ROOT, encoding: "utf8" }
  );

  if (result.status !== 0) {
    throw new Error(`CLI failed: ${result.stderr || result.stdout}`);
  }

  return JSON.parse(result.stdout) as unknown[];
}

async function main() {
  await ensureProject();

  const exportResult = await exportPdf(projectId);
  const versionDir = exportResult.versionPath;

  const metaPath = path.join(versionDir, "meta.json");
  const pdfPath = path.join(versionDir, "document.pdf");
  const projectPath = path.join(versionDir, "project.json");

  await fs.stat(metaPath);
  await fs.stat(pdfPath);
  await fs.stat(projectPath);

  const versions = runCliVersions();
  if (!Array.isArray(versions) || versions.length < 1) {
    throw new Error("Expected at least one version from CLI --versions");
  }

  console.log("smoke_versions: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
