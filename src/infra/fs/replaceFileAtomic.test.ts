import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { replaceFileAtomic } from "./replaceFileAtomic.js";

describe("replaceFileAtomic", () => {
  it("overwrites the destination with the source contents", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "stagepilot-export-"));
    const srcPath = path.join(dir, "source.pdf");
    const destPath = path.join(dir, "exports", "output.pdf");

    await fs.writeFile(srcPath, "new");
    await fs.mkdir(path.dirname(destPath), { recursive: true });
    await fs.writeFile(destPath, "old");

    await replaceFileAtomic(srcPath, destPath);

    const content = await fs.readFile(destPath, "utf8");
    expect(content).toBe("new");
  });
});
