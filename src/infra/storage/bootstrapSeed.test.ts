import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { bootstrapSeed } from "./bootstrapSeed.js";
import defaultNotesTemplate from "./defaultNotesTemplate.notes_default_cs.json";

const tmpDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tmpDirs
      .splice(0)
      .map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});

async function makeRoot(): Promise<string> {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "stagepilot-bootstrap-seed-"),
  );
  tmpDirs.push(root);
  return root;
}

async function makeSeedRoot(): Promise<string> {
  const seedRoot = await fs.mkdtemp(path.join(os.tmpdir(), "stagepilot-seed-"));
  tmpDirs.push(seedRoot);
  for (const folder of [
    "bands",
    "musicians",
    "contacts",
  ]) {
    await fs.mkdir(path.join(seedRoot, folder), { recursive: true });
  }
  await fs.writeFile(
    path.join(seedRoot, "bands", "b1.json"),
    JSON.stringify({ id: "b1", name: "Band 1" }),
    "utf8",
  );
  return seedRoot;
}

describe("bootstrapSeed", () => {
  it("seeds user/library data and appdata notes template but not presets", async () => {
    const root = await makeRoot();
    const seedRoot = await makeSeedRoot();

    await bootstrapSeed({ root, seedRoot });

    await expect(
      fs.access(path.join(root, "catalog", "bands", "b1.json")),
    ).resolves.toBeUndefined();
    const notesPath = path.join(root, "catalog", "templates", "notes", "notes_default_cs.json");
    await expect(fs.access(notesPath)).resolves.toBeUndefined();
    const notes = JSON.parse(await fs.readFile(notesPath, "utf8"));
    expect(notes).toEqual(defaultNotesTemplate);
    await expect(
      fs.access(path.join(root, "catalog", "presets", "groups")),
    ).rejects.toBeTruthy();
    await expect(
      fs.access(path.join(root, "catalog", "presets", "monitors")),
    ).rejects.toBeTruthy();
  });

  it("does not overwrite existing appdata notes template", async () => {
    const root = await makeRoot();
    const seedRoot = await makeSeedRoot();
    const notesPath = path.join(root, "catalog", "templates", "notes", "notes_default_cs.json");
    await fs.mkdir(path.dirname(notesPath), { recursive: true });
    await fs.writeFile(notesPath, "{\"id\":\"notes_default_cs\",\"lang\":\"cs\",\"inputs\":[]}", "utf8");

    await bootstrapSeed({ root, seedRoot });

    const result = await fs.readFile(notesPath, "utf8");
    expect(result).toBe("{\"id\":\"notes_default_cs\",\"lang\":\"cs\",\"inputs\":[]}");
  });
});
