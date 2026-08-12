import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { pdfTokens } from "./layout.js";

/**
 * Zdroj pravdy o barvách je packages/desktop/src/styles/primitives.css. Infra
 * vrstva ho nemůže importovat, takže hodnoty v layout.ts jsou kopie — a tenhle
 * test hlídá, že se kopie nerozešly s originálem.
 */
const primitivesPath = path.join(
  process.cwd(),
  "packages",
  "desktop",
  "src",
  "styles",
  "primitives.css",
);

function readPrimitive(name: string): string {
  const css = readFileSync(primitivesPath, "utf8");
  // Dvojtečka hned za názvem: --sp-line: nesmí chytit --sp-line-faint:.
  const match = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8})\\s*;`).exec(css);
  if (!match) {
    throw new Error(`Primitive --${name} not found in primitives.css`);
  }
  return match[1].toLowerCase();
}

const PAIRS = [
  ["ink", "sp-ink"],
  ["body", "sp-body"],
  ["steel", "sp-steel"],
  ["line", "sp-line"],
  ["lineFaint", "sp-line-faint"],
  ["signal", "sp-signal"],
] as const;

describe("pdf colour tokens", () => {
  for (const [token, primitive] of PAIRS) {
    it(`${token} matches --${primitive}`, () => {
      expect(pdfTokens[token]).toBe(readPrimitive(primitive));
    });
  }
});
