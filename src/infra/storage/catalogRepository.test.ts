import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { loadCatalogRepository } from "./catalogRepository.js";
import { catalogPathsForRoot } from "./catalogPaths.js";

const tmpDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tmpDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
  tmpDirs.length = 0;
});

async function makeTempRoot(prefix: string): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  tmpDirs.push(root);
  return root;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

describe("loadCatalogRepository source policy", () => {
  it("loads runtime entities from user data but built-in presets from data assets", async () => {
    const userDataRoot = await makeTempRoot("stagepilot-catalog-user-");
    const dataRoot = await makeTempRoot("stagepilot-catalog-assets-");
    const paths = catalogPathsForRoot(userDataRoot);

    await writeJson(path.join(paths.projects, "runtime-project.json"), {
      id: "runtime-project",
      bandRef: "runtime-band",
      purpose: "generic",
      documentDate: "2026-05-29",
    });
    await writeJson(path.join(paths.bands, "runtime-band.json"), {
      id: "runtime-band",
      name: "Runtime Band",
      bandLeader: "runtime-bass",
      defaultLineup: { bass: ["runtime-bass"] },
      defaultOverlays: { leadVocals: [], backVocals: [] },
    });
    await writeJson(
      path.join(paths.musicians, "bass", "runtime-bass.json"),
      {
        id: "runtime-bass",
        firstName: "Runtime",
        lastName: "Bass",
        group: "bass",
        presets: [],
      },
    );
    await writeJson(path.join(paths.templatesNotes, "runtime-notes.json"), {
      id: "runtime-notes",
      lang: "cs",
      inputs: [{ id: "runtime-input-note", text: "Runtime note" }],
      monitors: [],
    });

    await writeJson(
      path.join(
        dataRoot,
        "assets",
        "presets",
        "groups",
        "bass",
        "asset_bass.json",
      ),
      {
        type: "preset",
        id: "asset_bass",
        label: "Built-in asset bass preset",
        group: "bass",
        inputs: [
          {
            key: "asset_bass",
            label: "Built-in asset bass input",
            group: "bass",
          },
        ],
      },
    );
    await writeJson(
      path.join(
        dataRoot,
        "assets",
        "presets",
        "monitors",
        "asset_monitor.json",
      ),
      {
        type: "monitor",
        id: "asset_monitor",
        label: "Built-in asset monitor",
      },
    );

    await writeJson(
      path.join(paths.presetsGroups, "bass", "asset_bass.json"),
      {
        type: "preset",
        id: "asset_bass",
        label: "STALE AppData bass preset",
        group: "bass",
        inputs: [
          {
            key: "asset_bass",
            label: "STALE AppData bass input",
            group: "bass",
          },
        ],
      },
    );
    await writeJson(path.join(paths.presetsMonitors, "asset_monitor.json"), {
      type: "monitor",
      id: "asset_monitor",
      label: "STALE AppData monitor",
    });

    const repo = await loadCatalogRepository({ userDataRoot, dataRoot });

    expect(repo.getProject("runtime-project").bandRef).toBe("runtime-band");
    expect(repo.getBand("runtime-band").name).toBe("Runtime Band");
    expect(repo.getMusician("runtime-bass").firstName).toBe("Runtime");
    expect(repo.getNotesTemplate("runtime-notes").inputs[0]?.text).toBe(
      "Runtime note",
    );

    expect(repo.getPreset("asset_bass")).toMatchObject({
      type: "preset",
      id: "asset_bass",
      label: "Built-in asset bass preset",
    });
    expect(repo.getPreset("asset_monitor")).toMatchObject({
      type: "monitor",
      id: "asset_monitor",
      label: "Built-in asset monitor",
    });
  });
});
