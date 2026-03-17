export const DRUM_INPUT_KEYS_IN_ORDER = [
  "dr_kick_1_out",
  "dr_kick_1_in",
  "dr_kick_2_out",
  "dr_kick_2_in",
  "dr_snare1_top",
  "dr_snare1_bottom",
  "dr_snare2_top",
  "dr_snare2_bottom",
  "dr_snare3_top",
  "dr_snare3_bottom",
  "dr_hihat",
  "dr_tom_1",
  "dr_tom_2",
  "dr_tom_3",
  "dr_tom_4",
  "dr_floor_1",
  "dr_floor_2",
  "dr_floor_3",
  "dr_oh_l",
  "dr_oh_r",
  "dr_pad_mono_sfx",
  "dr_pad_stereo_sfx_l",
  "dr_pad_stereo_sfx_r",
  "dr_pad_stereo_backing_l",
  "dr_pad_stereo_backing_r",
  "dr_tracks_l",
  "dr_tracks_r",
] as const;

export type DrumInputKey = (typeof DRUM_INPUT_KEYS_IN_ORDER)[number];

export const DRUM_INPUT_ID_BY_KEY: Record<DrumInputKey, string> = {
  dr_kick_1_out: "kick_1_out",
  dr_kick_1_in: "kick_1_in",
  dr_kick_2_out: "kick_2_out",
  dr_kick_2_in: "kick_2_in",
  dr_snare1_top: "snare_1_top",
  dr_snare1_bottom: "snare_1_bottom",
  dr_snare2_top: "snare_2_top",
  dr_snare2_bottom: "snare_2_bottom",
  dr_snare3_top: "snare_3_top",
  dr_snare3_bottom: "snare_3_bottom",
  dr_hihat: "hihat",
  dr_tom_1: "tom_1",
  dr_tom_2: "tom_2",
  dr_tom_3: "tom_3",
  dr_tom_4: "tom_4",
  dr_floor_1: "floor_1",
  dr_floor_2: "floor_2",
  dr_floor_3: "floor_3",
  dr_oh_l: "overheads_l",
  dr_oh_r: "overheads_r",
  dr_pad_mono_sfx: "pad_sfx_mono",
  dr_pad_stereo_sfx_l: "pad_sfx_stereo_l",
  dr_pad_stereo_sfx_r: "pad_sfx_stereo_r",
  dr_pad_stereo_backing_l: "pad_backing_l",
  dr_pad_stereo_backing_r: "pad_backing_r",
  dr_tracks_l: "tracks_l",
  dr_tracks_r: "tracks_r",
};

const DRUM_ORDER_INDEX = new Map<string, number>(DRUM_INPUT_KEYS_IN_ORDER.map((key, index) => [key, index]));

export function drumRankByResolvedKey(key: string): number {
  return DRUM_ORDER_INDEX.get(key.toLowerCase()) ?? 500;
}
