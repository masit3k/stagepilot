import type { DrumDefinition } from "../../../../../src/domain/drums/drumDefinition";

type Props = { value: DrumDefinition; onChange: (next: DrumDefinition) => void };

export function DrumInputsEditor({ value, onChange }: Props) {
  return <section><h4>Inputs</h4><p className="subtle">Kick: {value.kickCount}, Snare: {value.snareCount}, Toms: {value.tomCount}, Floors: {value.floorCount}</p><label className="setup-editor-list__row"><span>Hi-Hat</span><input type="checkbox" checked={value.hasHiHat} onChange={(e)=>onChange({ ...value, hasHiHat: e.target.checked })} /></label></section>;
}
