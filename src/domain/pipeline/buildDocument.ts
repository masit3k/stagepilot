import { GROUP_ORDER } from "../model/groups.js";
import type { Group } from "../model/groups.js";
import type {
  DocumentViewModel,
  StageplanInstrumentKey,
  StageplanPerson,
  Musician,
  PresetEntity,
  PresetItem,
  Project,
  InputChannel,
  PresetOverridePatch,
  NotesTemplate,
  NoteLine,
  MetaLineModel,
} from "../model/types.js";
import type { DataRepository } from "../../infra/fs/repo.js";
import { disambiguateInputKeys } from "./disambiguateInputKeys.js";
import { formatKeysInputInstances } from "./formatKeysInputs.js";
import { reorderAcousticGuitars } from "./reorderAcousticGuitars.js";
import { resolveDocumentContext } from "./resolveDocumentContext.js";
import { resolveEffectivePresetsForProject } from "./resolveEffectivePresetsForProject.js";
import { compareInputsForRole } from "../setup/orderInputsForRole.js";
import { resolveEffectiveProjectSetup } from "../setup/resolveEffectiveProjectSetup.js";
import { resolvePowerForStageplan } from "../stageplan/resolvePowerForStageplan.js";
import {
  formatInputListLabel,
  formatInputListNote,
  formatLeadVocalPdfLabel,
  formatDrumInputDisplayLabel,
  formatBackVocalPdfLabel,
  formatMonitorOwnerLabel,
  formatMonitoringLabel,
  formatProjectMetaLine,
  groupActiveDrumInputsByFamily,
  resolveStereoPair,
} from "../formatters/index.js";
import { applyPresetOverride } from "../rules/presetOverride.js";
import { getMonitorLabel, type MonitorPresetIndex } from "../monitors/getMonitorLabel.js";
import {
  drumRankByResolvedKey,
  resolveDrumInputs,
} from "../drums/resolveDrumInputs.js";
import { parsePersistedDrumDefinition } from "../drums/drumDefinition.js";

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
  group: Group;
  note?: string;
  ownerGender?: "m" | "f" | "x";
  ownerRole: Group;
  ownerMusicianId?: string;
};

type BuiltInputWithCh = BuiltInput & { ch: number };

type DisplayRow = {
  no: string;
  label: string;
  note?: string;
};

type MonitorTableRow = { no: string; output: string; note: string; ownerRole: Group; ownerMusicianId: string };

type StageplanSlot = "drums" | "bass" | "guitar" | "keys" | "lead_voc_1" | "lead_voc_2";

function toStageplanPerson(musician: Musician, bandLeaderId: string): StageplanPerson {
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
  const allowedIds = new Set(ctx.overlays[role]);
  const projectOverlays =
    (ctx.project as Project & { overlays?: { leadVocals?: unknown; backVocals?: unknown } }).overlays;
  const raw = Array.isArray(projectOverlays?.[role]) ? projectOverlays[role] : [];
  const slotByMusicianId = new Map<string, number>();

  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const musicianId = typeof (entry as { musicianId?: unknown }).musicianId === "string"
      ? (entry as { musicianId: string }).musicianId.trim()
      : "";
    const rawSlot = (entry as { slot?: unknown }).slot;
    const slot = typeof rawSlot === "number" && Number.isFinite(rawSlot) ? rawSlot : undefined;
    if (!musicianId || !slot || slot <= 0 || !allowedIds.has(musicianId) || slotByMusicianId.has(musicianId)) {
      continue;
    }
    slotByMusicianId.set(musicianId, slot);
  }

  for (const [index, musicianId] of ctx.overlays[role].entries()) {
    if (!slotByMusicianId.has(musicianId)) {
      slotByMusicianId.set(musicianId, index + 1);
    }
  }

  const members = Array.from(slotByMusicianId.entries())
    .map(([musicianId, slot]) => {
      const musician = ctx.membersById.get(musicianId);
      if (!musician) return null;
      return { musician, slot };
    })
    .filter((entry): entry is { musician: Musician; slot: number } => Boolean(entry));
  members.sort((a, b) => a.slot - b.slot);
  return members;
}

function normalizeTalkbackLabel(label: string): string {
  return label.replace(
    /^Talkback\s*(?:[-–—]|\()\s*([^)]+?)\)?$/i,
    (_all, owner: string) => `Talkback (${owner.trim()})`,
  );
}

function resolvePdfMonitorOwners(args: {
  lineupMusicians: Array<{ group: Group; musician: Musician }>;
  effectiveSetupByMusicianId: Map<string, { monitoring: { monitorRef: string; additionalWedgeCount?: number } }>;
}): Array<{ group: Group; musician: Musician }> {
  const { lineupMusicians, effectiveSetupByMusicianId } = args;
  return lineupMusicians.filter(({ musician }) => effectiveSetupByMusicianId.has(musician.id));
}

