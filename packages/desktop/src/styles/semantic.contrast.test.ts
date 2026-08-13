/**
 * Guards the semantic colour layer against contrast regressions.
 *
 * The dark theme broke because 56 colour literals lived in component CSS and
 * nothing checked them. This test reads the real stylesheets — not a duplicated
 * copy of the values — resolves the var() chains, and asserts every text pair
 * in both themes clears WCAG AA.
 *
 * When you add a text/background role to semantic.css, add the pair here too.
 * That is the whole contract.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  AA_LARGE_TEXT,
  AA_NORMAL_TEXT,
  contrastRatio,
} from "../../../../src/domain/design/contrast";

const stylesDir = path.join(
  process.cwd(),
  "packages",
  "desktop",
  "src",
  "styles",
);

function readStyles(file: string): string {
  return readFileSync(path.join(stylesDir, file), "utf8");
}

/** Pulls the declarations out of the first rule whose selector matches exactly. */
function extractBlock(css: string, selector: string): string {
  // Escape the selector so [data-theme="dark"] is matched literally.
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "m").exec(css);
  if (!match) throw new Error(`No rule found for selector: ${selector}`);
  return match[1];
}

function parseDeclarations(block: string): Map<string, string> {
  const declarations = new Map<string, string>();
  // Strip comments first so commented-out values never leak in.
  const withoutComments = block.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const line of withoutComments.split(";")) {
    const match = /^\s*(--[\w-]+)\s*:\s*(.+?)\s*$/s.exec(line);
    if (match) declarations.set(match[1], match[2].replace(/\s+/g, " ").trim());
  }
  return declarations;
}

const primitives = parseDeclarations(
  extractBlock(readStyles("primitives.css"), ":root"),
);
const semanticCss = readStyles("semantic.css");
const lightSemantics = parseDeclarations(extractBlock(semanticCss, ":root"));
const darkSemantics = parseDeclarations(
  extractBlock(semanticCss, ':root[data-theme="dark"]'),
);

/**
 * Resolves a semantic token to a hex colour, following var() indirection into
 * the primitive layer. Throws rather than guessing, so a typo in a token name
 * fails the suite instead of silently skipping a pair.
 */
function resolve(token: string, theme: Map<string, string>): string {
  const seen = new Set<string>();
  let current = theme.get(token) ?? primitives.get(token);
  if (current === undefined) throw new Error(`Token is not defined: ${token}`);

  while (current.startsWith("var(")) {
    const referenced = /^var\(\s*(--[\w-]+)\s*\)$/.exec(current);
    if (!referenced)
      throw new Error(`Cannot resolve value of ${token}: ${current}`);
    const next = referenced[1];
    if (seen.has(next)) throw new Error(`Circular token reference at ${next}`);
    seen.add(next);
    const value = theme.get(next) ?? primitives.get(next);
    if (value === undefined) throw new Error(`Token is not defined: ${next}`);
    current = value;
  }

  if (!current.startsWith("#")) {
    throw new Error(`Token ${token} is not a hex colour: ${current}`);
  }
  return current;
}

type Pair = {
  readonly foreground: string;
  readonly background: string;
  readonly minimum: number;
  readonly what: string;
};

const TEXT_ON_SURFACES: readonly { fg: string; what: string }[] = [
  { fg: "--color-text", what: "primary text" },
  { fg: "--color-text-body", what: "body text" },
  { fg: "--color-text-secondary", what: "secondary text" },
];

const SURFACES = [
  "--color-bg",
  "--color-surface",
  "--color-surface-raised",
] as const;

/** Editor stage planu je tmavý v obou tématech, takže roly platí pro oba. */
const STAGE_SURFACES = [
  "--color-stage-canvas",
  "--color-stage-block",
  "--color-stage-block-selected",
] as const;

const STAGE_TEXT: readonly { fg: string; what: string }[] = [
  { fg: "--color-stage-text", what: "stage text" },
  { fg: "--color-stage-text-mid", what: "stage mid text" },
  { fg: "--color-stage-text-dim", what: "stage dim text" },
];

