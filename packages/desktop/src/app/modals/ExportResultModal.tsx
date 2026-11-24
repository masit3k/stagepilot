import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";
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
  const dialogRef = useModalBehavior(Boolean(state), onClose);
  // The failure is kept with the export result it belongs to, so the next
  // result does not inherit a stale message.
  const [openFailure, setOpenFailure] = useState<{
    result: ExportModalState;
    message: string;
  } | null>(null);
  if (!state) return null;
  const isSuccess = state.kind === "success";
  const openError = openFailure?.result === state ? openFailure.message : "";
  const openExported = (command: string, path: string, message: string) => {
    setOpenFailure(null);
    invoke(command, { path }).catch((error) => {
      console.error("Failed to open exported PDF", { command, path, error });
      setOpenFailure({ result: state, message });
    });
  };
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
        {openError ? (
          <p className="status status--error" role="alert">
            {openError}
          </p>
        ) : null}
        <ModalFooter>
          {isSuccess ? (
            <>
              <button
                type="button"
                className="button-secondary"
                onClick={() =>
                  openExported(
                    "open_file",
                    state.path,
                    "Could not open the file.",
                  )
                }
              >
                Open file
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={() =>
                  openExported(
                    "reveal_in_explorer",
                    state.path,
                    "Could not open the folder.",
                  )
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
