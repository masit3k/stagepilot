import type { ReactNode } from "react";

/**
 * An empty list is not the same thing as a broken one. Before this, "no
 * projects" was a single sentence in a grey box, which is what a failed load
 * looks like too — and it was the first screen after install.
 *
 * The caller keeps the aria-live region, so screen readers still hear the
 * change when a list empties out.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon" aria-hidden="true">
        {icon}
      </span>
      <p className="empty-state__title">{title}</p>
      {description ? (
        <p className="empty-state__description">{description}</p>
      ) : null}
      {action ? <div className="empty-state__action">{action}</div> : null}
    </div>
  );
}
