import fs from "node:fs/promises";
import path from "node:path";
import { isBackVocalRef } from "../../packages/desktop/src/app/components/roles/utils/backVocs.js";
import { isGroup } from "../../src/domain/model/groups.js";
import type {
  Group,
  Musician,
  PresetItem,
} from "../../src/domain/model/types.js";
import { listJsonFiles } from "../../src/infra/fs/loadTree.js";

type Confidence = "confirmed" | "likely" | "unknown";

export type MusicianClassification =
  | "pure_vocalist"
  | "vocalist_with_instrument"
  | "instrumentalist_with_lead_vocal"
  | "instrumentalist_with_back_vocal"
  | "instrumentalist_only"
  | "ambiguous";

export type ParsedMusician = {
  musicianId: string;
  displayName: string;
  group: string;
  presetRefs: string[];
  hasLeadCapability: boolean;
  hasBackCapability: boolean;
  instrumentCapabilityRefs: string[];
  unknownPresetRefs: string[];
  classification: MusicianClassification;
  confidence: Confidence;
  notes: string[];
};

export type BandLineupAudit = {
  bandId: string;
  bandName: string;
  lineupMembersByGroup: Record<string, string[]>;
  lineupMemberIds: string[];
  selectedLeadVocIds: string[];
  selectedBackVocIds: string[];
  invalidLineupMemberIds: string[];
  invalidLeadSelectionIds: string[];
  invalidBackSelectionIds: string[];
  leadWithoutCapability: string[];
  backWithoutCapability: string[];
  leadOutsideLineup: string[];
  backOutsideLineup: string[];
  lineupLeadCapableMembers: string[];
  lineupBackCapableMembers: string[];
  lineupVocsWithInstrument: string[];
  warnings: string[];
};

export type AuditSummary = {
  totalMusicians: number;
  totalBands: number;
  totalPureVocalists: number;
  totalVocalistsWithInstrument: number;
  totalInstrumentalistsWithLeadCapability: number;
  totalInstrumentalistsWithBackCapability: number;
  totalAmbiguousCases: number;
  totalInvalidBandReferencesOrInconsistencies: number;
  multiLeadBandCount: number;
  leadOutsideVocsBandCount: number;
  bandsWithVocsHavingInstrumentCount: number;
};

export type AuditReport = {
  summary: AuditSummary;
  musicianClassifications: ParsedMusician[];
  bands: BandLineupAudit[];
  leadCapabilityInventory: ParsedMusician[];
  backCapabilityInventory: ParsedMusician[];
  vocalistWithInstrumentCases: ParsedMusician[];
  instrumentalistWithLeadCases: ParsedMusician[];
  conflictsAndAnomalies: string[];
  confirmedFindings: string[];
  likelyFindings: string[];
  unknownFindings: string[];
  reusableLogicNotes: string[];
  recommendation: string[];
};

type PresetRefKind =
  | "lead_vocal"
  | "back_vocal"
  | "talkback"
  | "instrument"
  | "other";

type DataPaths = {
  root: string;
  bandsDir: string;
  musiciansDir: string;
  presetsDirCandidates: string[];
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
  return value.filter((entry) =>
    Boolean(entry && typeof entry === "object"),
  ) as PresetItem[];
}

function extractPresetRef(item: PresetItem): string | undefined {
  if (!("ref" in item)) return undefined;
  return normalizeRef((item as { ref?: unknown }).ref);
}

function classifyPresetRefKind(args: {
  ref: string;
  presetGroupById: LoadedPresetGroupMap;
}): { kind: PresetRefKind; confidence: Confidence } {
  const { ref, presetGroupById } = args;

  if (isLeadVocalRef(ref))
    return { kind: "lead_vocal", confidence: "confirmed" };
  if (isBackVocalRef(ref))
    return { kind: "back_vocal", confidence: "confirmed" };
  if (ref === "talkback" || ref.startsWith("talkback_")) {
    return { kind: "talkback", confidence: "confirmed" };
  }

  const group = presetGroupById.get(ref);
  if (group) {
    if (group === "vocs" || group === "talkback")
      return { kind: "other", confidence: "likely" };
    return { kind: "instrument", confidence: "confirmed" };
  }

  if (ref.includes("vocal") || ref.includes("voc_")) {
    return { kind: "other", confidence: "likely" };
  }

  return { kind: "other", confidence: "unknown" };
}

