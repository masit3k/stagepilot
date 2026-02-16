import { useEffect, useState } from "react";
import type { MemberOption } from "../../../shell/types";

type ChangeBackVocsModalProps = {
  open: boolean;
  members: MemberOption[];
  initialSelectedIds: Set<string>;
  saveDisabled?: boolean;
  saveError?: string;
  onCancel: () => void;
  onSave: (selectedIds: Set<string>) => void;
};

export function ChangeBackVocsModal({
  open,
  members,
  initialSelectedIds,
  saveDisabled = false,
  saveError,
  onCancel,
  onSave,
}: ChangeBackVocsModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(initialSelectedIds));

  useEffect(() => {
    if (!open) return;
    setSelectedIds(new Set(initialSelectedIds));
  }, [open, initialSelectedIds]);

  if (!open) return null;

  return (
    <div className="selector-dialog selector-dialog--musician-select" role="dialog" aria-modal="true" aria-label="Change back vocs">
      <button type="button" className="modal-close" onClick={onCancel} aria-label="Close">×</button>
      <div className="panel__header panel__header--stack selector-dialog__title">
        <h3>Change Back vocs</h3>
      </div>
      <div className="selector-dialog__divider section-divider" />
      <div className="selector-list">
        {members.map((member) => {
          const checked = selectedIds.has(member.id);
          const id = `back-vocs-${member.id}`;
          return (
            <label key={member.id} className="selector-option selector-option--check" htmlFor={id} tabIndex={0}>
              <input
                id={id}
                className="setup-checkbox"
                type="checkbox"
                checked={checked}
                onChange={() => {
                  const next = new Set(selectedIds);
                  if (next.has(member.id)) next.delete(member.id);
                  else next.add(member.id);
                  setSelectedIds(next);
                }}
              />
              <span>{member.name}</span>
            </label>
          );
        })}
      </div>
      {saveError ? <p className="status status--error">{saveError}</p> : null}
      <div className="modal-actions">
        <button type="button" className="button-secondary" onClick={onCancel}>Cancel</button>
        <button type="button" disabled={saveDisabled} onClick={() => onSave(selectedIds)}>Save</button>
      </div>
    </div>
  );
}
