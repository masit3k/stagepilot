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
