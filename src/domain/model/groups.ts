// Co? Definuje pevné pořadí nástrojových skupin a typ Group.
// Proč? Pořadí je tvrdé pravidlo a typ Group brání chybám v datech.

export const GROUP_ORDER = [
  "drums",
  "bass",
  "guitar",
  "keys",
  "vocs",
  "talkback",
] as const;

export type Group = (typeof GROUP_ORDER)[number];

// Co? Type guard pro ověření, že string je validní Group.
// Proč? Data přichází jako stringy a potřebujeme bezpečně filtrovát jen povolené hodnoty.
export function isGroup(v: string): v is Group {
  return (GROUP_ORDER as readonly string[]).includes(v);
}
