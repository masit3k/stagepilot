export type TriggerRect = {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
  readonly width: number;
};

export type ViewportSize = {
  readonly width: number;
  readonly height: number;
};

export type PanelPosition = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly maxHeight: number;
};

export const MIN_PANEL_WIDTH = 260;
const VIEWPORT_MARGIN = 8;
const TRIGGER_GAP = 6;
const MIN_PANEL_HEIGHT = 120;
const MAX_PANEL_HEIGHT = 260;

/**
 * Co? Pozice rozbalovacího panelu `AddMusiciansMultiSelect` z obdélníku
 * spouštěče a velikosti viewportu.
 *
 * Proč ne šířka spouštěče? V řádku sestavy kapely je spouštěč úzký a panel
 * s `overflow: hidden` pak ořízl jména i „Add selected" (dodatek A4.1).
 * Panel je proto aspoň `MIN_PANEL_WIDTH` široký, zarovnaný k pravému okraji
 * spouštěče (ten sedí u pravého okraje karty) a nikdy nevyjede z viewportu.
 * Široký spouštěč (dialog na `01 LINEUP`) dostane přesně svou šířku a levý
 * okraj, jako dřív. Svislá logika je převzatá beze změny.
 *
 * Čistá funkce, aby šla testovat bez DOM (repo nemá jsdom).
 */
export function computeMultiSelectPanelPosition(
  trigger: TriggerRect,
  viewport: ViewportSize,
): PanelPosition {
  const preferredMaxHeight = Math.min(
    MAX_PANEL_HEIGHT,
    Math.round(viewport.height * 0.42),
  );
  const spaceBelow =
    viewport.height - trigger.bottom - TRIGGER_GAP - VIEWPORT_MARGIN;
  const spaceAbove = trigger.top - TRIGGER_GAP - VIEWPORT_MARGIN;
  const opensAbove = spaceBelow < preferredMaxHeight && spaceAbove > spaceBelow;
  const maxHeight = Math.max(
    MIN_PANEL_HEIGHT,
    Math.min(preferredMaxHeight, opensAbove ? spaceAbove : spaceBelow),
  );
  const width = Math.min(
    Math.max(trigger.width, MIN_PANEL_WIDTH),
    viewport.width - 2 * VIEWPORT_MARGIN,
  );
  const left = Math.min(
    Math.max(trigger.right - width, VIEWPORT_MARGIN),
    viewport.width - VIEWPORT_MARGIN - width,
  );
  return {
    left,
    top: opensAbove
      ? Math.max(VIEWPORT_MARGIN, trigger.top - maxHeight - TRIGGER_GAP)
      : trigger.bottom + TRIGGER_GAP,
    width,
    maxHeight,
  };
}
