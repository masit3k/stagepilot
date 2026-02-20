import type { ReactNode } from "react";

type SetupModalShellProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  onBack: () => void;
  onSave: () => void;
  onReset: () => void;
  saveDisabled?: boolean;
  isDirty?: boolean;
  defaultAction?: {
    label: string;
    disabled?: boolean;
    onClick: () => void;
  };
  children: ReactNode;
};

export function SetupModalShell({ open, title, subtitle = "Changes here apply only to this event. Musicians defaults are not modified.", onBack, onSave, onReset, saveDisabled, isDirty = false, defaultAction, children }: SetupModalShellProps) {
  if (!open) return null;
  return (
    <>
      <div className="panel__header panel__header--stack selector-dialog__title">
        <h3>{title}</h3>
        <div className="setup-modal-subtitle-row">
          <p className="subtle">{subtitle}</p>
          {defaultAction ? (
            <button
              type="button"
              className="button-link setup-modal-default-action"
              onClick={defaultAction.onClick}
              disabled={defaultAction.disabled}
            >
              {defaultAction.label}
            </button>
          ) : null}
        </div>
      </div>
      <div className="selector-dialog__divider section-divider" />
      <div className="selector-dialog__body setup-editor-body" role="region" aria-label="Setup editor content">
        {children}
      </div>
      <div className="modal-actions modal-actions--setup setup-modal-footer">
        <button type="button" className="button-secondary" onClick={onBack}>Back</button>
        <button type="button" className="button-secondary" onClick={onReset} disabled={!isDirty}>Reset overrides</button>
        <button type="button" onClick={onSave} disabled={saveDisabled}>Save</button>
      </div>
    </>
  );
}
