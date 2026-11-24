import { describe, expect, it } from "vitest";
import { escapeHtml } from "./escapeHtml.js";

describe("escapeHtml", () => {
  it("escapes the four characters that can break out of text or an attribute", () => {
    expect(escapeHtml(`A<b>&"B"`)).toBe("A&lt;b&gt;&amp;&quot;B&quot;");
  });

  it("escapes the ampersand first, so entities are not double-escaped", () => {
    expect(escapeHtml("<")).toBe("&lt;");
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
  });

  it("renders null and undefined as an empty string and stringifies numbers", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
    expect(escapeHtml(12)).toBe("12");
  });
});
