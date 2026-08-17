import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import type { InputEditorRow } from "../../domain/inputs/buildInputEditorRows";

/**
 * Tabulka kanálů obrazovky `02` (R1). Tři sloupce — `no.` / `input` / `note` —
 * beze sloupce vlastníka (R2): ten patří inspektoru pravé strany z pozdějšího
 * tasku.
 *
 * Vypnutý řádek (`removed`) zůstává na svém místě, ale nedostane číslo (R3):
 * `——` místo čísla dává vizuálně najevo, že se do tisku nepočítá. Výplňový
 * řádek (`filler`) naopak číslo má — je to jediný typ řádku, který nejde
 * vybrat ani přesunout, protože nemá vlastníka.
 */
export function InputTable({
  rows,
  selectedKey,
  onSelect,
}: {
  rows: readonly InputEditorRow[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
}) {
  return (
    <div className="inputTable">
      <div className="inputRow inputRow--head">
        <span className="inputRow__no">no.</span>
        <span className="inputRow__input">input</span>
        <span className="inputRow__note">note</span>
      </div>
      {rows.map((row) => {
        const isSelectable = row.state !== "filler";
        const classNames = [
          "inputRow",
          row.state === "removed" ? "inputRow--removed" : "",
          row.state === "filler" ? "inputRow--filler" : "",
          isSelectable && row.key === selectedKey ? "inputRow--selected" : "",
        ]
          .filter(Boolean)
          .join(" ");
        const select = () => onSelect(row.key);
        const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          select();
        };

        return (
          <div
            key={row.key}
            className={classNames}
            role={isSelectable ? "button" : undefined}
            tabIndex={isSelectable ? 0 : undefined}
            onClick={isSelectable ? select : undefined}
            onKeyDown={isSelectable ? onKeyDown : undefined}
          >
            <span className="inputRow__no">
              {row.ch === null ? "——" : row.ch}
            </span>
            <span className="inputRow__input">{row.label}</span>
            <span className="inputRow__note">{row.note}</span>
          </div>
        );
      })}
    </div>
  );
}
