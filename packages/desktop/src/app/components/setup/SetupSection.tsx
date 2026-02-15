import type { ReactNode } from "react";

type SetupSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

export function SetupSection({ title, description, children }: SetupSectionProps) {
  return (
    <section className="setup-section-card">
      <div className="setup-section-card__header">
        <h4>{title}</h4>
        {description ? <p className="subtle">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
