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
