import { SetupCounterControl } from "./SetupCounterControl";

type SetupCounterRowProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
};

export function SetupCounterRow({ label, value, min, max, onChange }: SetupCounterRowProps) {
  return (
    <div className="setup-field-block">
      <div className="setup-field-row setup-toggle-row setup-toggle-row--checked" role="group">
        <span className="setup-toggle-row__text">{label}</span>
        <span className="setup-toggle-row__trailing">
          <SetupCounterControl label={label} value={value} min={min} max={max} onChange={onChange} />
        </span>
      </div>
    </div>
  );
}
