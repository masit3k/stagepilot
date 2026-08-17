import { getRoleDisplayName } from "../../../projectRules";
import type { InputEditorRow } from "../../domain/inputs/buildInputEditorRows";

/**
 * Panel vybraného řádku obrazovky `02` (R2). Vlastník kanálu, který tabulka
 * schválně nenese ve sloupci, žije tady — jméno, role, počet kanálů a počet
 * odchylek od výchozí výbavy muzikanta.
 *
 * Textová pole pro `input` a `note` editují přímo `row.label` / `row.note` —
 * volající je zapisuje do `presetOverride.inputs.update[]` přes
 * `updateInputRow` (R6).
 *
 * `Save as musician default` (R5) jen volá callback z propsů — potvrzení a
 * samotné volání Tauri příkazu žijí ve stránce, protože mění trvalá data
 * muzikanta napříč projekty, ne jen tenhle slot.
 */
export function InputRowInspector({
  row,
  ownerName,
  channelCount,
  deviationCount,
  onLabelChange,
  onNoteChange,
  onResetToDefault,
  onSaveAsMusicianDefault,
}: {
  row: InputEditorRow | null;
  ownerName: string;
  channelCount: number;
  deviationCount: number;
  onLabelChange: (label: string) => void;
  onNoteChange: (note: string) => void;
  onResetToDefault: () => void;
  onSaveAsMusicianDefault: () => void;
}) {
  if (!row) {
    return (
      <aside className="inputInspector" aria-label="Selected channel">
        <div className="inputInspector__eyebrow">NO CHANNEL SELECTED</div>
      </aside>
    );
  }

  // Empty `slotKey` means the owner has no lineup slot to write a patch to
  // (filler row, or an owner that came from the band default lineup) — the
  // panel must not offer editing in that case.
  const canEditSlot = row.slotKey !== "";
  const hasOwner = row.ownerMusicianId !== "";

  return (
    <aside className="inputInspector" aria-label="Selected channel">
      <div className="inputInspector__section">
        <div className="inputInspector__eyebrow">SELECTED CHANNEL</div>
        <div className="inputInspector__title">{row.label}</div>
      </div>

      {canEditSlot ? (
        <div className="inputInspector__section">
          <label className="inputInspector__field">
            <span className="inputInspector__label">Input</span>
            <input
              type="text"
              value={row.label}
              onChange={(event) => onLabelChange(event.target.value)}
            />
          </label>
          <label className="inputInspector__field">
            <span className="inputInspector__label">Note</span>
            <input
              type="text"
              value={row.note}
              onChange={(event) => onNoteChange(event.target.value)}
            />
          </label>
        </div>
      ) : (
        <p className="inputInspector__hint">
          Not editable — this channel has no assigned lineup slot.
        </p>
      )}

      {hasOwner ? (
        <>
          <hr className="inputInspector__divider" />
          <div className="inputInspector__section">
            <div className="inputInspector__row">
              <span className="inputInspector__ownerName">{ownerName}</span>
              <span className="inputInspector__ownerRole">
                {getRoleDisplayName(row.ownerRole)}
              </span>
            </div>
            <div className="inputInspector__row">
              <span className="inputInspector__label">CHANNELS</span>
              <span className="inputInspector__value">{channelCount}</span>
            </div>
            <div className="inputInspector__row">
              <span className="inputInspector__label">DEVIATIONS</span>
              <span className="inputInspector__value">{deviationCount}</span>
            </div>
          </div>

          {canEditSlot ? (
            <div className="inputInspector__actions">
              {row.ownerRole === "drums" ? (
                <button
                  type="button"
                  className="button-secondary"
                  disabled
                  title="Coming soon"
                >
                  Edit kit
                </button>
              ) : null}
              <button
                type="button"
                className="button-secondary"
                disabled={deviationCount === 0}
                onClick={onResetToDefault}
              >
                Reset to default
              </button>
              <button
                type="button"
                className="button-secondary"
                disabled={deviationCount === 0}
                onClick={onSaveAsMusicianDefault}
              >
                Save as musician default
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </aside>
  );
}
