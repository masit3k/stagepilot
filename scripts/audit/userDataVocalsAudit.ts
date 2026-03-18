import fs from "node:fs/promises";
import path from "node:path";
import { isBackVocalRef } from "../../packages/desktop/src/app/components/roles/utils/backVocs.js";
import { isGroup } from "../../src/domain/model/groups.js";
import type { PresetItem } from "../../src/domain/model/types.js";
import { listJsonFiles } from "../../src/infra/fs/loadTree.js";

type Confidence = "confirmed" | "likely" | "unknown";
type CapabilityStrength = "none" | "lead" | "back" | "lead_and_back";
type AnomalySeverity = "conflict" | "warning" | "likely-model-mismatch" | "unknown";

export type MusicianClassification =
  | "pure_vocalist"
  | "vocalist_with_instrument"
  | "instrumentalist_with_lead_vocal"
  | "instrumentalist_with_back_vocal"
  | "instrumentalist_only"
  | "vocalist_only_with_monitoring"
  | "ambiguous";

export type PresetRefKind =
  | "lead_vocal"
  | "back_vocal"
  | "instrument"
  | "monitoring_only"
  | "talkback_utility"
  | "unknown";

export type PresetRuleEvidence = {
  ref: string;
  kind: PresetRefKind;
  confidence: Confidence;
  rule: "preset-catalog" | "monitor-catalog" | "kind-tag" | "naming-heuristic" | "unclassified";
};

export type ParsedMusician = {
  musicianId: string;
  displayName: string;
  group: string;
  presetRefs: string[];
  hasLeadCapability: boolean;
  hasBackCapability: boolean;
  hasInstrumentCapability: boolean;
  instrumentCapabilityKinds: string[];
  instrumentCapabilityRefs: string[];
  hasMonitoringOnlyPresets: boolean;
  monitoringOnlyRefs: string[];
  talkbackOrUtilityRefs: string[];
  unknownPresetRefs: string[];
  likelyPrimaryCategory: MusicianClassification;
  classification: MusicianClassification;
  confidence: Confidence;
  notes: string[];
};

export type VocalSelectionCandidate = {
  id: string;
  displayName: string;
  group: string;
  capability: CapabilityStrength;
  hasInstrumentCapability: boolean;
  reasonTag:
    | "vocs-member-selected-as-lead"
    | "vocs-member-selected-as-back"
    | "non-vocs-selected-outside-lineup"
    | "missing-reference";
  interpretation:
    | "likely-missing-defaultLineup-vocs-membership"
    | "clearly-invalid-reference"
    | "unclear";
};

export type BandLineupAudit = {
  bandId: string;
  bandName: string;
  lineupMembersByGroup: Record<string, string[]>;
  lineupInstrumentMemberIds: string[];
  lineupMemberIds: string[];
  selectedLeadVocIds: string[];
  selectedBackVocIds: string[];
  selectedVocalistIdsUnion: string[];
  vocalistsOutsideLineup: string[];
  invalidLineupMemberIds: string[];
  invalidLeadSelectionIds: string[];
  invalidBackSelectionIds: string[];
  leadWithoutCapability: string[];
  backWithoutCapability: string[];
  lineupLeadCapableMembers: string[];
  lineupBackCapableMembers: string[];
  lineupVocsWithInstrument: string[];
  potentialDefaultLineupVocsCandidates: VocalSelectionCandidate[];
  warnings: string[];
};

export type BandAnomaly = {
  bandId: string;
  severity: AnomalySeverity;
  code:
    | "missing-musician-reference"
    | "selected-vocalist-without-capability"
    | "selected-vocalist-outside-lineup"
    | "likely-missing-defaultLineup-vocs"
    | "outside-lineup-unclear";
  message: string;
};

export type AuditSummary = {
  totalMusicians: number;
  totalBands: number;
  totalPureVocalists: number;
  totalVocalistsWithInstrument: number;
  totalVocalistsOnlyWithMonitoring: number;
  totalInstrumentalistsWithLeadCapability: number;
  totalInstrumentalistsWithBackCapability: number;
  totalAmbiguousCases: number;
  totalAnomalies: number;
  anomalyCountsBySeverity: Record<AnomalySeverity, number>;
  bandsLikelyNeedingDefaultLineupVocs: number;
  bandsWithOutsideLineupSelections: number;
};

export type AuditReport = {
  summary: AuditSummary;
  musicianClassifications: ParsedMusician[];
  bands: BandLineupAudit[];
  bandAnomalies: BandAnomaly[];
  leadCapabilityInventory: ParsedMusician[];
  backCapabilityInventory: ParsedMusician[];
  vocalistWithInstrumentCases: ParsedMusician[];
  instrumentalistWithLeadCases: ParsedMusician[];
  potentialDefaultLineupVocsByBand: Array<{
    bandId: string;
    bandName: string;
    selectedVocalistsOutsideCurrentLineup: VocalSelectionCandidate[];
  }>;
  conflictsAndAnomalies: string[];
  confirmedFindings: string[];
  likelyFindings: string[];
  unknownFindings: string[];
  reusableLogicNotes: string[];
  recommendation: string[];
};

