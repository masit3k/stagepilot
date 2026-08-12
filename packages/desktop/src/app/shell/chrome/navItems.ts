export type ShellNavItem = {
  id: "projects" | "library" | "settings";
  label: string;
  path: string;
};

export const shellNavItems: ShellNavItem[] = [
  { id: "projects", label: "Projects", path: "/" },
  { id: "library", label: "Library", path: "/library" },
  { id: "settings", label: "Settings", path: "/settings" },
];

/**
 * Which pill is lit for a route. Everything outside the two named sections
 * belongs to Projects, because that is where the project routes live.
 */
export function activeNavId(pathname: string): ShellNavItem["id"] {
  if (pathname.startsWith("/library")) return "library";
  if (pathname.startsWith("/settings")) return "settings";
  return "projects";
}
