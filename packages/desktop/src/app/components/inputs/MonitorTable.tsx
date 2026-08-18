import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import type { Group } from "../../../../../../src/domain/model/groups";

export type MonitorEditorRow = {
  readonly no: string;
  readonly output: string;
  readonly note: string;
  readonly ownerRole: Group;
  readonly ownerMusicianId: string;
  /** Prázdné, když vlastník nemá slot v `project.lineup` — takový řádek se nedá vybrat (obranný případ, `document.monitorTableRows` dnes vždy nese lineup muzikanta). */
  readonly slotKey: string;
};

/**
 * Tabulka monitorů obrazovky `02` (R7) — stejné tři sloupce jako tiskne
 * `renderMonitorTable`: `no.` / `monitor output` / `note`. Řádek na
 * muzikanta s monitorem, přímo z `document.monitorTableRows` — číslo, výstup
 * ani poznámka se tu nikdy nepřepočítávají, jen se čtou (stejná konvence jako
 * `InputTable`).
 *
 * Klik na řádek vybere jeho slot; panel vpravo pak přepne na editaci
 * monitoringu daného slotu. Řádek bicích je vybratelný stejně jako každý
 * jiný — needitovatelnost bicích řeší až panel
 * (`resolveMonitorRowEditability`, Ruling task 15), tabulka ji nijak
 * nevyznačuje, aby zůstala prostým zrcadlem tisku.
 */
export function MonitorTable({
  rows,
  selectedSlotKey,
  onSelect,
}: {
  rows: readonly MonitorEditorRow[];
  selectedSlotKey: string | null;
  onSelect: (slotKey: string) => void;
}) {
  return (
    <div className="inputTable">
      <div className="inputRow inputRow--head">
        <span className="inputRow__no">no.</span>
        <span className="inputRow__input">monitor output</span>
        <span className="inputRow__note">note</span>
      </div>
      {rows.map((row) => {
        const isSelectable = row.slotKey !== "";
        const isSelected = isSelectable && row.slotKey === selectedSlotKey;
        const select = () => onSelect(row.slotKey);
        const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          select();
        };

        return (
          <div
            key={row.no}
            className={`inputRow ${isSelected ? "inputRow--selected" : ""}`}
            role={isSelectable ? "button" : undefined}
            tabIndex={isSelectable ? 0 : undefined}
            onClick={isSelectable ? select : undefined}
            onKeyDown={isSelectable ? onKeyDown : undefined}
          >
            <span className="inputRow__no">{row.no}</span>
            <span className="inputRow__input">{row.output}</span>
            <span className="inputRow__note">{row.note}</span>
          </div>
        );
      })}
    </div>
  );
}
