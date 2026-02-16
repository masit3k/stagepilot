import { invoke } from "@tauri-apps/api/core";
import { ModalOverlay, useModalBehavior } from "../../components/ui/Modal";

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
        ref={dialogRef}
      >
        <button
          type="button"
          className="modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        <h3>{isSuccess ? "Export complete" : "Export failed"}</h3>
        {isSuccess ? (
          <p>PDF was saved successfully.</p>
        ) : (
          <>
            <p>
              Something went wrong during export. If this file is open in
              another program (or preview), close it and retry.
            </p>
            <p className="subtle">
              {state.message}
              {state.technical ? ` — ${state.technical}` : ""}
            </p>
          </>
        )}
        <div className="modal-actions">
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
                onClick={() => invoke("reveal_in_explorer", { path: state.path })}
              >
                Open folder
              </button>
              <button type="button" onClick={onGoToHub}>
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
              <button type="button" onClick={onClose}>
                Close
              </button>
            </>
          )}
        </div>
      </div>
    </ModalOverlay>
  );
}