function normalizeIds(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => normalizeIds(item));
  }

  if (typeof value === "string") {
    const normalized = normalizeRef(value);
    return normalized ? [normalized] : [];
  }

  if (value && typeof value === "object") {
    const normalized = normalizeRef(
      (value as { musicianId?: unknown }).musicianId,
    );
    return normalized ? [normalized] : [];
  }

  return [];
}

function toSortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, "en"));
}

function classifyMusician(args: {
  rawMusician: Record<string, unknown>;
  presetGroupById: LoadedPresetGroupMap;
}): ParsedMusician {
  const { rawMusician, presetGroupById } = args;
  const musicianId = normalizeRef(rawMusician.id) ?? "(missing-id)";
  const group = normalizeRef(rawMusician.group) ?? "(missing-group)";
  const presets = asPresetItems(rawMusician.presets);
  const refs = presets
    .map((item) => extractPresetRef(item))
    .filter((ref): ref is string => Boolean(ref));

  const leadRefs: string[] = [];
  const backRefs: string[] = [];
  const instrumentRefs: string[] = [];
  const unknownRefs: string[] = [];
  let lowestConfidence: Confidence = "confirmed";

  for (const ref of refs) {
    const result = classifyPresetRefKind({ ref, presetGroupById });
    if (result.kind === "lead_vocal") leadRefs.push(ref);
    if (result.kind === "back_vocal") backRefs.push(ref);
    if (result.kind === "instrument") instrumentRefs.push(ref);
    if (result.confidence === "unknown") unknownRefs.push(ref);
    if (result.confidence === "likely" && lowestConfidence === "confirmed")
      lowestConfidence = "likely";
    if (result.confidence === "unknown") lowestConfidence = "unknown";
  }

  const hasLeadCapability = leadRefs.length > 0;
  const hasBackCapability = backRefs.length > 0;
  const hasInstrumentCapability = instrumentRefs.length > 0;

  const notes: string[] = [];
  let classification: MusicianClassification;

  if (group === "vocs") {
    classification = hasInstrumentCapability
      ? "vocalist_with_instrument"
      : "pure_vocalist";
    if (!hasLeadCapability && !hasBackCapability) {
      notes.push("Vocal group member has no explicit vocal preset reference.");
      if (classification === "pure_vocalist") {
        classification = "ambiguous";
      }
    }
  } else {
    if (hasLeadCapability) classification = "instrumentalist_with_lead_vocal";
    else if (hasBackCapability)
      classification = "instrumentalist_with_back_vocal";
    else classification = "instrumentalist_only";
  }

  if (!isGroup(group)) {
    notes.push(`Unknown or invalid group '${group}'.`);
    classification = "ambiguous";
  }

  if (unknownRefs.length > 0) {
    notes.push(
      `Contains unknown preset refs: ${toSortedUnique(unknownRefs).join(", ")}`,
    );
    if (classification !== "ambiguous") classification = "ambiguous";
  }

  if (group !== "vocs" && hasLeadCapability && hasBackCapability) {
    notes.push("Non-vocs member has both lead and back vocal capabilities.");
  }

  return {
    musicianId,
    displayName: displayName(rawMusician),
    group,
    presetRefs: toSortedUnique(refs),
    hasLeadCapability,
    hasBackCapability,
    instrumentCapabilityRefs: toSortedUnique(instrumentRefs),
    unknownPresetRefs: toSortedUnique(unknownRefs),
    classification,
    confidence: lowestConfidence,
    notes,
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
    if (key === "lead_vocs" || key === "lead_voc" || key === "back_vocs")
      continue;
    const ids = toSortedUnique(normalizeIds(value));
    if (ids.length > 0) lineupMembersByGroup[key] = ids;
  }

  const lineupMemberIds = toSortedUnique(
    Object.values(lineupMembersByGroup).flat(),
  );
  const selectedLeadVocIds = toSortedUnique(
    normalizeIds(defaultLineup.lead_vocs).concat(
      normalizeIds(defaultLineup.lead_voc),
    ),
  );
  const selectedBackVocIds = toSortedUnique(
    normalizeIds(defaultLineup.back_vocs),
  );

  const invalidLineupMemberIds = lineupMemberIds.filter(
    (id) => !musiciansById.has(id),
  );
  const invalidLeadSelectionIds = selectedLeadVocIds.filter(
    (id) => !musiciansById.has(id),
  );
  const invalidBackSelectionIds = selectedBackVocIds.filter(
    (id) => !musiciansById.has(id),
  );

  const leadWithoutCapability = selectedLeadVocIds.filter((id) => {
    const musician = musiciansById.get(id);
    return musician ? !musician.hasLeadCapability : false;
  });
  const backWithoutCapability = selectedBackVocIds.filter((id) => {
    const musician = musiciansById.get(id);
    return musician ? !musician.hasBackCapability : false;
  });

  const leadOutsideLineup = selectedLeadVocIds.filter(
    (id) => !lineupMemberIds.includes(id),
  );
  const backOutsideLineup = selectedBackVocIds.filter(
    (id) => !lineupMemberIds.includes(id),
  );

  const lineupLeadCapableMembers = lineupMemberIds.filter(
    (id) => musiciansById.get(id)?.hasLeadCapability,
  );
  const lineupBackCapableMembers = lineupMemberIds.filter(
    (id) => musiciansById.get(id)?.hasBackCapability,
  );

  const lineupVocsWithInstrument = toSortedUnique(
    (lineupMembersByGroup.vocs ?? []).filter((id) => {
      const musician = musiciansById.get(id);
      return musician ? musician.instrumentCapabilityRefs.length > 0 : false;
    }),
  );

  const warnings: string[] = [];
  if (invalidLineupMemberIds.length > 0) {
    warnings.push(
      `Unknown lineup member ids: ${invalidLineupMemberIds.join(", ")}`,
    );
  }
  if (leadOutsideLineup.length > 0) {
    warnings.push(
      `lead_vocs contains members outside lineup: ${leadOutsideLineup.join(", ")}`,
    );
  }
  if (backOutsideLineup.length > 0) {
    warnings.push(
      `back_vocs contains members outside lineup: ${backOutsideLineup.join(", ")}`,
    );
  }
  if (leadWithoutCapability.length > 0) {
    warnings.push(
      `lead_vocs contains members without lead capability: ${leadWithoutCapability.join(", ")}`,
    );
  }
  if (backWithoutCapability.length > 0) {
    warnings.push(
      `back_vocs contains members without back capability: ${backWithoutCapability.join(", ")}`,
    );
  }

  return {
    bandId,
    bandName,
    lineupMembersByGroup,
    lineupMemberIds,
    selectedLeadVocIds,
    selectedBackVocIds,
    invalidLineupMemberIds,
    invalidLeadSelectionIds,
    invalidBackSelectionIds,
    leadWithoutCapability,
    backWithoutCapability,
    leadOutsideLineup,
    backOutsideLineup,
    lineupLeadCapableMembers: toSortedUnique(lineupLeadCapableMembers),
    lineupBackCapableMembers: toSortedUnique(lineupBackCapableMembers),
    lineupVocsWithInstrument,
    warnings,
  };
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
    },
    {
      root,
      bandsDir: path.join(root, "catalog", "bands"),
      musiciansDir: path.join(root, "catalog", "musicians"),
      presetsDirCandidates: [
        path.join(root, "catalog", "presets", "groups"),
        path.join(root, "data", "assets", "presets", "groups"),
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

async function loadPresetGroupMap(
  presetDirs: string[],
): Promise<LoadedPresetGroupMap> {
  const map: LoadedPresetGroupMap = new Map();

  for (const dir of presetDirs) {
    if (!(await pathExists(dir))) continue;
    const files = await listJsonFiles(dir);
    for (const file of files.sort((a, b) => a.localeCompare(b, "en"))) {
      const parsed = JSON.parse(await fs.readFile(file, "utf8")) as Record<
        string,
        unknown
      >;
      const presetId = normalizeRef(parsed.id);
      const group = normalizeRef(parsed.group);
      if (!presetId || !group) continue;
      if (!map.has(presetId)) {
        map.set(presetId, group);
      }
    }
  }

  return map;
}

async function loadJsonRecords(
  dir: string,
): Promise<Record<string, unknown>[]> {
  const files = await listJsonFiles(dir);
  const records: Record<string, unknown>[] = [];

  for (const file of files.sort((a, b) => a.localeCompare(b, "en"))) {
    const parsed = JSON.parse(await fs.readFile(file, "utf8")) as Record<
      string,
      unknown
    >;
    records.push(parsed);
  }

  return records;
}

function buildRecommendation(
  report: Omit<AuditReport, "recommendation">,
): string[] {
  const lines: string[] = [];
  const hasHardConflicts = report.conflictsAndAnomalies.length > 0;
  const hasUnknowns = report.unknownFindings.length > 0;

  if (!hasHardConflicts && !hasUnknowns) {
    lines.push(
      "Current model `group + preset capability + explicit lineup selection` appears sufficient for current dataset without mandatory migration.",
    );
  } else {
    lines.push(
      "Data shows mismatches/unknowns; current model is mostly usable, but migration should be considered only for fields that remove ambiguity.",
    );
  }

  lines.push(
    "If future edit UX requires deterministic defaults, consider adding explicit fields: `primaryDocumentIdentity`, `vocalCapability`, and `defaultVocalFunction`.",
  );

  lines.push(
    "Before any migration, prioritize normalizing invalid band references and documenting canonical lead/back detection conventions.",
  );

  return lines;
}

export async function runUserDataVocalAudit(
  root: string,
): Promise<AuditReport> {
  const paths = await resolveDataPaths(root);
  const presetGroupById = await loadPresetGroupMap(paths.presetsDirCandidates);

  const rawMusicians = await loadJsonRecords(paths.musiciansDir);
  const musicianClassifications = rawMusicians
    .map((rawMusician) => classifyMusician({ rawMusician, presetGroupById }))
    .sort((a, b) => a.musicianId.localeCompare(b.musicianId, "en"));

  const musiciansById = new Map(
    musicianClassifications.map((item) => [item.musicianId, item]),
  );

  const rawBands = await loadJsonRecords(paths.bandsDir);
  const bands = rawBands
    .map((band) => parseBandLineup({ band, musiciansById }))
    .sort((a, b) => a.bandId.localeCompare(b.bandId, "en"));

  const conflictsAndAnomalies = toSortedUnique(
    bands.flatMap((band) => [
      ...band.invalidLineupMemberIds.map(
        (id) => `[${band.bandId}] lineup references unknown musician '${id}'.`,
      ),
      ...band.invalidLeadSelectionIds.map(
        (id) =>
          `[${band.bandId}] lead_vocs references unknown musician '${id}'.`,
      ),
      ...band.invalidBackSelectionIds.map(
        (id) =>
          `[${band.bandId}] back_vocs references unknown musician '${id}'.`,
      ),
      ...band.leadWithoutCapability.map(
        (id) =>
          `[${band.bandId}] lead_vocs member '${id}' has no lead capability.`,
      ),
      ...band.backWithoutCapability.map(
        (id) =>
          `[${band.bandId}] back_vocs member '${id}' has no back capability.`,
      ),
      ...band.leadOutsideLineup.map(
        (id) =>
          `[${band.bandId}] lead_vocs member '${id}' is outside default lineup.`,
      ),
      ...band.backOutsideLineup.map(
        (id) =>
          `[${band.bandId}] back_vocs member '${id}' is outside default lineup.`,
      ),
    ]),
  );

  const ambiguousMusicians = musicianClassifications.filter(
    (musician) => musician.classification === "ambiguous",
  );
  const summary: AuditSummary = {
    totalMusicians: musicianClassifications.length,
    totalBands: bands.length,
    totalPureVocalists: musicianClassifications.filter(
      (m) => m.classification === "pure_vocalist",
    ).length,
    totalVocalistsWithInstrument: musicianClassifications.filter(
      (m) => m.classification === "vocalist_with_instrument",
    ).length,
    totalInstrumentalistsWithLeadCapability: musicianClassifications.filter(
      (m) => m.group !== "vocs" && m.hasLeadCapability,
    ).length,
    totalInstrumentalistsWithBackCapability: musicianClassifications.filter(
      (m) => m.group !== "vocs" && m.hasBackCapability,
    ).length,
    totalAmbiguousCases: ambiguousMusicians.length,
    totalInvalidBandReferencesOrInconsistencies: conflictsAndAnomalies.length,
    multiLeadBandCount: bands.filter(
      (band) => band.selectedLeadVocIds.length > 1,
    ).length,
    leadOutsideVocsBandCount: bands.filter((band) =>
      band.selectedLeadVocIds.some(
        (id) => musiciansById.get(id)?.group !== "vocs",
      ),
    ).length,
    bandsWithVocsHavingInstrumentCount: bands.filter(
      (band) => band.lineupVocsWithInstrument.length > 0,
    ).length,
  };

  const leadCapabilityInventory = musicianClassifications.filter(
    (musician) => musician.hasLeadCapability,
  );
  const backCapabilityInventory = musicianClassifications.filter(
    (musician) => musician.hasBackCapability,
  );
  const vocalistWithInstrumentCases = musicianClassifications.filter(
    (musician) => musician.classification === "vocalist_with_instrument",
  );
  const instrumentalistWithLeadCases = musicianClassifications.filter(
    (musician) => musician.classification === "instrumentalist_with_lead_vocal",
  );

  const confirmedFindings: string[] = [
    "Lead vocal capability detection is convention-based via `vocal_lead_` preset refs (shared with existing desktop helper conventions).",
    "Back vocal capability detection is convention-based via `vocal_back_` preset refs (reused from `isBackVocalRef`).",
    "Band lead/back selections are checked against explicit lineup membership and capability flags.",
  ];

  const likelyFindings: string[] = [];
  if (summary.leadOutsideVocsBandCount > 0) {
    likelyFindings.push(
      `${summary.leadOutsideVocsBandCount} band(s) assign lead vocals to non-vocs members, indicating multi-role performers are a common pattern.`,
    );
  }
  if (summary.bandsWithVocsHavingInstrumentCount > 0) {
    likelyFindings.push(
      `${summary.bandsWithVocsHavingInstrumentCount} band(s) include vocs-group members with instrument capability refs.`,
    );
  }

  const unknownFindings = toSortedUnique(
    musicianClassifications
      .filter((musician) => musician.unknownPresetRefs.length > 0)
      .map(
        (musician) =>
          `${musician.musicianId}: unknown preset refs ${musician.unknownPresetRefs.join(", ")}`,
      ),
  );

  const reusableLogicNotes = [
    "Reused existing helper `isBackVocalRef` from desktop role utilities for back vocal detection convention.",
    "No single shared domain helper currently exists for both lead and back detection in core `src/`; lead detection remains convention-based in multiple places (`vocal_lead_` prefix checks).",
    "Lineup semantics (`lead_vocs` / `back_vocs`) are currently spread between storage loading, setup UI, and project normalization paths.",
  ];

  const baseReport = {
    summary,
    musicianClassifications,
    bands,
    leadCapabilityInventory,
    backCapabilityInventory,
    vocalistWithInstrumentCases,
    instrumentalistWithLeadCases,
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
  const instrumentFlag = m.instrumentCapabilityRefs.length > 0 ? "yes" : "no";
  return `- ${m.musicianId} | ${m.displayName} | group=${m.group} | instrument=${instrumentFlag}`;
}

function printBandSection(band: BandLineupAudit): string[] {
  const lines = [`- ${band.bandId} (${band.bandName})`];
  const groups = Object.entries(band.lineupMembersByGroup)
    .sort(([a], [b]) => a.localeCompare(b, "en"))
    .map(([group, ids]) => `    ${group}: [${ids.join(", ")}]`);
  lines.push("  lineup members:");
  lines.push(...(groups.length > 0 ? groups : ["    (none)"]));
  lines.push(`  selected lead_vocs: [${band.selectedLeadVocIds.join(", ")}]`);
  lines.push(`  selected back_vocs: [${band.selectedBackVocIds.join(", ")}]`);
  if (band.warnings.length === 0) {
    lines.push("  warnings: none");
  } else {
    lines.push("  warnings:");
    for (const warning of band.warnings) {
      lines.push(`    - ${warning}`);
    }
  }
  return lines;
}

export function renderAuditReport(report: AuditReport): string {
  const classificationCounts = report.musicianClassifications.reduce<
    Record<string, number>
  >((acc, item) => {
    acc[item.classification] = (acc[item.classification] ?? 0) + 1;
    return acc;
  }, {});

  const sections: string[] = [];

  sections.push("1) Executive summary");
  sections.push(`- total musicians: ${report.summary.totalMusicians}`);
  sections.push(`- total bands: ${report.summary.totalBands}`);
  sections.push(`- total pure vocalists: ${report.summary.totalPureVocalists}`);
  sections.push(
    `- total vocalists with instrument: ${report.summary.totalVocalistsWithInstrument}`,
  );
  sections.push(
    `- total instrumentalists with lead capability: ${report.summary.totalInstrumentalistsWithLeadCapability}`,
  );
  sections.push(
    `- total instrumentalists with back capability: ${report.summary.totalInstrumentalistsWithBackCapability}`,
  );
  sections.push(
    `- total ambiguous cases: ${report.summary.totalAmbiguousCases}`,
  );
  sections.push(
    `- total invalid band references / inconsistencies: ${report.summary.totalInvalidBandReferencesOrInconsistencies}`,
  );

  sections.push("\n2) Musician classification summary");
  for (const key of Object.keys(classificationCounts).sort((a, b) =>
    a.localeCompare(b, "en"),
  )) {
    sections.push(`- ${key}: ${classificationCounts[key]}`);
  }

  sections.push("\n3) Lead capability inventory");
  for (const item of report.leadCapabilityInventory) {
    sections.push(formatMusician(item));
  }
  if (report.leadCapabilityInventory.length === 0) sections.push("- (none)");

  sections.push("\n4) Back capability inventory");
  for (const item of report.backCapabilityInventory) {
    sections.push(formatMusician(item));
  }
  if (report.backCapabilityInventory.length === 0) sections.push("- (none)");

  sections.push("\n5) Vocalist-with-instrument cases");
  for (const item of report.vocalistWithInstrumentCases) {
    sections.push(formatMusician(item));
  }
  if (report.vocalistWithInstrumentCases.length === 0)
    sections.push("- (none)");

  sections.push("\n6) Instrumentalist-with-lead cases");
  for (const item of report.instrumentalistWithLeadCases) {
    sections.push(formatMusician(item));
  }
  if (report.instrumentalistWithLeadCases.length === 0)
    sections.push("- (none)");

  sections.push("\n7) Band lineup findings");
  for (const band of report.bands) {
    sections.push(...printBandSection(band));
  }
  if (report.bands.length === 0) sections.push("- (none)");

  sections.push("\n8) Conflicts and anomalies");
  if (report.conflictsAndAnomalies.length === 0) {
    sections.push("- none");
  } else {
    for (const line of report.conflictsAndAnomalies) {
      sections.push(`- ${line}`);
    }
  }

  sections.push("\n9) Recommendation section");
  for (const line of report.recommendation) {
    sections.push(`- ${line}`);
  }

  sections.push("\nConfirmed findings");
  for (const line of report.confirmedFindings) {
    sections.push(`- ${line}`);
  }

  sections.push("\nLikely findings");
  if (report.likelyFindings.length === 0) sections.push("- none");
  for (const line of report.likelyFindings) {
    sections.push(`- ${line}`);
  }

  sections.push("\nUnknown / ambiguous findings");
  if (report.unknownFindings.length === 0) sections.push("- none");
  for (const line of report.unknownFindings) {
    sections.push(`- ${line}`);
  }

  sections.push("\nExisting reusable logic notes");
  for (const line of report.reusableLogicNotes) {
    sections.push(`- ${line}`);
  }

  return sections.join("\n");
}
