import type { EventSetupEditState } from "../adapters/eventSetupAdapter";
import type { ToggleWithStepperFieldDef } from "../schema/types";

type ToggleWithStepperRowProps = {
  field: ToggleWithStepperFieldDef;
  state: EventSetupEditState;
  onPatch: (next: ReturnType<ToggleWithStepperFieldDef["setValue"]>) => void;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function ToggleWithStepperRow({ field, state, onPatch }: ToggleWithStepperRowProps) {
  const checked = field.alwaysOn ? true : field.getValue(state);
  const isDefault = field.isDefault(state);
  const isDisabled = field.isDisabled?.(state) ?? false;
  const count = clamp(field.getCount(state), field.min, field.max);
  const controlId = `setup-toggle-stepper-${field.id}`;

  return (
    <div className={`setup-field-block ${!isDefault ? "setup-field-block--modified" : ""}`}>
      <label className={`setup-field-row setup-toggle-row ${checked ? "setup-toggle-row--checked" : ""}`} htmlFor={controlId} role="group">
        {field.alwaysOn ? null : (
          <input
            id={controlId}
            className="setup-checkbox"
            type="checkbox"
            checked={checked}
            disabled={isDisabled}
            onChange={(e) => onPatch(field.setValue(state, e.target.checked))}
          />
        )}
        <span className="setup-toggle-row__text">{field.label}</span>
        {checked ? (
          <span className="setup-toggle-row__trailing" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
            <div className="setup-stepper">
              <button
                type="button"
                className="setup-stepper__btn"
                aria-label={`Decrease ${field.label}`}
                disabled={count <= field.min}
                onClick={(e) => {
                  e.stopPropagation();
                  onPatch(field.setCount(state, clamp(count - 1, field.min, field.max)));
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                −
              </button>
              <span className="setup-stepper__value" aria-label={`${field.label}: ${count}`} onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                {count}
              </span>
              <button
                type="button"
                className="setup-stepper__btn"
                aria-label={`Increase ${field.label}`}
                disabled={count >= field.max}
                onClick={(e) => {
                  e.stopPropagation();
                  onPatch(field.setCount(state, clamp(count + 1, field.min, field.max)));
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                +
              </button>
            </div>
          </span>
        ) : null}
      </label>
    </div>
  );
}
