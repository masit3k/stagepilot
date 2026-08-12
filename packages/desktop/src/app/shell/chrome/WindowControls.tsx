import { useEffect, useState } from "react";
import {
  Close,
  WindowMaximize,
  WindowMinimize,
  WindowRestore,
} from "../../../components/ui/icons";
import {
  closeWindow,
  isWindowMaximized,
  minimizeWindow,
  onWindowResized,
  toggleMaximizeWindow,
} from "./windowActions";

/**
 * Reports rather than swallows. These calls do not fail in practice, and when
 * they do the user can see it — the window simply did not move — so the log with
 * context is what is actually useful, the way the rest of the app treats
 * infrastructure failures.
 */
function run(action: () => Promise<unknown>, what: string) {
  return () => {
    action().catch((error: unknown) => {
      console.error("Window control failed", { action: what, error });
    });
  };
}

/**
 * The right end of the title bar. Rendered only where the Tauri bridge exists —
 * see `hasNativeWindowApi` — so there are no buttons that cannot work.
 */
export function WindowControls() {
  const [maximized, setMaximized] = useState(false);

  // The middle button's icon has to follow the real window state, which changes
  // through Aero Snap and Win+↑ as well as through this button.
  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | undefined;

    const sync = () => {
      isWindowMaximized()
        .then((value) => {
          if (active) setMaximized(value);
        })
        .catch((error: unknown) => {
          console.error("Reading the window state failed", error);
        });
    };

    sync();
    onWindowResized(sync)
      .then((stop) => {
        if (active) unlisten = stop;
        else stop();
      })
      .catch((error: unknown) => {
        console.error("Subscribing to window resizes failed", error);
      });

    return () => {
      active = false;
      unlisten?.();
    };
  }, []);

  return (
    <div className="titlebar__controls">
      <button
        type="button"
        className="titlebar__control"
        onClick={run(minimizeWindow, "minimize")}
        aria-label="Minimize"
      >
        <WindowMinimize size={12} />
      </button>
      <button
        type="button"
        className="titlebar__control"
        onClick={run(toggleMaximizeWindow, "toggle maximize")}
        aria-label={maximized ? "Restore" : "Maximize"}
      >
        {maximized ? <WindowRestore size={12} /> : <WindowMaximize size={12} />}
      </button>
      <button
        type="button"
        className="titlebar__control titlebar__control--close"
        onClick={run(closeWindow, "close")}
        aria-label="Close"
      >
        <Close size={13} />
      </button>
    </div>
  );
}