function orderPdfMonitorOwners(args: {
  owners: Array<{ group: Group; musician: Musician }>;
  leadVocsSlotByMusicianId: Map<string, number>;
}): Array<{ group: Group; musician: Musician }> {
  const { owners, leadVocsSlotByMusicianId } = args;
  const orderRank: Record<Group, number> = {
    guitar: 1,
    vocs: 2,
    keys: 3,
    bass: 4,
    drums: 5,
    talkback: 999,
  };

  return owners
    .map((owner, originalIndex) => ({ owner, originalIndex }))
    .sort((a, b) => {
      const groupRankDiff = (orderRank[a.owner.group] ?? 999) - (orderRank[b.owner.group] ?? 999);
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
  (['drums', 'bass', 'guitar', 'keys'] as const).forEach((slot) => {
    const musician = memberByPrimaryGroup.get(slot);
    if (!musician) return;
    bySlot[slot] = toStageplanPerson(musician, bandLeaderId);
    assigned.add(musician.id);
  });

  const leadCandidates = leadOverlayMembers.filter((m) => !assigned.has(m.id));
  if (leadCandidates[0]) bySlot.lead_voc_1 = toStageplanPerson(leadCandidates[0], bandLeaderId);
  if (leadCandidates[1]) bySlot.lead_voc_2 = toStageplanPerson(leadCandidates[1], bandLeaderId);
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
      group: item.group,
      note: item.note,
    })),
    monitoring: { monitorRef: "wedge" as const },
  };
  const patched = applyPresetOverride(defaultPreset, patch).inputs;
  return patched.map((input) => ({
    key: input.key,
    label: input.label,
    group: input.group ?? source[0]?.group ?? "vocs",
    note: input.note,
    ownerRole: source[0]?.ownerRole ?? "vocs",
  }));
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
 * 2) Build display rows (merge stereo except overheads)
 * ============================================================ */

