import { GROUP_ORDER, isGroup } from "../model/groups.js";
import type { Group } from "../model/groups.js";
import type {
  DocumentViewModel,
  LineupValue,
  StageplanInstrumentKey,
  StageplanPerson,
  Musician,
  PresetEntity,
  PresetItem,
  Project,
  InputChannel,
  NotesTemplate,
  NoteLine,
  MetaLineModel,
} from "../model/types.js";
import type { DataRepository } from "../../infra/fs/repo.js";
import { disambiguateInputKeys } from "./disambiguateInputKeys.js";
import { reorderAcousticGuitars } from "./reorderAcousticGuitars.js";
import { validateBandLeader } from "../rules/validateBandLeader.js";
import { resolveStageplanPerson } from "../stageplan/resolveStageplanPerson.js";
import { resolvePowerForStageplan } from "../stageplan/resolvePowerForStageplan.js";
import {
  formatInputListLabel,
  formatInputListNote,
  formatMonitorLabel,
  formatProjectMetaLine,
  formatVocalLabel,
  resolveStereoPair,
} from "../formatters/index.js";
import { migrateLegacyDrumPresetRefs } from "../drums/drumSetup.js";
import { drumRankByResolvedKey, resolveDrumInputs } from "../drums/resolveDrumInputs.js";

/* ============================================================
 * Helpers
 * ============================================================ */

function buildMetaLine(project: Project): MetaLineModel {
  return formatProjectMetaLine({
    purpose: project.purpose,
    eventDate: project.eventDate,
    eventVenue: project.eventVenue,
    documentDate: project.documentDate,
    note: project.note,
  });
}

function groupRank(group: Group): number {
  const i = GROUP_ORDER.indexOf(group);
  return i === -1 ? 999 : i;
}

function normalizeLineupValue(v: LineupValue | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
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
};

type BuiltInputWithCh = BuiltInput & { ch: number };

type DisplayRow = {
  no: string;
  label: string;
  note?: string;
};

/* ============================================================
 * 1) Assign channels with odd-start stereo (except overheads)
 * ============================================================ */

