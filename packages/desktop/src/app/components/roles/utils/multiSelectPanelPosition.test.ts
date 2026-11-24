import { describe, expect, it } from "vitest";
import {
  MIN_PANEL_WIDTH,
  computeMultiSelectPanelPosition,
} from "./multiSelectPanelPosition";

const VIEWPORT = { width: 1200, height: 800 };

function trigger(left: number, width: number, top = 100, height = 36) {
  return { left, right: left + width, top, bottom: top + height, width };
}

describe("computeMultiSelectPanelPosition", () => {
  it("keeps the left edge and width of a trigger that is wide enough", () => {
    expect(
      computeMultiSelectPanelPosition(trigger(100, 500), VIEWPORT),
    ).toEqual({ left: 100, top: 142, width: 500, maxHeight: 260 });
  });

  it("widens a narrow trigger's panel and aligns it to the trigger's right edge", () => {
    expect(
      computeMultiSelectPanelPosition(trigger(900, 120), VIEWPORT),
    ).toMatchObject({ left: 760, width: MIN_PANEL_WIDTH });
  });

  it("keeps the panel inside the viewport on the left", () => {
    expect(
      computeMultiSelectPanelPosition(trigger(10, 100), VIEWPORT),
    ).toMatchObject({ left: 8, width: MIN_PANEL_WIDTH });
  });

  it("keeps the panel inside the viewport on the right", () => {
    expect(
      computeMultiSelectPanelPosition(trigger(1180, 40), VIEWPORT),
    ).toMatchObject({ left: 932, width: MIN_PANEL_WIDTH });
  });

  it("never gets wider than the viewport", () => {
    expect(
      computeMultiSelectPanelPosition(trigger(20, 120), {
        width: 200,
        height: 800,
      }),
    ).toMatchObject({ left: 8, width: 184 });
  });

  it("opens above the trigger when there is no room below", () => {
    expect(
      computeMultiSelectPanelPosition(trigger(100, 500, 660), VIEWPORT),
    ).toMatchObject({ top: 394, maxHeight: 260 });
  });
});
