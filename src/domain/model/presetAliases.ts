const PRESET_ID_ALIASES: Record<string, string> = {
  el_bass_xlr: "el_bass_xlr_amp",
  keys_xlr: "keys_stereo_xlr",
  keys_jack: "keys_stereo_jack",
  iem_mono_wired: "iem_mono_wired_foh",
  iem_mono_wireless: "iem_mono_wireless_foh",
  iem_stereo_wired: "iem_stereo_wired_foh",
  iem_stereo_wireless: "iem_stereo_wireless_foh",
  wedge: "wedge_foh",
};

export function resolvePresetIdAlias(id: string): string {
  return PRESET_ID_ALIASES[id] ?? id;
}
