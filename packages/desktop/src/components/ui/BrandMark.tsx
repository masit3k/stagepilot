/**
 * The StagePilot mark: an XLR connector shell — ring, latch, three pins.
 *
 * Inlined rather than loaded from assets/brand/*.svg so the neutral parts can
 * inherit `currentColor` and follow the active theme, while the top pin keeps
 * the brand accent in both themes. The brand rules forbid recolouring the pins,
 * so `--color-brand-accent` resolves to the same value in light and dark.
 */
export function BrandMark({
  size = 24,
  className,
}: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      fill="none"
      role="img"
      aria-label="StagePilot"
      className={className}
    >
      <rect x="26" y="1" width="12" height="11" rx="3" fill="currentColor" />
      <circle cx="32" cy="34" r="22" stroke="currentColor" strokeWidth="6" />
      <circle cx="32" cy="25" r="5.5" fill="var(--color-brand-accent)" />
      <circle cx="23" cy="41" r="5.5" fill="currentColor" />
      <circle cx="41" cy="41" r="5.5" fill="currentColor" />
    </svg>
  );
}
