import {
  toFloorCount,
  toKickCount,
  toSnareCount,
  toTomCount,
  type DrumDefinition,
} from "../../../../../src/domain/drums/drumDefinition";
import drumSetupBlueprintAsset from "../../../../../data/assets/setup-blueprints/drums.json";
import { SetupSection } from "../../app/components/setup/SetupSection";
import { SetupCounterRow } from "../../app/components/setup/fields/SetupCounterRow";
import { SetupSelectRow } from "../../app/components/setup/fields/SetupSelectRow";
import { SetupToggleRow } from "../../app/components/setup/fields/SetupToggleRow";

type DrumsPartsEditorProps = {
  setup: DrumDefinition;
  onChange: (next: DrumDefinition) => void;
};

type CountField = "kickCount" | "snareCount" | "tomCount" | "floorCount";
type BooleanField = "hasHiHat" | "hasOverheads" | "tracks.enabled";

type DrumSetupBlueprint = {
  type: "setup_blueprint";
  id: "drum-setup-blueprint";
  group: "drums";
  sections: Array<{
    id: string;
    label: string;
    items: Array<
      | { id: string; label: string; control: "count"; field: CountField; allowed: number[] }
      | { id: string; label: string; control: "boolean"; field: BooleanField }
      | {
          id: string;
          label: string;
          control: "compound";
          field: "pad";
          options?: { mode?: Array<"sfx" | "backing">; channels?: Array<"mono" | "stereo"> };
        }
    >;
  }>;
};

const drumSetupBlueprint = drumSetupBlueprintAsset as DrumSetupBlueprint;

export function updateCountField(setup: DrumDefinition, field: CountField, value: number): DrumDefinition {
  switch (field) {
    case "kickCount":
      return { ...setup, kickCount: toKickCount(value) };
    case "snareCount":
      return { ...setup, snareCount: toSnareCount(value) };
    case "tomCount":
      return { ...setup, tomCount: toTomCount(value) };
    case "floorCount":
      return { ...setup, floorCount: toFloorCount(value) };
  }
}

function countFieldValue(setup: DrumDefinition, field: CountField): number {
  switch (field) {
    case "kickCount":
      return setup.kickCount;
    case "snareCount":
      return setup.snareCount;
    case "tomCount":
      return setup.tomCount;
    case "floorCount":
      return setup.floorCount;
  }
}

function updateBooleanField(setup: DrumDefinition, field: BooleanField, checked: boolean): DrumDefinition {
  switch (field) {
    case "hasHiHat":
      return { ...setup, hasHiHat: checked };
    case "hasOverheads":
      return { ...setup, hasOverheads: checked };
    case "tracks.enabled":
      return { ...setup, tracks: { enabled: checked } };
  }
}

export function updateDrumToggleField(setup: DrumDefinition, field: BooleanField, checked: boolean): DrumDefinition {
  return updateBooleanField(setup, field, checked);
}

function booleanFieldValue(setup: DrumDefinition, field: BooleanField): boolean {
  switch (field) {
    case "hasHiHat":
      return setup.hasHiHat;
    case "hasOverheads":
      return setup.hasOverheads;
    case "tracks.enabled":
      return setup.tracks.enabled;
  }
}

export function DrumsPartsEditor({ setup, onChange }: DrumsPartsEditorProps) {
  const activePad = setup.pad.enabled ? setup.pad : { enabled: true as const, mode: "sfx" as const, channels: "mono" as const };

  return (
    <>
      {drumSetupBlueprint.sections.map((section) => (
        <SetupSection key={section.id} title={section.label}>
          <div className={`setup-toggle-grid ${section.id === "additional" ? "setup-toggle-grid--additional-drums" : ""}`}>
            {section.items.map((item) => {
              if (item.control === "count") {
                return (
                  <SetupCounterRow
                    key={item.id}
                    label={item.label}
                    value={countFieldValue(setup, item.field)}
                    min={Math.min(...item.allowed)}
                    max={Math.max(...item.allowed)}
                    onChange={(next) => onChange(updateCountField(setup, item.field, next))}
                  />
                );
              }

              if (item.control === "boolean") {
                return (
                  <SetupToggleRow
                    key={item.id}
                    label={item.label}
                    checked={booleanFieldValue(setup, item.field)}
                    onChange={(checked) => onChange(updateBooleanField(setup, item.field, checked))}
                  />
                );
              }

              return (
                <div key={item.id}>
                  <SetupToggleRow
                    label={item.label}
                    checked={setup.pad.enabled}
                    onChange={(checked) =>
                      onChange({
                        ...setup,
                        pad: checked ? { enabled: true, mode: "sfx", channels: "mono" } : { enabled: false },
                      })
                    }
                  />
                  {setup.pad.enabled ? (
                    <div className="setup-pad-settings" data-testid="pad-settings">
                      <div className="setup-pad-settings__row">
                        <SetupSelectRow
                          label="Mode"
                          value={activePad.mode}
                          options={item.options?.mode ?? ["sfx", "backing"]}
                          onChange={(mode) =>
                            onChange({
                              ...setup,
                              pad: { enabled: true, mode, channels: activePad.channels },
                            })
                          }
                          formatOptionLabel={(mode) => mode.toUpperCase()}
                        />
                      </div>
                      <div className="setup-pad-settings__row">
                        <SetupSelectRow
                          label="Channels"
                          value={activePad.channels}
                          options={item.options?.channels ?? ["mono", "stereo"]}
                          onChange={(channels) =>
                            onChange({
                              ...setup,
                              pad: { enabled: true, mode: activePad.mode, channels },
                            })
                          }
                          formatOptionLabel={(channels) => channels[0].toUpperCase() + channels.slice(1)}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </SetupSection>
      ))}
    </>
  );
}