type DataPaths = {
  root: string;
  bandsDir: string;
  musiciansDir: string;
  presetsDirCandidates: string[];
  monitorDirsCandidates: string[];
};

type LoadedPresetGroupMap = Map<string, string>;

function isLeadVocalRef(ref: string): boolean {
  return ref.startsWith("vocal_lead_");
}

function normalizeRef(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function displayName(musician: Record<string, unknown>): string {
  const fullName = normalizeRef(musician.name);
  if (fullName) return fullName;

  const firstName = normalizeRef(musician.firstName);
  const lastName = normalizeRef(musician.lastName);
  if (firstName && lastName) return `${firstName} ${lastName}`;
  if (firstName) return firstName;
  if (lastName) return lastName;
  return "(missing name)";
}

function asPresetItems(value: unknown): PresetItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry) => Boolean(entry && typeof entry === "object")) as PresetItem[];
}

function extractPresetRef(item: PresetItem): string | undefined {
  if (!("ref" in item)) return undefined;
  return normalizeRef((item as { ref?: unknown }).ref);
}

function toSortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, "en"));
}

function classifyPresetRefKind(args: {
  ref: string;
  itemKind?: string;
  presetGroupById: LoadedPresetGroupMap;
  monitorRefs: Set<string>;
}): PresetRuleEvidence {
  const { ref, itemKind, presetGroupById, monitorRefs } = args;

  if (itemKind === "monitor") {
    return { ref, kind: "monitoring_only", confidence: "confirmed", rule: "kind-tag" };
  }
  if (itemKind === "talkback") {
    return { ref, kind: "talkback_utility", confidence: "confirmed", rule: "kind-tag" };
  }

  if (isLeadVocalRef(ref)) return { ref, kind: "lead_vocal", confidence: "confirmed", rule: "naming-heuristic" };
  if (isBackVocalRef(ref)) return { ref, kind: "back_vocal", confidence: "confirmed", rule: "naming-heuristic" };
  if (ref === "talkback" || ref.startsWith("talkback_")) return { ref, kind: "talkback_utility", confidence: "confirmed", rule: "naming-heuristic" };

  if (monitorRefs.has(ref) || ref === "wedge" || ref.startsWith("iem_")) {
    return { ref, kind: "monitoring_only", confidence: monitorRefs.has(ref) ? "confirmed" : "likely", rule: monitorRefs.has(ref) ? "monitor-catalog" : "naming-heuristic" };
  }

  const group = presetGroupById.get(ref);
  if (group) {
    if (group === "vocs") {
      if (ref.includes("lead")) return { ref, kind: "lead_vocal", confidence: "likely", rule: "preset-catalog" };
      if (ref.includes("back")) return { ref, kind: "back_vocal", confidence: "likely", rule: "preset-catalog" };
      return { ref, kind: "unknown", confidence: "likely", rule: "preset-catalog" };
    }
    if (group === "talkback") return { ref, kind: "talkback_utility", confidence: "confirmed", rule: "preset-catalog" };
    return { ref, kind: "instrument", confidence: "confirmed", rule: "preset-catalog" };
  }

  if (
    ref.startsWith("ac_guitar") ||
    ref.startsWith("el_guitar") ||
    ref.startsWith("el_bass") ||
    ref === "keys"
  ) {
    return { ref, kind: "instrument", confidence: "likely", rule: "naming-heuristic" };
  }

  return { ref, kind: "unknown", confidence: "unknown", rule: "unclassified" };
}

function normalizeIds(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap((item) => normalizeIds(item));
  if (typeof value === "string") {
    const normalized = normalizeRef(value);
    return normalized ? [normalized] : [];
  }
  if (value && typeof value === "object") {
    const normalized = normalizeRef((value as { musicianId?: unknown }).musicianId);
    return normalized ? [normalized] : [];
  }
  return [];
}

