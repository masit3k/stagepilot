import { useEffect, useRef } from "react";

const STEP_M = 0.1;
const BIG_STEP_M = 1;

/** Nesmí střílet, když uživatel píše do pole — proto kontrola cíle eventu. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
}

type EditorKeyboardArgs = {
  enabled: boolean;
  onNudge: (delta: { xM: number; yM: number }) => void;
  onRotateBy: (deltaDeg: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClearSelection: () => void;
};

export function useEditorKeyboard(args: EditorKeyboardArgs): void {
  /**
   * Callbacky se mění každým renderem, ale listener má být jeden. Ref je drží
   * aktuální, takže se posluchač nepřipojuje a neodpojuje po každém stisku.
   */
  const argsRef = useRef(args);
  argsRef.current = args;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) return;
      const current = argsRef.current;

      const ctrl = event.ctrlKey || event.metaKey;
      if (ctrl && event.key.toLowerCase() === "z") {
        event.preventDefault();
        current.onUndo();
        return;
      }
      if (ctrl && event.key.toLowerCase() === "y") {
        event.preventDefault();
        current.onRedo();
        return;
      }
      if (event.key === "Escape") {
        current.onClearSelection();
        return;
      }
      if (!current.enabled) return;

      const step = event.shiftKey ? BIG_STEP_M : STEP_M;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        current.onNudge({ xM: -step, yM: 0 });
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        current.onNudge({ xM: step, yM: 0 });
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        current.onNudge({ xM: 0, yM: -step });
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        current.onNudge({ xM: 0, yM: step });
        return;
      }
      if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        current.onRotateBy(event.shiftKey ? -15 : 15);
      }
      // Delete je vědomě prázdný: bloky vznikají z lineupu, mazat je nelze.
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
