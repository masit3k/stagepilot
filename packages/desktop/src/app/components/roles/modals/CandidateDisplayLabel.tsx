import { getRoleDisplayName } from "../../../../projectRules";
import type { Group } from "../../../../../../../src/domain/model/groups";

type CandidateDisplayLabelProps = {
  displayName: string;
  primaryGroup: Group;
};

export function CandidateDisplayLabel({
  displayName,
  primaryGroup,
}: CandidateDisplayLabelProps) {
  return (
    <>
      {displayName}{" "}
      <small className="subtle">({getRoleDisplayName(primaryGroup)})</small>
    </>
  );
}
