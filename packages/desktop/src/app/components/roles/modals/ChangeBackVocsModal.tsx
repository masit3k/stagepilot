import { useEffect, useMemo, useRef, useState } from "react";
import type { Group } from "../../../../../../../src/domain/model/groups";
import { VocalCandidateOptionRow } from "./VocalCandidateOptionRow";

export type BackVocalCandidate = {
  id: string;
  name: string;
  primaryGroup: Group;
  isDisabled: boolean;
  disabledReason?: string;
};

type ChangeBackVocsModalProps = {
  open: boolean;
  members: BackVocalCandidate[];
  initialSelectedIds: string[];
  saveDisabled?: boolean;
  onCancel: () => void;
  onSave: (selectedIds: string[]) => void;
};

const VOCAL_EXCLUSION_NOTE =
  "A musician selected as Lead Vocs cannot be selected as Back Vocs, and vice versa.";

export function ChangeBackVocsModal({
  open,
  members,
  initialSelectedIds,
  saveDisabled = false,
  onCancel,
  onSave,
}: ChangeBackVocsModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);
  const wasOpenRef = useRef(false);
  const hasCandidates = members.length > 0;
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  useEffect(() => {
    if (open && !wasOpenRef.current)
      setSelectedIds([...initialSelectedIds]);
    wasOpenRef.current = open;
  }, [open, initialSelectedIds]);

  const toggleSelection = useMemo(
    () => (candidateId: string) => {
      const candidate = members.find((item) => item.id === candidateId);
      if (candidate?.isDisabled) return;
      const next = selectedIds.includes(candidateId)
        ? selectedIds.filter((id) => id !== candidateId)
        : [...selectedIds, candidateId];
      setSelectedIds(next);
    },
    [members, selectedIds],
  );

  if (!open) return null;

  return (
    <div
      className="selector-dialog selector-dialog--musician-select"
      role="dialog"
      aria-modal="true"
      aria-labelledby="back-vocs-dialog-title"
      aria-describedby="back-vocs-dialog-note"
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
        <h3 id="back-vocs-dialog-title">Select BACK VOCS</h3>
      </div>
      <p id="back-vocs-dialog-note" className="subtle">
        {VOCAL_EXCLUSION_NOTE}
      </p>
      <div className="selector-dialog__divider section-divider" />
      <div className="selector-dialog__body selector-list">
        {!hasCandidates ? (
          <p className="status status--empty">
            No eligible vocalists available.
          </p>
        ) : (
          members.map((member) => (
            <VocalCandidateOptionRow
              key={member.id}
              id={member.id}
              inputIdPrefix="back-vocs"
              displayName={member.name}
              primaryGroup={member.primaryGroup}
              selected={selectedIdSet.has(member.id)}
              disabled={member.isDisabled}
              onToggle={toggleSelection}
              trailingNote={member.isDisabled ? member.disabledReason : undefined}
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
          disabled={saveDisabled}
          onClick={() => onSave(selectedIds)}
        >
          Save
        </button>
      </div>
    </div>
  );
}
