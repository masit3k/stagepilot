import type { MemberOption } from "../../shell/types";

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
  const rows =
    members.length === 0
      ? [{ id: "__empty__", name: "Not selected" }]
      : members;

  return (
    <article className="lineup-card">
      <div className="lineup-card__header">
        <h3>LEAD VOCS</h3>
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
