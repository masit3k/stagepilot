import type { ProcessStep } from "./processSteps";

function StepText({ step }: { step: ProcessStep }) {
  return (
    <>
      <span className="process-trail__number">{step.number}</span>
      <span className="process-trail__label">{step.label}</span>
    </>
  );
}

/**
 * Where the user is in the document flow.
 *
 * A step without a screen is plain text, not a disabled button: a control that
 * cannot be pressed is worse than no control. Steps the user can reach are
 * buttons, the current one is marked with `aria-current`.
 */
export function ProcessTrail({
  steps,
  navigate,
}: {
  steps: readonly ProcessStep[];
  navigate: (path: string) => void;
}) {
  return (
    <nav className="process-trail" aria-label="Project steps">
      <ol className="process-trail__list">
        {steps.map((step) => {
          const path = step.path;
          return (
            <li
              key={step.id}
              className={`process-trail__step process-trail__step--${step.state}`}
            >
              {path === null ? (
                <span
                  className="process-trail__step-body"
                  aria-current={step.state === "current" ? "step" : undefined}
                >
                  <StepText step={step} />
                </span>
              ) : (
                <button
                  type="button"
                  className="process-trail__step-body process-trail__link"
                  onClick={() => navigate(path)}
                >
                  <StepText step={step} />
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
