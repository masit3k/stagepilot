import { useEffect, useMemo, useRef, useState } from "react";
import type { LeadVocalCandidate } from "../../../domain/roles/resolveLeadVocalCandidates";
import { VocalCandidateOptionRow } from "./VocalCandidateOptionRow";

type ChangeLeadVocsModalProps = {
  open: boolean;
  suggestedCandidates: LeadVocalCandidate[];
  otherCandidates: LeadVocalCandidate[];
  initialSelectedIds: Set<string>;
  disabledSelectedIds?: Set<string>;
  onCancel: () => void;
  onSave: (selectedIds: Set<string>) => void;
};

const VOCAL_EXCLUSION_NOTE =
  "A musician selected as Lead Vocs cannot be selected as Back Vocs, and vice versa.";

export function ChangeLeadVocsModal({
  open,
  suggestedCandidates,
  otherCandidates,
  initialSelectedIds,
  disabledSelectedIds = new Set<string>(),
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

  const toggleSelection = useMemo(
    () => (candidateId: string) => {
      if (disabledSelectedIds.has(candidateId)) return;
      const next = new Set(selectedIds);
      if (next.has(candidateId)) next.delete(candidateId);
      else next.add(candidateId);
      setSelectedIds(next);
    },
    [disabledSelectedIds, selectedIds],
  );

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
      <p className="subtle">{VOCAL_EXCLUSION_NOTE}</p>
      <div className="selector-dialog__divider section-divider" />
      <div className="selector-list">
        <h4 className="subtle">Suggested lead vocalists</h4>
        {suggestedCandidates.length === 0 ? (
          <p className="subtle">No suggested lead vocalists.</p>
        ) : (
          suggestedCandidates.map((candidate) => (
            <VocalCandidateOptionRow
              key={candidate.musicianId}
              id={candidate.musicianId}
              inputIdPrefix="lead-vocs"
              displayName={candidate.displayName}
              primaryGroup={candidate.primaryGroup}
              selected={selectedIds.has(candidate.musicianId)}
              disabled={disabledSelectedIds.has(candidate.musicianId)}
              onToggle={toggleSelection}
              trailingNote={candidate.hasLeadPreset ? "Lead vocal preset" : undefined}
            />
          ))
        )}
        <div className="selector-dialog__divider section-divider" />
        <h4 className="subtle">Other lineup members</h4>
        {otherCandidates.length === 0 ? (
          <p className="subtle">No other lineup members.</p>
        ) : (
          otherCandidates.map((candidate) => (
            <VocalCandidateOptionRow
              key={candidate.musicianId}
              id={candidate.musicianId}
              inputIdPrefix="lead-vocs"
              displayName={candidate.displayName}
              primaryGroup={candidate.primaryGroup}
              selected={selectedIds.has(candidate.musicianId)}
              disabled={disabledSelectedIds.has(candidate.musicianId)}
              onToggle={toggleSelection}
              trailingNote={candidate.hasLeadPreset ? "Lead vocal preset" : undefined}
            />
          ))
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
