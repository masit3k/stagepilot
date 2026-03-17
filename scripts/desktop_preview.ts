import { Console } from "node:console";
import { mkdir } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { argv, exit } from "node:process";
import { loadDefaultContactLine } from "../src/app/usecases/exportPdf.js";
import { normalizeProject } from "../src/app/usecases/normalizeProject.js";
import type { ProjectJson } from "../src/domain/model/types.js";
import { buildDocument } from "../src/domain/pipeline/buildDocument.js";
import { formatProjectSlug } from "../src/domain/projectNaming.js";
import { validateDocument } from "../src/domain/rules/validateDocument.js";
import { loadJsonFile } from "../src/infra/fs/loadJson.js";
import { loadRepository } from "../src/infra/fs/repo.js";
import { renderPdf } from "../src/infra/pdf/pdf.js";

type Args = {
  projectId: string;
  userDataDir: string;
  hideMusicianNames: boolean;
};
type Response =
  | { ok: true; result: { previewPdfPath: string } }
  | { ok: false; code: string; message: string };

type PreviewLogger = (message: string, details?: unknown) => void;
type ScriptIo = { stdout: NodeJS.WriteStream; stderr: NodeJS.WriteStream };

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

async function run(args: string[], log: PreviewLogger): Promise<Response> {
  const { projectId, userDataDir, hideMusicianNames } = parseArgs(args);
  log("[pdf-preview] start", { projectId, userDataDir, hideMusicianNames });

  const projectsDir = path.join(userDataDir, "projects");
  log("[pdf-preview] resolve project path start", { projectsDir, projectId });
  const projectPath = await resolveProjectPathById(projectsDir, projectId);
  log("[pdf-preview] resolve project path success", { projectPath });

  const rawProject = await loadJsonFile<ProjectJson>(projectPath);
  log("[pdf-preview] project json loaded", {
    bandRef: rawProject.bandRef,
    id: rawProject.id,
  });
  const project = normalizeProject(rawProject);
  log("[pdf-preview] project normalized", {
    id: project.id,
    bandRef: project.bandRef,
  });

  log("[pdf-preview] repository load start");
  const repo = await loadRepository({ userDataRoot: userDataDir });
  log("[pdf-preview] repository load success");

  const band = repo.getBand(project.bandRef);
  log("[pdf-preview] band resolved", {
    bandId: band.id,
    defaultContactId: band.defaultContactId,
  });

  log("[pdf-preview] buildDocument start");
  const vm = buildDocument(project, repo);
  log("[pdf-preview] buildDocument success", { inputCount: vm.inputs.length });

  log("[pdf-preview] validateDocument start");
  validateDocument(vm);
  log("[pdf-preview] validateDocument success");

  log("[pdf-preview] contact line resolve start");
  const contactLine = await loadDefaultContactLine(
    band.defaultContactId,
    band,
    repo,
    userDataDir,
  );
  log("[pdf-preview] contact line resolve success", {
    hasContactLine: Boolean(contactLine),
  });

  const tmpDir = path.join(userDataDir, "temp");
  await mkdir(tmpDir, { recursive: true });
  const slug = project.slug ?? formatProjectSlug(project, band);
  const previewPdfPath = path.join(tmpDir, `preview_${slug}.pdf`);

  log("[pdf-preview] template render start", { previewPdfPath });
  await renderPdf(vm, {
    outFile: previewPdfPath,
    contactLine,
    stageplan: { hideMusicianNames },
  });
  log("[pdf-preview] template render success", { previewPdfPath });

  return { ok: true, result: { previewPdfPath } };
}

async function resolveProjectPathById(
  projectsDir: string,
  projectId: string,
): Promise<string> {
  const files = await readdir(projectsDir);
  for (const fileName of files) {
    if (!fileName.endsWith(".json")) continue;
    const candidatePath = path.join(projectsDir, fileName);
    const json = await loadJsonFile<ProjectJson>(candidatePath);
    if (json.id === projectId) return candidatePath;
  }
  throw new Error(`Project not found: ${projectId}`);
}

function writeJsonPayload(io: ScriptIo, response: Response): void {
  io.stdout.write(`${JSON.stringify(response)}\n`);
}

export async function main(
  args: string[] = argv.slice(2),
  io: ScriptIo = { stdout: process.stdout, stderr: process.stderr },
  runner: (runArgs: string[], log: PreviewLogger) => Promise<Response> = run,
): Promise<number> {
  const scriptConsole = new Console({ stdout: io.stdout, stderr: io.stderr });
  const log: PreviewLogger = (message, details) => {
    if (details === undefined) {
      scriptConsole.error(message);
      return;
    }
    scriptConsole.error(message, details);
  };

  try {
    const response = await runner(args, log);
    writeJsonPayload(io, response);
    return 0;
  } catch (err) {
    if (err instanceof Error) {
      scriptConsole.error("[preview-script] failed", {
        cwd: process.cwd(),
        message: err.message,
        stack: err.stack,
        cause: err.cause,
      });
    } else {
      scriptConsole.error("[preview-script] failed", {
        cwd: process.cwd(),
        error: String(err),
      });
    }
    writeJsonPayload(io, {
      ok: false,
      code: "PREVIEW_FAILED",
      message: err instanceof Error ? err.message : "Unknown preview error",
    });
    return 0;
  }
}

if (
  process.argv[1] &&
  import.meta.url === new URL(process.argv[1], "file://").href
) {
  main().then((code) => exit(code));
}
