import type {
  DocumentViewModel,
  StageplanStageSize,
} from "../../../domain/model/types.js";
import {
  type StageplanPrintBox,
  buildPdfStageplanPrintModel,
} from "../../../domain/pipeline/pdf/buildPdfStageplanPrintModel.js";
import { countStageplanBoxLines } from "../../../domain/pipeline/pdf/countStageplanBoxLines.js";
import {
  type PrintRect,
  findPrintCollisions,
  rectAabbMm,
} from "../../../domain/stageplan/print/printCollisions.js";
import {
  type PrintTypography,
  computePrintFootprintMm,
} from "../../../domain/stageplan/print/printFootprint.js";
import { resolvePrintScale } from "../../../domain/stageplan/print/printScale.js";
import { parsePt, pdfChromeHeights, pdfLayout } from "../layout.js";
import {
  type StageplanRenderOptions,
  resolveStageplanRenderOptions,
} from "../stageplanRenderOptions.js";

const MM_TO_PT = 72 / 25.4;

function ptToMm(pt: number): number {
  return pt / MM_TO_PT;
}

function pxToMm(px: number): number {
  return ptToMm(px * 0.75); // 1px = 0.75pt (96px = 72pt)
}

const containerMarginTopPt = 24;
const containerPadPt = 24;
/** .stageplanContainer border-width — konstanta pro styles.ts i pro rozpočet. */
const containerBorderPx = 1;
const captionGapPt = 4;
/**
 * Řádek popisku rozměru pódia se rezervuje vždy, i když se rozměr netiskne —
 * jinak by měřítko plánu záviselo na tom, jestli uživatel rozměr vyplnil (R6).
 */
const captionHeightPt =
  parsePt(pdfLayout.typography.tableHead.size) *
    pdfLayout.typography.tableHead.lineHeight +
  captionGapPt;

/**
 * Finding 1 (F4): .stageplanContainer je inline-block, takže když areaWidthMm
 * nesedí s paddingem a rámečkem, je kontejner širší než tiskové zrcadlo a
 * Chromium na to reaguje tichým zmenšením *celého* dokumentu. Odvozovat, ne
 * opisovat.
 */
const areaWidthMm =
  pdfLayout.page.contentWidthMm -
  2 * ptToMm(containerPadPt) -
  2 * pxToMm(containerBorderPx);

const availableHeightMm =
  pdfLayout.page.contentHeightMm -
  pdfChromeHeights.headerMm -
  pdfChromeHeights.footerMm;

const areaHeightMm =
  availableHeightMm -
  ptToMm(containerMarginTopPt) -
  2 * ptToMm(containerPadPt) -
  2 * pxToMm(containerBorderPx) -
  ptToMm(captionHeightPt);

/**
 * Šířka dnešního čtyřsloupcového boxu. Není to odhad — je to geometrie, o
 * které z dosavadního exportu víme, že se do ní odrážky při 8 pt vejdou (R3).
 */
const minBoxWidthMm = (areaWidthMm - 2 * 2 - 3 * 4.5) / 4;

const bulletSpacingPx = 4;

const printTypography: PrintTypography = {
  fontSizePt: parsePt(pdfLayout.typography.table.size) - 1,
  lineHeight: 1.25,
  titleGapPt: 6,
  padBottomPt: parsePt(pdfLayout.table.padY),
  minBoxWidthMm,
};

/** Co potřebuje editor, aby si tiskovou stopu spočítal stejnou funkcí (R12). */
export const stageplanPrintGeometry = {
  area: { widthMm: areaWidthMm, heightMm: areaHeightMm },
  typography: printTypography,
} as const;

