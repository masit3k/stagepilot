import { describe, expect, it } from "vitest";
import type {
  DocumentViewModel,
  StageplanBlockSlot,
} from "../../../domain/model/types.js";
import { buildDefaultLayout } from "../../../domain/stageplan/layout/defaultLayout.js";
import { buildStageplanPlan } from "./stageplan.js";

/**
 * Nejhorší reálný obsah: bicí s deseti odrážkami a napájením u každé role.
 * Kdyby výchozí rozmístění kolidovalo, existující projekty by po upgradu
 * přestaly jít vytisknout.
 */
function stageplanWithFullBoxes(
  slots: readonly StageplanBlockSlot[],
): DocumentViewModel["stageplan"] {
  const layout = buildDefaultLayout({ slots, stage: null });
  const inputs = Array.from({ length: 10 }, (_, index) => ({
    channelNo: index + 1,
    label: `Drums ${index + 1}`,
    group: "drums" as const,
    ownerRole: "drums" as const,
  }));

  return {
    layout,
    lineupByRole: {
      drums: { firstName: "Pavel", isBandLeader: false },
      bass: { firstName: "Matej", isBandLeader: true },
      guitar: { firstName: "Karel", isBandLeader: false },
      keys: { firstName: "Klara", isBandLeader: false },
      vocs: { firstName: "Eva", isBandLeader: false },
    },
    leadVocals: slots.includes("lead_voc_2")
      ? [
          { firstName: "Eva", isBandLeader: false },
          { firstName: "Jana", isBandLeader: false },
        ]
      : [{ firstName: "Eva", isBandLeader: false }],
    inputs,
    monitorOutputs: [],
    powerByRole: {
      drums: { hasPowerBadge: true, powerBadgeText: "2x 230 V" },
      bass: { hasPowerBadge: true, powerBadgeText: "2x 230 V" },
      guitar: { hasPowerBadge: true, powerBadgeText: "2x 230 V" },
      keys: { hasPowerBadge: true, powerBadgeText: "2x 230 V" },
      vocs: { hasPowerBadge: true, powerBadgeText: "2x 230 V" },
    },
  };
}

describe("default arrangement stays printable", () => {
  const FIVE = [
    "drums",
    "bass",
    "guitar",
    "keys",
    "lead_voc_1",
  ] as const satisfies readonly StageplanBlockSlot[];
  const SIX = [
    ...FIVE,
    "lead_voc_2",
  ] as const satisfies readonly StageplanBlockSlot[];

  it("prints five blocks without a collision or an overflow", () => {
    // buildStageplanPlan hází při kolizi i při přetečení — tohle je ta pojistka.
    expect(() =>
      buildStageplanPlan(stageplanWithFullBoxes(FIVE)),
    ).not.toThrow();

    const plan = buildStageplanPlan(stageplanWithFullBoxes(FIVE));
    expect(plan.boxes).toHaveLength(5);
    expect(plan.container.widthMm).toBeLessThanOrEqual(162.5375);
    expect(plan.container.heightMm).toBeLessThanOrEqual(202.0914);
  });

  it("prints six blocks without a collision or an overflow", () => {
    expect(() => buildStageplanPlan(stageplanWithFullBoxes(SIX))).not.toThrow();

    const plan = buildStageplanPlan(stageplanWithFullBoxes(SIX));
    expect(plan.boxes).toHaveLength(6);
    expect(plan.container.widthMm).toBeLessThanOrEqual(162.5375);
    expect(plan.container.heightMm).toBeLessThanOrEqual(202.0914);
  });
});
