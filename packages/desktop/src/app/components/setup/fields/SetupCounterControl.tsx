type SetupCounterControlProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
  disabled?: boolean;
  stopPropagation?: boolean;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function SetupCounterControl({
  label,
  value,
  min,
  max,
  onChange,
  disabled = false,
  stopPropagation = false,
}: SetupCounterControlProps) {
  const safeValue = clamp(value, min, max);

  const stopEvent = (event: { stopPropagation: () => void }) => {
    if (stopPropagation) event.stopPropagation();
  };

  return (
    <div className="setup-stepper">
      <button
        type="button"
        className="setup-stepper__btn"
        aria-label={`Decrease ${label}`}
        disabled={disabled || safeValue <= min}
        onClick={(event) => {
          stopEvent(event);
          onChange(clamp(safeValue - 1, min, max));
        }}
        onMouseDown={stopEvent}
      >
        −
      </button>
      <span
        className="setup-stepper__value"
        aria-label={`${label}: ${safeValue}`}
        onClick={stopEvent}
        onMouseDown={stopEvent}
      >
        {safeValue}
      </span>
      <button
        type="button"
        className="setup-stepper__btn"
        aria-label={`Increase ${label}`}
        disabled={disabled || safeValue >= max}
        onClick={(event) => {
          stopEvent(event);
          onChange(clamp(safeValue + 1, min, max));
        }}
        onMouseDown={stopEvent}
      >
        +
      </button>
    </div>
  );
}
