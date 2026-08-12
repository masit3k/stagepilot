import {
  type ReactNode,
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ToastViewport } from "./ToastViewport";
import {
  DISMISS_AFTER_MS,
  type Toast,
  type ToastKind,
  appendToast,
  removeToast,
} from "./toastQueue";

export type { Toast, ToastKind } from "./toastQueue";

export type ToastApi = {
  notify: (kind: ToastKind, message: string) => void;
  dismiss: (id: number) => void;
};

export const ToastContext = createContext<ToastApi | null>(null);

/**
 * Announcements that do not need an answer.
 *
 * The dividing line against modals: a modal is for a decision, a toast is for
 * news. "Saved" used to cost a modal and a click.
 *
 * Context rather than prop drilling — the alternative is threading a callback
 * through seven levels of props. This is React's own mechanism, not a state
 * management library, so it stays inside the project's constraints.
 *
 * Queue behaviour lives in toastQueue.ts as pure functions; this component owns
 * only React state and the timers.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<readonly Toast[]>([]);
  const nextIdRef = useRef(1);
  const timersRef = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const clearTimer = useCallback((id: number) => {
    const timer = timersRef.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const dismiss = useCallback(
    (id: number) => {
      clearTimer(id);
      setToasts((current) => removeToast(current, id));
    },
    [clearTimer],
  );

  const scheduleDismiss = useCallback(
    (id: number, kind: ToastKind) => {
      clearTimer(id);
      timersRef.current.set(
        id,
        setTimeout(() => dismiss(id), DISMISS_AFTER_MS[kind]),
      );
    },
    [clearTimer, dismiss],
  );

  const notify = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextIdRef.current++;
      setToasts((current) => {
        const { toasts: next, evicted } = appendToast(current, {
          id,
          kind,
          message,
        });
        // Stop timers for toasts the cap pushed out, so they cannot fire
        // against an id that is no longer on screen.
        for (const evictedId of evicted) clearTimer(evictedId);
        return next;
      });
      scheduleDismiss(id, kind);
    },
    [clearTimer, scheduleDismiss],
  );

  // Hovering pauses the countdown, so a toast cannot vanish while being read.
  const pause = useCallback((id: number) => clearTimer(id), [clearTimer]);
  const resume = useCallback(
    (id: number, kind: ToastKind) => scheduleDismiss(id, kind),
    [scheduleDismiss],
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    };
  }, []);

  const api = useMemo<ToastApi>(() => ({ notify, dismiss }), [notify, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport
        toasts={toasts}
        onDismiss={dismiss}
        onPause={pause}
        onResume={resume}
      />
    </ToastContext.Provider>
  );
}
