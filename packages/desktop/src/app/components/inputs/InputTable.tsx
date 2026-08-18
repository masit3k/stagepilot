import type {
  DragEvent as ReactDragEvent,
  KeyboardEvent as ReactKeyboardEvent,
} from "react";
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
 *
 * Ruční přeřazení (R8, Task 14) je HTML5 drag and drop nad `row.rawKey` —
 * `draggable` je jen aktivní řádek (tažení vypnutého nebo výplňového řádku
 * by tiše nezapsalo nic, viz `resolveActiveDropIndex`), ale drop cílem je
 * libovolný řádek: stránka přeloží klíč řádku, na který uživatel pustí, na
 * nejbližší aktivní pozici.
 */
export function InputTable({
  rows,
  selectedKey,
  onSelect,
  onReorder,
}: {
  rows: readonly InputEditorRow[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onReorder: (fromRawKey: string, toRowKey: string) => void;
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
        const isDraggable = row.state === "active";
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
        const onDragStart = (event: ReactDragEvent<HTMLDivElement>) => {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", row.rawKey);
        };
        const onDragOver = (event: ReactDragEvent<HTMLDivElement>) => {
          // Bez preventDefault() by prohlížeč onDrop na tenhle prvek vůbec
          // nezavolal — výchozí chování elementu je tažení odmítnout.
          event.preventDefault();
        };
        const onDrop = (event: ReactDragEvent<HTMLDivElement>) => {
          event.preventDefault();
          const fromRawKey = event.dataTransfer.getData("text/plain");
          if (fromRawKey) onReorder(fromRawKey, row.key);
        };

        return (
          <div
            key={row.key}
            className={classNames}
            role={isSelectable ? "button" : undefined}
            tabIndex={isSelectable ? 0 : undefined}
            onClick={isSelectable ? select : undefined}
            onKeyDown={isSelectable ? onKeyDown : undefined}
            draggable={isDraggable}
            onDragStart={isDraggable ? onDragStart : undefined}
            onDragOver={onDragOver}
            onDrop={onDrop}
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
