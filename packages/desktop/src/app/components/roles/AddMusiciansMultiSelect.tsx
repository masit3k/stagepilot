import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "../../../components/ui/icons";
import type { MemberOption } from "../../shell/types";

/**
 * Popover for adding several musicians at once. Moved verbatim out of
 * ProjectSetupPage so the band form can reuse it (band editor spec R12).
 */
export type AddMusiciansMultiSelectProps = {
  id: string;
  options: MemberOption[];
  selectedIds: string[];
  placeholder: string;
  onSelectionChange: (nextSelectedIds: string[]) => void;
  onAddSelected: (selectedIds: string[]) => void;
};

export function AddMusiciansMultiSelect({
  id,
  options,
  selectedIds,
  placeholder,
  onSelectionChange,
  onAddSelected,
}: AddMusiciansMultiSelectProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [panelPosition, setPanelPosition] = useState<{
    left: number;
    top: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const orderedSelectedIds = options
    .filter((option) => selectedIdSet.has(option.id))
    .map((option) => option.id);

  const updatePanelPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const viewportMargin = 8;
    const preferredMaxHeight = Math.min(
      260,
      Math.round(window.innerHeight * 0.42),
    );
    const spaceBelow = window.innerHeight - rect.bottom - 6 - viewportMargin;
    const spaceAbove = rect.top - 6 - viewportMargin;
    const opensAbove =
      spaceBelow < preferredMaxHeight && spaceAbove > spaceBelow;
    const maxHeight = Math.max(
      120,
      Math.min(preferredMaxHeight, opensAbove ? spaceAbove : spaceBelow),
    );
    setPanelPosition({
      left: rect.left,
      top: opensAbove
        ? Math.max(viewportMargin, rect.top - maxHeight - 6)
        : rect.bottom + 6,
      width: rect.width,
      maxHeight,
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    updatePanelPosition();
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, updatePanelPosition]);

  const setSelectedFromSet = (nextSet: Set<string>) => {
    onSelectionChange(
      options
        .filter((option) => nextSet.has(option.id))
        .map((option) => option.id),
    );
  };
  const toggleOption = (musicianId: string) => {
    const nextSet = new Set(selectedIds);
    if (nextSet.has(musicianId)) {
      nextSet.delete(musicianId);
    } else {
      nextSet.add(musicianId);
    }
    setSelectedFromSet(nextSet);
  };
  const addSelected = () => {
    if (orderedSelectedIds.length === 0) return;
    onAddSelected(orderedSelectedIds);
    onSelectionChange([]);
    setIsOpen(false);
  };

  return (
    <div className="lineup-multiselect">
      <button
        id={id}
        ref={triggerRef}
        type="button"
        className="lineup-multiselect__trigger"
        aria-haspopup="true"
        aria-expanded={isOpen}
        onClick={() => {
          updatePanelPosition();
          setIsOpen((current) => !current);
        }}
      >
        <span>
          {options.length === 0 ? "All musicians assigned" : placeholder}
        </span>
        <span aria-hidden="true" className="lineup-multiselect__chevron">
          <ChevronDown size={14} />
        </span>
      </button>
      {isOpen && panelPosition && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              className="lineup-multiselect__popover"
              style={{
                left: `${panelPosition.left}px`,
                top: `${panelPosition.top}px`,
                width: `${panelPosition.width}px`,
                maxHeight: `${panelPosition.maxHeight}px`,
              }}
            >
              <div
                className="lineup-multiselect__options"
                aria-label={placeholder}
              >
                {options.length === 0 ? (
                  <p className="lineup-multiselect__empty">
                    No available musicians
                  </p>
                ) : (
                  options.map((option) => {
                    const selected = selectedIdSet.has(option.id);
                    return (
                      <button
                        key={option.id}
                        type="button"
                        className={
                          selected
                            ? "lineup-multiselect__option is-selected"
                            : "lineup-multiselect__option"
                        }
                        onClick={() => toggleOption(option.id)}
                      >
                        <input
                          type="checkbox"
                          tabIndex={-1}
                          checked={selected}
                          readOnly
                          aria-hidden="true"
                        />
                        <span>{option.name}</span>
                      </button>
                    );
                  })
                )}
              </div>
              <div className="lineup-multiselect__footer">
                <span>
                  {orderedSelectedIds.length === 1
                    ? "1 selected"
                    : `${orderedSelectedIds.length} selected`}
                </span>
                <button
                  type="button"
                  className="button-secondary"
                  disabled={orderedSelectedIds.length === 0}
                  onClick={addSelected}
                >
                  Add selected
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
