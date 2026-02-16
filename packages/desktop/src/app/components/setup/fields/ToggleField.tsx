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
    <div className="setup-field-block">
      <span className="setup-field-block__label">{field.label}</span>
      <div className="setup-field-row">
        <label className="setup-toggle-control" htmlFor={controlId}>
          <input
            id={controlId}
            className="setup-checkbox"
            type="checkbox"
            checked={checked}
            disabled={isDisabled}
            onChange={(e) => onPatch(field.setValue(state, e.target.checked))}
          />
        </label>
        <span className={isDefault ? "setup-badge" : "setup-badge setup-badge--override"}>{isDefault ? "Default" : "Overridden"}</span>
      </div>
    </div>
  );
}
