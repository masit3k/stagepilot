import path from "node:path";
import { mkdir } from "node:fs/promises";

import { loadRepository } from "../../infra/fs/repo.js";
import { DATA_ROOT, USER_DATA_ROOT } from "../../infra/fs/dataRoot.js";
import { loadJsonFile } from "../../infra/fs/loadJson.js";
import { buildDocument } from "../../domain/pipeline/buildDocument.js";
import { validateDocument } from "../../domain/rules/validateDocument.js";
import { renderPdf } from "../../infra/pdf/pdf.js";

export interface ExportPdfResult {
  pdfPath: string;
}

type ContactEntity = {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
};

function safeFilePart(s: string): string {
  // allow letters, numbers, underscore, dash (keep case)
  return s.replaceAll(/[^a-zA-Z0-9_-]+/g, "_");
}

function formatDateDdMmYyyy(isoDate: string): string {
  // expects YYYY-MM-DD
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) throw new Error(`Invalid project date (expected YYYY-MM-DD): ${isoDate}`);
  const [, yyyy, mm, dd] = m;
  return `${dd}-${mm}-${yyyy}`;
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
  const band = repo.getBand(project.bandRef);

  const vm = buildDocument(project, repo);
  validateDocument(vm);

  const contactLine = await loadDefaultContactLine(band.defaultContactId);

  const bandCode = band.code && band.code.trim() !== "" ? band.code : band.id;
  const datePart = formatDateDdMmYyyy(resolveProjectDate(project));

  const outDir = path.resolve(USER_DATA_ROOT, "exports");
  await mkdir(outDir, { recursive: true });

  const fileName = `${safeFilePart(bandCode)}_Inputlist_StagePlan_${datePart}.pdf`;
  const pdfPath = path.join(outDir, fileName);

  await renderPdf(vm, { outFile: pdfPath, contactLine });

  return { pdfPath };
}
