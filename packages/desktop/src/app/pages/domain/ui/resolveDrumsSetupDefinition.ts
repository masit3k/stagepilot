import {
  createDefaultDrumDefinition,
  type DrumDefinition,
} from "../../../../../../../src/domain/drums/drumDefinition";
import type { PresetItem } from "../../../../../../../src/domain/model/types";

type ResolveDrumsSetupDefinitionArgs = {
  slotDrumDefinition?: DrumDefinition;
  musicianPresetItems?: PresetItem[];
};

export function resolveDrumsSetupDefinition({
  slotDrumDefinition,
  musicianPresetItems,
}: ResolveDrumsSetupDefinitionArgs): DrumDefinition {
  if (slotDrumDefinition) return slotDrumDefinition;

  const musicianDrumSetup = musicianPresetItems?.find(
    (item): item is Extract<PresetItem, { kind: "drum_setup" }> =>
      item.kind === "drum_setup",
  )?.setup;
  if (musicianDrumSetup) return musicianDrumSetup;

  return createDefaultDrumDefinition();
}
