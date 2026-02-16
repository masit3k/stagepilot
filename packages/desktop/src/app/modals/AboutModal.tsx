import desktopPackage from "../../../package.json";
import { ModalOverlay, useModalBehavior } from "../../components/ui/Modal";

export function AboutModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const dialogRef = useModalBehavior(open, onClose);
  return (
    <ModalOverlay open={open} onClose={onClose}>
      <div
        className="selector-dialog about-dialog"
        role="dialog"
        aria-modal="true"
        ref={dialogRef}
      >
        <button
          type="button"
          className="modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        <h3>About StagePilot</h3>
        <div className="about-grid">
          <p className="about-item">
            <span>StagePilot</span>
            <strong>Desktop</strong>
          </p>
          <p className="about-item">
            <span>Author</span>
            <strong>Matěj Krečmer</strong>
          </p>
          <p className="about-item">
            <span>Version</span>
            <strong>{desktopPackage.version}</strong>
          </p>
          <p className="about-item">
            <span>Copyright</span>
            <strong>© 2026 StagePilot</strong>
          </p>
          <p className="about-item">
            <span>Channel</span>
            <strong>Preview</strong>
          </p>
          <p className="about-item">
            <span>Build Date</span>
            <strong>{new Date().toLocaleDateString()}</strong>
          </p>
        </div>
      </div>
    </ModalOverlay>
  );
}
