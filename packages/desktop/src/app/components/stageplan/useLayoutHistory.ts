import { useCallback, useRef } from "react";
import type { StageplanLayout } from "../../../../../../src/domain/model/types";

const LIMIT = 50;

/**
 * Snapshoty místo inverzních operací: stav je šest bloků po šesti číslech, tak
 * je celý layout levnější než skládání opačných gest. Žije jen po dobu sezení.
 */
export function useLayoutHistory() {
  const pastRef = useRef<StageplanLayout[]>([]);
  const futureRef = useRef<StageplanLayout[]>([]);

  const push = useCallback((layout: StageplanLayout) => {
    pastRef.current = [...pastRef.current, layout].slice(-LIMIT);
    futureRef.current = [];
  }, []);

  const undo = useCallback((current: StageplanLayout): StageplanLayout | null => {
    // Ne `.at(-1)` — lib target balíčku ho ještě nezná.
    const previous = pastRef.current[pastRef.current.length - 1];
    if (!previous) return null;
    pastRef.current = pastRef.current.slice(0, -1);
    futureRef.current = [...futureRef.current, current].slice(-LIMIT);
    return previous;
  }, []);

  const redo = useCallback((current: StageplanLayout): StageplanLayout | null => {
    const next = futureRef.current[futureRef.current.length - 1];
    if (!next) return null;
    futureRef.current = futureRef.current.slice(0, -1);
    pastRef.current = [...pastRef.current, current].slice(-LIMIT);
    return next;
  }, []);

  /** Po načtení jiného projektu nesmí undo skočit do cizího rozmístění. */
  const reset = useCallback(() => {
    pastRef.current = [];
    futureRef.current = [];
  }, []);

  return { push, undo, redo, reset };
}
