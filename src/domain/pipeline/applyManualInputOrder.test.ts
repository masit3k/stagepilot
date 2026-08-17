import { describe, expect, it } from "vitest";
import { applyManualInputOrder } from "./applyManualInputOrder.js";

type Row = { key: string; label: string; group: string; note?: string };

const keys = (rows: Row[]) => rows.map((row) => row.key);
const rows = (...list: string[]): Row[] =>
  list.map((key) => ({ key, label: key, group: "bass" }));

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
      { key: "kick", label: "kick", group: "drums" },
      { key: "bass", label: "bass", group: "bass" },
      { key: "voc", label: "voc", group: "vocs" },
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

  it("pulls a stereo partner back next to its pair", () => {
    const computed = [
      { key: "keys_l", label: "Keys L", group: "keys" },
      { key: "keys_r", label: "Keys R", group: "keys" },
      { key: "bass", label: "Bass DI", group: "bass" },
    ];

    // Uživatel protáhl bass mezi L a R.
    const result = applyManualInputOrder(computed, [
      "keys_l",
      "bass",
      "keys_r",
    ]);

    expect(result.map((row) => row.key)).toEqual(["keys_l", "keys_r", "bass"]);
  });

  it("keeps a pair together when the partner was moved in front", () => {
    const computed = [
      { key: "keys_l", label: "Keys L", group: "keys" },
      { key: "keys_r", label: "Keys R", group: "keys" },
      { key: "bass", label: "Bass DI", group: "bass" },
    ];

    const result = applyManualInputOrder(computed, [
      "keys_r",
      "bass",
      "keys_l",
    ]);

    expect(result.map((row) => row.key)).toEqual(["keys_r", "keys_l", "bass"]);
  });

  it("does not join two channels that only look like a pair", () => {
    // Různá poznámka znamená, že to pár není — `resolveStereoPair` je
    // odmítne a pořadí se nesmí měnit.
    const computed = [
      { key: "keys_l", label: "Keys L", group: "keys", note: "DI" },
      { key: "bass", label: "Bass DI", group: "bass" },
      { key: "keys_r", label: "Keys R", group: "keys", note: "mic" },
    ];

    const result = applyManualInputOrder(computed, [
      "keys_l",
      "bass",
      "keys_r",
    ]);

    expect(result.map((row) => row.key)).toEqual(["keys_l", "bass", "keys_r"]);
  });

  it("leaves an unpaired stereo side alone", () => {
    const computed = [
      { key: "keys_l", label: "Keys L", group: "keys" },
      { key: "bass", label: "Bass DI", group: "bass" },
    ];

    const result = applyManualInputOrder(computed, ["bass", "keys_l"]);

    expect(result.map((row) => row.key)).toEqual(["bass", "keys_l"]);
  });
});
