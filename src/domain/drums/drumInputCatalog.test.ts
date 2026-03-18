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

  it("includes lightweight metadata for resolver and formatting", () => {
    const filePath = resolve(process.cwd(), "data/assets/catalog/inputs/drums.json");
    const catalog = JSON.parse(readFileSync(filePath, "utf-8")) as {
      items: Array<{ key: string; category?: string; index?: number; position?: string; side?: string; mode?: string; channels?: string }>;
    };

    const kick = catalog.items.find((item) => item.key === "dr_kick_1_out");
    const overhead = catalog.items.find((item) => item.key === "dr_oh_l");
    const pad = catalog.items.find((item) => item.key === "dr_pad_stereo_sfx_l");
    const tracks = catalog.items.find((item) => item.key === "dr_tracks_l");

    expect(kick).toMatchObject({ category: "kick", index: 1, position: "out" });
    expect(overhead).toMatchObject({ category: "overhead", side: "l" });
    expect(pad).toMatchObject({ category: "pad", mode: "sfx", channels: "stereo", side: "l" });
    expect(tracks).toMatchObject({ category: "tracks", channels: "stereo", side: "l" });
  });

  it("uses key and slot identity without redundant item id", () => {
    const filePath = resolve(process.cwd(), "data/assets/catalog/inputs/drums.json");
    const catalog = JSON.parse(readFileSync(filePath, "utf-8")) as {
      items: Array<{ key: string; slot: string; id?: unknown }>;
    };

    const first = catalog.items[0];
    expect(typeof first.key).toBe("string");
    expect(typeof first.slot).toBe("string");
    expect("id" in first).toBe(false);
  });
});
