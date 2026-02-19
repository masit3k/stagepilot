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
    <article className="lineup-card lineup-card--backvocs">
      <h3>BACK VOCS</h3>
      <div className="lineup-card__body section-divider lineup-card__body--split">
        <div className="lineup-list lineup-list--single lineup-list--compact">
          {members.length === 0 ? (
            <div className="lineup-list__row">
              <span className="lineup-list__name">Not selected</span>
            </div>
          ) : members.map((member) => (
            <div key={member.id} className="lineup-list__row">
              <span className="lineup-list__name">{member.name}</span>
            </div>
          ))}
        </div>
        <div className="lineup-list__actions lineup-list__actions--column">
          <button type="button" className="button-secondary" disabled={changeDisabled} onClick={onChange}>Change</button>
          <button type="button" className="button-secondary" disabled={setupDisabled} onClick={onSetup}>Setup</button>
        </div>
      </div>
    </article>
  );
}
