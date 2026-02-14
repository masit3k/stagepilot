// src/infra/fs/repo.ts
// Co? Načítá JSON data do paměti a poskytuje k nim přístup.
// Proč? Odděluje doménovou logiku od filesystemu (domain si jen říká o entity podle id).

import path from "node:path";
import { DATA_ROOT, USER_DATA_ROOT } from "./dataRoot.js";
import { listJsonFiles } from "./loadTree.js";
import { loadJsonFile } from "./loadJson.js";
import { getAllGroupPresetsDir, getMonitorPresetsDir, getNotesTemplatesDir } from "./assetsPaths.js";

import type {
  Band,
  Musician,
  Project,
  PresetEntity,
  NotesTemplate,
  LineupValue,
} from "../../domain/model/types.js";

export interface DataRepository {
  getBand(id: string): Band;
  getMusician(id: string): Musician;
  getProject(id: string): Project;
  getPreset(id: string): PresetEntity;
  getNotesTemplate(id: string): NotesTemplate;
}

export async function loadRepository(options?: {
  userDataRoot?: string;
  dataRoot?: string;
}): Promise<DataRepository> {
  const userDataRoot = options?.userDataRoot ?? USER_DATA_ROOT;
  const dataRoot = options?.dataRoot ?? DATA_ROOT;

  const projects = await loadMap<Project>(path.join(userDataRoot, "projects"));
  const bands = await loadBandsMap(path.join(dataRoot, "bands"));
  const bandRefs = new Map<string, Band>();
  for (const band of bands.values()) {
    bandRefs.set(band.id, band);
    if (typeof (band as { code?: unknown }).code === "string") {
      bandRefs.set((band as { code: string }).code.trim().toLowerCase(), band);
    }
  }
  const musicians = await loadMap<Musician>(path.join(dataRoot, "musicians"));

  // preset entity = preset | vocal_type | talkback_type | monitor
  const groupPresets = await loadMap<PresetEntity>(getAllGroupPresetsDir(dataRoot));
  const monitorPresets = await loadMap<PresetEntity>(getMonitorPresetsDir(dataRoot));
  const presets = new Map<string, PresetEntity>([...groupPresets, ...monitorPresets]);

  // notes templates
  const notesTemplates = await loadMap<NotesTemplate>(getNotesTemplatesDir(dataRoot));

  return {
    getBand: (id: string) => {
      const byRef = bandRefs.get(id) ?? bandRefs.get(id.trim().toLowerCase());
      if (byRef) return byRef;
      throw new Error(`Band not found: ${id}`);
    },
    getMusician: (id: string) => must(musicians, id, "Musician"),
    getProject: (id: string) => must(projects, id, "Project"),
    getPreset: (id: string) => must(presets, id, "PresetEntity"),
    getNotesTemplate: (id: string) => must(notesTemplates, id, "NotesTemplate"),
  };
}

async function loadBandsMap(absDir: string): Promise<Map<string, Band>> {
  const map = await loadMap<Band>(absDir);
  for (const [id, band] of map.entries()) {
    const defaultLineup = (band.defaultLineup ?? {}) as Record<
      string,
      LineupValue | undefined
    >;
    const leadVocals = defaultLineup.lead_vocs ?? defaultLineup.lead_voc;
    if (leadVocals !== undefined) {
      map.set(id, {
        ...band,
        defaultLineup: {
          ...defaultLineup,
          vocs: leadVocals,
        },
      });
    }
  }
  return map;
}

async function loadMap<T>(absDir: string): Promise<Map<string, T>> {
  const files = await listJsonFiles(absDir);
  const map = new Map<string, T>();

  for (const f of files) {
    const obj = await loadJsonFile<Record<string, unknown>>(f);

    const id = obj.id;
    if (typeof id !== "string" || id.trim() === "") {
      throw new Error(`Missing or invalid "id" in: ${f}`);
    }

    if (map.has(id)) {
      throw new Error(`Duplicate id "${id}" in: ${absDir}`);
    }

    map.set(id, obj as unknown as T);
  }

  return map;
}

function must<T>(map: Map<string, T>, id: string, kind: string): T {
  const v = map.get(id);
  if (!v) throw new Error(`${kind} not found: ${id}`);
  return v;
}
