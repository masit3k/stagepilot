import { describe, expect, it } from "vitest";
import { formatVocalLabel } from "./vocals.js";

describe("formatVocalLabel", () => {
  it("renders single lead without numbering", () => {
    expect(formatVocalLabel({ role: "lead", index: 1, gender: "f", roleCount: 1 })).toBe("Lead vocal");
  });

  it("includes numbering and gender for multiple leads", () => {
    expect(formatVocalLabel({ role: "lead", index: 2, gender: "m", roleCount: 2 })).toBe("Lead vocal 2 (male)");
  });

  it("omits unknown gender marker", () => {
    expect(formatVocalLabel({ role: "lead", index: 2, gender: "x", roleCount: 2 })).toBe("Lead vocal 2");
  });

  it("renders single back vocal without numbering", () => {
    expect(formatVocalLabel({ role: "back", index: 1, gender: "m", roleCount: 1 })).toBe("Back vocal (male)");
  });

  it("formats multi-back label with numbering", () => {
    expect(formatVocalLabel({ role: "back", index: 2, gender: "m", roleCount: 2 })).toBe("Back vocal 2 (male)");
  });
});
