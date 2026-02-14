import { useEffect } from "react";

export function useUnsavedChangesGuard(enabled: boolean, onConfirmExit: () => void) {
  useEffect(() => {
    if (!enabled) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
      onConfirmExit();
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [enabled, onConfirmExit]);
}
