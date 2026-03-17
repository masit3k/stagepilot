import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("drum input catalog asset", () => {
  it("uses stable canonical catalog id", () => {
    const filePath = resolve(process.cwd(), "data/assets/catalog/inputs/drums.json");
    const catalog = JSON.parse(readFileSync(filePath, "utf-8")) as { id?: string; type?: string; items?: unknown[] };

    expect(catalog.id).toBe("drum-input-catalog");
    expect(catalog.id).not.toBe("drum-input-catalog-v2");
    expect(catalog.type).toBe("input_catalog");
    expect(Array.isArray(catalog.items)).toBe(true);
    expect((catalog.items ?? []).length).toBeGreaterThan(0);
  });
});
