import fs from "node:fs/promises";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProjectJson } from "../../domain/model/types.js";
import { renderPdf } from "../../infra/pdf/pdf.js";
import {
  createPdfRendererFixtureProject,
  createPdfRendererFixtureRoot,
} from "../../infra/pdf/pdfRendererFixture.js";
import { catalogPathsForRoot } from "../../infra/storage/catalogPaths.js";
import { exportProjectPdf, loadDefaultContact } from "./exportPdf.js";

// Render je jediné místo, kde export potřebuje Chromium. Nahrazuje se celý,
// aby tyhle testy prohlížeč nespouštěly; všechno ostatní (repozitář, pipeline,
// úložiště verzí, publikace exportu) běží doopravdy nad dočasným adresářem.
vi.mock("../../infra/pdf/pdf.js", () => ({ renderPdf: vi.fn() }));

const PROJECT_ID = "0193a5b2-7c1e-7abc-8def-0123456789ab";
const renderPdfMock = vi.mocked(renderPdf);

function fixtureProject(overrides: Partial<ProjectJson> = {}): ProjectJson {
  return {
    ...createPdfRendererFixtureProject(PROJECT_ID),
    ...overrides,
  } as ProjectJson;
}

async function listVersionDirs(root: string, projectId: string) {
  const projectDir = path.join(catalogPathsForRoot(root).versions, projectId);
  try {
    return await fs.readdir(projectDir);
  } catch {
    return [];
  }
}

describe("exportProjectPdf hardening", () => {
  let root: string;

  beforeEach(async () => {
    root = await createPdfRendererFixtureRoot();
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    renderPdfMock.mockReset();
    renderPdfMock.mockImplementation(async (_vm, opts) => {
      await fs.writeFile(opts.outFile, "/Type /Page\n/Type /Page\n");
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(root, { recursive: true, force: true });
  });

  it("removes the freshly created version folder when the render fails", async () => {
    const renderError = new Error(
      "PDF overflow: content does not fit A4 page.",
    );
    renderPdfMock.mockRejectedValueOnce(renderError);

    await expect(
      exportProjectPdf({ userDataDir: root, project: fixtureProject() }),
    ).rejects.toBe(renderError);

    expect(await listVersionDirs(root, PROJECT_ID)).toEqual([]);
  });

  it("removes the version folder when writing the version fails after the render", async () => {
    // Render "uspěje", ale PDF na místě nenechá — zápis verze pak spadne.
    renderPdfMock.mockImplementationOnce(async () => undefined);
    const realWriteFile = fs.writeFile;
    const writeError = Object.assign(new Error("disk full"), {
      code: "ENOSPC",
    });
    vi.spyOn(fs, "writeFile").mockImplementation(async (...args) => {
      if (String(args[0]).endsWith("project.json")) throw writeError;
      return realWriteFile(...args);
    });

    await expect(
      exportProjectPdf({ userDataDir: root, project: fixtureProject() }),
    ).rejects.toBe(writeError);

    expect(await listVersionDirs(root, PROJECT_ID)).toEqual([]);
  });

  it("keeps the version and writes meta.json when the export succeeds", async () => {
    const result = await exportProjectPdf({
      userDataDir: root,
      project: fixtureProject(),
    });

    expect(await listVersionDirs(root, PROJECT_ID)).toEqual([result.versionId]);
    expect((await fs.readdir(result.versionPath)).sort()).toEqual([
      "meta.json",
      "project.json",
      "test_Inputlist_Stageplan_2024.pdf",
    ]);
    expect(path.basename(result.exportPdfPath)).toBe(
      "test_Inputlist_Stageplan_2024.pdf",
    );
  });

  it("gives the PDF a safe file name when the slug carries a path separator", async () => {
    const result = await exportProjectPdf({
      userDataDir: root,
      project: fixtureProject({ slug: "AC/DC_Inputlist_Stageplan_2024" }),
    });

    expect(path.basename(result.versionPdfPath)).toBe(
      "AC_DC_Inputlist_Stageplan_2024.pdf",
    );
    expect(path.dirname(result.versionPdfPath)).toBe(result.versionPath);
    expect(result.exportPdfPath).toBe(
      path.join(root, "exports", "AC_DC_Inputlist_Stageplan_2024.pdf"),
    );
  });

  it("keeps the slug itself unchanged in meta.json", async () => {
    const result = await exportProjectPdf({
      userDataDir: root,
      project: fixtureProject({ slug: "AC/DC_Inputlist_Stageplan_2024" }),
    });

    const meta = JSON.parse(
      await fs.readFile(path.join(result.versionPath, "meta.json"), "utf8"),
    ) as { slug: string; pdfFileName: string };
    expect(meta.slug).toBe("AC/DC_Inputlist_Stageplan_2024");
    expect(meta.pdfFileName).toBe("AC_DC_Inputlist_Stageplan_2024.pdf");
  });

  it("rejects a project id that would leave the user data root", async () => {
    await expect(
      exportProjectPdf({
        userDataDir: root,
        // Jedno `..` vede z `versions/` do kořene testu, ne mimo něj.
        project: fixtureProject({ id: "..\\evil" }),
      }),
    ).rejects.toThrow(/projectId/);

    await expect(fs.access(path.join(root, "evil"))).rejects.toThrow();

    expect(renderPdfMock).not.toHaveBeenCalled();
  });
});

describe("loadDefaultContact path safety", () => {
  let root: string;

  beforeEach(async () => {
    root = await createPdfRendererFixtureRoot();
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it("rejects a contact id that points outside the contacts folder", async () => {
    // Soubor o složku výš opravdu existuje — bez kontroly by se načetl.
    const catalogDir = path.dirname(catalogPathsForRoot(root).contacts);
    await fs.writeFile(
      path.join(catalogDir, "evil.json"),
      JSON.stringify({ id: "evil", firstName: "Evil", lastName: "Contact" }),
      "utf8",
    );

    await expect(loadDefaultContact("../evil", root)).rejects.toThrow(
      /defaultContactId/,
    );
  });
});
