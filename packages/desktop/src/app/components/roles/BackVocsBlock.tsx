import type { MemberOption } from "../../shell/types";

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
  const rows =
    members.length === 0
      ? [{ id: "__empty__", name: "Not selected" }]
      : members;

  return (
    <article className="lineup-card">
      <div className="lineup-card__header">
        <h3>BACK VOCS</h3>
        <div className="lineup-card__actions">
          <button
            type="button"
            className="button-secondary"
            disabled={changeDisabled}
            onClick={onChange}
          >
            Change
          </button>
        </div>
      </div>
      <div className="lineup-card__body section-divider">
        <div className="lineup-list lineup-list--single">
          {rows.map((member, index) => (
            <span key={member.id} className="lineup-list__name">
              {members.length > 1 ? `${index + 1}. ` : ""}
              {member.name}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}
