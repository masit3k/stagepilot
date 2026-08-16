import { describe, expect, it } from "vitest";
import { pdfLayout, pdfTokens } from "./layout.js";
import { stageplanLayout } from "./sections/stageplan.js";
import { pdfStyles } from "./styles.js";

/** Escapuje regex metaznaky, aby se hodnoty z konstant (např. "7.2pt") daly
 * bezpečně vložit do dynamicky sestaveného regexu. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

describe("pdf notes typography", () => {
  it("matches table text size and drops italic from note paragraphs", () => {
    expect(pdfStyles).toContain(
      `.notes {\n  font-size: ${pdfLayout.typography.table.size};`,
    );
    expect(pdfStyles).not.toContain("font-style: italic");
  });

  it("loads only the two brand families", () => {
    expect(pdfStyles).toContain("font-family: 'Space Grotesk'");
    expect(pdfStyles).toContain("font-family: 'IBM Plex Mono'");
    expect(pdfStyles).not.toContain("Inter");
  });

  it("allows note cells to wrap long note content", () => {
    expect(pdfStyles).toContain(".colNote {");
    expect(pdfStyles).toContain("white-space: normal;");
    expect(pdfStyles).toContain("overflow-wrap: anywhere;");
    expect(pdfStyles).toContain("word-break: break-word;");
  });
});

describe("pdf table", () => {
  it("carries rows on hairlines instead of a frame", () => {
    expect(pdfStyles).not.toContain(".tableBlock");
    expect(pdfStyles).toContain("--w-grid");
  });

  it("sets the channel number in mono", () => {
    expect(pdfStyles).toContain(
      `.table tbody td.colNo {\n  font-family: '${pdfLayout.typography.monoFamily}'`,
    );
  });
});

describe("pdf stageplan identity", () => {
  it("draws every stageplan block the same, with no inverted lead vocal (F6 R11)", () => {
    // R11 mění R5 z F5b: inverze dělala z lead vokálu nejvýraznější prvek
    // stránky, ačkoli jsou všechny bloky rovnocenné pozice na pódiu.
    expect(pdfStyles).toMatch(
      new RegExp(
        `\\.stageplanBox\\s*\\{[^}]*border:\\s*1px solid ${escapeRegExp(pdfTokens.ink)}`,
      ),
    );
    expect(pdfStyles).toMatch(/\.stageplanBox\s*\{[^}]*background:\s*#fff/i);
    expect(pdfStyles).not.toContain("stageplanBox--lead");
    expect(pdfStyles).toMatch(/\.stageplanPower\s*\{[^}]*color:\s*#ff5b1f/i);
    expect(pdfStyles).not.toContain("#F7E65A");
    expect(pdfStyles).not.toContain(".stageplanPowerGap");
  });

  it("keeps the downstage strip and the stage caption legible", () => {
    expect(pdfStyles).toMatch(/\.stageplanDownstage\s*\{[^}]*bottom:\s*0/);
    expect(pdfStyles).toMatch(
      /\.stageplanCaption\s*\{[^}]*letter-spacing:\s*0\.14em/,
    );
  });

  it("pins the caption's height budget so it cannot drift from the renderer (R6)", () => {
    // Rozpočet výšky v stageplan.ts rezervuje přesně captionSize + captionGap
    // (7,2 pt + 4 pt = 11,2 pt) — tahle trojice v CSS to musí přesně splnit,
    // jinak Chromium tiše zmenší celý dokument (F4 finding).
    expect(pdfStyles).toMatch(
      new RegExp(
        `\\.stageplanCaption\\s*\\{[^}]*height:\\s*${escapeRegExp(stageplanLayout.captionSize)}`,
      ),
    );
    expect(pdfStyles).toMatch(/\.stageplanCaption\s*\{[^}]*line-height:\s*1\b/);
    expect(pdfStyles).toMatch(
      new RegExp(
        `\\.stageplanCaption\\s*\\{[^}]*margin-bottom:\\s*${escapeRegExp(stageplanLayout.captionGap)}`,
      ),
    );
  });

  it("sets the band leader line in the same cut as the stage caption (R9)", () => {
    // Typografie se stěhuje dovnitř boxu, nová nevzniká: 7,2 pt mono,
    // prostrkané, šedé — týž řez, který měla vysvětlivka.
    expect(pdfStyles).not.toContain("stageplanLegend");
    expect(pdfStyles).toMatch(
      new RegExp(
        `\\.stageplanBoxRole\\s*\\{[^}]*font-size:\\s*${escapeRegExp(stageplanLayout.boxRoleSize)}`,
      ),
    );
    expect(pdfStyles).toMatch(
      new RegExp(
        `\\.stageplanBoxRole\\s*\\{[^}]*letter-spacing:\\s*${escapeRegExp(stageplanLayout.boxRoleTracking)}`,
      ),
    );
    expect(pdfStyles).toMatch(
      new RegExp(
        `\\.stageplanBoxRole\\s*\\{[^}]*line-height:\\s*${escapeRegExp(stageplanLayout.boxLine)}`,
      ),
    );
    expect(pdfStyles).toMatch(
      new RegExp(
        `\\.stageplanBoxRole\\s*\\{[^}]*color:\\s*${escapeRegExp(pdfTokens.steel)}`,
      ),
    );
  });

  it("turns off kerning and ligatures, so the width formula is exact (R2)", () => {
    // Bez tohohle slepí Chromium dvojice znaků těsněji, než součet šířek z
    // glyphAdvances tvrdí, a šířka boxu by byla odhad, ne číslo.
    expect(pdfStyles).toMatch(/\.stageplanBox\s*\{[^}]*font-kerning:\s*none/);
    expect(pdfStyles).toMatch(
      /\.stageplanBox\s*\{[^}]*font-variant-ligatures:\s*none/,
    );
  });

  it("pads the box with one value on all four sides (R7)", () => {
    expect(pdfStyles).toMatch(
      new RegExp(
        `\\.stageplanBox\\s*\\{[^}]*padding:\\s*${escapeRegExp(stageplanLayout.boxPad)};`,
      ),
    );
    expect(pdfStyles).not.toMatch(/\.stageplanBox\s*\{[^}]*padding-top:/);
  });

  it("refuses to wrap a bullet, and shows it when the text still overflows (R11)", () => {
    // Po R3 je box na svůj nejdelší řádek stavěný, takže zalomit nemá co.
    // Kdyby přesto přeteklo, má to být vidět — overflow: hidden se nezavádí.
    // .stageplanBoxHeader patří do stejné hlídky: je to jediný řádek boxu,
    // kde by 0,05 px navíc nebylo neviditelné přetečení jako u ostatních
    // řádků, ale celý řádek (10 pt) navíc, protože se zalomí.
    expect(pdfStyles).toMatch(
      /\.stageplanBoxHeader\s*\{[^}]*white-space:\s*nowrap/,
    );
    expect(pdfStyles).toMatch(
      /\.stageplanBoxLine\s*\{[^}]*white-space:\s*nowrap/,
    );
    expect(pdfStyles).not.toMatch(
      /\.stageplanBoxLine\s*\{[^}]*word-break:\s*break-word/,
    );
    expect(pdfStyles).toMatch(
      /\.stageplanBoxLine \.text\s*\{[^}]*display:\s*inline;/,
    );
    expect(pdfStyles).not.toMatch(/\.stageplanBox\s*\{[^}]*overflow:\s*hidden/);
  });
});

describe("pdf header contact (R12)", () => {
  it("sets the contact row in the meta cut and keeps the e-mail out of caps", () => {
    expect(pdfStyles).toMatch(
      new RegExp(
        `\\.docHeader__contact\\s*\\{[^}]*font-size:\\s*${escapeRegExp(pdfLayout.typography.meta.size)}`,
      ),
    );
    expect(pdfStyles).toMatch(
      /\.docHeader__contact\s*\{[^}]*text-transform:\s*uppercase/,
    );
    expect(pdfStyles).toMatch(
      /\.docHeader__contactEmail\s*\{[^}]*text-transform:\s*none/,
    );
    expect(pdfStyles).not.toContain(".docFooter__contact");
  });
});
