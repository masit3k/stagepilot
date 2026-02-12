import { mkdir } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { argv, exit } from "node:process";
import { loadDefaultContactLine } from "../src/app/usecases/exportPdf.js";
import { normalizeProject } from "../src/app/usecases/normalizeProject.js";
import type { ProjectJson } from "../src/domain/model/types.js";
import { formatProjectSlug } from "../src/domain/projectNaming.js";
import { buildDocument } from "../src/domain/pipeline/buildDocument.js";
import { validateDocument } from "../src/domain/rules/validateDocument.js";
import { loadJsonFile } from "../src/infra/fs/loadJson.js";
import { loadRepository } from "../src/infra/fs/repo.js";
import { renderPdf } from "../src/infra/pdf/pdf.js";

type Args = { projectId: string; userDataDir: string };
type Response =
  | { ok: true; result: { previewPdfPath: string } }
  | { ok: false; code: string; message: string };

function parseArgs(args: string[]): Args {
  const projectIdIndex = args.indexOf("--project-id");
  const userDataIndex = args.indexOf("--user-data-dir");
  if (projectIdIndex === -1 || userDataIndex === -1)
    throw new Error("Missing required args: --project-id and --user-data-dir");
  const projectId = args[projectIdIndex + 1];
  const userDataDir = args[userDataIndex + 1];
  if (!projectId || !userDataDir)
    throw new Error("Invalid args: project-id or user-data-dir missing");
  return { projectId, userDataDir };
}

async function run(): Promise<Response> {
  const { projectId, userDataDir } = parseArgs(argv.slice(2));
  const projectsDir = path.join(userDataDir, "projects");
  const projectPath = await resolveProjectPathById(projectsDir, projectId);
  const rawProject = await loadJsonFile<ProjectJson>(projectPath);
  const project = normalizeProject(rawProject);
  const repo = await loadRepository({ userDataRoot: userDataDir });
  const band = repo.getBand(project.bandRef);
  const vm = buildDocument(project, repo);
  validateDocument(vm);
  const contactLine = await loadDefaultContactLine(
    band.defaultContactId,
    band,
    repo,
  );

  const tmpDir = path.join(userDataDir, "temp");
  await mkdir(tmpDir, { recursive: true });
  const slug = project.slug ?? formatProjectSlug(project, band);
  // Uses slug (human doc key), not id (UUID).
  const previewPdfPath = path.join(tmpDir, `preview_${slug}.pdf`);
  await renderPdf(vm, { outFile: previewPdfPath, contactLine });
  return { ok: true, result: { previewPdfPath } };
}

async function resolveProjectPathById(projectsDir: string, projectId: string): Promise<string> {
  const files = await readdir(projectsDir);
  for (const fileName of files) {
    if (!fileName.endsWith(".json")) continue;
    const candidatePath = path.join(projectsDir, fileName);
    const json = await loadJsonFile<ProjectJson>(candidatePath);
    if (json.id === projectId) return candidatePath;
  }
  throw new Error(`Project not found: ${projectId}`);
}

run()
  .then((response) => {
    console.log(JSON.stringify(response));
    exit(0);
  })
  .catch((err) => {
    if (err instanceof Error) {
      console.error("[preview-script] failed", {
        cwd: process.cwd(),
        message: err.message,
        stack: err.stack,
        cause: err.cause,
      });
    } else {
      console.error("[preview-script] failed", { cwd: process.cwd(), error: String(err) });
    }
    console.log(
      JSON.stringify({
        ok: false,
        code: "PREVIEW_FAILED",
        message: err instanceof Error ? err.message : "Unknown preview error",
      } satisfies Response),
    );
    exit(0);
  });
