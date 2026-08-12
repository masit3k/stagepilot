/**
 * Pure queue behaviour for the toast stack, kept apart from React state and
 * timers so it can be tested in the node environment the project uses.
 */

export type ToastKind = "success" | "error" | "info";

export type Toast = {
  readonly id: number;
  readonly kind: ToastKind;
  readonly message: string;
};

/** Beyond this the stack stops being readable. */
export const MAX_VISIBLE = 3;

/** Errors linger — they carry something the user may need to act on. */
export const DISMISS_AFTER_MS: Record<ToastKind, number> = {
  success: 5000,
  info: 5000,
  error: 8000,
};

export type AppendResult = {
  /** The new queue, capped at MAX_VISIBLE. */
  readonly toasts: readonly Toast[];
  /** Ids pushed out by the cap, so their timers can be cleared. */
  readonly evicted: readonly number[];
};

export function appendToast(
  toasts: readonly Toast[],
  toast: Toast,
  max = MAX_VISIBLE,
): AppendResult {
  const next = [...toasts, toast];
  const overflow = Math.max(0, next.length - max);
  return {
    toasts: next.slice(overflow),
    evicted: next.slice(0, overflow).map((dropped) => dropped.id),
  };
}

export function removeToast(
  toasts: readonly Toast[],
  id: number,
): readonly Toast[] {
  return toasts.filter((toast) => toast.id !== id);
}
