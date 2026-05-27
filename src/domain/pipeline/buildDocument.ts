import type { DataRepository } from "../../infra/fs/repo.js";
import { parsePersistedDrumDefinition } from "../drums/drumDefinition.js";
import {
  drumRankByResolvedKey,
  resolveDrumInputs,
} from "../drums/resolveDrumInputs.js";
import {
  compactStereoInputChannelsForPdf,
  formatBackVocalPdfLabel,
  formatDrumInputDisplayLabel,
  formatLeadVocalPdfLabel,
  formatMonitorOwnerLabel,
  formatMonitoringLabel,
  formatProjectMetaLine,
  groupActiveDrumInputsByFamily,
  resolveStereoPair,
} from "../formatters/index.js";
import { GROUP_ORDER } from "../model/groups.js";
import type { Group } from "../model/groups.js";
import type {
  DocumentViewModel,
  InputChannel,
  MetaLineModel,
  Musician,
  NoteLine,
  NotesTemplate,
  PresetEntity,
  PresetItem,
  PresetOverridePatch,
  Project,
  StageplanInstrumentKey,
  StageplanPerson,
} from "../model/types.js";
import {
  type MonitorPresetIndex,
  getMonitorLabel,
} from "../monitors/getMonitorLabel.js";
import { resolveCanonicalOverlayAssignments } from "../project/resolveProjectAudioAssignments.js";
import { applyPresetOverride } from "../rules/presetOverride.js";
import { compareInputsForRole } from "../setup/orderInputsForRole.js";
import { resolveEffectiveProjectSetup } from "../setup/resolveEffectiveProjectSetup.js";
import { resolvePowerForStageplan } from "../stageplan/resolvePowerForStageplan.js";
import { disambiguateInputKeys } from "./disambiguateInputKeys.js";
import { formatKeysInputInstances } from "./formatKeysInputs.js";
import { reorderAcousticGuitars } from "./reorderAcousticGuitars.js";
import { resolveDocumentContext } from "./resolveDocumentContext.js";
import { resolveEffectivePresetsForProject } from "./resolveEffectivePresetsForProject.js";

/* ============================================================
 * Helpers
 * ============================================================ */

function buildMetaLine(project: Project): MetaLineModel {
  const purpose = project.purpose === "event" ? "event" : "general";
  return formatProjectMetaLine({
    purpose,
    eventDate: project.eventDate,
    eventVenue: project.eventVenue,
    documentDate: project.documentDate,
    note: project.note,
    updatedAt: project.updatedAt,
  });
}

function groupRank(group: Group): number {
  const i = GROUP_ORDER.indexOf(group);
  return i === -1 ? 999 : i;
}

/* ============================================================
 * Notes filtering (no eval, strict predicates)
 * ============================================================ */

function filterNotesMonitors(notes: NoteLine[], hasWedge: boolean): NoteLine[] {
  return notes.filter((n) => {
    if (!n.when) return true;
    if ("monitors" in n.when) {
      if (n.when.monitors.hasWedge === true) return hasWedge === true;
    }
    return false;
  });
}

/* ============================================================
 * Domain types (internal)
 * ============================================================ */

type BuiltInput = {
  key: string;
  label: string;
  baseLabel?: string;
  compactGroupKey?: string;
  channel?: "L" | "R";
  group: Group;
  note?: string;
  ownerGender?: "m" | "f" | "x";
  ownerRole: Group;
  ownerMusicianId?: string;
  ownerLineupIndex?: number;
  vocalRole?: "lead" | "back";
  vocalSlot?: number;
  vocalOrderRank?: number;
};

type BuiltInputWithCh = BuiltInput & { ch: number };

type MonitorTableRow = {
  no: string;
  output: string;
  note: string;
  ownerRole: Group;
  ownerMusicianId: string;
};

type StageplanSlot =
  | "drums"
  | "bass"
  | "guitar"
  | "keys"
  | "lead_voc_1"
  | "lead_voc_2";

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

