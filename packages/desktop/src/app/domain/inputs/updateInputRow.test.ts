import { describe, expect, it } from "vitest";
import { updateInputRow } from "./updateInputRow";

describe("updateInputRow", () => {
  it("creates the update list when the patch is empty", () => {
    const patch = updateInputRow(undefined, {
      key: "el_bass_di",
      label: "Matěj bass",
    });

    expect(patch.inputs?.update).toEqual([
      { key: "el_bass_di", label: "Matěj bass" },
    ]);
  });

  it("merges into an existing entry for the same key", () => {
    const first = updateInputRow(undefined, {
      key: "el_bass_di",
      label: "Matěj bass",
    });
    const second = updateInputRow(first, {
      key: "el_bass_di",
      note: "Vlastní DI",
    });

    expect(second.inputs?.update).toEqual([
      { key: "el_bass_di", label: "Matěj bass", note: "Vlastní DI" },
    ]);
  });

  it("keeps entries for other keys", () => {
    const first = updateInputRow(undefined, { key: "a", label: "A" });
    const second = updateInputRow(first, { key: "b", label: "B" });

    expect(second.inputs?.update).toHaveLength(2);
  });

  it("drops an entry that no longer changes anything", () => {
    const first = updateInputRow(undefined, { key: "a", label: "A" });
    const cleared = updateInputRow(first, { key: "a", label: undefined });

    expect(cleared.inputs?.update ?? []).toEqual([]);
  });

  it("preserves unrelated parts of the patch", () => {
    const patch = updateInputRow(
      { inputs: { remove: ["gone"] }, monitoring: { monitorRef: "m1" } },
      { key: "a", label: "A" },
    );

    expect(patch.inputs?.remove).toEqual(["gone"]);
    expect(patch.monitoring).toEqual({ monitorRef: "m1" });
  });

  it("does not mutate the incoming patch", () => {
    const original = { inputs: { update: [{ key: "a", label: "A" }] } };
    updateInputRow(original, { key: "a", label: "B" });

    expect(original.inputs.update).toEqual([{ key: "a", label: "A" }]);
  });
});