function buildPairs(): Pair[] {
  const pairs: Pair[] = [];

  // Every text role has to survive on every surface it can land on. The old
  // palette failed exactly here: muted text passed on white and failed on the
  // two tinted backgrounds.
  for (const { fg, what } of TEXT_ON_SURFACES) {
    for (const background of SURFACES) {
      pairs.push({
        foreground: fg,
        background,
        minimum: AA_NORMAL_TEXT,
        what: `${what} on ${background.replace("--color-", "")}`,
      });
    }
  }

  for (const { fg, what } of STAGE_TEXT) {
    for (const background of STAGE_SURFACES) {
      pairs.push({
        foreground: fg,
        background,
        minimum: AA_NORMAL_TEXT,
        what: `${what} on ${background.replace("--color-stage-", "stage ")}`,
      });
    }
  }

  // Accent used as text — the reason signalText exists alongside signal.
  for (const background of [...SURFACES, "--color-accent-wash"]) {
    pairs.push({
      foreground: "--color-accent-text",
      background,
      minimum: AA_NORMAL_TEXT,
      what: `accent text on ${background.replace("--color-", "")}`,
    });
  }

  // Primary action in all three interaction states.
  for (const background of [
    "--color-primary",
    "--color-primary-hover",
    "--color-primary-active",
  ]) {
    pairs.push({
      foreground: "--color-primary-text",
      background,
      minimum: AA_NORMAL_TEXT,
      what: `primary button label on ${background.replace("--color-", "")}`,
    });
  }

  pairs.push(
    {
      foreground: "--color-secondary-text",
      background: "--color-secondary",
      minimum: AA_NORMAL_TEXT,
      what: "secondary button label",
    },
    {
      foreground: "--color-secondary-text",
      background: "--color-secondary-hover",
      minimum: AA_NORMAL_TEXT,
      what: "secondary button label on hover",
    },
    {
      foreground: "--color-selected-text",
      background: "--color-selected-surface",
      minimum: AA_NORMAL_TEXT,
      what: "selected item label",
    },
    {
      foreground: "--color-danger-solid-text",
      background: "--color-danger-solid",
      minimum: AA_NORMAL_TEXT,
      what: "destructive button label",
    },
    {
      foreground: "--color-danger-solid-text",
      background: "--color-danger-solid-hover",
      minimum: AA_NORMAL_TEXT,
      what: "destructive button label on hover",
    },
  );

  // Status messages, on their own wash and on a plain card. These are the
  // pairs that collapsed to 2.06-2.27:1 in the old dark theme.
  for (const state of ["danger", "warning", "success", "info"] as const) {
    pairs.push(
      {
        foreground: `--color-${state}-text`,
        background: `--color-${state}-surface`,
        minimum: AA_NORMAL_TEXT,
        what: `${state} message on its own surface`,
      },
      {
        foreground: `--color-${state}-text`,
        background: "--color-surface",
        minimum: AA_NORMAL_TEXT,
        what: `${state} text on a card`,
      },
    );
  }

  // Title bar chrome. It stays dark in both themes — it is the window frame,
  // not page content — so the values match, but both themes are still checked so
  // a future theme cannot quietly recolour the frame out of contrast.
  // The glyph pairs use the 3:1 minimum: a window control is a graphical object
  // (WCAG 1.4.11), not text.
  pairs.push(
    {
      foreground: "--color-titlebar-text",
      background: "--color-titlebar",
      minimum: AA_NORMAL_TEXT,
      what: "title bar app name",
    },
    {
      foreground: "--color-titlebar-text-dim",
      background: "--color-titlebar",
      minimum: AA_NORMAL_TEXT,
      what: "title bar project name",
    },
    {
      foreground: "--color-titlebar-control",
      background: "--color-titlebar",
      minimum: AA_LARGE_TEXT,
      what: "window control glyph",
    },
    {
      foreground: "--color-titlebar-text",
      background: "--color-titlebar-control-hover",
      minimum: AA_LARGE_TEXT,
      what: "window control glyph on hover",
    },
    {
      foreground: "--color-titlebar-close-text",
      background: "--color-titlebar-close-hover",
      minimum: AA_LARGE_TEXT,
      what: "close glyph on its hover fill",
    },
    // The active navigation pill fills with the text colour and prints the label
    // in its inverse, so the pair flips with the theme instead of being fixed.
    {
      foreground: "--color-text-inverse",
      background: "--color-text",
      minimum: AA_NORMAL_TEXT,
      what: "active navigation pill label",
    },
  );

  // The focus ring is the one non-text element that must always be visible:
  // it is the sole indicator of keyboard position. Decorative borders are not
  // checked — selection is carried by fill and label colour as well, so no
  // border is ever the only signal.
  for (const background of SURFACES) {
    pairs.push({
      foreground: "--color-focus",
      background,
      minimum: AA_LARGE_TEXT,
      what: `focus ring on ${background.replace("--color-", "")}`,
    });
  }

  return pairs;
}

const pairs = buildPairs();
const themes = [
  { name: "light", tokens: lightSemantics },
  { name: "dark", tokens: darkSemantics },
] as const;

describe("semantic colour layer", () => {
  it("defines the same set of tokens in both themes", () => {
    // A role missing from the dark theme silently falls back to the light
    // value — the precise failure mode that produced the broken dark mode.
    const lightOnly = [...lightSemantics.keys()].filter(
      (token) => !darkSemantics.has(token),
    );
    expect(lightOnly).toEqual([]);
  });

  it("keeps the brand accent identical in both themes", () => {
    expect(resolve("--color-brand-accent", darkSemantics)).toBe(
      resolve("--color-brand-accent", lightSemantics),
    );
  });

  for (const theme of themes) {
    describe(`${theme.name} theme`, () => {
      for (const pair of pairs) {
        it(`${pair.what} meets ${pair.minimum}:1`, () => {
          const foreground = resolve(pair.foreground, theme.tokens);
          const background = resolve(pair.background, theme.tokens);
          const ratio = contrastRatio(foreground, background);
          expect(
            ratio,
            `${pair.foreground} (${foreground}) on ${pair.background} (${background}) is ${ratio.toFixed(2)}:1`,
          ).toBeGreaterThanOrEqual(pair.minimum);
        });
      }
    });
  }
});
