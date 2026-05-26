import type { ReactNode } from "react";

export function ModalHeader({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className ? `modal-header ${className}` : "modal-header"}>
      {children}
    </div>
  );
}
