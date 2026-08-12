/**
 * WCAG 2.1 contrast maths.
 *
 * Pure functions only — no I/O, no side effects. Callers that need to read
 * stylesheets do the reading themselves and pass values in.
 */

export type Rgb = {
  readonly r: number;
  readonly g: number;
  readonly b: number;
};

/** Minimum contrast for text below 18.66px (or below 24px when bold). */
export const AA_NORMAL_TEXT = 4.5;
/** Minimum contrast for large text, and for non-text elements carrying meaning. */
export const AA_LARGE_TEXT = 3;

const HEX_PATTERN = /^#?(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export function parseHexColor(hex: string): Rgb {
  const value = hex.trim();
  if (!HEX_PATTERN.test(value)) {
    throw new Error(`Not a hex colour: ${hex}`);
  }

  const digits = value.replace("#", "");
  const expanded =
    digits.length === 3
      ? digits
          .split("")
          .map((digit) => digit + digit)
          .join("")
      : digits;

  return {
    r: Number.parseInt(expanded.slice(0, 2), 16),
    g: Number.parseInt(expanded.slice(2, 4), 16),
    b: Number.parseInt(expanded.slice(4, 6), 16),
  };
}

function channelLuminance(channel: number): number {
  const normalised = channel / 255;
  return normalised <= 0.03928
    ? normalised / 12.92
    : ((normalised + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(color: Rgb): number {
  return (
    0.2126 * channelLuminance(color.r) +
    0.7152 * channelLuminance(color.g) +
    0.0722 * channelLuminance(color.b)
  );
}

export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(parseHexColor(foreground));
  const b = relativeLuminance(parseHexColor(background));
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

export function meetsContrast(
  foreground: string,
  background: string,
  minimum: number,
): boolean {
  return contrastRatio(foreground, background) >= minimum;
}
