import type { ReactNode } from "react";

export function ModalFooter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className ? `modal-actions ${className}` : "modal-actions"}>
      {children}
    </div>
  );
}
