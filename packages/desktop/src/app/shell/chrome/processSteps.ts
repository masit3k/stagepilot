/**
 * The step model behind the process trail.
 *
 * Two of the four steps have no screen yet — inputs are edited in a modal inside
 * the setup page and the stage plan editor is a later phase. Modelling the state
 * per step rather than branching inside the component means that phase flips one
 * `segment` from null to a route, and nothing else moves.
 *
 * Pure on purpose: the project's tests run in the node environment, so the
 * routing logic has to be testable without React.
 */

import { matchProjectPreviewPath, matchProjectSetupPath } from "../routes";

export type StepId = "lineup" | "inputs" | "stageplan" | "export";

/** `unavailable` means the screen does not exist yet, not that it is disabled. */
export type StepState = "current" | "available" | "unavailable";

export type ProcessStep = {
  readonly id: StepId;
  /** Two digits, as the design prints them: `01` … `04`. */
  readonly number: string;
  readonly label: string;
  readonly state: StepState;
  /** Where the step leads; null when it is current or has no screen. */
  readonly path: string | null;
};

const STEPS: readonly {
  readonly id: StepId;
  readonly label: string;
  /** Route segment under `/projects/:id/`, or null while the screen is missing. */
  readonly segment: string | null;
}[] = [
  { id: "lineup", label: "LINEUP", segment: "setup" },
  { id: "inputs", label: "INPUTS", segment: null },
  { id: "stageplan", label: "STAGE PLAN", segment: null },
  { id: "export", label: "EXPORT", segment: "preview" },
];

/**
 * Returns the trail for a project route, or null everywhere else — outside a
 * project the trail has nothing to point at.
 */
export function buildProcessSteps(
  pathname: string,
): readonly ProcessStep[] | null {
  const setupProjectId = matchProjectSetupPath(pathname);
  const projectId = setupProjectId ?? matchProjectPreviewPath(pathname);
  if (projectId === null) return null;

  const currentId: StepId = setupProjectId === null ? "export" : "lineup";

  return STEPS.map((step, index) => {
    const state: StepState =
      step.id === currentId
        ? "current"
        : step.segment === null
          ? "unavailable"
          : "available";

    return {
      id: step.id,
      number: String(index + 1).padStart(2, "0"),
      label: step.label,
      state,
      path:
        state === "available" ? `/projects/${projectId}/${step.segment}` : null,
    };
  });
}