function resolveOverlaySlots(args: {
  ctx: ReturnType<typeof resolveDocumentContext>;
  role: "leadVocals" | "backVocals";
}): Array<{ musician: Musician; slot: number }> {
  const { ctx, role } = args;
  return resolveCanonicalOverlayAssignments({
    project: ctx.project,
    role,
    activeMusicianIds: ctx.lineupMusicians.map(({ musician }) => musician.id),
  })
    .map((musicianId, index) => {
      const musician = ctx.membersById.get(musicianId);
      return musician ? { musician, slot: index + 1 } : null;
    })
    .filter((entry): entry is { musician: Musician; slot: number } =>
      Boolean(entry),
    );
}

const GROUP_MONITOR_ORDER: Record<Group, number> = {
  guitar: 1,
  vocs: 2,
  keys: 3,
  bass: 4,
  drums: 5,
  talkback: 999,
};

function resolveOverlayDrivenVocalRows(args: {
  role: "lead" | "back";
  members: Array<{ musician: Musician; slot: number }>;
  capabilityByMusicianId: Map<string, BuiltInput[]>;
  ownerGroupByMusicianId: Map<string, Group>;
}): BuiltInput[] {
  const { role, members, capabilityByMusicianId, ownerGroupByMusicianId } =
    args;
  const rows: BuiltInput[] = [];

  for (const { musician, slot } of members) {
    const ownerRole = ownerGroupByMusicianId.get(musician.id) ?? musician.group;
    const orderRank = GROUP_MONITOR_ORDER[ownerRole] ?? 999;
    const capabilityInputs = capabilityByMusicianId.get(musician.id) ?? [
      {
        key:
          role === "lead"
            ? `voc_lead_${slot}`
            : `voc_back_${ownerRole}_${slot}`,
        label: role === "lead" ? "Lead vocal" : "Back vocal",
        group: "vocs" as const,
        ownerRole,
        ownerMusicianId: musician.id,
        ownerGender: musician.gender,
      },
    ];

    for (const capability of capabilityInputs) {
      rows.push({
        ...capability,
        key:
          role === "lead"
            ? `voc_lead_${slot}`
            : `voc_back_${ownerRole}_${slot}`,
        label: role === "lead" ? "Lead vocal" : "Back vocal",
        group: "vocs",
        ownerRole,
        ownerMusicianId: musician.id,
        ownerGender: musician.gender,
        vocalRole: role,
        vocalSlot: slot,
        vocalOrderRank: orderRank,
      });
    }
  }

  return rows;
}

function normalizeTalkbackLabel(label: string): string {
  return label.replace(
    /^Talkback\s*(?:[-–—]|\()\s*([^)]+?)\)?$/i,
    (_all, owner: string) => `Talkback (${owner.trim()})`,
  );
}

function resolvePdfMonitorOwners(args: {
  lineupMusicians: Array<{ group: Group; musician: Musician }>;
  effectiveSetupByMusicianId: Map<
    string,
    { monitoring: { monitorRef: string; additionalWedgeCount?: number } }
  >;
}): Array<{ group: Group; musician: Musician }> {
  const { lineupMusicians, effectiveSetupByMusicianId } = args;
  return lineupMusicians.filter(({ musician }) =>
    effectiveSetupByMusicianId.has(musician.id),
  );
}

function orderPdfMonitorOwners(args: {
  owners: Array<{ group: Group; musician: Musician }>;
  leadVocsSlotByMusicianId: Map<string, number>;
}): Array<{ group: Group; musician: Musician }> {
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
  (["drums", "bass", "guitar", "keys"] as const).forEach((slot) => {
    const musician = memberByPrimaryGroup.get(slot);
    if (!musician) return;
    bySlot[slot] = toStageplanPerson(musician, bandLeaderId);
    assigned.add(musician.id);
  });

  const leadCandidates = leadOverlayMembers.filter((m) => !assigned.has(m.id));
  if (leadCandidates[0])
    bySlot.lead_voc_1 = toStageplanPerson(leadCandidates[0], bandLeaderId);
  if (leadCandidates[1])
    bySlot.lead_voc_2 = toStageplanPerson(leadCandidates[1], bandLeaderId);
  return bySlot;
}

