import type { Group } from "../../model/groups.js";
import type {
  DocumentViewModel,
  Musician,
  Project,
  StageplanInstrumentKey,
  StageplanPerson,
} from "../../model/types.js";
import { mergeWithLineup } from "../../stageplan/layout/mergeWithLineup.js";
import { resolveStageplanBlockSlots } from "../../stageplan/layout/resolveBlockSlots.js";
import { resolvePowerForStageplan } from "../../stageplan/resolvePowerForStageplan.js";

type StageplanSlot =
  | "drums"
  | "bass"
  | "guitar"
  | "keys"
  | "lead_voc_1"
  | "lead_voc_2";

type StageplanInputSource = {
  ch: number;
  key: string;
  label: string;
  group: Group;
  ownerRole: Group;
  ownerMusicianId?: string;
};

function toStageplanPerson(
  musician: Musician,
  bandLeaderId: string,
): StageplanPerson {
  return {
    musicianId: musician.id,
    firstName: musician.firstName ?? null,
    isBandLeader: musician.id === bandLeaderId,
  };
}

function resolveStageplanPersonsBySlot(args: {
  lineupMusicians: Array<{ group: Group; musician: Musician }>;
  leadOverlayMembers: Musician[];
  bandLeaderId: string;
}): Partial<Record<StageplanSlot, StageplanPerson>> {
  const { lineupMusicians, leadOverlayMembers, bandLeaderId } = args;
  const memberByPrimaryGroup = new Map<Group, Musician>();
  for (const entry of lineupMusicians) {
    if (!memberByPrimaryGroup.has(entry.group)) {
      memberByPrimaryGroup.set(entry.group, entry.musician);
    }
  }

  const assigned = new Set<string>();
  const bySlot: Partial<Record<StageplanSlot, StageplanPerson>> = {};
  for (const slot of ["drums", "bass", "guitar", "keys"] as const) {
    const musician = memberByPrimaryGroup.get(slot);
    if (!musician) continue;
    bySlot[slot] = toStageplanPerson(musician, bandLeaderId);
    assigned.add(musician.id);
  }

  const leadCandidates = leadOverlayMembers.filter((m) => !assigned.has(m.id));
  if (leadCandidates[0])
    bySlot.lead_voc_1 = toStageplanPerson(leadCandidates[0], bandLeaderId);
  if (leadCandidates[1])
    bySlot.lead_voc_2 = toStageplanPerson(leadCandidates[1], bandLeaderId);
  return bySlot;
}

export function buildPdfStageplanModel(args: {
  lineupMusicians: Array<{ group: Group; musician: Musician }>;
  lineup: Record<Group, string[]>;
  project: Project;
  membersById: Map<string, Musician>;
  bandLeaderId: string;
  leadOverlayMembers: Musician[];
  inputsWithCh: StageplanInputSource[];
  monitorTableRows: DocumentViewModel["monitorTableRows"];
}): DocumentViewModel["stageplan"] {
  const stageplanRoles: StageplanInstrumentKey[] = [
    "drums",
    "bass",
    "guitar",
    "keys",
    "vocs",
  ];
  const lineupByRole: Partial<Record<StageplanInstrumentKey, StageplanPerson>> =
    {};
  for (const role of stageplanRoles) {
    const musician = args.lineupMusicians.find(
      (entry) => entry.group === role,
    )?.musician;
    if (!musician) continue;
    lineupByRole[role] = toStageplanPerson(musician, args.bandLeaderId);
  }

  const powerByRole: DocumentViewModel["stageplan"]["powerByRole"] = {};
  for (const role of stageplanRoles) {
    const power = resolvePowerForStageplan(
      role,
      args.lineup,
      args.project,
      args.membersById,
    );
    if (power) {
      powerByRole[role] = {
        hasPowerBadge: true,
        powerBadgeText: `${power.sockets}x ${power.voltage} V`,
      };
    } else {
      powerByRole[role] = { hasPowerBadge: false, powerBadgeText: "" };
    }
  }

  const stageplanPersonsBySlot = resolveStageplanPersonsBySlot({
    lineupMusicians: args.lineupMusicians,
    leadOverlayMembers: args.leadOverlayMembers,
    bandLeaderId: args.bandLeaderId,
  });
  const leadVocals = [
    stageplanPersonsBySlot.lead_voc_1,
    stageplanPersonsBySlot.lead_voc_2,
  ].filter((person): person is StageplanPerson => Boolean(person));

  // Sloučení s lineupem běží i pro tisk — ale jen v paměti. Zápis do projektu
  // by posunul contentUpdatedAt bez uživatelovy akce (R8, R9 ve F5a).
  const layout = mergeWithLineup(args.project.stageplan?.layout, {
    slots: resolveStageplanBlockSlots({
      musicianIdsByGroup: {
        drums: args.lineup.drums,
        bass: args.lineup.bass,
        guitar: args.lineup.guitar,
        keys: args.lineup.keys,
      },
      leadVocalIds: args.leadOverlayMembers.map((musician) => musician.id),
    }),
    stage: null,
  });

  return {
    layout,
    lineupByRole,
    leadVocals,
    inputs: args.inputsWithCh
      .filter(
        (input) =>
          input.label !== "---" &&
          input.key !== "---" &&
          !input.key.startsWith("spare_ch_"),
      )
      .map((input) => ({
        channelNo: input.ch,
        label: input.label,
        group: input.group,
        ownerRole: input.ownerRole,
        ownerMusicianId: input.ownerMusicianId,
      })),
    monitorOutputs: args.monitorTableRows.map((row) => ({
      no: Number.parseInt(row.no, 10),
      output: row.output,
      note: row.note,
      ownerRole: row.ownerRole,
      ownerMusicianId: row.ownerMusicianId,
    })),
    powerByRole,
  };
}
