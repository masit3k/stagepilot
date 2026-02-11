import path from "node:path";
import { mkdir } from "node:fs/promises";
import { argv, exit } from "node:process";
import { loadJsonFile } from "../src/infra/fs/loadJson.js";
import { normalizeProject } from "../src/app/usecases/normalizeProject.js";
import { loadRepository } from "../src/infra/fs/repo.js";
import { buildDocument } from "../src/domain/pipeline/buildDocument.js";
import { validateDocument } from "../src/domain/rules/validateDocument.js";
import { renderPdf } from "../src/infra/pdf/pdf.js";
import type { ProjectJson } from "../src/domain/model/types.js";

type Args = { projectId: string; userDataDir: string };
type Response = { ok: true; result: { previewPdfPath: string } } | { ok: false; code: string; message: string };

function parseArgs(args: string[]): Args {
  const projectIdIndex = args.indexOf("--project-id");
  const userDataIndex = args.indexOf("--user-data-dir");
  if (projectIdIndex === -1 || userDataIndex === -1) throw new Error("Missing required args: --project-id and --user-data-dir");
  const projectId = args[projectIdIndex + 1];
  const userDataDir = args[userDataIndex + 1];
  if (!projectId || !userDataDir) throw new Error("Invalid args: project-id or user-data-dir missing");
  return { projectId, userDataDir };
}

async function run(): Promise<Response> {
  const { projectId, userDataDir } = parseArgs(argv.slice(2));
  const projectPath = path.join(userDataDir, "projects", `${projectId}.json`);
  const rawProject = await loadJsonFile<ProjectJson>(projectPath);
  const project = normalizeProject(rawProject);
  const repo = await loadRepository({ userDataRoot: userDataDir });
  const vm = buildDocument(project, repo);
  validateDocument(vm);

  const tmpDir = path.join(userDataDir, "tmp");
  await mkdir(tmpDir, { recursive: true });
  const previewPdfPath = path.join(tmpDir, `preview_${projectId}.pdf`);
  await renderPdf(vm, { outFile: previewPdfPath });
  return { ok: true, result: { previewPdfPath } };
}

run().then((response) => { console.log(JSON.stringify(response)); exit(0); }).catch((err) => {
  console.log(JSON.stringify({ ok: false, code: "PREVIEW_FAILED", message: err instanceof Error ? err.message : "Unknown preview error" } satisfies Response));
  exit(0);
});