function assignChannelsWithOddStereoRule(sorted: BuiltInput[]): BuiltInputWithCh[] {
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
  context?: { drummerLegacyRefs?: string[] }
): BuiltInput[] {
  switch (item.kind) {
    case "drum_setup": {
      return resolveDrumInputs(item.setup).map((ch) => ({
        key: ch.key,
        label: ch.label,
        group: ch.group ?? lineupGroup,
        note: ch.note,
      }));
    }

    case "preset": {
      if (lineupGroup === "drums") {
        const legacyDrumRefs = context?.drummerLegacyRefs ?? [];
        if (["standard_9", "standard_10", "sample_pad_mono", "sample_pad_stereo", "snare_2", "effect_snare"].includes(item.ref)) {
          if (!legacyDrumRefs.includes(item.ref)) {
            legacyDrumRefs.push(item.ref);
          }
          return [];
        }
      }

      const ent: PresetEntity = repo.getPreset(item.ref);

      if (ent.type !== "preset" && ent.type !== "kit" && ent.type !== "feature") {
        throw new Error(`PresetItem(kind=preset) ref="${item.ref}" points to type="${ent.type}"`);
      }

      return ent.inputs.map((ch: InputChannel) => ({
        key: ch.key,
        label: ch.label,
        group: ch.group ?? lineupGroup,
        note: ch.note,
      }));
    }

    case "vocal": {
      const ent: PresetEntity = repo.getPreset(item.ref);
      if (ent.type !== "vocal_type") {
        throw new Error(`PresetItem(kind=vocal) ref="${item.ref}" points to type="${ent.type}"`);
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
        },
      ];
    }

    case "talkback": {
      const ent: PresetEntity = repo.getPreset(item.ref);
      if (ent.type !== "talkback_type") {
        throw new Error(`PresetItem(kind=talkback) ref="${item.ref}" points to type="${ent.type}"`);
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

  if (input.key === "voc_lead" || input.key.startsWith("voc_lead_")) return VOC_ORDER.lead;

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

/* ============================================================
 * Public API
 * ============================================================ */

export function buildDocument(project: Project, repo: DataRepository): DocumentViewModel {
  const band = repo.getBand(project.bandRef);
  validateBandLeader(band, repo);
  const legacyStageplanPersons = (band as { stageplanPersons?: unknown }).stageplanPersons;
  if (legacyStageplanPersons) {
    console.warn(
      `Ignoring legacy stageplanPersons for band "${band.id}". Use defaultLineup/musicians instead.`
    );
  }

  const inputs: BuiltInput[] = [];
  const monitors: DocumentViewModel["monitors"] = [];

  // Monitor table rows (UI-only). Keep existing `monitors` array semantics (for notes/validation)
  // and expose extra rows for the PDF table without changing the public type.
  type MonitorTableRow = { no: string; output: string; note: string };
  const monitorTableRows: MonitorTableRow[] = [];

  // Cache lineup musicians for monitor ordering logic
  const membersById = new Map<string, Musician>();
  const lineupMusicians: Array<{
    group: Group;
    musician: { id: string; gender?: string; presets?: PresetItem[] };
  }> = [];

  const lineup = band.defaultLineup ?? {};
  for (const [groupRaw, v] of Object.entries(lineup)) {
    if (!isGroup(groupRaw)) continue;
    const group = groupRaw as Group;

    for (const musicianId of normalizeLineupValue(v as LineupValue)) {
      const musician = repo.getMusician(musicianId);

      membersById.set(musicianId, musician);
      lineupMusicians.push({ group, musician });

      const drummerLegacyRefs: string[] = [];
      let hasExplicitDrumSetup = false;
      for (const item of musician.presets ?? []) {
        if (item.kind === "monitor") {
          const ent = repo.getPreset(item.ref);
          if (ent.type !== "monitor") {
            throw new Error(
              `PresetItem(kind=monitor) ref="${item.ref}" points to type="${ent.type}"`
            );
          }

          // Pragmatické pravidlo: wireless=true => IEM, jinak wedge
          const kind = ent.wireless === true ? "iem" : "wedge";
          monitors.push({ id: ent.id, label: ent.label, kind });
          continue;
        }

        const expanded = expandPresetItem(item, group, repo, { drummerLegacyRefs });
        if (item.kind === "drum_setup") hasExplicitDrumSetup = true;
        if (item.kind === "preset" && /^vocal_lead/i.test(item.ref)) {
          for (const input of expanded) {
            input.ownerGender = musician.gender;
          }
        }
        inputs.push(...expanded);
      }

      if (group === "drums" && !hasExplicitDrumSetup && drummerLegacyRefs.length > 0) {
        const resolvedFromLegacy = resolveDrumInputs(migrateLegacyDrumPresetRefs(drummerLegacyRefs));
        inputs.push(
          ...resolvedFromLegacy.map((ch) => ({
            key: ch.key,
            label: ch.label,
            group: ch.group ?? group,
            note: ch.note,
          }))
        );
      }
    }
  }

  const stageplanRoles: StageplanInstrumentKey[] = [
    "drums",
    "bass",
    "guitar",
    "keys",
    "vocs",
  ];
  const lineupByRole: Partial<Record<StageplanInstrumentKey, StageplanPerson>> = {};
  for (const role of stageplanRoles) {
    lineupByRole[role] = resolveStageplanPerson(band, role, membersById);
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
    const power = resolvePowerForStageplan(role, band, project, membersById);
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

  const firstMonitorLabel = (m: { presets?: PresetItem[] } | undefined): string => {
    if (!m) return "";
    const mon = (m.presets ?? []).find((p) => p.kind === "monitor");
    if (!mon) return "";
    const ent = repo.getPreset(mon.ref);
    if (ent.type !== "monitor") return "";
    return ent.label ?? "";
  };

  const hasLeadPreset = (m: { presets?: PresetItem[] } | undefined): boolean => {
    if (!m) return false;
    return (m.presets ?? []).some((p) => p.kind === "preset" && /^vocal_lead/i.test(p.ref));
  };

  const pickByGroup = (g: Group): Musician | undefined => {
    return lineupMusicians.find((x) => x.group === g)?.musician;
  };

  const guitarM = pickByGroup("guitar");
  const keysM = pickByGroup("keys");
  const bassM = pickByGroup("bass");
  const drumsM = pickByGroup("drums");

  const vocsAll = lineupMusicians.filter((x) => x.group === "vocs").map((x) => x.musician);
  const leads = vocsAll.filter((m) => hasLeadPreset(m));
  const leadResolved = leads.length > 0 ? leads : vocsAll;
  const leadVocalStageplanPersons = leadResolved.map((m) => ({
    firstName: m.firstName ?? null,
    isBandLeader: m.id === band.bandLeader,
  }));
  const leadVocalCount = inputs.filter((input) => input.key.startsWith("voc_lead")).length;
  const pushRow = (output: string, musician?: Musician | undefined) => {
    monitorTableRows.push({
      no: String(monitorTableRows.length + 1),
      output,
      note: firstMonitorLabel(musician),
    });
  };

  // Base order
  pushRow(formatMonitorLabel({ kind: "guitar" }, { leadCount: leadResolved.length }), guitarM);

  leadResolved.forEach((m, index) => {
    pushRow(
      formatMonitorLabel({ kind: "lead", index: index + 1, gender: m.gender }, { leadCount: leadResolved.length }),
      m
    );
  });

  pushRow(formatMonitorLabel({ kind: "keys" }, { leadCount: leadResolved.length }), keysM);
  pushRow(formatMonitorLabel({ kind: "bass" }, { leadCount: leadResolved.length }), bassM);
  pushRow(formatMonitorLabel({ kind: "drums" }, { leadCount: leadResolved.length }), drumsM);

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

    const l = a.label.localeCompare(b.label, "en");
    if (l !== 0) return l;

    return a.key.localeCompare(b.key, "en");
  });

  const reorderedInputs = reorderAcousticGuitars(inputs);
  const disambiguatedInputs = disambiguateInputKeys(reorderedInputs);
  const leadGenderByIndex = leadResolved.map((m) => m.gender);
  const finalizedInputs = disambiguatedInputs.map((input) => {
    if (!input.key.startsWith("voc_lead")) return input;

    const indexMatch = /voc_lead_(\d+)/i.exec(input.key);
    const index = indexMatch ? Number(indexMatch[1]) : 1;
    const label = formatVocalLabel({ role: "lead", index, gender: leadGenderByIndex[index - 1], leadCount: leadVocalCount });

    return { ...input, label };
  });

  const inputsWithCh = assignChannelsWithOddStereoRule(finalizedInputs);
  const inputRows = buildInputRows(inputsWithCh);
  const stageplanInputs = inputsWithCh
    .filter((input) => input.label !== "---" && input.key !== "---" && !input.key.startsWith("spare_ch_"))
    .map((input) => ({
      channelNo: input.ch,
      label: input.label,
      group: input.group,
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
      })),
      powerByRole,
    },
  };
}
