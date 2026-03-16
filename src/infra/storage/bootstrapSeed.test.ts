import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { bootstrapSeed } from "./bootstrapSeed.js";

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
    path.join("assets", "presets", "monitors"),
    path.join("assets", "templates", "notes"),
  ]) {
    await fs.mkdir(path.join(seedRoot, folder), { recursive: true });
  }
  await fs.cp(
    path.resolve("data", "assets", "presets", "groups"),
    path.join(seedRoot, "assets", "presets", "groups"),
    { recursive: true },
  );
  return seedRoot;
}

describe("bootstrapSeed seeded preset note migration", () => {
  it("updates stale seeded no-mic and talkback note text while keeping unrelated presets unchanged", async () => {
    const root = await makeRoot();
    const seedRoot = await makeSeedRoot();

    await bootstrapSeed({ root, seedRoot });

    const leadPath = path.join(
      root,
      "catalog",
      "presets",
      "groups",
      "vocs",
      "vocal_lead_no_mic.json",
    );
    const backPath = path.join(
      root,
      "catalog",
      "presets",
      "groups",
      "vocs",
      "vocal_back_no_mic.json",
    );
    const talkbackPath = path.join(
      root,
      "catalog",
      "presets",
      "groups",
      "talkback",
      "talkback.json",
    );
    const unaffectedPath = path.join(
      root,
      "catalog",
      "presets",
      "groups",
      "vocs",
      "vocal_lead_wired.json",
    );

    const oldText =
      "BETA 58A, SE V7, SM58 – boom mic stand (requested from sound engineer)";
    const expectedText =
      "BETA 58A, SE V7, SM58 – boom mic stand (provided by FOH)";

    const leadPreset = JSON.parse(await fs.readFile(leadPath, "utf8")) as {
      inputs: Array<{ key: string; note?: string }>;
    };
    leadPreset.inputs[0].note = oldText;
    await fs.writeFile(
      leadPath,
      `${JSON.stringify(leadPreset, null, 2)}\n`,
      "utf8",
    );

    const backPreset = JSON.parse(await fs.readFile(backPath, "utf8")) as {
      input: { key: string; note?: string };
    };
    backPreset.input.note = oldText;
    await fs.writeFile(
      backPath,
      `${JSON.stringify(backPreset, null, 2)}\n`,
      "utf8",
    );

    const talkbackPreset = JSON.parse(
      await fs.readFile(talkbackPath, "utf8"),
    ) as { input: { key: string; note?: string } };
    talkbackPreset.input.note = oldText;
    await fs.writeFile(
      talkbackPath,
      `${JSON.stringify(talkbackPreset, null, 2)}\n`,
      "utf8",
    );

    const unaffectedBefore = await fs.readFile(unaffectedPath, "utf8");

    await bootstrapSeed({ root, seedRoot });

    const migratedLead = JSON.parse(await fs.readFile(leadPath, "utf8")) as {
      inputs: Array<{ note?: string }>;
    };
    const migratedBack = JSON.parse(await fs.readFile(backPath, "utf8")) as {
      input: { note?: string };
    };
    const migratedTalkback = JSON.parse(
      await fs.readFile(talkbackPath, "utf8"),
    ) as { input: { note?: string } };
    const unaffectedAfter = await fs.readFile(unaffectedPath, "utf8");

    expect(migratedLead.inputs[0].note).toBe(expectedText);
    expect(migratedBack.input.note).toBe(expectedText);
    expect(migratedTalkback.input.note).toBe(expectedText);
    expect(unaffectedAfter).toBe(unaffectedBefore);
  });

  it("is idempotent when note text is already canonical", async () => {
    const root = await makeRoot();
    const seedRoot = await makeSeedRoot();

    await bootstrapSeed({ root, seedRoot });

    const leadPath = path.join(
      root,
      "catalog",
      "presets",
      "groups",
      "vocs",
      "vocal_lead_no_mic.json",
    );
    const first = await fs.readFile(leadPath, "utf8");

    await bootstrapSeed({ root, seedRoot });

    const second = await fs.readFile(leadPath, "utf8");
    expect(second).toBe(first);
  });
});
