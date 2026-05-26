import { useEffect, useMemo, useRef, useState } from "react";
import type { LeadVocalCandidate } from "../../../domain/roles/resolveLeadVocalCandidates";
import { VocalCandidateOptionRow } from "./VocalCandidateOptionRow";

type ChangeLeadVocsModalProps = {
  open: boolean;
  suggestedCandidates: LeadVocalCandidate[];
  otherCandidates: LeadVocalCandidate[];
  initialSelectedIds: string[];
  disabledSelectedIds?: string[];
  onCancel: () => void;
  onSave: (selectedIds: string[]) => void;
};

const VOCAL_EXCLUSION_NOTE =
  "A musician selected as Lead Vocal cannot be selected as Back Vocal, and vice versa.";

export function ChangeLeadVocsModal({
  open,
  suggestedCandidates,
  otherCandidates,
  initialSelectedIds,
  disabledSelectedIds = [],
  onCancel,
  onSave,
}: ChangeLeadVocsModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);
  const wasOpenRef = useRef(false);
  const disabledIdSet = useMemo(() => new Set(disabledSelectedIds), [disabledSelectedIds]);
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setSelectedIds([...initialSelectedIds]);
    }
    wasOpenRef.current = open;
  }, [open, initialSelectedIds]);

  const toggleSelection = useMemo(
    () => (candidateId: string) => {
      if (disabledIdSet.has(candidateId)) return;
      const next = selectedIds.includes(candidateId)
        ? selectedIds.filter((id) => id !== candidateId)
        : [...selectedIds, candidateId];
      setSelectedIds(next);
    },
    [disabledIdSet, selectedIds],
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
              selected={selectedIdSet.has(candidate.musicianId)}
              disabled={disabledIdSet.has(candidate.musicianId)}
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
              selected={selectedIdSet.has(candidate.musicianId)}
              disabled={disabledIdSet.has(candidate.musicianId)}
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
        <button
          type="button"
          className="button-primary"
          onClick={() => onSave(selectedIds)}
        >
          Save
        </button>
      </div>
    </div>
  );
}
