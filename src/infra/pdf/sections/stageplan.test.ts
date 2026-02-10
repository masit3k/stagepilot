import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadRepository } from "../../fs/repo.js";
import { buildDocument } from "../../../domain/pipeline/buildDocument.js";
import type { Project } from "../../../domain/model/types.js";
import { buildStageplanPlan, matchStageplanLayout } from "./stageplan.js";
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

      expect(plan.layout.layoutId).toBe("layout_5_party");
      expect(plan.boxes).toHaveLength(5);

      expect(parsePt(plan.heading.fontSize)).toBeLessThan(
        parsePt(pdfLayout.typography.title.size)
      );

      expect(plan.textStyle.fontSize).toBe(pdfLayout.typography.table.size);

      const drumsBox = plan.boxes.find((box) => box.slot === "drums");
      expect(drumsBox).toBeTruthy();
      expect(drumsBox?.header).toBe("DRUMS – PAVEL");

      const bassBox = plan.boxes.find((box) => box.slot === "bass");
      expect(bassBox).toBeTruthy();
      expect(bassBox?.header).toBe("BASS – MATĚJ (band leader)");

      const inputBullets = drumsBox?.inputBullets ?? [];
      expect(inputBullets[0]).toMatch(/^Drums \(\d+(–\d+)?\)$/);
      expect(inputBullets).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/^2x PAD \(\d+\+\d+\)$/),
          expect.stringMatching(/^Back vocal – drums \(\d+(–\d+)?\)$/),
        ])
      );

      expect(drumsBox?.monitorBullets).toEqual(
        expect.arrayContaining(["IEM STEREO wired (5)"])
      );
      expect(drumsBox?.extraBullets).toEqual(
        expect.arrayContaining(["Drum riser 3x2"])
      );

      const topBoxes = plan.boxes.filter((box) => box.row === "top");
      const bottomBoxes = plan.boxes.filter((box) => box.row === "bottom");
      const topHeight = topBoxes[0]?.position.heightMm ?? 0;
      const bottomHeight = bottomBoxes[0]?.position.heightMm ?? 0;
      expect(topBoxes.every((box) => Math.abs(box.position.heightMm - topHeight) < 0.001)).toBe(true);
      expect(bottomBoxes.every((box) => Math.abs(box.position.heightMm - bottomHeight) < 0.001)).toBe(true);
    } finally {
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
  });

  it("selects layout by lead vocalist count", () => {
    expect(
      matchStageplanLayout({
        lineupByRole: { vocs: { firstName: "A", isBandLeader: false } },
        leadVocals: [{ firstName: "A", isBandLeader: false }],
        inputs: [],
        monitorOutputs: [],
        powerByRole: {},
      }).id
    ).toBe("layout_5_party");

    expect(
      matchStageplanLayout({
        lineupByRole: {},
        leadVocals: [
          { firstName: "A", isBandLeader: false },
          { firstName: "B", isBandLeader: false },
        ],
        inputs: [],
        monitorOutputs: [],
        powerByRole: {},
      }).id
    ).toBe("layout_6_2_vocs");
  });

  it("renders layout_6_2_vocs in slot order with dynamic names", () => {
    const plan = buildStageplanPlan({
      lineupByRole: {
        drums: { firstName: "Drummer", isBandLeader: false },
        bass: { firstName: "Bassist", isBandLeader: false },
        guitar: { firstName: "Guitarist", isBandLeader: false },
        keys: { firstName: "Keysman", isBandLeader: false },
      },
      leadVocals: [
        { firstName: "Alice", isBandLeader: false },
        { firstName: "Bob", isBandLeader: false },
      ],
      inputs: [
        { channelNo: 1, label: "Lead vocal 1", group: "vocs" },
        { channelNo: 2, label: "Lead vocal 2", group: "vocs" },
      ],
      monitorOutputs: [
        { no: 1, output: "Lead vocal 1", note: "IEM A" },
        { no: 2, output: "Lead vocal 2", note: "IEM B" },
      ],
      powerByRole: {},
    });

    expect(plan.layout.layoutId).toBe("layout_6_2_vocs");
    const bottomSlots = plan.boxes
      .filter((box) => box.row === "bottom")
      .sort((a, b) => a.position.xMm - b.position.xMm)
      .map((box) => box.slot);
    expect(bottomSlots).toEqual(["guitar", "lead_voc_1", "lead_voc_2", "keys"]);

    const lead1 = plan.boxes.find((box) => box.slot === "lead_voc_1");
    const lead2 = plan.boxes.find((box) => box.slot === "lead_voc_2");
    expect(lead1?.header).toContain("ALICE");
    expect(lead2?.header).toContain("BOB");
    expect(lead1?.header).not.toContain("TOMÁŠ");
    expect(lead2?.header).not.toContain("TOMÁŠ");

    const topCenter = plan.boxes.find((box) => box.slot === "drums");
    expect(topCenter?.position.xMm).toBeCloseTo(62.5, 5);
    expect(topCenter?.row).toBe("top");

    const legacyBottomWidthMm = (plan.layout.areaWidthMm - plan.layout.gapXmm * (4 - 1)) / 4;
    const bottomWidths = plan.boxes.filter((box) => box.row === "bottom").map((box) => box.position.widthMm);
    expect(bottomWidths.every((widthMm) => widthMm > legacyBottomWidthMm)).toBe(true);

    const drumsTop = plan.boxes.find((box) => box.slot === "drums");
    const bassTop = plan.boxes.find((box) => box.slot === "bass");
    expect(drumsTop?.position.xMm).toBeCloseTo(plan.layout.boxWidthMm + plan.layout.gapXmm, 5);
    expect(drumsTop?.position.widthMm).toBeCloseTo(plan.layout.boxWidthMm, 5);
    expect(bassTop?.position.xMm).toBeCloseTo(2 * (plan.layout.boxWidthMm + plan.layout.gapXmm), 5);
    expect(bassTop?.position.widthMm).toBeCloseTo(plan.layout.boxWidthMm, 5);
  });

  it("keeps stageplan boxes inside stage area and page safe height for layout_6_2_vocs", () => {
    const plan = buildStageplanPlan({
      lineupByRole: {
        drums: { firstName: "Drummer", isBandLeader: false },
        bass: { firstName: "Bassist", isBandLeader: false },
        guitar: { firstName: "Guitarist", isBandLeader: false },
        keys: { firstName: "Keysman", isBandLeader: false },
      },
      leadVocals: [
        { firstName: "Alice", isBandLeader: false },
        { firstName: "Bob", isBandLeader: false },
      ],
      inputs: [
        { channelNo: 1, label: "Guitar", group: "guitar" },
        { channelNo: 2, label: "Lead vocal 1", group: "vocs" },
        { channelNo: 3, label: "Lead vocal 2", group: "vocs" },
        { channelNo: 4, label: "Keys", group: "keys" },
      ],
      monitorOutputs: [],
      powerByRole: {},
    });

    expect(plan.layout.layoutId).toBe("layout_6_2_vocs");
    for (const box of plan.boxes) {
      expect(box.position.xMm).toBeGreaterThanOrEqual(0);
      expect(box.position.yMm).toBeGreaterThanOrEqual(0);
      expect(box.position.xMm + box.position.widthMm).toBeLessThanOrEqual(plan.layout.areaWidthMm);
      expect(box.position.yMm + box.position.heightMm).toBeLessThanOrEqual(plan.layout.areaHeightMm);
    }

    const pageHeightMm = 297;
    const marginTopMm = Number.parseFloat(pdfLayout.page.margins.top);
    const marginBottomMm = Number.parseFloat(pdfLayout.page.margins.bottom);
    const availableHeightMm = pageHeightMm - marginTopMm - marginBottomMm;
    const sectionMarginTopMm = parsePt(plan.layout.sectionMarginTop) / (72 / 25.4);
    const headingHeightMm = parsePt(plan.heading.fontSize) / (72 / 25.4);
    const containerMarginTopMm = parsePt(plan.layout.containerMarginTop) / (72 / 25.4);
    const containerPadMm = (parsePt(plan.layout.containerPad) / (72 / 25.4)) * 2;
    const totalHeightMm = sectionMarginTopMm + headingHeightMm + containerMarginTopMm + containerPadMm + plan.layout.areaHeightMm;

    expect(totalHeightMm).toBeLessThanOrEqual(availableHeightMm);
  });

  it("collapses stereo inputs and keeps monitor bullets intact", () => {
    const plan = buildStageplanPlan({
      lineupByRole: {},
      inputs: [
        { channelNo: 1, label: "Kick", group: "drums" },
        { channelNo: 2, label: "Snare", group: "drums" },
        { channelNo: 5, label: "Bass L (main out L)", group: "bass" },
        { channelNo: 6, label: "Bass R (main out R)", group: "bass" },
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

    const bassBox = plan.boxes.find((box) => box.instrument === "Bass");
    expect(bassBox?.inputBullets).toEqual(expect.arrayContaining(["2x Bass (5+6)"]));
    expect(bassBox?.inputBullets.join(" ")).not.toContain("Bass L (5)");
    expect(bassBox?.inputBullets.join(" ")).not.toContain("Bass R (6)");

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

    const vocalsBox = plan.boxes.find((box) => box.slot === "lead_voc_1");
    expect(vocalsBox?.hasPowerBadge).toBe(false);
  });
});
