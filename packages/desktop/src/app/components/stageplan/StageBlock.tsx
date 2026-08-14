import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import type { StageplanBlock } from "../../../../../../src/domain/model/types";
import type { StageScale } from "../../../../../../src/domain/stageplan/layout/scale";
import { LABEL_BY_SLOT } from "./blockContent";
import type { BlockPrint } from "./blockPrint";

type StageBlockProps = {
  block: StageplanBlock;
  scale: StageScale;
  isSelected: boolean;
  print: BlockPrint | null;
  /** null = písmo by bylo nečitelné, ukaž jen hlavičku (R5). */
  fontPx: number | null;
  onSelect: (slot: StageplanBlock["slot"]) => void;
  onStartMove: (event: ReactPointerEvent, block: StageplanBlock) => void;
  onStartRotate: (event: ReactPointerEvent, block: StageplanBlock) => void;
};

function BulletGroup({ bullets }: { bullets: readonly string[] }) {
  return (
    <>
      {bullets.map((bullet) => (
        <div key={bullet} className="stage-block__line">
          {bullet}
        </div>
      ))}
    </>
  );
}

/**
 * Karta je tištěný box, zóna je obrys uvnitř (R3). Plný výpis se do karty
 * vejde vždy, protože tištěná stopa je `max(zóna, text)` — proto se sází do
 * karty, a ne do zóny.
 *
 * Geometrie jde do `style` jako CSS proměnné, ne jako hotové deklarace —
 * vzhled zůstává v CSS, v komponentě je jen spočítané umístění.
 */
export function StageBlock({
  block,
  scale,
  isSelected,
  print,
  fontPx,
  onSelect,
  onStartMove,
  onStartRotate,
}: StageBlockProps) {
  const cardWidthM = print?.footprint.widthM ?? block.widthM;
  const cardDepthM = print?.footprint.depthM ?? block.depthM;
  const geometry = {
    "--card-w": `${scale.toPx(cardWidthM)}px`,
    "--card-h": `${scale.toPx(cardDepthM)}px`,
    "--card-x": `${scale.toPx(block.centerXM - cardWidthM / 2)}px`,
    "--card-y": `${scale.toPx(block.centerYM - cardDepthM / 2)}px`,
    "--block-rot": `${block.rotationDeg}deg`,
    "--zone-w": `${scale.toPx(block.widthM)}px`,
    "--zone-h": `${scale.toPx(block.depthM)}px`,
    "--block-font": fontPx === null ? undefined : `${fontPx}px`,
  } as CSSProperties;

  const box = print?.box ?? null;
  const showBullets = box !== null && fontPx !== null;

  return (
    <div
      className={`stage-block${isSelected ? " stage-block--selected" : ""}`}
      style={geometry}
      onPointerDown={(event) => {
        onSelect(block.slot);
        onStartMove(event, block);
      }}
    >
      <div className="stage-block__zone" />
      <div className="stage-block__label">
        {box ? box.header : LABEL_BY_SLOT[block.slot]}
      </div>
      {showBullets && box ? (
        <div className="stage-block__body">
          <BulletGroup bullets={box.inputBullets} />
          {box.monitorBullets.length > 0 && box.inputBullets.length > 0 ? (
            <div className="stage-block__gap" />
          ) : null}
          <BulletGroup bullets={box.monitorBullets} />
          {box.extraBullets.length > 0 &&
          (box.monitorBullets.length > 0 || box.inputBullets.length > 0) ? (
            <div className="stage-block__gap" />
          ) : null}
          <BulletGroup bullets={box.extraBullets} />
          {box.hasPowerBadge ? (
            <div className="stage-block__power">{box.powerBadgeText}</div>
          ) : null}
        </div>
      ) : null}
      <div className="stage-block__rotation">{block.rotationDeg}°</div>
      {isSelected ? (
        <button
          type="button"
          className="stage-block__rotate"
          aria-label="Rotate block"
          onPointerDown={(event) => onStartRotate(event, block)}
        >
          ↻
        </button>
      ) : null}
    </div>
  );
}
