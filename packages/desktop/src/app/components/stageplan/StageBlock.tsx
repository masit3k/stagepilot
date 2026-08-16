import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { STAGEPLAN_BAND_LEADER_LINE } from "../../../../../../src/domain/formatters/stageplan";
import type { StageplanBlock } from "../../../../../../src/domain/model/types";
import type { ZoneHandle } from "../../../../../../src/domain/stageplan/layout/blockOps";
import type { StageScale } from "../../../../../../src/domain/stageplan/layout/scale";
import { LABEL_BY_SLOT } from "./blockContent";
import type { BlockPrint } from "./blockPrint";

const ZONE_HANDLES: readonly ZoneHandle[] = [
  "n",
  "s",
  "e",
  "w",
  "ne",
  "nw",
  "se",
  "sw",
];

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
  onStartResize: (
    event: ReactPointerEvent,
    block: StageplanBlock,
    handle: ZoneHandle,
  ) => void;
};

function BulletGroup({ bullets }: { bullets: readonly string[] }) {
  return (
    <>
      {/* Index, ne text: monitor odrážky se můžou opakovat doslovně (dodatečný
          wedge se stejným počtem), text by pak jako klíč nebyl unikátní. */}
      {bullets.map((bullet, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: statický seznam textů ve stálém pořadí, ne přeskupovaný ani filtrovaný za běhu.
        <div key={index} className="stage-block__line">
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
  onStartResize,
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
      <div className="stage-block__zone">
        {isSelected
          ? ZONE_HANDLES.map((handle) => (
              <button
                key={handle}
                type="button"
                className={`stage-block__handle stage-block__handle--${handle}`}
                aria-label={`Resize zone (${handle})`}
                onPointerDown={(event) => onStartResize(event, block, handle)}
              />
            ))
          : null}
      </div>
      <div className="stage-block__label">
        {box ? box.header : LABEL_BY_SLOT[block.slot]}
      </div>
      {box?.hasBandLeaderLine ? (
        <div className="stage-block__role">{STAGEPLAN_BAND_LEADER_LINE}</div>
      ) : null}
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
