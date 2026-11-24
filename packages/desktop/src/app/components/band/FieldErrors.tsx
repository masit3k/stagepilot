import type {
  BandDraftError,
  BandDraftField,
} from "../../../../../../src/domain/band/buildBandFromDraft";

export function hasFieldError(
  errors: readonly BandDraftError[],
  field: BandDraftField,
): boolean {
  return errors.some((error) => error.field === field);
}

/** R9: chyby domény se ukazují u pole, ke kterému patří. */
export function FieldErrors({
  errors,
  field,
}: {
  errors: readonly BandDraftError[];
  field: BandDraftField;
}) {
  const messages = [
    ...new Set(
      errors
        .filter((error) => error.field === field)
        .map((error) => error.message),
    ),
  ];
  if (messages.length === 0) return null;
  return (
    <span className="band-form__errors">
      {messages.map((message) => (
        <span key={message} className="field-error" role="alert">
          {message}
        </span>
      ))}
    </span>
  );
}
