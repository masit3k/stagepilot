import type { MemberOption } from "../../shell/types";
import { LineupRow } from "./LineupRow";

type LeadVocsBlockProps = {
  members: MemberOption[];
  onChange: () => void;
  changeDisabled?: boolean;
};

export function LeadVocsBlock({
  members,
  onChange,
  changeDisabled = false,
}: LeadVocsBlockProps) {
  return (
    <LineupRow
      roleLabel="LEAD VOCS"
      names={members.map((member) => ({
        key: member.id,
        label: member.name,
      }))}
      actions={
        <button
          type="button"
          className="button-secondary"
          disabled={changeDisabled}
          onClick={onChange}
        >
          Change
        </button>
      }
    />
  );
}
