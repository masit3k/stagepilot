import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { loadJsonFile } from "./loadJson.js";

describe("loadJsonFile", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "stagepilot-loadjson-"));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("parses a file saved with a UTF-8 byte order mark", async () => {
    const filePath = path.join(dir, "bom.json");
    await fs.writeFile(filePath, '﻿{"id":"band"}', "utf8");

    await expect(loadJsonFile(filePath)).resolves.toEqual({ id: "band" });
  });

  it("parses a plain file unchanged", async () => {
    const filePath = path.join(dir, "plain.json");
    await fs.writeFile(filePath, '{"name":"Žluťoučký"}', "utf8");

    await expect(loadJsonFile(filePath)).resolves.toEqual({
      name: "Žluťoučký",
    });
  });

  it("names the file in a parse error and keeps the original as cause", async () => {
    const filePath = path.join(dir, "broken.json");
    await fs.writeFile(filePath, '{"id": ', "utf8");

    const error = await loadJsonFile(filePath).then(
      () => null,
      (reason: unknown) => reason,
    );

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain(filePath);
    expect((error as Error).cause).toBeInstanceOf(SyntaxError);
  });

  it("leaves a missing-file error as the file system reported it", async () => {
    const filePath = path.join(dir, "missing.json");

    await expect(loadJsonFile(filePath)).rejects.toMatchObject({
      code: "ENOENT",
    });
  });
});
