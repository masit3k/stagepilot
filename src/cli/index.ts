import { exportPdf, exportPdfFromProjectFile } from "../app/usecases/exportPdf.js";
import { generateDocument } from "../app/usecases/generateDocument.js";
import {
  listProjectVersions,
  loadProjectVersion,
} from "../infra/fs/versionStore.js";
import { mkdir, appendFile, readFile, copyFile } from "node:fs/promises";
import path from "node:path";

function getProjectId(args: string[]): string | undefined {
  const idx = args.indexOf("--project");
  if (idx >= 0) return args[idx + 1];

  const first = args.find((a) => !a.startsWith("-"));
  return first;
}

function argValue(args: string[], key: string): string | undefined {
  const idx = args.indexOf(key);
  if (idx >= 0) return args[idx + 1];
  return undefined;
}

type CliResult =
  | {
      ok: true;
      projectId: string;
      versionId: string;
      versionDir: string;
      pdfPath: string;
      metaPath: string;
      projectPath: string;
      logPath?: string;
      warnings: string[];
    }
  | {
      ok: false;
      errorCode: "VALIDATION_ERROR" | "LAYOUT_OVERFLOW" | "IO_ERROR" | "ENGINE_ERROR";
      message: string;
      details?: Record<string, unknown>;
      logPath?: string;
    };

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === "generate") {
    const result = await handleGenerate(args.slice(1));
    console.log(JSON.stringify(result));
    return;
  }

  const projectId = getProjectId(args);
  const wantPdf = args.includes("--pdf");
  const wantJson = args.includes("--json");

  const wantsVersions = args.includes("--versions");
  const versionsProjectId = argValue(args, "--versions");
  if (wantsVersions) {
    if (!versionsProjectId) {
      console.error("Usage: --versions <projectId> [--json]");
      process.exit(1);
    }
    const versions = await listProjectVersions(versionsProjectId);
    if (wantJson) {
      console.log(JSON.stringify(versions, null, 2));
      return;
    }

    for (const v of versions) {
      const eventDate = v.eventDate ?? "-";
      const eventVenue = v.eventVenue ?? "-";
      const purpose = v.purpose ?? "-";
      console.log(
        [
          v.versionId,
          v.documentDate,
          eventDate,
          eventVenue,
          v.bandRef,
          purpose,
          v.pdfFileName,
        ].join("  ")
      );
    }
    return;
  }

  const wantsShowVersion = args.includes("--show-version");
  const showProjectId = argValue(args, "--show-version");
  if (wantsShowVersion) {
    if (!showProjectId) {
      console.error("Usage: --show-version <projectId> <versionId> [--json]");
      process.exit(1);
    }
    const showIdx = args.indexOf("--show-version");
    const versionId = showIdx >= 0 ? args[showIdx + 2] : undefined;
    if (!versionId) {
      console.error("Usage: --show-version <projectId> <versionId> [--json]");
      process.exit(1);
    }

    const { meta } = await loadProjectVersion(showProjectId, versionId);
    if (wantJson) {
      console.log(JSON.stringify(meta, null, 2));
      return;
    }

    const eventDate = meta.eventDate ?? "-";
    const eventVenue = meta.eventVenue ?? "-";
    const purpose = meta.purpose ?? "-";
    console.log(`projectId: ${meta.projectId}`);
    console.log(`versionId: ${meta.versionId}`);
    console.log(`documentDate: ${meta.documentDate}`);
    console.log(`generatedAt: ${meta.generatedAt}`);
    console.log(`purpose: ${purpose}`);
    console.log(`bandRef: ${meta.bandRef}`);
    console.log(`eventDate: ${eventDate}`);
    console.log(`eventVenue: ${eventVenue}`);
    console.log(`pdf: ${meta.paths.pdf}`);
    console.log(`projectJson: ${meta.paths.projectJson}`);
    console.log(`metaJson: ${meta.paths.metaJson}`);
    return;
  }

  if (!projectId) {
    console.error("Usage:");
    console.error("  npm run dev:export -- --project <id> [--pdf]");
    console.error("  npm run dev:export -- <id> [--pdf]");
    console.error("  npm run dev:export -- --versions <projectId> [--json]");
    console.error("  npm run dev:export -- --show-version <projectId> <versionId> [--json]");
    process.exit(1);
  }

  if (wantPdf) {
    const { pdfPath, versionId, versionPath } = await exportPdf(projectId);
    console.log(
      JSON.stringify({ ok: true, projectId, pdfPath, versionId, versionPath }, null, 2)
    );
    return;
  }

  const vm = await generateDocument(projectId);
  console.log(JSON.stringify(vm, null, 2));
}

