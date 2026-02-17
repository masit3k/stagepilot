import type { InputChannel } from "../../../../../src/domain/model/types";
import type { InputDiffMeta } from "../../../../../src/domain/setup/computeSetupDiff";
import { resolveInputDisplayLabel } from "./resolveInputDisplayLabel";

type SelectedInputsListProps = {
  effectiveInputs: InputChannel[];
  inputDiffMeta: InputDiffMeta[];
  availableInputs: InputChannel[];
  nonRemovableKeys?: string[];
  onRemoveInput: (key: string) => void;
  onAddInput: (input: InputChannel) => void;
};

export function SelectedInputsList({
  effectiveInputs,
  inputDiffMeta,
  availableInputs,
  nonRemovableKeys = [],
  onRemoveInput,
  onAddInput,
}: SelectedInputsListProps) {
  return (
    <section className="setup-section-card">
      <div className="setup-section-card__header">
        <h4>Inputs</h4>
        <p className="subtle">Selected (effective)</p>
      </div>

      <div className="setup-editor-list">
        {effectiveInputs.map((input) => {
          const meta = inputDiffMeta.find((item) => item.key === input.key);
          const overridden = meta?.origin === "override";
          const isLocked = nonRemovableKeys.includes(input.key);
          return (
            <div key={input.key} className={`setup-editor-list__row ${overridden ? "setup-editor-list__row--modified" : ""}`}>
              <div className="setup-input-row__main">
                <strong>{resolveInputDisplayLabel(input)}</strong>
                {input.note ? <p className="subtle">{input.note}</p> : null}
              </div>
              <button type="button" className="button-secondary" onClick={() => onRemoveInput(input.key)} disabled={isLocked}>
                Remove
              </button>
            </div>
          );
        })}
      </div>

      <div className="setup-available-list">
        <p className="subtle">Add more</p>
        {availableInputs.length === 0 ? <p className="subtle">No additional inputs available.</p> : null}
        {availableInputs.map((item) => (
          <div key={item.key} className="setup-editor-list__row">
            <span>{resolveInputDisplayLabel(item)}</span>
            <button type="button" className="button-secondary" onClick={() => onAddInput(item)}>Add</button>
          </div>
        ))}
      </div>
    </section>
  );
}
