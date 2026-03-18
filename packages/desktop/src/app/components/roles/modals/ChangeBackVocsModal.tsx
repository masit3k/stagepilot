import { useEffect, useMemo, useRef, useState } from "react";
import type { Group } from "../../../../../../../src/domain/model/groups";
import { VocalCandidateOptionRow } from "./VocalCandidateOptionRow";

export type BackVocalCandidate = {
  id: string;
  name: string;
  primaryGroup: Group;
};

type ChangeBackVocsModalProps = {
  open: boolean;
  members: BackVocalCandidate[];
  initialSelectedIds: Set<string>;
  disabledSelectedIds?: Set<string>;
  saveDisabled?: boolean;
  onCancel: () => void;
  onSave: (selectedIds: Set<string>) => void;
};

const VOCAL_EXCLUSION_NOTE =
  "A musician selected as Lead Vocs cannot be selected as Back Vocs, and vice versa.";

export function ChangeBackVocsModal({
  open,
  members,
  initialSelectedIds,
  disabledSelectedIds = new Set<string>(),
  saveDisabled = false,
  onCancel,
  onSave,
}: ChangeBackVocsModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(initialSelectedIds),
  );
  const wasOpenRef = useRef(false);
  const hasCandidates = members.length > 0;

  useEffect(() => {
    if (open && !wasOpenRef.current)
      setSelectedIds(new Set(initialSelectedIds));
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
      aria-label="Select BACK VOCS"
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
        <h3>Select BACK VOCS</h3>
      </div>
      <p className="subtle">{VOCAL_EXCLUSION_NOTE}</p>
      <div className="selector-dialog__divider section-divider" />
      <div className="selector-list">
        {!hasCandidates ? (
          <p className="subtle">No eligible vocalists available.</p>
        ) : (
          members.map((member) => (
            <VocalCandidateOptionRow
              key={member.id}
              id={member.id}
              inputIdPrefix="back-vocs"
              displayName={member.name}
              primaryGroup={member.primaryGroup}
              selected={selectedIds.has(member.id)}
              disabled={disabledSelectedIds.has(member.id)}
              onToggle={toggleSelection}
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
          disabled={saveDisabled}
          onClick={() => onSave(selectedIds)}
        >
          Save
        </button>
      </div>
    </div>
  );
}
