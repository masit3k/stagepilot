import type { Group, StageplanInstrument } from "../model/types.js";

const backVocalPattern =
  /back vocal\s*[-–—]\s*(guitar|keys|bass|drums)/i;
const talkbackPattern =
  /talkback\s*[-–—]\s*(guitar|keys|bass|drums)/i;

function mapInstrumentMatch(match: string | undefined): StageplanInstrument | null {
  switch ((match ?? "").toLowerCase()) {
    case "drums":
      return "Drums";
    case "bass":
      return "Bass";
    case "guitar":
      return "Guitar";
    case "keys":
      return "Keys";
    default:
      return null;
  }
}


function isAcousticGuitarLabelOrKey(input: { label: string; key?: string }): boolean {
  const normalizedLabel = (input.label ?? "").trim().toLowerCase();
  const normalizedKey = (input.key ?? "").trim().toLowerCase();
  return normalizedKey.startsWith("ac_guitar") || normalizedLabel.includes("acoustic guitar");
}

function isLeadVocalLabel(label: string): boolean {
  const normalized = label.trim().toLowerCase();
  return normalized.startsWith("lead voc") || normalized.includes("lead vocal");
}

export function resolveStageplanRoleForInput(input: {
  key?: string;
  label: string;
  group?: Group;
}): StageplanInstrument | null {
  const label = input.label ?? "";
  const backMatch = backVocalPattern.exec(label);
  if (backMatch) {
    return mapInstrumentMatch(backMatch[1]);
  }

  const talkbackMatch = talkbackPattern.exec(label);
  if (talkbackMatch) {
    return mapInstrumentMatch(talkbackMatch[1]);
  }

  if (isLeadVocalLabel(label)) {
    return "Lead vocal";
  }

  if (isAcousticGuitarLabelOrKey(input)) {
    return "Guitar";
  }

  switch (input.group) {
    case "drums":
      return "Drums";
    case "bass":
      return "Bass";
    case "guitar":
      return "Guitar";
    case "keys":
      return "Keys";
    case "vocs":
      return isLeadVocalLabel(label) ? "Lead vocal" : null;
    default:
      return null;
  }
}
