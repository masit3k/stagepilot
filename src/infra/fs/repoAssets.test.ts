import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { loadRepository } from "./repo.js";

const tmpDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tmpDirs.splice(0).map(async (dir) => {
      await fs.rm(dir, { recursive: true, force: true });
    }),
  );
});

async function makeUserDataRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "stagepilot-user-data-"));
  tmpDirs.push(root);
  await fs.mkdir(path.join(root, "projects"), { recursive: true });
  return root;
}

describe("loadRepository assets paths", () => {
  it("loads group presets, monitor presets, and notes templates from data/assets", async () => {
    const userDataRoot = await makeUserDataRoot();
    const repo = await loadRepository({
      userDataRoot,
      dataRoot: path.resolve("data"),
    });

    const bassPreset = repo.getPreset("el_bass_xlr_amp") as { group: string };
    const migratedBassPreset = repo.getPreset("el_bass_xlr") as { id: string };
    const drumsPreset = repo.getPreset("standard-9") as { id: string };
    const monitorPreset = repo.getPreset("wedge") as { type: string };
    const notesTemplate = repo.getNotesTemplate("notes_default_cs");

    expect(bassPreset.group).toBe("bass");
    expect(migratedBassPreset.id).toBe("el_bass_xlr_amp");
    expect(drumsPreset.id).toBe("standard-9");
    expect(monitorPreset.type).toBe("monitor");
    expect(notesTemplate.id).toBe("notes_default_cs");
  });
});
