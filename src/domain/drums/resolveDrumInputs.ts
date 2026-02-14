import type { InputChannel } from "../model/types.js";
import { drumCatalogForSetup } from "./drumCatalog.js";
import type { DrumSetup } from "./drumSetup.js";
import { validateDrumSetup } from "./drumSetup.js";

export function resolveDrumInputs(setup: DrumSetup): InputChannel[] {
  const validationErrors = validateDrumSetup(setup);
  if (validationErrors.length > 0) {
    throw new Error(`Invalid drum setup: ${validationErrors.join(" ")}`);
  }

  const rows = drumCatalogForSetup(setup).map((entry) => ({
    key: entry.key,
    label: entry.label,
    note: entry.note,
    group: "drums" as const,
  }));

  const unique = new Set<string>();
  for (const row of rows) {
    if (unique.has(row.key)) {
      throw new Error(`Duplicate drum key produced by resolver: ${row.key}`);
    }
    unique.add(row.key);
  }

  return rows;
}

const DRUM_KEY_ORDER = [
  "dr_kick_out",
  "dr_kick_in",
  "dr_snare1_top",
  "dr_snare1_bottom",
  "dr_hihat",
  "dr_tom_1",
  "dr_tom_2",
  "dr_tom_3",
  "dr_tom_4",
  "dr_floor_1",
  "dr_floor_2",
  "dr_floor_3",
  "dr_floor_4",
  "dr_oh_l",
  "dr_oh_r",
  "dr_snare2_top",
  "dr_snare3_top",
  "dr_pad_mono_sfx",
  "dr_pad_mono_backing",
  "dr_pad_stereo_sfx_l",
  "dr_pad_stereo_sfx_r",
  "dr_pad_stereo_backing_l",
  "dr_pad_stereo_backing_r",
] as const;

const DRUM_KEY_ORDER_INDEX = new Map<string, number>(DRUM_KEY_ORDER.map((key, index) => [key, index]));

export function drumRankByResolvedKey(key: string): number {
  return DRUM_KEY_ORDER_INDEX.get(key.toLowerCase()) ?? 500;
}
