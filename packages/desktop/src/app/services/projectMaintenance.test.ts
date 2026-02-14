import { beforeEach, describe, expect, it, vi } from "vitest";
import { refreshProjectsAndMigrate } from "./projectMaintenance";

vi.mock("./projectsApi", () => ({
  listBands: vi.fn(),
  listProjects: vi.fn(),
  readProject: vi.fn(),
  saveProject: vi.fn(),
  deleteProjectPermanently: vi.fn(),
  parseProjectPayload: (raw: string) => JSON.parse(raw),
}));

import * as projectsApi from "./projectsApi";

const mocked = vi.mocked(projectsApi);

describe("refreshProjectsAndMigrate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("migrates legacy id and saves with legacyProjectId", async () => {
    mocked.listBands.mockResolvedValue([{ id: "band-a", name: "Band A", code: "ba" }]);
    mocked.listProjects.mockResolvedValue([{ id: "legacy-id", bandRef: "band-a", purpose: "generic", documentDate: "2024-01-01", createdAt: "2024-01-01" }]);
    mocked.readProject.mockResolvedValue(JSON.stringify({
      id: "legacy-id",
      purpose: "generic",
      bandRef: "band-a",
      documentDate: "2024-01-01",
      createdAt: "2024-01-01",
      legacyId: "legacy-id",
    }));

    await refreshProjectsAndMigrate();

    expect(mocked.saveProject).toHaveBeenCalledTimes(1);
    const args = mocked.saveProject.mock.calls[0][0];
    expect(args.legacyProjectId).toBe("legacy-id");
    expect(args.projectId).not.toBe("legacy-id");
  });

  it("purges trashed project when purgeAt is in the past", async () => {
    mocked.listBands.mockResolvedValue([{ id: "band-a", name: "Band A", code: "ba" }]);
    mocked.listProjects.mockResolvedValue([{ id: "x", bandRef: "band-a", purpose: "generic", documentDate: "2024-01-01", createdAt: "2024-01-01" }]);
    mocked.readProject.mockResolvedValue(JSON.stringify({
      id: "x",
      purpose: "generic",
      bandRef: "band-a",
      documentDate: "2024-01-01",
      createdAt: "2024-01-01",
      status: "trashed",
      purgeAt: "2000-01-01T00:00:00.000Z",
    }));

    await refreshProjectsAndMigrate();

    expect(mocked.deleteProjectPermanently).toHaveBeenCalledWith("x");
  });
});
