import type { Group, StageplanInstrument } from "../model/types.js";

function isAcousticGuitarLabelOrKey(input: { label: string; key?: string }): boolean {
  const normalizedLabel = (input.label ?? "").trim().toLowerCase();
  const normalizedKey = (input.key ?? "").trim().toLowerCase();
  return normalizedKey.startsWith("ac_guitar") || normalizedLabel.includes("acoustic guitar");
}

function mapGroupToStageplanInstrument(group?: Group): StageplanInstrument | null {
  switch (group) {
    case "drums":
      return "Drums";
    case "bass":
      return "Bass";
    case "guitar":
      return "Guitar";
    case "keys":
      return "Keys";
    case "vocs":
      return "Lead vocal";
    default:
      return null;
  }
}

export function resolveStageplanRoleForInput(input: {
  key?: string;
  label: string;
  group?: Group;
  ownerRole?: Group;
}): StageplanInstrument | null {
  const ownerRoleInstrument = mapGroupToStageplanInstrument(input.ownerRole);
  if (ownerRoleInstrument) return ownerRoleInstrument;

  if (isAcousticGuitarLabelOrKey(input)) {
    return "Guitar";
  }

  return mapGroupToStageplanInstrument(input.group);
}
