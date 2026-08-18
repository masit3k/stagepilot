type EditorFooterProps = {
  isSaving: boolean;
  isDirty: boolean;
  onBack: () => void;
  onBackToHub: () => void;
  onContinue: () => void;
};

/**
 * Stejná semantika jako lišty setupu a preview: vlevo návraty, vpravo
 * dirty-aware primary. `Generate PDF` odsud zmizelo, protože žádné PDF
 * negenerovalo — uložilo layout a přešlo na Preview (R1).
 */
export function EditorFooter({
  isSaving,
  isDirty,
  onBack,
  onBackToHub,
  onContinue,
}: EditorFooterProps) {
  return (
    <div className="stage-footer">
      <button type="button" className="stage-footer__ghost" onClick={onBack}>
        Back to Inputs
      </button>
      <button
        type="button"
        className="stage-footer__ghost"
        onClick={onBackToHub}
      >
        Back to Hub
      </button>
      <span className="stage-footer__note">
        Changes are written to the PDF export
      </span>
      <button
        type="button"
        className="stage-footer__primary"
        onClick={onContinue}
        disabled={isSaving}
      >
        {isDirty ? "Save & Continue" : "Continue"}
      </button>
    </div>
  );
}
