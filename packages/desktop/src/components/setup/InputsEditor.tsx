import type { Group } from "../../../../../src/domain/model/groups";
import type { InputChannel } from "../../../../../src/domain/model/types";
import type { InputDiffMeta } from "../../../../../src/domain/setup/computeSetupDiff";

type InputsEditorProps = {
  role: Group;
  effectiveInputs: InputChannel[];
  inputDiffMeta: InputDiffMeta[];
  availableInputs: InputChannel[];
  onRemoveInput: (key: string) => void;
  onRestoreInput: (key: string) => void;
  onAddInput: (input: InputChannel) => void;
};

export function InputsEditor({
  role,
  effectiveInputs,
  inputDiffMeta,
  availableInputs,
  onRemoveInput,
  onRestoreInput,
  onAddInput,
}: InputsEditorProps) {
  const removedDefaults = inputDiffMeta.filter((item) => item.changeType === "removed");

  return (
    <section>
      <h4>Inputs</h4>
      <p className="subtle">Effective inputs ({effectiveInputs.length})</p>
      <div className="setup-editor-list">
        {effectiveInputs.map((input) => {
          const meta = inputDiffMeta.find((item) => item.key === input.key);
          const overridden = meta?.origin === "override";
          return (
            <div key={input.key} className="setup-editor-list__row">
              <div>
                <strong>{input.label}</strong>
                <p className="subtle">{input.key}</p>
              </div>
              <div className="setup-row-actions">
                <span className={overridden ? "setup-badge setup-badge--override" : "setup-badge"}>{overridden ? "Overridden" : "Default"}</span>
                <button type="button" className="button-secondary" onClick={() => onRemoveInput(input.key)}>Remove</button>
              </div>
            </div>
          );
        })}
      </div>

      {removedDefaults.length > 0 ? (
        <div className="setup-removed-list">
          <p className="subtle">Removed defaults</p>
          {removedDefaults.map((item) => (
            <div key={item.key} className="setup-editor-list__row">
              <span>{item.label}</span>
              <button type="button" className="button-secondary" onClick={() => onRestoreInput(item.key)}>Restore</button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="setup-available-list">
        <p className="subtle">Available to add ({role})</p>
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
