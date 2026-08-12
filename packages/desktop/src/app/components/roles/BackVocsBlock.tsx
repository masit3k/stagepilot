import type { MemberOption } from "../../shell/types";
import { LineupRow } from "./LineupRow";

type BackVocsBlockProps = {
  members: MemberOption[];
  onChange: () => void;
  changeDisabled?: boolean;
};

export function BackVocsBlock({
  members,
  onChange,
  changeDisabled = false,
}: BackVocsBlockProps) {
  return (
    <LineupRow
      roleLabel="BACK VOCS"
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
