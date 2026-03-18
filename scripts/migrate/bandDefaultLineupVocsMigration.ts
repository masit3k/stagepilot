import fs from "node:fs/promises";
import path from "node:path";
import { migrateBandDefaultLineupVocs } from "../../src/domain/model/defaultLineupVocs.js";
import { listJsonFiles } from "../../src/infra/fs/loadTree.js";

export type BandMigrationResult = {
  bandId: string;
  filePath: string;
  addedVocalMembers: string[];
  changed: boolean;
};

export async function loadMusicianGroupsById(musiciansRoot: string): Promise<Map<string, string>> {
  const files = await listJsonFiles(musiciansRoot);
  const map = new Map<string, string>();

  for (const file of files) {
    const parsed = JSON.parse(await fs.readFile(file, "utf8")) as {
      id?: unknown;
      group?: unknown;
    };
    if (typeof parsed.id !== "string" || !parsed.id.trim()) continue;
    if (typeof parsed.group !== "string" || !parsed.group.trim()) continue;
    map.set(parsed.id.trim(), parsed.group.trim());
  }

  return map;
}

export async function migrateBandsDefaultLineupVocs(args: {
  bandsRoot: string;
  musiciansRoot: string;
  writeChanges?: boolean;
}): Promise<BandMigrationResult[]> {
  const { bandsRoot, musiciansRoot, writeChanges = false } = args;
  const musicianGroupsById = await loadMusicianGroupsById(musiciansRoot);
  const bandFiles = await listJsonFiles(bandsRoot);
  const results: BandMigrationResult[] = [];

  for (const file of bandFiles) {
    const parsed = JSON.parse(await fs.readFile(file, "utf8")) as {
      id?: unknown;
      defaultLineup?: Record<string, unknown>;
    };
    const bandId = typeof parsed.id === "string" && parsed.id.trim() ? parsed.id.trim() : path.basename(file, ".json");
    const defaultLineup = (parsed.defaultLineup ?? {}) as Record<string, unknown>;

    const migrated = migrateBandDefaultLineupVocs({
      defaultLineup,
      resolveMusicianGroup: (musicianId) => {
        const group = musicianGroupsById.get(musicianId);
        return group === "drums" || group === "bass" || group === "guitar" || group === "keys" || group === "vocs" || group === "talkback"
          ? group
          : undefined;
      },
    });

    if (migrated.changed && writeChanges) {
      await fs.writeFile(
        file,
        `${JSON.stringify({ ...parsed, defaultLineup: migrated.defaultLineup }, null, 2)}\n`,
        "utf8",
      );
    }

    results.push({
      bandId,
      filePath: file,
      addedVocalMembers: migrated.addedVocalMembers,
      changed: migrated.changed,
    });
  }

  return results.sort((a, b) => a.bandId.localeCompare(b.bandId, "en"));
}
