import type { ReactNode } from "react";

export function ModalHeader({ children }: { children: ReactNode }) {
  return <div className="modal-header">{children}</div>;
}
