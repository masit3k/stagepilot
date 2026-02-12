import path from "node:path";
import { argv, exit } from "node:process";
import { readdir } from "node:fs/promises";
import { loadJsonFile } from "../src/infra/fs/loadJson.js";
import type { ProjectJson } from "../src/domain/model/types.js";
import { exportProjectPdf } from "../src/app/usecases/exportPdf.js";
import { ExportLockedError } from "../src/app/usecases/publishExportPdf.js";

type Args = {
  projectId: string;
  userDataDir: string;
};

type ExportResponse =
  | { ok: true; result: unknown }
  | {
      ok: false;
      code: string;
      message: string;
      exportPdfPath?: string;
      versionPdfPath?: string;
    };

function parseArgs(args: string[]): Args {
  const projectIdIndex = args.indexOf("--project-id");
  const userDataIndex = args.indexOf("--user-data-dir");
  if (projectIdIndex === -1 || userDataIndex === -1) {
    throw new Error("Missing required args: --project-id and --user-data-dir");
  }

  const projectId = args[projectIdIndex + 1];
  const userDataDir = args[userDataIndex + 1];
  if (!projectId || !userDataDir) {
    throw new Error("Invalid args: project-id or user-data-dir missing");
  }

  return { projectId, userDataDir };
}

async function run(): Promise<ExportResponse> {
  const { projectId, userDataDir } = parseArgs(argv.slice(2));
  const projectPath = await resolveProjectPathById(path.join(userDataDir, "projects"), projectId);
  const project = await loadJsonFile<ProjectJson>(projectPath);

  try {
    const result = await exportProjectPdf({ userDataDir, project });
    return { ok: true, result };
  } catch (err) {
    if (err instanceof ExportLockedError) {
      return {
        ok: false,
        code: "EXPORT_LOCKED",
        message: "Export PDF is open/locked. Close it and retry. Version saved in versions.",
        exportPdfPath: err.exportPath,
        versionPdfPath: err.versionPdfPath,
      };
    }
    const message = err instanceof Error ? err.message : "Unknown export error";
    return { ok: false, code: "EXPORT_FAILED", message };
  }
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
    const message = err instanceof Error ? err.message : "Unknown export error";
    const response: ExportResponse = {
      ok: false,
      code: "EXPORT_FAILED",
      message,
    };
    console.log(JSON.stringify(response));
    exit(0);
  });
