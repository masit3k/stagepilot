import { useState } from "react";
import {
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  useModalBehavior,
} from "../../../components/ui/Modal";
import { Close } from "../../../components/ui/icons";
import {
  type BandUsage,
  describeBandUsage,
} from "../../domain/band/bandDeletion";
import type { DeleteBandResult } from "../../services/bandsApi";

type DeleteDialog =
  | { readonly kind: "closed" }
  | { readonly kind: "confirm"; readonly isDeleting: boolean }
  | { readonly kind: "blocked"; readonly projects: readonly BandUsage[] };

type NotDeleted = Exclude<DeleteBandResult, { ok: true }>;

/**
 * Dodatek A3 + Ruling 11: klik nejdřív zavolá `onCheck` (dry run
 * `delete_band`). Blokují-li kapelu projekty, dialog je rovnou vypíše a nabídne
 * jen zavření; jinak potvrzení a `onDelete`, který kontrolu v Rustu zopakuje.
 */
export function BandDeleteSection({
  bandName,
  onCheck,
  onDelete,
  onDeleted,
  onFailed,
}: {
  bandName: string;
  onCheck: () => Promise<DeleteBandResult>;
  onDelete: () => Promise<DeleteBandResult>;
  onDeleted: () => void;
  onFailed: (message: string) => void;
}) {
  const [dialog, setDialog] = useState<DeleteDialog>({ kind: "closed" });
  const [isChecking, setIsChecking] = useState(false);
  const close = () => setDialog({ kind: "closed" });
  const dialogRef = useModalBehavior(dialog.kind !== "closed", close);

  /** Nesmazáno: blokace → seznam projektů, jiné selhání → toast. */
  const showNotDeleted = (result: NotDeleted) => {
    if (result.kind === "inUse") {
      setDialog({ kind: "blocked", projects: result.projects });
      return;
    }
    close();
    onFailed(result.message);
  };

  const check = () => {
    setIsChecking(true);
    void onCheck().then((result) => {
      setIsChecking(false);
      if (result.ok) {
        setDialog({ kind: "confirm", isDeleting: false });
        return;
      }
      showNotDeleted(result);
    });
  };

  const confirm = () => {
    setDialog({ kind: "confirm", isDeleting: true });
    void onDelete().then((result) => {
      if (result.ok) {
        onDeleted();
        return;
      }
      showNotDeleted(result);
    });
  };

  return (
    <section
      className="lineup-card band-form__danger"
      aria-labelledby="band-delete-heading"
    >
      <h3 id="band-delete-heading">Delete band</h3>
      <p className="subtle">
        Removes the band from your library. Musicians and their contacts stay. A
        band that projects still use cannot be deleted.
      </p>
      <button
        type="button"
        className="button-danger"
        disabled={isChecking}
        onClick={check}
      >
        {isChecking ? "Checking…" : "Delete band"}
      </button>
      <ModalOverlay open={dialog.kind !== "closed"} onClose={close}>
        <div
          className="selector-dialog"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="band-delete-title"
          ref={dialogRef}
        >
          <button
            type="button"
            className="modal-close"
            onClick={close}
            aria-label="Close"
          >
            <Close />
          </button>
          {dialog.kind === "blocked" ? (
            <BlockedBody projects={dialog.projects} onClose={close} />
          ) : (
            <ConfirmBody
              bandName={bandName}
              isDeleting={dialog.kind === "confirm" && dialog.isDeleting}
              onCancel={close}
              onConfirm={confirm}
            />
          )}
        </div>
      </ModalOverlay>
    </section>
  );
}

function ConfirmBody({
  bandName,
  isDeleting,
  onCancel,
  onConfirm,
}: {
  bandName: string;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <>
      <ModalHeader>
        <h3 id="band-delete-title">Delete band {bandName}?</h3>
        <p>
          The band file is removed from your library. Musicians and their
          contacts stay.
        </p>
      </ModalHeader>
      <ModalFooter>
        <button type="button" className="button-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="button-danger"
          disabled={isDeleting}
          onClick={onConfirm}
        >
          {isDeleting ? "Deleting…" : "Delete band"}
        </button>
      </ModalFooter>
    </>
  );
}

/** A3: zablokované smazání nabízí jen zavření. */
function BlockedBody({
  projects,
  onClose,
}: {
  projects: readonly BandUsage[];
  onClose: () => void;
}) {
  return (
    <>
      <ModalHeader>
        <h3 id="band-delete-title">This band is still in use</h3>
        <p>
          Delete these projects first, including archived ones and those in the
          trash. Then you can delete the band.
        </p>
      </ModalHeader>
      <BandUsageList projects={projects} />
      <ModalFooter>
        <button type="button" className="button-primary" onClick={onClose}>
          Close
        </button>
      </ModalFooter>
    </>
  );
}

export function BandUsageList({
  projects,
}: {
  projects: readonly BandUsage[];
}) {
  if (projects.length === 0) {
    return (
      <p className="status status--error">
        The projects that use this band could not be listed.
      </p>
    );
  }
  return (
    <ul className="band-form__usages">
      {projects.map((usage) => (
        <li key={usage.file}>{describeBandUsage(usage)}</li>
      ))}
    </ul>
  );
}
