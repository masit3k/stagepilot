import type { DocumentViewModel } from "../../../domain/model/types.js";
import {
  type StageplanPrintBox,
  type StageplanPrintSlot,
  buildPdfStageplanPrintModel,
} from "../../../domain/pipeline/pdf/buildPdfStageplanPrintModel.js";
import { parsePt, pdfLayout } from "../layout.js";
import {
  type StageplanRenderOptions,
  resolveStageplanRenderOptions,
} from "../stageplanRenderOptions.js";

const MM_TO_PT = 72 / 25.4;

type StageplanRoleSlot = StageplanPrintSlot;
type StageplanLayoutId = "layout_5_party" | "layout_6_2_vocs";

type StageplanLayoutDefinition = {
  id: StageplanLayoutId;
  topRow: ReadonlyArray<{ slot: StageplanRoleSlot; column: 0 | 1 | 2 }>;
  bottomRow: {
    columns: number;
    gutterXmm?: number;
    sideInsetXmm?: number;
    slots: ReadonlyArray<StageplanRoleSlot>;
    typography: {
      fontSizeDeltaPt: number;
      lineHeightDelta: number;
      bulletSpacingPx: number;
    };
  };
};

function parseMm(value: string): number {
  const m = /([0-9.]+)\s*mm/i.exec(value);
  if (!m) {
    throw new Error(`Stageplan layout expects mm values, got "${value}"`);
  }
  return Number.parseFloat(m[1] ?? "0");
}

const stageplanTextLineHeight = 1.3;
const boxTitleGapPt = 6;
const boxPaddingBottomPt = parsePt(pdfLayout.table.padY);
const stageplanTextSizePt = parsePt(pdfLayout.typography.table.size);
const stageplanLineHeightPt = stageplanTextSizePt * stageplanTextLineHeight;
const powerBadgeMarginTopPt = 0;
const powerBadgeHeightPt = stageplanLineHeightPt + boxPaddingBottomPt * 2;
const powerBadgeReservedPt = powerBadgeHeightPt + powerBadgeMarginTopPt;
const powerBadgeTextGapPt = stageplanLineHeightPt;
const powerBadgeSpacerHeightPt = powerBadgeReservedPt + powerBadgeTextGapPt;

const stageplanLayout = {
  textSize: pdfLayout.typography.table.size,
  textLineHeight: stageplanTextLineHeight,
  padX: pdfLayout.table.padX,
  padY: pdfLayout.table.padY,
  boxTitleGap: `${boxTitleGapPt}pt`,
  boxPaddingBottom: `${boxPaddingBottomPt}pt`,
  powerBadgeSpacerHeight: `${powerBadgeSpacerHeightPt}pt`,
  containerMarginTop: "24pt",
  containerPad: "24pt",
  areaWidthMm: 180,
  sideInsetXmm: 0,
  boxWidthMm: 55,
  gapXmm: 7.5,
  gapYmm: 8,
  powerCellColor: "#F7E65A",
} as const;

const STAGEPLAN_LAYOUTS: Record<StageplanLayoutId, StageplanLayoutDefinition> =
  {
    layout_5_party: {
      id: "layout_5_party",
      topRow: [
        { slot: "drums", column: 1 },
        { slot: "bass", column: 2 },
      ],
      bottomRow: {
        columns: 3,
        slots: ["guitar", "lead_voc_1", "keys"],
        typography: {
          fontSizeDeltaPt: 0,
          lineHeightDelta: 0,
          bulletSpacingPx: 6,
        },
      },
    },
    layout_6_2_vocs: {
      id: "layout_6_2_vocs",
      topRow: [
        { slot: "drums", column: 1 },
        { slot: "bass", column: 2 },
      ],
      bottomRow: {
        columns: 4,
        gutterXmm: 4.5,
        sideInsetXmm: 2,
        slots: ["guitar", "lead_voc_1", "lead_voc_2", "keys"],
        typography: {
          fontSizeDeltaPt: -1,
          lineHeightDelta: -0.05,
          bulletSpacingPx: 4,
        },
      },
    },
  };

type StageplanBoxContent = StageplanPrintBox & {
  row: "top" | "bottom";
  typography: {
    fontSizePt: number;
    lineHeight: number;
    bulletSpacingPx: number;
    titleGapPt: number;
    boxPaddingBottomPt: number;
    powerBadgeSpacerHeightPt: number;
  };
};

