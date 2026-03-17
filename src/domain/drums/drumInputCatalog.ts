import drumCatalogAsset from "../../../data/assets/catalog/inputs/drums.json";

export type DrumInputCatalogItem = {
  key: string;
  id: string;
  label: string;
  note: string;
  order: number;
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
