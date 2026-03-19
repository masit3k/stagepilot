import { CandidateDisplayLabel } from "./CandidateDisplayLabel";

type VocalCandidateOptionRowProps = {
  id: string;
  inputIdPrefix: "lead-vocs" | "back-vocs";
  displayName: string;
  primaryGroup: Parameters<typeof CandidateDisplayLabel>[0]["primaryGroup"];
  selected: boolean;
  disabled?: boolean;
  onToggle: (id: string) => void;
  trailingNote?: string;
};

export function VocalCandidateOptionRow({
  id,
  inputIdPrefix,
  displayName,
  primaryGroup,
  selected,
  disabled = false,
  onToggle,
  trailingNote,
}: VocalCandidateOptionRowProps) {
  const inputId = `${inputIdPrefix}-${id}`;

  return (
    <label
      key={id}
      className={`selector-option selector-option--check${disabled ? " selector-option--disabled" : ""}`}
      htmlFor={inputId}
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
    >
      <input
        id={inputId}
        className="setup-checkbox"
        type="checkbox"
        checked={selected}
        disabled={disabled}
        onChange={() => onToggle(id)}
      />
      <span>
        <CandidateDisplayLabel
          displayName={displayName}
          primaryGroup={primaryGroup}
        />
        {trailingNote ? <small className="subtle"> • {trailingNote}</small> : null}
      </span>
    </label>
  );
}
