import type { ReactNode } from "react";

type SetupSectionProps = {
  title: string;
  description?: string;
  modified?: boolean;
  children: ReactNode;
};

export function SetupSection({ title, description, modified = false, children }: SetupSectionProps) {
  return (
    <section className="setup-section-card">
      <div className="setup-section-card__header">
        <h4>
          {title}
          {modified ? <span className="setup-section-modified" aria-label="Section modified">• Modified</span> : null}
        </h4>
        {description ? <p className="subtle">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
