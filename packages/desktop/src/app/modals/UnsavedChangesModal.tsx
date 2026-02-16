import { ModalOverlay, useModalBehavior } from "../../components/ui/Modal";

export function UnsavedChangesModal({
  open,
  onSaveAndExit,
  onExitWithoutSaving,
  onStay,
}: {
  open: boolean;
  onSaveAndExit: () => void | Promise<void>;
  onExitWithoutSaving: () => void;
  onStay: () => void;
}) {
  const dialogRef = useModalBehavior(open, onStay);
  return (
    <ModalOverlay
      open={open}
      onClose={onStay}
      className="selector-overlay--topmost"
    >
      <div
        className="selector-dialog"
        role="alertdialog"
        aria-modal="true"
        ref={dialogRef}
      >
        <button
          type="button"
          className="modal-close"
          onClick={onStay}
          aria-label="Close"
        >
          ×
        </button>
        <h3>Unsaved changes</h3>
        <p>You have unsaved changes. What would you like to do?</p>
        <div className="modal-actions">
          <button
            type="button"
            className="button-secondary"
            onClick={onSaveAndExit}
          >
            Save & Exit
          </button>
          <button
            type="button"
            className="button-secondary"
            onClick={onExitWithoutSaving}
          >
            Exit without saving
          </button>
          <button type="button" onClick={onStay}>
            Stay
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
