import type { LineupSlotValue } from "../../../projectRules";

type LineupComparableValue =
  | string
  | LineupSlotValue
  | Array<string | LineupSlotValue>
  | undefined;

type LineupComparableMap = Record<string, LineupComparableValue>;

export type LineupDirtyComparisonState = {
  lineup: LineupComparableMap;
  bandLeaderId: string;
  talkbackOwnerId: string;
  leadVocalIds: string[];
  backVocalIds: string[];
  hasLeadVocalOverride?: boolean;
  hasBackVocalOverride?: boolean;
  hasTalkbackOverride?: boolean;
};

export function normalizeLineupForComparison(
  value: LineupDirtyComparisonState,
): LineupDirtyComparisonState {
  const normalizedLineup = Object.keys(value.lineup)
    .sort((a, b) => a.localeCompare(b))
    .reduce<LineupComparableMap>((acc, role) => {
      const roleValue = value.lineup[role];
      if (roleValue === undefined) return acc;
      acc[role] = roleValue;
      return acc;
    }, {});

  return {
    lineup: normalizedLineup,
    bandLeaderId: value.bandLeaderId,
    talkbackOwnerId: value.talkbackOwnerId,
    leadVocalIds: [...value.leadVocalIds],
    backVocalIds: [...value.backVocalIds],
    hasLeadVocalOverride: Boolean(value.hasLeadVocalOverride),
    hasBackVocalOverride: Boolean(value.hasBackVocalOverride),
    hasTalkbackOverride: Boolean(value.hasTalkbackOverride),
  };
}

export function createLineupDirtyBaseline(
  value: LineupDirtyComparisonState,
): LineupDirtyComparisonState {
  return normalizeLineupForComparison(value);
}

export function areLineupStatesEqual(
  left: LineupDirtyComparisonState,
  right: LineupDirtyComparisonState,
): boolean {
  return (
    JSON.stringify(normalizeLineupForComparison(left)) ===
    JSON.stringify(normalizeLineupForComparison(right))
  );
}

export function hasUnsavedLineupChanges(args: {
  baseline: LineupDirtyComparisonState;
  current: LineupDirtyComparisonState;
}): boolean {
  return !areLineupStatesEqual(args.baseline, args.current);
}

export function isLineupSetupDirty(args: {
  baselineProject: LineupDirtyComparisonState;
  currentDraftProject: LineupDirtyComparisonState;
}): boolean {
  return hasUnsavedLineupChanges({
    baseline: args.baselineProject,
    current: args.currentDraftProject,
  });
}
