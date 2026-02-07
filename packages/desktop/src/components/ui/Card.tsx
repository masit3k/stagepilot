import type { PropsWithChildren } from "react";
import { clsx } from "clsx";

export function Card({ children, className }: PropsWithChildren<{ className?: string }>) {
  return (
    <div className={clsx("rounded-lg border border-slate-800 bg-slate-900", className)}>
      {children}
    </div>
  );
}

export function CardHeader({ children }: PropsWithChildren) {
  return <div className="border-b border-slate-800 px-4 py-3 text-sm">{children}</div>;
}

export function CardBody({ children }: PropsWithChildren) {
  return <div className="px-4 py-4">{children}</div>;
}
