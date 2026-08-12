import type { DataRepository } from "../../infra/fs/repo.js";
import { parsePersistedDrumDefinition } from "../drums/drumDefinition.js";
import { resolveDrumInputs } from "../drums/resolveDrumInputs.js";
import {
  formatBackVocalPdfLabel,
  formatDocumentHeader,
  formatDrumInputDisplayLabel,
  formatLeadVocalPdfLabel,
  groupActiveDrumInputsByFamily,
} from "../formatters/index.js";
import type { Group } from "../model/groups.js";
import type {
  DocumentHeaderModel,
  DocumentViewModel,
  InputChannel,
  Musician,
  PresetEntity,
  PresetItem,
  PresetOverridePatch,
  Project,
} from "../model/types.js";
import type { MonitorPresetIndex } from "../monitors/getMonitorLabel.js";
import { resolveCanonicalOverlayAssignments } from "../project/resolveProjectAudioAssignments.js";
import { applyPresetOverride } from "../rules/presetOverride.js";
import { resolveEffectiveProjectSetup } from "../setup/resolveEffectiveProjectSetup.js";
import { disambiguateInputKeys } from "./disambiguateInputKeys.js";
import { formatKeysInputInstances } from "./formatKeysInputs.js";
import {
  assignPdfChannels,
  buildPdfInputRows,
} from "./pdf/assignPdfChannels.js";
import {
  GROUP_MONITOR_ORDER,
  buildPdfMonitorRows,
} from "./pdf/buildPdfMonitorRows.js";
import { buildPdfNotes } from "./pdf/buildPdfNotes.js";
import { buildPdfStageplanModel } from "./pdf/buildPdfStageplan.js";
import { buildPdfTalkbackInputs } from "./pdf/buildPdfTalkback.js";
import {
  comparePdfInputs,
  composeFinalPdfInputOrder,
} from "./pdf/pdfOrdering.js";
import { reorderAcousticGuitars } from "./reorderAcousticGuitars.js";
import { resolveDocumentContext } from "./resolveDocumentContext.js";
import { resolveEffectivePresetsForProject } from "./resolveEffectivePresetsForProject.js";

/* ============================================================
 * Helpers
 * ============================================================ */

function buildDocumentHeader(project: Project): DocumentHeaderModel {
  const purpose = project.purpose === "event" ? "event" : "general";
  return formatDocumentHeader({
    purpose,
    eventDate: project.eventDate,
    eventVenue: project.eventVenue,
    documentDate: project.documentDate,
    note: project.note,
    updatedAt: project.updatedAt,
    contentUpdatedAt: project.contentUpdatedAt,
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
    monitoring: { monitorRef: "wedge_foh" as const },
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

    const expanded = expandPresetItem(
      item,
      group,
      repo,
      `while resolving inputs for musician "${musician.id}" (role: ${group})`,
    );
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
 * Preset expansion (correct narrowing by ent.type)
 * ============================================================ */

function expandPresetItem(
  item: PresetItem,
  lineupGroup: Group,
  repo: DataRepository,
  context?: string,
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
      const ent = getPresetForExpansion(repo, item.ref, item.kind, context);

      if (ent.type !== "preset") {
        throw new Error(
          `PresetItem(kind=preset) ref="${item.ref}" points to type="${ent.type}"${context ? ` ${context}` : ""}.`,
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

    case "talkback":
      return [];

    case "monitor":
      return [];
  }
}

function getPresetForExpansion(
  repo: DataRepository,
  ref: string,
  kind: Extract<PresetItem, { kind: "preset" | "talkback" }>["kind"],
  context?: string,
): PresetEntity {
  try {
    return repo.getPreset(ref);
  } catch {
    const label = kind === "talkback" ? "talkback preset" : "preset";
    throw new Error(
      `Missing ${label} reference "${ref}"${context ? ` ${context}` : ""}.`,
    );
  }
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

  const monitorsById: MonitorPresetIndex = {};
  const effectiveSetup = resolveEffectiveProjectSetup({
    project,
    band,
    bandLeaderId: ctx.bandLeaderId,
    getMusicianById: (id) => repo.getMusician(id),
    getPresetByRef: (ref) => repo.getPreset(ref),
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
        kind: monitorEntity.kind,
        supplier: monitorEntity.supplier,
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
  inputs.push(
    ...buildPdfTalkbackInputs({
      talkbackOwnerId: ctx.talkbackOwnerId,
      membersById: ctx.membersById,
      ownerGroupByMusicianId,
      repo,
    }),
  );
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

  const monitorTableRows = buildPdfMonitorRows({
    lineupMusicians: ctx.lineupMusicians,
    effectiveSetupByMusicianId: effectiveSetup.byMusicianId,
    monitorsById,
    repo,
    leadVocsCount,
    leadVocsSlotByMusicianId,
    leadVocsGenderBySlot,
    backVocsCount,
    backVocsSlotByMusicianId,
    backVocsGenderBySlot,
  });

  inputs.sort(comparePdfInputs);

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

  const orderedInputs = composeFinalPdfInputOrder(
    finalizedInputs,
    leadVocsSlotByMusicianId,
    backVocsSlotByMusicianId,
  );

  const inputsWithCh = assignPdfChannels(orderedInputs);
  const inputRows = buildPdfInputRows(inputsWithCh);
  const stageplan = buildPdfStageplanModel({
    lineupMusicians: ctx.lineupMusicians,
    lineup: ctx.lineup,
    project,
    membersById: ctx.membersById,
    bandLeaderId: ctx.bandLeaderId,
    leadOverlayMembers: leadResolved.map(({ musician }) => musician),
    inputsWithCh,
    monitorTableRows,
  });

  // Notes template resolution
  const notesTemplateId = band.notesTemplateRef ?? "notes_default_cs";
  const notes = buildPdfNotes({
    template: repo.getNotesTemplate(notesTemplateId),
    monitors: {
      hasWedge: monitors.some((m) => m.kind === "wedge"),
      hasBandSuppliedIem: monitors.some(
        (m) => m.kind === "iem" && m.supplier === "band",
      ),
      hasFohSuppliedIem: monitors.some(
        (m) => m.kind === "iem" && m.supplier === "foh",
      ),
    },
  });

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
      contentUpdatedAt: project.contentUpdatedAt,

      header: buildDocumentHeader(project),
      logoFile: band.logoFile,
    },

    inputs: inputsWithCh,
    inputRows,

    monitors,

    monitorTableRows,

    notes,

    stageplan,
  };
}
