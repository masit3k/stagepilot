import {
  formatMonitorBullets,
  formatStageplanBoxHeader,
} from "../../formatters/stageplan.js";
import type {
  DocumentViewModel,
  Group,
  StageplanInstrument,
  StageplanInstrumentKey,
} from "../../model/types.js";
import { resolveStageplanRoleForInput } from "../../stageplan/resolveStageplanRoleForInput.js";
import type { StageplanLine } from "../../stageplan/stereoCollapse.js";
import { collapseStereoForStageplan } from "../../stageplan/stereoCollapse.js";

export type StageplanPrintSlot =
  | "drums"
  | "bass"
  | "guitar"
  | "keys"
  | "lead_voc_1"
  | "lead_voc_2";

export type StageplanPrintBox = {
  slot: StageplanPrintSlot;
  instrument: StageplanInstrument;
  header: string;
  /**
   * Zda box tiskne pod jménem řádek BANDLEADER (R9). Se skrytými jmény mizí i
   * on — kapelnictví je vlastnost osoby, ne pozice.
   */
  hasBandLeaderLine: boolean;
  inputBullets: string[];
  monitorBullets: string[];
  extraBullets: string[];
  hasPowerBadge: boolean;
  powerBadgeText: string;
};

export type StageplanPrintModel = {
  boxesBySlot: Record<StageplanPrintSlot, StageplanPrintBox>;
};

type StageplanRoleData = {
  instrument: StageplanInstrument;
  role: StageplanInstrumentKey;
  firstName: string | null;
  isBandLeader: boolean;
};

type StageplanInputItem = {
  channelNo: number;
  label: string;
  group?: Group;
};

const STAGEPLAN_PRINT_SLOTS: StageplanPrintSlot[] = [
  "drums",
  "bass",
  "guitar",
  "keys",
  "lead_voc_1",
  "lead_voc_2",
];

const slotByInstrument: Record<
  Exclude<StageplanInstrument, "Lead vocal">,
  StageplanPrintSlot
> = {
  Drums: "drums",
  Bass: "bass",
  Guitar: "guitar",
  Keys: "keys",
};

function resolveMonitorInstrument(output: string): StageplanInstrument | null {
  const normalized = output.trim().toLowerCase();
  if (normalized.startsWith("lead vocal")) return "Lead vocal";
  if (normalized.startsWith("lead voc")) return "Lead vocal";
  if (normalized.startsWith("guitar")) return "Guitar";
  if (normalized.startsWith("keys")) return "Keys";
  if (normalized.startsWith("bass")) return "Bass";
  if (normalized.startsWith("drums")) return "Drums";
  return null;
}

function resolveLeadVocalSlotLabel(args: {
  ownerMusicianId?: string;
  leadSlotByMusicianId: Map<string, "lead_voc_1" | "lead_voc_2">;
}): "lead_voc_1" | "lead_voc_2" {
  const byMusician = args.ownerMusicianId
    ? args.leadSlotByMusicianId.get(args.ownerMusicianId)
    : undefined;
  if (byMusician) return byMusician;
  return "lead_voc_1";
}

function roleDataForSlot(
  vm: DocumentViewModel["stageplan"],
  slot: StageplanPrintSlot,
): StageplanRoleData {
  if (slot === "lead_voc_1" || slot === "lead_voc_2") {
    const leads = vm.leadVocals ?? [];
    const lead =
      slot === "lead_voc_1" ? (leads[0] ?? null) : (leads[1] ?? null);
    return {
      instrument: "Lead vocal",
      role: "vocs",
      firstName: lead?.firstName ?? null,
      isBandLeader: lead?.isBandLeader ?? false,
    };
  }

  const bySlot: Record<
    Exclude<StageplanPrintSlot, "lead_voc_1" | "lead_voc_2">,
    { instrument: StageplanInstrument; role: StageplanInstrumentKey }
  > = {
    drums: { instrument: "Drums", role: "drums" },
    bass: { instrument: "Bass", role: "bass" },
    guitar: { instrument: "Guitar", role: "guitar" },
    keys: { instrument: "Keys", role: "keys" },
  };
  const meta = bySlot[slot];
  const person = vm.lineupByRole[meta.role];
  return {
    instrument: meta.instrument,
    role: meta.role,
    firstName: person?.firstName ?? null,
    isBandLeader: person?.isBandLeader ?? false,
  };
}

function buildInputLines(items: StageplanInputItem[]): StageplanLine[] {
  return items.map((item) => ({
    kind: "input",
    label: item.label,
    no: item.channelNo,
    group: item.group,
  }));
}

function rankKeysStageplanInput(label: string): number {
  const normalized = label.trim().toLowerCase();
  if (normalized.startsWith("keys")) return 0;
  return 1;
}

function isPadInput(label: string): boolean {
  return /pad/i.test(label);
}

function isBackingTrackInput(label: string): boolean {
  return /backing\s*track/i.test(label);
}

function isDummyInput(label: string): boolean {
  return /dummy/i.test(label);
}

function isBackVocalDrums(label: string): boolean {
  return /back vocal\s*(?:[-–—]|\()\s*drums\)?/i.test(label);
}

function formatRange(
  label: string,
  items: Array<{ channelNo: number }>,
): string | null {
  if (items.length === 0) return null;
  const numbers = items.map((item) => item.channelNo);
  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  const range = min === max ? `${min}` : `${min}–${max}`;
  return `${label} (${range})`;
}

