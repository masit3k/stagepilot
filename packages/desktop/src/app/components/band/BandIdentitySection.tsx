import type { BandDraftError } from "../../../../../../src/domain/band/buildBandFromDraft";
import {
  type BandFormState,
  type BandFormUpdate,
  setBandCode,
  setBandName,
} from "../../domain/band/bandFormModel";
import { FieldErrors, hasFieldError } from "./FieldErrors";

export function BandIdentitySection({
  form,
  bandId,
  errors,
  onChange,
}: {
  form: BandFormState;
  bandId: string | null;
  errors: readonly BandDraftError[];
  onChange: BandFormUpdate;
}) {
  return (
    <section className="lineup-card" aria-labelledby="band-identity-heading">
      <h3 id="band-identity-heading">Identity</h3>
      <div className="form-grid">
        <label>
          Name *
          <input
            type="text"
            value={form.name}
            aria-invalid={hasFieldError(errors, "name")}
            onChange={(event) => {
              const value = event.target.value;
              onChange((state) => setBandName(state, value));
            }}
          />
          <FieldErrors errors={errors} field="name" />
        </label>
        <label>
          Code *
          <input
            type="text"
            value={form.code}
            aria-invalid={hasFieldError(errors, "code")}
            onChange={(event) => {
              const value = event.target.value;
              onChange((state) => setBandCode(state, value));
            }}
          />
          {form.codeTouched ? null : (
            <span className="subtle">Derived from name</span>
          )}
          <FieldErrors errors={errors} field="code" />
        </label>
        {bandId ? <p className="subtle">ID: {bandId}</p> : null}
      </div>
    </section>
  );
}