function classifyMusician(args: {
  rawMusician: Record<string, unknown>;
  presetGroupById: LoadedPresetGroupMap;
  monitorRefs: Set<string>;
}): ParsedMusician {
  const { rawMusician, presetGroupById, monitorRefs } = args;
  const musicianId = normalizeRef(rawMusician.id) ?? "(missing-id)";
  const group = normalizeRef(rawMusician.group) ?? "(missing-group)";
  const presets = asPresetItems(rawMusician.presets);

  const refsWithKind = presets
    .map((item) => {
      const ref = extractPresetRef(item);
      return ref ? { ref, kind: "kind" in item ? normalizeRef((item as { kind?: unknown }).kind) : undefined } : undefined;
    })
    .filter((item): item is { ref: string; kind?: string } => Boolean(item));

  const evidence = refsWithKind.map((item) =>
    classifyPresetRefKind({ ref: item.ref, itemKind: item.kind, presetGroupById, monitorRefs }),
  );

  const leadRefs = evidence.filter((entry) => entry.kind === "lead_vocal").map((entry) => entry.ref);
  const backRefs = evidence.filter((entry) => entry.kind === "back_vocal").map((entry) => entry.ref);
  const instrumentRefs = evidence.filter((entry) => entry.kind === "instrument").map((entry) => entry.ref);
  const monitoringRefs = evidence.filter((entry) => entry.kind === "monitoring_only").map((entry) => entry.ref);
  const talkbackRefs = evidence.filter((entry) => entry.kind === "talkback_utility").map((entry) => entry.ref);
  const unknownRefs = evidence.filter((entry) => entry.kind === "unknown").map((entry) => entry.ref);

  const hasLeadCapability = leadRefs.length > 0;
  const hasBackCapability = backRefs.length > 0;
  const hasInstrumentCapability = instrumentRefs.length > 0;
  const hasMonitoringOnlyPresets = monitoringRefs.length > 0;

  let lowestConfidence: Confidence = "confirmed";
  for (const item of evidence) {
    if (item.confidence === "unknown") {
      lowestConfidence = "unknown";
      break;
    }
    if (item.confidence === "likely" && lowestConfidence === "confirmed") lowestConfidence = "likely";
  }

  const notes: string[] = [];
  let classification: MusicianClassification;

  if (group === "vocs") {
    if (hasInstrumentCapability) classification = "vocalist_with_instrument";
    else if (hasLeadCapability || hasBackCapability) classification = "pure_vocalist";
    else if (hasMonitoringOnlyPresets) classification = "vocalist_only_with_monitoring";
    else classification = "ambiguous";

    if (!hasLeadCapability && !hasBackCapability) {
      notes.push("Vocal group member has no explicit lead/back vocal capability.");
    }
  } else {
    if (hasLeadCapability) classification = "instrumentalist_with_lead_vocal";
    else if (hasBackCapability) classification = "instrumentalist_with_back_vocal";
    else if (hasInstrumentCapability) classification = "instrumentalist_only";
    else classification = "ambiguous";
  }

  if (!isGroup(group)) {
    notes.push(`Unknown or invalid group '${group}'.`);
    classification = "ambiguous";
  }

  if (unknownRefs.length > 0) {
    notes.push(`Contains unknown preset refs: ${toSortedUnique(unknownRefs).join(", ")}`);
    classification = "ambiguous";
  }

  const likelyPrimaryCategory = classification;
  const instrumentKinds = toSortedUnique(
    instrumentRefs.map((ref) => presetGroupById.get(ref)).filter((groupName): groupName is string => Boolean(groupName)),
  );

  return {
    musicianId,
    displayName: displayName(rawMusician),
    group,
    presetRefs: toSortedUnique(refsWithKind.map((item) => item.ref)),
    hasLeadCapability,
    hasBackCapability,
    hasInstrumentCapability,
    instrumentCapabilityKinds: instrumentKinds,
    instrumentCapabilityRefs: toSortedUnique(instrumentRefs),
    hasMonitoringOnlyPresets,
    monitoringOnlyRefs: toSortedUnique(monitoringRefs),
    talkbackOrUtilityRefs: toSortedUnique(talkbackRefs),
    unknownPresetRefs: toSortedUnique(unknownRefs),
    likelyPrimaryCategory,
    classification,
    confidence: lowestConfidence,
    notes,
  };
}

function capabilityStrength(musician: ParsedMusician | undefined): CapabilityStrength {
  if (!musician) return "none";
  if (musician.hasLeadCapability && musician.hasBackCapability) return "lead_and_back";
  if (musician.hasLeadCapability) return "lead";
  if (musician.hasBackCapability) return "back";
  return "none";
}

function classifyOutsideLineupCandidate(args: {
  musicianId: string;
  source: "lead" | "back";
  musiciansById: Map<string, ParsedMusician>;
}): VocalSelectionCandidate {
  const { musicianId, source, musiciansById } = args;
  const musician = musiciansById.get(musicianId);
  if (!musician) {
    return {
      id: musicianId,
      displayName: "(missing musician)",
      group: "(missing)",
      capability: "none",
      hasInstrumentCapability: false,
      reasonTag: "missing-reference",
      interpretation: "clearly-invalid-reference",
    };
  }

  if (musician.group === "vocs") {
    return {
      id: musicianId,
      displayName: musician.displayName,
      group: musician.group,
      capability: capabilityStrength(musician),
      hasInstrumentCapability: musician.hasInstrumentCapability,
      reasonTag: source === "lead" ? "vocs-member-selected-as-lead" : "vocs-member-selected-as-back",
      interpretation: "likely-missing-defaultLineup-vocs-membership",
    };
  }

  return {
    id: musicianId,
    displayName: musician.displayName,
    group: musician.group,
    capability: capabilityStrength(musician),
    hasInstrumentCapability: musician.hasInstrumentCapability,
    reasonTag: "non-vocs-selected-outside-lineup",
    interpretation: "unclear",
  };
}

