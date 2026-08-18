import { useEffect, useRef, useState } from "react";
import type { Group } from "../../../../../../src/domain/model/groups";
import type { InputChannel } from "../../../../../../src/domain/model/types";
import { ModalOverlay, useModalBehavior } from "../../../components/ui/Modal";
import { getRoleDisplayName } from "../../../projectRules";

/** Jeden obsazený slot lineupu — kandidát na vlastníka nového kanálu (R4). Talkback se nenabízí, nemá vlastní slot v lineupu. */
export type AddInputOwnerOption = {
  readonly role: Group;
  readonly musicianId: string;
  readonly name: string;
};

function ownerOptionKey(owner: AddInputOwnerOption): string {
  return `${owner.role}:${owner.musicianId}`;
}

/**
 * Dvoukrokový picker pro přidání kanálu z katalogu (R4): krok `owner` vybere
 * obsazený slot lineupu, krok `channel` nabídne kanály role vlastníka
 * (`GROUP_INPUT_LIBRARY[role]`), které slot ještě nemá. Vlastník je povinný —
 * kanál bez něj nejde umístit do boxu stage planu — proto se nedá kanál
 * vybrat dřív, než je vlastník zvolený.
 *
 * `getAvailableChannels` čte aktuální efektivní preset vlastníka (patch +
 * default), ne statický katalog — kanál, který vlastník už má (výchozí nebo
 * dřív přidaný), se v kroku `channel` nenabízí znovu.
 */
export function AddInputPicker({
  open,
  owners,
  getAvailableChannels,
  onCancel,
  onAdd,
}: {
  open: boolean;
  owners: readonly AddInputOwnerOption[];
  getAvailableChannels: (owner: AddInputOwnerOption) => InputChannel[];
  onCancel: () => void;
  onAdd: (owner: AddInputOwnerOption, input: InputChannel) => void;
}) {
  const [step, setStep] = useState<"owner" | "channel">("owner");
  const [selectedOwnerKey, setSelectedOwnerKey] = useState<string | null>(null);
  const wasOpenRef = useRef(false);
  const dialogRef = useModalBehavior(open, onCancel);

  // Reset to step one every time the dialog opens fresh, not on every
  // re-render while it stays open — otherwise picking an owner would bounce
  // straight back to step one on the next render.
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setStep("owner");
      setSelectedOwnerKey(null);
    }
    wasOpenRef.current = open;
  }, [open]);

  const selectedOwner =
    owners.find((owner) => ownerOptionKey(owner) === selectedOwnerKey) ?? null;
  const availableChannels = selectedOwner
    ? getAvailableChannels(selectedOwner)
    : [];

  return (
    <ModalOverlay open={open} onClose={onCancel}>
      <div
        className="selector-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-input-picker-title"
        ref={dialogRef}
      >
        <div className="panel__header panel__header--stack selector-dialog__title">
          <h3 id="add-input-picker-title">Add input</h3>
          <p className="subtle">
            {step === "owner"
              ? "Pick who this channel belongs to."
              : `Pick a channel for ${selectedOwner?.name ?? ""}.`}
          </p>
        </div>
        <div className="selector-dialog__divider section-divider" />
        <div className="selector-dialog__body">
          {step === "owner" ? (
            owners.length === 0 ? (
              <p className="inputPicker__empty">
                No lineup members are assigned yet.
              </p>
            ) : (
              <div className="inputPicker__list">
                {owners.map((owner) => (
                  <button
                    key={ownerOptionKey(owner)}
                    type="button"
                    className="inputPicker__option"
                    onClick={() => {
                      setSelectedOwnerKey(ownerOptionKey(owner));
                      setStep("channel");
                    }}
                  >
                    <span>{owner.name}</span>
                    <span className="inputPicker__optionMeta">
                      {getRoleDisplayName(owner.role)}
                    </span>
                  </button>
                ))}
              </div>
            )
          ) : availableChannels.length === 0 ? (
            <p className="inputPicker__empty">
              {`${selectedOwner?.name ?? "This musician"} already has every channel from the catalog.`}
            </p>
          ) : (
            <div className="inputPicker__list">
              {availableChannels.map((input) => (
                <button
                  key={input.key}
                  type="button"
                  className="inputPicker__option"
                  onClick={() => selectedOwner && onAdd(selectedOwner, input)}
                >
                  <span>{input.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="modal-actions">
          {step === "channel" ? (
            <button
              type="button"
              className="button-secondary"
              onClick={() => setStep("owner")}
            >
              Back
            </button>
          ) : null}
          <button type="button" className="button-secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