function applyInputOverridePatch(
  source: BuiltInput[],
  patch: PresetOverridePatch,
): BuiltInput[] {
  const defaultPreset = {
    inputs: source.map((item) => ({
      key: item.key,
      label: item.label,
      baseLabel: item.baseLabel,
      compactGroupKey: item.compactGroupKey,
      channel: item.channel,
      group: item.group,
      note: item.note,
    })),
    monitoring: { monitorRef: "wedge" as const },
  };
  const patched = applyPresetOverride(defaultPreset, patch).inputs;
  return patched.map((input) => ({
    key: input.key,
    label: input.label,
    baseLabel: input.baseLabel,
    compactGroupKey: input.compactGroupKey,
    channel: input.channel,
    group: input.group ?? source[0]?.group ?? "vocs",
    note: input.note,
    ownerRole: source[0]?.ownerRole ?? "vocs",
    ownerMusicianId: source[0]?.ownerMusicianId,
    ownerLineupIndex: source[0]?.ownerLineupIndex ?? 0,
  }));
}

/* ============================================================
 * Per-musician input collection
 * ============================================================ */

function buildMusicianInstrumentInputs(args: {
  musician: Musician;
  group: Group;
  effectivePresetItems: PresetItem[];
  effectiveMusicianSetup:
    | {
        inputs: InputChannel[];
        monitoring: { monitorRef: string; additionalWedgeCount?: number };
      }
    | undefined;
  repo: DataRepository;
}): { inputs: BuiltInput[]; vocalCapability: BuiltInput[] | null } {
  const {
    musician,
    group,
    effectivePresetItems,
    effectiveMusicianSetup,
    repo,
  } = args;
  let vocalCapability: BuiltInput[] | null = null;
  const result: BuiltInput[] = [];

  for (const item of effectivePresetItems) {
    const runtimeKind = (item as { kind?: unknown }).kind;

    if (group === "drums" && item.kind === "drum_setup") continue;
    if (group === "bass" && item.kind === "preset") {
      const entity = repo.getPreset(item.ref);
      if (entity.type === "preset" && entity.group === "bass") continue;
    }
    if (item.kind === "monitor") continue;

    if (runtimeKind === "preset") {
      const ref = (item as { ref?: unknown }).ref;
      if (typeof ref !== "string" || ref.trim().length === 0) continue;
      const entity = repo.getPreset(ref);
      if (entity.type === "preset" && entity.group === "vocs") {
        vocalCapability = entity.inputs.map((input) => ({
          key: input.key,
          label: input.label,
          baseLabel: input.baseLabel,
          compactGroupKey: input.compactGroupKey,
          channel: input.channel,
          group: "vocs" as const,
          note: input.note,
          ownerRole: group,
          ownerMusicianId: musician.id,
          ownerGender: musician.gender,
        }));
        continue;
      }
    }

    if (runtimeKind !== "preset" && runtimeKind !== "drum_setup") continue;

    const expanded = expandPresetItem(item, group, repo);
    for (const input of expanded) {
      if (!input.ownerMusicianId) input.ownerMusicianId = musician.id;
    }
    result.push(...expanded);
  }

  if ((group === "bass" || group === "drums") && effectiveMusicianSetup) {
    result.push(
      ...effectiveMusicianSetup.inputs.map((input) => ({
        key: input.key,
        label: input.label,
        baseLabel: input.baseLabel,
        compactGroupKey: input.compactGroupKey,
        channel: input.channel,
        group,
        note: input.note,
        ownerRole: group,
        ownerMusicianId: musician.id,
      })),
    );
  }

  return { inputs: result, vocalCapability };
}

/* ============================================================
 * 1) Assign channels with odd-start stereo (except overheads)
 * ============================================================ */

