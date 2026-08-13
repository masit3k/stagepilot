import type { CSSProperties } from "react";
import type { StageplanBlock } from "../../../../../../src/domain/model/types";
import type { StageScale } from "../../../../../../src/domain/stageplan/layout/scale";
import { LABEL_BY_SLOT } from "./blockContent";

type StageBlockProps = {
  block: StageplanBlock;
  scale: StageScale;
  isSelected: boolean;
  onSelect: (slot: StageplanBlock["slot"]) => void;
};

/**
 * Geometrie jde do `style` jako CSS proměnné, ne jako hotové deklarace —
 * vzhled zůstává v CSS, v komponentě je jen spočítané umístění.
 */
export function StageBlock({
  block,
  scale,
  isSelected,
  onSelect,
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
      onPointerDown={() => onSelect(block.slot)}
    >
      <div className="stage-block__label">{LABEL_BY_SLOT[block.slot]}</div>
      <div className="stage-block__rotation">{block.rotationDeg}°</div>
    </div>
  );
}
