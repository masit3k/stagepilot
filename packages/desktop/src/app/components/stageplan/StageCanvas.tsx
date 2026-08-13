import type { CSSProperties } from "react";
import type {
  StageplanBlock,
  StageplanBlockSlot,
  StageplanStageSize,
} from "../../../../../../src/domain/model/types";
import { createStageScale } from "../../../../../../src/domain/stageplan/layout/scale";
import { computePrintFootprintMm } from "../../../../../../src/domain/stageplan/print/printFootprint";
import type { StageplanPrintGeometry } from "../../../../../../src/domain/stageplan/print/printMetrics";
import { resolvePrintScale } from "../../../../../../src/domain/stageplan/print/printScale";
import { StageBlock } from "./StageBlock";
import { useBlockDrag } from "./useBlockDrag";
import { useStageViewport } from "./useStageViewport";

type StageCanvasProps = {
  area: StageplanStageSize;
  blocks: readonly StageplanBlock[];
  selectedSlot: StageplanBlockSlot | null;
  snap: boolean;
  printGeometry: StageplanPrintGeometry | null;
  onSelect: (slot: StageplanBlockSlot | null) => void;
  onChangeBlock: (slot: StageplanBlockSlot, next: StageplanBlock) => void;
  onGestureStart: () => void;
  onGestureEnd: () => void;
};

export function StageCanvas({
  area,
  blocks,
  selectedSlot,
  snap,
  printGeometry,
  onSelect,
  onChangeBlock,
  onGestureStart,
  onGestureEnd,
}: StageCanvasProps) {
  const { ref, viewport } = useStageViewport();
  const scale = createStageScale(area, viewport);
  const { startMove, startRotate } = useBlockDrag({
    scale,
    area,
    snap,
    onChange: onChangeBlock,
    onGestureStart,
    onGestureEnd,
  });
  const surface = {
    "--stage-w": `${scale.widthPx}px`,
    "--stage-h": `${scale.heightPx}px`,
    /** Mřížka je půl metru, jako 30 px při 90 px/m v prototypu. */
    "--stage-grid": `${scale.toPx(0.5)}px`,
  } as CSSProperties;

  // Tisková stopa: stejná doménová funkce jako v rendereru — včetně rezervy na
  // přesah (Task 12), jinak by obrys tvrdil něco jiného, než se vytiskne.
  // Výsledek v mm se vrací do metrů měřítkem tisku, proto se stopa překreslí
  // i po změně rozměru pódia.
  const printScale = printGeometry
    ? resolvePrintScale({
        stage: area,
        blocks,
        area: printGeometry.area,
        minBoxWidthMm: printGeometry.typography.minBoxWidthMm,
      })
    : null;
  const footprintFor = (block: StageplanBlock) => {
    if (!printGeometry || !printScale) return null;
    const metric = printGeometry.blocks.find(
      (entry) => entry.slot === block.slot,
    );
    if (!metric) return null;
    const footprint = computePrintFootprintMm({
      lineCount: metric.lineCount,
      hasPower: metric.hasPower,
      zone: block,
      mmPerM: printScale.mmPerM,
      typography: printGeometry.typography,
    });
    return {
      widthM: printScale.toM(footprint.widthMm),
      depthM: printScale.toM(footprint.heightMm),
    };
  };

  return (
    <div className="stage-canvas-frame" ref={ref}>
      <div
        className="stage-canvas"
        style={surface}
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) onSelect(null);
        }}
      >
        {blocks.map((block) => (
          <StageBlock
            key={block.slot}
            block={block}
            scale={scale}
            isSelected={block.slot === selectedSlot}
            printFootprint={footprintFor(block)}
            onSelect={onSelect}
            onStartMove={startMove}
            onStartRotate={startRotate}
          />
        ))}
        <div className="stage-canvas__downstage">DOWNSTAGE · PUBLIKUM</div>
      </div>
    </div>
  );
}
