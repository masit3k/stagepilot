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
import { publishExportPdf } from "./publishExportPdf.js";
import { normalizeProject } from "./normalizeProject.js";
import { isBandLeader } from "../../domain/model/bandLeader.js";
import type { Band, Project, ProjectJson } from "../../domain/model/types.js";
import type { DataRepository } from "../../infra/fs/repo.js";

export interface ExportPdfResult {
  versionPdfPath: string;
  exportPdfPath: string;
  exportUpdated: boolean;
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

export function formatContactLine(args: {
  contact: ContactEntity;
  band: Band;
  contactMusicianId?: string;
}): string {
  const { contact, band, contactMusicianId } = args;

  const first = (contact.firstName ?? "").trim();
  const last = (contact.lastName ?? "").trim();
  if (!first && !last) {
    throw new Error(`Invalid contact (missing firstName/lastName): ${contact.id}`);
  }

  const name = `${first} ${last}`.trim();

  const phone = contact.phone ? formatCzPhone(contact.phone) : "";
  const email = contact.email ? contact.email.trim() : "";

  // formát přesně dle zadání:
  // "Kontaktní osoba – (band leader) [first_name] [last_name], [tel], [mail]"
  // (pokud některé pole chybí, vynecháme ho i s čárkou)
  const parts: string[] = [];
  if (phone) parts.push(phone);
  if (email) parts.push(email);

  const tail = parts.length ? `, ${parts.join(", ")}` : "";
  const leaderSuffix =
    contactMusicianId && isBandLeader(band, contactMusicianId) ? " (band leader)" : "";
  return `Kontaktní osoba –${leaderSuffix} ${name}${tail}`;
}

function resolveContactMusicianId(
  contactId: string,
  repo: DataRepository
): string | undefined {
  try {
    repo.getMusician(contactId);
    return contactId;
  } catch {
    return undefined;
  }
}

async function loadDefaultContactLine(
  defaultContactId: string | undefined,
  band: Band,
  repo: DataRepository
): Promise<string | undefined> {
  if (!defaultContactId) return undefined;

  const contactPath = path.resolve(DATA_ROOT, "contacts", `${defaultContactId}.json`);
  const contact = await loadJsonFile<ContactEntity>(contactPath);
  const contactMusicianId = resolveContactMusicianId(defaultContactId, repo);

  return formatContactLine({ contact, band, contactMusicianId });
}

export async function exportPdf(projectId: string): Promise<ExportPdfResult> {
  const repo = await loadRepository();
  const project = normalizeProject(repo.getProject(projectId) as ProjectJson);
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

export async function exportProjectPdf(args: {
  userDataDir: string;
  project: ProjectJson;
}): Promise<ExportPdfResult> {
  const project = normalizeProject(args.project);
  return exportPdfFromProject(project.id, project, args.userDataDir);
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

  const contactLine = await loadDefaultContactLine(band.defaultContactId, band, repo);

  const pdfFileName = `${project.id}.pdf`;

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
      note: project.note ?? null,
      eventDate: project.eventDate,
      eventVenue: project.eventVenue,
    },
  });

  const versionPath = path.resolve(versionDir);
  const { exportPdfPath, exportUpdated } = await publishExportPdf({
    sourcePdfPath: pdfPath,
    exportRoot: path.resolve(outDir, "exports"),
    pdfFileName,
  });

  return {
    versionPdfPath: pdfPath,
    exportPdfPath,
    exportUpdated,
    versionId: meta.versionId,
    versionPath,
  };
}
