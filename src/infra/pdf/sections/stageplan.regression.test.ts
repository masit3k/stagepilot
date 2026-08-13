import { describe, expect, it } from "vitest";
import type {
  DocumentViewModel,
  StageplanBlockSlot,
} from "../../../domain/model/types.js";
import { buildDefaultLayout } from "../../../domain/stageplan/layout/defaultLayout.js";
import { buildStageplanPlan } from "./stageplan.js";

function minimalStageplan(
  layout: DocumentViewModel["stageplan"]["layout"],
): DocumentViewModel["stageplan"] {
  return {
    layout,
    lineupByRole: {},
    leadVocals: [],
    inputs: [],
    monitorOutputs: [],
    powerByRole: {},
  };
}

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

  it("prints the default arrangement on a stage narrower than 10 m without throwing", () => {
    // Finding 1: rescaleForStage (F5a) drží rozměry zón beze změny, jen
    // přepočítá středy — na malém pódiu proto zóny bez pohnutí jediným
    // blokem začnou překrývat. To je pravdivá informace o namačkaném pódiu,
    // ne chyba k odmítnutí; export musí uspět, ne skončit kolizní hláškou.
    const layout = buildDefaultLayout({
      slots: FIVE,
      stage: { widthM: 8, depthM: 5 },
    });

    expect(() =>
      buildStageplanPlan({ ...stageplanWithFullBoxes(FIVE), layout }),
    ).not.toThrow();
  });

  it("throws when the zones are apart but the printed boxes overlap", () => {
    // Přesně ten případ, kdy má pojistka zůstat: zóny 1×1 m jsou 1,5 m od
    // sebe (mezera i s rezervou na měřítko), takže samy o sobě nikdy
    // nekolidují. Box ale roste na minimální šířku (R3, ~36,26 mm) a při
    // téhle vzdálenosti se dva takové boxy překryjí — to je artefakt textu,
    // ne stav uložený v rozmístění, a export na něm musí spadnout.
    const layout = {
      stage: { widthM: 10, depthM: 6 },
      blocks: [
        {
          slot: "drums" as const,
          centerXM: 4,
          centerYM: 3,
          widthM: 1,
          depthM: 1,
          rotationDeg: 0,
        },
        {
          slot: "bass" as const,
          centerXM: 5.5,
          centerYM: 3,
          widthM: 1,
          depthM: 1,
          rotationDeg: 0,
        },
      ],
    };

    expect(() => buildStageplanPlan(minimalStageplan(layout))).toThrow(
      /collision: drums × bass/,
    );
  });

  it("prints a block pushed to the legal edge of the stage", () => {
    // Přesně tenhle případ export shazoval: blok u boční hrany je legální
    // (clamp F5a dovoluje 20 cm přesah), ale plán neměl kam ho nakreslit.
    const layout = buildDefaultLayout({
      slots: ["drums", "bass", "guitar", "keys", "lead_voc_1"],
      stage: null,
    });
    const pushed = {
      ...layout,
      blocks: layout.blocks.map((block) =>
        block.slot === "guitar" ? { ...block, centerXM: 1.15 } : block,
      ),
    };

    expect(() =>
      buildStageplanPlan({
        ...stageplanWithFullBoxes([
          "drums",
          "bass",
          "guitar",
          "keys",
          "lead_voc_1",
        ]),
        layout: pushed,
      }),
    ).not.toThrow();
  });
});
