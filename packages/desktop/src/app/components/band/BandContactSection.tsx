import type { BandDraftError } from "../../../../../../src/domain/band/buildBandFromDraft";
import type { Musician } from "../../../../../../src/domain/model/types";
import {
  type BandFormState,
  type BandFormUpdate,
  defaultContactMemberId,
  disableContact,
  lineupMemberIds,
  musicianLabel,
  setContactField,
} from "../../domain/band/bandFormModel";
import { FieldErrors, hasFieldError } from "./FieldErrors";

/**
 * R2 + R12 blok 4: kontakt je člen sestavy plus telefon a e-mail. Výběr
 * člena jde přes `onSelectMember`, protože stránka musí načíst existující
 * `contacts/<id>.json` a předvyplnit z něj pole.
 */
export function BandContactSection({
  form,
  musicians,
  errors,
  onChange,
  onSelectMember,
}: {
  form: BandFormState;
  musicians: readonly Musician[];
  errors: readonly BandDraftError[];
  onChange: BandFormUpdate;
  onSelectMember: (musicianId: string) => void;
}) {
  const members = lineupMemberIds(form);
  const byId = new Map(musicians.map((musician) => [musician.id, musician]));
  const labelOf = (musicianId: string) => {
    const musician = byId.get(musicianId);
    return musician ? musicianLabel(musician) : musicianId;
  };
  const contact = form.contact;

  return (
    <section className="lineup-card" aria-labelledby="band-contact-heading">
      <h3 id="band-contact-heading">Contact</h3>
      <fieldset className="band-form__checks">
        <legend>Contact person</legend>
        <label>
          <input
            type="radio"
            name="band-contact-mode"
            checked={contact.mode === "none"}
            onChange={() => onChange(disableContact)}
          />
          No contact
        </label>
        <label>
          <input
            type="radio"
            name="band-contact-mode"
            checked={contact.mode === "member"}
            disabled={members.length === 0}
            onChange={() => onSelectMember(defaultContactMemberId(form))}
          />
          Band member
        </label>
      </fieldset>
      {contact.mode === "member" ? (
        <div className="form-grid">
          <label>
            Member *
            <select
              value={contact.musicianId}
              aria-invalid={hasFieldError(errors, "contact")}
              onChange={(event) => onSelectMember(event.target.value)}
            >
              <option value="">Select member</option>
              {members.map((musicianId) => (
                <option key={musicianId} value={musicianId}>
                  {labelOf(musicianId)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Phone
            <input
              type="tel"
              value={contact.phone}
              onChange={(event) => {
                const value = event.target.value;
                onChange((state) => setContactField(state, "phone", value));
              }}
            />
          </label>
          <label>
            E-mail
            <input
              type="email"
              value={contact.email}
              onChange={(event) => {
                const value = event.target.value;
                onChange((state) => setContactField(state, "email", value));
              }}
            />
          </label>
        </div>
      ) : null}
      <FieldErrors errors={errors} field="contact" />
    </section>
  );
}
