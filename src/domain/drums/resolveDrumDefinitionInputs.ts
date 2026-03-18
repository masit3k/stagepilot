import type { InputChannel } from "../model/types.js";
import type { DrumDefinition } from "./drumDefinition.js";
import { normalizeDrumDefinition, resolveBackingTrackInput } from "./drumDefinition.js";
import { loadDrumCatalog, type DrumInputCatalogItem } from "./drumInputCatalog.js";
import { validateDrumDefinition } from "./validateDrumDefinition.js";

export function resolveDrumTrackSlots(definition: DrumDefinition): string[] {
  const backingTrack = resolveBackingTrackInput(definition);
  if (!backingTrack) return [];
  return backingTrack.channels === "mono" ? ["tracks_l"] : ["tracks_l", "tracks_r"];
}

export function resolveDrumActiveSlots(definition: DrumDefinition): string[] {
  const slots = new Set<string>();

  const kick1 = definition.kicks[0];
  if (kick1?.out) slots.add("kick_1_out");
  if (kick1?.in) slots.add("kick_1_in");

  if (definition.kickCount >= 2) {
    const kick2 = definition.kicks[1];
    if (kick2?.out) slots.add("kick_2_out");
    if (kick2?.in) slots.add("kick_2_in");
  }

  const snare1 = definition.snares[0];
  if (snare1?.top) slots.add("snare_1_top");
  if (snare1?.bottom) slots.add("snare_1_bottom");

  if (definition.snareCount >= 2) {
    const snare2 = definition.snares[1];
    if (snare2?.top) slots.add("snare_2_top");
    if (snare2?.bottom) slots.add("snare_2_bottom");
  }

  if (definition.snareCount >= 3) {
    const snare3 = definition.snares[2];
    if (snare3?.top) slots.add("snare_3_top");
    if (snare3?.bottom) slots.add("snare_3_bottom");
  }

  if (definition.hasHiHat) slots.add("hihat");

  for (let i = 1; i <= definition.tomCount; i += 1) slots.add(`tom_${i}`);
  for (let i = 1; i <= definition.floorCount; i += 1) slots.add(`floor_${i}`);

  if (definition.hasOverheads) {
    slots.add("overheads_l");
    slots.add("overheads_r");
  }

  if (definition.pad.enabled) {
    if (definition.pad.mode === "sfx" && definition.pad.channels === "mono") {
      slots.add("pad_mono_sfx");
    }
    if (definition.pad.mode === "sfx" && definition.pad.channels === "stereo") {
      slots.add("pad_stereo_sfx_l");
      slots.add("pad_stereo_sfx_r");
    }
    if (definition.pad.mode === "backing") {
      slots.add("pad_stereo_backing_l");
      slots.add("pad_stereo_backing_r");
    }
  }

  resolveDrumTrackSlots(definition).forEach((slot) => slots.add(slot));

  return Array.from(slots);
}

function drumOrderingGroup(item: DrumInputCatalogItem): number {
  if (item.category === "tracks") return 4;
  if (item.category === "pad") return 3;
  return 1;
}

export function orderResolvedDrumInputs(items: DrumInputCatalogItem[]): DrumInputCatalogItem[] {
  return [...items].sort((a, b) => {
    const groupOrder = drumOrderingGroup(a) - drumOrderingGroup(b);
    if (groupOrder !== 0) return groupOrder;
    return a.order - b.order;
  });
}

export function resolveDrumDefinitionInputs(definition: DrumDefinition): InputChannel[] {
  const normalized = normalizeDrumDefinition(definition);
  const errors = validateDrumDefinition(normalized);
  if (errors.length > 0) throw new Error(errors.map((error) => error.message).join(" "));

  const activeSlots = new Set(resolveDrumActiveSlots(normalized));
  const catalog = loadDrumCatalog();

  return orderResolvedDrumInputs(catalog.items.filter((item) => activeSlots.has(item.slot))).map((item) => ({
    key: item.key,
    label: item.label,
    note: item.note,
    group: "drums",
  }));
}
