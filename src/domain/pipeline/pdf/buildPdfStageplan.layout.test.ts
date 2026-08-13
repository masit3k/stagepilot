import fs from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { loadRepository } from "../../../infra/fs/repo.js";
import {
  createPdfRendererFixtureProject,
  createPdfRendererFixtureRoot,
} from "../../../infra/pdf/pdfRendererFixture.js";
import { buildDocument } from "../buildDocument.js";

describe("stageplan layout in the document view model", () => {
  it("derives the default arrangement when the project has no layout", async () => {
    const tmpRoot = await createPdfRendererFixtureRoot();
    try {
      const repo = await loadRepository({ userDataRoot: tmpRoot });
      const project = createPdfRendererFixtureProject("layout-default");

      const vm = buildDocument(project, repo);

      expect(vm.stageplan.layout.stage).toBeNull();
      expect(vm.stageplan.layout.blocks.map((block) => block.slot)).toEqual([
        "drums",
        "bass",
        "guitar",
        "keys",
        "lead_voc_1",
      ]);
      const drums = vm.stageplan.layout.blocks.find(
        (block) => block.slot === "drums",
      );
      expect(drums).toMatchObject({
        centerXM: 6,
        centerYM: 1.2,
        widthM: 2.8,
        depthM: 1.6,
        rotationDeg: 0,
      });
    } finally {
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
  });

  it("keeps a hand-placed block and never writes into the project", async () => {
    const tmpRoot = await createPdfRendererFixtureRoot();
    try {
      const repo = await loadRepository({ userDataRoot: tmpRoot });
      const project = createPdfRendererFixtureProject("layout-saved");
      project.stageplan = {
        layout: {
          stage: { widthM: 10, depthM: 6 },
          blocks: [
            {
              slot: "drums",
              centerXM: 1.5,
              centerYM: 4.2,
              widthM: 2.8,
              depthM: 1.6,
              rotationDeg: 45,
            },
          ],
        },
      };
      const before = JSON.stringify(project.stageplan);

      const vm = buildDocument(project, repo);

      expect(vm.stageplan.layout.stage).toEqual({ widthM: 10, depthM: 6 });
      expect(
        vm.stageplan.layout.blocks.find((block) => block.slot === "drums"),
      ).toMatchObject({ centerXM: 1.5, centerYM: 4.2, rotationDeg: 45 });
      // Chybějící sloty se doplní na výchozí pozici přepočtenou na 10 × 6 m.
      expect(vm.stageplan.layout.blocks).toHaveLength(5);
      // Export nesmí projekt měnit (R8).
      expect(JSON.stringify(project.stageplan)).toBe(before);
    } finally {
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
  });
});
