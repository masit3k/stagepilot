
export function ChooseProjectTypePage({
  navigate,
}: {
  navigate: (path: string) => void;
}) {
  return (
    <section className="panel panel--choice">
      <div className="panel__header">
        <h2>New Project</h2>
        <button
          type="button"
          className="button-secondary"
          onClick={() => navigate("/")}
        >
          Back to Hub
        </button>
      </div>
      <div className="choice-grid" aria-label="Project type options">
        <button
          type="button"
          className="choice-card"
          onClick={() => navigate("/projects/new/event")}
        >
          <span className="choice-card__check" aria-hidden="true">
            ✓
          </span>
          <span className="choice-card__title">Event Project</span>
          <span className="choice-card__desc">
            For a specific show with date and venue.
          </span>
        </button>
        <button
          type="button"
          className="choice-card"
          onClick={() => navigate("/projects/new/generic")}
        >
          <span className="choice-card__check" aria-hidden="true">
            ✓
          </span>
          <span className="choice-card__title">Generic Template</span>
          <span className="choice-card__desc">
            Reusable template for a season or tour.
          </span>
        </button>
      </div>
    </section>
  );
}

