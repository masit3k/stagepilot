import type {
  StageplanBlock,
  StageplanBlockSlot,
} from "../../../../../../src/domain/model/types";
import { LABEL_BY_SLOT, formatZone } from "./blockContent";
import type { BlockPrint } from "./blockPrint";

type BlockInspectorProps = {
  blocks: readonly StageplanBlock[];
  selectedSlot: StageplanBlockSlot | null;
  printedZone: BlockPrint | null;
  onSelect: (slot: StageplanBlockSlot) => void;
  onRotateBy: (deltaDeg: number) => void;
  onReset: () => void;
};

export function BlockInspector({
  blocks,
  selectedSlot,
  printedZone,
  onSelect,
  onRotateBy,
  onReset,
}: BlockInspectorProps) {
  const selected = blocks.find((block) => block.slot === selectedSlot) ?? null;

  return (
    <aside className="stage-inspector">
      <div className="stage-inspector__section">
        <div className="stage-inspector__eyebrow">SELECTED BLOCK</div>
        <div className="stage-inspector__title">
          {selected ? LABEL_BY_SLOT[selected.slot] : "—"}
        </div>
      </div>

      {selected ? (
        <div className="stage-inspector__section">
          <div className="stage-inspector__row">
            <span className="stage-inspector__label">ROTATION</span>
            <button
              type="button"
              onClick={() => onRotateBy(-15)}
              aria-label="Rotate 15° left"
            >
              ↺
            </button>
            <span className="stage-inspector__value">
              {selected.rotationDeg}°
            </span>
            <button
              type="button"
              onClick={() => onRotateBy(15)}
              aria-label="Rotate 15° right"
            >
              ↻
            </button>
          </div>
          <div className="stage-inspector__row">
            <span className="stage-inspector__label">ZONE</span>
            <span className="stage-inspector__value">
              {formatZone(selected.widthM, selected.depthM)}
            </span>
          </div>
          {printedZone ? (
            <div className="stage-inspector__row">
              <span className="stage-inspector__label">PRINTED</span>
              <span className="stage-inspector__value">
                {formatZone(
                  printedZone.footprint.widthM,
                  printedZone.footprint.depthM,
                )}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="stage-inspector__section">
        <div className="stage-inspector__eyebrow">BLOCKS ON STAGE</div>
        <ul className="stage-inspector__list">
          {blocks.map((block) => (
            <li key={block.slot}>
              <button
                type="button"
                className={`stage-inspector__item${
                  block.slot === selectedSlot
                    ? " stage-inspector__item--active"
                    : ""
                }`}
                onClick={() => onSelect(block.slot)}
              >
                <span>{LABEL_BY_SLOT[block.slot]}</span>
                <span>{block.rotationDeg}°</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <button
        type="button"
        className="stage-inspector__reset"
        onClick={onReset}
      >
        Reset arrangement
      </button>
    </aside>
  );
}
