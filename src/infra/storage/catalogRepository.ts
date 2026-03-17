import path from "node:path";
import type { Band, Group, LineupValue, Musician, NotesTemplate, PresetEntity, Project } from "../../domain/model/types.js";
import { resolvePresetIdAlias } from "../../domain/model/presetAliases.js";
import { parsePersistedDrumDefinition } from "../../domain/drums/drumDefinition.js";
import { loadJsonFile } from "../fs/loadJson.js";
import { listJsonFiles } from "../fs/loadTree.js";
import { getAllGroupPresetsDir, getMonitorPresetsDir } from "../fs/assetsPaths.js";
import { DATA_ROOT } from "../fs/dataRoot.js";
import { catalogPathsForRoot, resolveStorageRoot } from "./catalogPaths.js";

export interface DataRepository {
  getBand(id: string): Band;
  getMusician(id: string): Musician;
  getProject(id: string): Project;
  getPreset(id: string): PresetEntity;
  getNotesTemplate(id: string): NotesTemplate;
}

export async function loadCatalogRepository(options?: {
  userDataRoot?: string;
  dataRoot?: string;
}): Promise<DataRepository> {
  const userDataRoot = options?.userDataRoot ?? resolveStorageRoot();
  const dataRoot = options?.dataRoot ?? DATA_ROOT;
  const paths = catalogPathsForRoot(userDataRoot);
  const projects = await loadMap<Project>(paths.projects);
  const bands = await loadBandsMap(paths.bands);
  const bandRefs = new Map<string, Band>();
  for (const band of bands.values()) {
    bandRefs.set(band.id, band);
    if (typeof (band as { code?: unknown }).code === "string") {
      bandRefs.set((band as { code: string }).code.trim().toLowerCase(), band);
    }
  }
  const musicians = await loadMusiciansMap(paths.musicians);
  const groupPresets = await loadMap<PresetEntity>(getAllGroupPresetsDir(dataRoot));
  const monitorPresets = await loadMap<PresetEntity>(getMonitorPresetsDir(dataRoot));
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



function assertCanonicalMusicianPresets(musician: Musician): void {
  (musician.presets ?? []).forEach((item, index) => {
    if (item.kind !== "drum_setup") return;
    parsePersistedDrumDefinition(item.setup, `musician ${musician.id} preset[${index}]`);
  });
}

const MUSICIAN_ROLES: Group[] = ["drums", "bass", "guitar", "keys", "vocs", "talkback"];

function isGroup(value: string): value is Group {
  return (MUSICIAN_ROLES as string[]).includes(value);
}

async function loadMusiciansMap(absDir: string): Promise<Map<string, Musician>> {
  const files = await listJsonFiles(absDir);
  const map = new Map<string, Musician>();
  for (const f of files) {
    const musician = await loadJsonFile<Musician>(f);
    const id = musician.id;
    if (typeof id !== "string" || !id.trim()) throw new Error(`Missing or invalid id in: ${f}`);
    if (!isGroup(musician.group)) throw new Error(`Invalid musician group '${String(musician.group)}' in ${f}`);
    const relative = path.relative(absDir, f);
    const roleDir = relative.split(path.sep)[0];
    if (!isGroup(roleDir)) throw new Error(`Musician path must be catalog/musicians/<role>/<id>.json: ${f}`);
    if (roleDir !== musician.group) throw new Error(`Musician group/path mismatch for ${id}: ${roleDir} != ${musician.group}`);
    if (map.has(id)) throw new Error(`Duplicate id ${id} in ${absDir}`);
    assertCanonicalMusicianPresets(musician);
    map.set(id, musician);
  }
  return map;
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