function parseBandLineup(args: {
  band: Record<string, unknown>;
  musiciansById: Map<string, ParsedMusician>;
}): BandLineupAudit {
  const { band, musiciansById } = args;
  const bandId = normalizeRef(band.id) ?? "(missing-band-id)";
  const bandName = normalizeRef(band.name) ?? bandId;
  const defaultLineup =
    band.defaultLineup && typeof band.defaultLineup === "object"
      ? (band.defaultLineup as Record<string, unknown>)
      : {};

  const lineupMembersByGroup: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(defaultLineup)) {
    if (key === "lead_vocs" || key === "lead_voc" || key === "back_vocs") continue;
    const ids = toSortedUnique(normalizeIds(value));
    if (ids.length > 0) lineupMembersByGroup[key] = ids;
  }

  const lineupMemberIds = toSortedUnique(Object.values(lineupMembersByGroup).flat());
  const lineupInstrumentMemberIds = toSortedUnique(
    Object.entries(lineupMembersByGroup)
      .filter(([group]) => group !== "vocs")
      .flatMap(([, ids]) => ids),
  );

  const selectedLeadVocIds = toSortedUnique(normalizeIds(defaultLineup.lead_vocs).concat(normalizeIds(defaultLineup.lead_voc)));
  const selectedBackVocIds = toSortedUnique(normalizeIds(defaultLineup.back_vocs));
  const selectedVocalistIdsUnion = toSortedUnique([...selectedLeadVocIds, ...selectedBackVocIds]);

  const invalidLineupMemberIds = lineupMemberIds.filter((id) => !musiciansById.has(id));
  const invalidLeadSelectionIds = selectedLeadVocIds.filter((id) => !musiciansById.has(id));
  const invalidBackSelectionIds = selectedBackVocIds.filter((id) => !musiciansById.has(id));

  const leadWithoutCapability = selectedLeadVocIds.filter((id) => {
    const musician = musiciansById.get(id);
    return musician ? !musician.hasLeadCapability : false;
  });
  const backWithoutCapability = selectedBackVocIds.filter((id) => {
    const musician = musiciansById.get(id);
    return musician ? !musician.hasBackCapability : false;
  });

  const vocalistsOutsideLineup = selectedVocalistIdsUnion.filter((id) => !lineupMemberIds.includes(id));

  const lineupLeadCapableMembers = lineupMemberIds.filter((id) => musiciansById.get(id)?.hasLeadCapability);
  const lineupBackCapableMembers = lineupMemberIds.filter((id) => musiciansById.get(id)?.hasBackCapability);

  const lineupVocsWithInstrument = toSortedUnique(
    (lineupMembersByGroup.vocs ?? []).filter((id) => Boolean(musiciansById.get(id)?.hasInstrumentCapability)),
  );

  const candidates = toSortedUnique([
    ...selectedLeadVocIds.filter((id) => vocalistsOutsideLineup.includes(id)),
    ...selectedBackVocIds.filter((id) => vocalistsOutsideLineup.includes(id)),
  ]).map((id) => {
    const isLead = selectedLeadVocIds.includes(id);
    return classifyOutsideLineupCandidate({
      musicianId: id,
      source: isLead ? "lead" : "back",
      musiciansById,
    });
  });

  const warnings: string[] = [];
  if (invalidLineupMemberIds.length > 0) warnings.push(`Unknown lineup member ids: ${invalidLineupMemberIds.join(", ")}`);
  if (vocalistsOutsideLineup.length > 0) warnings.push(`Selected vocalists outside lineup: ${vocalistsOutsideLineup.join(", ")}`);
  if (leadWithoutCapability.length > 0) warnings.push(`lead_vocs contains members without lead capability: ${leadWithoutCapability.join(", ")}`);
  if (backWithoutCapability.length > 0) warnings.push(`back_vocs contains members without back capability: ${backWithoutCapability.join(", ")}`);

  return {
    bandId,
    bandName,
    lineupMembersByGroup,
    lineupInstrumentMemberIds,
    lineupMemberIds,
    selectedLeadVocIds,
    selectedBackVocIds,
    selectedVocalistIdsUnion,
    vocalistsOutsideLineup,
    invalidLineupMemberIds,
    invalidLeadSelectionIds,
    invalidBackSelectionIds,
    leadWithoutCapability,
    backWithoutCapability,
    lineupLeadCapableMembers: toSortedUnique(lineupLeadCapableMembers),
    lineupBackCapableMembers: toSortedUnique(lineupBackCapableMembers),
    lineupVocsWithInstrument,
    potentialDefaultLineupVocsCandidates: candidates,
    warnings,
  };
}

