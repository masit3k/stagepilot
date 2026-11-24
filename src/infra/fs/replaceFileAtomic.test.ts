import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { replaceFileAtomic } from "./replaceFileAtomic.js";

describe("replaceFileAtomic", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "stagepilot-export-"));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("overwrites the destination with the source contents", async () => {
    const srcPath = path.join(dir, "source.pdf");
    const destPath = path.join(dir, "exports", "output.pdf");

    await fs.writeFile(srcPath, "new");
    await fs.mkdir(path.dirname(destPath), { recursive: true });
    await fs.writeFile(destPath, "old");

    await replaceFileAtomic(srcPath, destPath);

    const content = await fs.readFile(destPath, "utf8");
    expect(content).toBe("new");
    expect(await fs.readdir(path.dirname(destPath))).toEqual(["output.pdf"]);
  });

  it("creates the destination when it does not exist yet", async () => {
    const srcPath = path.join(dir, "source.pdf");
    const destPath = path.join(dir, "exports", "output.pdf");
    await fs.writeFile(srcPath, "new");

    await replaceFileAtomic(srcPath, destPath);

    expect(await fs.readFile(destPath, "utf8")).toBe("new");
  });

  it("keeps the original destination and removes the temp file when the rename fails", async () => {
    const srcPath = path.join(dir, "source.pdf");
    const destPath = path.join(dir, "exports", "output.pdf");

    await fs.writeFile(srcPath, "new");
    await fs.mkdir(path.dirname(destPath), { recursive: true });
    await fs.writeFile(destPath, "old");

    const renameError = Object.assign(new Error("locked"), { code: "EBUSY" });
    vi.spyOn(fs, "rename").mockRejectedValueOnce(renameError);

    await expect(replaceFileAtomic(srcPath, destPath)).rejects.toBe(
      renameError,
    );

    expect(await fs.readFile(destPath, "utf8")).toBe("old");
    expect(await fs.readdir(path.dirname(destPath))).toEqual(["output.pdf"]);
  });
});
