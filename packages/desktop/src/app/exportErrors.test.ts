import { describe, expect, it } from "vitest";
import { mapExportError } from "./exportErrors";

describe("mapExportError", () => {
  it("maps file lock errors to file lock user guidance", () => {
    const mapped = mapExportError({
      code: "EXPORT_LOCKED",
      message: "Export PDF is open/locked",
    });
    expect(mapped.kind).toBe("fileLock");
  });

  it("maps parse failures separately from file lock", () => {
    const mapped = mapExportError({
      code: "EXPORT_RESPONSE_INVALID",
      message: "Invalid JSON response from export command",
    });
    expect(mapped.kind).toBe("parseContract");
    expect(mapped.userMessage.toLowerCase()).not.toContain("in use");
  });

  it("maps backend failure to backend classification", () => {
    const mapped = mapExportError({
      code: "EXPORT_FAILED",
      message: "Chromium launch failed",
    });
    expect(mapped.kind).toBe("backendFailure");
  });
});
