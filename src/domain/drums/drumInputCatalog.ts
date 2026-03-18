import drumCatalogAsset from "../../../data/assets/catalog/inputs/drums.json";

export const DRUM_INPUT_KEY_ROLE =
  "Stable external catalog key used by integrations and persisted references." as const;
export const DRUM_INPUT_ID_ROLE =
  "Stable item identifier for one concrete catalog row in this asset." as const;
export const DRUM_INPUT_SLOT_ROLE =
  "Resolver slot identifier: active drum slots are matched against this value." as const;

export type DrumInputCategory =
  | "kick"
  | "snare"
  | "hihat"
  | "tom"
  | "floorTom"
  | "overhead"
  | "pad"
  | "tracks";

export type DrumInputCatalogItem = {
  /** @see DRUM_INPUT_KEY_ROLE */
  key: string;
  /** @see DRUM_INPUT_ID_ROLE */
  id: string;
  label: string;
  note: string;
  order: number;
  /** @see DRUM_INPUT_SLOT_ROLE */
  slot: string;
  category?: DrumInputCategory;
  index?: number;
  position?: "in" | "out" | "top" | "bottom";
  side?: "l" | "r";
  mode?: "sfx" | "backing";
  channels?: "mono" | "stereo";
};

export type DrumInputCatalog = {
  type: "input_catalog";
  id: "drum-input-catalog";
  group: "drums";
  items: DrumInputCatalogItem[];
};

export function loadDrumCatalog(): DrumInputCatalog {
  return drumCatalogAsset as DrumInputCatalog;
}

const DRUM_CATALOG = loadDrumCatalog();
const DRUM_CATALOG_BY_KEY = new Map(DRUM_CATALOG.items.map((item) => [item.key, item]));

export function drumRankByResolvedKey(key: string): number {
  return DRUM_CATALOG_BY_KEY.get(key)?.order ?? 500;
}

export function getDrumCatalogItemByKey(key: string): DrumInputCatalogItem | undefined {
  return DRUM_CATALOG_BY_KEY.get(key);
}
