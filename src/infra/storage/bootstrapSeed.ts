// NOTE: Desktop runtime bootstrap authority lives in Tauri/Rust (packages/desktop/src-tauri/src/storage_paths.rs).
// This helper is kept only for Node-side tests/scripts and must not be used by desktop runtime startup.
import fs from "node:fs/promises";
import path from "node:path";
import { catalogPaths } from "./catalogPaths.js";
import defaultNotesTemplate from "./defaultNotesTemplate.notes_default_cs.json";

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

async function ensureDefaultNotesTemplate(templatesNotesDir: string): Promise<void> {
  const filePath = path.join(templatesNotesDir, "notes_default_cs.json");
  await fs.mkdir(templatesNotesDir, { recursive: true });
  await fs.access(filePath).catch(async () => {
    await fs.writeFile(filePath, `${JSON.stringify(defaultNotesTemplate, null, 2)}\n`, "utf8");
  });
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
  await ensureDefaultNotesTemplate(p.templatesNotes);
}
