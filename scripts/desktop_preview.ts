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

type Args = { projectId: string; userDataDir: string; hideMusicianNames: boolean };
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
  const hideMusicianNames = args.includes("--hide-musician-names");
  return { projectId, userDataDir, hideMusicianNames };
}

async function run(): Promise<Response> {
  const { projectId, userDataDir, hideMusicianNames } = parseArgs(argv.slice(2));
  console.info("[pdf-preview] start", { projectId, userDataDir, hideMusicianNames });

  const projectsDir = path.join(userDataDir, "projects");
  console.info("[pdf-preview] resolve project path start", { projectsDir, projectId });
  const projectPath = await resolveProjectPathById(projectsDir, projectId);
  console.info("[pdf-preview] resolve project path success", { projectPath });

  const rawProject = await loadJsonFile<ProjectJson>(projectPath);
  console.info("[pdf-preview] project json loaded", { bandRef: rawProject.bandRef, id: rawProject.id });
  const project = normalizeProject(rawProject);
  console.info("[pdf-preview] project normalized", { id: project.id, bandRef: project.bandRef });

  console.info("[pdf-preview] repository load start");
  const repo = await loadRepository({ userDataRoot: userDataDir });
  console.info("[pdf-preview] repository load success");

  const band = repo.getBand(project.bandRef);
  console.info("[pdf-preview] band resolved", { bandId: band.id, defaultContactId: band.defaultContactId });

  console.info("[pdf-preview] buildDocument start");
  const vm = buildDocument(project, repo);
  console.info("[pdf-preview] buildDocument success", { inputCount: vm.inputs.length });

  console.info("[pdf-preview] validateDocument start");
  validateDocument(vm);
  console.info("[pdf-preview] validateDocument success");

  console.info("[pdf-preview] contact line resolve start");
  const contactLine = await loadDefaultContactLine(
    band.defaultContactId,
    band,
    repo,
    userDataDir,
  );
  console.info("[pdf-preview] contact line resolve success", { hasContactLine: Boolean(contactLine) });

  const tmpDir = path.join(userDataDir, "temp");
  await mkdir(tmpDir, { recursive: true });
  const slug = project.slug ?? formatProjectSlug(project, band);
  const previewPdfPath = path.join(tmpDir, `preview_${slug}.pdf`);

  console.info("[pdf-preview] template render start", { previewPdfPath });
  await renderPdf(vm, {
    outFile: previewPdfPath,
    contactLine,
    stageplan: { hideMusicianNames },
  });
  console.info("[pdf-preview] template render success", { previewPdfPath });

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
