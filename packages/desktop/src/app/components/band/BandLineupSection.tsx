import { useState } from "react";
import type { BandDraftError } from "../../../../../../src/domain/band/buildBandFromDraft";
import {
  LINEUP_ASSIGNMENT_ROLES,
  type LineupRole,
} from "../../../../../../src/domain/lineup/lineupAssignments";
import type { Musician } from "../../../../../../src/domain/model/types";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Info } from "../../../components/ui/icons";
import { getRoleDisplayName } from "../../../projectRules";
import {
  type BandFormState,
  type BandFormUpdate,
  addMembersToGroup,
  availableMusiciansForGroup,
  musicianLabel,
  removeMember,
} from "../../domain/band/bandFormModel";
import { AddMusiciansMultiSelect } from "../roles/AddMusiciansMultiSelect";
import { LineupRow } from "../roles/LineupRow";
import { FieldErrors } from "./FieldErrors";

const NO_PENDING: Record<LineupRole, string[]> = {
  drums: [],
  bass: [],
  guitar: [],
  keys: [],
  vocs: [],
};

/** R6 + R12 blok 2: pět skupin bez talkbacku, výběr jen z muzikantů dané skupiny. */
export function BandLineupSection({
  form,
  musicians,
  errors,
  onChange,
}: {
  form: BandFormState;
  musicians: readonly Musician[];
  errors: readonly BandDraftError[];
  onChange: BandFormUpdate;
}) {
  const [pending, setPending] =
    useState<Record<LineupRole, string[]>>(NO_PENDING);
  const byId = new Map(musicians.map((musician) => [musician.id, musician]));
  const labelOf = (musicianId: string) => {
    const musician = byId.get(musicianId);
    return musician ? musicianLabel(musician) : musicianId;
  };

  return (
    <section className="lineup-card" aria-labelledby="band-lineup-heading">
      <h3 id="band-lineup-heading">Lineup</h3>
      {musicians.length === 0 ? (
        <EmptyState
          icon={<Info size={22} />}
          title="No musicians in your library yet"
          description="A band can be saved with just its name and code. The lineup is filled in once the library has musicians."
        />
      ) : (
        <div className="lineup-rows">
          {LINEUP_ASSIGNMENT_ROLES.map((role) => (
            <LineupRow
              key={role}
              roleLabel={getRoleDisplayName(role)}
              names={form.lineup[role].map((musicianId) => ({
                key: musicianId,
                label: labelOf(musicianId),
              }))}
              emptyLabel="No musicians"
              actions={
                <>
                  {form.lineup[role].map((musicianId) => (
                    <button
                      key={musicianId}
                      type="button"
                      className="button-ghost"
                      onClick={() =>
                        onChange((state) => removeMember(state, musicianId))
                      }
                    >
                      Remove {labelOf(musicianId)}
                    </button>
                  ))}
                  <AddMusiciansMultiSelect
                    id={`band-add-${role}`}
                    options={availableMusiciansForGroup(
                      musicians,
                      role,
                      form,
                    ).map((musician) => ({
                      id: musician.id,
                      name: musicianLabel(musician),
                    }))}
                    selectedIds={pending[role]}
                    placeholder={`Add ${getRoleDisplayName(role).toLowerCase()}`}
                    onSelectionChange={(ids) =>
                      setPending((current) => ({ ...current, [role]: ids }))
                    }
                    onAddSelected={(ids) =>
                      onChange((state) => addMembersToGroup(state, role, ids))
                    }
                  />
                </>
              }
            />
          ))}
        </div>
      )}
      <FieldErrors errors={errors} field="lineup" />
    </section>
  );
}
