const PRESET_ID_ALIASES: Record<string, string> = {
  el_bass_xlr: "el_bass_xlr_amp",
  vocal_back_no_mic: "vocal_no_mic",
  vocal_lead_no_mic: "vocal_no_mic",
  vocal_back_wired: "vocal_wired",
  vocal_lead_wired: "vocal_wired",
  vocal_back_wireless: "vocal_wireless",
  vocal_lead_wireless: "vocal_wireless",
};

export function resolvePresetIdAlias(id: string): string {
  return PRESET_ID_ALIASES[id] ?? id;
}
