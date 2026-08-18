import { describe, expect, it } from "vitest";
import { addInputRow, removeInputRow, restoreInputRow } from "./toggleInputRow";

describe("removeInputRow", () => {
  it("adds the key to the remove list", () => {
    expect(removeInputRow(undefined, "a").inputs?.remove).toEqual(["a"]);
  });

  it("does not add the same key twice", () => {
    const once = removeInputRow(undefined, "a");
    expect(removeInputRow(once, "a").inputs?.remove).toEqual(["a"]);
  });

  it("drops a channel that was added by the project instead of removing it", () => {
    const added = addInputRow(undefined, { key: "extra", label: "Extra" });
    const removed = removeInputRow(added, "extra");

    expect(removed.inputs?.add ?? []).toEqual([]);
    expect(removed.inputs?.remove ?? []).not.toContain("extra");
  });
});

describe("restoreInputRow", () => {
  it("takes the key back off the remove list", () => {
    const removed = removeInputRow(undefined, "a");
    expect(restoreInputRow(removed, "a").inputs?.remove ?? []).toEqual([]);
  });

  it("leaves other removed keys alone", () => {
    const removed = removeInputRow(removeInputRow(undefined, "a"), "b");
    expect(restoreInputRow(removed, "a").inputs?.remove).toEqual(["b"]);
  });

  // Ruling 1 (task 13 coordination): screen `01` writes a channel it turns
  // off into the legacy `removeKeys` field, not `remove` — see
  // `buildInputsPatchFromTarget` in `pages/shared/setupConstants.ts`. The
  // domain reads both fields as one union (`applyPresetOverride`), so a
  // channel disabled on `01` must still come back when restored from `02`.
  it("also takes the key off the legacy removeKeys list", () => {
    const patch = { inputs: { removeKeys: ["x"] } };
    const restored = restoreInputRow(patch, "x");

    expect(restored.inputs?.remove ?? []).not.toContain("x");
    expect(restored.inputs?.removeKeys ?? []).not.toContain("x");
  });
});

describe("addInputRow", () => {
  it("adds the channel to the add list", () => {
    const patch = addInputRow(undefined, { key: "extra", label: "Extra" });
    expect(patch.inputs?.add).toEqual([{ key: "extra", label: "Extra" }]);
  });

  it("refuses a duplicate key", () => {
    const once = addInputRow(undefined, { key: "extra", label: "Extra" });
    expect(
      addInputRow(once, { key: "extra", label: "Extra" }).inputs?.add,
    ).toHaveLength(1);
  });

  it("keeps the rest of the patch", () => {
    const patch = addInputRow(
      { inputs: { remove: ["gone"] } },
      { key: "extra", label: "Extra" },
    );
    expect(patch.inputs?.remove).toEqual(["gone"]);
  });
});
