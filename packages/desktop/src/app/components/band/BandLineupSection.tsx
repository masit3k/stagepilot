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
import { LineupRow, type LineupRowName } from "../roles/LineupRow";
import { FieldErrors } from "./FieldErrors";

type LabelOf = (musicianId: string) => string;

/**
 * A4.2: Remove sedí u jména a má u všech stejný viditelný text, takže
 * tlačítka tvoří jeden sloupec; jméno nese `aria-label` (Ruling 4).
 */
function removableNames(
  musicianIds: readonly string[],
  labelOf: LabelOf,
  onRemove: (musicianId: string) => void,
): LineupRowName[] {
  return musicianIds.map((musicianId) => ({
    key: musicianId,
    label: labelOf(musicianId),
    action: (
      <button
        type="button"
        className="button-ghost"
        aria-label={`Remove ${labelOf(musicianId)}`}
        onClick={() => onRemove(musicianId)}
      >
        Remove
      </button>
    ),
  }));
}

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
  const byId = new Map(musicians.map((musician) => [musician.id, musician]));
  const labelOf: LabelOf = (musicianId) => {
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
            <GroupRow
              key={role}
              role={role}
              form={form}
              musicians={musicians}
              labelOf={labelOf}
              onChange={onChange}
            />
          ))}
        </div>
      )}
      <FieldErrors errors={errors} field="lineup" />
    </section>
  );
}

/** Ruling 17: každý řádek drží vlastní rozpracovaný výběr. */
function GroupRow({
  role,
  form,
  musicians,
  labelOf,
  onChange,
}: {
  role: LineupRole;
  form: BandFormState;
  musicians: readonly Musician[];
  labelOf: LabelOf;
  onChange: BandFormUpdate;
}) {
  const [pending, setPending] = useState<string[]>([]);
  const label = getRoleDisplayName(role);
  return (
    <LineupRow
      roleLabel={label}
      names={removableNames(form.lineup[role], labelOf, (musicianId) =>
        onChange((state) => removeMember(state, musicianId)),
      )}
      emptyLabel="No musicians"
      actions={
        <AddMusiciansMultiSelect
          id={`band-add-${role}`}
          options={availableMusiciansForGroup(musicians, role, form).map(
            (musician) => ({ id: musician.id, name: musicianLabel(musician) }),
          )}
          selectedIds={pending}
          placeholder={`Add ${label.toLowerCase()}`}
          onSelectionChange={setPending}
          onAddSelected={(ids) =>
            onChange((state) => addMembersToGroup(state, role, ids))
          }
        />
      }
    />
  );
}
