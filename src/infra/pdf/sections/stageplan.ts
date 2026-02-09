import type {
  Group,
  StageplanInstrument,
  StageplanInstrumentKey,
} from "../../../domain/model/types.js";
import type { DocumentViewModel } from "../../../domain/model/types.js";
import { formatStageplanBoxHeader } from "../../../domain/formatters/formatStageplanBoxHeader.js";
import { resolveStageplanRoleForInput } from "../../../domain/stageplan/resolveStageplanRoleForInput.js";
import { pdfLayout } from "../layout.js";

const MM_TO_PT = 72 / 25.4;

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
  boxWidthMm: 55,
  gapXmm: 7.5,
  gapYmm: 8,
  powerCellColor: "#F7E65A",
} as const;

const powerRequirementByInstrument: Record<StageplanInstrument, string | null> = {
  Drums: "3x 230 V",
  Bass: "3x 230 V",
  Guitar: "3x 230 V",
  Keys: "3x 230 V",
  "Lead vocal": null,
};

const instrumentOrder: StageplanInstrument[] = [
  "Drums",
  "Bass",
  "Guitar",
  "Lead vocal",
  "Keys",
];

type StageplanBoxPlan = {
  instrument: StageplanInstrument;
  header: string;
  inputBullets: string[];
  monitorBullets: string[];
  extraBullets: string[];
  powerLabel: string | null;
  position: { xMm: number; yMm: number; widthMm: number; heightMm: number };
};

type StageplanBoxContent = Omit<StageplanBoxPlan, "position">;

