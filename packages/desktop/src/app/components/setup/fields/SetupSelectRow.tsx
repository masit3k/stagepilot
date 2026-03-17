type SetupSelectRowProps<TValue extends string> = {
  label: string;
  value: TValue;
  options: readonly TValue[];
  onChange: (value: TValue) => void;
  formatOptionLabel?: (value: TValue) => string;
};

export function SetupSelectRow<TValue extends string>({
  label,
  value,
  options,
  onChange,
  formatOptionLabel,
}: SetupSelectRowProps<TValue>) {
  return (
    <label>
      {label}
      <select
        className="setup-field-control"
        value={value}
        onChange={(event) => onChange(event.target.value as TValue)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {formatOptionLabel ? formatOptionLabel(option) : option}
          </option>
        ))}
      </select>
    </label>
  );
}
