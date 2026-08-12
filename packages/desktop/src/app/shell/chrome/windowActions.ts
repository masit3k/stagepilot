/**
 * The imperative half of the title bar: the three window operations plus the
 * maximised flag the button icon follows.
 *
 * The Tauri module is imported lazily so this file stays loadable where the
 * bridge does not exist — the Vite dev server in a plain browser and the node
 * environment the tests run in. Callers gate on `hasNativeWindowApi()` first;
 * the lazy import means an accidental call fails at the call site rather than
 * at module load.
 */

async function currentWindow() {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow();
}

export async function minimizeWindow(): Promise<void> {
  await (await currentWindow()).minimize();
}

export async function toggleMaximizeWindow(): Promise<void> {
  await (await currentWindow()).toggleMaximize();
}

export async function closeWindow(): Promise<void> {
  await (await currentWindow()).close();
}

export async function isWindowMaximized(): Promise<boolean> {
  return (await currentWindow()).isMaximized();
}

/**
 * Calls back whenever the window is resized, which covers maximise and restore
 * however they were triggered — button, drag to the top edge, or Win+↑.
 * Resolves with the unsubscribe function.
 */
export async function onWindowResized(
  handler: () => void,
): Promise<() => void> {
  return (await currentWindow()).onResized(() => handler());
}
