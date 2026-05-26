import { describe, expect, it } from "vitest";
import { formatIndexedLabel } from "./formatIndexedLabel.js";

describe("formatIndexedLabel", () => {
  it("returns base label when total is 1", () => {
    expect(formatIndexedLabel("Keys", 1, 0)).toBe("Keys");
  });

  it("returns base label when total is 0", () => {
    expect(formatIndexedLabel("Keys", 0, 0)).toBe("Keys");
  });

  it("appends 1-based index when total is 2", () => {
    expect(formatIndexedLabel("Keys", 2, 0)).toBe("Keys 1");
    expect(formatIndexedLabel("Keys", 2, 1)).toBe("Keys 2");
  });

  it("appends 1-based index when total is 3", () => {
    expect(formatIndexedLabel("Drums", 3, 0)).toBe("Drums 1");
    expect(formatIndexedLabel("Drums", 3, 1)).toBe("Drums 2");
    expect(formatIndexedLabel("Drums", 3, 2)).toBe("Drums 3");
  });
});
