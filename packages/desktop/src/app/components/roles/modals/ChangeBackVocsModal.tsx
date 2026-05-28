import { useEffect, useMemo, useRef, useState } from "react";
import type { Group } from "../../../../../../../src/domain/model/groups";
import { VocalCandidateOptionRow } from "./VocalCandidateOptionRow";

export type BackVocalCandidate = {
  id: string;
  name: string;
  primaryGroup: Group;
  hasVocalCapability: boolean;
  isInProjectLineup: boolean;
  reason?: string;
  isDisabled: boolean;
  disabledReason?: string;
};

type ChangeBackVocsModalProps = {
  open: boolean;
  suggestedCandidates: BackVocalCandidate[];
  additionalCandidates: BackVocalCandidate[];
  initialSelectedIds: string[];
  defaultSelectedIds: string[];
  saveDisabled?: boolean;
  onCancel: () => void;
  onSave: (selectedIds: string[]) => void;
};

const VOCAL_EXCLUSION_NOTE =
  "A musician selected as Lead Vocs cannot be selected as Back Vocs, and vice versa.";

function toUniqueIds(ids: readonly string[]): string[] {
  return Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
}

export function ChangeBackVocsModal({
  open,
  suggestedCandidates,
  additionalCandidates,
  initialSelectedIds,
  defaultSelectedIds,
  saveDisabled = false,
  onCancel,
  onSave,
}: ChangeBackVocsModalProps) {
  const [assignedIds, setAssignedIds] = useState<string[]>(initialSelectedIds);
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const wasOpenRef = useRef(false);
  const members = useMemo(
    () => [...suggestedCandidates, ...additionalCandidates],
    [additionalCandidates, suggestedCandidates],
  );
  const memberById = useMemo(
    () => new Map(members.map((member) => [member.id, member])),
    [members],
  );
  const assignedIdSet = useMemo(() => new Set(assignedIds), [assignedIds]);
  const pendingIdSet = useMemo(() => new Set(pendingIds), [pendingIds]);
  const availableSuggestedCandidates = suggestedCandidates.filter(
    (candidate) => !assignedIdSet.has(candidate.id),
  );
  const availableAdditionalCandidates = additionalCandidates.filter(
    (candidate) => !assignedIdSet.has(candidate.id),
  );
  const orderedPendingIds = members
    .filter((candidate) => pendingIdSet.has(candidate.id))
    .map((candidate) => candidate.id);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setAssignedIds(toUniqueIds(initialSelectedIds));
      setPendingIds([]);
      setIsAddOpen(false);
    }
    wasOpenRef.current = open;
  }, [open, initialSelectedIds]);

  const togglePendingSelection = (candidateId: string) => {
    const candidate = memberById.get(candidateId);
    if (candidate?.isDisabled) return;
    setPendingIds((current) =>
      current.includes(candidateId)
        ? current.filter((id) => id !== candidateId)
        : [...current, candidateId],
    );
  };

  const addPending = () => {
    if (orderedPendingIds.length === 0) return;
    setAssignedIds((current) =>
      toUniqueIds([...current, ...orderedPendingIds]),
    );
    setPendingIds([]);
    setIsAddOpen(false);
  };

  if (!open) return null;

  return (
    <dialog
      open
      className="selector-dialog selector-dialog--musician-select"
      aria-labelledby="back-vocs-dialog-title"
      aria-describedby="back-vocs-dialog-note"
    >
      <button
        type="button"
        className="modal-close"
        onClick={onCancel}
        aria-label="Close"
      >
        x
      </button>
      <div className="panel__header panel__header--stack selector-dialog__title">
        <h3 id="back-vocs-dialog-title">Edit backing vocal assignments</h3>
      </div>
      <p id="back-vocs-dialog-note" className="subtle">
        {VOCAL_EXCLUSION_NOTE}
      </p>
      <div className="selector-dialog__divider section-divider" />
      <div className="selector-dialog__body lineup-assignment-editor">
        <section className="lineup-assignment-editor__section">
          <h4>Assigned backing vocalists</h4>
          <div className="lineup-list lineup-list--compact">
            {assignedIds.length === 0 ? (
              <p className="status status--empty">
                No backing vocalist assigned
              </p>
            ) : (
              assignedIds.map((musicianId, index) => {
                const member = memberById.get(musicianId);
                return (
                  <div
                    key={`back-vocs-assignment-${musicianId}`}
                    className="lineup-list__row"
                  >
                    <span className="lineup-list__name">
                      {index + 1}. {member?.name ?? musicianId}
                    </span>
                    <div className="lineup-list__actions">
                      <button
                        type="button"
                        className="button-ghost"
                        disabled={index === 0}
                        onClick={() =>
                          setAssignedIds((current) => {
                            const next = [...current];
                            [next[index - 1], next[index]] = [
                              next[index],
                              next[index - 1],
                            ];
                            return next;
                          })
                        }
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        className="button-ghost"
                        disabled={index === assignedIds.length - 1}
                        onClick={() =>
                          setAssignedIds((current) => {
                            const next = [...current];
                            [next[index], next[index + 1]] = [
                              next[index + 1],
                              next[index],
                            ];
                            return next;
                          })
                        }
                      >
                        Down
                      </button>
                      <button
                        type="button"
                        className="button-ghost"
                        onClick={() =>
                          setAssignedIds((current) =>
                            current.filter((id) => id !== musicianId),
                          )
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
        <section className="lineup-assignment-editor__section">
          <h4>Add backing vocalists</h4>
          <div className="lineup-multiselect">
            <button
              type="button"
              className="lineup-multiselect__trigger"
              aria-haspopup="true"
              aria-expanded={isAddOpen}
              onClick={() => setIsAddOpen((current) => !current)}
            >
              <span>Add another backing vocalist</span>
              <span aria-hidden="true" className="lineup-multiselect__chevron">
                v
              </span>
            </button>
            {isAddOpen ? (
              <div className="lineup-multiselect__popover lineup-multiselect__popover--inline">
                <div className="lineup-multiselect__options">
                  <h4 className="subtle">Suggested backing vocalists</h4>
                  {availableSuggestedCandidates.length === 0 ? (
                    <p className="lineup-multiselect__empty">
                      No suggested backing vocalists.
                    </p>
                  ) : (
                    availableSuggestedCandidates.map((member) => (
                      <VocalCandidateOptionRow
                        key={member.id}
                        id={member.id}
                        inputIdPrefix="back-vocs"
                        displayName={member.name}
                        primaryGroup={member.primaryGroup}
                        selected={pendingIdSet.has(member.id)}
                        disabled={member.isDisabled}
                        onToggle={togglePendingSelection}
                        trailingNote={
                          member.isDisabled
                            ? member.disabledReason
                            : "Vocal capability"
                        }
                      />
                    ))
                  )}
                  <div className="selector-dialog__divider section-divider" />
                  <h4 className="subtle">Other lineup members</h4>
                  {availableAdditionalCandidates.length === 0 ? (
                    <p className="lineup-multiselect__empty">
                      No other lineup members.
                    </p>
                  ) : (
                    availableAdditionalCandidates.map((member) => (
                      <VocalCandidateOptionRow
                        key={member.id}
                        id={member.id}
                        inputIdPrefix="back-vocs"
                        displayName={member.name}
                        primaryGroup={member.primaryGroup}
                        selected={pendingIdSet.has(member.id)}
                        disabled={member.isDisabled}
                        onToggle={togglePendingSelection}
                        trailingNote={
                          member.isDisabled ? member.disabledReason : undefined
                        }
                      />
                    ))
                  )}
                </div>
                <div className="lineup-multiselect__footer">
                  <span>
                    {orderedPendingIds.length === 1
                      ? "1 selected"
                      : `${orderedPendingIds.length} selected`}
                  </span>
                  <button
                    type="button"
                    className="button-secondary"
                    disabled={orderedPendingIds.length === 0}
                    onClick={addPending}
                  >
                    Add selected
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>
      <div className="modal-actions modal-actions--split">
        <button
          type="button"
          className="button-secondary"
          onClick={() => {
            setAssignedIds(toUniqueIds(defaultSelectedIds));
            setPendingIds([]);
            setIsAddOpen(false);
          }}
        >
          Reset to defaults
        </button>
        <div className="modal-actions__group">
          <button type="button" className="button-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="button-primary"
            disabled={saveDisabled}
            onClick={() => onSave(toUniqueIds(assignedIds))}
          >
            Save
          </button>
        </div>
      </div>
    </dialog>
  );
}
