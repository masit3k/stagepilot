import { SetupModalShell } from "../../setup/SetupModalShell";
import { SetupSection } from "../../setup/SetupSection";

export type BackVocsSetupItem = {
  musicianId: string;
  name: string;
  value: string;
  isModified: boolean;
};

type BackVocsSetupModalProps = {
  open: boolean;
  items: BackVocsSetupItem[];
  onBack: () => void;
  onReset: () => void;
  onSave: () => void;
  onChange: (musicianId: string, presetId: string) => void;
};

const OPTIONS = [
  { value: "vocal_back_no_mic", label: "No own mic" },
  { value: "vocal_back_wired", label: "Own wired mic" },
  { value: "vocal_back_wireless", label: "Own wireless mic" },
];

export function BackVocsSetupModal({ open, items, onBack, onReset, onSave, onChange }: BackVocsSetupModalProps) {
  if (!open) return null;

  return (
    <SetupModalShell
      open={open}
      title="Setup for this event – back vocalists"
      subtitle="Changes here apply only to this event. Musicians defaults are not modified."
      onBack={onBack}
      onReset={onReset}
      onSave={onSave}
      isDirty={items.some((item) => item.isModified)}
    >
      <SetupSection title="Microphones" modified={items.some((item) => item.isModified)}>
        <div className="setup-editor-stack">
          {items.map((item) => (
            <div key={item.musicianId} className={`setup-field-block ${item.isModified ? "setup-field-block--modified" : ""}`}>
              <label className="setup-field-block__label" htmlFor={`back-voc-${item.musicianId}`}>{item.name}</label>
              <div className="setup-field-row">
                <select
                  id={`back-voc-${item.musicianId}`}
                  className="setup-field-control"
                  value={item.value}
                  onChange={(event) => onChange(item.musicianId, event.target.value)}
                >
                  {OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      </SetupSection>
    </SetupModalShell>
  );
}
