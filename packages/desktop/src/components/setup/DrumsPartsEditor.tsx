import type { DrumSetup } from "../../../../../src/domain/drums/drumSetup";

type DrumsPartsEditorProps = {
  setup: DrumSetup;
  onChange: (next: DrumSetup) => void;
};

export function DrumsPartsEditor({ setup, onChange }: DrumsPartsEditorProps) {
  const activePad = setup.pad.enabled ? setup.pad : { enabled: true as const, mode: "sfx" as const, channels: "mono" as const };
  const setCount = (field: "tomCount" | "floorTomCount" | "extraSnareCount", delta: number, max: number) => {
    const next = Math.max(0, Math.min(max, setup[field] + delta));
    onChange({ ...setup, [field]: next });
  };

  return (
    <section>
      <h4>Drum parts</h4>
      <div className="setup-editor-list">
        <div className="setup-editor-list__row"><span>Toms</span><div><button type="button" className="button-secondary" onClick={() => setCount("tomCount", -1, 4)}>-</button><span> {setup.tomCount} </span><button type="button" className="button-secondary" onClick={() => setCount("tomCount", 1, 4)}>+</button></div></div>
        <div className="setup-editor-list__row"><span>Floor toms</span><div><button type="button" className="button-secondary" onClick={() => setCount("floorTomCount", -1, 4)}>-</button><span> {setup.floorTomCount} </span><button type="button" className="button-secondary" onClick={() => setCount("floorTomCount", 1, 4)}>+</button></div></div>
        <div className="setup-editor-list__row"><span>Additional snares</span><div><button type="button" className="button-secondary" onClick={() => setCount("extraSnareCount", -1, 2)}>-</button><span> {setup.extraSnareCount} </span><button type="button" className="button-secondary" onClick={() => setCount("extraSnareCount", 1, 2)}>+</button></div></div>
        <label className="setup-editor-list__row"><span>Hi-hat</span><input type="checkbox" checked={setup.hasHiHat} onChange={(e) => onChange({ ...setup, hasHiHat: e.target.checked })} /></label>
        <label className="setup-editor-list__row"><span>OH pair</span><input type="checkbox" checked={setup.hasOverheads} onChange={(e) => onChange({ ...setup, hasOverheads: e.target.checked })} /></label>
        <label className="setup-editor-list__row"><span>PAD</span><input type="checkbox" checked={setup.pad.enabled} onChange={(e) => onChange({ ...setup, pad: e.target.checked ? { enabled: true, mode: "sfx", channels: "mono" } : { enabled: false } })} /></label>
      </div>
      {setup.pad.enabled ? (
        <div className="setup-field-row">
          <label>
            Mode
            <select value={activePad.mode} onChange={(e) => onChange({ ...setup, pad: { enabled: true, mode: e.target.value as "sfx" | "backing", channels: activePad.channels } })}>
              <option value="sfx">SFX</option>
              <option value="backing">BACKING</option>
            </select>
          </label>
          <label>
            Channels
            <select value={activePad.channels} onChange={(e) => onChange({ ...setup, pad: { enabled: true, mode: activePad.mode, channels: e.target.value as "mono" | "stereo" } })}>
              <option value="mono">Mono</option>
              <option value="stereo">Stereo</option>
            </select>
          </label>
        </div>
      ) : null}
    </section>
  );
}
