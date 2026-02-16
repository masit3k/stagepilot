import { useEffect, useMemo, useRef, useState } from "react";

export function EventDateInput({
  value,
  isoValue,
  minIso,
  maxIso,
  onInput,
  onIsoSelect,
  onBlur,
  inputId,
}: {
  value: string;
  isoValue: string;
  minIso: string;
  maxIso: string;
  onInput: (value: string) => void;
  onIsoSelect: (iso: string) => void;
  onBlur: () => void;
  inputId?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [monthCursor, setMonthCursor] = useState(() => {
    const source = isoValue || minIso;
    const [y, m] = source.split("-").map(Number);
    return new Date(y || new Date().getFullYear(), (m || 1) - 1, 1);
  });
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const source = isoValue || minIso;
    const [y, m] = source.split("-").map(Number);
    setMonthCursor(new Date(y || new Date().getFullYear(), (m || 1) - 1, 1));
  }, [isoValue, minIso]);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [isOpen]);

  const days = useMemo(() => {
    const year = monthCursor.getFullYear();
    const month = monthCursor.getMonth();
    const firstDay = new Date(year, month, 1);
    const firstWeekday = (firstDay.getDay() + 6) % 7;
    const monthStart = new Date(year, month, 1 - firstWeekday);
    return Array.from({ length: 42 }, (_, idx) => {
      const day = new Date(monthStart);
      day.setDate(monthStart.getDate() + idx);
      const yyyy = day.getFullYear();
      const mm = String(day.getMonth() + 1).padStart(2, "0");
      const dd = String(day.getDate()).padStart(2, "0");
      const iso = `${yyyy}-${mm}-${dd}`;
      return { iso, label: dd, inMonth: day.getMonth() === month };
    });
  }, [monthCursor]);

  return (
    <div className="date-input-wrap" ref={wrapperRef}>
      <div className="date-input-control">
        <input
          id={inputId}
          type="text"
          inputMode="numeric"
          lang="en-GB"
          placeholder="DD/MM/YYYY"
          value={value}
          onChange={(e) => onInput(e.target.value)}
          onBlur={onBlur}
        />
        <button
          type="button"
          className="date-input-calendar-toggle"
          aria-label="Toggle calendar"
          onClick={() => setIsOpen((current) => !current)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3.5" y="5.5" width="17" height="15" rx="2.5" />
            <path d="M7 3.5v4M17 3.5v4M3.5 9.5h17" />
          </svg>
        </button>
      </div>
      {isOpen ? (
        <div className="calendar-popover" role="dialog" aria-label="Calendar">
          <div className="calendar-popover__header">
            <button
              type="button"
              className="button-secondary"
              onClick={() =>
                setMonthCursor(
                  (current) =>
                    new Date(current.getFullYear(), current.getMonth() - 1, 1),
                )
              }
            >
              ←
            </button>
            <strong>
              {new Intl.DateTimeFormat("en-GB", {
                month: "long",
                year: "numeric",
              }).format(monthCursor)}
            </strong>
            <button
              type="button"
              className="button-secondary"
              onClick={() =>
                setMonthCursor(
                  (current) =>
                    new Date(current.getFullYear(), current.getMonth() + 1, 1),
                )
              }
            >
              →
            </button>
          </div>
          <div className="calendar-grid">
            {(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const).map(
              (label) => (
                <span key={label} className="calendar-grid__weekday">
                  {label}
                </span>
              ),
            )}
            {days.map((day) => {
              const isDisabled = day.iso < minIso || day.iso > maxIso;
              const isSelected = day.iso === isoValue;
              return (
                <button
                  key={day.iso}
                  type="button"
                  className={
                    isSelected
                      ? "calendar-grid__day is-selected"
                      : day.inMonth
                        ? "calendar-grid__day"
                        : "calendar-grid__day is-outside"
                  }
                  disabled={isDisabled}
                  onClick={() => {
                    onIsoSelect(day.iso);
                    setIsOpen(false);
                  }}
                >
                  {day.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

