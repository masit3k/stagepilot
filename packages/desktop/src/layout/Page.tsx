import type { ReactNode } from "react";

export function Page({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return (
    <section className="panel">
      <div className="panel__header panel__header--stack">
        <h2>{title}</h2>
        {description ? <p className="subtle">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
