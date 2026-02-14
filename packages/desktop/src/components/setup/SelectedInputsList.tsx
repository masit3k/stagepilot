import type { InputChannel } from "../../../../../src/domain/model/types";
import type { InputDiffMeta } from "../../../../../src/domain/setup/computeSetupDiff";

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
    <section>
      <h4>Inputs</h4>
      <p className="subtle">Selected (effective)</p>
      <div className="setup-editor-list">
        {effectiveInputs.map((input) => {
          const meta = inputDiffMeta.find((item) => item.key === input.key);
          const overridden = meta?.origin === "override";
          const isLocked = nonRemovableKeys.includes(input.key);
          return (
            <div key={input.key} className="setup-editor-list__row">
              <div>
                <strong>{input.label}</strong>
                {input.note ? <p className="subtle">{input.note}</p> : null}
              </div>
              <div className="setup-row-actions">
                <span className={overridden ? "setup-badge setup-badge--override" : "setup-badge"}>{overridden ? "Overridden" : "Default"}</span>
                <button type="button" className="button-secondary" onClick={() => onRemoveInput(input.key)} disabled={isLocked}>
                  Remove
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="setup-available-list">
        <p className="subtle">Add more</p>
        {availableInputs.length === 0 ? <p className="subtle">No additional inputs available.</p> : null}
        {availableInputs.map((item) => (
          <div key={item.key} className="setup-editor-list__row">
            <span>{item.label}</span>
            <button type="button" className="button-secondary" onClick={() => onAddInput(item)}>Add</button>
          </div>
        ))}
      </div>
    </section>
  );
}
