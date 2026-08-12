import { useContext } from "react";
import { type ToastApi, ToastContext } from "./ToastProvider";

/**
 * Throws when used outside ToastProvider rather than silently doing nothing —
 * a notification that quietly never appears is worse than a crash in dev.
 */
export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) {
    throw new Error("useToast must be used inside a ToastProvider");
  }
  return api;
}
