import type { DrumDefinition } from "../../../../../src/domain/drums/drumDefinition";
import { SetupSection } from "../../app/components/setup/SetupSection";
import { SetupCounterControl } from "../../app/components/setup/fields/SetupCounterControl";

type DrumsPartsEditorProps = {
  setup: DrumDefinition;
  onChange: (next: DrumDefinition) => void;
};

export function DrumsPartsEditor({ setup, onChange }: DrumsPartsEditorProps) {
  const activePad = setup.pad.enabled
    ? setup.pad
    : {
        enabled: true as const,
        mode: "sfx" as const,
        channels: "mono" as const,
      };

  return (
    <>
      <SetupSection title="Input">
        <div className="setup-toggle-grid">
          <div className="setup-field-block">
            <div
              className="setup-field-row setup-toggle-row setup-toggle-row--checked"
              role="group"
            >
              <span className="setup-toggle-row__text">Kicks</span>
              <span className="setup-toggle-row__trailing">
                <SetupCounterControl
                  label="Kicks"
                  value={setup.kickCount}
                  min={1}
                  max={2}
                  onChange={(count) => onChange({ ...setup, kickCount: count })}
                />
              </span>
            </div>
          </div>
          <div className="setup-field-block">
            <div
              className="setup-field-row setup-toggle-row setup-toggle-row--checked"
              role="group"
            >
              <span className="setup-toggle-row__text">Snares</span>
              <span className="setup-toggle-row__trailing">
                <SetupCounterControl
                  label="Snares"
                  value={setup.snareCount}
                  min={1}
                  max={3}
                  onChange={(count) =>
                    onChange({ ...setup, snareCount: count })
                  }
                />
              </span>
            </div>
          </div>
          <label
            className={`setup-field-row setup-toggle-row ${setup.hasHiHat ? "setup-toggle-row--checked" : ""}`}
          >
            <input
              type="checkbox"
              className="setup-checkbox"
              checked={setup.hasHiHat}
              onChange={(e) =>
                onChange({ ...setup, hasHiHat: e.target.checked })
              }
            />
            <span className="setup-toggle-row__text">Hi-hat</span>
          </label>
          <div className="setup-field-block">
            <div
              className="setup-field-row setup-toggle-row setup-toggle-row--checked"
              role="group"
            >
              <span className="setup-toggle-row__text">Toms</span>
              <span className="setup-toggle-row__trailing">
                <SetupCounterControl
                  label="Toms"
                  value={setup.tomCount}
                  min={0}
                  max={4}
                  onChange={(count) => onChange({ ...setup, tomCount: count })}
                />
              </span>
            </div>
          </div>
          <div className="setup-field-block">
            <div
              className="setup-field-row setup-toggle-row setup-toggle-row--checked"
              role="group"
            >
              <span className="setup-toggle-row__text">Floors</span>
              <span className="setup-toggle-row__trailing">
                <SetupCounterControl
                  label="Floors"
                  value={setup.floorCount}
                  min={0}
                  max={3}
                  onChange={(count) =>
                    onChange({ ...setup, floorCount: count })
                  }
                />
              </span>
            </div>
          </div>
          <label
            className={`setup-field-row setup-toggle-row ${setup.hasOverheads ? "setup-toggle-row--checked" : ""}`}
          >
            <input
              type="checkbox"
              className="setup-checkbox"
              checked={setup.hasOverheads}
              onChange={(e) =>
                onChange({ ...setup, hasOverheads: e.target.checked })
              }
            />
            <span className="setup-toggle-row__text">Overhead</span>
          </label>
        </div>
      </SetupSection>
      <SetupSection title="Additional inputs">
        <div className="setup-toggle-grid">
          <label
            className={`setup-field-row setup-toggle-row ${setup.pad.enabled ? "setup-toggle-row--checked" : ""}`}
          >
            <input
              type="checkbox"
              className="setup-checkbox"
              checked={setup.pad.enabled}
              onChange={(e) =>
                onChange({
                  ...setup,
                  pad: e.target.checked
                    ? { enabled: true, mode: "sfx", channels: "mono" }
                    : { enabled: false },
                })
              }
            />
            <span className="setup-toggle-row__text">PAD</span>
          </label>
          <label
            className={`setup-field-row setup-toggle-row ${setup.tracks.enabled ? "setup-toggle-row--checked" : ""}`}
          >
            <input
              type="checkbox"
              className="setup-checkbox"
              checked={setup.tracks.enabled}
              onChange={(e) =>
                onChange({ ...setup, tracks: { enabled: e.target.checked } })
              }
            />
            <span className="setup-toggle-row__text">Tracks</span>
          </label>
          {setup.pad.enabled ? (
            <div className="setup-field-row">
              <label>
                Mode
                <select
                  className="setup-field-control"
                  value={activePad.mode}
                  onChange={(e) =>
                    onChange({
                      ...setup,
                      pad: {
                        enabled: true,
                        mode: e.target.value as "sfx" | "backing",
                        channels: activePad.channels,
                      },
                    })
                  }
                >
                  <option value="sfx">SFX</option>
                  <option value="backing">BACKING</option>
                </select>
              </label>
              <label>
                Channels
                <select
                  className="setup-field-control"
                  value={activePad.channels}
                  onChange={(e) =>
                    onChange({
                      ...setup,
                      pad: {
                        enabled: true,
                        mode: activePad.mode,
                        channels: e.target.value as "mono" | "stereo",
                      },
                    })
                  }
                >
                  <option value="mono">Mono</option>
                  <option value="stereo">Stereo</option>
                </select>
              </label>
            </div>
          ) : null}
        </div>
      </SetupSection>
    </>
  );
}
