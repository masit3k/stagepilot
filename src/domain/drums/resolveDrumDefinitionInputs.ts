import type { InputChannel } from "../model/types.js";
import { DRUM_NOTES } from "./drumNotes.js";
import type { DrumDefinition } from "./drumDefinition.js";
import { normalizeDrumDefinition } from "./drumDefinition.js";
import { DRUM_INPUT_ID_BY_KEY, DRUM_INPUT_KEYS_IN_ORDER, type DrumInputKey } from "./drumInputIds.js";
import { validateDrumDefinition } from "./validateDrumDefinition.js";

const LABELS: Record<DrumInputKey, string> = {
  dr_kick_1_out: "Kick OUT",
  dr_kick_1_in: "Kick IN",
  dr_kick_2_out: "Kick 2 OUT",
  dr_kick_2_in: "Kick 2 IN",
  dr_snare1_top: "Snare 1 TOP",
  dr_snare1_bottom: "Snare 1 BOTTOM",
  dr_snare2_top: "Snare 2 TOP",
  dr_snare2_bottom: "Snare 2 BOTTOM",
  dr_snare3_top: "Snare 3 TOP",
  dr_snare3_bottom: "Snare 3 BOTTOM",
  dr_hihat: "Hi-hat",
  dr_tom_1: "Tom 1",
  dr_tom_2: "Tom 2",
  dr_tom_3: "Tom 3",
  dr_tom_4: "Tom 4",
  dr_floor_1: "Floor 1",
  dr_floor_2: "Floor 2",
  dr_floor_3: "Floor 3",
  dr_oh_l: "OH L",
  dr_oh_r: "OH R",
  dr_pad_mono_sfx: "PAD (SFX, mono)",
  dr_pad_stereo_sfx_l: "PAD (SFX, stereo) L",
  dr_pad_stereo_sfx_r: "PAD (SFX, stereo) R",
  dr_pad_stereo_backing_l: "PAD (backing, stereo) L",
  dr_pad_stereo_backing_r: "PAD (backing, stereo) R",
  dr_tracks_l: "Playback (stereo) L",
  dr_tracks_r: "Playback (stereo) R",
};

function isEnabled(definition: DrumDefinition, key: DrumInputKey): boolean {
  if (key.startsWith("dr_kick_1")) {
    const kick = definition.kicks[0];
    return key.endsWith("_in") ? Boolean(kick?.in) : Boolean(kick?.out);
  }
  if (key.startsWith("dr_kick_2")) {
    if (definition.kickCount < 2) return false;
    const kick = definition.kicks[1];
    return key.endsWith("_in") ? Boolean(kick?.in) : Boolean(kick?.out);
  }
  if (key.startsWith("dr_snare1")) {
    const snare = definition.snares[0];
    return key.endsWith("_top") ? Boolean(snare?.top) : Boolean(snare?.bottom);
  }
  if (key.startsWith("dr_snare2")) {
    if (definition.snareCount < 2) return false;
    const snare = definition.snares[1];
    return key.endsWith("_top") ? Boolean(snare?.top) : Boolean(snare?.bottom);
  }
  if (key.startsWith("dr_snare3")) {
    if (definition.snareCount < 3) return false;
    const snare = definition.snares[2];
    return key.endsWith("_top") ? Boolean(snare?.top) : Boolean(snare?.bottom);
  }
  if (key === "dr_hihat") return definition.hasHiHat;
  if (key.startsWith("dr_tom_")) return Number(key.split("_").at(-1)) <= definition.tomCount;
  if (key.startsWith("dr_floor_")) return Number(key.split("_").at(-1)) <= definition.floorCount;
  if (key === "dr_oh_l" || key === "dr_oh_r") return definition.hasOverheads;
  if (key === "dr_pad_mono_sfx") return definition.pad.enabled && definition.pad.mode === "sfx" && definition.pad.channels === "mono";
  if (key === "dr_pad_stereo_sfx_l" || key === "dr_pad_stereo_sfx_r") return definition.pad.enabled && definition.pad.mode === "sfx" && definition.pad.channels === "stereo";
  if (key === "dr_pad_stereo_backing_l" || key === "dr_pad_stereo_backing_r") return definition.pad.enabled && definition.pad.mode === "backing";
  if (key === "dr_tracks_l" || key === "dr_tracks_r") return definition.tracks.enabled;
  return false;
}

export function resolveDrumDefinitionInputs(definition: DrumDefinition): InputChannel[] {
  const normalized = normalizeDrumDefinition(definition);
  const errors = validateDrumDefinition(normalized);
  if (errors.length > 0) throw new Error(errors.map((error) => error.message).join(" "));

  return DRUM_INPUT_KEYS_IN_ORDER.filter((key) => isEnabled(normalized, key)).map((key) => ({
    id: DRUM_INPUT_ID_BY_KEY[key],
    key,
    label: LABELS[key],
    note: DRUM_NOTES[key],
    group: "drums",
  }));
}