type StageplanBoxPlan = StageplanBoxContent & {
  position: { xMm: number; yMm: number; widthMm: number; heightMm: number };
};

type StageplanBoxPosition = {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
};

type BottomRowGeometryDebug = {
  layoutId: StageplanLayoutId;
  cols: number;
  gutterMm: number;
  insetMm: number;
  availableMm: number;
  blockWidthMm: number;
};

function computeTopRowGeometry(args: {
  layout: typeof stageplanLayout;
  topRow: StageplanLayoutDefinition["topRow"];
  topRowYMm: number;
  topHeightMm: number;
}): Map<StageplanRoleSlot, StageplanBoxPosition> {
  const { layout, topRow, topRowYMm, topHeightMm } = args;
  const topX = [
    0,
    layout.boxWidthMm + layout.gapXmm,
    2 * (layout.boxWidthMm + layout.gapXmm),
  ] as const;
  const positions = new Map<StageplanRoleSlot, StageplanBoxPosition>();
  for (const item of topRow) {
    positions.set(item.slot, {
      xMm: topX[item.column],
      yMm: topRowYMm,
      widthMm: layout.boxWidthMm,
      heightMm: topHeightMm,
    });
  }
  return positions;
}

function computeBottomRowGeometry(args: {
  layoutId: StageplanLayoutId;
  defaults: typeof stageplanLayout;
  bottomRow: StageplanLayoutDefinition["bottomRow"];
  stageAreaLeftMm: number;
  stageAreaWidthMm: number;
  bottomRowYMm: number;
  bottomHeightMm: number;
}): {
  positions: Map<StageplanRoleSlot, StageplanBoxPosition>;
  debug: BottomRowGeometryDebug;
} {
  const {
    layoutId,
    defaults,
    bottomRow,
    stageAreaLeftMm,
    stageAreaWidthMm,
    bottomRowYMm,
    bottomHeightMm,
  } = args;
  const cols = bottomRow.columns;
  const gutterMm = bottomRow.gutterXmm ?? defaults.gapXmm;
  const insetMm = bottomRow.sideInsetXmm ?? defaults.sideInsetXmm;
  const availableMm = stageAreaWidthMm - 2 * insetMm;
  const blockWidthMm = (availableMm - (cols - 1) * gutterMm) / cols;

  const positions = new Map<StageplanRoleSlot, StageplanBoxPosition>();
  bottomRow.slots.forEach((slot, index) => {
    positions.set(slot, {
      xMm: stageAreaLeftMm + insetMm + index * (blockWidthMm + gutterMm),
      yMm: bottomRowYMm,
      widthMm: blockWidthMm,
      heightMm: bottomHeightMm,
    });
  });

  return {
    positions,
    debug: {
      layoutId,
      cols,
      gutterMm,
      insetMm,
      availableMm,
      blockWidthMm,
    },
  };
}

export type StageplanPlan = {
  budget: { totalHeightMm: number; availableHeightMm: number };
  textStyle: { fontSize: string; lineHeight: number };
  layout: typeof stageplanLayout & {
    areaHeightMm: number;
    layoutId: StageplanLayoutId;
  };
  boxes: StageplanBoxPlan[];
};

export function matchStageplanLayout(
  vm: DocumentViewModel["stageplan"],
): StageplanLayoutDefinition {
  const leadCount = vm.leadVocals?.length ?? 0;
  if (leadCount >= 2) return STAGEPLAN_LAYOUTS.layout_6_2_vocs;
  return STAGEPLAN_LAYOUTS.layout_5_party;
}

