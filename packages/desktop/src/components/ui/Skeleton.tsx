/**
 * Placeholder blocks for work that is under way.
 *
 * The pulse is a plain CSS animation, so the global prefers-reduced-motion rule
 * in base.css switches it off without this component knowing.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={className ? `skeleton ${className}` : "skeleton"}
      aria-hidden="true"
    />
  );
}

/**
 * Placeholder rows have no identity of their own, so their position is the key.
 * The uneven widths that make them read as table content rather than a loading
 * bar live in CSS as :nth-child rules — that keeps every class name greppable
 * instead of composed in a template literal.
 */
const TABLE_ROWS = ["r1", "r2", "r3", "r4", "r5", "r6", "r7", "r8", "r9"];

/**
 * Stands in for the PDF while Puppeteer renders it. Shows an A4 outline in the
 * right proportion so it is clear what is coming, rather than the bare sentence
 * "Generating preview…" that used to be the only feedback for an operation
 * measured in seconds.
 */
export function PdfPageSkeleton() {
  return (
    <div className="pdf-skeleton" aria-hidden="true">
      <div className="pdf-skeleton__page">
        <Skeleton className="pdf-skeleton__title" />
        <Skeleton className="pdf-skeleton__meta" />
        <div className="pdf-skeleton__table">
          {TABLE_ROWS.map((row) => (
            <Skeleton key={row} className="pdf-skeleton__row" />
          ))}
        </div>
        <Skeleton className="pdf-skeleton__stage" />
      </div>
    </div>
  );
}
