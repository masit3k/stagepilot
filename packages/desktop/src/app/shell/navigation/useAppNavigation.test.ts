import { describe, expect, it } from "vitest";
import { resolvePopstateNavigation } from "./useAppNavigation";

describe("resolvePopstateNavigation", () => {
  it("creates pending navigation and restore path when dirty", () => {
    const result = resolvePopstateNavigation({ targetPath: "/projects/new", currentPath: "/", isDirty: true });
    expect(result).toEqual({
      restorePath: "/",
      pendingNavigation: "/projects/new",
      applyTarget: false,
    });
  });
});
