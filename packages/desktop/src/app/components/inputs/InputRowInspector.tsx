import { getRoleDisplayName } from "../../../projectRules";
import type { InputEditorRow } from "../../domain/inputs/buildInputEditorRows";
import { resolveInputRowEditability } from "../../domain/inputs/resolveInputRowEditability";

/**
 * Panel vybraného řádku obrazovky `02` (R2). Vlastník kanálu, který tabulka
 * schválně nenese ve sloupci, žije tady — jméno, role, počet kanálů a počet
 * odchylek od výchozí výbavy muzikanta.
 *
 * Textová pole pro `input` a `note` editují přímo `row.label` / `row.note` —
 * volající je zapisuje do `presetOverride.inputs.update[]` přes
 * `updateInputRow` (R6). `Input` je ale needitovatelný, když
 * `row.labelIsCanonical` (bicí kick/snare/tom/floor a každý lead/back
 * vokální řádek) — jejich label si dokument vždycky přepočítá sám, takže
 * přejmenování by se tiše zahodilo (task 12c). `Note` zůstává editovatelné
 * vždy.
 *
 * `Save as musician default` (R5) jen volá callback z propsů — potvrzení a
 * samotné volání Tauri příkazu žijí ve stránce, protože mění trvalá data
 * muzikanta napříč projekty, ne jen tenhle slot.
 *
 * `Remove channel` / `Restore channel` (R3) jsou navzájem výlučné podle
 * `row.state` — vypnutí a vrácení kanálu, patch zapisuje `toggleInputRow`
 * (Task 13) ve stránce. Ani jedno se nenabízí, když
 * `resolveInputRowEditability` řekne, že patch, který by tlačítko zapsalo,
 * se do dokumentu nedostane — bicí kanál (`ownerRole === "drums"`) a každý
 * vokální/talkback řádek (`group === "vocs"`/`"talkback"`), viz task 13b.
 * Bez tohohle gatu by `Remove channel` na bicím kanálu řádek přeškrtl,
 * zatímco dokument by ho dál tiskl beze změny — aktivní falešné potvrzení
 * úspěchu.
 */
export function InputRowInspector({
  row,
  ownerName,
  channelCount,
  deviationCount,
  canSaveAsMusicianDefault,
  onLabelChange,
  onNoteChange,
  onResetToDefault,
  onSaveAsMusicianDefault,
  onRemoveChannel,
  onRestoreChannel,
}: {
  row: InputEditorRow | null;
  ownerName: string;
  channelCount: number;
  deviationCount: number;
  /** Value-based, unlike `deviationCount`: false when the slot's effective preset already equals the musician's current default — nothing left to promote (R5). */
  canSaveAsMusicianDefault: boolean;
  onLabelChange: (label: string) => void;
  onNoteChange: (note: string) => void;
  onResetToDefault: () => void;
  onSaveAsMusicianDefault: () => void;
  onRemoveChannel: () => void;
  onRestoreChannel: () => void;
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
  const toggleEditability = resolveInputRowEditability({
    ownerRole: row.ownerRole,
    group: row.group,
  });

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
              disabled={row.labelIsCanonical}
              onChange={(event) => onLabelChange(event.target.value)}
            />
          </label>
          {row.labelIsCanonical ? (
            <p className="inputInspector__hint">
              Name follows the document's naming convention — not editable.
            </p>
          ) : null}
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
              {toggleEditability.canEdit && row.state === "active" ? (
                <button
                  type="button"
                  className="button-secondary"
                  onClick={onRemoveChannel}
                >
                  Remove channel
                </button>
              ) : null}
              {toggleEditability.canEdit && row.state === "removed" ? (
                <button
                  type="button"
                  className="button-secondary"
                  onClick={onRestoreChannel}
                >
                  Restore channel
                </button>
              ) : null}
              {!toggleEditability.canEdit &&
              (row.state === "active" || row.state === "removed") ? (
                <p className="inputInspector__hint">
                  {toggleEditability.reason === "drums-not-supported"
                    ? "Removing or restoring a drum channel isn't picked up by the printed document yet — not editable here."
                    : "Removing or restoring a vocal or talkback channel isn't picked up by the printed document yet — not editable here."}
                </p>
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
                disabled={!canSaveAsMusicianDefault}
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
