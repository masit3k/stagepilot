import { drumRankByResolvedKey } from "../../drums/drumInputCatalog.js";
import { GROUP_ORDER } from "../../model/groups.js";
import type { Group } from "../../model/groups.js";
import { compareInputsForRole } from "../../setup/orderInputsForRole.js";

// Minimal shape required for PDF ordering operations.
// BuiltInput in buildDocument.ts satisfies this structurally.
type PdfSortableInput = {
  key: string;
  label: string;
  group: Group;
  ownerRole: Group;
  ownerMusicianId?: string;
  ownerLineupIndex?: number;
  vocalRole?: "lead" | "back";
  vocalSlot?: number;
  vocalOrderRank?: number;
};

// Back-vocal owner roles sorted relative to lead vocals in the PDF vocal block.
const VOC_ORDER: Record<string, number> = {
  guitar: 1,
  lead: 2,
  keys: 3,
  bass: 4,
  drums: 5,
};

function groupRank(group: Group): number {
  const i = GROUP_ORDER.indexOf(group);
  return i === -1 ? 999 : i;
}

function vocalRank(input: PdfSortableInput): number {
  if (input.group !== "vocs") return 999;
  if (input.key === "voc_lead" || input.key.startsWith("voc_lead_"))
    return VOC_ORDER.lead;
  if (input.key.startsWith("voc_back_")) {
    const suffix = input.key.slice("voc_back_".length).replace(/_\d+$/i, "");
    return VOC_ORDER[suffix] ?? 900;
  }
  return 900;
}

function guitarRankByKey(input: PdfSortableInput): number {
  // Acoustic guitars come after electric ones within the guitar group.
  const key = input.key.toLowerCase();
  if (key.startsWith("ac_guitar")) return 100;
  return 0;
}

export function isLeadVocalInput(input: PdfSortableInput): boolean {
  return input.vocalRole === "lead" || input.key.startsWith("voc_lead");
}

export function isBackVocalInput(input: PdfSortableInput): boolean {
  return input.vocalRole === "back" || input.key.startsWith("voc_back_");
}

export function isVocalInput(input: PdfSortableInput): boolean {
  return isLeadVocalInput(input) || isBackVocalInput(input);
}

export function isTalkbackInput(input: PdfSortableInput): boolean {
  return input.group === "talkback" || input.key.startsWith("tb_");
}

export function comparePdfInputs(
  a: PdfSortableInput,
  b: PdfSortableInput,
): number {
  const g = groupRank(a.group) - groupRank(b.group);
  if (g !== 0) return g;

  if (a.group === "drums" && b.group === "drums") {
    const dr = drumRankByResolvedKey(a.key) - drumRankByResolvedKey(b.key);
    if (dr !== 0) return dr;
  }

  if (a.group === "vocs" && b.group === "vocs") {
    const vr = vocalRank(a) - vocalRank(b);
    if (vr !== 0) return vr;
  }

  if (a.group === "guitar" && b.group === "guitar") {
    const gr = guitarRankByKey(a) - guitarRankByKey(b);
    if (gr !== 0) return gr;
  }

  if (a.group === "bass" && b.group === "bass") {
    return compareInputsForRole("bass", a, b);
  }

  // Preserve lineup musician order within the same role group.
  if (a.ownerMusicianId !== b.ownerMusicianId) {
    const lineupDiff = (a.ownerLineupIndex ?? 0) - (b.ownerLineupIndex ?? 0);
    if (lineupDiff !== 0) return lineupDiff;
  }

  const l = a.label.localeCompare(b.label, "en");
  if (l !== 0) return l;

  return a.key.localeCompare(b.key, "en");
}

export function orderPdfVocalInputs<T extends PdfSortableInput>(
  vocalInputs: T[],
  leadVocsSlotByMusicianId: Map<string, number>,
  backVocsSlotByMusicianId: Map<string, number>,
): T[] {
  return vocalInputs.slice().sort((a, b) => {
    const roleDiff = (a.vocalOrderRank ?? 999) - (b.vocalOrderRank ?? 999);
    if (roleDiff !== 0) return roleDiff;

    const aSlot =
      a.vocalSlot ??
      (isLeadVocalInput(a)
        ? leadVocsSlotByMusicianId.get(a.ownerMusicianId ?? "")
        : backVocsSlotByMusicianId.get(a.ownerMusicianId ?? ""));
    const bSlot =
      b.vocalSlot ??
      (isLeadVocalInput(b)
        ? leadVocsSlotByMusicianId.get(b.ownerMusicianId ?? "")
        : backVocsSlotByMusicianId.get(b.ownerMusicianId ?? ""));
    const slotDiff = (aSlot ?? 999) - (bSlot ?? 999);
    if (slotDiff !== 0) return slotDiff;

    if (isLeadVocalInput(a) && isBackVocalInput(b)) return -1;
    if (isBackVocalInput(a) && isLeadVocalInput(b)) return 1;

    return a.label.localeCompare(b.label, "en");
  });
}

// Final PDF input order: instruments → vocals (ordered) → talkback.
export function composeFinalPdfInputOrder<T extends PdfSortableInput>(
  finalizedInputs: T[],
  leadVocsSlotByMusicianId: Map<string, number>,
  backVocsSlotByMusicianId: Map<string, number>,
): T[] {
  const nonVocalNonTalkback = finalizedInputs.filter(
    (input) => !isVocalInput(input) && !isTalkbackInput(input),
  );
  const vocals = orderPdfVocalInputs(
    finalizedInputs.filter(isVocalInput),
    leadVocsSlotByMusicianId,
    backVocsSlotByMusicianId,
  );
  const talkback = finalizedInputs.filter(isTalkbackInput);
  return [...nonVocalNonTalkback, ...vocals, ...talkback];
}
