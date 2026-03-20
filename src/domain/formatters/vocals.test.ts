import { describe, expect, it } from "vitest";
import { formatVocalLabel } from "./vocals.js";

describe("formatVocalLabel", () => {
  it("keeps numbering for lead vocals", () => {
    expect(formatVocalLabel({ role: "lead", index: 1, gender: "f", roleCount: 1 })).toBe("Lead vocal 1 (female)");
  });

  it("includes numbering and gender for multiple leads", () => {
    expect(formatVocalLabel({ role: "lead", index: 2, gender: "m", roleCount: 2 })).toBe("Lead vocal 2 (male)");
  });

  it("omits unknown gender marker", () => {
    expect(formatVocalLabel({ role: "lead", index: 2, gender: "x", roleCount: 2 })).toBe("Lead vocal 2");
  });

  it("formats back vocals with separate role text", () => {
    expect(formatVocalLabel({ role: "back", index: 2, gender: "m", roleCount: 2 })).toBe("Back vocal 2 (male)");
  });

  it("formats multi-lead label with parentheses and lowercase gender", () => {
    expect(
      formatVocalLabel({
        role: "lead",
        index: 1,
        gender: "m",
        roleCount: 2,
        }),
    ).toBe("Lead vocal 1 (male)");
  });
});