async function handleGenerate(args: string[]): Promise<CliResult> {
  const projectPath = argValue(args, "--project");
  const outDir = argValue(args, "--outDir");

  if (!projectPath || !outDir) {
    return {
      ok: false,
      errorCode: "IO_ERROR",
      message: "Missing required arguments --project and --outDir.",
    };
  }

  const absOutDir = path.resolve(outDir);
  await mkdir(absOutDir, { recursive: true });

  const logDir = path.join(absOutDir, "logs");
  await mkdir(logDir, { recursive: true });
  const logPath = path.join(logDir, `generate-${Date.now()}.log.txt`);

  const log = async (line: string) => {
    await appendFile(logPath, `${line}\n`);
  };

  try {
    await log(`generate start: project=${projectPath}`);
    const result = await exportPdfFromProjectFile(projectPath, absOutDir);
    const versionDir = path.resolve(result.versionPath);
    const metaPath = path.join(versionDir, "meta.json");
    const projectJsonPath = path.join(versionDir, "project.json");
    const pdfPath = path.resolve(result.pdfPath);
    const projectId = await readProjectId(projectJsonPath);
    const versionLogPath = path.join(versionDir, "log.txt");
    await copyFile(logPath, versionLogPath);
    await log(`generate success: version=${result.versionId}`);

    return {
      ok: true,
      projectId,
      versionId: result.versionId,
      versionDir: toRelative(versionDir),
      pdfPath: toRelative(pdfPath),
      metaPath: toRelative(metaPath),
      projectPath: toRelative(projectJsonPath),
      logPath: toRelative(versionLogPath),
      warnings: [],
    };
  } catch (err) {
    const errorInfo = classifyError(err);
    await log(`generate error: ${errorInfo.message}`);
    if (err instanceof Error && err.stack) {
      await log(err.stack);
    }

    return {
      ok: false,
      errorCode: errorInfo.code,
      message: errorInfo.message,
      details: errorInfo.details,
      logPath: toRelative(logPath),
    };
  }
}

function classifyError(err: unknown): {
  code: "VALIDATION_ERROR" | "LAYOUT_OVERFLOW" | "IO_ERROR" | "ENGINE_ERROR";
  message: string;
  details?: Record<string, unknown>;
} {
  if (err instanceof Error) {
    const message = err.message || "Unknown error";
    if (/PDF overflow/i.test(message)) {
      return { code: "LAYOUT_OVERFLOW", message };
    }
    if (/Too many inputs|No inputs|Duplicate input|Missing|Invalid/i.test(message)) {
      return { code: "VALIDATION_ERROR", message };
    }
    const anyErr = err as NodeJS.ErrnoException;
    if (anyErr.code) {
      return { code: "IO_ERROR", message, details: { code: anyErr.code } };
    }
    return { code: "ENGINE_ERROR", message };
  }

  return {
    code: "ENGINE_ERROR",
    message: "Unknown error",
  };
}

function toRelative(absPath: string): string {
  return path.relative(process.cwd(), absPath).split(path.sep).join("/");
}

async function readProjectId(projectJsonPath: string): Promise<string> {
  const raw = await readFile(projectJsonPath, "utf8");
  const parsed = JSON.parse(raw) as { id?: string };
  if (!parsed.id || typeof parsed.id !== "string") {
    throw new Error("Missing project id in project.json.");
  }
  return parsed.id;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