export type StageplanPlan = {
  heading: { text: string; fontSize: string; fontWeight: number };
  textStyle: { fontSize: string; lineHeight: number };
  layout: typeof stageplanLayout & { areaHeightMm: number };
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

function formatMonitorBullet(note: string, no: number): string {
  const label = note && note.trim() ? note.trim() : "";
  if (label === "") return `(${no})`;
  return `${label} (${no})`;
}

function buildStageplanBoxes(vm: DocumentViewModel["stageplan"]): StageplanBoxPlan[] {
  const inputByInstrument = new Map<
    StageplanInstrument,
    Array<{ channelNo: number; label: string; group?: Group }>
  >();
  const monitorByInstrument = new Map<StageplanInstrument, Array<{ no: number; label: string }>>();

  for (const instrument of instrumentOrder) {
    inputByInstrument.set(instrument, []);
    monitorByInstrument.set(instrument, []);
  }

  for (const input of vm.inputs) {
    const instrument = resolveStageplanRoleForInput(input);
    if (!instrument) continue;
    inputByInstrument
      .get(instrument)
      ?.push({ channelNo: input.channelNo, label: input.label, group: input.group });
  }

  for (const output of vm.monitorOutputs) {
    const instrument = resolveMonitorInstrument(output.output);
    if (!instrument) continue;
    const bullet = formatMonitorBullet(output.note, output.no);
    monitorByInstrument.get(instrument)?.push({ no: output.no, label: bullet });
  }

  const instrumentToRole: Record<StageplanInstrument, StageplanInstrumentKey> = {
    Drums: "drums",
    Bass: "bass",
    Guitar: "guitar",
    Keys: "keys",
    "Lead vocal": "vocs",
  };

  const boxContents: StageplanBoxContent[] = instrumentOrder.map((instrument) => {
    const role = instrumentToRole[instrument];
    const person = vm.lineupByRole[role];
    const firstName = person?.firstName ?? null;
    const header = formatStageplanBoxHeader({
      instrumentLabel: instrument,
      firstName,
      isBandLeader: person?.isBandLeader ?? false,
    });

    const inputs = (inputByInstrument.get(instrument) ?? []).slice().sort((a, b) => {
      return a.channelNo - b.channelNo;
    });

    const isPadInput = (label: string): boolean => /pad/i.test(label);
    const isDummyInput = (label: string): boolean => /dummy/i.test(label);
    const isBackVocalDrums = (label: string): boolean =>
      /back vocal\s*[-–—]\s*drums/i.test(label);
    const formatRange = (label: string, items: Array<{ channelNo: number }>): string | null => {
      if (items.length === 0) return null;
      const numbers = items.map((item) => item.channelNo);
      const min = Math.min(...numbers);
      const max = Math.max(...numbers);
      const range = min === max ? `${min}` : `${min}–${max}`;
      return `${label} (${range})`;
    };

    const inputBullets =
      instrument === "Drums"
        ? (() => {
            const padInputs = inputs.filter(
              (item) => isPadInput(item.label) && !isDummyInput(item.label)
            );
            const backVocalInputs = inputs.filter((item) =>
              isBackVocalDrums(item.label)
            );
            const drumInputs = inputs.filter(
              (item) =>
                item.group === "drums" &&
                !isPadInput(item.label) &&
                !isDummyInput(item.label) &&
                !isBackVocalDrums(item.label)
            );
            const bullets: string[] = [];
            const drumRange = formatRange("Drums", drumInputs);
            const padRange = formatRange("PAD", padInputs);
            if (drumRange) bullets.push(drumRange);
            if (padRange) bullets.push(padRange);
            for (const item of backVocalInputs) {
              bullets.push(`${item.label} (${item.channelNo})`);
            }
            return bullets;
          })()
        : inputs.map((item) => `${item.label} (${item.channelNo})`);

    const monitors = (monitorByInstrument.get(instrument) ?? [])
      .slice()
      .sort((a, b) => a.no - b.no)
      .map((item) => item.label);

    const extraBullets: string[] = [];
    if (instrument === "Drums") {
      extraBullets.push("Drum riser 3x2");
    }

    return {
      instrument,
      header,
      inputBullets,
      monitorBullets: monitors,
      extraBullets,
      powerLabel: powerRequirementByInstrument[instrument],
    };
  });

  const boxTitleGapPt = parsePt(stageplanLayout.boxTitleGap);
  const boxPaddingBottomPt = parsePt(stageplanLayout.boxPaddingBottom);
  const fontSizePt = parsePt(stageplanLayout.textSize);
  const lineHeightPt = fontSizePt * stageplanLayout.textLineHeight;
  const powerBadgeSpacerHeightPt = parsePt(stageplanLayout.powerBadgeSpacerHeight);

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
    const baseHeight =
      boxTitleGapPt +
      lineHeightPt +
      (hasBody ? boxTitleGapPt : 0) +
      lines * lineHeightPt;
    const bottomPart = box.powerLabel ? powerBadgeSpacerHeightPt : boxPaddingBottomPt;
    return baseHeight + bottomPart;
  };

  const requiredHeightsPt = boxContents.map((box) => calculateRequiredHeightPt(box));
  const maxHeightPt = Math.max(...requiredHeightsPt);
  const maxHeightMm = maxHeightPt / MM_TO_PT;

  for (const [index, box] of boxContents.entries()) {
    if (requiredHeightsPt[index] > maxHeightPt + 0.01) {
      throw new Error(`Stageplan overflow in ${box.instrument}`);
    }
  }

  const topRowY = 0;
  const topRowHeight = maxHeightMm;
  const bottomRowY = topRowHeight + stageplanLayout.gapYmm;
  const leftX = 0;
  const midX = leftX + stageplanLayout.boxWidthMm + stageplanLayout.gapXmm;
  const rightX = midX + stageplanLayout.boxWidthMm + stageplanLayout.gapXmm;

  const positions: Record<StageplanInstrument, { xMm: number; yMm: number }> = {
    Drums: { xMm: midX, yMm: topRowY },
    Bass: { xMm: rightX, yMm: topRowY },
    Guitar: { xMm: leftX, yMm: bottomRowY },
    "Lead vocal": { xMm: midX, yMm: bottomRowY },
    Keys: { xMm: rightX, yMm: bottomRowY },
  };

  return boxContents.map((box) => ({
    ...box,
    position: {
      xMm: positions[box.instrument].xMm,
      yMm: positions[box.instrument].yMm,
      widthMm: stageplanLayout.boxWidthMm,
      heightMm: maxHeightMm,
    },
  }));
}