function buildStageplanBoxes(
  vm: DocumentViewModel["stageplan"],
  options?: Partial<StageplanRenderOptions>,
): {
  layout: StageplanLayoutDefinition;
  boxes: StageplanBoxPlan[];
  areaHeightMm: number;
} {
  const resolvedOptions = resolveStageplanRenderOptions(options);
  const selectedLayout = matchStageplanLayout(vm);
  const allSlots = [
    ...selectedLayout.topRow.map((item) => item.slot),
    ...selectedLayout.bottomRow.slots,
  ];

  const printModel = buildPdfStageplanPrintModel(vm, {
    hideMusicianNames: resolvedOptions.hideMusicianNames,
  });
  const topTypography = {
    fontSizePt: parsePt(stageplanLayout.textSize),
    lineHeight: stageplanLayout.textLineHeight,
    bulletSpacingPx: 6,
    titleGapPt: parsePt(stageplanLayout.boxTitleGap),
    boxPaddingBottomPt: parsePt(stageplanLayout.boxPaddingBottom),
    powerBadgeSpacerHeightPt: parsePt(stageplanLayout.powerBadgeSpacerHeight),
  };
  const bottomTypography = {
    fontSizePt:
      topTypography.fontSizePt +
      selectedLayout.bottomRow.typography.fontSizeDeltaPt,
    lineHeight:
      topTypography.lineHeight +
      selectedLayout.bottomRow.typography.lineHeightDelta,
    bulletSpacingPx: selectedLayout.bottomRow.typography.bulletSpacingPx,
    titleGapPt: topTypography.titleGapPt,
    boxPaddingBottomPt: topTypography.boxPaddingBottomPt,
    powerBadgeSpacerHeightPt:
      parsePt(stageplanLayout.powerBadgeSpacerHeight) +
      selectedLayout.bottomRow.typography.fontSizeDeltaPt *
        (topTypography.lineHeight +
          selectedLayout.bottomRow.typography.lineHeightDelta),
  };

  const boxContents: StageplanBoxContent[] = allSlots.map((slot) => {
    const isBottom = selectedLayout.bottomRow.slots.includes(slot);
    const printBox = printModel.boxesBySlot[slot];

    return {
      ...printBox,
      slot,
      row: isBottom ? "bottom" : "top",
      typography: isBottom ? bottomTypography : topTypography,
    };
  });

  const countRenderedLines = (box: StageplanBoxContent): number => {
    const inputLines = box.inputBullets.length;
    const monitorLines = box.monitorBullets.length;
    const extraLines = box.extraBullets.length;
    let lines = inputLines + monitorLines + extraLines;
    if (monitorLines > 0 && inputLines > 0) lines += 1;
    if (extraLines > 0 && (monitorLines > 0 || inputLines > 0)) lines += 1;
    return lines;
  };

  const calculateRequiredHeightPt = (box: StageplanBoxContent): number => {
    const hasBody =
      box.inputBullets.length > 0 ||
      box.monitorBullets.length > 0 ||
      box.extraBullets.length > 0;
    const lines = countRenderedLines(box);
    const lineHeightPt = box.typography.fontSizePt * box.typography.lineHeight;
    const baseHeight =
      box.typography.titleGapPt +
      lineHeightPt +
      (hasBody ? box.typography.titleGapPt : 0) +
      lines * lineHeightPt;
    const bottomPart = box.hasPowerBadge
      ? box.typography.powerBadgeSpacerHeightPt
      : box.typography.boxPaddingBottomPt;
    return baseHeight + bottomPart;
  };

  const topBoxes = boxContents.filter((box) => box.row === "top");
  const bottomBoxes = boxContents.filter((box) => box.row === "bottom");
  const topHeightMm =
    Math.max(...topBoxes.map((box) => calculateRequiredHeightPt(box))) /
    MM_TO_PT;
  const bottomHeightMm =
    Math.max(...bottomBoxes.map((box) => calculateRequiredHeightPt(box))) /
    MM_TO_PT;

  const topRowY = 0;
  const bottomRowY = topHeightMm + stageplanLayout.gapYmm;
  const stageAreaLeftMm = 0;

  const positionBySlot = new Map<StageplanRoleSlot, StageplanBoxPosition>();
  const topPositions = computeTopRowGeometry({
    layout: stageplanLayout,
    topRow: selectedLayout.topRow,
    topRowYMm: topRowY,
    topHeightMm,
  });
  const bottomGeometry = computeBottomRowGeometry({
    layoutId: selectedLayout.id,
    defaults: stageplanLayout,
    bottomRow: selectedLayout.bottomRow,
    stageAreaLeftMm,
    stageAreaWidthMm: stageplanLayout.areaWidthMm,
    bottomRowYMm: bottomRowY,
    bottomHeightMm,
  });
  for (const [slot, position] of topPositions)
    positionBySlot.set(slot, position);
  for (const [slot, position] of bottomGeometry.positions)
    positionBySlot.set(slot, position);

  return {
    layout: selectedLayout,
    areaHeightMm: topHeightMm + stageplanLayout.gapYmm + bottomHeightMm,
    boxes: boxContents.map((box) => {
      const position = positionBySlot.get(box.slot);
      if (!position) {
        throw new Error(`Missing stageplan position for slot "${box.slot}".`);
      }
      return { ...box, position };
    }),
  };
}

