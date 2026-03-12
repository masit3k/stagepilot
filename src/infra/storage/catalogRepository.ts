import type { Band, LineupValue, Musician, NotesTemplate, PresetEntity, Project } from "../../domain/model/types.js";
import { resolvePresetIdAlias } from "../../domain/model/presetAliases.js";
import { loadJsonFile } from "../fs/loadJson.js";
import { listJsonFiles } from "../fs/loadTree.js";
import { catalogPaths, resolveStorageRoot } from "./catalogPaths.js";

export interface DataRepository {
  getBand(id: string): Band;
  getMusician(id: string): Musician;
  getProject(id: string): Project;
  getPreset(id: string): PresetEntity;
  getNotesTemplate(id: string): NotesTemplate;
}

export async function loadCatalogRepository(userDataRoot = resolveStorageRoot()): Promise<DataRepository> {
  const paths = catalogPaths(userDataRoot);
  const projects = await loadMap<Project>(paths.projects);
  const bands = await loadBandsMap(paths.bands);
  const bandRefs = new Map<string, Band>();
  for (const band of bands.values()) {
    bandRefs.set(band.id, band);
    if (typeof (band as { code?: unknown }).code === "string") {
      bandRefs.set((band as { code: string }).code.trim().toLowerCase(), band);
    }
  }
  const musicians = await loadMap<Musician>(paths.musicians);
  const groupPresets = await loadMap<PresetEntity>(paths.presetsGroups);
  const monitorPresets = await loadMap<PresetEntity>(paths.presetsMonitors);
  const presets = new Map<string, PresetEntity>([...groupPresets, ...monitorPresets]);
  const notesTemplates = await loadMap<NotesTemplate>(paths.templatesNotes);

  return {
    getBand: (id) => {
      const direct = bandRefs.get(id) ?? bandRefs.get(id.trim().toLowerCase());
      if (!direct) throw new Error(`Band not found: ${id}`);
      return direct;
    },
    getMusician: (id) => must(musicians, id, "Musician"),
    getProject: (id) => must(projects, id, "Project"),
    getPreset: (id) => must(presets, resolvePresetIdAlias(id), "PresetEntity"),
    getNotesTemplate: (id) => must(notesTemplates, id, "NotesTemplate"),
  };
}

async function loadBandsMap(absDir: string): Promise<Map<string, Band>> {
  const map = await loadMap<Band>(absDir);
  for (const [id, band] of map.entries()) {
    const defaultLineup = (band.defaultLineup ?? {}) as Record<string, LineupValue | undefined>;
    const leadVocals = defaultLineup.lead_vocs ?? defaultLineup.lead_voc;
    if (leadVocals !== undefined) {
      map.set(id, { ...band, defaultLineup: { ...defaultLineup, vocs: leadVocals } });
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
    if (typeof id !== "string" || !id.trim()) throw new Error(`Missing or invalid id in: ${f}`);
    if (map.has(id)) throw new Error(`Duplicate id ${id} in ${absDir}`);
    map.set(id, obj as T);
  }
  return map;
}

function must<T>(map: Map<string, T>, id: string, kind = "Band"): T {
  const v = map.get(id);
  if (!v) throw new Error(`${kind} not found: ${id}`);
  return v;
}
