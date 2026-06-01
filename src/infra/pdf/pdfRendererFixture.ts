import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { DrumDefinition } from "../../domain/drums/drumDefinition.js";
import type {
  Band,
  Musician,
  NotesTemplate,
  Project,
} from "../../domain/model/types.js";
import { catalogPathsForRoot } from "../storage/catalogPaths.js";

const TEST_DRUM_SETUP: DrumDefinition = {
  kickCount: 1,
  kicks: [{ in: true, out: true }],
  snareCount: 1,
  snares: [{ top: true, bottom: true }],
  hasHiHat: true,
  tomCount: 1,
  floorCount: 1,
  hasOverheads: true,
  pad: { enabled: true, mode: "sfx", channels: "stereo" },
  tracks: { enabled: false },
};

const TEST_BAND: Band = {
  type: "band",
  id: "test-band",
  code: "test",
  name: "Test Band",
  bandLeader: "test-bass",
  defaultLineup: {
    drums: ["test-drums"],
    bass: ["test-bass"],
    guitar: ["test-guitar"],
    keys: ["test-keys"],
    vocs: ["test-vocal"],
  },
  defaultOverlays: {
    leadVocals: ["test-vocal"],
    backVocals: [],
  },
  notesTemplateRef: "notes_default_cs",
};

const TEST_MUSICIANS: Musician[] = [
  {
    id: "test-drums",
    firstName: "Pavel",
    lastName: "Drummer",
    group: "drums",
    presets: [
      { kind: "drum_setup", setup: TEST_DRUM_SETUP },
      { kind: "monitor", ref: "iem_stereo_wired" },
    ],
  },
  {
    id: "test-bass",
    firstName: "Matej",
    lastName: "Bassist",
    group: "bass",
    presets: [
      { kind: "preset", ref: "el_bass_xlr_amp" },
      { kind: "monitor", ref: "iem_stereo_wired" },
    ],
  },
  {
    id: "test-guitar",
    firstName: "Karel",
    lastName: "Guitarist",
    group: "guitar",
    presets: [
      { kind: "preset", ref: "el_guitar_mic" },
      { kind: "monitor", ref: "iem_stereo_wired" },
    ],
  },
  {
    id: "test-keys",
    firstName: "Klara",
    lastName: "Keys",
    group: "keys",
    presets: [
      { kind: "preset", ref: "keys_stereo_jack" },
      { kind: "monitor", ref: "iem_stereo_wired" },
    ],
  },
  {
    id: "test-vocal",
    firstName: "Vera",
    lastName: "Vocal",
    group: "vocs",
    presets: [
      { kind: "preset", ref: "vocal_wired" },
      { kind: "monitor", ref: "iem_stereo_wired" },
    ],
  },
];

const TEST_NOTES_TEMPLATE: NotesTemplate = {
  id: "notes_default_cs",
  lang: "cs",
  inputs: [],
  monitors: [],
};

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function createPdfRendererFixtureRoot(): Promise<string> {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "stagepilot-pdf-renderer-"),
  );
  const paths = catalogPathsForRoot(root);

  await Promise.all([
    fs.mkdir(paths.projects, { recursive: true }),
    fs.mkdir(paths.exports, { recursive: true }),
    fs.mkdir(paths.temp, { recursive: true }),
    fs.mkdir(paths.versions, { recursive: true }),
    fs.mkdir(paths.contacts, { recursive: true }),
  ]);

  await writeJson(path.join(paths.bands, `${TEST_BAND.id}.json`), TEST_BAND);
  await writeJson(
    path.join(paths.templatesNotes, `${TEST_NOTES_TEMPLATE.id}.json`),
    TEST_NOTES_TEMPLATE,
  );

  await Promise.all(
    TEST_MUSICIANS.map((musician) =>
      writeJson(
        path.join(paths.musicians, musician.group, `${musician.id}.json`),
        musician,
      ),
    ),
  );

  return root;
}

export function createPdfRendererFixtureProject(id: string): Project {
  return {
    id,
    bandRef: TEST_BAND.id,
    purpose: "generic",
    documentDate: "2024-01-01",
    lineup: {
      drums: ["test-drums"],
      bass: ["test-bass"],
      guitar: ["test-guitar"],
      keys: ["test-keys"],
      vocs: ["test-vocal"],
    },
    overlays: {
      leadVocals: ["test-vocal"],
      backVocals: [],
      talkback: { mode: "none", ownerId: null },
    },
  };
}
