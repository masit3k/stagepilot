import { describe, expect, it } from "vitest";
import { describePdfFailure, mapExportError } from "./exportErrors";

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

  it("tells the user when the document does not fit the page", () => {
    const mapped = mapExportError({
      code: "EXPORT_FAILED",
      message:
        "PDF overflow: content does not fit A4 page. elementId=#content dimension=height overflowPx=24",
    });
    expect(mapped.kind).toBe("backendFailure");
    expect(mapped.userMessage).toBe(
      "The document is too tall for one A4 page. Remove or shorten some content and try again.",
    );
  });
});

describe("describePdfFailure", () => {
  it("names the overflowing direction", () => {
    expect(
      describePdfFailure(
        "PDF overflow: content does not fit A4 page. elementId=#content dimension=width overflowPx=3",
      ),
    ).toBe(
      "The document is too wide for one A4 page. Remove or shorten some content and try again.",
    );
  });

  it("falls back to a direction-free sentence for an overflow without one", () => {
    expect(
      describePdfFailure(
        "PDF overflow: content does not fit A4 page. missing element",
      ),
    ).toBe(
      "The document does not fit one A4 page. Remove or shorten some content and try again.",
    );
  });

  it("passes a stage plan collision through, it already says what to do", () => {
    const collision =
      "Stageplan print collision: guitar × lead_voc_1. Blocks overlap on paper — rearrange them in the editor.";
    expect(describePdfFailure(collision)).toBe(collision);
  });

  it("does not recognise other failures", () => {
    expect(describePdfFailure("Chromium launch failed")).toBeNull();
  });
});
