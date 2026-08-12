import { useEffect, useRef } from "react";
import {
  getFocusableElements,
  getFocusableSelector,
  lockBodyScroll,
} from "./modalUtils";

export function useModalBehavior(
  open: boolean,
  onClose: () => void,
  allowEscapeClose = true,
) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const cleanupScroll = lockBodyScroll();
    // Remember what opened the dialog so focus can go back there on close —
    // otherwise keyboard users are dropped at the top of the document.
    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const focusable = dialogRef.current?.querySelector<HTMLElement>(
      getFocusableSelector(),
    );
    focusable?.focus();

    return () => {
      cleanupScroll();
      const trigger = previouslyFocusedRef.current;
      previouslyFocusedRef.current = null;
      // Skip if the trigger has since left the document (e.g. the row it lived
      // in was deleted by the very action the dialog confirmed).
      if (trigger?.isConnected) trigger.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && allowEscapeClose) {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const container = dialogRef.current;
      if (!container) return;
      const focusables = getFocusableElements(container);
      if (focusables.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [allowEscapeClose, onClose, open]);

  return dialogRef;
}