function buildDrumsInputBullets(inputs: StageplanInputItem[]): string[] {
  const padInputs = inputs.filter(
    (item) => isPadInput(item.label) && !isDummyInput(item.label),
  );
  const backingTrackInputs = inputs.filter(
    (item) => isBackingTrackInput(item.label) && !isDummyInput(item.label),
  );
  const backVocalInputs = inputs.filter((item) => isBackVocalDrums(item.label));
  const drumInputs = inputs.filter(
    (item) =>
      item.group === "drums" &&
      !isPadInput(item.label) &&
      !isBackingTrackInput(item.label) &&
      !isDummyInput(item.label) &&
      !isBackVocalDrums(item.label),
  );
  const bullets: string[] = [];
  const drumRange = formatRange("Drums", drumInputs);
  const padRange = formatRange("PAD", padInputs);
  const backingTrackRange = formatRange("Backing track", backingTrackInputs);
  const collapsedPadLines = collapseStereoForStageplan(
    buildInputLines(padInputs),
  );
  const padStereoLine =
    padInputs.length === 2 && collapsedPadLines.length === 1
      ? (collapsedPadLines[0]?.text ?? null)
      : null;
  const collapsedBackingTrackLines = collapseStereoForStageplan(
    buildInputLines(backingTrackInputs),
  );
  const backingTrackStereoLine =
    backingTrackInputs.length === 2 && collapsedBackingTrackLines.length === 1
      ? (collapsedBackingTrackLines[0]?.text ?? null)
      : null;

  if (drumRange) bullets.push(drumRange);
  if (padStereoLine) {
    bullets.push(padStereoLine);
  } else if (padRange) {
    bullets.push(padRange);
  }
  if (backingTrackStereoLine) {
    bullets.push(backingTrackStereoLine);
  } else if (backingTrackRange) {
    bullets.push(backingTrackRange);
  }
  for (const item of backVocalInputs) {
    bullets.push(`${item.label} (${item.channelNo})`);
  }

  return bullets;
}

function buildInputBulletsForSlot(
  slot: StageplanPrintSlot,
  inputs: StageplanInputItem[],
): string[] {
  const sortedInputs = inputs.slice().sort((a, b) => {
    if (slot === "keys") {
      const rank =
        rankKeysStageplanInput(a.label) - rankKeysStageplanInput(b.label);
      if (rank !== 0) return rank;
    }
    return a.channelNo - b.channelNo;
  });

  if (slot === "drums") return buildDrumsInputBullets(sortedInputs);

  return collapseStereoForStageplan(buildInputLines(sortedInputs)).map(
    (line) => line.text,
  );
}

export function buildPdfStageplanPrintModel(
  vm: DocumentViewModel["stageplan"],
  options: { hideMusicianNames?: boolean } = {},
): StageplanPrintModel {
  const inputBySlot = new Map<StageplanPrintSlot, StageplanInputItem[]>();
  const monitorBySlot = new Map<
    StageplanPrintSlot,
    Array<{ no: number; label: string }>
  >();
  for (const slot of STAGEPLAN_PRINT_SLOTS) {
    inputBySlot.set(slot, []);
    monitorBySlot.set(slot, []);
  }

  const leadSlotByMusicianId = new Map<string, "lead_voc_1" | "lead_voc_2">();
  const leads = vm.leadVocals ?? [];
  if (leads[0]?.musicianId)
    leadSlotByMusicianId.set(leads[0].musicianId, "lead_voc_1");
  if (leads[1]?.musicianId)
    leadSlotByMusicianId.set(leads[1].musicianId, "lead_voc_2");

  for (const input of vm.inputs) {
    const instrument = resolveStageplanRoleForInput(input);
    if (!instrument) continue;
    const slot =
      instrument === "Lead vocal"
        ? resolveLeadVocalSlotLabel({
            ownerMusicianId: input.ownerMusicianId,
            leadSlotByMusicianId,
          })
        : slotByInstrument[instrument];
    inputBySlot.get(slot)?.push({
      channelNo: input.channelNo,
      label: input.label,
      group: input.group,
    });
  }

  for (const output of vm.monitorOutputs) {
    const instrument = output.ownerRole
      ? resolveStageplanRoleForInput({
          label: output.output,
          ownerRole: output.ownerRole,
        })
      : resolveMonitorInstrument(output.output);
    if (!instrument) continue;
    const slot =
      instrument === "Lead vocal"
        ? resolveLeadVocalSlotLabel({
            ownerMusicianId: output.ownerMusicianId,
            leadSlotByMusicianId,
          })
        : slotByInstrument[instrument];
    for (const bullet of formatMonitorBullets(output.note, output.no)) {
      monitorBySlot.get(slot)?.push({ no: output.no, label: bullet });
    }
  }

  const boxesBySlot = {} as Record<StageplanPrintSlot, StageplanPrintBox>;
  for (const slot of STAGEPLAN_PRINT_SLOTS) {
    const roleData = roleDataForSlot(vm, slot);
    const powerBadge = vm.powerByRole[roleData.role];
    const monitors = (monitorBySlot.get(slot) ?? [])
      .slice()
      .sort((a, b) => a.no - b.no)
      .map((item) => item.label);

    boxesBySlot[slot] = {
      slot,
      instrument: roleData.instrument,
      header: formatStageplanBoxHeader({
        instrumentLabel: roleData.instrument,
        firstName: roleData.firstName,
        hideMusicianNames: options.hideMusicianNames,
      }),
      hasBandLeaderLine: roleData.isBandLeader && !options.hideMusicianNames,
      inputBullets: buildInputBulletsForSlot(slot, inputBySlot.get(slot) ?? []),
      monitorBullets: monitors,
      extraBullets: slot === "drums" ? ["Drum riser 3x2"] : [],
      hasPowerBadge: powerBadge?.hasPowerBadge ?? false,
      powerBadgeText: powerBadge?.powerBadgeText ?? "",
    };
  }

  return { boxesBySlot };
}
