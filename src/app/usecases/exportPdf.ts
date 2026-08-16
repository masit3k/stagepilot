import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { stderr } from "node:process";
import type { Project, ProjectJson } from "../../domain/model/types.js";
import {
  formatProjectSlug,
} from "../../domain/projectNaming.js";
import { buildDocument } from "../../domain/pipeline/buildDocument.js";
import { validateDocument } from "../../domain/rules/validateDocument.js";
import { USER_DATA_ROOT } from "../../infra/fs/dataRoot.js";
import { catalogPathsForRoot } from "../../infra/storage/catalogPaths.js";
import { loadJsonFile } from "../../infra/fs/loadJson.js";
import { loadRepository } from "../../infra/fs/repo.js";
import {
  createProjectVersion,
  prepareVersionDir,
} from "../../infra/fs/versionStore.js";
import { renderPdf } from "../../infra/pdf/pdf.js";
import type { PdfContact } from "../../infra/pdf/template.js";
import type { StageplanRenderOptions } from "../../infra/pdf/stageplanRenderOptions.js";
import { getGeneratedAtUtc } from "../../infra/time/today.js";
import { normalizeProject } from "./normalizeProject.js";
import { publishExportPdf } from "./publishExportPdf.js";

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
}): PdfContact {
  const { contact } = args;

  const first = (contact.firstName ?? "").trim();
  const last = (contact.lastName ?? "").trim();
  if (!first && !last) {
    throw new Error(
      `Invalid contact (missing firstName/lastName): ${contact.id}`,
    );
  }

  const phone = contact.phone ? formatCzPhone(contact.phone) : "";
  const email = contact.email ? contact.email.trim() : "";

  // "Kontaktní osoba · Jméno Příjmení · + 420 …", e-mail zvlášť (R12).
  // Vsuvka o kapelníkovi mizí bez náhrady: kapelnictví značí jediné místo,
  // řádek v boxu, a kontaktní osoba navíc nemusí být hudebník (R13).
  const parts = ["Kontaktní osoba", `${first} ${last}`.trim()];
  if (phone) parts.push(phone);

  return { text: parts.join(" · "), email: email || null };
}

export async function loadDefaultContact(
  defaultContactId: string | undefined,
  runtimeRoot: string,
): Promise<PdfContact | undefined> {
  if (!defaultContactId) return undefined;

  const contactPath = path.resolve(
    catalogPathsForRoot(runtimeRoot).contacts,
    `${defaultContactId}.json`,
  );
  const contact = await loadJsonFile<ContactEntity>(contactPath);

  return formatContactLine({ contact });
}

export async function exportPdf(projectId: string): Promise<ExportPdfResult> {
  const repo = await loadRepository();
  const project = normalizeProject(repo.getProject(projectId) as ProjectJson);
  return exportPdfFromProject(projectId, project, USER_DATA_ROOT);
}
export async function exportPdfFromProjectFile(
  projectPath: string,
  outDir: string,
): Promise<ExportPdfResult> {
  const rawProject = await loadJsonFile<ProjectJson>(projectPath);
  const project = normalizeProject(rawProject);
  return exportPdfFromProject(project.id, project, outDir);
}

export async function exportProjectPdf(args: {
  userDataDir: string;
  project: ProjectJson;
  stageplan?: Partial<StageplanRenderOptions>;
}): Promise<ExportPdfResult> {
  const project = normalizeProject(args.project);
  return exportPdfFromProject(project.id, project, args.userDataDir, args.stageplan);
}
async function exportPdfFromProject(
  projectId: string,
  project: Project,
  outDir: string,
  stageplan?: Partial<StageplanRenderOptions>,
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

  const contact = await loadDefaultContact(band.defaultContactId, outDir);

  const slug = project.slug ?? formatProjectSlug(project, band);
  stderr.write(`project=${projectId} slug=${slug}\n`);
  // Uses slug (human doc key), not id (UUID).
  const pdfFileName = `${slug}.pdf`;

  const { versionId, versionDir } = await prepareVersionDir(projectId, outDir);
  const pdfPath = path.join(versionDir, pdfFileName);

  await mkdir(versionDir, { recursive: true });
  await renderPdf(vm, { outFile: pdfPath, contact, stageplan });

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
      slug,
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
