import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "../../../components/ui/icons";
import type { MemberOption } from "../../shell/types";
import {
  type PanelPosition,
  computeMultiSelectPanelPosition,
} from "./utils/multiSelectPanelPosition";

/**
 * Popover for adding several musicians at once. Shared by the band form and
 * the assignment dialog of 01 LINEUP (band editor spec R12). The panel
 * position is a pure function, so it is tested without a DOM (amendment A4.1).
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
  const [panelPosition, setPanelPosition] = useState<PanelPosition | null>(
    null,
  );
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const orderedSelectedIds = options
    .filter((option) => selectedIdSet.has(option.id))
    .map((option) => option.id);

  const updatePanelPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    setPanelPosition(
      computeMultiSelectPanelPosition(trigger.getBoundingClientRect(), {
        width: document.documentElement.clientWidth,
        height: window.innerHeight,
      }),
    );
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
