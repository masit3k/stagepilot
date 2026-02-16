export type ShellRouteDef = {
  key: string;
  test: (pathname: string) => boolean;
};

export const SHELL_ROUTES: ShellRouteDef[] = [
  { key: "home", test: (pathname) => pathname === "/" },
  { key: "projects-new", test: (pathname) => pathname === "/projects/new" },
  { key: "projects-new-event", test: (pathname) => pathname === "/projects/new/event" },
  { key: "projects-new-generic", test: (pathname) => pathname === "/projects/new/generic" },
  { key: "project-event", test: (pathname) => Boolean(matchProjectEventPath(pathname)) },
  { key: "project-generic", test: (pathname) => Boolean(matchProjectGenericPath(pathname)) },
  { key: "project-setup", test: (pathname) => Boolean(matchProjectSetupPath(pathname)) },
  { key: "project-preview", test: (pathname) => Boolean(matchProjectPreviewPath(pathname)) },
  { key: "library", test: (pathname) => pathname === "/library" },
  { key: "library-bands", test: (pathname) => pathname === "/library/bands" },
  { key: "library-band-detail", test: (pathname) => Boolean(matchLibraryBandDetailPath(pathname)) },
  { key: "library-musicians", test: (pathname) => pathname === "/library/musicians" },
  { key: "library-instruments", test: (pathname) => pathname === "/library/instruments" },
  { key: "library-contacts", test: (pathname) => pathname === "/library/contacts" },
  { key: "library-messages", test: (pathname) => pathname === "/library/messages" },
  { key: "settings", test: (pathname) => pathname === "/settings" },
];

export function matchProjectSetupPath(pathname: string): string | null {
  return pathname.match(/^\/projects\/([^/]+)\/setup$/)?.[1] ?? null;
}

export function matchProjectPreviewPath(pathname: string): string | null {
  return pathname.match(/^\/projects\/([^/]+)\/preview$/)?.[1] ?? null;
}

export function matchProjectEventPath(pathname: string): string | null {
  return pathname.match(/^\/projects\/([^/]+)\/event$/)?.[1] ?? null;
}

export function matchProjectGenericPath(pathname: string): string | null {
  return pathname.match(/^\/projects\/([^/]+)\/generic$/)?.[1] ?? null;
}

export function matchLibraryBandDetailPath(pathname: string): string | null {
  return pathname.match(/^\/library\/bands\/([^/]+)$/)?.[1] ?? null;
}

export function withFrom(path: string, from: string, fromPath?: string) {
  const params = new URLSearchParams({ from });
  if (fromPath) params.set("fromPath", fromPath);
  return `${path}?${params.toString()}`;
}

export function getNavigationContextLabel(origin?: string | null) {
  if (origin === "home") return "Project Hub";
  if (origin === "setup") return "Lineup Setup";
  if (origin === "preview") return "PDF Preview";
  if (origin === "pdfPreview") return "PDF Preview";
  return null;
}
