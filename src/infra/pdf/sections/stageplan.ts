import type {
  Group,
  StageplanInstrument,
  StageplanInstrumentKey,
} from "../../../domain/model/types.js";
import type { DocumentViewModel } from "../../../domain/model/types.js";
import { formatMonitorBullets, formatStageplanBoxHeader } from "../../../domain/formatters/index.js";
import type { StageplanLine } from "../../../domain/stageplan/stereoCollapse.js";
import { collapseStereoForStageplan } from "../../../domain/stageplan/stereoCollapse.js";
import { resolveStageplanRoleForInput } from "../../../domain/stageplan/resolveStageplanRoleForInput.js";
import { pdfLayout } from "../layout.js";

const MM_TO_PT = 72 / 25.4;

type StageplanRoleSlot = "drums" | "bass" | "guitar" | "keys" | "lead_voc_1" | "lead_voc_2";
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

function parsePt(value: string): number {
  const m = /([0-9.]+)\s*pt/i.exec(value);
  if (!m) {
    throw new Error(`Stageplan layout expects pt values, got "${value}"`);
  }
  return Number.parseFloat(m[1] ?? "0");
}

function parseMm(value: string): number {
  const m = /([0-9.]+)\s*mm/i.exec(value);
  if (!m) {
    throw new Error(`Stageplan layout expects mm values, got "${value}"`);
  }
  return Number.parseFloat(m[1] ?? "0");
}

const headingSizePt = parsePt(pdfLayout.typography.title.size) - 6;
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
  headingSize: `${headingSizePt}pt`,
  headingWeight: 700,
  textSize: pdfLayout.typography.table.size,
  textLineHeight: stageplanTextLineHeight,
  padX: pdfLayout.table.padX,
  padY: pdfLayout.table.padY,
  boxTitleGap: `${boxTitleGapPt}pt`,
  boxPaddingBottom: `${boxPaddingBottomPt}pt`,
  powerBadgeSpacerHeight: `${powerBadgeSpacerHeightPt}pt`,
  sectionMarginTop: "16pt",
  containerMarginTop: "24pt",
  containerPad: "24pt",
  areaWidthMm: 180,
  sideInsetXmm: 0,
  boxWidthMm: 55,
  gapXmm: 7.5,
  gapYmm: 8,
  powerCellColor: "#F7E65A",
} as const;

const STAGEPLAN_LAYOUTS: Record<StageplanLayoutId, StageplanLayoutDefinition> = {
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

type StageplanBoxPlan = {
  slot: StageplanRoleSlot;
  row: "top" | "bottom";
  instrument: StageplanInstrument;
  header: string;
  inputBullets: string[];
  monitorBullets: string[];
  extraBullets: string[];
  hasPowerBadge: boolean;
  powerBadgeText: string;
  typography: {
    fontSizePt: number;
    lineHeight: number;
    bulletSpacingPx: number;
    titleGapPt: number;
    boxPaddingBottomPt: number;
    powerBadgeSpacerHeightPt: number;
  };
  position: { xMm: number; yMm: number; widthMm: number; heightMm: number };
};

type StageplanBoxContent = Omit<StageplanBoxPlan, "position">;

type StageplanBoxPosition = { xMm: number; yMm: number; widthMm: number; heightMm: number };

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
  const topX = [0, layout.boxWidthMm + layout.gapXmm, 2 * (layout.boxWidthMm + layout.gapXmm)] as const;
  const positions = new Map<StageplanRoleSlot, StageplanBoxPosition>();
  for (const item of topRow) {
    positions.set(item.slot, { xMm: topX[item.column], yMm: topRowYMm, widthMm: layout.boxWidthMm, heightMm: topHeightMm });
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
}): { positions: Map<StageplanRoleSlot, StageplanBoxPosition>; debug: BottomRowGeometryDebug } {
  const { layoutId, defaults, bottomRow, stageAreaLeftMm, stageAreaWidthMm, bottomRowYMm, bottomHeightMm } = args;
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
  heading: { text: string; fontSize: string; fontWeight: number };
  textStyle: { fontSize: string; lineHeight: number };
  layout: typeof stageplanLayout & { areaHeightMm: number; layoutId: StageplanLayoutId };
  boxes: StageplanBoxPlan[];
};

