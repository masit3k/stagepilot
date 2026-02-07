import fs from "node:fs/promises";
import path from "node:path";

import { PROJECT_ROOT, USER_DATA_ROOT } from "./dataRoot.js";

export type ProjectSnapshotMeta = {
  schemaVersion: 1;
  projectId: string;
  versionId: string;
  generatedAt: string; // ISO datetime
  documentDate: string; // YYYY-MM-DD
  purpose?: "event" | "generic";
  bandRef: string;
  title?: string | null;
  eventDate?: string;
  eventVenue?: string;
  pdfFileName: string;
  paths: {
    versionDir: string;
    projectJson: string;
    metaJson: string;
    pdf: string;
  };
};

type CreateProjectVersionArgs = {
  project: unknown;
  projectId: string;
  pdfBytes: Uint8Array;
  pdfFileName: string;
  meta: Omit<
    ProjectSnapshotMeta,
    "schemaVersion" | "versionId" | "pdfFileName" | "paths"
  >;
};

const VERSIONS_ROOT = path.resolve(USER_DATA_ROOT, "versions");

export async function createProjectVersion(
  args: CreateProjectVersionArgs
): Promise<ProjectSnapshotMeta> {
  const baseVersionId = formatVersionId(new Date());
  const { versionId, versionDir } = await ensureUniqueVersionDir(args.projectId, baseVersionId);

  await fs.mkdir(versionDir, { recursive: true });

  const projectJsonPath = path.join(versionDir, "project.json");
  const metaJsonPath = path.join(versionDir, "meta.json");
  const pdfPath = path.join(versionDir, "document.pdf");

  await fs.writeFile(projectJsonPath, JSON.stringify(args.project, null, 2));
  await fs.writeFile(pdfPath, args.pdfBytes);

  const paths = buildPaths(versionDir, {
    projectJsonPath,
    metaJsonPath,
    pdfPath,
  });

  const meta: ProjectSnapshotMeta = {
    ...args.meta,
    schemaVersion: 1,
    projectId: args.projectId,
    versionId,
    pdfFileName: args.pdfFileName,
    paths,
  };

  await fs.writeFile(metaJsonPath, JSON.stringify(meta, null, 2));

  return meta;
}

export async function listProjectVersions(
  projectId: string
): Promise<ProjectSnapshotMeta[]> {
  const projectDir = path.join(VERSIONS_ROOT, projectId);

  if (!(await pathExists(projectDir))) {
    return [];
  }

  const entries = await fs.readdir(projectDir, { withFileTypes: true });
  const metas = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const metaPath = path.join(projectDir, entry.name, "meta.json");
        const raw = await fs.readFile(metaPath, "utf8");
        return JSON.parse(raw) as ProjectSnapshotMeta;
      })
  );

  return metas.sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
}

export async function loadProjectVersion(
  projectId: string,
  versionId: string
): Promise<{
  meta: ProjectSnapshotMeta;
  project: unknown;
  pdfPath: string;
}> {
  const versionDir = path.join(VERSIONS_ROOT, projectId, versionId);
  const metaPath = path.join(versionDir, "meta.json");
  const projectPath = path.join(versionDir, "project.json");
  const pdfPath = path.join(versionDir, "document.pdf");

  const metaRaw = await fs.readFile(metaPath, "utf8");
  const projectRaw = await fs.readFile(projectPath, "utf8");

  return {
    meta: JSON.parse(metaRaw) as ProjectSnapshotMeta,
    project: JSON.parse(projectRaw) as unknown,
    pdfPath,
  };
}

function buildPaths(
  versionDir: string,
  files: {
    projectJsonPath: string;
    metaJsonPath: string;
    pdfPath: string;
  }
): ProjectSnapshotMeta["paths"] {
  return {
    versionDir: toRelative(versionDir),
    projectJson: toRelative(files.projectJsonPath),
    metaJson: toRelative(files.metaJsonPath),
    pdf: toRelative(files.pdfPath),
  };
}

function toRelative(absPath: string): string {
  return path.relative(PROJECT_ROOT, absPath).split(path.sep).join("/");
}

function formatVersionId(date: Date): string {
  const yyyy = date.getUTCFullYear();
  const mm = pad2(date.getUTCMonth() + 1);
  const dd = pad2(date.getUTCDate());
  const hh = pad2(date.getUTCHours());
  const min = pad2(date.getUTCMinutes());
  const ss = pad2(date.getUTCSeconds());
  const ms = String(date.getUTCMilliseconds()).padStart(3, "0");
  return `${yyyy}${mm}${dd}-${hh}${min}${ss}-${ms}`;
}

async function ensureUniqueVersionDir(projectId: string, baseVersionId: string): Promise<{
  versionId: string;
  versionDir: string;
}> {
  let versionId = baseVersionId;
  let versionDir = path.join(VERSIONS_ROOT, projectId, versionId);
  let counter = 0;

  while (await pathExists(versionDir)) {
    counter += 1;
    versionId = `${baseVersionId}-${counter}`;
    versionDir = path.join(VERSIONS_ROOT, projectId, versionId);
  }

  return { versionId, versionDir };
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.stat(target);
    return true;
  } catch {
    return false;
  }
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}
