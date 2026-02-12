import { describe, expect, it } from "vitest";
import { formatVocalLabel } from "./vocals.js";

describe("formatVocalLabel", () => {
  it("suppresses numbering for single lead", () => {
    expect(formatVocalLabel({ role: "lead", index: 1, gender: "f", leadCount: 1 })).toBe("Lead vocal");
  });

  it("includes numbering and gender for multiple leads", () => {
    expect(formatVocalLabel({ role: "lead", index: 2, gender: "m", leadCount: 2 })).toBe("Lead vocal 2 (m)");
  });

  it("omits unknown gender marker", () => {
    expect(formatVocalLabel({ role: "lead", index: 2, gender: "x", leadCount: 2 })).toBe("Lead vocal 2");
  });
});
