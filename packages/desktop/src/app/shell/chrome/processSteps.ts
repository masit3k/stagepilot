/**
 * The step model behind the process trail.
 *
 * All four steps now have screens. `StepState.unavailable` remains in the model
 * for future process extensions; a step becomes unavailable when its screen is
 * not yet implemented. Modelling the state per step rather than branching
 * inside the component means that a phase transition flips one `segment` from null to a
 * route, and nothing else moves; that is exactly how the stage plan landed.
 *
 * Pure on purpose: the project's tests run in the node environment, so the
 * routing logic has to be testable without React.
 */

import {
  matchProjectInputsPath,
  matchProjectPreviewPath,
  matchProjectSetupPath,
  matchProjectStageplanPath,
} from "../routes";

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
  { id: "inputs", label: "INPUTS", segment: "inputs" },
  { id: "stageplan", label: "STAGE PLAN", segment: "stageplan" },
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
  const inputsProjectId = matchProjectInputsPath(pathname);
  const stageplanProjectId = matchProjectStageplanPath(pathname);
  const projectId =
    setupProjectId ??
    inputsProjectId ??
    stageplanProjectId ??
    matchProjectPreviewPath(pathname);
  if (projectId === null) return null;

  const currentId: StepId =
    setupProjectId !== null
      ? "lineup"
      : inputsProjectId !== null
        ? "inputs"
        : stageplanProjectId !== null
          ? "stageplan"
          : "export";

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

/**
 * The step next to `from` in direction `offset`; null at either end of the
 * process, or when that neighbour has no screen yet.
 */
function neighbourStepPath(
  from: StepId,
  projectId: string,
  offset: 1 | -1,
): string | null {
  const index = STEPS.findIndex((step) => step.id === from);
  if (index < 0) return null;

  const target = index + offset;
  if (target < 0 || target >= STEPS.length) return null;

  const neighbour = STEPS[target];
  if (neighbour.segment === null) return null;

  return `/projects/${encodeURIComponent(projectId)}/${neighbour.segment}`;
}

/**
 * Where `Continue` leads from a step; null on the last one.
 *
 * Screens do not decide their own `Continue`/`Back` targets — they read them
 * here, so the flow `01 → 02 → 03 → 04` and the process trail are both derived
 * from the same `STEPS` array and cannot drift apart. Inserting a step moves
 * the two together.
 */
export function nextStepPath(from: StepId, projectId: string): string | null {
  return neighbourStepPath(from, projectId, 1);
}

/** Mirror of `nextStepPath` for the way back; null on the first step. */
export function previousStepPath(
  from: StepId,
  projectId: string,
): string | null {
  return neighbourStepPath(from, projectId, -1);
}
