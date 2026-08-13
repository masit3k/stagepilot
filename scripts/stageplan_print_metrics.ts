import { Console } from "node:console";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { argv, exit } from "node:process";
import { pathToFileURL } from "node:url";
import { normalizeProject } from "../src/app/usecases/normalizeProject.js";
import type { ProjectJson } from "../src/domain/model/types.js";
import { buildDocument } from "../src/domain/pipeline/buildDocument.js";
import { buildStageplanPrintMetrics } from "../src/domain/pipeline/pdf/buildStageplanPrintMetrics.js";
import type { StageplanPrintGeometry } from "../src/domain/stageplan/print/printMetrics.js";
import { loadJsonFile } from "../src/infra/fs/loadJson.js";
import { loadRepository } from "../src/infra/fs/repo.js";
import { stageplanPrintGeometry } from "../src/infra/pdf/sections/stageplan.js";

type Args = { projectId: string; userDataDir: string };
type ErrorPayload = { message: string; stack?: string; phase: string };
type Response =
  | { ok: true; result: StageplanPrintGeometry }
  | { ok: false; code: string; message: string; error: ErrorPayload };
type ScriptIo = { stdout: NodeJS.WriteStream; stderr: NodeJS.WriteStream };
type MetricsLogger = (message: string, details?: unknown) => void;

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

async function run(args: string[], log: MetricsLogger): Promise<Response> {
  const { projectId, userDataDir } = parseArgs(args);
  log("[stageplan-metrics] start", { projectId });

  const projectsDir = path.join(userDataDir, "projects");
  const projectPath = await resolveProjectPathById(projectsDir, projectId);
  const rawProject = await loadJsonFile<ProjectJson>(projectPath);
  const project = normalizeProject(rawProject);

  log("[stageplan-metrics] load repository");
  const repo = await loadRepository({ userDataRoot: userDataDir });

  log("[stageplan-metrics] buildDocument");
  const vm = buildDocument(project, repo);

  return {
    ok: true,
    result: {
      area: stageplanPrintGeometry.area,
      typography: stageplanPrintGeometry.typography,
      blocks: buildStageplanPrintMetrics(vm.stageplan),
    },
  };
}

function writeJsonPayload(io: ScriptIo, response: Response): void {
  io.stdout.write(`${JSON.stringify(response)}\n`);
}

function toErrorResponse(err: unknown, phase: string): Response {
  const message = err instanceof Error ? err.message : "Unknown metrics error";
  return {
    ok: false,
    code: "STAGEPLAN_METRICS_FAILED",
    message,
    error: {
      message,
      stack: err instanceof Error ? err.stack : undefined,
      phase,
    },
  };
}

export async function main(
  args: string[] = argv.slice(2),
  io: ScriptIo = { stdout: process.stdout, stderr: process.stderr },
  runner: (runArgs: string[], log: MetricsLogger) => Promise<Response> = run,
): Promise<number> {
  const scriptConsole = new Console({ stdout: io.stdout, stderr: io.stderr });
  let phase = "start";
  const log: MetricsLogger = (message, details) => {
    const match = /^\[stageplan-metrics\]\s+(.+)$/.exec(message);
    if (match?.[1]) phase = match[1];
    if (details === undefined) {
      scriptConsole.error(message);
      return;
    }
    scriptConsole.error(message, details);
  };

  try {
    writeJsonPayload(io, await runner(args, log));
    return 0;
  } catch (err) {
    scriptConsole.error("[stageplan-metrics] failed", {
      cwd: process.cwd(),
      phase,
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      cause: err instanceof Error ? err.cause : undefined,
    });
    writeJsonPayload(io, toErrorResponse(err, phase));
    return 0;
  }
}

export function isExecutedAsMainModule(
  argvEntryPoint: string | undefined = process.argv[1],
  moduleUrl: string = import.meta.url,
): boolean {
  if (!argvEntryPoint) return false;
  return moduleUrl === pathToFileURL(argvEntryPoint).href;
}

if (isExecutedAsMainModule()) {
  main()
    .then((code) => exit(code))
    .catch((err) => {
      process.stderr.write(
        `[stageplan-metrics] unhandled failure ${
          err instanceof Error ? (err.stack ?? err.message) : String(err)
        }\n`,
      );
      process.stdout.write(
        `${JSON.stringify(toErrorResponse(err, "entrypoint"))}\n`,
      );
      exit(0);
    });
}
