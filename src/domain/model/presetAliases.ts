const PRESET_ID_ALIASES: Record<string, string> = {
  el_bass_xlr: "el_bass_xlr_amp",
};

export function resolvePresetIdAlias(id: string): string {
  return PRESET_ID_ALIASES[id] ?? id;
}