function buildInputRows(inputsWithCh: BuiltInputWithCh[]): DisplayRow[] {
  const sorted = inputsWithCh.slice().sort((a, b) => a.ch - b.ch);
  const rows: DisplayRow[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];

    const stereo = b && b.ch === a.ch + 1 ? resolveStereoPair(a, b) : null;

    if (stereo && stereo.shouldCollapse) {
      const leftLabel = stereo.aSide === "L" ? a.label : b.label;
      const rightLabel = stereo.aSide === "L" ? b.label : a.label;

      rows.push({
        no: `${a.ch}+${b.ch}`,
        label: formatInputListLabel(leftLabel, rightLabel),
        note: formatInputListNote(a.note, 2),
      });
      i++;
      continue;
    }

    rows.push({
      no: String(a.ch),
      label: a.label,
      note: a.note,
    });
  }

  return rows;
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
      const definition = parsePersistedDrumDefinition(item.setup, "musician drum_setup preset");
      return resolveDrumInputs(definition).map((ch) => ({
        key: ch.key,
        label: ch.label,
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
        group: ch.group ?? lineupGroup,
        note: ch.note,
        ownerRole: lineupGroup,
      }));
    }

    case "vocal": {
      const ent: PresetEntity = repo.getPreset(item.ref);
      if (ent.type !== "vocal_type") {
        throw new Error(
          `PresetItem(kind=vocal) ref="${item.ref}" points to type="${ent.type}"`,
        );
      }

      return [
        {
          key: ent.input.key.replace("{ownerKey}", item.ownerKey),
          label: ent.input.label
            .replace("{ownerKey}", item.ownerKey)
            .replace("{ownerLabel}", item.ownerLabel ?? item.ownerKey),
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
  return input.key.startsWith("voc_lead");
}

function isBackVocalInput(input: BuiltInput): boolean {
  return input.key.startsWith("voc_back_");
}

function isVocalInput(input: BuiltInput): boolean {
  return isLeadVocalInput(input) || isBackVocalInput(input);
}

function isTalkbackInput(input: BuiltInput): boolean {
  return input.group === "talkback" || input.key.startsWith("tb_");
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

  const effectivePresetItemsByMusicianId = new Map<string, PresetItem[]>();
  for (const { group, musician } of ctx.lineupMusicians) {
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
      const monitorEntity = repo.getPreset(effectiveMusicianSetup.monitoring.monitorRef);
      if (monitorEntity.type !== "monitor") {
        throw new Error(`Monitoring ref "${effectiveMusicianSetup.monitoring.monitorRef}" is not a monitor preset.`);
      }
      monitorsById[monitorEntity.id] = { id: monitorEntity.id, label: monitorEntity.label };
      monitors.push({
        id: `${musician.id}:${monitorEntity.id}`,
        label: monitorEntity.label,
        kind: monitorEntity.id === "wedge" ? "wedge" : "iem",
      });
    }

    for (const item of effectivePresetItems) {
      if (group === "drums" && item.kind === "drum_setup") {
        continue;
      }
      if (group === "bass" && item.kind === "preset") {
        const entity = repo.getPreset(item.ref);
        if (entity.type === "preset" && entity.group === "bass") {
          continue;
        }
      }
      if (item.kind === "monitor") {
        continue;
      }

      const expanded = expandPresetItem(item, group, repo);
      if (item.kind === "preset" && /^vocal_lead/i.test(item.ref)) {
        for (const input of expanded) {
          input.ownerGender = musician.gender;
          input.ownerMusicianId = musician.id;
        }
      }
      for (const input of expanded) {
        if (!input.ownerMusicianId) input.ownerMusicianId = musician.id;
      }
      inputs.push(...expanded);
    }

    if ((group === "bass" || group === "drums") && effectiveMusicianSetup) {
      inputs.push(
        ...effectiveMusicianSetup.inputs.map((input) => ({
          key: input.key,
          label: input.label,
          group,
          note: input.note,
          ownerRole: group,
          ownerMusicianId: musician.id,
        })),
      );
    }

    const eventOverride = group === "bass" || group === "drums" ? undefined : ctx.presetOverrideByMusicianId.get(musician.id);
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

  const stageplanRoles: StageplanInstrumentKey[] = ["drums", "bass", "guitar", "keys", "vocs"];
  const lineupByRole: Partial<Record<StageplanInstrumentKey, StageplanPerson>> =
    {};
  for (const role of stageplanRoles) {
    const musician = ctx.lineupMusicians.find((entry) => entry.group === role)?.musician;
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
        throw new Error(`Monitoring ref "${monitorRef}" is not a monitor preset.`);
      }
      monitorsById[monitorEntity.id] = { id: monitorEntity.id, label: monitorEntity.label };
    }
    const label = getMonitorLabel(monitorsById, monitorRef);
    const extra = effective.monitoring.additionalWedgeCount;
    return formatMonitoringLabel(label, extra);
  };

  const leadResolved = resolveOverlaySlots({ ctx, role: "leadVocals" });
  const backResolved = resolveOverlaySlots({ ctx, role: "backVocals" });
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
  const pushRow = (owner: { group: Group; musician: Musician }, output: string) => {
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
        fallbackLabel: owner.musician.group === "vocs" ? "Lead vocal" : owner.musician.group,
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

    const l = a.label.localeCompare(b.label, "en");
    if (l !== 0) return l;

    return a.key.localeCompare(b.key, "en");
  });

  const reorderedInputs = reorderAcousticGuitars(inputs);
  const formattedKeysInputs = formatKeysInputInstances(reorderedInputs);
  const disambiguatedInputs = disambiguateInputKeys(formattedKeysInputs);
  const drumFamilyState = groupActiveDrumInputsByFamily(disambiguatedInputs);
  const finalizedInputs = disambiguatedInputs.map((input) => {
    if (input.group === "drums") {
      return { ...input, label: formatDrumInputDisplayLabel(input, drumFamilyState) };
    }
    if (input.key.startsWith("voc_back_")) {
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
    if (input.key.startsWith("voc_lead")) {
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
      const aSlot = isLeadVocalInput(a)
        ? leadVocsSlotByMusicianId.get(a.ownerMusicianId ?? "")
        : backVocsSlotByMusicianId.get(a.ownerMusicianId ?? "");
      const bSlot = isLeadVocalInput(b)
        ? leadVocsSlotByMusicianId.get(b.ownerMusicianId ?? "")
        : backVocsSlotByMusicianId.get(b.ownerMusicianId ?? "");
      const slotDiff = (aSlot ?? 999) - (bSlot ?? 999);
      if (slotDiff !== 0) return slotDiff;

      const orderByRole: Record<Group, number> = {
        guitar: 1,
        vocs: 2,
        keys: 3,
        bass: 4,
        drums: 5,
        talkback: 999,
      };
      const roleDiff = (orderByRole[a.ownerRole] ?? 999) - (orderByRole[b.ownerRole] ?? 999);
      if (roleDiff !== 0) return roleDiff;

      if (isBackVocalInput(a) && isLeadVocalInput(b)) return -1;
      if (isLeadVocalInput(a) && isBackVocalInput(b)) return 1;

      return a.label.localeCompare(b.label, "en");
    });
  const talkbackInputs = finalizedInputs.filter((input) => isTalkbackInput(input));
  const orderedInputs = [...nonVocalNonTalkbackInputs, ...vocalInputs, ...talkbackInputs];

  const stageplanPersonsBySlot = resolveStageplanPersonsBySlot({
    lineupMusicians: ctx.lineupMusicians,
    leadOverlayMembers: leadResolved.map(({ musician }) => musician),
    bandLeaderId: ctx.bandLeaderId,
  });
  const leadVocalStageplanPersons = [stageplanPersonsBySlot.lead_voc_1, stageplanPersonsBySlot.lead_voc_2]
    .filter((person): person is StageplanPerson => Boolean(person));

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

    // extra field for rendering the monitor table in PDF
    // (keeps backward compatible VM contract)
    ...({ monitorTableRows } as any),

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
