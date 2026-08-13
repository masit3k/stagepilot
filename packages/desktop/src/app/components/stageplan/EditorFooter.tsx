type EditorFooterProps = {
  onBack: () => void;
  onGeneratePdf: () => void;
  isSaving: boolean;
};

/**
 * Handoff tu má větu „Změny se propíší do PDF exportu". Do F5b by to byla
 * nepravda — tisk zatím rozmístění nečte.
 */
export function EditorFooter({
  onBack,
  onGeneratePdf,
  isSaving,
}: EditorFooterProps) {
  return (
    <div className="stage-footer">
      <button type="button" className="stage-footer__ghost" onClick={onBack}>
        Zpět na Lineup
      </button>
      <span className="stage-footer__note">
        ROZMÍSTĚNÍ SE ZATÍM DO PDF NEPROPISUJE
      </span>
      <button
        type="button"
        className="stage-footer__primary"
        onClick={onGeneratePdf}
        disabled={isSaving}
      >
        Generate PDF
      </button>
    </div>
  );
}