function assignChannelsWithOddStereoRule(
  sorted: BuiltInput[],
): BuiltInputWithCh[] {
  const out: BuiltInputWithCh[] = [];
  let nextCh = 1;

  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];

    const stereo = b ? resolveStereoPair(a, b) : null;

    if (stereo) {
      const mustStartOdd = stereo.shouldCollapse;

      if (mustStartOdd && nextCh % 2 === 0) {
        out.push({
          ch: nextCh,
          key: `spare_ch_${nextCh}`,
          label: "---",
          group: a.group,
          note: "---",
          ownerRole: a.ownerRole,
        });
        nextCh++;
      }

      const first = stereo.aSide === "L" ? a : b!;
      const second = stereo.aSide === "L" ? b! : a;

      out.push({ ch: nextCh, ...first });
      out.push({ ch: nextCh + 1, ...second });
      nextCh += 2;

      i++;
      continue;
    }

    out.push({ ch: nextCh, ...a });
    nextCh++;
  }

  return out;
}

/* ============================================================
 * 2) Build display rows (compact explicit stereo groups for PDF)
 * ============================================================ */

function buildInputRows(inputsWithCh: BuiltInputWithCh[]) {
  return compactStereoInputChannelsForPdf(inputsWithCh);
}

/* ============================================================
 * Preset expansion (correct narrowing by ent.type)
 * ============================================================ */

function expandPresetItem(
  item: PresetItem,
  lineupGroup: Group,
  repo: DataRepository,
): BuiltInput[] {
  switch (item.kind) {
    case "drum_setup": {
      const definition = parsePersistedDrumDefinition(
        item.setup,
        "musician drum_setup preset",
      );
      return resolveDrumInputs(definition).map((ch) => ({
        key: ch.key,
        label: ch.label,
        baseLabel: ch.baseLabel,
        compactGroupKey: ch.compactGroupKey,
        channel: ch.channel,
        group: ch.group ?? lineupGroup,
        note: ch.note,
        ownerRole: lineupGroup,
      }));
    }

    case "preset": {
      const ent: PresetEntity = repo.getPreset(item.ref);

      if (ent.type !== "preset") {
        throw new Error(
          `PresetItem(kind=preset) ref="${item.ref}" points to type="${ent.type}"`,
        );
      }

      return ent.inputs.map((ch: InputChannel) => ({
        key: ch.key,
        label: ch.label,
        baseLabel: ch.baseLabel,
        compactGroupKey: ch.compactGroupKey,
        channel: ch.channel,
        group: ch.group ?? lineupGroup,
        note: ch.note,
        ownerRole: lineupGroup,
      }));
    }

    case "talkback": {
      const ent: PresetEntity = repo.getPreset(item.ref);
      if (ent.type !== "talkback_type") {
        throw new Error(
          `PresetItem(kind=talkback) ref="${item.ref}" points to type="${ent.type}"`,
        );
      }

      return [
        {
          key: ent.input.key.replace("{ownerKey}", item.ownerKey),
          label: normalizeTalkbackLabel(
            ent.input.label
              .replace("{ownerKey}", item.ownerKey)
              .replace("{ownerLabel}", item.ownerLabel ?? item.ownerKey),
          ),
          group: ent.group,
          note: ent.input.note
            ? ent.input.note
                .replace("{ownerKey}", item.ownerKey)
                .replace("{ownerLabel}", item.ownerLabel ?? item.ownerKey)
            : undefined,
          ownerRole: lineupGroup,
        },
      ];
    }

    case "monitor":
      return [];
  }
}

/* ============================================================
 * Vocal ordering (existing logic)
 * ============================================================ */

const VOC_ORDER: Record<string, number> = {
  guitar: 1,
  lead: 2,
  keys: 3,
  bass: 4,
  drums: 5,
};

function vocalRank(input: BuiltInput): number {
  if (input.group !== "vocs") return 999;

  if (input.key === "voc_lead" || input.key.startsWith("voc_lead_"))
    return VOC_ORDER.lead;

  if (input.key.startsWith("voc_back_")) {
    const suffix = input.key.slice("voc_back_".length).replace(/_\d+$/i, "");
    return VOC_ORDER[suffix] ?? 900;
  }

  return 900;
}

