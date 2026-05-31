import { describe, expect, it } from "vitest";
import { normalizeTalkbackLabel } from "./buildPdfTalkback.js";

describe("normalizeTalkbackLabel", () => {
  it("normalizes hyphen-separated label to parenthesis form", () => {
    expect(normalizeTalkbackLabel("Talkback - bass")).toBe("Talkback (bass)");
  });

  it("normalizes en-dash-separated label to parenthesis form", () => {
    expect(normalizeTalkbackLabel("Talkback – bass")).toBe("Talkback (bass)");
  });

  it("keeps already-normalized parenthesis form unchanged", () => {
    expect(normalizeTalkbackLabel("Talkback (bass)")).toBe("Talkback (bass)");
  });

  it("is case-insensitive for the Talkback prefix", () => {
    expect(normalizeTalkbackLabel("talkback - guitar")).toBe(
      "Talkback (guitar)",
    );
  });

  it("preserves unrecognized patterns as-is", () => {
    expect(normalizeTalkbackLabel("Something else")).toBe("Something else");
  });
});
