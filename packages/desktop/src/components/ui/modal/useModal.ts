import { useEffect, useRef } from "react";
import { getFocusableElements, getFocusableSelector, lockBodyScroll } from "./modalUtils";

export function useModalBehavior(open: boolean, onClose: () => void, allowEscapeClose = true) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const cleanupScroll = lockBodyScroll();
    const focusable = dialogRef.current?.querySelector<HTMLElement>(getFocusableSelector());
    focusable?.focus();
    return cleanupScroll;
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