function resolveMonitorInstrument(output: string): StageplanInstrument | null {
  const normalized = output.trim().toLowerCase();
  if (normalized.startsWith("lead vocal")) return "Lead vocal";
  if (normalized.startsWith("lead voc")) return "Lead vocal";
  if (normalized.startsWith("guitar")) return "Guitar";
  if (normalized.startsWith("keys")) return "Keys";
  if (normalized.startsWith("bass")) return "Bass";
  if (normalized.startsWith("drums")) return "Drums";
  return null;
}

function resolveLeadVocalSlotLabel(label: string): "lead_voc_1" | "lead_voc_2" {
  const normalized = label.toLowerCase();
  if (/\b2\b/.test(normalized)) return "lead_voc_2";
  return "lead_voc_1";
}

function roleDataForSlot(
  vm: DocumentViewModel["stageplan"],
  slot: StageplanRoleSlot
): { instrument: StageplanInstrument; role: StageplanInstrumentKey; firstName: string | null; isBandLeader: boolean } {
  if (slot === "lead_voc_1" || slot === "lead_voc_2") {
    const leads = vm.leadVocals ?? [];
    const fallback = vm.lineupByRole.vocs;
    const lead = slot === "lead_voc_1" ? (leads[0] ?? fallback) : (leads[1] ?? null);
    return {
      instrument: "Lead vocal",
      role: "vocs",
      firstName: lead?.firstName ?? null,
      isBandLeader: lead?.isBandLeader ?? false,
    };
  }

  const bySlot: Record<Exclude<StageplanRoleSlot, "lead_voc_1" | "lead_voc_2">, { instrument: StageplanInstrument; role: StageplanInstrumentKey }> = {
    drums: { instrument: "Drums", role: "drums" },
    bass: { instrument: "Bass", role: "bass" },
    guitar: { instrument: "Guitar", role: "guitar" },
    keys: { instrument: "Keys", role: "keys" },
  };
  const meta = bySlot[slot];
  const person = vm.lineupByRole[meta.role];
  return {
    instrument: meta.instrument,
    role: meta.role,
    firstName: person?.firstName ?? null,
    isBandLeader: person?.isBandLeader ?? false,
  };
}

export function matchStageplanLayout(vm: DocumentViewModel["stageplan"]): StageplanLayoutDefinition {
  const leadCount = vm.leadVocals?.length ?? (vm.lineupByRole.vocs?.firstName ? 1 : 0);
  if (leadCount === 2) return STAGEPLAN_LAYOUTS.layout_6_2_vocs;
  if (leadCount > 2) {
    throw new Error(`Unsupported lead vocal count for stageplan layout: ${leadCount}`);
  }
  return STAGEPLAN_LAYOUTS.layout_5_party;
}

