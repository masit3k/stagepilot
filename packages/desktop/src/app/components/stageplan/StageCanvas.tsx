import type { CSSProperties } from "react";
import type {
  StageplanBlock,
  StageplanBlockSlot,
  StageplanStageSize,
} from "../../../../../../src/domain/model/types";
import { createStageScale } from "../../../../../../src/domain/stageplan/layout/scale";
import { StageBlock } from "./StageBlock";
import { useStageViewport } from "./useStageViewport";

type StageCanvasProps = {
  area: StageplanStageSize;
  blocks: readonly StageplanBlock[];
  selectedSlot: StageplanBlockSlot | null;
  onSelect: (slot: StageplanBlockSlot | null) => void;
};

export function StageCanvas({
  area,
  blocks,
  selectedSlot,
  onSelect,
}: StageCanvasProps) {
  const { ref, viewport } = useStageViewport();
  const scale = createStageScale(area, viewport);
  const surface = {
    "--stage-w": `${scale.widthPx}px`,
    "--stage-h": `${scale.heightPx}px`,
    /** Mřížka je půl metru, jako 30 px při 90 px/m v prototypu. */
    "--stage-grid": `${scale.toPx(0.5)}px`,
  } as CSSProperties;

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
            onSelect={onSelect}
          />
        ))}
        <div className="stage-canvas__downstage">DOWNSTAGE · PUBLIKUM</div>
      </div>
    </div>
  );
}
