import { describe, expect, it } from "vitest";
import { applyManualInputOrder } from "./applyManualInputOrder.js";

type Row = { key: string; group?: string; label?: string; note?: string };

const keys = (rows: Row[]) => rows.map((row) => row.key);
const rows = (...list: string[]): Row[] => list.map((key) => ({ key }));

describe("applyManualInputOrder", () => {
  it("returns the computed order unchanged when there is no manual order", () => {
    const computed = rows("a", "b", "c");

    expect(keys(applyManualInputOrder(computed, undefined))).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(keys(applyManualInputOrder(computed, []))).toEqual(["a", "b", "c"]);
  });

  it("follows the manual order for keys it knows", () => {
    const result = applyManualInputOrder(rows("a", "b", "c"), ["c", "a", "b"]);

    expect(keys(result)).toEqual(["c", "a", "b"]);
  });

  it("ignores manual keys that no longer exist", () => {
    const result = applyManualInputOrder(rows("a", "c"), ["c", "gone", "a"]);

    expect(keys(result)).toEqual(["c", "a"]);
  });

  it("inserts an unknown key after its computed predecessor, not at the end", () => {
    // Vypočtené pořadí a, b, c, d. Ruční pořadí zná d, a, c — b je nový.
    // b následuje po a ve výpočtu, takže patří za a.
    const result = applyManualInputOrder(rows("a", "b", "c", "d"), [
      "d",
      "a",
      "c",
    ]);

    expect(keys(result)).toEqual(["d", "a", "b", "c"]);
  });

  it("puts an unknown key with no known predecessor in front", () => {
    // Vypočtené pořadí new, a, b. Ruční pořadí zná b, a. `new` nemá
    // ve výpočtu žádného známého předchůdce, takže jde na začátek.
    const result = applyManualInputOrder(rows("new", "a", "b"), ["b", "a"]);

    expect(keys(result)).toEqual(["new", "b", "a"]);
  });

  it("keeps several new neighbours in their computed order", () => {
    const result = applyManualInputOrder(rows("a", "n1", "n2", "b"), [
      "b",
      "a",
    ]);

    expect(keys(result)).toEqual(["b", "a", "n1", "n2"]);
  });

  it("lets the manual order cross group boundaries", () => {
    const computed: Row[] = [
      { key: "kick", group: "drums" },
      { key: "bass", group: "bass" },
      { key: "voc", group: "vocs" },
    ];

    const result = applyManualInputOrder(computed, ["voc", "kick", "bass"]);

    expect(keys(result)).toEqual(["voc", "kick", "bass"]);
  });

  it("does not mutate its input", () => {
    const computed = rows("a", "b", "c");

    applyManualInputOrder(computed, ["c", "b", "a"]);

    expect(keys(computed)).toEqual(["a", "b", "c"]);
  });

  it("keeps duplicates in the manual order from duplicating rows", () => {
    const result = applyManualInputOrder(rows("a", "b"), ["b", "b", "a"]);

    expect(keys(result)).toEqual(["b", "a"]);
  });
});
