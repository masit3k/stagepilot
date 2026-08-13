import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import type { StageplanBlock } from "../../../../../../src/domain/model/types";
import type { StageScale } from "../../../../../../src/domain/stageplan/layout/scale";
import { LABEL_BY_SLOT } from "./blockContent";

type StageBlockProps = {
  block: StageplanBlock;
  scale: StageScale;
  isSelected: boolean;
  printFootprint: { widthM: number; depthM: number } | null;
  onSelect: (slot: StageplanBlock["slot"]) => void;
  onStartMove: (event: ReactPointerEvent, block: StageplanBlock) => void;
  onStartRotate: (event: ReactPointerEvent, block: StageplanBlock) => void;
};

/**
 * Geometrie jde do `style` jako CSS proměnné, ne jako hotové deklarace —
 * vzhled zůstává v CSS, v komponentě je jen spočítané umístění.
 */
export function StageBlock({
  block,
  scale,
  isSelected,
  printFootprint,
  onSelect,
  onStartMove,
  onStartRotate,
}: StageBlockProps) {
  const geometry = {
    "--block-w": `${scale.toPx(block.widthM)}px`,
    "--block-h": `${scale.toPx(block.depthM)}px`,
    "--block-x": `${scale.toPx(block.centerXM - block.widthM / 2)}px`,
    "--block-y": `${scale.toPx(block.centerYM - block.depthM / 2)}px`,
    "--block-rot": `${block.rotationDeg}deg`,
  } as CSSProperties;

  return (
    <div
      className={`stage-block${isSelected ? " stage-block--selected" : ""}`}
      style={geometry}
      onPointerDown={(event) => {
        onSelect(block.slot);
        onStartMove(event, block);
      }}
    >
      {printFootprint ? (
        <div
          className="stage-block__print-footprint"
          style={
            {
              "--footprint-w": `${scale.toPx(printFootprint.widthM)}px`,
              "--footprint-h": `${scale.toPx(printFootprint.depthM)}px`,
            } as CSSProperties
          }
        />
      ) : null}
      <div className="stage-block__label">{LABEL_BY_SLOT[block.slot]}</div>
      <div className="stage-block__rotation">{block.rotationDeg}°</div>
      {isSelected ? (
        <button
          type="button"
          className="stage-block__rotate"
          aria-label="Otočit blok"
          onPointerDown={(event) => onStartRotate(event, block)}
        >
          ↻
        </button>
      ) : null}
    </div>
  );
}
