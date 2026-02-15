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
  return (
    <label className="setup-field-block">
      <span className="setup-field-block__label">{field.label}</span>
      <div className="setup-field-row">
        <input type="checkbox" checked={checked} onChange={(e) => onPatch(field.setValue(state, e.target.checked))} />
        <span className={isDefault ? "setup-badge" : "setup-badge setup-badge--override"}>{isDefault ? "Default" : "Overridden"}</span>
      </div>
    </label>
  );
}