export function buildStageplanPlan(
  vm: DocumentViewModel["stageplan"],
  options?: Partial<StageplanRenderOptions>,
): StageplanPlan {
  const built = buildStageplanBoxes(vm, options);
  const areaHeightMm = built.areaHeightMm;
  const availableHeightMm =
    297 - parseMm(pdfLayout.page.margins.top) - parseMm(pdfLayout.page.margins.bottom);
  const containerMarginTopMm =
    parsePt(stageplanLayout.containerMarginTop) / MM_TO_PT;
  const containerPadMm = (parsePt(stageplanLayout.containerPad) / MM_TO_PT) * 2;
  const totalHeightMm = containerMarginTopMm + containerPadMm + areaHeightMm;

  if (totalHeightMm > availableHeightMm) {
    throw new Error(
      `Stageplan layout overflow: required ${totalHeightMm.toFixed(2)}mm exceeds available ${availableHeightMm.toFixed(2)}mm.`,
    );
  }
  return {
    budget: { totalHeightMm, availableHeightMm },
    textStyle: {
      fontSize: stageplanLayout.textSize,
      lineHeight: stageplanLayout.textLineHeight,
    },
    layout: {
      ...stageplanLayout,
      areaHeightMm,
      layoutId: built.layout.id,
    },
    boxes: built.boxes,
  };
}

export function renderStageplanSection(
  vm: DocumentViewModel,
  options?: Partial<StageplanRenderOptions>,
): string {
  const plan = buildStageplanPlan(vm.stageplan, options);
  const areaHeight = plan.layout.areaHeightMm;

  const boxesHtml = plan.boxes
    .map((box) => {
      const lines: string[] = [];
      lines.push(`<div class="stageplanBoxHeader">${box.header}</div>`);

      const hasBody =
        box.inputBullets.length > 0 ||
        box.monitorBullets.length > 0 ||
        box.extraBullets.length > 0;
      if (hasBody) {
        lines.push(
          `<div class="stageplanTitleGap" style="height:${box.typography.titleGapPt}pt;"></div>`,
        );
      }

      const addBullets = (bullets: string[]) => {
        for (const bullet of bullets) {
          lines.push(
            `<div class="stageplanBoxLine"><span class="bullet" style="margin-right:${box.typography.bulletSpacingPx}px;">•</span><span class="text">${bullet}</span></div>`,
          );
        }
      };

      addBullets(box.inputBullets);
      if (box.monitorBullets.length > 0) {
        if (box.inputBullets.length > 0) {
          lines.push(
            `<div class="stageplanGap" style="height:calc(1em * ${box.typography.lineHeight});"></div>`,
          );
        }
        addBullets(box.monitorBullets);
      }
      if (box.extraBullets.length > 0) {
        if (box.monitorBullets.length > 0 || box.inputBullets.length > 0) {
          lines.push(
            `<div class="stageplanGap" style="height:calc(1em * ${box.typography.lineHeight});"></div>`,
          );
        }
        addBullets(box.extraBullets);
      }

      const powerHtml = box.hasPowerBadge
        ? `<div class="stageplanPower">${box.powerBadgeText}</div>`
        : "";

      if (box.hasPowerBadge) {
        lines.push(
          `<div class="stageplanPowerGap" style="height:${box.typography.powerBadgeSpacerHeightPt}pt;"></div>`,
        );
      }

      const powerClass = box.hasPowerBadge ? " stageplanBox--withPower" : "";

      return `
<div class="stageplanBox${powerClass}" style="left:${box.position.xMm}mm; top:${box.position.yMm}mm; width:${box.position.widthMm}mm; height:${box.position.heightMm}mm; font-size:${box.typography.fontSizePt}pt; line-height:${box.typography.lineHeight};">\n  ${lines.join("")}\n  ${powerHtml}\n</div>`.trim();
    })
    .join("\n");

  return `
<section class="stageplanSection">\n  <div class="stageplanContainer">\n    <div class="stageplanArea" style="height:${areaHeight}mm;">\n      ${boxesHtml}\n    </div>\n  </div>\n</section>`.trim();
}

export { stageplanLayout };

export const __stageplanTestExports = { computeBottomRowGeometry };
