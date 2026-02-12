import fs from "node:fs/promises";
import path from "node:path";

import { isFileLockedError } from "../../infra/fs/fileErrors.js";
import { replaceFileAtomic } from "../../infra/fs/replaceFileAtomic.js";

export class ExportLockedError extends Error {
  exportPath: string;
  versionPdfPath: string;

  constructor(exportPath: string, versionPdfPath: string) {
    super("PDF is open; close it and retry. New version saved to versions.");
    this.name = "ExportLockedError";
    this.exportPath = exportPath;
    this.versionPdfPath = versionPdfPath;
  }
}

async function resolveAvailableExportPath(
  exportRoot: string,
  pdfFileName: string,
): Promise<string> {
  const ext = path.extname(pdfFileName);
  const base = ext ? pdfFileName.slice(0, -ext.length) : pdfFileName;

  let candidate = path.join(exportRoot, pdfFileName);
  let suffix = 2;
  while (true) {
    try {
      await fs.access(candidate);
      candidate = path.join(exportRoot, `${base}__${suffix}${ext}`);
      suffix += 1;
    } catch {
      return candidate;
    }
  }
}

export async function publishExportPdf(args: {
  sourcePdfPath: string;
  exportRoot: string;
  pdfFileName: string;
}): Promise<{ exportPdfPath: string; exportUpdated: boolean }> {
  const exportPdfPath = await resolveAvailableExportPath(
    args.exportRoot,
    args.pdfFileName,
  );

  try {
    await replaceFileAtomic(args.sourcePdfPath, exportPdfPath);
  } catch (err) {
    if (isFileLockedError(err)) {
      throw new ExportLockedError(exportPdfPath, args.sourcePdfPath);
    }
    throw err;
  }

  return { exportPdfPath, exportUpdated: true };
}
