import type { EventSetupEditState } from "../adapters/eventSetupAdapter";
import type { ToggleFieldDef } from "../schema/types";

type ToggleFieldProps = {
  field: ToggleFieldDef;
  state: EventSetupEditState;
  onPatch: (next: ReturnType<ToggleFieldDef["setValue"]>) => void;
};

export function ToggleField({ field, state, onPatch }: ToggleFieldProps) {
  const checked = field.getValue(state);
  const isDefault = field.isDefault(state);
  const isDisabled = field.isDisabled?.(state) ?? false;
  const controlId = `setup-toggle-${field.id}`;
  return (
    <div className={`setup-field-block ${!isDefault ? "setup-field-block--modified" : ""}`}>
      <label className={`setup-field-row setup-toggle-row ${checked ? "setup-toggle-row--checked" : ""}`} htmlFor={controlId}>
        <input
          id={controlId}
          className="setup-checkbox"
          type="checkbox"
          checked={checked}
          disabled={isDisabled}
          onChange={(e) => onPatch(field.setValue(state, e.target.checked))}
        />
        <span className="setup-toggle-row__text">{field.label}</span>
        {!isDefault ? <span className="setup-modified-dot" aria-label="Modified from defaults">●</span> : null}
      </label>
    </div>
  );
}
