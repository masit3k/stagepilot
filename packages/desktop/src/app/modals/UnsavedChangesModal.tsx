import {
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  useModalBehavior,
} from "../../components/ui/Modal";
import { Close } from "../../components/ui/icons";

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
        aria-labelledby="unsaved-changes-title"
        aria-describedby="unsaved-changes-body"
        ref={dialogRef}
      >
        <button
          type="button"
          className="modal-close"
          onClick={onStay}
          aria-label="Close"
        >
          <Close />
        </button>
        <ModalHeader>
          <h3 id="unsaved-changes-title">Unsaved changes</h3>
          <p id="unsaved-changes-body">
            You have unsaved changes. What would you like to do?
          </p>
        </ModalHeader>
        <ModalFooter>
          <button
            type="button"
            className="button-secondary"
            onClick={onSaveAndExit}
          >
            Save & Exit
          </button>
          <button
            type="button"
            className="button-danger"
            onClick={onExitWithoutSaving}
          >
            Exit without saving
          </button>
          <button type="button" className="button-primary" onClick={onStay}>
            Stay
          </button>
        </ModalFooter>
      </div>
    </ModalOverlay>
  );
}
