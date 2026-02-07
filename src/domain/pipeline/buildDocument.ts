import { GROUP_ORDER, isGroup } from "../model/groups.js";
import type { Group } from "../model/groups.js";
import type {
  DocumentViewModel,
  LineupValue,
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

/* ============================================================
 * Helpers
 * ============================================================ */

function formatDateCZShort(iso: string): string {
  // ISO "YYYY-MM-DD" -> "D. M. YYYY"
  const d = new Date(iso);
  return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`;
}

function buildMetaLine(project: Project): MetaLineModel {
  if (project.purpose === "event") {
    const d = formatDateCZShort(project.eventDate!);
    const v = project.eventVenue!.trim();
    const docDate = formatDateCZShort(project.documentDate);
    return {
      kind: "labeled",
      label: "Datum akce a místo konání:",
      value: `${d}, ${v} (datum aktualizace: ${docDate})`,
    };
  }

  const title = project.title?.trim() || "Stage plan";
  const d = formatDateCZShort(project.documentDate);
  return {
    kind: "plain",
    value: `${title} (datum aktualizace: ${d})`,
  };
}

function groupRank(group: Group): number {
  const i = GROUP_ORDER.indexOf(group);
  return i === -1 ? 999 : i;
}

function normalizeLineupValue(v: LineupValue | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function normalizeWs(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function isSameNote(a?: string, b?: string): boolean {
  return normalizeWs(a ?? "") === normalizeWs(b ?? "");
}

function prefix2x(note?: string): string | undefined {
  const n = normalizeWs(note ?? "");
  if (n === "") return undefined;
  if (/^2x\s+/i.test(n)) return n;
  return `2x ${n}`;
}

function stereoDisplayLabel(leftLabel: string, rightLabel: string): string {
  const clean = (s: string): string => {
    let x = normalizeWs(s);

    // 1) odstraň trailing " L" / " R"
    x = x.replace(/\s+(L|R)\s*$/i, "").trim();

    // 2) sjednoť "(... L)" / "(... R)" na "(...)"
    x = x.replace(/\(([^()]*)\b(L|R)\b([^()]*)\)\s*$/i, "($1$3)");

    // 2b) odstraní mezeru před zavírací závorkou: "(main out )" → "(main out)"
    x = x.replace(/\s+\)/g, ")");

    x = normalizeWs(x);

    // 3) pojistka: " ... L (" – odstraní poslední standalone L/R před závorkou
    x = x.replace(/\s+(L|R)\s*\(/i, " (");

    return normalizeWs(x);
  };

  const l = clean(leftLabel);
  const r = clean(rightLabel);

  if (l !== "" && l === r) return l;
  return l || normalizeWs(leftLabel);
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
 * Drum ordering (by KEY - deterministic)
 * ============================================================ */

function drumRankByKey(input: BuiltInput): number {
  const k = input.key.toLowerCase();

  if (k.startsWith("dr_pad")) return 1000;
  if (k.startsWith("dr_snare_2")) return 900;

  if (k === "dr_kick_out") return 10;
  if (k === "dr_kick_in") return 20;

  if (k === "dr_snare_top") return 30;
  if (k === "dr_snare_bottom") return 40;

  if (k === "dr_hihat") return 50;

  if (k === "dr_tom_1") return 60;
  if (k === "dr_tom_2") return 70;

  if (k === "dr_floor_tom") return 80;

  if (k === "dr_oh_l") return 200;
  if (k === "dr_oh_r") return 210;

  return 500;
}

/* ============================================================
 * Stereo detection (robust for "Sample pad L (main out L)")
 * ============================================================ */

function isOverheadsBase(baseLabel: string): boolean {
  const b = normalizeWs(baseLabel).toLowerCase();
  return b === "overhead" || b === "overheads" || b === "oh";
}

function parseStereoLabel(label: string): { base: string; side: "L" | "R" } | null {
  const s = normalizeWs(label);

  {
    const m = s.match(/^(.*?)\s+(L|R)\s*(?=\(|$)/i);
    if (m) return { base: normalizeWs(m[1]), side: m[2].toUpperCase() as "L" | "R" };
  }

  {
    const m = s.match(/^(.*)\((L|R)\)$/i);
    if (m) return { base: normalizeWs(m[1]), side: m[2].toUpperCase() as "L" | "R" };
  }

  {
    const m = s.match(/^(.*)\s+[-–—]\s*(L|R)\s*$/i);
    if (m) return { base: normalizeWs(m[1]), side: m[2].toUpperCase() as "L" | "R" };
  }

  {
    const m = s.match(/^(.*?)\s+(Left|Right)\s*(?=\(|$)/i);
    if (m) {
      return {
        base: normalizeWs(m[1]),
        side: m[2].toLowerCase() === "left" ? "L" : "R",
      };
    }
  }

  return null;
}

function stereoBaseLabel(a: BuiltInput, b: BuiltInput): { base: string; aSide: "L" | "R" } | null {
  if (a.group !== b.group) return null;
  if (!isSameNote(a.note, b.note)) return null;

  const pa = parseStereoLabel(a.label);
  const pb = parseStereoLabel(b.label);
  if (pa && pb && pa.base === pb.base && pa.side !== pb.side) {
    return { base: pa.base, aSide: pa.side };
  }

  const ka = a.key.toLowerCase();
  const kb = b.key.toLowerCase();
  const aIsL = ka.endsWith("_l");
  const aIsR = ka.endsWith("_r");
  const bIsL = kb.endsWith("_l");
  const bIsR = kb.endsWith("_r");
  if ((aIsL && bIsR) || (aIsR && bIsL)) {
    const base = a.key.replace(/_l$/i, "").replace(/_r$/i, "");
    return { base: base, aSide: aIsL ? "L" : "R" };
  }

  return null;
}

/* ============================================================
 * 1) Assign channels with odd-start stereo (except overheads)
 * ============================================================ */

function assignChannelsWithOddStereoRule(sorted: BuiltInput[]): BuiltInputWithCh[] {
  const out: BuiltInputWithCh[] = [];
  let nextCh = 1;

  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];

    const stereo = b ? stereoBaseLabel(a, b) : null;

    if (stereo) {
      const mustStartOdd = !isOverheadsBase(stereo.base);

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

    const stereo = b && b.ch === a.ch + 1 ? stereoBaseLabel(a, b) : null;

    if (stereo && !isOverheadsBase(stereo.base)) {
      const leftLabel = stereo.aSide === "L" ? a.label : b.label;
      const rightLabel = stereo.aSide === "L" ? b.label : a.label;

      rows.push({
        no: `${a.ch}+${b.ch}`,
        label: stereoDisplayLabel(leftLabel, rightLabel),
        note: prefix2x(a.note),
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
  repo: DataRepository
): BuiltInput[] {
  switch (item.kind) {
    case "preset": {
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

    default:
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

function normalizeLeadLabel(label: string): string {
  return label
    .replace(/\s+\d+\s*(\([^)]+\))?\s*$/i, "")
    .replace(/\s+\([^)]+\)\s*$/i, "")
    .trim();
}

/* ============================================================
 * Public API
 * ============================================================ */

export function buildDocument(project: Project, repo: DataRepository): DocumentViewModel {
  const band = repo.getBand(project.bandRef);

  const inputs: BuiltInput[] = [];
  const monitors: DocumentViewModel["monitors"] = [];

  // Monitor table rows (UI-only). Keep existing `monitors` array semantics (for notes/validation)
  // and expose extra rows for the PDF table without changing the public type.
  type MonitorTableRow = { no: string; output: string; note: string };
  const monitorTableRows: MonitorTableRow[] = [];

  // Cache lineup musicians for monitor ordering logic
  const lineupMusicians: Array<{
    group: Group;
    musician: { id: string; gender?: "m" | "f" | "x"; presets?: PresetItem[] };
  }> = [];

  const lineup = band.defaultLineup ?? {};
  for (const [groupRaw, v] of Object.entries(lineup)) {
    if (!isGroup(groupRaw)) continue;
    const group = groupRaw as Group;

    for (const musicianId of normalizeLineupValue(v as LineupValue)) {
      const musician = repo.getMusician(musicianId);

      lineupMusicians.push({ group, musician });

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

        const expanded = expandPresetItem(item, group, repo);
        if (item.kind === "preset" && /^vocal_lead/i.test(item.ref)) {
          for (const input of expanded) {
            input.ownerGender = musician.gender;
          }
        }
        inputs.push(...expanded);
      }
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

  const pickByGroup = (g: Group): (typeof lineupMusicians)[number]["musician"] | undefined => {
    return lineupMusicians.find((x) => x.group === g)?.musician;
  };

  const guitarM = pickByGroup("guitar");
  const keysM = pickByGroup("keys");
  const bassM = pickByGroup("bass");
  const drumsM = pickByGroup("drums");

  const vocsAll = lineupMusicians.filter((x) => x.group === "vocs").map((x) => x.musician);
  const leads = vocsAll.filter((m) => hasLeadPreset(m));
  const leadResolved = leads.length > 0 ? leads : vocsAll;
  const leadGenders = new Set(leadResolved.map((m) => m.gender).filter(Boolean));
  const leadMixed = leadGenders.size >= 2;
  const leadCount = leadResolved.length;

  const leadLabel = (index: number, gender?: "m" | "f" | "x"): string => {
    const base = "Lead vocal";
    const indexed = leadCount > 1 ? `${base} ${index}` : base;
    if (!leadMixed) return indexed;
    return `${indexed} (${gender ?? "x"})`;
  };

  const pushRow = (output: string, musician?: { presets?: PresetItem[] } | undefined) => {
    monitorTableRows.push({
      no: String(monitorTableRows.length + 1),
      output,
      note: firstMonitorLabel(musician),
    });
  };

  // Base order
  pushRow("Guitar", guitarM);

  leadResolved.forEach((m, index) => {
    pushRow(leadLabel(index + 1, m.gender), m);
  });

  pushRow("Keys", keysM);
  pushRow("Bass", bassM);
  pushRow("Drums", drumsM);

  inputs.sort((a, b) => {
    const g = groupRank(a.group) - groupRank(b.group);
    if (g !== 0) return g;

    if (a.group === "drums" && b.group === "drums") {
      const dr = drumRankByKey(a) - drumRankByKey(b);
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

  const disambiguatedInputs = disambiguateInputKeys(inputs);
  const leadGenderByIndex = leadResolved.map((m) => m.gender);
  const finalizedInputs = disambiguatedInputs.map((input) => {
    if (!input.key.startsWith("voc_lead")) return input;

    const indexMatch = /voc_lead_(\d+)/i.exec(input.key);
    const index = indexMatch ? Number(indexMatch[1]) : 1;
    const base = normalizeLeadLabel(input.label) || "Lead vocal";
    const indexed = leadCount > 1 ? `${base} ${index}` : base;
    const label = leadMixed ? `${indexed} (${leadGenderByIndex[index - 1] ?? "x"})` : indexed;

    return { ...input, label };
  });

  const inputsWithCh = assignChannelsWithOddStereoRule(finalizedInputs);
  const inputRows = buildInputRows(inputsWithCh);

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
      title: project.title,

      metaLine: buildMetaLine(project),
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
  };
}
