import type { EventSetupEditState } from "../adapters/eventSetupAdapter";
import type { AdditionalPickerFieldDef } from "../schema/types";

type AdditionalPickerFieldProps = {
  field: AdditionalPickerFieldDef;
  state: EventSetupEditState;
  onPatch: (next: ReturnType<AdditionalPickerFieldDef["setValue"]>) => void;
};

export function AdditionalPickerField({ field, state, onPatch }: AdditionalPickerFieldProps) {
  const selected = new Set(field.getValue(state));
  const isDefault = field.isDefault(state);
  return (
    <div className="setup-field-block">
      <span className="setup-field-block__label">{field.label}</span>
      <div className="setup-field-list">
        {field.options(state).map((option) => {
          const active = selected.has(option.id);
          const disableAdd = !active && selected.size >= field.maxSelected;
          return (
            <div key={option.id} className="setup-editor-list__row">
              <span>{option.label}</span>
              <button
                type="button"
                className="button-secondary"
                disabled={disableAdd}
                onClick={() => {
                  const next = active
                    ? Array.from(selected).filter((id) => id !== option.id)
                    : [...Array.from(selected), option.id].slice(0, field.maxSelected);
                  onPatch(field.setValue(state, next));
                }}
              >
                {active ? "Remove" : "Add"}
              </button>
            </div>
          );
        })}
      </div>
      <span className={isDefault ? "setup-badge" : "setup-badge setup-badge--override"}>{isDefault ? "Default" : "Overridden"}</span>
    </div>
  );
}
