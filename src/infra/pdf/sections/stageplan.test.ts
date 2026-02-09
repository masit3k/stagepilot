import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadRepository } from "../../fs/repo.js";
import { buildDocument } from "../../../domain/pipeline/buildDocument.js";
import type { Project } from "../../../domain/model/types.js";
import { buildStageplanPlan } from "./stageplan.js";
import { pdfLayout } from "../layout.js";

function parsePt(value: string): number {
  const match = /([0-9.]+)\s*pt/i.exec(value);
  if (!match) {
    throw new Error(`Expected pt value, got: ${value}`);
  }
  return Number.parseFloat(match[1] ?? "0");
}

describe("stageplan render plan", () => {
  it("builds boxes and respects typography for PL sample data", async () => {
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "stagepilot-"));
    await fs.mkdir(path.join(tmpRoot, "projects"), { recursive: true });

    try {
      const repo = await loadRepository({ userDataRoot: tmpRoot });
      const project: Project = {
        id: "stageplan-smoke",
        bandRef: "pl",
        purpose: "generic",
        documentDate: "2024-01-01",
      };

      const vm = buildDocument(project, repo);
      const plan = buildStageplanPlan(vm.stageplan);

      expect(plan.boxes).toHaveLength(5);

      expect(parsePt(plan.heading.fontSize)).toBeLessThan(
        parsePt(pdfLayout.typography.title.size)
      );

      expect(plan.textStyle.fontSize).toBe(pdfLayout.typography.table.size);

      const drumsBox = plan.boxes.find((box) => box.instrument === "Drums");
      expect(drumsBox).toBeTruthy();
      expect(drumsBox?.header).toBe("DRUMS – PAVEL");

      const inputBullets = drumsBox?.inputBullets ?? [];
      expect(inputBullets[0]).toMatch(/^Drums \(\d+(–\d+)?\)$/);
      expect(inputBullets).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/^PAD \(\d+(–\d+)?\)$/),
          expect.stringMatching(/^Back vocal – drums \(\d+(–\d+)?\)$/),
        ])
      );

      expect(drumsBox?.monitorBullets).toEqual(
        expect.arrayContaining(["IEM STEREO wired (5)"])
      );
      expect(drumsBox?.extraBullets).toEqual(
        expect.arrayContaining(["Drum riser 3x2"])
      );
    } finally {
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
  });
});
