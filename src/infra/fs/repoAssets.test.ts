import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { loadRepository } from "./repo.js";
import defaultNotesTemplate from "../storage/defaultNotesTemplate.notes_default_cs.json";

const tmpDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tmpDirs.map(async (dir) => {
      await fs.rm(dir, { recursive: true, force: true });
    }),
  );
});

async function makeUserDataRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "stagepilot-user-data-"));
  tmpDirs.push(root);
  await fs.mkdir(path.join(root, "projects"), { recursive: true });
  await fs.mkdir(path.join(root, "catalog", "bands"), { recursive: true });
  await fs.mkdir(path.join(root, "catalog", "musicians", "bass"), { recursive: true });
  await fs.mkdir(path.join(root, "catalog", "contacts"), { recursive: true });
  await fs.mkdir(path.join(root, "catalog", "templates", "notes"), { recursive: true });
  await fs.writeFile(
    path.join(root, "catalog", "bands", "pl.json"),
    JSON.stringify({ id: "pl", code: "PL", name: "Praise Leaders", defaultLineup: {} }),
    "utf8",
  );
  await fs.writeFile(
    path.join(root, "catalog", "musicians", "bass", "m1.json"),
    JSON.stringify({ id: "m1", group: "bass", name: "M1" }),
    "utf8",
  );
  await fs.writeFile(
    path.join(root, "catalog", "contacts", "c1.json"),
    JSON.stringify({ id: "c1", firstName: "C", lastName: "One" }),
    "utf8",
  );
  await fs.writeFile(
    path.join(root, "catalog", "templates", "notes", "notes_default_cs.json"),
    `${JSON.stringify(defaultNotesTemplate, null, 2)}\n`,
    "utf8",
  );
  return root;
}

describe("loadRepository split sources", () => {
  it("loads presets from repo assets and notes templates from AppData", async () => {
    const userDataRoot = await makeUserDataRoot();
    const repo = await loadRepository({ userDataRoot });

    const bassPreset = repo.getPreset("el_bass_xlr_amp") as { group: string };
    const migratedBassPreset = repo.getPreset("el_bass_xlr") as { id: string };
    const drumInputPreset = repo.getPreset("el_guitar_mic") as { id: string };
    const monitorPreset = repo.getPreset("wedge") as { type: string };
    const notesTemplate = repo.getNotesTemplate("notes_default_cs");

    expect(bassPreset.group).toBe("bass");
    expect(migratedBassPreset.id).toBe("el_bass_xlr_amp");
    expect(drumInputPreset.id).toBe("el_guitar_mic");
    expect(monitorPreset.type).toBe("monitor");
    expect(notesTemplate.id).toBe("notes_default_cs");
  });

  it("loads notes template from AppData even when data root has no notes assets", async () => {
    const userDataRoot = await makeUserDataRoot();
    const emptyDataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "stagepilot-empty-data-root-"));
    tmpDirs.push(emptyDataRoot);

    const repo = await loadRepository({ userDataRoot, dataRoot: "data" });
    expect(repo.getNotesTemplate("notes_default_cs").id).toBe("notes_default_cs");

    await expect(loadRepository({ userDataRoot, dataRoot: emptyDataRoot })).rejects.toThrow();
  });

  it("ignores stale AppData preset copies", async () => {
    const userDataRoot = await makeUserDataRoot();
    const stalePresetPath = path.join(
      userDataRoot,
      "catalog",
      "presets",
      "groups",
      "vocs",
      "vocal_lead_no_mic.json",
    );
    await fs.mkdir(path.dirname(stalePresetPath), { recursive: true });
    const stalePreset = {
      id: "vocal_lead_no_mic",
      type: "group",
      group: "vocs",
      inputs: [{ key: "voc_lead", note: "STALE_FROM_APPDATA" }],
    };
    await fs.writeFile(stalePresetPath, `${JSON.stringify(stalePreset, null, 2)}\n`, "utf8");

    const repo = await loadRepository({ userDataRoot });
    const preset = repo.getPreset("vocal_lead_no_mic") as {
      inputs?: Array<{ note?: string }>;
    };

    expect(preset.inputs?.[0]?.note).toBe(
      "BETA 58A, SE V7, SM58 – boom mic stand (provided by FOH)",
    );
  });

  it("fails when requested notes template is missing in AppData", async () => {
    const userDataRoot = await makeUserDataRoot();
    await fs.rm(path.join(userDataRoot, "catalog", "templates", "notes", "notes_default_cs.json"));
    const repo = await loadRepository({ userDataRoot });

    expect(() => repo.getNotesTemplate("notes_default_cs")).toThrow(
      "NotesTemplate not found: notes_default_cs",
    );
  });
});
