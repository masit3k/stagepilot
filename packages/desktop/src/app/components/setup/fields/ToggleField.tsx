import type { ReactNode } from "react";
import type { EventSetupEditState } from "../adapters/eventSetupAdapter";
import type { ToggleFieldDef } from "../schema/types";

type ToggleFieldProps = {
  field: ToggleFieldDef;
  state: EventSetupEditState;
  onPatch: (next: ReturnType<ToggleFieldDef["setValue"]>) => void;
  trailing?: ReactNode;
};

export function ToggleField({ field, state, onPatch, trailing }: ToggleFieldProps) {
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
        {trailing ? <span className="setup-toggle-row__trailing" onClick={(e) => e.stopPropagation()}>{trailing}</span> : null}
      </label>
    </div>
  );
}
