import type { MemberOption } from "../../shell/types";

type BackVocsBlockProps = {
  members: MemberOption[];
  onChange: () => void;
  onSetup: () => void;
  changeDisabled?: boolean;
  setupDisabled?: boolean;
};

export function BackVocsBlock({ members, onChange, onSetup, changeDisabled = false, setupDisabled = false }: BackVocsBlockProps) {
  return (
    <article className="lineup-card">
      <h3>BACK VOCS</h3>
      <div className="lineup-card__body section-divider">
        <div className="lineup-list lineup-list--single">
          {members.length === 0 ? (
            <div className="lineup-list__row">
              <span className="lineup-list__name">Not selected</span>
            </div>
          ) : members.map((member) => (
            <div key={member.id} className="lineup-list__row">
              <span className="lineup-list__name">{member.name}</span>
            </div>
          ))}
          <div className="lineup-list__row">
            <span className="lineup-list__name subtle" aria-hidden="true" />
            <div className="lineup-list__actions">
              <button type="button" className="button-secondary" disabled={changeDisabled} onClick={onChange}>Change</button>
              <button type="button" className="button-secondary" disabled={setupDisabled} onClick={onSetup}>Setup</button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
