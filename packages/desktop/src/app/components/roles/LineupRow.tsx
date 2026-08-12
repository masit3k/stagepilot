import type { ReactNode } from "react";

/** A name with a caller-supplied stable key, so the row never keys on an index. */
export type LineupRowName = {
  readonly key: string;
  readonly label: string;
};

/**
 * One lineup position as a full-width row: role, name(s), markers, actions.
 *
 * Replaces the per-position card. Eight positions in eight cards produced eight
 * nested frames; as rows the role, the name and the actions line up into columns
 * that can be read down the screen.
 *
 * Shared by every position, including LEAD VOCS and BACK VOCS, which used to be
 * two byte-identical components apart from their label.
 *
 * The label prop is `roleLabel`, not `role` — a JSX attribute called `role` reads
 * as the ARIA attribute to both tooling and people.
 */
export function LineupRow({
  roleLabel,
  names,
  emptyLabel = "Not selected",
  hint,
  meta,
  actions,
}: {
  /** Position label, rendered as an uppercase mono column. */
  roleLabel: string;
  /** Resolved names. Numbered automatically when there is more than one. */
  names: readonly LineupRowName[];
  /** Shown in place of a name when the position is unassigned. */
  emptyLabel?: string;
  /** Explains what the position is for; sits under the name. */
  hint?: string;
  /** Markers such as the overridden-setup badge. */
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  const isStacked = names.length > 1;
  const isEmpty = names.length === 0;
  const shown: readonly LineupRowName[] = isEmpty
    ? [{ key: "__empty__", label: emptyLabel }]
    : names;

  return (
    <div
      className={isStacked ? "lineup-row lineup-row--stacked" : "lineup-row"}
    >
      <span className="lineup-row__role">{roleLabel}</span>
      <div className="lineup-row__name">
        {shown.map((name, index) => (
          <span
            key={name.key}
            // Muted, so an unassigned position does not read like a real name.
            className={
              isEmpty ? "lineup-list__name is-placeholder" : "lineup-list__name"
            }
          >
            {isStacked ? `${index + 1}. ` : ""}
            {name.label}
          </span>
        ))}
      </div>
      {/* The hint shares the flexible middle column with the badges: the name
          column is too narrow for a sentence and would wrap it every time. */}
      {meta || hint ? (
        <div className="lineup-row__meta">
          {meta}
          {hint ? <span className="lineup-row__hint">{hint}</span> : null}
        </div>
      ) : null}
      {actions ? <div className="lineup-row__actions">{actions}</div> : null}
    </div>
  );
}