export function buildStageplanPlan(vm: DocumentViewModel["stageplan"]): StageplanPlan {
  const boxes = buildStageplanBoxes(vm);
  const maxHeightMm = Math.max(...boxes.map((box) => box.position.heightMm));
  const topRowHeight = maxHeightMm;
  const bottomRowHeight = maxHeightMm;
  const areaHeightMm = topRowHeight + stageplanLayout.gapYmm + bottomRowHeight;
  const pageHeightMm = 297;
  const marginTopMm = parseMm(pdfLayout.page.margins.top);
  const marginBottomMm = parseMm(pdfLayout.page.margins.bottom);
  const headingHeightMm = (parsePt(stageplanLayout.headingSize) / MM_TO_PT) * 1;
  const containerMarginTopMm = parsePt(stageplanLayout.containerMarginTop) / MM_TO_PT;
  const containerPadMm = (parsePt(stageplanLayout.containerPad) / MM_TO_PT) * 2;
  const sectionMarginTopMm = parsePt(stageplanLayout.sectionMarginTop) / MM_TO_PT;
  const totalHeightMm =
    sectionMarginTopMm +
    headingHeightMm +
    containerMarginTopMm +
    containerPadMm +
    areaHeightMm;
  const availableHeightMm = pageHeightMm - marginTopMm - marginBottomMm;
  if (totalHeightMm > availableHeightMm) {
    throw new Error(
      `Stageplan layout overflow: required ${totalHeightMm.toFixed(
        2
      )}mm exceeds available ${availableHeightMm.toFixed(2)}mm.`
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
    },
    boxes,
  };
}

export function renderStageplanSection(vm: DocumentViewModel): string {
  const plan = buildStageplanPlan(vm.stageplan);
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
        lines.push(`<div class="stageplanTitleGap"></div>`);
      }

      const addBullets = (bullets: string[]) => {
        for (const bullet of bullets) {
          lines.push(
            `<div class="stageplanBoxLine"><span class="bullet">•</span><span class="text">${bullet}</span></div>`
          );
        }
      };

      addBullets(box.inputBullets);
      if (box.monitorBullets.length > 0) {
        if (box.inputBullets.length > 0) {
          lines.push(`<div class="stageplanGap"></div>`);
        }
        addBullets(box.monitorBullets);
      }
      if (box.extraBullets.length > 0) {
        if (box.monitorBullets.length > 0 || box.inputBullets.length > 0) {
          lines.push(`<div class="stageplanGap"></div>`);
        }
        addBullets(box.extraBullets);
      }

      const powerHtml = box.powerLabel
        ? `<div class="stageplanPower">${box.powerLabel}</div>`
        : "";

      if (box.powerLabel) {
        lines.push(`<div class="stageplanPowerGap"></div>`);
      }

      const powerClass = box.powerLabel ? " stageplanBox--withPower" : "";

      return `
<div class="stageplanBox${powerClass}" style="left:${box.position.xMm}mm; top:${box.position.yMm}mm; width:${box.position.widthMm}mm; height:${box.position.heightMm}mm;">\n  ${lines.join("")}\n  ${powerHtml}\n</div>`.trim();
    })
    .join("\n");

  return `
<section class="stageplanSection">\n  <div class="stageplanHeading">${plan.heading.text}</div>\n  <div class="stageplanContainer">\n    <div class="stageplanArea" style="height:${areaHeight}mm;">\n      ${boxesHtml}\n    </div>\n  </div>\n</section>`.trim();
}

export { stageplanLayout };
