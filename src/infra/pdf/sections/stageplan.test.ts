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

      const bassBox = plan.boxes.find((box) => box.instrument === "Bass");
      expect(bassBox).toBeTruthy();
      expect(bassBox?.header).toBe("BASS – MATĚJ (band leader)");

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

      const heights = plan.boxes.map((box) => box.position.heightMm);
      const maxHeight = Math.max(...heights);
      for (const height of heights) {
        expect(height).toBeCloseTo(maxHeight, 5);
      }
    } finally {
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
  });

  it("collapses stereo inputs and keeps monitor bullets intact", () => {
      const plan = buildStageplanPlan({
        lineupByRole: {},
        inputs: [
          { channelNo: 1, label: "Kick", group: "drums" },
        { channelNo: 2, label: "Snare", group: "drums" },
        { channelNo: 8, label: "OH L", group: "guitar" },
        { channelNo: 9, label: "OH R", group: "guitar" },
        { channelNo: 11, label: "PAD L", group: "drums" },
        { channelNo: 12, label: "PAD R", group: "drums" },
        { channelNo: 15, label: "Keys L", group: "keys" },
        { channelNo: 16, label: "Keys R", group: "keys" },
        { channelNo: 17, label: "Synth L", group: "keys" },
        { channelNo: 18, label: "Synth R", group: "keys" },
      ],
        monitorOutputs: [
          {
            no: 3,
            output: "Drums",
            note: "IEM STEREO wired",
          },
        ],
        powerByRole: {},
      });

    const keysBox = plan.boxes.find((box) => box.instrument === "Keys");
    expect(keysBox?.inputBullets).toEqual(
      expect.arrayContaining(["2x Keys (15+16)", "2x Synth (17+18)"])
    );
    expect(keysBox?.inputBullets.join(" ")).not.toContain("Keys L (15)");
    expect(keysBox?.inputBullets.join(" ")).not.toContain("Keys R (16)");

    const guitarBox = plan.boxes.find((box) => box.instrument === "Guitar");
    expect(guitarBox?.inputBullets).toEqual(
      expect.arrayContaining(["OH L (8)", "OH R (9)"])
    );
    expect(guitarBox?.inputBullets.join(" ")).not.toContain("2x OH");

    const drumsBox = plan.boxes.find((box) => box.instrument === "Drums");
    expect(drumsBox?.inputBullets.join(" ")).toContain("2x PAD (11+12)");
    expect(drumsBox?.monitorBullets).toEqual(
      expect.arrayContaining(["IEM STEREO wired (3)"])
    );
  });

  it("renders power badges based on stageplan power data", () => {
    const plan = buildStageplanPlan({
      lineupByRole: {},
      inputs: [],
      monitorOutputs: [],
      powerByRole: {
        drums: { hasPowerBadge: true, powerBadgeText: "3x 230 V" },
        keys: { hasPowerBadge: true, powerBadgeText: "5x 230 V" },
        vocs: { hasPowerBadge: false, powerBadgeText: "" },
      },
    });

    const drumsBox = plan.boxes.find((box) => box.instrument === "Drums");
    expect(drumsBox?.hasPowerBadge).toBe(true);
    expect(drumsBox?.powerBadgeText).toBe("3x 230 V");

    const keysBox = plan.boxes.find((box) => box.instrument === "Keys");
    expect(keysBox?.powerBadgeText).toBe("5x 230 V");

    const vocalsBox = plan.boxes.find((box) => box.instrument === "Lead vocal");
    expect(vocalsBox?.hasPowerBadge).toBe(false);
  });
});
