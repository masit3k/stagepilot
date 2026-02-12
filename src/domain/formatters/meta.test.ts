import { describe, expect, it } from "vitest";
import { formatDocumentDate } from "./meta.js";

describe("formatDocumentDate", () => {
  it("formats ISO date as D. M. YYYY", () => {
    expect(formatDocumentDate("2026-03-07")).toBe("7. 3. 2026");
  });
});
