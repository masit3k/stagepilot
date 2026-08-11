import { describe, expect, it } from "vitest";
import type { NewProjectPayload } from "../../shell/types";
import { stampProjectUpdate } from "./stampProjectUpdate";

const NOW = "2026-08-11T10:00:00.000Z";

const basePayload: NewProjectPayload = {
  id: "p-1",
  purpose: "event",
  bandRef: "band-1",
  documentDate: "2026-01-01",
  createdAt: "2026-01-01T08:00:00.000Z",
  updatedAt: "2026-02-01T08:00:00.000Z",
  contentUpdatedAt: "2026-02-01T08:00:00.000Z",
};

describe("stampProjectUpdate", () => {
  it("stamps both fields for a content change", () => {
    const result = stampProjectUpdate(basePayload, "content", NOW);
    expect(result.contentUpdatedAt).toBe(NOW);
    expect(result.updatedAt).toBe(NOW);
  });

  it("stamps only updatedAt for a lifecycle change", () => {
    const result = stampProjectUpdate(basePayload, "lifecycle", NOW);
    expect(result.contentUpdatedAt).toBe("2026-02-01T08:00:00.000Z");
    expect(result.updatedAt).toBe(NOW);
  });

  it("stamps nothing for a system write", () => {
    const result = stampProjectUpdate(basePayload, "system", NOW);
    expect(result.contentUpdatedAt).toBe("2026-02-01T08:00:00.000Z");
    expect(result.updatedAt).toBe("2026-02-01T08:00:00.000Z");
  });

  it("does not mutate the input payload", () => {
    stampProjectUpdate(basePayload, "content", NOW);
    expect(basePayload.updatedAt).toBe("2026-02-01T08:00:00.000Z");
  });

  it("stamps a payload that has no previous stamps", () => {
    const {
      updatedAt: _u,
      contentUpdatedAt: _c,
      ...withoutStamps
    } = basePayload;
    const result = stampProjectUpdate(withoutStamps, "content", NOW);
    expect(result.contentUpdatedAt).toBe(NOW);
    expect(result.updatedAt).toBe(NOW);
  });
});
