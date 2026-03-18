import fs from "node:fs/promises";
import path from "node:path";
import { validateCanonicalBandModel } from "../../src/domain/model/bandLineup.js";
import type { Band } from "../../src/domain/model/types.js";
import { listJsonFiles } from "../../src/infra/fs/loadTree.js";

export type BandMigrationResult = {
  bandId: string;
  filePath: string;
  isValidCanonicalModel: boolean;
  issues: string[];
};

export async function migrateBandsDefaultLineupVocs(args: {
  bandsRoot: string;
}): Promise<BandMigrationResult[]> {
  const { bandsRoot } = args;
  const bandFiles = await listJsonFiles(bandsRoot);
  const results: BandMigrationResult[] = [];

  for (const file of bandFiles) {
    const parsed = JSON.parse(await fs.readFile(file, "utf8")) as Band & {
      id?: unknown;
    };
    const bandId = typeof parsed.id === "string" && parsed.id.trim() ? parsed.id.trim() : path.basename(file, ".json");
    const issues: string[] = [];
    try {
      validateCanonicalBandModel(parsed);
    } catch (error) {
      issues.push(error instanceof Error ? error.message : String(error));
    }

    results.push({
      bandId,
      filePath: file,
      isValidCanonicalModel: issues.length === 0,
      issues,
    });
  }

  return results.sort((a, b) => a.bandId.localeCompare(b.bandId, "en"));
}
