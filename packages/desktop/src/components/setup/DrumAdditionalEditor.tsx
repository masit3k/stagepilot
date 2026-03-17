import type { DrumDefinition } from "../../../../../src/domain/drums/drumDefinition";

type Props = { value: DrumDefinition; onChange: (next: DrumDefinition) => void };

export function DrumAdditionalEditor({ value, onChange }: Props) {
  return <section><h4>Additional</h4><label className="setup-editor-list__row"><span>Tracks</span><input type="checkbox" checked={value.tracks.enabled} onChange={(e)=>onChange({ ...value, tracks: { enabled: e.target.checked } })} /></label></section>;
}
