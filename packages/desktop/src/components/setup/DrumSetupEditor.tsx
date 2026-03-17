import type { DrumDefinition } from "../../../../../src/domain/drums/drumDefinition";
import { DrumAdditionalEditor } from "./DrumAdditionalEditor";
import { DrumInputsEditor } from "./DrumInputsEditor";

type Props = { value: DrumDefinition; onChange: (next: DrumDefinition) => void };

export function DrumSetupEditor({ value, onChange }: Props) {
  return <div className="setup-editor-column"><DrumInputsEditor value={value} onChange={onChange} /><DrumAdditionalEditor value={value} onChange={onChange} /></div>;
}