/** Konstanty pro styles.ts — CSS a rozpočet se nesmí rozejít. */
export const stageplanLayout = {
  containerMarginTop: `${containerMarginTopPt}pt`,
  containerPad: `${containerPadPt}pt`,
  containerBorderPx,
  areaWidthMm,
  areaHeightMm,
  captionGap: `${captionGapPt}pt`,
  captionSize: pdfLayout.typography.tableHead.size,
  captionTracking: pdfLayout.typography.tableHead.tracking,
  padX: pdfLayout.table.padX,
  padY: pdfLayout.table.padY,
  boxTitleGap: `${printTypography.titleGapPt}pt`,
  boxPaddingBottom: `${printTypography.padBottomPt}pt`,
  textSize: `${printTypography.fontSizePt}pt`,
  textLineHeight: printTypography.lineHeight,
  bulletSpacingPx,
} as const;

export type StageplanBoxPlan = StageplanPrintBox & {
  /** Levý horní roh neotočeného boxu v souřadnicích kontejneru. */
  readonly xMm: number;
  readonly yMm: number;
  readonly widthMm: number;
  readonly heightMm: number;
  readonly rotationDeg: number;
  readonly isLeadVocal: boolean;
};

export type StageplanPlan = {
  readonly container: { readonly widthMm: number; readonly heightMm: number };
  readonly stage: {
    readonly xMm: number;
    readonly yMm: number;
    readonly widthMm: number;
    readonly heightMm: number;
    readonly caption: string | null;
  };
  readonly typography: PrintTypography & { readonly bulletSpacingPx: number };
  readonly boxes: readonly StageplanBoxPlan[];
};

function formatStageCaption(stage: StageplanStageSize | null): string | null {
  if (!stage) return null;
  const format = (value: number) => value.toFixed(1).replace(".", ",");
  return `PÓDIUM ${format(stage.widthM)} × ${format(stage.depthM)} m`;
}

export function buildStageplanPlan(
  vm: DocumentViewModel["stageplan"],
  options?: Partial<StageplanRenderOptions>,
): StageplanPlan {
  const resolvedOptions = resolveStageplanRenderOptions(options);
  const printModel = buildPdfStageplanPrintModel(vm, {
    hideMusicianNames: resolvedOptions.hideMusicianNames,
  });
  const scale = resolvePrintScale({
    stage: vm.layout.stage,
    blocks: vm.layout.blocks,
    area: stageplanPrintGeometry.area,
    minBoxWidthMm: printTypography.minBoxWidthMm,
  });

  const rects: PrintRect[] = vm.layout.blocks.map((block) => {
    const printBox = printModel.boxesBySlot[block.slot];
    const footprint = computePrintFootprintMm({
      lineCount: countStageplanBoxLines(printBox),
      hasPower: printBox.hasPowerBadge,
      zone: block,
      mmPerM: scale.mmPerM,
      typography: printTypography,
    });

    return {
      slot: block.slot,
      centerXMm: scale.toMm(block.centerXM),
      centerYMm: scale.toMm(block.centerYM),
      widthMm: footprint.widthMm,
      heightMm: footprint.heightMm,
      rotationDeg: block.rotationDeg,
    };
  });

  const collisions = findPrintCollisions(rects);
  if (collisions.length > 0) {
    const pairs = collisions.map(([a, b]) => `${a} × ${b}`).join(", ");
    throw new Error(
      `Stageplan print collision: ${pairs}. Bloky se na papíře překrývají — přerovnej rozmístění v editoru.`,
    );
  }

  // Union bbox rámu pódia a všech boxů. Přerostlý box nesmí kontejner rozšířit
  // nad zrcadlo, jinak Chromium zmenší celý dokument (past z F4).
  let minXMm = 0;
  let minYMm = 0;
  let maxXMm = scale.planWidthMm;
  let maxYMm = scale.planHeightMm;
  for (const rect of rects) {
    const aabb = rectAabbMm(rect);
    minXMm = Math.min(minXMm, aabb.minXMm);
    minYMm = Math.min(minYMm, aabb.minYMm);
    maxXMm = Math.max(maxXMm, aabb.maxXMm);
    maxYMm = Math.max(maxYMm, aabb.maxYMm);
  }

  const container = { widthMm: maxXMm - minXMm, heightMm: maxYMm - minYMm };
  if (container.widthMm > areaWidthMm || container.heightMm > areaHeightMm) {
    throw new Error(
      `Stageplan layout overflow: required ${container.widthMm.toFixed(2)} × ${container.heightMm.toFixed(2)}mm exceeds available ${areaWidthMm.toFixed(2)} × ${areaHeightMm.toFixed(2)}mm.`,
    );
  }

  return {
    container,
    stage: {
      xMm: -minXMm,
      yMm: -minYMm,
      widthMm: scale.planWidthMm,
      heightMm: scale.planHeightMm,
      caption: formatStageCaption(vm.layout.stage),
    },
    typography: { ...printTypography, bulletSpacingPx },
    boxes: rects.map((rect) => {
      const printBox = printModel.boxesBySlot[rect.slot];
      return {
        ...printBox,
        xMm: rect.centerXMm - minXMm - rect.widthMm / 2,
        yMm: rect.centerYMm - minYMm - rect.heightMm / 2,
        widthMm: rect.widthMm,
        heightMm: rect.heightMm,
        rotationDeg: rect.rotationDeg,
        isLeadVocal:
          rect.slot === "lead_voc_1" || rect.slot === "lead_voc_2",
      };
    }),
  };
}