function guitarRankByKey(input: BuiltInput): number {
  // Default rule: acoustic comes last inside the guitar group (may conflict with future group order rules).
  const key = input.key.toLowerCase();
  if (key.startsWith("ac_guitar")) return 100;
  return 0;
}

function isLeadVocalInput(input: BuiltInput): boolean {
  return input.vocalRole === "lead" || input.key.startsWith("voc_lead");
}

function isBackVocalInput(input: BuiltInput): boolean {
  return input.vocalRole === "back" || input.key.startsWith("voc_back_");
}

function isVocalInput(input: BuiltInput): boolean {
  return isLeadVocalInput(input) || isBackVocalInput(input);
}

function isTalkbackInput(input: BuiltInput): boolean {
  return input.group === "talkback" || input.key.startsWith("tb_");
}

/* ============================================================
 * Multi-musician numbering
 * When a lineup role has N > 1 musicians, prefix each musician's
 * instrument inputs with their lineup index (1-based).
 * e.g. guitarist 1 stereo → "Electric guitar 1 L / 1 R"
 *      guitarist 2 mono  → "Electric guitar 2"
 * Vocals and talkback have dedicated numbering systems and are skipped.
 * ============================================================ */

function insertMusicianNumberIntoLabel(label: string, n: number): string {
  // Insert number before stereo side indicator: "Electric guitar L" → "Electric guitar 1 L"
  const sideMatch = /^(.*)\s+(L|R)\s*$/i.exec(label.trimEnd());
  if (sideMatch) {
    return `${sideMatch[1].trimEnd()} ${n} ${sideMatch[2]}`;
  }
  return `${label} ${n}`;
}

function numberMultiMusicianRoleInputs(inputs: BuiltInput[]): BuiltInput[] {
  // Determine how many musicians are in each ownerRole
  const musicianCountByRole = new Map<Group, number>();
  for (const input of inputs) {
    if (input.group === "vocs" || input.group === "talkback") continue;
    if (!input.ownerMusicianId) continue;
    const lineupIndex = (input.ownerLineupIndex ?? 0) + 1; // 1-based count
    const current = musicianCountByRole.get(input.ownerRole) ?? 0;
    if (lineupIndex > current) musicianCountByRole.set(input.ownerRole, lineupIndex);
  }

  return inputs.map((input) => {
    if (input.group === "vocs" || input.group === "talkback") return input;
    if (!input.ownerMusicianId) return input;
    const total = musicianCountByRole.get(input.ownerRole) ?? 1;
    if (total <= 1) return input;
    const n = (input.ownerLineupIndex ?? 0) + 1;
    return {
      ...input,
      label: insertMusicianNumberIntoLabel(input.label, n),
      ...(input.baseLabel ? { baseLabel: `${input.baseLabel} ${n}` } : {}),
    };
  });
}

/* ============================================================
 * Public API
 * ============================================================ */

