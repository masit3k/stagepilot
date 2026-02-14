export function buildProjectUrl(id: string) {
  return `/projects/${id}`;
}

export function buildProjectSetupUrl(id: string) {
  return `${buildProjectUrl(id)}/setup`;
}

export function getCurrentPathname() {
  return window.location.pathname || "/";
}
