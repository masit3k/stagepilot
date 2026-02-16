import type { EventSetupEditState } from "../adapters/eventSetupAdapter";
import type { DropdownFieldDef } from "../schema/types";

type DropdownFieldProps = {
  field: DropdownFieldDef;
  state: EventSetupEditState;
  onPatch: (next: ReturnType<DropdownFieldDef["setValue"]>) => void;
};

export function DropdownField({ field, state, onPatch }: DropdownFieldProps) {
  const value = field.getValue(state);
  const options = field.options(state);
  const isDefault = field.isDefault(state);
  const controlId = `setup-${field.id}`;

  return (
    <div className={`setup-field-block ${!isDefault ? "setup-field-block--modified" : ""}`}>
      {field.hideVisibleLabel ? null : <label className="setup-field-block__label" htmlFor={controlId}>{field.label}</label>}
      <div className="setup-field-row">
        <select id={controlId} aria-label={field.hideVisibleLabel ? (field.ariaLabel ?? field.label) : undefined} className="setup-field-control" value={value} onChange={(e) => onPatch(field.setValue(state, e.target.value))}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        {!isDefault ? <span className="setup-modified-dot" aria-label="Modified from defaults">●</span> : null}
      </div>
    </div>
  );
}
