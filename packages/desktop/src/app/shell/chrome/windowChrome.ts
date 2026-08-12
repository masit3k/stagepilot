/**
 * What the title bar needs to know, without React and without touching `window`
 * at import time — both so it stays testable in the node environment, and so the
 * bar renders identically in `npm run dev`, where there is no Tauri bridge.
 */

import {
  matchProjectEventPath,
  matchProjectGenericPath,
  matchProjectPreviewPath,
  matchProjectSetupPath,
} from "../routes";

export type TitleBarProject = {
  readonly id: string;
  readonly displayName?: string | null;
  readonly slug?: string | null;
};

/**
 * Whether the window controls can do anything. In a plain browser the Tauri
 * bridge is absent, so the buttons are left out rather than shown inert.
 */
export function hasNativeWindowApi(scope: object = globalThis): boolean {
  return "__TAURI_INTERNALS__" in scope;
}

/**
 * The open project's name for the title bar, or null when no project is open.
 *
 * Falls back to the slug and then to nothing: a raw uuid in the title bar is
 * noise, not information. `/projects/new/event` resolves to the literal `new`,
 * which matches no project and so correctly yields null.
 */
export function titleBarProjectLabel(
  pathname: string,
  projects: readonly TitleBarProject[],
): string | null {
  const projectId =
    matchProjectSetupPath(pathname) ??
    matchProjectPreviewPath(pathname) ??
    matchProjectEventPath(pathname) ??
    matchProjectGenericPath(pathname);
  if (projectId === null) return null;

  const project = projects.find((candidate) => candidate.id === projectId);
  if (project === undefined) return null;

  return project.displayName?.trim() || project.slug?.trim() || null;
}
