import type { DataRepository } from "../../../infra/fs/repo.js";
import {
  formatMonitorOwnerLabel,
  formatMonitoringLabel,
} from "../../formatters/index.js";
import type { Group } from "../../model/groups.js";
import { resolvePresetIdAlias } from "../../model/presetAliases.js";
import type { DocumentViewModel, Musician } from "../../model/types.js";
import {
  type MonitorPresetIndex,
  getMonitorLabel,
} from "../../monitors/getMonitorLabel.js";

export const GROUP_MONITOR_ORDER: Record<Group, number> = {
  guitar: 1,
  vocs: 2,
  keys: 3,
  bass: 4,
  drums: 5,
  talkback: 999,
};

type EffectiveSetupByMusicianId = Map<
  string,
  { monitoring: { monitorRef: string; additionalWedgeCount?: number } }
>;

export type MonitorOwner = { group: Group; musician: Musician };

/**
 * Kdo dostane monitorový řádek. Vlastníci jdou z lineupu, ne z overlays —
 * proto samotný zápis do `project.overlays` mix neuklidí (F5d Nález 1).
 *
 * Slot s lineup rolí `vocs`, který není v žádném vokálním overlay slotu,
 * netiskne jediný kanál — řádky `voc_lead_*`/`voc_back_*` se stavějí výhradně
 * z overlays — a monitorový mix pro něj je proto osiřelý: dokument by vyšel
 * s nula vokálními kanály a s vokálním monitor mixem.
 *
 * Kritérium je **lineup role vlastníka**, ne vokální schopnost muzikanta.
 * Basák, který zpívá back vokály, má `group: "bass"` a svůj basový monitor si
 * nechává, ať je v overlay nebo ne — jeho slot existuje kvůli base. Vypadnout
 * smí jen slot, jehož jediný důvod existence je zpěv.
 */
function resolvePdfMonitorOwners(args: {
  lineupMusicians: MonitorOwner[];
  effectiveSetupByMusicianId: EffectiveSetupByMusicianId;
  leadVocsSlotByMusicianId: Map<string, number>;
  backVocsSlotByMusicianId: Map<string, number>;
}): MonitorOwner[] {
  const {
    lineupMusicians,
    effectiveSetupByMusicianId,
    leadVocsSlotByMusicianId,
    backVocsSlotByMusicianId,
  } = args;
  return lineupMusicians
    .filter(({ musician }) => effectiveSetupByMusicianId.has(musician.id))
    .filter(({ group, musician }) => {
      if (group !== "vocs") return true;
      return (
        leadVocsSlotByMusicianId.has(musician.id) ||
        backVocsSlotByMusicianId.has(musician.id)
      );
    });
}

export function orderPdfMonitorOwners(args: {
  owners: MonitorOwner[];
  leadVocsSlotByMusicianId: Map<string, number>;
}): MonitorOwner[] {
  const { owners, leadVocsSlotByMusicianId } = args;

  return owners
    .map((owner, originalIndex) => ({ owner, originalIndex }))
    .sort((a, b) => {
      const groupRankDiff =
        (GROUP_MONITOR_ORDER[a.owner.group] ?? 999) -
        (GROUP_MONITOR_ORDER[b.owner.group] ?? 999);
      if (groupRankDiff !== 0) return groupRankDiff;

      if (a.owner.group === "vocs" && b.owner.group === "vocs") {
        const aLeadIndex = leadVocsSlotByMusicianId.get(a.owner.musician.id);
        const bLeadIndex = leadVocsSlotByMusicianId.get(b.owner.musician.id);
        if (typeof aLeadIndex === "number" && typeof bLeadIndex === "number") {
          if (aLeadIndex !== bLeadIndex) return aLeadIndex - bLeadIndex;
        } else if (typeof aLeadIndex === "number") {
          return -1;
        } else if (typeof bLeadIndex === "number") {
          return 1;
        }
      }

      return a.originalIndex - b.originalIndex;
    })
    .map(({ owner }) => owner);
}

function resolveMonitorLabel(args: {
  musician: Musician | undefined;
  effectiveSetupByMusicianId: EffectiveSetupByMusicianId;
  monitorsById: MonitorPresetIndex;
  repo: DataRepository;
}): string {
  const { musician, effectiveSetupByMusicianId, monitorsById, repo } = args;
  if (!musician) return "";
  const effective = effectiveSetupByMusicianId.get(musician.id);
  if (!effective) return "";
  const monitorRef = resolvePresetIdAlias(effective.monitoring.monitorRef);
  if (!monitorsById[monitorRef]) {
    const monitorEntity = repo.getPreset(monitorRef);
    if (monitorEntity.type !== "monitor") {
      throw new Error(
        `Monitoring ref "${monitorRef}" is not a monitor preset.`,
      );
    }
    monitorsById[monitorEntity.id] = {
      id: monitorEntity.id,
      label: monitorEntity.label,
    };
  }
  const label = getMonitorLabel(monitorsById, monitorRef);
  const extra = effective.monitoring.additionalWedgeCount;
  return formatMonitoringLabel(label, extra);
}

export function buildPdfMonitorRows(args: {
  lineupMusicians: MonitorOwner[];
  effectiveSetupByMusicianId: EffectiveSetupByMusicianId;
  monitorsById: MonitorPresetIndex;
  repo: DataRepository;
  leadVocsCount: number;
  leadVocsSlotByMusicianId: Map<string, number>;
  leadVocsGenderBySlot: Array<string | undefined>;
  backVocsCount: number;
  backVocsSlotByMusicianId: Map<string, number>;
  backVocsGenderBySlot: Array<string | undefined>;
}): DocumentViewModel["monitorTableRows"] {
  const monitorOwners = resolvePdfMonitorOwners({
    lineupMusicians: args.lineupMusicians,
    effectiveSetupByMusicianId: args.effectiveSetupByMusicianId,
    leadVocsSlotByMusicianId: args.leadVocsSlotByMusicianId,
    backVocsSlotByMusicianId: args.backVocsSlotByMusicianId,
  });
  const orderedMonitorOwners = orderPdfMonitorOwners({
    owners: monitorOwners,
    leadVocsSlotByMusicianId: args.leadVocsSlotByMusicianId,
  });
  const rows: DocumentViewModel["monitorTableRows"] = [];

  for (const owner of orderedMonitorOwners) {
    rows.push({
      no: String(rows.length + 1),
      output: formatMonitorOwnerLabel({
        ownerRole: owner.group,
        ownerMusicianId: owner.musician.id,
        fallbackLabel:
          owner.musician.group === "vocs" ? "Lead vocal" : owner.musician.group,
        leadVocsCount: args.leadVocsCount,
        leadVocsIndexByMusicianId: args.leadVocsSlotByMusicianId,
        genderByLeadVocsIndex: args.leadVocsGenderBySlot,
        backVocsCount: args.backVocsCount,
        backVocsIndexByMusicianId: args.backVocsSlotByMusicianId,
        genderByBackVocsIndex: args.backVocsGenderBySlot,
      }),
      note: resolveMonitorLabel({
        musician: owner.musician,
        effectiveSetupByMusicianId: args.effectiveSetupByMusicianId,
        monitorsById: args.monitorsById,
        repo: args.repo,
      }),
      ownerRole: owner.group,
      ownerMusicianId: owner.musician.id,
    });
  }

  return rows;
}
