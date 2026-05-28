import { useEffect, useMemo, useRef, useState } from "react";
import type { LeadVocalCandidate } from "../../../domain/roles/resolveLeadVocalCandidates";
import { VocalCandidateOptionRow } from "./VocalCandidateOptionRow";

type ChangeLeadVocsModalProps = {
  open: boolean;
  suggestedCandidates: LeadVocalCandidate[];
  otherCandidates: LeadVocalCandidate[];
  initialSelectedIds: string[];
  defaultSelectedIds: string[];
  disabledSelectedIds?: string[];
  onCancel: () => void;
  onSave: (selectedIds: string[]) => void;
};

const VOCAL_EXCLUSION_NOTE =
  "A musician selected as Lead Vocal cannot be selected as Back Vocal, and vice versa.";

function toUniqueIds(ids: readonly string[]): string[] {
  return Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
}

export function ChangeLeadVocsModal({
  open,
  suggestedCandidates,
  otherCandidates,
  initialSelectedIds,
  defaultSelectedIds,
  disabledSelectedIds = [],
  onCancel,
  onSave,
}: ChangeLeadVocsModalProps) {
  const [assignedIds, setAssignedIds] = useState<string[]>(initialSelectedIds);
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const wasOpenRef = useRef(false);
  const disabledIdSet = useMemo(
    () => new Set(disabledSelectedIds),
    [disabledSelectedIds],
  );
  const assignedIdSet = useMemo(() => new Set(assignedIds), [assignedIds]);
  const pendingIdSet = useMemo(() => new Set(pendingIds), [pendingIds]);
  const allCandidates = useMemo(
    () => [...suggestedCandidates, ...otherCandidates],
    [otherCandidates, suggestedCandidates],
  );
  const candidateById = useMemo(
    () =>
      new Map(
        allCandidates.map((candidate) => [candidate.musicianId, candidate]),
      ),
    [allCandidates],
  );
  const availableSuggestedCandidates = suggestedCandidates.filter(
    (candidate) => !assignedIdSet.has(candidate.musicianId),
  );
  const availableOtherCandidates = otherCandidates.filter(
    (candidate) => !assignedIdSet.has(candidate.musicianId),
  );
  const orderedPendingIds = allCandidates
    .filter((candidate) => pendingIdSet.has(candidate.musicianId))
    .map((candidate) => candidate.musicianId);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setAssignedIds(toUniqueIds(initialSelectedIds));
      setPendingIds([]);
      setIsAddOpen(false);
    }
    wasOpenRef.current = open;
  }, [open, initialSelectedIds]);

  const togglePendingSelection = (candidateId: string) => {
    if (disabledIdSet.has(candidateId)) return;
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
      aria-labelledby="lead-vocs-dialog-title"
      aria-describedby="lead-vocs-dialog-note"
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
        <h3 id="lead-vocs-dialog-title">Edit lead vocal assignments</h3>
      </div>
      <p id="lead-vocs-dialog-note" className="subtle">
        {VOCAL_EXCLUSION_NOTE}
      </p>
      <div className="selector-dialog__divider section-divider" />
      <div className="selector-dialog__body lineup-assignment-editor">
        <section className="lineup-assignment-editor__section">
          <h4>Assigned lead vocalists</h4>
          <div className="lineup-list lineup-list--compact">
            {assignedIds.length === 0 ? (
              <p className="status status--empty">No lead vocalist assigned</p>
            ) : (
              assignedIds.map((musicianId, index) => {
                const candidate = candidateById.get(musicianId);
                return (
                  <div
                    key={`lead-vocs-assignment-${musicianId}`}
                    className="lineup-list__row"
                  >
                    <span className="lineup-list__name">
                      {index + 1}. {candidate?.displayName ?? musicianId}
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
          <h4>Add lead vocalists</h4>
          <div className="lineup-multiselect">
            <button
              type="button"
              className="lineup-multiselect__trigger"
              aria-haspopup="true"
              aria-expanded={isAddOpen}
              onClick={() => setIsAddOpen((current) => !current)}
            >
              <span>Add another lead vocalist</span>
              <span aria-hidden="true" className="lineup-multiselect__chevron">
                v
              </span>
            </button>
            {isAddOpen ? (
              <div className="lineup-multiselect__popover lineup-multiselect__popover--inline">
                <div className="lineup-multiselect__options">
                  <h4 className="subtle">Suggested lead vocalists</h4>
                  {availableSuggestedCandidates.length === 0 ? (
                    <p className="lineup-multiselect__empty">
                      No suggested lead vocalists.
                    </p>
                  ) : (
                    availableSuggestedCandidates.map((candidate) => (
                      <VocalCandidateOptionRow
                        key={candidate.musicianId}
                        id={candidate.musicianId}
                        inputIdPrefix="lead-vocs"
                        displayName={candidate.displayName}
                        primaryGroup={candidate.primaryGroup}
                        selected={pendingIdSet.has(candidate.musicianId)}
                        disabled={disabledIdSet.has(candidate.musicianId)}
                        onToggle={togglePendingSelection}
                        trailingNote={
                          candidate.hasVocalCapability
                            ? "Vocal capability"
                            : undefined
                        }
                      />
                    ))
                  )}
                  <div className="selector-dialog__divider section-divider" />
                  <h4 className="subtle">Other lineup members</h4>
                  {availableOtherCandidates.length === 0 ? (
                    <p className="lineup-multiselect__empty">
                      No other lineup members.
                    </p>
                  ) : (
                    availableOtherCandidates.map((candidate) => (
                      <VocalCandidateOptionRow
                        key={candidate.musicianId}
                        id={candidate.musicianId}
                        inputIdPrefix="lead-vocs"
                        displayName={candidate.displayName}
                        primaryGroup={candidate.primaryGroup}
                        selected={pendingIdSet.has(candidate.musicianId)}
                        disabled={disabledIdSet.has(candidate.musicianId)}
                        onToggle={togglePendingSelection}
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
            onClick={() => onSave(toUniqueIds(assignedIds))}
          >
            Save
          </button>
        </div>
      </div>
    </dialog>
  );
}
