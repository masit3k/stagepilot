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
  pdfSourcePath: string;
  pdfFileName: string;
  meta: Omit<
    ProjectSnapshotMeta,
    "schemaVersion" | "versionId" | "pdfFileName" | "paths"
  >;
  versionId?: string;
  versionDir?: string;
  userDataRoot?: string;
  projectRoot?: string;
};

const VERSIONS_ROOT = path.resolve(USER_DATA_ROOT, "versions");

export async function createProjectVersion(
  args: CreateProjectVersionArgs
): Promise<ProjectSnapshotMeta> {
  const versionsRoot = resolveVersionsRoot(args.userDataRoot);
  const projectRoot = args.projectRoot ?? PROJECT_ROOT;
  let versionId = args.versionId;
  let versionDir = args.versionDir;

  if (!versionDir) {
    const prepared = await ensureUniqueVersionDir(
      versionsRoot,
      args.projectId,
      versionId ?? formatVersionId(new Date())
    );
    versionId = prepared.versionId;
    versionDir = prepared.versionDir;
  }

  if (!versionId) {
    versionId = path.basename(versionDir);
  }

  await fs.mkdir(versionDir, { recursive: true });

  const projectJsonPath = path.join(versionDir, "project.json");
  const metaJsonPath = path.join(versionDir, "meta.json");
  const pdfPath = path.join(versionDir, args.pdfFileName);

  await fs.writeFile(projectJsonPath, JSON.stringify(args.project, null, 2));
  if (path.resolve(args.pdfSourcePath) !== path.resolve(pdfPath)) {
    await fs.copyFile(args.pdfSourcePath, pdfPath);
  }

  const paths = buildPaths(projectRoot, versionDir, {
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
  projectId: string,
  userDataRoot?: string
): Promise<ProjectSnapshotMeta[]> {
  const versionsRoot = resolveVersionsRoot(userDataRoot);
  const projectDir = path.join(versionsRoot, projectId);

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
  versionId: string,
  userDataRoot?: string
): Promise<{
  meta: ProjectSnapshotMeta;
  project: unknown;
  pdfPath: string;
}> {
  const versionsRoot = resolveVersionsRoot(userDataRoot);
  const versionDir = path.join(versionsRoot, projectId, versionId);
  const metaPath = path.join(versionDir, "meta.json");
  const projectPath = path.join(versionDir, "project.json");

  const metaRaw = await fs.readFile(metaPath, "utf8");
  const projectRaw = await fs.readFile(projectPath, "utf8");
  const meta = JSON.parse(metaRaw) as ProjectSnapshotMeta;
  const pdfPath = path.join(versionDir, meta.pdfFileName);

  return {
    meta,
    project: JSON.parse(projectRaw) as unknown,
    pdfPath,
  };
}

function buildPaths(
  projectRoot: string,
  versionDir: string,
  files: {
    projectJsonPath: string;
    metaJsonPath: string;
    pdfPath: string;
  }
): ProjectSnapshotMeta["paths"] {
  return {
    versionDir: toRelative(projectRoot, versionDir),
    projectJson: toRelative(projectRoot, files.projectJsonPath),
    metaJson: toRelative(projectRoot, files.metaJsonPath),
    pdf: toRelative(projectRoot, files.pdfPath),
  };
}

function toRelative(projectRoot: string, absPath: string): string {
  return path.relative(projectRoot, absPath).split(path.sep).join("/");
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

export async function prepareVersionDir(
  projectId: string,
  userDataRoot?: string,
  baseVersionId: string = formatVersionId(new Date())
): Promise<{
  versionId: string;
  versionDir: string;
}> {
  const versionsRoot = resolveVersionsRoot(userDataRoot);
  const { versionId, versionDir } = await ensureUniqueVersionDir(
    versionsRoot,
    projectId,
    baseVersionId
  );
  await fs.mkdir(versionDir, { recursive: true });
  return { versionId, versionDir };
}

async function ensureUniqueVersionDir(
  versionsRoot: string,
  projectId: string,
  baseVersionId: string
): Promise<{
  versionId: string;
  versionDir: string;
}> {
  let versionId = baseVersionId;
  let versionDir = path.join(versionsRoot, projectId, versionId);
  let counter = 0;

  while (await pathExists(versionDir)) {
    counter += 1;
    versionId = `${baseVersionId}-${counter}`;
    versionDir = path.join(versionsRoot, projectId, versionId);
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

function resolveVersionsRoot(userDataRoot?: string): string {
  const root = userDataRoot ? path.resolve(userDataRoot) : USER_DATA_ROOT;
  return path.resolve(root, "versions");
}
