import { invoke } from "@tauri-apps/api/core";
import {
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  useModalBehavior,
} from "../../components/ui/Modal";
import { Close } from "../../components/ui/icons";

export type ExportModalState =
  | { kind: "success"; path: string }
  | { kind: "error"; message: string; technical?: string }
  | null;

export function ExportResultModal({
  state,
  onClose,
  onRetry,
  onGoToHub,
}: {
  state: ExportModalState;
  onClose: () => void;
  onRetry: () => void;
  onGoToHub: () => void;
}) {
  if (!state) return null;
  const isSuccess = state.kind === "success";
  const dialogRef = useModalBehavior(Boolean(state), onClose);
  return (
    <ModalOverlay open={Boolean(state)} onClose={onClose}>
      <div
        className="selector-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-result-title"
        aria-describedby="export-result-body"
        ref={dialogRef}
      >
        <button
          type="button"
          className="modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          <Close />
        </button>
        <ModalHeader>
          <h3 id="export-result-title">
            {isSuccess ? "Export complete" : "Export failed"}
          </h3>
        </ModalHeader>
        {isSuccess ? (
          <p
            id="export-result-body"
            className="status status--success"
            aria-live="polite"
          >
            PDF was saved successfully.
          </p>
        ) : (
          <div
            id="export-result-body"
            className="status status--error"
            role="alert"
          >
            <p>{state.message}</p>
            <p className="subtle">{state.technical || state.message}</p>
          </div>
        )}
        <ModalFooter>
          {isSuccess ? (
            <>
              <button
                type="button"
                className="button-secondary"
                onClick={() => invoke("open_file", { path: state.path })}
              >
                Open file
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={() =>
                  invoke("reveal_in_explorer", { path: state.path })
                }
              >
                Open folder
              </button>
              <button
                type="button"
                className="button-primary"
                onClick={onGoToHub}
              >
                Go to Project Hub
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="button-secondary"
                onClick={onRetry}
              >
                Retry
              </button>
              <button
                type="button"
                className="button-primary"
                onClick={onClose}
              >
                Close
              </button>
            </>
          )}
        </ModalFooter>
      </div>
    </ModalOverlay>
  );
}