function buildStageplanBoxes(vm: DocumentViewModel["stageplan"]): { layout: StageplanLayoutDefinition; boxes: StageplanBoxPlan[]; areaHeightMm: number } {
  const selectedLayout = matchStageplanLayout(vm);
  const allSlots = [...selectedLayout.topRow.map((item) => item.slot), ...selectedLayout.bottomRow.slots];

  const inputBySlot = new Map<StageplanRoleSlot, Array<{ channelNo: number; label: string; group?: Group }>>();
  const monitorBySlot = new Map<StageplanRoleSlot, Array<{ no: number; label: string }>>();
  for (const slot of allSlots) {
    inputBySlot.set(slot, []);
    monitorBySlot.set(slot, []);
  }

  for (const input of vm.inputs) {
    const instrument = resolveStageplanRoleForInput(input);
    if (!instrument) continue;
    if (instrument === "Lead vocal") {
      const slot = resolveLeadVocalSlotLabel(input.label);
      inputBySlot.get(slot)?.push({ channelNo: input.channelNo, label: input.label, group: input.group });
      continue;
    }
    const slotByInstrument: Record<Exclude<StageplanInstrument, "Lead vocal">, StageplanRoleSlot> = {
      Drums: "drums",
      Bass: "bass",
      Guitar: "guitar",
      Keys: "keys",
    };
    inputBySlot.get(slotByInstrument[instrument])?.push({ channelNo: input.channelNo, label: input.label, group: input.group });
  }

  for (const output of vm.monitorOutputs) {
    const instrument = resolveMonitorInstrument(output.output);
    if (!instrument) continue;
    const bullets = formatMonitorBullets(output.note, output.no);
    if (instrument === "Lead vocal") {
      const slot = resolveLeadVocalSlotLabel(output.output);
      for (const bullet of bullets) monitorBySlot.get(slot)?.push({ no: output.no, label: bullet });
      continue;
    }
    const slotByInstrument: Record<Exclude<StageplanInstrument, "Lead vocal">, StageplanRoleSlot> = {
      Drums: "drums",
      Bass: "bass",
      Guitar: "guitar",
      Keys: "keys",
    };
    for (const bullet of bullets) monitorBySlot.get(slotByInstrument[instrument])?.push({ no: output.no, label: bullet });
  }

  const buildInputLines = (items: Array<{ channelNo: number; label: string; group?: Group }>): StageplanLine[] =>
    items.map((item) => ({
      kind: "input",
      label: item.label,
      no: item.channelNo,
      group: item.group,
    }));

  const rankKeysStageplanInput = (label: string): number => {
    const normalized = label.trim().toLowerCase();
    if (normalized.startsWith("keys")) return 0;
    if (normalized.startsWith("synth (mono)") || normalized.startsWith("synth mono")) return 2;
    if (normalized.startsWith("synth")) return 1;
    return 3;
  };

  const isPadInput = (label: string): boolean => /pad/i.test(label);
  const isDummyInput = (label: string): boolean => /dummy/i.test(label);
  const isBackVocalDrums = (label: string): boolean => /back vocal\s*[-–—]\s*drums/i.test(label);
  const formatRange = (label: string, items: Array<{ channelNo: number }>): string | null => {
    if (items.length === 0) return null;
    const numbers = items.map((item) => item.channelNo);
    const min = Math.min(...numbers);
    const max = Math.max(...numbers);
    const range = min === max ? `${min}` : `${min}–${max}`;
    return `${label} (${range})`;
  };

  const topTypography = {
    fontSizePt: parsePt(stageplanLayout.textSize),
    lineHeight: stageplanLayout.textLineHeight,
    bulletSpacingPx: 6,
    titleGapPt: parsePt(stageplanLayout.boxTitleGap),
    boxPaddingBottomPt: parsePt(stageplanLayout.boxPaddingBottom),
    powerBadgeSpacerHeightPt: parsePt(stageplanLayout.powerBadgeSpacerHeight),
  };
  const bottomTypography = {
    fontSizePt: topTypography.fontSizePt + selectedLayout.bottomRow.typography.fontSizeDeltaPt,
    lineHeight: topTypography.lineHeight + selectedLayout.bottomRow.typography.lineHeightDelta,
    bulletSpacingPx: selectedLayout.bottomRow.typography.bulletSpacingPx,
    titleGapPt: topTypography.titleGapPt,
    boxPaddingBottomPt: topTypography.boxPaddingBottomPt,
    powerBadgeSpacerHeightPt: parsePt(stageplanLayout.powerBadgeSpacerHeight) +
      selectedLayout.bottomRow.typography.fontSizeDeltaPt * (topTypography.lineHeight + selectedLayout.bottomRow.typography.lineHeightDelta),
  };

  const boxContents: StageplanBoxContent[] = allSlots.map((slot) => {
    const isBottom = selectedLayout.bottomRow.slots.includes(slot);
    const roleData = roleDataForSlot(vm, slot);
    const powerBadge = vm.powerByRole[roleData.role];
    const header = formatStageplanBoxHeader({
      instrumentLabel: roleData.instrument,
      firstName: roleData.firstName,
      isBandLeader: roleData.isBandLeader,
    });

    const inputs = (inputBySlot.get(slot) ?? []).slice().sort((a, b) => {
      if (slot === "keys") {
        const rank = rankKeysStageplanInput(a.label) - rankKeysStageplanInput(b.label);
        if (rank !== 0) return rank;
      }
      return a.channelNo - b.channelNo;
    });
    const inputBullets =
      slot === "drums"
        ? (() => {
            const padInputs = inputs.filter((item) => isPadInput(item.label) && !isDummyInput(item.label));
            const backVocalInputs = inputs.filter((item) => isBackVocalDrums(item.label));
            const drumInputs = inputs.filter(
              (item) => item.group === "drums" && !isPadInput(item.label) && !isDummyInput(item.label) && !isBackVocalDrums(item.label)
            );
            const bullets: string[] = [];
            const drumRange = formatRange("Drums", drumInputs);
            const padRange = formatRange("PAD", padInputs);
            const padLines = buildInputLines(padInputs);
            const collapsedPadLines = collapseStereoForStageplan(padLines);
            const padStereoLine = padInputs.length === 2 && collapsedPadLines.length === 1 ? (collapsedPadLines[0]?.text ?? null) : null;
            if (drumRange) bullets.push(drumRange);
            if (padStereoLine) {
              bullets.push(padStereoLine);
            } else if (padRange) {
              bullets.push(padRange);
            }
            for (const item of backVocalInputs) {
              bullets.push(`${item.label} (${item.channelNo})`);
            }
            return bullets;
          })()
        : collapseStereoForStageplan(buildInputLines(inputs)).map((line) => line.text);

    const monitors = (monitorBySlot.get(slot) ?? []).slice().sort((a, b) => a.no - b.no).map((item) => item.label);
    const extraBullets: string[] = slot === "drums" ? ["Drum riser 3x2"] : [];

    return {
      slot,
      row: isBottom ? "bottom" : "top",
      instrument: roleData.instrument,
      header,
      inputBullets,
      monitorBullets: monitors,
      extraBullets,
      hasPowerBadge: powerBadge?.hasPowerBadge ?? false,
      powerBadgeText: powerBadge?.powerBadgeText ?? "",
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
    const hasBody = box.inputBullets.length > 0 || box.monitorBullets.length > 0 || box.extraBullets.length > 0;
    const lines = countRenderedLines(box);
    const lineHeightPt = box.typography.fontSizePt * box.typography.lineHeight;
    const baseHeight = box.typography.titleGapPt + lineHeightPt + (hasBody ? box.typography.titleGapPt : 0) + lines * lineHeightPt;
    const bottomPart = box.hasPowerBadge ? box.typography.powerBadgeSpacerHeightPt : box.typography.boxPaddingBottomPt;
    return baseHeight + bottomPart;
  };

  const topBoxes = boxContents.filter((box) => box.row === "top");
  const bottomBoxes = boxContents.filter((box) => box.row === "bottom");
  const topHeightMm = Math.max(...topBoxes.map((box) => calculateRequiredHeightPt(box))) / MM_TO_PT;
  const bottomHeightMm = Math.max(...bottomBoxes.map((box) => calculateRequiredHeightPt(box))) / MM_TO_PT;

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
  for (const [slot, position] of topPositions) positionBySlot.set(slot, position);
  for (const [slot, position] of bottomGeometry.positions) positionBySlot.set(slot, position);

  return {
    layout: selectedLayout,
    areaHeightMm: topHeightMm + stageplanLayout.gapYmm + bottomHeightMm,
    boxes: boxContents.map((box) => ({ ...box, position: positionBySlot.get(box.slot)! })),
  };
}

export function buildStageplanPlan(vm: DocumentViewModel["stageplan"]): StageplanPlan {
  const built = buildStageplanBoxes(vm);
  const areaHeightMm = built.areaHeightMm;
  const pageHeightMm = 297;
  const marginTopMm = parseMm(pdfLayout.page.margins.top);
  const marginBottomMm = parseMm(pdfLayout.page.margins.bottom);
  const headingHeightMm = (parsePt(stageplanLayout.headingSize) / MM_TO_PT) * 1;
  const containerMarginTopMm = parsePt(stageplanLayout.containerMarginTop) / MM_TO_PT;
  const containerPadMm = (parsePt(stageplanLayout.containerPad) / MM_TO_PT) * 2;
  const sectionMarginTopMm = parsePt(stageplanLayout.sectionMarginTop) / MM_TO_PT;
  const totalHeightMm =
    sectionMarginTopMm + headingHeightMm + containerMarginTopMm + containerPadMm + areaHeightMm;
  const availableHeightMm = pageHeightMm - marginTopMm - marginBottomMm;
  if (totalHeightMm > availableHeightMm) {
    throw new Error(
      `Stageplan layout overflow: required ${totalHeightMm.toFixed(2)}mm exceeds available ${availableHeightMm.toFixed(2)}mm.`
    );
  }
  return {
    heading: {
      text: "Stageplan",
      fontSize: stageplanLayout.headingSize,
      fontWeight: stageplanLayout.headingWeight,
    },
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

export function renderStageplanSection(vm: DocumentViewModel): string {
  const plan = buildStageplanPlan(vm.stageplan);
  const areaHeight = plan.layout.areaHeightMm;

  const boxesHtml = plan.boxes
    .map((box) => {
      const lines: string[] = [];
      lines.push(`<div class="stageplanBoxHeader">${box.header}</div>`);

      const hasBody = box.inputBullets.length > 0 || box.monitorBullets.length > 0 || box.extraBullets.length > 0;
      if (hasBody) {
        lines.push(`<div class="stageplanTitleGap" style="height:${box.typography.titleGapPt}pt;"></div>`);
      }

      const addBullets = (bullets: string[]) => {
        for (const bullet of bullets) {
          lines.push(
            `<div class="stageplanBoxLine"><span class="bullet" style="margin-right:${box.typography.bulletSpacingPx}px;">•</span><span class="text">${bullet}</span></div>`
          );
        }
      };

      addBullets(box.inputBullets);
      if (box.monitorBullets.length > 0) {
        if (box.inputBullets.length > 0) {
          lines.push(`<div class="stageplanGap" style="height:calc(1em * ${box.typography.lineHeight});"></div>`);
        }
        addBullets(box.monitorBullets);
      }
      if (box.extraBullets.length > 0) {
        if (box.monitorBullets.length > 0 || box.inputBullets.length > 0) {
          lines.push(`<div class="stageplanGap" style="height:calc(1em * ${box.typography.lineHeight});"></div>`);
        }
        addBullets(box.extraBullets);
      }

      const powerHtml = box.hasPowerBadge ? `<div class="stageplanPower">${box.powerBadgeText}</div>` : "";

      if (box.hasPowerBadge) {
        lines.push(`<div class="stageplanPowerGap" style="height:${box.typography.powerBadgeSpacerHeightPt}pt;"></div>`);
      }

      const powerClass = box.hasPowerBadge ? " stageplanBox--withPower" : "";

      return `
<div class="stageplanBox${powerClass}" style="left:${box.position.xMm}mm; top:${box.position.yMm}mm; width:${box.position.widthMm}mm; height:${box.position.heightMm}mm; font-size:${box.typography.fontSizePt}pt; line-height:${box.typography.lineHeight};">\n  ${lines.join("")}\n  ${powerHtml}\n</div>`.trim();
    })
    .join("\n");

  return `
<section class="stageplanSection">\n  <div class="stageplanHeading">${plan.heading.text}</div>\n  <div class="stageplanContainer">\n    <div class="stageplanArea" style="height:${areaHeight}mm;">\n      ${boxesHtml}\n    </div>\n  </div>\n</section>`.trim();
}

export { stageplanLayout };

export const __stageplanTestExports = { computeBottomRowGeometry };
