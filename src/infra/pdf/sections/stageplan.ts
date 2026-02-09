import type { StageplanInstrument } from "../../../domain/model/types.js";
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

const headingSizePt = parsePt(pdfLayout.typography.title.size) - 6;

const stageplanLayout = {
  headingSize: `${headingSizePt}pt`,
  headingWeight: 700,
  textSize: pdfLayout.typography.table.size,
  textLineHeight: pdfLayout.typography.table.lineHeight,
  padX: pdfLayout.table.padX,
  padY: pdfLayout.table.padY,
  containerPad: "24pt",
  areaWidthMm: 180,
  boxWidthMm: 55,
  boxHeightMm: 60,
  drumsBoxHeightMm: 68,
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
  const inputByInstrument = new Map<StageplanInstrument, Array<{ channelNo: number; label: string }>>();
  const monitorByInstrument = new Map<StageplanInstrument, Array<{ no: number; label: string }>>();

  for (const instrument of instrumentOrder) {
    inputByInstrument.set(instrument, []);
    monitorByInstrument.set(instrument, []);
  }

  for (const input of vm.inputs) {
    const instrument = resolveStageplanRoleForInput(input);
    if (!instrument) continue;
    inputByInstrument.get(instrument)?.push({ channelNo: input.channelNo, label: input.label });
  }

  for (const output of vm.monitorOutputs) {
    const instrument = resolveMonitorInstrument(output.output);
    if (!instrument) continue;
    const bullet = formatMonitorBullet(output.note, output.no);
    monitorByInstrument.get(instrument)?.push({ no: output.no, label: bullet });
  }

  const topRowY = 0;
  const topRowHeight = stageplanLayout.drumsBoxHeightMm;
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

  const boxPlans: StageplanBoxPlan[] = instrumentOrder.map((instrument) => {
    const firstName = vm.instrumentFirstNames[instrument];
    const header = formatStageplanBoxHeader({
      instrumentLabel: instrument,
      firstName,
      isBandLeader: vm.bandLeaderInstrument === instrument,
    });

    const inputs = (inputByInstrument.get(instrument) ?? []).slice().sort((a, b) => {
      return a.channelNo - b.channelNo;
    });

    const isPadInput = (label: string): boolean => /pad/i.test(label);
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
            const padInputs = inputs.filter((item) => isPadInput(item.label));
            const drumInputs = inputs.filter((item) => !isPadInput(item.label));
            const bullets: string[] = [];
            const drumRange = formatRange("Drums", drumInputs);
            const padRange = formatRange("PAD", padInputs);
            if (drumRange) bullets.push(drumRange);
            if (padRange) bullets.push(padRange);
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
      position: {
        xMm: positions[instrument].xMm,
        yMm: positions[instrument].yMm,
        widthMm: stageplanLayout.boxWidthMm,
        heightMm:
          instrument === "Drums"
            ? stageplanLayout.drumsBoxHeightMm
            : stageplanLayout.boxHeightMm,
      },
    };
  });

  const paddingYpt = parsePt(stageplanLayout.padY);
  const fontSizePt = parsePt(stageplanLayout.textSize);
  const lineHeightPt = fontSizePt * stageplanLayout.textLineHeight;
  const boxHeightPt = (boxHeightMm: number): number => boxHeightMm * MM_TO_PT;

  for (const box of boxPlans) {
    let lines = 1 + box.inputBullets.length;
    if (box.monitorBullets.length > 0) {
      if (box.inputBullets.length > 0) lines += 1;
      lines += box.monitorBullets.length;
    }
    if (box.extraBullets.length > 0) {
      if (box.monitorBullets.length > 0 || box.inputBullets.length > 0) {
        lines += 1;
      }
      lines += box.extraBullets.length;
    }

    const availablePt = boxHeightPt(box.position.heightMm) - paddingYpt * 2;
    const needed = lines * lineHeightPt;
    if (needed > availablePt) {
      throw new Error(`Stageplan overflow in ${box.instrument}`);
    }
  }

  return boxPlans;
}

export function buildStageplanPlan(vm: DocumentViewModel["stageplan"]): StageplanPlan {
  const boxes = buildStageplanBoxes(vm);
  const topRowHeight = stageplanLayout.drumsBoxHeightMm;
  const bottomRowHeight = stageplanLayout.boxHeightMm;
  const areaHeightMm = topRowHeight + stageplanLayout.gapYmm + bottomRowHeight;
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

      const addBullets = (bullets: string[]) => {
        for (const bullet of bullets) {
          lines.push(`<div class=\"stageplanLine\">• ${bullet}</div>`);
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

      return `
<div class="stageplanBox" style="left:${box.position.xMm}mm; top:${box.position.yMm}mm; width:${box.position.widthMm}mm; height:${box.position.heightMm}mm;">\n  ${lines.join("")}\n  ${powerHtml}\n</div>`.trim();
    })
    .join("\n");

  return `
<section class="stageplanSection">\n  <div class="stageplanHeading">${plan.heading.text}</div>\n  <div class="stageplanContainer">\n    <div class="stageplanArea" style="height:${areaHeight}mm;">\n      ${boxesHtml}\n    </div>\n  </div>\n</section>`.trim();
}

export { stageplanLayout };
