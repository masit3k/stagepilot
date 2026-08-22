import type { InputChannel } from "../model/types";

export type EffectiveInstrumentGroup = {
  key:
    | "drums"
    | "bass"
    | "electric_guitar"
    | "acoustic_guitar"
    | "keys"
    | "lead_voc"
    | "back_voc"
    | "vocs";
  label: string;
  inputs: InputChannel[];
};

const GROUP_ORDER: EffectiveInstrumentGroup["key"][] = [
  "drums",
  "bass",
  "electric_guitar",
  "acoustic_guitar",
  "keys",
  "lead_voc",
  "back_voc",
  "vocs",
];

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Kopie 2 ze dvou prefixových rozpoznávání (F5d R1). Odpovídá na „do kterého
 * řezu kanál spadá“; kopie 1 (`resolveLineupInstrumentMembership.ts`) na
 * „patří tenhle kanál do téhle sekce“. Obě nesou stejné pravidlo, ale
 * neslučují se — viz spec F5d, sekce Navazuje.
 *
 * Fallback `group === "guitar"` má **jen** `electric_guitar`: `preset.group`
 * je u obou kytarových řezů `"guitar"`, takže jedna hodnota nemůže rozhodnout
 * mezi dvěma řezy, a rozpoznání kytaristy stojí na elektrice (M2). `lead_voc`
 * a `back_voc` fallback nedostávají schválně — o slotu vokálního řádku
 * rozhoduje overlay, ne klíč (O1), takže vokální klíč mimo prefix má
 * propadnout na řádek `vocs`.
 *
 * Holý klíč `keys` (presety `keys_mono_xlr`, `keys_mono_jack`) je vyjmenovaný
 * zvlášť: nezačíná na `keys_` a kanál z presetu pole `group` nenese, takže by
 * bez tohohle řádku propadl na `null`.
 */
function resolveGroupKey(input: InputChannel): EffectiveInstrumentGroup["key"] | null {
  const key = normalize(input.key);
  const group = normalize(input.group ?? "");
  if (key.startsWith("dr_") || group === "drums") return "drums";
  if (key.startsWith("el_bass") || key.startsWith("bass_") || group === "bass") return "bass";
  if (key.startsWith("el_guitar")) return "electric_guitar";
  if (key.startsWith("ac_guitar")) return "acoustic_guitar";
  if (group === "guitar") return "electric_guitar";
  if (key === "keys" || key.startsWith("keys_") || group === "keys") return "keys";
  if (key.startsWith("voc_lead") || key.startsWith("vocal_lead")) return "lead_voc";
  if (key.startsWith("voc_back") || key.startsWith("vocal_back")) return "back_voc";
  if (key.startsWith("voc_") || key.startsWith("vocal_") || group === "vocs") return "vocs";
  return null;
}

function groupLabel(key: EffectiveInstrumentGroup["key"]): string {
  switch (key) {
    case "drums":
      return "drums";
    case "bass":
      return "bass";
    case "electric_guitar":
      return "electric guitar";
    case "acoustic_guitar":
      return "acoustic guitar";
    case "keys":
      return "keys";
    case "lead_voc":
      return "lead voc";
    case "back_voc":
      return "back voc";
    case "vocs":
      return "vocals";
  }
}

export function resolveEffectiveInstrumentGroups(inputs: InputChannel[]): EffectiveInstrumentGroup[] {
  const grouped = new Map<EffectiveInstrumentGroup["key"], InputChannel[]>();
  for (const input of inputs) {
    const key = resolveGroupKey(input);
    if (!key) continue;
    const existing = grouped.get(key) ?? [];
    existing.push(input);
    grouped.set(key, existing);
  }

  return GROUP_ORDER
    .filter((key) => grouped.has(key))
    .map((key) => ({
      key,
      label: groupLabel(key),
      inputs: grouped.get(key) ?? [],
    }));
}

export function resolveDistinctInstrumentLabels(inputs: InputChannel[]): string[] {
  return resolveEffectiveInstrumentGroups(inputs).map((group) => group.label);
}
