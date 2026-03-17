import drumCatalogAsset from "../../../data/assets/catalog/inputs/drums.json";

export type DrumInputCatalogItem = {
  /** Stable external/catalog key used by integrations and persisted references. */
  key: string;
  /** Stable asset item identifier for this concrete catalog row. */
  id: string;
  label: string;
  note: string;
  order: number;
  /** Domain resolution identifier matched against resolved drum definition slots. */
  slot: string;
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

export function drumRankByResolvedKey(key: string): number {
  const index = DRUM_CATALOG.items.find((item) => item.key === key)?.order;
  return index ?? 500;
}
