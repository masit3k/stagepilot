import type { MemberOption } from "../../shell/types";

type LeadVocsBlockProps = {
  members: MemberOption[];
  onChange: () => void;
  onSetup: () => void;
  changeDisabled?: boolean;
  setupDisabled?: boolean;
};

export function LeadVocsBlock({
  members,
  onChange,
  onSetup,
  changeDisabled = false,
  setupDisabled = false,
}: LeadVocsBlockProps) {
  const rows =
    members.length === 0 ? [{ id: "__empty__", name: "Not selected" }] : members;

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
          <button
            type="button"
            className="button-secondary"
            disabled={setupDisabled}
            onClick={onSetup}
          >
            Setup
          </button>
        </div>
      </div>
      <div className="lineup-card__body section-divider">
        <div className="lineup-list lineup-list--single">
          {rows.map((member) => (
            <span key={member.id} className="lineup-list__name">
              {member.name}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}