function renderBox(
  box: StageplanBoxPlan,
  typography: StageplanPlan["typography"],
): string {
  const lines: string[] = [
    `<div class="stageplanBoxHeader">${box.header}</div>`,
  ];

  const hasBody =
    box.inputBullets.length > 0 ||
    box.monitorBullets.length > 0 ||
    box.extraBullets.length > 0;
  if (hasBody) lines.push(`<div class="stageplanTitleGap"></div>`);

  const addBullets = (bullets: string[]) => {
    for (const bullet of bullets) {
      lines.push(
        `<div class="stageplanBoxLine"><span class="bullet" style="margin-right:${typography.bulletSpacingPx}px;">•</span><span class="text">${bullet}</span></div>`,
      );
    }
  };

  addBullets(box.inputBullets);
  if (box.monitorBullets.length > 0) {
    if (box.inputBullets.length > 0)
      lines.push(`<div class="stageplanGap"></div>`);
    addBullets(box.monitorBullets);
  }
  if (box.extraBullets.length > 0) {
    if (box.monitorBullets.length > 0 || box.inputBullets.length > 0)
      lines.push(`<div class="stageplanGap"></div>`);
    addBullets(box.extraBullets);
  }
  // Napájení je řádek v toku, ne badge v rohu — výška boxu s ním počítá (R5).
  if (box.hasPowerBadge) {
    lines.push(`<div class="stageplanPower">${box.powerBadgeText}</div>`);
  }

  const leadClass = box.isLeadVocal ? " stageplanBox--lead" : "";
  return `<div class="stageplanBox${leadClass}" style="left:${box.xMm}mm; top:${box.yMm}mm; width:${box.widthMm}mm; height:${box.heightMm}mm; transform:rotate(${box.rotationDeg}deg);">${lines.join("")}</div>`;
}

export function renderStageplanSection(
  vm: DocumentViewModel,
  options?: Partial<StageplanRenderOptions>,
): string {
  const plan = buildStageplanPlan(vm.stageplan, options);
  const boxesHtml = plan.boxes
    .map((box) => renderBox(box, plan.typography))
    .join("\n");

  return `
<section class="stageplanSection">\n  <div class="stageplanCaption">${plan.stage.caption ?? ""}</div>\n  <div class="stageplanContainer" style="width:${plan.container.widthMm}mm; height:${plan.container.heightMm}mm;">\n    <div class="stageplanStage" style="left:${plan.stage.xMm}mm; top:${plan.stage.yMm}mm; width:${plan.stage.widthMm}mm; height:${plan.stage.heightMm}mm;">\n      <div class="stageplanDownstage">DOWNSTAGE · PUBLIKUM</div>\n    </div>\n    ${boxesHtml}\n  </div>\n</section>`.trim();
}
