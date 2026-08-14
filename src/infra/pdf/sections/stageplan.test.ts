import fs from "node:fs/promises";
import { describe, expect, it } from "vitest";
import type { DocumentViewModel } from "../../../domain/model/types.js";
import { buildDocument } from "../../../domain/pipeline/buildDocument.js";
import { OVERHANG_TOLERANCE_M } from "../../../domain/stageplan/layout/blockOps.js";
import { buildDefaultLayout } from "../../../domain/stageplan/layout/defaultLayout.js";
import { STAGEPLAN_BLOCK_SLOTS } from "../../../domain/stageplan/layout/slots.js";
import { resolvePrintScale } from "../../../domain/stageplan/print/printScale.js";
import { loadRepository } from "../../fs/repo.js";
import { pdfLayout } from "../layout.js";
import {
  createPdfRendererFixtureProject,
  createPdfRendererFixtureRoot,
} from "../pdfRendererFixture.js";
import {
  buildStageplanPlan,
  renderStageplanSection,
  stageplanLayout,
  stageplanPrintGeometry,
} from "./stageplan.js";

function emptyStageplan(
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

describe("stageplan print geometry", () => {
  it("keeps the print area derived from the page mirror", () => {
    // Pojistka z F4: opsaná konstanta udělá kontejner širší než stránka a
    // Chromium zmenší celý dokument.
    expect(stageplanLayout.areaWidthMm).toBeCloseTo(162.5375, 3);
    expect(stageplanLayout.areaWidthMm).toBeLessThan(
      pdfLayout.page.contentWidthMm,
    );
    // R13: rezerva na vysvětlivku (7,2 pt + 4 pt = 11,2 pt) ubírá dalších
    // ~3,9511 mm oproti hodnotě z R6 (byla 202,0914 mm).
    expect(stageplanLayout.areaHeightMm).toBeCloseTo(198.1402, 3);
    expect(stageplanPrintGeometry.typography.minBoxWidthMm).toBeCloseTo(
      36.2594,
      3,
    );
    expect(stageplanPrintGeometry.typography.fontSizePt).toBe(8);
  });

  it("places a block by its zone centre and prints its rotation", () => {
    const plan = buildStageplanPlan(
      emptyStageplan({
        stage: null,
        blocks: [
          {
            slot: "drums",
            centerXM: 6,
            centerYM: 1.2,
            widthM: 2.8,
            depthM: 1.6,
            rotationDeg: 30,
          },
        ],
      }),
    );

    expect(plan.boxes).toHaveLength(1);
    const box = plan.boxes[0];
    expect(box?.slot).toBe("drums");
    expect(box?.rotationDeg).toBe(30);
    // Jediný blok je 2,8 m široký, takže rezerva na přesah shodí měřítko jen
    // o toleranci (12 + 0,4 m), ne o dorůstání zóny na minimální šířku:
    // 162,5375 / 12,4 = 13,1079 mm/m; 2,8 × 13,1079 = 36,702 mm.
    expect(box?.widthMm).toBeCloseTo(36.702, 2);
    // Střed 6 m × 13,1079 = 78,647 mm; levý horní roh je o půl šířky vlevo.
    expect((box?.xMm ?? 0) + (box?.widthMm ?? 0) / 2).toBeCloseTo(
      78.647 + plan.stage.xMm,
      2,
    );
    // Osa y roste od upstage hrany k publiku (R4): 1,2 m = 15,729 mm.
    expect(
      (box?.yMm ?? 0) + (box?.heightMm ?? 0) / 2 - plan.stage.yMm,
    ).toBeCloseTo(15.729, 2);
  });

  it("refuses to print a block that pushes the container past the mirror", () => {
    expect(() =>
      buildStageplanPlan(
        emptyStageplan({
          stage: null,
          blocks: [
            {
              slot: "drums",
              centerXM: 20,
              centerYM: 1.2,
              widthM: 2.8,
              depthM: 1.6,
              rotationDeg: 0,
            },
          ],
        }),
      ),
    ).toThrow(/overflow/);
  });

  it("prints the stage caption only when the size is entered", () => {
    const withStage = buildStageplanPlan(
      emptyStageplan({ stage: { widthM: 10, depthM: 6 }, blocks: [] }),
    );
    const withoutStage = buildStageplanPlan(
      emptyStageplan({ stage: null, blocks: [] }),
    );

    expect(withStage.stage.caption).toBe("PÓDIUM 10,0 × 6,0 m");
    expect(withoutStage.stage.caption).toBeNull();
  });

  it("sizes the container from the union of the stage frame and the boxes", () => {
    const plan = buildStageplanPlan(
      emptyStageplan({
        stage: null,
        blocks: [
          {
            slot: "drums",
            centerXM: 6,
            centerYM: 0.2,
            widthM: 2.8,
            depthM: 1.6,
            rotationDeg: 0,
          },
        ],
      }),
    );

    // Zóna bicích je 21,7 mm vysoká, takže na 0,2 m (2,7 mm) od hrany
    // přesahuje box za upstage hranu a kontejner se o ten přesah zvětší.
    expect(plan.stage.yMm).toBeGreaterThan(0);
    expect(plan.container.heightMm).toBeGreaterThan(plan.stage.heightMm);
    expect(plan.container.widthMm).toBeLessThanOrEqual(
      stageplanLayout.areaWidthMm,
    );
  });

  it("refuses to print blocks whose boxes overlap even though their zones do not", () => {
    // Finding 1: zóny 1,5 × 1,5 m jsou 2 m od sebe (osa X), takže samy o
    // sobě nekolidují. Box ale roste na minimální šířku 36,26 mm (R3) a při
    // téhle vzdálenosti (~23,2 mm) se dva takové boxy překryjí — artefakt
    // textu, ne stav uložený v rozmístění, a export na něm musí spadnout.
    expect(() =>
      buildStageplanPlan(
        emptyStageplan({
          stage: null,
          blocks: [
            {
              slot: "drums",
              centerXM: 5,
              centerYM: 4,
              widthM: 1.5,
              depthM: 1.5,
              rotationDeg: 0,
            },
            {
              slot: "bass",
              centerXM: 7,
              centerYM: 4,
              widthM: 1.5,
              depthM: 1.5,
              rotationDeg: 0,
            },
          ],
        }),
      ),
    ).toThrow(/collision: drums × bass/);
  });

  it("prints blocks whose zones already overlap on a cramped stage", () => {
    // F5a's rescaleForStage leaves zone sizes untouched when the stage
    // shrinks, so zone overlap is the model's honest way of saying "cramped
    // stage" (see rescaleForStage.ts). Finding 1 says this must print.
    expect(() =>
      buildStageplanPlan(
        emptyStageplan({
          stage: null,
          blocks: [
            {
              slot: "drums",
              centerXM: 6,
              centerYM: 2,
              widthM: 2.8,
              depthM: 1.6,
              rotationDeg: 0,
            },
            {
              slot: "bass",
              centerXM: 6.2,
              centerYM: 2.4,
              widthM: 2.7,
              depthM: 1.4,
              rotationDeg: 0,
            },
          ],
        }),
      ),
    ).not.toThrow();
  });

  it("builds boxes and content for the fixture project", async () => {
    const tmpRoot = await createPdfRendererFixtureRoot();
    try {
      const repo = await loadRepository({ userDataRoot: tmpRoot });
      const project = createPdfRendererFixtureProject("stageplan-smoke");
      const vm = buildDocument(project, repo);

      const plan = buildStageplanPlan(vm.stageplan);

      expect(plan.boxes).toHaveLength(5);
      const drumsBox = plan.boxes.find((box) => box.slot === "drums");
      expect(drumsBox?.header).toBe("DRUMS – PAVEL");
      expect(drumsBox?.inputBullets[0]).toMatch(/^Drums \(\d+(–\d+)?\)$/);
      expect(drumsBox?.extraBullets).toEqual(
        expect.arrayContaining(["Drum riser 3x2"]),
      );

      const html = renderStageplanSection(vm);
      expect(html).toContain("transform:rotate(0deg)");
      expect(html).toContain("stageplanStage");
    } finally {
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
  });

  it("marks the lead vocal box and renders power as a line", () => {
    const html = renderStageplanSection({
      stageplan: {
        ...emptyStageplan({
          stage: null,
          blocks: [
            {
              slot: "lead_voc_1",
              centerXM: 6,
              centerYM: 5.5,
              widthM: 2.6,
              depthM: 1.2,
              rotationDeg: 0,
            },
          ],
        }),
        // roleDataForSlot dá lead_voc_1 vždy roli "vocs" (buildPdfStageplanPrintModel.ts).
        powerByRole: {
          vocs: { hasPowerBadge: true, powerBadgeText: "1x 230V" },
        },
      },
    } as unknown as DocumentViewModel);

    expect(html).not.toContain("stageplanBox--lead");
    expect(html).toContain("DOWNSTAGE · PUBLIKUM");
    expect(html).toContain('<div class="stageplanPower">1x 230V</div>');
  });
});

describe("stageplan legend (R13)", () => {
  function vmWith(args: {
    leaderSlot: "bass" | null;
  }): DocumentViewModel["stageplan"] {
    return {
      ...emptyStageplan({
        stage: null,
        blocks: [
          {
            slot: "bass",
            centerXM: 6,
            centerYM: 4,
            widthM: 2.7,
            depthM: 1.4,
            rotationDeg: 0,
          },
        ],
      }),
      lineupByRole: {
        bass: { firstName: "Matěj", isBandLeader: args.leaderSlot === "bass" },
      },
    };
  }

  it("prints the legend when a printed block carries the mark", () => {
    const plan = buildStageplanPlan(vmWith({ leaderSlot: "bass" }));
    expect(plan.legend).toBe("* KAPELNÍK");
  });

  it("leaves the legend out when no printed block carries the mark", () => {
    const plan = buildStageplanPlan(vmWith({ leaderSlot: null }));
    expect(plan.legend).toBeNull();
  });

  it("keeps the plan geometry identical with and without the legend", () => {
    // Výška vysvětlivky se rezervuje vždy, jinak by měřítko plánu záviselo na
    // tom, jestli je někdo označený jako kapelník (R13, po vzoru R6 z F5b).
    const withLeader = buildStageplanPlan(vmWith({ leaderSlot: "bass" }));
    const withoutLeader = buildStageplanPlan(vmWith({ leaderSlot: null }));

    expect(withoutLeader.stage.widthMm).toBe(withLeader.stage.widthMm);
    expect(withoutLeader.stage.heightMm).toBe(withLeader.stage.heightMm);
    expect(withoutLeader.container).toEqual(withLeader.container);
  });

  it("keeps the print scale width-bound, so the reservation cannot shrink the plan", () => {
    // Tvrzení, na kterém rezerva stojí: měřítko je min(šířková, výšková) mez a
    // váže ho šířka. Kdyby to přestalo platit, ubraná výška by plán zmenšila.
    const nominalDepthM = 8;
    const blocks = buildDefaultLayout({
      slots: STAGEPLAN_BLOCK_SLOTS,
      stage: null,
    }).blocks;
    const scale = resolvePrintScale({
      stage: null,
      blocks,
      area: stageplanPrintGeometry.area,
      minBoxWidthMm: stageplanPrintGeometry.typography.minBoxWidthMm,
    });
    const heightBound =
      stageplanPrintGeometry.area.heightMm /
      (nominalDepthM + 2 * OVERHANG_TOLERANCE_M);

    expect(scale.mmPerM).toBeLessThan(heightBound);
  });

  it("keeps the min-box-width reservation active for the default zones", () => {
    // Nejužší výchozí zóna je 2,6 m a tisková mez ~2,81 m, takže rezerva
    // měřítko snižuje už u výchozího rozmístění. Není to hraniční případ.
    const blocks = buildDefaultLayout({
      slots: STAGEPLAN_BLOCK_SLOTS,
      stage: null,
    }).blocks;
    const narrowestM = Math.min(...blocks.map((block) => block.widthM));
    const scale = resolvePrintScale({
      stage: null,
      blocks,
      area: stageplanPrintGeometry.area,
      minBoxWidthMm: stageplanPrintGeometry.typography.minBoxWidthMm,
    });

    expect(narrowestM * scale.mmPerM).toBeLessThan(
      stageplanPrintGeometry.typography.minBoxWidthMm,
    );
  });
});
