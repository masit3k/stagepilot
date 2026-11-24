import type { BandDraftError } from "../../../../../../src/domain/band/buildBandFromDraft";
import type { Musician } from "../../../../../../src/domain/model/types";
import {
  type BandFormState,
  type BandFormUpdate,
  lineupMemberIds,
  musicianLabel,
  setBandLeader,
} from "../../domain/band/bandFormModel";
import { FieldErrors, hasFieldError } from "./FieldErrors";

/**
 * R7: kapelník jen ze sestavy. Vokály tu nejsou — LEAD VOCS a BACK VOCS jsou
 * řádky sestavy (dodatek A1, A2).
 */
export function BandRolesSection({
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
  const members = lineupMemberIds(form);
  const byId = new Map(musicians.map((musician) => [musician.id, musician]));
  const labelOf = (musicianId: string) => {
    const musician = byId.get(musicianId);
    return musician ? musicianLabel(musician) : musicianId;
  };

  return (
    <section className="lineup-card" aria-labelledby="band-roles-heading">
      <h3 id="band-roles-heading">Roles</h3>
      {members.length === 0 ? (
        <p className="subtle">
          Add musicians to the lineup to choose the band leader.
        </p>
      ) : (
        <div className="form-grid">
          <label>
            Band leader *
            <select
              value={form.bandLeaderId}
              aria-invalid={hasFieldError(errors, "bandLeader")}
              onChange={(event) => {
                const value = event.target.value;
                onChange((state) => setBandLeader(state, value));
              }}
            >
              <option value="">Select band leader</option>
              {members.map((musicianId) => (
                <option key={musicianId} value={musicianId}>
                  {labelOf(musicianId)}
                </option>
              ))}
            </select>
            <FieldErrors errors={errors} field="bandLeader" />
          </label>
        </div>
      )}
    </section>
  );
}
