import { describe, expect, it } from "vitest";
import type { DocumentViewModel } from "../../model/types.js";
import { buildStageplanPrintMetrics } from "./buildStageplanPrintMetrics.js";

const stageplan: DocumentViewModel["stageplan"] = {
  layout: {
    stage: null,
    blocks: [
      {
        slot: "drums",
        centerXM: 6,
        centerYM: 1.2,
        widthM: 2.8,
        depthM: 1.6,
        rotationDeg: 0,
      },
      {
        slot: "bass",
        centerXM: 9.4,
        centerYM: 1.2,
        widthM: 2.7,
        depthM: 1.4,
        rotationDeg: 0,
      },
    ],
  },
  lineupByRole: {
    drums: { firstName: "Pavel", isBandLeader: false },
    bass: { firstName: "Matej", isBandLeader: false },
  },
  leadVocals: [],
  inputs: [
    { channelNo: 1, label: "Kick in", group: "drums", ownerRole: "drums" },
    { channelNo: 2, label: "Snare top", group: "drums", ownerRole: "drums" },
    { channelNo: 9, label: "Bass XLR", group: "bass", ownerRole: "bass" },
  ],
  monitorOutputs: [],
  powerByRole: {
    drums: { hasPowerBadge: false, powerBadgeText: "" },
    bass: { hasPowerBadge: true, powerBadgeText: "2x 230 V" },
  },
};

describe("buildStageplanPrintMetrics", () => {
  it("reports one metric per block in layout order", () => {
    const metrics = buildStageplanPrintMetrics(stageplan);

    expect(metrics.map((metric) => metric.slot)).toEqual(["drums", "bass"]);
  });

  it("carries the line count and the power flag of each block", () => {
    const metrics = buildStageplanPrintMetrics(stageplan);

    // "Drums (1–2)" (one range bullet) + the fixed "Drum riser 3x2" extra
    // bullet + the blank-line separator between the two groups = 3 lines.
    expect(metrics[0]).toEqual({
      slot: "drums",
      lineCount: 3,
      hasPower: false,
    });
    expect(metrics[1]).toEqual({
      slot: "bass",
      lineCount: 1,
      hasPower: true,
    });
  });
});
