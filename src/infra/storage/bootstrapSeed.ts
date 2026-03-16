// NOTE: Desktop runtime bootstrap authority lives in Tauri/Rust (packages/desktop/src-tauri/src/storage_paths.rs).
// This helper is kept only for Node-side tests/scripts and must not be used by desktop runtime startup.
import fs from "node:fs/promises";
import path from "node:path";
import { catalogPaths } from "./catalogPaths.js";

type PresetNoteMigrationTarget = {
  groupPath: string;
  inputKey: string;
  note: string;
};

const SEEDED_PRESET_NOTE_MIGRATIONS: Record<string, PresetNoteMigrationTarget> =
  {
    vocal_lead_no_mic: {
      groupPath: path.join("vocs", "vocal_lead_no_mic.json"),
      inputKey: "voc_lead",
      note: "BETA 58A, SE V7, SM58 – boom mic stand (provided by FOH)",
    },
    vocal_back_no_mic: {
      groupPath: path.join("vocs", "vocal_back_no_mic.json"),
      inputKey: "voc_back_{ownerKey}",
      note: "BETA 58A, SE V7, SM58 – boom mic stand (provided by FOH)",
    },
    talkback: {
      groupPath: path.join("talkback", "talkback.json"),
      inputKey: "tb_{ownerKey}",
      note: "BETA 58A, SE V7, SM58 – boom mic stand (provided by FOH)",
    },
  };

async function copyJsonTreeIfMissing(from: string, to: string): Promise<void> {
  const entries = await fs.readdir(from, { withFileTypes: true });
  await fs.mkdir(to, { recursive: true });
  for (const entry of entries) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) {
      await copyJsonTreeIfMissing(src, dst);
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      await fs.access(dst).catch(async () => fs.copyFile(src, dst));
    }
  }
}

async function migrateSeededPresetNotes(
  presetsGroupsRoot: string,
): Promise<void> {
  for (const [presetId, target] of Object.entries(
    SEEDED_PRESET_NOTE_MIGRATIONS,
  )) {
    const filePath = path.join(presetsGroupsRoot, target.groupPath);
    const content = await fs.readFile(filePath, "utf8").catch(() => null);
    if (!content) continue;

    const preset = JSON.parse(content) as {
      id?: string;
      input?: { key?: string; note?: string };
      inputs?: Array<{ key?: string; note?: string }>;
    };
    if (preset.id !== presetId) continue;

    let changed = false;
    if (
      preset.input &&
      preset.input.key === target.inputKey &&
      preset.input.note !== target.note
    ) {
      preset.input.note = target.note;
      changed = true;
    }
    if (Array.isArray(preset.inputs)) {
      for (const input of preset.inputs) {
        if (input.key === target.inputKey && input.note !== target.note) {
          input.note = target.note;
          changed = true;
        }
      }
    }
    if (changed) {
      await fs.writeFile(
        filePath,
        `${JSON.stringify(preset, null, 2)}\n`,
        "utf8",
      );
    }
  }
}

export async function bootstrapSeed({
  root,
  seedRoot,
}: { root: string; seedRoot: string }) {
  const p = catalogPaths(root);
  await fs.mkdir(p.projects, { recursive: true });
  await fs.mkdir(p.exports, { recursive: true });
  await fs.mkdir(p.temp, { recursive: true });
  await fs.mkdir(p.versions, { recursive: true });
  await copyJsonTreeIfMissing(path.join(seedRoot, "bands"), p.bands);
  await copyJsonTreeIfMissing(path.join(seedRoot, "musicians"), p.musicians);
  await copyJsonTreeIfMissing(path.join(seedRoot, "contacts"), p.contacts);
  await copyJsonTreeIfMissing(
    path.join(seedRoot, "assets", "presets", "groups"),
    p.presetsGroups,
  );
  await copyJsonTreeIfMissing(
    path.join(seedRoot, "assets", "presets", "monitors"),
    p.presetsMonitors,
  );
  await copyJsonTreeIfMissing(
    path.join(seedRoot, "assets", "templates", "notes"),
    p.templatesNotes,
  );
  await migrateSeededPresetNotes(p.presetsGroups);
}
