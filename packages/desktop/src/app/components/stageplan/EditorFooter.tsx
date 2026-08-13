type EditorFooterProps = {
  onBack: () => void;
  onGeneratePdf: () => void;
  isSaving: boolean;
};

/**
 * Tisk rozmístění čte od F5b, takže věta z handoffu je pravdivá — obrys tiskové
 * stopy v canvasu ukazuje, kolik místa blok na papíře zabere.
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
        Změny se propíší do PDF exportu
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
