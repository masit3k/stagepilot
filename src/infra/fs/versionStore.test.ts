import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  type ProjectSnapshotMeta,
  createProjectVersion,
  listProjectVersions,
  loadProjectVersion,
  prepareVersionDir,
} from "./versionStore.js";

const PROJECT_ID = "0193a5b2-7c1e-7abc-8def-0123456789ab";

function metaFor(versionId: string, generatedAt: string): ProjectSnapshotMeta {
  return {
    schemaVersion: 1,
    projectId: PROJECT_ID,
    versionId,
    generatedAt,
    documentDate: "2026-11-12",
    bandRef: "test-band",
    pdfFileName: "doc.pdf",
    paths: { versionDir: "", projectJson: "", metaJson: "", pdf: "" },
  };
}

describe("versionStore", () => {
  let root: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "stagepilot-versions-"));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(root, { recursive: true, force: true });
  });

  async function writeVersion(versionId: string, metaJson: string | null) {
    const dir = path.join(root, "versions", PROJECT_ID, versionId);
    await fs.mkdir(dir, { recursive: true });
    if (metaJson !== null) {
      await fs.writeFile(path.join(dir, "meta.json"), metaJson, "utf8");
    }
  }

  describe("listProjectVersions", () => {
    it("skips a version folder without meta.json instead of failing", async () => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      await writeVersion(
        "20261112-100000-000",
        JSON.stringify(
          metaFor("20261112-100000-000", "2026-11-12T10:00:00.000Z"),
        ),
      );
      await writeVersion("20261112-110000-000", null);

      const versions = await listProjectVersions(PROJECT_ID, root);

      expect(versions.map((meta) => meta.versionId)).toEqual([
        "20261112-100000-000",
      ]);
    });

    it("skips a version folder whose meta.json is not valid JSON", async () => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      await writeVersion(
        "20261112-100000-000",
        JSON.stringify(
          metaFor("20261112-100000-000", "2026-11-12T10:00:00.000Z"),
        ),
      );
      await writeVersion("20261112-110000-000", '{"schemaVersion": 1,');

      const versions = await listProjectVersions(PROJECT_ID, root);

      expect(versions.map((meta) => meta.versionId)).toEqual([
        "20261112-100000-000",
      ]);
    });

    it("skips a meta.json without a generatedAt to sort by", async () => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      await writeVersion(
        "20261112-100000-000",
        JSON.stringify(
          metaFor("20261112-100000-000", "2026-11-12T10:00:00.000Z"),
        ),
      );
      await writeVersion("20261112-110000-000", "{}");

      const versions = await listProjectVersions(PROJECT_ID, root);

      expect(versions.map((meta) => meta.versionId)).toEqual([
        "20261112-100000-000",
      ]);
    });

    it("reports the skipped folder on stderr", async () => {
      const errorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      await writeVersion("20261112-110000-000", null);

      await listProjectVersions(PROJECT_ID, root);

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(errorSpy.mock.calls[0])).toContain(
        "20261112-110000-000",
      );
    });

    it("still returns valid versions newest first", async () => {
      await writeVersion(
        "20261112-100000-000",
        JSON.stringify(
          metaFor("20261112-100000-000", "2026-11-12T10:00:00.000Z"),
        ),
      );
      await writeVersion(
        "20261112-120000-000",
        JSON.stringify(
          metaFor("20261112-120000-000", "2026-11-12T12:00:00.000Z"),
        ),
      );

      const versions = await listProjectVersions(PROJECT_ID, root);

      expect(versions.map((meta) => meta.versionId)).toEqual([
        "20261112-120000-000",
        "20261112-100000-000",
      ]);
    });
  });

  describe("createProjectVersion", () => {
    it("writes meta.json last, so a failed version never has one", async () => {
      const versionDir = path.join(root, "versions", PROJECT_ID, "v1");

      await expect(
        createProjectVersion({
          project: { id: PROJECT_ID },
          projectId: PROJECT_ID,
          pdfSourcePath: path.join(root, "missing.pdf"),
          pdfFileName: "doc.pdf",
          versionId: "v1",
          versionDir,
          userDataRoot: root,
          meta: {
            projectId: PROJECT_ID,
            generatedAt: "2026-11-12T10:00:00.000Z",
            documentDate: "2026-11-12",
            bandRef: "test-band",
          },
        }),
      ).rejects.toThrow();

      await expect(
        fs.access(path.join(versionDir, "meta.json")),
      ).rejects.toThrow();
    });
  });

  describe("path segments", () => {
    // Jedno `..` stačí: z `versions/` vede do kořene testu, ne mimo něj, takže
    // ani selhávající test nezanechá nic mimo dočasný adresář.
    const outside = "..\\evil";

    it("refuses to prepare a version folder for an unsafe project id", async () => {
      await expect(prepareVersionDir(outside, root)).rejects.toThrow(
        /projectId/,
      );
      await expect(fs.access(path.join(root, "evil"))).rejects.toThrow();
    });

    it("refuses an unsafe base version id", async () => {
      await expect(
        prepareVersionDir(PROJECT_ID, root, "../escape"),
      ).rejects.toThrow(/versionId/);
    });

    it("refuses to list versions of an unsafe project id", async () => {
      await expect(listProjectVersions("AC/DC", root)).rejects.toThrow(
        /projectId/,
      );
    });

    it("refuses to load a version with an unsafe project or version id", async () => {
      await expect(loadProjectVersion(outside, "v1", root)).rejects.toThrow(
        /projectId/,
      );
      await expect(
        loadProjectVersion(PROJECT_ID, "..\\other", root),
      ).rejects.toThrow(/versionId/);
    });

    it("refuses to create a version for an unsafe project id", async () => {
      const pdfSourcePath = path.join(root, "source.pdf");
      await fs.writeFile(pdfSourcePath, "pdf");

      await expect(
        createProjectVersion({
          project: {},
          projectId: outside,
          pdfSourcePath,
          pdfFileName: "doc.pdf",
          userDataRoot: root,
          meta: {
            projectId: outside,
            generatedAt: "2026-11-12T10:00:00.000Z",
            documentDate: "2026-11-12",
            bandRef: "test-band",
          },
        }),
      ).rejects.toThrow(/projectId/);
    });

    it("refuses a PDF file name that would leave the version folder", async () => {
      const pdfSourcePath = path.join(root, "source.pdf");
      await fs.writeFile(pdfSourcePath, "pdf");

      await expect(
        createProjectVersion({
          project: {},
          projectId: PROJECT_ID,
          pdfSourcePath,
          pdfFileName: "..\\evil.pdf",
          userDataRoot: root,
          meta: {
            projectId: PROJECT_ID,
            generatedAt: "2026-11-12T10:00:00.000Z",
            documentDate: "2026-11-12",
            bandRef: "test-band",
          },
        }),
      ).rejects.toThrow(/pdfFileName/);
    });

    it("prepares a folder for a generated project id", async () => {
      const { versionId, versionDir } = await prepareVersionDir(
        PROJECT_ID,
        root,
        "20261112-104512-123",
      );

      expect(versionId).toBe("20261112-104512-123");
      expect(versionDir).toBe(
        path.join(root, "versions", PROJECT_ID, "20261112-104512-123"),
      );
    });
  });
});
