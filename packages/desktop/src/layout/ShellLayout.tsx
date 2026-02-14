import type { ReactNode } from "react";

export function ShellLayout({ header, children }: { header?: ReactNode; children: ReactNode }) {
  return (
    <>
      {header}
      {children}
    </>
  );
}
