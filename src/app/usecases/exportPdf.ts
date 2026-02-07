import path from "node:path";
import { access, mkdir } from "node:fs/promises";
import { loadRepository } from "../../infra/fs/repo.js";
import { DATA_ROOT, USER_DATA_ROOT } from "../../infra/fs/dataRoot.js";
import { loadJsonFile } from "../../infra/fs/loadJson.js";
import { createProjectVersion, prepareVersionDir } from "../../infra/fs/versionStore.js";
import { getGeneratedAtUtc } from "../../infra/time/today.js";
import { buildDocument } from "../../domain/pipeline/buildDocument.js";
import { validateDocument } from "../../domain/rules/validateDocument.js";
import { renderPdf } from "../../infra/pdf/pdf.js";
import { normalizeProject } from "./normalizeProject.js";
import type { Project, ProjectJson } from "../../domain/model/types.js";

export interface ExportPdfResult {
  pdfPath: string;
  versionId: string;
  versionPath: string;
}

type ContactEntity = {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
};

function sanitizeFileName(name: string): string {
  const normalized = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const withoutSpaces = normalized.replace(/\s+/g, "_");
  const sanitized = withoutSpaces.replace(/[^A-Za-z0-9._-]/g, "_").replace(/_+/g, "_");
  const withExt = sanitized.toLowerCase().endsWith(".pdf") ? sanitized : `${sanitized}.pdf`;

  if (withExt.length <= 80) return withExt;

  const ext = ".pdf";
  const base = withExt.slice(0, Math.max(0, withExt.length - ext.length));
  return `${base.slice(0, 80 - ext.length)}${ext}`;
}

function formatDateForFileName(iso: string): string {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) {
    throw new Error(`Invalid ISO date for filename: ${iso}`);
  }
  return `${day}-${month}-${year}`;
}

type ProjectDateSource = {
  purpose?: "event" | "generic";
  eventDate?: string;
  documentDate?: string;
  date?: string;
};

function resolveProjectDate(project: ProjectDateSource): string {
  if (project.purpose === "event") {
    if (project.eventDate) return project.eventDate;
    throw new Error("Missing eventDate for event project");
  }

  if (project.purpose === "generic") {
    if (project.documentDate) return project.documentDate;
    throw new Error("Missing documentDate for generic project");
  }

  if (project.date) return project.date;
  if (project.documentDate) return project.documentDate;

  throw new Error("Missing project date");
}

function formatCzPhone(phoneRaw: string): string {
  const s = phoneRaw.trim();

  // "+420731247870" -> "+ 420 731 247 870"
  const m = /^\+420(\d{9})$/.exec(s);
  if (m) {
    const digits = m[1];
    return `+ 420 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`;
  }

  // fallback: keep as-is
  return s;
}

async function loadDefaultContactLine(defaultContactId?: string): Promise<string | undefined> {
  if (!defaultContactId) return undefined;

  const contactPath = path.resolve(DATA_ROOT, "contacts", `${defaultContactId}.json`);
  const c = await loadJsonFile<ContactEntity>(contactPath);

  const first = (c.firstName ?? "").trim();
  const last = (c.lastName ?? "").trim();
  if (!first && !last) {
    throw new Error(`Invalid contact (missing firstName/lastName): ${defaultContactId}`);
  }

  const name = `${first} ${last}`.trim();

  const phone = c.phone ? formatCzPhone(c.phone) : "";
  const email = c.email ? c.email.trim() : "";

  // formát přesně dle zadání:
  // "Kontaktní osoba – (kapelník) [first_name] [last_name], [tel], [mail]"
  // (pokud některé pole chybí, vynecháme ho i s čárkou)
  const parts: string[] = [];
  if (phone) parts.push(phone);
  if (email) parts.push(email);

  const tail = parts.length ? `, ${parts.join(", ")}` : "";
  return `Kontaktní osoba – (kapelník) ${name}${tail}`;
}

export async function exportPdf(projectId: string): Promise<ExportPdfResult> {
  const repo = await loadRepository();
  const project = repo.getProject(projectId);
  return exportPdfFromProject(projectId, project, USER_DATA_ROOT);
}
export async function exportPdfFromProjectFile(
  projectPath: string,
  outDir: string
): Promise<ExportPdfResult> {
  const rawProject = await loadJsonFile<ProjectJson>(projectPath);
  const project = normalizeProject(rawProject);
  return exportPdfFromProject(project.id, project, outDir);
}
async function exportPdfFromProject(
  projectId: string,
  project: Project,
  outDir: string
): Promise<ExportPdfResult> {
  if (project.id !== projectId) {
    throw new Error(`Project id mismatch: ${projectId} vs ${project.id}`);
  }
  const repo = await loadRepository({ userDataRoot: outDir });
  const band = repo.getBand(project.bandRef);

  const vm = buildDocument(project, repo);
  validateDocument(vm);

  if (vm.meta.logoFile) {
    const logoPath = path.resolve(process.cwd(), vm.meta.logoFile);
    try {
      await access(logoPath);
    } catch {
      throw new Error(`Logo file not found: ${vm.meta.logoFile}`);
    }
  }

  const contactLine = await loadDefaultContactLine(band.defaultContactId);

  let pdfFileName: string;
  if (project.purpose === "generic") {
    const year = project.documentDate.slice(0, 4);
    pdfFileName = sanitizeFileName(`BK_Inputlist_Stageplan_${year}.pdf`);
  } else {
    const bandCode = band.code?.trim() || project.bandRef;
    const pdfDate = formatDateForFileName(project.eventDate ?? resolveProjectDate(project));
    const pdfVenue = project.eventVenue?.trim() || "event";
    const pdfBaseName = `${bandCode}_Inputlist_Stageplan_${pdfDate}_${pdfVenue}`;
    pdfFileName = sanitizeFileName(`${pdfBaseName}.pdf`);
  }

  const { versionId, versionDir } = await prepareVersionDir(projectId, outDir);
  const pdfPath = path.join(versionDir, pdfFileName);

  await mkdir(versionDir, { recursive: true });
  await renderPdf(vm, { outFile: pdfPath, contactLine });

  const meta = await createProjectVersion({
    project,
    projectId,
    pdfSourcePath: pdfPath,
    pdfFileName,
    versionId,
    versionDir,
    userDataRoot: outDir,
    meta: {
      projectId,
      generatedAt: getGeneratedAtUtc(),
      documentDate: project.documentDate,
      bandRef: project.bandRef,
      purpose: project.purpose,
      title: project.title ?? null,
      eventDate: project.eventDate,
      eventVenue: project.eventVenue,
    },
  });

  const versionPath = path.resolve(versionDir);

  return { pdfPath, versionId: meta.versionId, versionPath };
}
