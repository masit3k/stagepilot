import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { catalogPathsForRoot, resolveStorageRoot } from "./catalogPaths.js";

const originalAppData = process.env.APPDATA;

afterEach(() => {
  if (originalAppData === undefined) {
    process.env.APPDATA = undefined;
  } else {
    process.env.APPDATA = originalAppData;
  }
});

describe("storage root paths", () => {
  it("resolves runtime storage under the clean StagePilot AppData root", () => {
    const appData = path.join("C:", "Users", "tester", "AppData", "Roaming");
    process.env.APPDATA = appData;

    const root = resolveStorageRoot();
    const normalized = root.split(path.sep).join("/");

    expect(path.basename(root)).toBe("StagePilot");
    expect(normalized).not.toMatch(
      /com\.mkrecmer\.stagepilot-desktop\/stagepilot$/,
    );
    if (process.platform === "win32") {
      expect(root).toBe(path.join(appData, "StagePilot"));
    }
  });

  it("keeps storage metadata and project directories directly under the resolved root", () => {
    const root = path.join(
      "C:",
      "Users",
      "tester",
      "AppData",
      "Roaming",
      "StagePilot",
    );
    const paths = catalogPathsForRoot(root);

    expect(paths.storageMeta).toBe(path.join(root, "storage.json"));
    expect(paths.projects).toBe(path.join(root, "projects"));
    expect(paths.exports).toBe(path.join(root, "exports"));
    expect(paths.temp).toBe(path.join(root, "temp"));
    expect(paths.versions).toBe(path.join(root, "versions"));
  });
});