function createBandAnomalies(args: { bands: BandLineupAudit[]; musiciansById: Map<string, ParsedMusician> }): BandAnomaly[] {
  const { bands, musiciansById } = args;
  const anomalies: BandAnomaly[] = [];

  for (const band of bands) {
    for (const id of [...band.invalidLineupMemberIds, ...band.invalidLeadSelectionIds, ...band.invalidBackSelectionIds]) {
      anomalies.push({
        bandId: band.bandId,
        severity: "conflict",
        code: "missing-musician-reference",
        message: `[${band.bandId}] references missing musician '${id}'.`,
      });
    }

    for (const id of band.leadWithoutCapability) {
      anomalies.push({
        bandId: band.bandId,
        severity: "warning",
        code: "selected-vocalist-without-capability",
        message: `[${band.bandId}] lead_vocs member '${id}' has no lead capability.`,
      });
    }
    for (const id of band.backWithoutCapability) {
      anomalies.push({
        bandId: band.bandId,
        severity: "warning",
        code: "selected-vocalist-without-capability",
        message: `[${band.bandId}] back_vocs member '${id}' has no back capability.`,
      });
    }

    for (const candidate of band.potentialDefaultLineupVocsCandidates) {
      if (candidate.interpretation === "clearly-invalid-reference") {
        anomalies.push({
          bandId: band.bandId,
          severity: "conflict",
          code: "selected-vocalist-outside-lineup",
          message: `[${band.bandId}] selected vocalist '${candidate.id}' is outside lineup and missing.`,
        });
        continue;
      }
      if (candidate.interpretation === "likely-missing-defaultLineup-vocs-membership") {
        anomalies.push({
          bandId: band.bandId,
          severity: "likely-model-mismatch",
          code: "likely-missing-defaultLineup-vocs",
          message: `[${band.bandId}] selected vocalist '${candidate.id}' appears to be a valid vocs member outside instrument lineup (likely missing defaultLineup.vocs).`,
        });
        continue;
      }

      const musician = musiciansById.get(candidate.id);
      anomalies.push({
        bandId: band.bandId,
        severity: musician ? "unknown" : "conflict",
        code: "outside-lineup-unclear",
        message: `[${band.bandId}] selected vocalist '${candidate.id}' is outside lineup but not clearly invalid.`,
      });
    }
  }

  return anomalies.sort((a, b) => a.message.localeCompare(b.message, "en"));
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function resolveDataPaths(root: string): Promise<DataPaths> {
  const candidates = [
    {
      root,
      bandsDir: path.join(root, "user_data", "bands"),
      musiciansDir: path.join(root, "user_data", "musicians"),
      presetsDirCandidates: [
        path.join(root, "user_data", "presets", "groups"),
        path.join(root, "data", "assets", "presets", "groups"),
      ],
      monitorDirsCandidates: [
        path.join(root, "user_data", "presets", "monitors"),
        path.join(root, "data", "assets", "presets", "monitors"),
      ],
    },
    {
      root,
      bandsDir: path.join(root, "catalog", "bands"),
      musiciansDir: path.join(root, "catalog", "musicians"),
      presetsDirCandidates: [
        path.join(root, "catalog", "presets", "groups"),
        path.join(root, "data", "assets", "presets", "groups"),
      ],
      monitorDirsCandidates: [
        path.join(root, "catalog", "presets", "monitors"),
        path.join(root, "data", "assets", "presets", "monitors"),
      ],
    },
    {
      root,
      bandsDir: path.join(root, "bands"),
      musiciansDir: path.join(root, "musicians"),
      presetsDirCandidates: [
        path.join(root, "presets", "groups"),
        path.join(root, "data", "assets", "presets", "groups"),
      ],
      monitorDirsCandidates: [
        path.join(root, "presets", "monitors"),
        path.join(root, "data", "assets", "presets", "monitors"),
      ],
    },
  ];

  for (const candidate of candidates) {
    const hasBands = await pathExists(candidate.bandsDir);
    const hasMusicians = await pathExists(candidate.musiciansDir);
    if (hasBands && hasMusicians) return candidate;
  }

  throw new Error(
    `Could not find bands+musicians directories under '${root}'. Tried user_data/, catalog/, and direct bands/musicians layouts.`,
  );
}

async function loadPresetGroupMap(presetDirs: string[]): Promise<LoadedPresetGroupMap> {
  const map: LoadedPresetGroupMap = new Map();

  for (const dir of presetDirs) {
    if (!(await pathExists(dir))) continue;
    const files = await listJsonFiles(dir);
    for (const file of files.sort((a, b) => a.localeCompare(b, "en"))) {
      const parsed = JSON.parse(await fs.readFile(file, "utf8")) as Record<string, unknown>;
      const presetId = normalizeRef(parsed.id);
      const group = normalizeRef(parsed.group);
      if (!presetId || !group) continue;
      if (!map.has(presetId)) map.set(presetId, group);
    }
  }

  return map;
}

async function loadMonitorRefs(monitorDirs: string[]): Promise<Set<string>> {
  const refs = new Set<string>();
  for (const dir of monitorDirs) {
    if (!(await pathExists(dir))) continue;
    const files = await listJsonFiles(dir);
    for (const file of files.sort((a, b) => a.localeCompare(b, "en"))) {
      const parsed = JSON.parse(await fs.readFile(file, "utf8")) as Record<string, unknown>;
      const id = normalizeRef(parsed.id);
      if (id) refs.add(id);
    }
  }
  return refs;
}

async function loadJsonRecords(dir: string): Promise<Record<string, unknown>[]> {
  const files = await listJsonFiles(dir);
  const records: Record<string, unknown>[] = [];

  for (const file of files.sort((a, b) => a.localeCompare(b, "en"))) {
    const parsed = JSON.parse(await fs.readFile(file, "utf8")) as Record<string, unknown>;
    records.push(parsed);
  }

  return records;
}

function buildRecommendation(report: Omit<AuditReport, "recommendation">): string[] {
  const lines: string[] = [];
  const likelyModelMismatch = report.bandAnomalies.filter((entry) => entry.severity === "likely-model-mismatch");
  const hardConflicts = report.bandAnomalies.filter((entry) => entry.severity === "conflict");
  const unresolved = report.bandAnomalies.filter((entry) => entry.severity === "unknown" || entry.severity === "warning");

  if (likelyModelMismatch.length > 0) {
    lines.push(
      `Data supports introducing defaultLineup.vocs: ${report.summary.bandsLikelyNeedingDefaultLineupVocs} band(s) have selected vocalists outside instrument lineup who are valid vocs members with vocal capability.`,
    );
    lines.push(
      `Introducing defaultLineup.vocs would likely remove ${likelyModelMismatch.length} current outside-lineup warning(s) that are model-mismatch rather than invalid data.`,
    );
  } else {
    lines.push("Current data does not show strong evidence that defaultLineup.vocs is needed to explain outside-lineup vocalist selections.");
  }

  if (hardConflicts.length > 0) {
    lines.push(`Hard conflicts remain (${hardConflicts.length}) and must be cleaned independently of any model change.`);
  }

  if (unresolved.length > 0) {
    lines.push(
      `Unclear/warning cases remain (${unresolved.length}), mainly selections without matching capability or non-vocs members outside lineup.`,
    );
  }

  lines.push("No migration is performed by this audit; this is read-only decision support for a potential future defaultLineup.vocs model.");

  return lines;
}

export async function runUserDataVocalAudit(root: string): Promise<AuditReport> {
  const paths = await resolveDataPaths(root);
  const presetGroupById = await loadPresetGroupMap(paths.presetsDirCandidates);
  const monitorRefs = await loadMonitorRefs(paths.monitorDirsCandidates);

  const rawMusicians = await loadJsonRecords(paths.musiciansDir);
  const musicianClassifications = rawMusicians
    .map((rawMusician) => classifyMusician({ rawMusician, presetGroupById, monitorRefs }))
    .sort((a, b) => a.musicianId.localeCompare(b.musicianId, "en"));

  const musiciansById = new Map(musicianClassifications.map((item) => [item.musicianId, item]));

  const rawBands = await loadJsonRecords(paths.bandsDir);
  const bands = rawBands
    .map((band) => parseBandLineup({ band, musiciansById }))
    .sort((a, b) => a.bandId.localeCompare(b.bandId, "en"));

  const bandAnomalies = createBandAnomalies({ bands, musiciansById });
  const conflictsAndAnomalies = bandAnomalies.map((entry) => `[${entry.severity}] ${entry.message}`);

  const ambiguousMusicians = musicianClassifications.filter((musician) => musician.classification === "ambiguous");
  const summary: AuditSummary = {
    totalMusicians: musicianClassifications.length,
    totalBands: bands.length,
    totalPureVocalists: musicianClassifications.filter((m) => m.classification === "pure_vocalist").length,
    totalVocalistsWithInstrument: musicianClassifications.filter((m) => m.classification === "vocalist_with_instrument").length,
    totalVocalistsOnlyWithMonitoring: musicianClassifications.filter((m) => m.classification === "vocalist_only_with_monitoring").length,
    totalInstrumentalistsWithLeadCapability: musicianClassifications.filter((m) => m.group !== "vocs" && m.hasLeadCapability).length,
    totalInstrumentalistsWithBackCapability: musicianClassifications.filter((m) => m.group !== "vocs" && m.hasBackCapability).length,
    totalAmbiguousCases: ambiguousMusicians.length,
    totalAnomalies: bandAnomalies.length,
    anomalyCountsBySeverity: {
      conflict: bandAnomalies.filter((entry) => entry.severity === "conflict").length,
      warning: bandAnomalies.filter((entry) => entry.severity === "warning").length,
      "likely-model-mismatch": bandAnomalies.filter((entry) => entry.severity === "likely-model-mismatch").length,
      unknown: bandAnomalies.filter((entry) => entry.severity === "unknown").length,
    },
    bandsLikelyNeedingDefaultLineupVocs: toSortedUnique(
      bandAnomalies
        .filter((entry) => entry.severity === "likely-model-mismatch")
        .map((entry) => entry.bandId),
    ).length,
    bandsWithOutsideLineupSelections: bands.filter((band) => band.vocalistsOutsideLineup.length > 0).length,
  };

  const leadCapabilityInventory = musicianClassifications.filter((musician) => musician.hasLeadCapability);
  const backCapabilityInventory = musicianClassifications.filter((musician) => musician.hasBackCapability);
  const vocalistWithInstrumentCases = musicianClassifications.filter((musician) => musician.classification === "vocalist_with_instrument");
  const instrumentalistWithLeadCases = musicianClassifications.filter((musician) => musician.classification === "instrumentalist_with_lead_vocal");

  const potentialDefaultLineupVocsByBand = bands.map((band) => ({
    bandId: band.bandId,
    bandName: band.bandName,
    selectedVocalistsOutsideCurrentLineup: band.potentialDefaultLineupVocsCandidates,
  }));

  const confirmedFindings: string[] = [
    "Lead vocal capability uses existing `vocal_lead_` naming convention and back vocal capability reuses shared `isBackVocalRef` logic.",
    "Instrument capability is confirmed from preset catalogs in `presets/groups/*` when preset IDs are present there.",
    "Monitoring-only refs are confirmed via monitor catalog (`presets/monitors/*`) and PresetItem kind=monitor.",
    "Outside-lineup vocalist handling now separates likely model mismatch (group=vocs + vocal capability) from hard invalid references.",
  ];

  const likelyFindings: string[] = [];
  if (summary.bandsLikelyNeedingDefaultLineupVocs > 0) {
    likelyFindings.push(
      `${summary.bandsLikelyNeedingDefaultLineupVocs} band(s) likely need explicit defaultLineup.vocs to represent valid vocal-only members selected in lead/back lists.`,
    );
  }

  const unknownFindings = toSortedUnique(
    musicianClassifications
      .filter((musician) => musician.unknownPresetRefs.length > 0)
      .map((musician) => `${musician.musicianId}: unknown preset refs ${musician.unknownPresetRefs.join(", ")}`),
  );

  const reusableLogicNotes = [
    "Reused existing helper `isBackVocalRef` from desktop role utilities for back vocal detection.",
    "Preset-group and monitor catalogs are read-only sources for classification; heuristics are applied only when no catalog entry exists.",
    "Band analysis keeps existing lineup semantics and adds explicit model-mismatch interpretation without mutating JSON data.",
  ];

  const baseReport = {
    summary,
    musicianClassifications,
    bands,
    bandAnomalies,
    leadCapabilityInventory,
    backCapabilityInventory,
    vocalistWithInstrumentCases,
    instrumentalistWithLeadCases,
    potentialDefaultLineupVocsByBand,
    conflictsAndAnomalies,
    confirmedFindings,
    likelyFindings,
    unknownFindings,
    reusableLogicNotes,
  };

  return {
    ...baseReport,
    recommendation: buildRecommendation(baseReport),
  };
}

function formatMusician(m: ParsedMusician): string {
  return `- ${m.musicianId} | ${m.displayName} | group=${m.group} | lead=${m.hasLeadCapability ? "yes" : "no"} | back=${m.hasBackCapability ? "yes" : "no"} | instrument=${m.hasInstrumentCapability ? "yes" : "no"} | monitoring-only=${m.hasMonitoringOnlyPresets ? "yes" : "no"} | category=${m.likelyPrimaryCategory}`;
}

function printBandSection(band: BandLineupAudit): string[] {
  const lines = [`- ${band.bandId} (${band.bandName})`];
  const groups = Object.entries(band.lineupMembersByGroup)
    .sort(([a], [b]) => a.localeCompare(b, "en"))
    .map(([group, ids]) => `    ${group}: [${ids.join(", ")}]`);

  lines.push("  lineup members:");
  lines.push(...(groups.length > 0 ? groups : ["    (none)"]));
  lines.push(`  instrument lineup member ids: [${band.lineupInstrumentMemberIds.join(", ")}]`);
  lines.push(`  selected lead_vocs: [${band.selectedLeadVocIds.join(", ")}]`);
  lines.push(`  selected back_vocs: [${band.selectedBackVocIds.join(", ")}]`);
  lines.push(`  selected vocalists union: [${band.selectedVocalistIdsUnion.join(", ")}]`);
  lines.push(`  selected vocalists outside lineup: [${band.vocalistsOutsideLineup.join(", ")}]`);

  if (band.warnings.length === 0) lines.push("  warnings: none");
  else {
    lines.push("  warnings:");
    for (const warning of band.warnings) lines.push(`    - ${warning}`);
  }

  return lines;
}

export function renderAuditReport(report: AuditReport): string {
  const classificationCounts = report.musicianClassifications.reduce<Record<string, number>>((acc, item) => {
    acc[item.classification] = (acc[item.classification] ?? 0) + 1;
    return acc;
  }, {});

  const sections: string[] = [];

  sections.push("1) Executive summary");
  sections.push(`- total musicians: ${report.summary.totalMusicians}`);
  sections.push(`- total bands: ${report.summary.totalBands}`);
  sections.push(`- total pure vocalists: ${report.summary.totalPureVocalists}`);
  sections.push(`- total vocalists with instrument: ${report.summary.totalVocalistsWithInstrument}`);
  sections.push(`- total vocalists only with monitoring: ${report.summary.totalVocalistsOnlyWithMonitoring}`);
  sections.push(`- total instrumentalists with lead capability: ${report.summary.totalInstrumentalistsWithLeadCapability}`);
  sections.push(`- total instrumentalists with back capability: ${report.summary.totalInstrumentalistsWithBackCapability}`);
  sections.push(`- total ambiguous cases: ${report.summary.totalAmbiguousCases}`);
  sections.push(`- anomalies total: ${report.summary.totalAnomalies}`);
  sections.push(`- anomalies conflict: ${report.summary.anomalyCountsBySeverity.conflict}`);
  sections.push(`- anomalies warning: ${report.summary.anomalyCountsBySeverity.warning}`);
  sections.push(`- anomalies likely-model-mismatch: ${report.summary.anomalyCountsBySeverity["likely-model-mismatch"]}`);
  sections.push(`- anomalies unknown: ${report.summary.anomalyCountsBySeverity.unknown}`);
  sections.push(`- bands likely needing defaultLineup.vocs: ${report.summary.bandsLikelyNeedingDefaultLineupVocs}`);

  sections.push("\n2) Musician classification summary");
  for (const key of Object.keys(classificationCounts).sort((a, b) => a.localeCompare(b, "en"))) {
    sections.push(`- ${key}: ${classificationCounts[key]}`);
  }

  sections.push("\n3) Lead capability inventory");
  if (report.leadCapabilityInventory.length === 0) sections.push("- (none)");
  for (const item of report.leadCapabilityInventory) sections.push(formatMusician(item));

  sections.push("\n4) Back capability inventory");
  if (report.backCapabilityInventory.length === 0) sections.push("- (none)");
  for (const item of report.backCapabilityInventory) sections.push(formatMusician(item));

  sections.push("\n5) Vocalist-with-instrument cases");
  if (report.vocalistWithInstrumentCases.length === 0) sections.push("- (none)");
  for (const item of report.vocalistWithInstrumentCases) sections.push(formatMusician(item));

  sections.push("\n6) Instrumentalist-with-lead cases");
  if (report.instrumentalistWithLeadCases.length === 0) sections.push("- (none)");
  for (const item of report.instrumentalistWithLeadCases) sections.push(formatMusician(item));

  sections.push("\n7) Band lineup findings");
  if (report.bands.length === 0) sections.push("- (none)");
  for (const band of report.bands) sections.push(...printBandSection(band));

  sections.push("\n8) Potential defaultLineup.vocs candidates by band");
  for (const band of report.potentialDefaultLineupVocsByBand) {
    sections.push(`- ${band.bandId} (${band.bandName})`);
    if (band.selectedVocalistsOutsideCurrentLineup.length === 0) {
      sections.push("  - none");
      continue;
    }
    for (const candidate of band.selectedVocalistsOutsideCurrentLineup) {
      sections.push(
        `  - id=${candidate.id} | name=${candidate.displayName} | group=${candidate.group} | vocal=${candidate.capability} | instrument=${candidate.hasInstrumentCapability ? "yes" : "no"} | reason=${candidate.reasonTag} | interpretation=${candidate.interpretation}`,
      );
    }
  }

  sections.push("\n9) Conflicts, warnings, and model mismatches");
  if (report.bandAnomalies.length === 0) sections.push("- none");
  for (const anomaly of report.bandAnomalies) {
    sections.push(`- [${anomaly.severity}] ${anomaly.message}`);
  }

  sections.push("\n10) Recommendation section");
  for (const line of report.recommendation) sections.push(`- ${line}`);

  sections.push("\nConfirmed findings");
  for (const line of report.confirmedFindings) sections.push(`- ${line}`);

  sections.push("\nLikely findings");
  if (report.likelyFindings.length === 0) sections.push("- none");
  for (const line of report.likelyFindings) sections.push(`- ${line}`);

  sections.push("\nUnknown / ambiguous findings");
  if (report.unknownFindings.length === 0) sections.push("- none");
  for (const line of report.unknownFindings) sections.push(`- ${line}`);

  sections.push("\nExisting reusable logic notes");
  for (const line of report.reusableLogicNotes) sections.push(`- ${line}`);

  return sections.join("\n");
}
