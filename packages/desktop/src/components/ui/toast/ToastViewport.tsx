import { createPortal } from "react-dom";
import { Close } from "../icons";
import type { Toast, ToastKind } from "./toastQueue";

/** Spelled out rather than composed, so every class stays greppable. */
const KIND_CLASS: Record<ToastKind, string> = {
  success: "toast toast--success",
  error: "toast toast--error",
  info: "toast toast--info",
};

/**
 * Renders the toast stack into a portal on body, above the app but below modal
 * overlays, so a toast never covers a dialog that is waiting for an answer.
 */
export function ToastViewport({
  toasts,
  onDismiss,
  onPause,
  onResume,
}: {
  toasts: readonly Toast[];
  onDismiss: (id: number) => void;
  onPause: (id: number) => void;
  onResume: (id: number, kind: ToastKind) => void;
}) {
  if (typeof document === "undefined" || toasts.length === 0) return null;

  return createPortal(
    <div className="toast-viewport">
      {toasts.map((toast) => (
        <output
          key={toast.id}
          className={KIND_CLASS[toast.kind]}
          // Errors interrupt; the rest wait their turn in the queue.
          aria-live={toast.kind === "error" ? "assertive" : "polite"}
          onMouseEnter={() => onPause(toast.id)}
          onMouseLeave={() => onResume(toast.id, toast.kind)}
        >
          <span className="toast__message">{toast.message}</span>
          <button
            type="button"
            className="toast__close"
            aria-label="Dismiss notification"
            onClick={() => onDismiss(toast.id)}
          >
            <Close size={14} />
          </button>
        </output>
      ))}
    </div>,
    document.body,
  );
}
