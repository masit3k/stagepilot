import type { ReactNode } from "react";

export function ModalFooter({ children }: { children: ReactNode }) {
  return <div className="modal-actions">{children}</div>;
}
