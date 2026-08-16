import fs from "node:fs/promises";
import { describe, expect, it } from "vitest";
import type { DocumentViewModel } from "../../../domain/model/types.js";
import { buildDocument } from "../../../domain/pipeline/buildDocument.js";
import { OVERHANG_TOLERANCE_M } from "../../../domain/stageplan/layout/blockOps.js";
import {
  NOMINAL_STAGE,
  buildDefaultLayout,
} from "../../../domain/stageplan/layout/defaultLayout.js";
import { STAGEPLAN_BLOCK_SLOTS } from "../../../domain/stageplan/layout/slots.js";
import { computePrintFootprintMm } from "../../../domain/stageplan/print/printFootprint.js";
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

/** Box, který vyjde z prázdného lineupu: hlavička a nic dalšího. */
const emptyDrumsBox = {
  header: "DRUMS",
  hasBandLeaderLine: false,
  inputBullets: [],
  monitorBullets: [],
  extraBullets: ["Drum riser 3x2"],
  hasPowerBadge: false,
  powerBadgeText: "",
};

describe("stageplan print geometry", () => {
  it("keeps the print area derived from the page mirror", () => {
    // Pojistka z F4: opsaná konstanta udělá kontejner širší než stránka a
    // Chromium zmenší celý dokument.
    expect(stageplanLayout.areaWidthMm).toBeCloseTo(162.5375, 3);
    expect(stageplanLayout.areaWidthMm).toBeLessThan(
      pdfLayout.page.contentWidthMm,
    );
    // Hlavička vyrostla o 4,95 mm (R12), takže plocha plánu o tolik klesla.
    expect(stageplanLayout.areaHeightMm).toBeCloseTo(197.1382, 3);
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
    // Box je široký podle svého textu, ne podle zóny (R3): prázdný lineup dá
    // hlavičku "DRUMS" a nic víc.
    expect(box?.widthMm).toBeCloseTo(
      computePrintFootprintMm({
        box: { ...emptyDrumsBox },
        typography: stageplanPrintGeometry.typography,
      }).widthMm,
      3,
    );
    // Poloha středu na měřítku pořád závisí — spočítej ho z aktuálního plánu,
    // ne z opsaného čísla, které by se rozešlo s další změnou stopy.
    const mmPerM = plan.stage.widthMm / NOMINAL_STAGE.widthM;
    expect((box?.xMm ?? 0) + (box?.widthMm ?? 0) / 2).toBeCloseTo(
      6 * mmPerM + plan.stage.xMm,
      2,
    );
    // Osa y roste od upstage hrany k publiku (R4).
    expect(
      (box?.yMm ?? 0) + (box?.heightMm ?? 0) / 2 - plan.stage.yMm,
    ).toBeCloseTo(1.2 * mmPerM, 2);
  });

  it("pads the box symmetrically and lifts the power row off the bullets", () => {
    const plan = buildStageplanPlan(
      emptyStageplan({
        stage: null,
        blocks: [
          {
            slot: "drums",
            centerXM: 6,
            centerYM: 4,
            widthM: 2.8,
            depthM: 1.6,
            rotationDeg: 0,
          },
        ],
      }),
    );

    const lineMm =
      (plan.typography.fontSizePt * plan.typography.lineHeight * 25.4) / 72;
    const padMm = (plan.typography.padPt * 25.4) / 72;
    const titleGapMm = (plan.typography.titleGapPt * 25.4) / 72;

    // Hlavička + mezera + jedna odrážka (Drum riser), odsazení 6 pt nahoře i dole.
    expect(plan.boxes[0]?.heightMm).toBeCloseTo(
      2 * padMm + lineMm + titleGapMm + lineMm,
      4,
    );
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
    ).toThrow(
      /overflow[\s\S]*Block drums extends past the area — move it closer to the centre of the stage in the editor\./,
    );
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
    // Finding 1: zóny 1,5 × 1,5 m jsou 1,8 m od sebe (osa X), takže samy o
    // sobě nekolidují. Box po R3 roste podle svého textu, ne podle podlahy
    // (minBoxWidthMm už šířku netáhne) — proto mu dáváme reálný obsah (pár
    // odrážek u bicích i basy), aby na tuhle vzdálenost nevešel: artefakt
    // textu, ne stav uložený v rozmístění, a export na něm musí spadnout.
    expect(() =>
      buildStageplanPlan({
        ...emptyStageplan({
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
              centerXM: 6.8,
              centerYM: 4,
              widthM: 1.5,
              depthM: 1.5,
              rotationDeg: 0,
            },
          ],
        }),
        inputs: [
          { channelNo: 1, label: "Kick", group: "drums" },
          { channelNo: 2, label: "Snare", group: "drums" },
          { channelNo: 3, label: "Hi-hat", group: "drums" },
          { channelNo: 5, label: "Bass DI", group: "bass" },
        ],
      }),
    ).toThrow(
      /collision: drums × bass\. Blocks overlap on paper — rearrange them in the editor\./,
    );
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

  it("does not mark the lead vocal box and renders power as a line", () => {
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

  it("puts a full empty line above the power row (R8)", () => {
    const html = renderStageplanSection({
      stageplan: {
        ...emptyStageplan({
          stage: null,
          blocks: [
            {
              slot: "keys",
              centerXM: 6,
              centerYM: 4,
              widthM: 2.7,
              depthM: 1.4,
              rotationDeg: 0,
            },
          ],
        }),
        powerByRole: {
          keys: { hasPowerBadge: true, powerBadgeText: "1x 230V" },
        },
      },
    } as unknown as DocumentViewModel);

    expect(html).toContain(
      '<div class="stageplanGap"></div><div class="stageplanPower">1x 230V</div>',
    );
  });

  it("keeps the print scale width-bound for the default arrangement", () => {
    // Tvrzení, na kterém rezerva stojí: měřítko je min(šířková, výšková) mez a
    // váže ho šířka. Kdyby to přestalo platit, ubraná výška by plán zmenšila.
    const stageplan = emptyStageplan(
      buildDefaultLayout({ slots: STAGEPLAN_BLOCK_SLOTS, stage: null }),
    );
    const plan = buildStageplanPlan(stageplan);
    const mmPerM = plan.stage.widthMm / NOMINAL_STAGE.widthM;
    const heightBound =
      stageplanPrintGeometry.area.heightMm /
      (NOMINAL_STAGE.depthM + 2 * OVERHANG_TOLERANCE_M);

    expect(mmPerM).toBeLessThan(heightBound);
  });
});

describe("stageplan band leader line (R9)", () => {
  function vmWith(isLeader: boolean): DocumentViewModel["stageplan"] {
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
      lineupByRole: { bass: { firstName: "Matěj", isBandLeader: isLeader } },
    };
  }

  it("prints the role under the name instead of an asterisk", () => {
    const html = renderStageplanSection({
      stageplan: vmWith(true),
    } as unknown as DocumentViewModel);

    expect(html).toContain(
      '<div class="stageplanBoxHeader">BASS – MATĚJ</div>',
    );
    expect(html).toContain('<div class="stageplanBoxRole">BANDLEADER</div>');
  });

  it("leaves the box alone when nobody in it leads the band", () => {
    const html = renderStageplanSection({
      stageplan: vmWith(false),
    } as unknown as DocumentViewModel);

    expect(html).not.toContain("stageplanBoxRole");
    expect(html).not.toContain("*");
  });

  it("drops the legend under the plan entirely", () => {
    // Vysvětlivka i její bezpodmínečná rezerva výšky zanikly — plán tím
    // získal zpátky ~2,4 mm a rozpočet o žádném řádku pod sebou neví.
    const html = renderStageplanSection({
      stageplan: vmWith(true),
    } as unknown as DocumentViewModel);

    expect(html).not.toContain("stageplanLegend");
    expect(html).not.toContain("KAPELNÍK");
  });

  it("puts the role line directly under the header, before the bullet gap", () => {
    // Jméno a role patří k sobě: mezi ně mezera nepatří, pod ně ano (R3).
    const html = renderStageplanSection({
      stageplan: {
        ...vmWith(true),
        inputs: [
          {
            channelNo: 5,
            label: "Bass DI",
            group: "bass",
            ownerRole: "bass",
          },
        ],
      },
    } as unknown as DocumentViewModel);

    const roleIndex = html.indexOf("stageplanBoxRole");
    const gapIndex = html.indexOf("stageplanTitleGap");
    const headerIndex = html.indexOf("stageplanBoxHeader");

    expect(headerIndex).toBeLessThan(roleIndex);
    expect(roleIndex).toBeLessThan(gapIndex);
  });
});