export function buildDocument(
  project: Project,
  repo: DataRepository,
): DocumentViewModel {
  const ctx = resolveDocumentContext(project, repo);
  const band = ctx.band;
  const legacyStageplanPersons = (band as { stageplanPersons?: unknown })
    .stageplanPersons;
  if (legacyStageplanPersons) {
    console.warn(
      `Ignoring legacy stageplanPersons for band "${band.id}". Use defaultLineup/musicians instead.`,
    );
  }

  const inputs: BuiltInput[] = [];
  const vocalCapabilityByMusicianId = new Map<string, BuiltInput[]>();
  const monitors: DocumentViewModel["monitors"] = [];

  const monitorTableRows: MonitorTableRow[] = [];
  const monitorsById: MonitorPresetIndex = {};
  const effectiveSetup = resolveEffectiveProjectSetup({
    project,
    band,
    bandLeaderId: ctx.bandLeaderId,
    getMusicianById: (id) => repo.getMusician(id),
    getPresetByRef: (ref) => {
      try {
        return repo.getPreset(ref);
      } catch {
        return undefined;
      }
    },
  });

  // 0-based position of each musician within their lineup role group
  const lineupIndexByMusicianId = new Map<string, number>();
  {
    const groupCounters = new Map<Group, number>();
    for (const { group, musician } of ctx.lineupMusicians) {
      const idx = groupCounters.get(group) ?? 0;
      lineupIndexByMusicianId.set(musician.id, idx);
      groupCounters.set(group, idx + 1);
    }
  }

  const effectivePresetItemsByMusicianId = new Map<string, PresetItem[]>();
  for (const { group, musician } of ctx.lineupMusicians) {
    const lineupIndex = lineupIndexByMusicianId.get(musician.id) ?? 0;
    const effectivePresetItems = resolveEffectivePresetsForProject({
      project,
      band,
      musician,
      group,
      repo,
    });
    effectivePresetItemsByMusicianId.set(musician.id, effectivePresetItems);
    const effectiveMusicianSetup = effectiveSetup.byMusicianId.get(musician.id);

    if (effectiveMusicianSetup) {
      const monitorEntity = repo.getPreset(
        effectiveMusicianSetup.monitoring.monitorRef,
      );
      if (monitorEntity.type !== "monitor") {
        throw new Error(
          `Monitoring ref "${effectiveMusicianSetup.monitoring.monitorRef}" is not a monitor preset.`,
        );
      }
      monitorsById[monitorEntity.id] = {
        id: monitorEntity.id,
        label: monitorEntity.label,
      };
      monitors.push({
        id: `${musician.id}:${monitorEntity.id}`,
        label: monitorEntity.label,
        kind: monitorEntity.id === "wedge" ? "wedge" : "iem",
      });
    }

    const { inputs: musicianInputs, vocalCapability } =
      buildMusicianInstrumentInputs({
        musician,
        group,
        effectivePresetItems,
        effectiveMusicianSetup,
        repo,
      });
    for (const input of musicianInputs) {
      input.ownerLineupIndex = lineupIndex;
    }
    if (vocalCapability)
      vocalCapabilityByMusicianId.set(musician.id, vocalCapability);
    inputs.push(...musicianInputs);

    const eventOverride =
      group === "bass" || group === "drums"
        ? undefined
        : ctx.presetOverrideByMusicianId.get(musician.id);
    if (eventOverride) {
      const affected = inputs.filter((input) => input.group === group);
      const patched = applyInputOverridePatch(affected, eventOverride);
      for (const input of affected) {
        const idx = inputs.indexOf(input);
        if (idx >= 0) inputs.splice(idx, 1);
      }
      inputs.push(...patched);
    }
  }

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
    const musician = ctx.lineupMusicians.find(
      (entry) => entry.group === role,
    )?.musician;
    if (!musician) continue;
    lineupByRole[role] = toStageplanPerson(musician, ctx.bandLeaderId);
  }
  const powerByRole: Partial<
    Record<
      StageplanInstrumentKey,
      {
        hasPowerBadge: boolean;
        powerBadgeText: string;
      }
    >
  > = {};
  for (const role of stageplanRoles) {
    const power = resolvePowerForStageplan(
      role,
      ctx.lineup,
      project,
      ctx.membersById,
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

  // ------------------------------------------------------------
  // Monitor table ordering & text per spec
  // - header is handled in template
  // - note is taken from monitor entity label
  // ------------------------------------------------------------

  const firstMonitorLabel = (m: Musician | undefined): string => {
    if (!m) return "";
    const effective = effectiveSetup.byMusicianId.get(m.id);
    if (!effective) return "";
    const monitorRef = effective.monitoring.monitorRef;
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
  };

  const leadResolved = resolveOverlaySlots({ ctx, role: "leadVocals" });
  const backResolved = resolveOverlaySlots({ ctx, role: "backVocals" });
  const ownerGroupByMusicianId = new Map(
    ctx.lineupMusicians.map(
      ({ group, musician }) => [musician.id, group] as const,
    ),
  );
  const vocalRows = [
    ...resolveOverlayDrivenVocalRows({
      role: "lead",
      members: leadResolved,
      capabilityByMusicianId: vocalCapabilityByMusicianId,
      ownerGroupByMusicianId,
    }),
    ...resolveOverlayDrivenVocalRows({
      role: "back",
      members: backResolved,
      capabilityByMusicianId: vocalCapabilityByMusicianId,
      ownerGroupByMusicianId,
    }),
  ];
  inputs.push(...vocalRows);
  if (ctx.talkbackOwnerId) {
    const talkbackOwner = ctx.membersById.get(ctx.talkbackOwnerId);
    const talkbackOwnerGroup = ownerGroupByMusicianId.get(ctx.talkbackOwnerId);
    if (talkbackOwner && talkbackOwnerGroup) {
      const talkbackRows = expandPresetItem(
        {
          kind: "talkback",
          ref: "talkback",
          ownerKey: talkbackOwnerGroup,
          ownerLabel: talkbackOwnerGroup,
        },
        talkbackOwnerGroup,
        repo,
      ).map((input) => ({
        ...input,
        ownerRole: talkbackOwnerGroup,
        ownerMusicianId: talkbackOwner.id,
      }));
      inputs.push(...talkbackRows);
    }
  }
  const leadVocsSlotByMusicianId = new Map(
    leadResolved.map(({ musician, slot }) => [musician.id, slot]),
  );
  const backVocsSlotByMusicianId = new Map(
    backResolved.map(({ musician, slot }) => [musician.id, slot]),
  );
  const leadVocsCount = leadResolved.length;
  const leadVocsGenderBySlot: Array<string | undefined> = [];
  for (const { musician, slot } of leadResolved) {
    leadVocsGenderBySlot[slot - 1] = musician.gender;
  }
  const backVocsCount = backResolved.length;
  const backVocsGenderBySlot: Array<string | undefined> = [];
  for (const { musician, slot } of backResolved) {
    backVocsGenderBySlot[slot - 1] = musician.gender;
  }

  const monitorOwners = resolvePdfMonitorOwners({
    lineupMusicians: ctx.lineupMusicians,
    effectiveSetupByMusicianId: effectiveSetup.byMusicianId,
  });
  const orderedMonitorOwners = orderPdfMonitorOwners({
    owners: monitorOwners,
    leadVocsSlotByMusicianId,
  });
  const pushRow = (
    owner: { group: Group; musician: Musician },
    output: string,
  ) => {
    monitorTableRows.push({
      no: String(monitorTableRows.length + 1),
      output,
      note: firstMonitorLabel(owner.musician),
      ownerRole: owner.group,
      ownerMusicianId: owner.musician.id,
    });
  };
  for (const owner of orderedMonitorOwners) {
    pushRow(
      owner,
      formatMonitorOwnerLabel({
        ownerRole: owner.group,
        ownerMusicianId: owner.musician.id,
        fallbackLabel:
          owner.musician.group === "vocs" ? "Lead vocal" : owner.musician.group,
        leadVocsCount,
        leadVocsIndexByMusicianId: leadVocsSlotByMusicianId,
        genderByLeadVocsIndex: leadVocsGenderBySlot,
        backVocsCount,
        backVocsIndexByMusicianId: backVocsSlotByMusicianId,
        genderByBackVocsIndex: backVocsGenderBySlot,
      }),
    );
  }

  inputs.sort((a, b) => {
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
      // Acoustic guitars come after electric ones within the guitar block.
      const gr = guitarRankByKey(a) - guitarRankByKey(b);
      if (gr !== 0) return gr;
    }

    if (a.group === "bass" && b.group === "bass") {
      return compareInputsForRole("bass", a, b);
    }

    // Preserve lineup musician order within the same role group
    if (a.ownerMusicianId !== b.ownerMusicianId) {
      const lineupDiff =
        (a.ownerLineupIndex ?? 0) - (b.ownerLineupIndex ?? 0);
      if (lineupDiff !== 0) return lineupDiff;
    }

    const l = a.label.localeCompare(b.label, "en");
    if (l !== 0) return l;

    return a.key.localeCompare(b.key, "en");
  });

  const reorderedInputs = reorderAcousticGuitars(
    numberMultiMusicianRoleInputs(inputs),
  );
  const formattedKeysInputs = formatKeysInputInstances(reorderedInputs);
  const disambiguatedInputs = disambiguateInputKeys(formattedKeysInputs);
  const drumFamilyState = groupActiveDrumInputsByFamily(disambiguatedInputs);
  const finalizedInputs = disambiguatedInputs.map((input) => {
    if (input.group === "drums") {
      return {
        ...input,
        label: formatDrumInputDisplayLabel(input, drumFamilyState),
      };
    }
    if (input.vocalRole === "back" || input.key.startsWith("voc_back_")) {
      return {
        ...input,
        label: formatBackVocalPdfLabel({
          ownerRole: input.ownerRole,
          ownerMusicianId: input.ownerMusicianId,
          backVocsCount,
          backVocsSlotByMusicianId,
          genderByBackVocsSlot: backVocsGenderBySlot,
          fallbackLabel: input.label,
        }),
      };
    }
    if (input.vocalRole === "lead" || input.key.startsWith("voc_lead")) {
      return {
        ...input,
        label: formatLeadVocalPdfLabel({
          ownerRole: input.ownerRole,
          ownerMusicianId: input.ownerMusicianId,
          fallbackLabel: input.label,
          leadVocsCount,
          leadVocsSlotByMusicianId,
          genderByLeadVocsSlot: leadVocsGenderBySlot,
        }),
      };
    }
    return input;
  });

  const nonVocalNonTalkbackInputs = finalizedInputs.filter(
    (input) => !isVocalInput(input) && !isTalkbackInput(input),
  );
  const vocalInputs = finalizedInputs
    .filter((input) => isVocalInput(input))
    .sort((a, b) => {
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
  const talkbackInputs = finalizedInputs.filter((input) =>
    isTalkbackInput(input),
  );
  const orderedInputs = [
    ...nonVocalNonTalkbackInputs,
    ...vocalInputs,
    ...talkbackInputs,
  ];

  const stageplanPersonsBySlot = resolveStageplanPersonsBySlot({
    lineupMusicians: ctx.lineupMusicians,
    leadOverlayMembers: leadResolved.map(({ musician }) => musician),
    bandLeaderId: ctx.bandLeaderId,
  });
  const leadVocalStageplanPersons = [
    stageplanPersonsBySlot.lead_voc_1,
    stageplanPersonsBySlot.lead_voc_2,
  ].filter((person): person is StageplanPerson => Boolean(person));

  const inputsWithCh = assignChannelsWithOddStereoRule(orderedInputs);
  const inputRows = buildInputRows(inputsWithCh);
  const stageplanInputs = inputsWithCh
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
    }));

  // Notes template resolution
  const notesTemplateId = band.notesTemplateRef ?? "notes_default_cs";
  const tpl: NotesTemplate = repo.getNotesTemplate(notesTemplateId);

  const hasWedge = monitors.some((m) => m.kind === "wedge");

  return {
    meta: {
      projectId: project.id,
      bandName: band.name,

      purpose: project.purpose,

      eventDate: project.eventDate,
      eventVenue: project.eventVenue,

      documentDate: project.documentDate,
      note: project.note,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,

      metaLine: buildMetaLine(project),
      logoFile: band.logoFile,
    },

    inputs: inputsWithCh,
    inputRows,

    monitors,

    monitorTableRows,

    notes: {
      inputs: tpl.inputs ?? [],
      monitors: filterNotesMonitors(tpl.monitors ?? [], hasWedge),
    },

    stageplan: {
      lineupByRole,
      leadVocals: leadVocalStageplanPersons,
      inputs: stageplanInputs,
      monitorOutputs: monitorTableRows.map((row) => ({
        no: Number.parseInt(row.no, 10),
        output: row.output,
        note: row.note,
        ownerRole: row.ownerRole,
        ownerMusicianId: row.ownerMusicianId,
      })),
      powerByRole,
    },
  };
}
