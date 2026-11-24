import type { Group } from "../model/groups.js";
import type {
  StageplanBlock,
  StageplanBlockSlot,
  StageplanLayout,
} from "../model/types.js";
import { NOMINAL_STAGE } from "./layout/defaultLayout.js";
import { STAGEPLAN_BLOCK_SLOTS } from "./layout/slots.js";

/**
 * Jak vysoké je pásmo jedné řady, jako podíl hloubky pódia. Pevná konstanta v
 * metrech by na plochém pódiu slila celý plán do jedné řady a na hlubokém by
 * rozsekala jednu řadu na pět — pásmo proto škáluje se stejným rozměrem, jako
 * škáluje `buildDefaultLayout` samotné pozice.
 *
 * 15 % z nominální hloubky 8 m dává 1.2 m: víc než šířka pásma, kterou dělá
 * ruční posun bloku o kus dopředu (bicí u Bon Repos), a řádově méně než 4.3 m
 * mezi zadní a přední řadou výchozího rozmístění.
 */
export const ROW_BAND_DEPTH_FRACTION = 0.15;

function slotRank(slot: StageplanBlockSlot): number {
  const index = STAGEPLAN_BLOCK_SLOTS.indexOf(slot);
  return index === -1 ? STAGEPLAN_BLOCK_SLOTS.length : index;
}

/** Zepředu dozadu = klesající y. Shodné pozice rozhodne x a pak slot. */
function compareFrontToBack(a: StageplanBlock, b: StageplanBlock): number {
  if (a.centerYM !== b.centerYM) return b.centerYM - a.centerYM;
  if (a.centerXM !== b.centerXM) return a.centerXM - b.centerXM;
  return slotRank(a.slot) - slotRank(b.slot);
}

/** Zleva doprava = rostoucí x. Shodné pozice rozhodne slot. */
function compareLeftToRight(a: StageplanBlock, b: StageplanBlock): number {
  if (a.centerXM !== b.centerXM) return a.centerXM - b.centerXM;
  return slotRank(a.slot) - slotRank(b.slot);
}

/**
 * Rozdělí bloky na řady: nová řada začíná tam, kde se y odtrhne od předchozího
 * bloku dál než na šířku pásma. Řetězové porovnání se sousedem (ne s prvním
 * blokem řady) drží pásmo jako lokální kritérium — jinak by řada s pěti bloky
 * v mírném oblouku spadla do dvou jen kvůli krajům.
 */
function splitIntoRows(
  blocks: readonly StageplanBlock[],
  rowBandM: number,
): StageplanBlock[][] {
  const rows: StageplanBlock[][] = [];
  let current: StageplanBlock[] = [];

  for (const block of blocks) {
    const previous = current.at(-1);
    if (previous && Math.abs(previous.centerYM - block.centerYM) > rowBandM) {
      rows.push(current);
      current = [];
    }
    current.push(block);
  }
  if (current.length > 0) rows.push(current);

  return rows;
}

/**
 * Pořadí slotů podle jejich skutečné pozice na pódiu — boustrofedonový had:
 * po řadách zepředu dozadu a každá další řada v opačném směru, jako pluh
 * obracející na konci brázdy. Přední řada se čte zleva doprava.
 *
 * Jediný zdroj pravdy pro „pořadí podle stage". Tabulky pevných hodnot na
 * skupinu, které tomu předcházely (`GROUP_MONITOR_ORDER`, `VOC_ORDER`), by se
 * s uživatelovým rozmístěním rozešly hned prvním přetažením bloku.
 */
export function resolveStagePositionOrder(
  layout: StageplanLayout,
): StageplanBlockSlot[] {
  const depthM = layout.stage?.depthM ?? NOMINAL_STAGE.depthM;
  const rowBandM = depthM * ROW_BAND_DEPTH_FRACTION;

  const frontToBack = layout.blocks.slice().sort(compareFrontToBack);

  return splitIntoRows(frontToBack, rowBandM).flatMap((row, rowIndex) => {
    const leftToRight = row.slice().sort(compareLeftToRight);
    const readRightToLeft = rowIndex % 2 === 1;
    const ordered = readRightToLeft ? leftToRight.reverse() : leftToRight;
    return ordered.map((block) => block.slot);
  });
}

/** Totéž jako `resolveStagePositionOrder`, jen jako rank od 1 pro řadicí funkce. */
export function resolveStagePositionRankBySlot(
  layout: StageplanLayout,
): Map<StageplanBlockSlot, number> {
  return new Map(
    resolveStagePositionOrder(layout).map((slot, index) => [slot, index + 1]),
  );
}

/** Talkback nemá blok a v tabulkách patří vždy nakonec, ať je pódium jakékoli. */
export const TALKBACK_POSITION_RANK = 999;

/** Rank slotu, který na pódiu blok nemá — řadí se za všechny, co ho mají. */
export const UNPLACED_POSITION_RANK = 900;

function roleForSlot(slot: StageplanBlockSlot): Group {
  return slot === "lead_voc_1" || slot === "lead_voc_2" ? "vocs" : slot;
}

/**
 * Rank podle pozice, ale klíčovaný **ownership rolí** — v tom tvaru, v jakém ho
 * potřebují tiskové tabulky: monitorové řádky i vokální kanály znají vlastníka
 * jako `Group`, ne jako slot stage planu.
 *
 * Back vokalista vlastní blok nemá (`StageplanBlockSlot` pro něj slot
 * nenabízí), takže jeho pozice = pozice jeho nástrojového bloku — basák
 * zpívající back vokál se řadí tam, kde na pódiu stojí basa. Proto stačí
 * mapovat rank na roli a ne na jednotlivého muzikanta.
 *
 * `vocs` dostane rank prvního lead vokálního bloku; druhý lead vokalista se
 * mezi sebou rozliší svým overlay slotem, tak jako dřív.
 */
export function resolveStagePositionRankByRole(
  layout: StageplanLayout,
): Map<Group, number> {
  const byRole = new Map<Group, number>();
  for (const [slot, rank] of resolveStagePositionRankBySlot(layout)) {
    const role = roleForSlot(slot);
    const existing = byRole.get(role);
    if (existing === undefined || rank < existing) byRole.set(role, rank);
  }
  byRole.set("talkback", TALKBACK_POSITION_RANK);
  return byRole;
}
