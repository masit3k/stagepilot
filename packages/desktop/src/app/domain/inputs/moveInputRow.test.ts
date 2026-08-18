import { describe, expect, it } from "vitest";
import {
  type DropTargetRow,
  moveInputRow,
  resolveActiveDropIndex,
} from "./moveInputRow";

describe("moveInputRow", () => {
  it("moves a key down", () => {
    expect(moveInputRow(["a", "b", "c"], "a", 2)).toEqual(["b", "c", "a"]);
  });

  it("moves a key up", () => {
    expect(moveInputRow(["a", "b", "c"], "c", 0)).toEqual(["c", "a", "b"]);
  });

  it("returns the same order when the target is where the key already is", () => {
    expect(moveInputRow(["a", "b", "c"], "b", 1)).toEqual(["a", "b", "c"]);
  });

  it("clamps a target past the end", () => {
    expect(moveInputRow(["a", "b"], "a", 99)).toEqual(["b", "a"]);
  });

  it("clamps a negative target", () => {
    expect(moveInputRow(["a", "b"], "b", -5)).toEqual(["b", "a"]);
  });

  it("returns the input unchanged for an unknown key", () => {
    expect(moveInputRow(["a", "b"], "nonsense", 0)).toEqual(["a", "b"]);
  });

  it("does not mutate the incoming list", () => {
    const keys = ["a", "b", "c"];
    moveInputRow(keys, "a", 2);
    expect(keys).toEqual(["a", "b", "c"]);
  });
});

describe("resolveActiveDropIndex", () => {
  const active = (key: string): DropTargetRow => ({ key, state: "active" });
  const removed = (key: string): DropTargetRow => ({ key, state: "removed" });
  const filler = (key: string): DropTargetRow => ({ key, state: "filler" });

  it("returns the target's position among active rows when the target is active", () => {
    const rows = [active("a"), active("b"), active("c")];
    expect(resolveActiveDropIndex(rows, "c")).toBe(2);
  });

  it("skips a removed row and lands on the next active row", () => {
    const rows = [active("a"), removed("x"), active("b")];
    expect(resolveActiveDropIndex(rows, "x")).toBe(1);
  });

  it("falls back to the end of the active list when a filler row is last", () => {
    const rows = [active("a"), active("b"), filler("spare_ch_1")];
    expect(resolveActiveDropIndex(rows, "spare_ch_1")).toBe(2);
  });

  it("skips a filler row sandwiched between active rows", () => {
    const rows = [active("a"), filler("spare_ch_1"), active("b")];
    expect(resolveActiveDropIndex(rows, "spare_ch_1")).toBe(1);
  });

  it("falls back to the end of the active list when nothing active follows", () => {
    const rows = [active("a"), removed("x")];
    expect(resolveActiveDropIndex(rows, "x")).toBe(1);
  });

  it("falls back to the end of the active list for an unknown key", () => {
    const rows = [active("a"), active("b")];
    expect(resolveActiveDropIndex(rows, "nonsense")).toBe(2);
  });
});
