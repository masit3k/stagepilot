import type { EventSetupEditState } from "../adapters/eventSetupAdapter";
import type { ToggleWithStepperFieldDef } from "../schema/types";
import { SetupCounterControl } from "./SetupCounterControl";

type ToggleWithStepperRowProps = {
  field: ToggleWithStepperFieldDef;
  state: EventSetupEditState;
  onPatch: (next: ReturnType<ToggleWithStepperFieldDef["setValue"]>) => void;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function ToggleWithStepperRow({
  field,
  state,
  onPatch,
}: ToggleWithStepperRowProps) {
  const checked = field.alwaysOn ? true : field.getValue(state);
  const isDefault = field.isDefault(state);
  const isDisabled = field.isDisabled?.(state) ?? false;
  const count = clamp(field.getCount(state), field.min, field.max);
  const controlId = `setup-toggle-stepper-${field.id}`;

  return (
    <div
      className={`setup-field-block ${!isDefault ? "setup-field-block--modified" : ""}`}
    >
      <label
        className={`setup-field-row setup-toggle-row ${checked ? "setup-toggle-row--checked" : ""}`}
        htmlFor={controlId}
        role="group"
      >
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
          <span
            className="setup-toggle-row__trailing"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <SetupCounterControl
              label={field.label}
              value={count}
              min={field.min}
              max={field.max}
              stopPropagation
              onChange={(nextCount) =>
                onPatch(field.setCount(state, nextCount))
              }
            />
          </span>
        ) : null}
      </label>
    </div>
  );
}
