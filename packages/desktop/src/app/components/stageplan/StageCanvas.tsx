import type { CSSProperties } from "react";
import type {
  StageplanBlock,
  StageplanBlockSlot,
  StageplanStageSize,
} from "../../../../../../src/domain/model/types";
import { createStageScale } from "../../../../../../src/domain/stageplan/layout/scale";
import type { StageplanPrintGeometry } from "../../../../../../src/domain/stageplan/print/printMetrics";
import type { PrintScale } from "../../../../../../src/domain/stageplan/print/printScale";
import { StageBlock } from "./StageBlock";
import { resolveBlockFontPx } from "./blockFont";
import { resolveBlockPrint } from "./blockPrint";
import { useBlockDrag } from "./useBlockDrag";
import { useStageViewport } from "./useStageViewport";

type StageCanvasProps = {
  area: StageplanStageSize;
  blocks: readonly StageplanBlock[];
  selectedSlot: StageplanBlockSlot | null;
  snap: boolean;
  printGeometry: StageplanPrintGeometry | null;
  printScale: PrintScale | null;
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
  printScale,
  onSelect,
  onChangeBlock,
  onGestureStart,
  onGestureEnd,
}: StageCanvasProps) {
  const { ref, viewport } = useStageViewport();
  const scale = createStageScale(area, viewport);
  const { startMove, startRotate, startResize } = useBlockDrag({
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

  const fontPx =
    printGeometry && printScale
      ? resolveBlockFontPx({
          fontSizePt: printGeometry.typography.fontSizePt,
          pxPerM: scale.pxPerM,
          mmPerM: printScale.mmPerM,
        })
      : null;

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
            print={resolveBlockPrint({
              block,
              geometry: printGeometry,
              scale: printScale,
            })}
            fontPx={fontPx}
            onSelect={onSelect}
            onStartMove={startMove}
            onStartRotate={startRotate}
            onStartResize={startResize}
          />
        ))}
        {/* Anglicky, protože je to značka rozhraní. V PDF stojí česky
            `DOWNSTAGE · PUBLIKUM`, tam je to obsah dokumentu (R14). */}
        <div className="stage-canvas__downstage">DOWNSTAGE · AUDIENCE</div>
      </div>
    </div>
  );
}
