import type { LineupMap } from "../../../projectRules";

type Snapshot = {
  lineup: LineupMap;
  bandLeaderId: string;
  talkbackOwnerId: string;
  backVocalIds: string[];
};

function stableStringify(value: Snapshot): string {
  return JSON.stringify({
    lineup: value.lineup,
    bandLeaderId: value.bandLeaderId,
    talkbackOwnerId: value.talkbackOwnerId,
    backVocalIds: [...value.backVocalIds].sort((a, b) => a.localeCompare(b)),
  });
}

export function isLineupSetupDirty(args: {
  baselineProject: Snapshot;
  currentDraftProject: Snapshot;
}): boolean {
  return (
    stableStringify(args.baselineProject) !==
    stableStringify(args.currentDraftProject)
  );
}

