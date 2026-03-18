import { useEffect, useRef, useState } from "react";
import { getRoleDisplayName } from "../../../../projectRules";
import type { LeadVocalCandidate } from "../../../domain/roles/resolveLeadVocalCandidates";

type ChangeLeadVocsModalProps = {
  open: boolean;
  suggestedCandidates: LeadVocalCandidate[];
  otherCandidates: LeadVocalCandidate[];
  initialSelectedIds: Set<string>;
  onCancel: () => void;
  onSave: (selectedIds: Set<string>) => void;
};

function renderCandidateRow(
  candidate: LeadVocalCandidate,
  selectedIds: Set<string>,
  setSelectedIds: (value: Set<string>) => void,
) {
  const checked = selectedIds.has(candidate.musicianId);
  const id = `lead-vocs-${candidate.musicianId}`;

  return (
    <label
      key={candidate.musicianId}
      className="selector-option selector-option--check"
      htmlFor={id}
      tabIndex={0}
    >
      <input
        id={id}
        className="setup-checkbox"
        type="checkbox"
        checked={checked}
        onChange={() => {
          const next = new Set(selectedIds);
          if (next.has(candidate.musicianId)) next.delete(candidate.musicianId);
          else next.add(candidate.musicianId);
          setSelectedIds(next);
        }}
      />
      <span>
        {candidate.displayName}
        {" "}
        <small className="subtle">({getRoleDisplayName(candidate.primaryGroup)})</small>
        {candidate.hasLeadPreset ? (
          <small className="subtle"> • Lead vocal preset</small>
        ) : null}
      </span>
    </label>
  );
}

export function ChangeLeadVocsModal({
  open,
  suggestedCandidates,
  otherCandidates,
  initialSelectedIds,
  onCancel,
  onSave,
}: ChangeLeadVocsModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(initialSelectedIds),
  );
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setSelectedIds(new Set(initialSelectedIds));
    }
    wasOpenRef.current = open;
  }, [open, initialSelectedIds]);

  if (!open) return null;

  return (
    <div
      className="selector-dialog selector-dialog--musician-select"
      role="dialog"
      aria-modal="true"
      aria-label="Select LEAD VOCS"
    >
      <button
        type="button"
        className="modal-close"
        onClick={onCancel}
        aria-label="Close"
      >
        ×
      </button>
      <div className="panel__header panel__header--stack selector-dialog__title">
        <h3>Select LEAD VOCS</h3>
      </div>
      <div className="selector-dialog__divider section-divider" />
      <div className="selector-list">
        <h4 className="subtle">Suggested lead vocalists</h4>
        {suggestedCandidates.length === 0 ? (
          <p className="subtle">No suggested lead vocalists.</p>
        ) : (
          suggestedCandidates.map((candidate) =>
            renderCandidateRow(candidate, selectedIds, setSelectedIds),
          )
        )}
        <div className="selector-dialog__divider section-divider" />
        <h4 className="subtle">Other lineup members</h4>
        {otherCandidates.length === 0 ? (
          <p className="subtle">No other lineup members.</p>
        ) : (
          otherCandidates.map((candidate) =>
            renderCandidateRow(candidate, selectedIds, setSelectedIds),
          )
        )}
      </div>
      <div className="modal-actions">
        <button type="button" className="button-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" onClick={() => onSave(selectedIds)}>
          Save
        </button>
      </div>
    </div>
  );
}
