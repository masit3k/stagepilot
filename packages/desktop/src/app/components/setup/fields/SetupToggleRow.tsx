import type { ReactNode } from "react";

type SetupToggleRowProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  trailing?: ReactNode;
};

export function SetupToggleRow({ label, checked, onChange, trailing }: SetupToggleRowProps) {
  return (
    <label className={`setup-field-row setup-toggle-row ${checked ? "setup-toggle-row--checked" : ""}`}>
      <input
        type="checkbox"
        className="setup-checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="setup-toggle-row__text">{label}</span>
      {trailing ? <span className="setup-toggle-row__trailing">{trailing}</span> : null}
    </label>
  );
}
