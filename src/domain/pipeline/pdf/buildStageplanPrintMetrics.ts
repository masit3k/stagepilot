import type { DocumentViewModel } from "../../model/types.js";
import type { StageplanPrintBlockMetric } from "../../stageplan/print/printMetrics.js";
import { buildPdfStageplanPrintModel } from "./buildPdfStageplanPrintModel.js";
import { countStageplanBoxLines } from "./countStageplanBoxLines.js";

/** Metriky pokrývají právě bloky z layoutu — editor kreslí stopu jen k nim. */
export function buildStageplanPrintMetrics(
  vm: DocumentViewModel["stageplan"],
): StageplanPrintBlockMetric[] {
  const printModel = buildPdfStageplanPrintModel(vm);

  return vm.layout.blocks.map((block) => {
    const printBox = printModel.boxesBySlot[block.slot];
    return {
      slot: block.slot,
      lineCount: countStageplanBoxLines(printBox),
      hasPower: printBox.hasPowerBadge,
    };
  });
}
